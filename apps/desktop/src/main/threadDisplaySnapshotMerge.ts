import type {
  ThreadDisplayCounts,
  ThreadDisplayDiagnostic,
  ThreadDisplayItem,
  ThreadDisplaySnapshot,
} from '../../../../src/app-server/protocol.js'

export function mergeThreadDisplaySnapshot(
  current: ThreadDisplaySnapshot | null,
  next: ThreadDisplaySnapshot | null | undefined,
  expectedThreadId?: string,
): ThreadDisplaySnapshot | null {
  const currentForThread =
    expectedThreadId && current?.threadId !== expectedThreadId ? null : current

  if (next && expectedThreadId && next.threadId !== expectedThreadId) {
    return currentForThread
  }
  if (!currentForThread) {
    return next ?? null
  }
  if (!next) {
    return null
  }
  if (currentForThread.threadId !== next.threadId) {
    return next
  }
  if (!isThreadDisplaySnapshotRegression(currentForThread, next)) {
    return next
  }

  const items = mergeThreadDisplayItems(currentForThread.items, next.items)
  const diagnostics = mergeThreadDisplayDiagnostics(
    currentForThread.diagnostics,
    next.diagnostics,
  )

  return {
    ...next,
    items,
    counts: mergeThreadDisplayCounts(
      currentForThread.counts,
      next.counts,
      items,
    ),
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  }
}

function isThreadDisplaySnapshotRegression(
  current: ThreadDisplaySnapshot,
  next: ThreadDisplaySnapshot,
): boolean {
  return (
    next.items.length < current.items.length ||
    next.counts.visibleTimelineItems < current.counts.visibleTimelineItems ||
    next.counts.rawTranscriptEvents < current.counts.rawTranscriptEvents
  )
}

function mergeThreadDisplayItems(
  current: ThreadDisplayItem[],
  next: ThreadDisplayItem[],
): ThreadDisplayItem[] {
  const nextById = new Map(next.map(item => [item.id, item]))
  const seen = new Set<string>()
  const merged: ThreadDisplayItem[] = []

  for (const item of current) {
    const replacement = nextById.get(item.id)
    merged.push(replacement ?? item)
    seen.add(item.id)
  }
  for (const item of next) {
    if (seen.has(item.id)) {
      continue
    }
    merged.push(item)
    seen.add(item.id)
  }
  return merged
}

function mergeThreadDisplayCounts(
  current: ThreadDisplayCounts,
  next: ThreadDisplayCounts,
  items: ThreadDisplayItem[],
): ThreadDisplayCounts {
  const visibleTimelineItems = countVisibleThreadDisplayItems(items)
  const projectedDisplayItems = items.length
  const hiddenDisplayItems = Math.max(
    0,
    projectedDisplayItems - visibleTimelineItems,
  )
  const rawTranscriptEvents = Math.max(
    getThreadDisplayCount(current, 'rawTranscriptEvents'),
    getThreadDisplayCount(next, 'rawTranscriptEvents'),
    projectedDisplayItems,
  )
  const coreContextMessages = Math.max(
    getThreadDisplayCount(current, 'coreContextMessages'),
    getThreadDisplayCount(next, 'coreContextMessages'),
  )
  const filteredTranscriptEvents = Math.max(
    0,
    rawTranscriptEvents - projectedDisplayItems,
  )

  return {
    rawTranscriptEvents,
    coreContextMessages,
    projectedDisplayItems,
    visibleTimelineItems,
    hiddenDisplayItems,
    filteredTranscriptEvents,
    hiddenTimelineItems: hiddenDisplayItems + filteredTranscriptEvents,
  }
}

function getThreadDisplayCount(
  counts: ThreadDisplayCounts,
  field: keyof ThreadDisplayCounts,
): number {
  const value = counts[field]
  return Number.isFinite(value) ? value : 0
}

function countVisibleThreadDisplayItems(items: ThreadDisplayItem[]): number {
  return items.filter(item => item.timelineHidden !== true).length
}

function mergeThreadDisplayDiagnostics(
  current: ThreadDisplayDiagnostic[] | undefined,
  next: ThreadDisplayDiagnostic[] | undefined,
): ThreadDisplayDiagnostic[] {
  const merged: ThreadDisplayDiagnostic[] = []
  const seen = new Set<string>()

  for (const diagnostic of [...(current ?? []), ...(next ?? [])]) {
    const key = `${diagnostic.level}:${diagnostic.code}:${diagnostic.message}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(diagnostic)
  }
  return merged
}
