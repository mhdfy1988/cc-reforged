import type { OpenAiImageGenerationCallItem } from './openaiImageGenerationAdapter.js'

type JsonObject = Record<string, unknown>

export function collectOpenAiResponsesImageGenerationCalls(input: {
  raw?: { output?: JsonObject[] }
  events: readonly JsonObject[]
}): OpenAiImageGenerationCallItem[] {
  const collector = createImageGenerationCallCollector()
  for (const item of input.raw?.output ?? []) {
    collector.add(item)
  }

  for (const event of input.events) {
    collector.add(event)
    const item = toRecord(event.item)
    if (item) {
      collector.add(item)
    }
    const response = toRecord(event.response)
    for (const outputItem of toRecordArray(response?.output)) {
      collector.add(outputItem)
    }
    for (const outputItem of toRecordArray(event.output)) {
      collector.add(outputItem)
    }
  }
  return collector.values()
}

function createImageGenerationCallCollector(): {
  add: (value: JsonObject | undefined) => void
  values: () => OpenAiImageGenerationCallItem[]
} {
  const calls: OpenAiImageGenerationCallItem[] = []
  const indexByKey = new Map<string, number>()

  return {
    add(value) {
      if (!value || value.type !== 'image_generation_call') {
        return
      }
      const call = value as OpenAiImageGenerationCallItem
      const key = getNonEmptyString(call.id) ?? getNonEmptyString(call.call_id)
      if (!key) {
        calls.push(call)
        return
      }

      const existingIndex = indexByKey.get(key)
      if (existingIndex === undefined) {
        indexByKey.set(key, calls.length)
        calls.push(call)
        return
      }

      const existing = calls[existingIndex]
      if (shouldReplaceImageGenerationCall(existing, call)) {
        calls[existingIndex] = call
      }
    },
    values() {
      return calls
    },
  }
}

function shouldReplaceImageGenerationCall(
  current: OpenAiImageGenerationCallItem,
  next: OpenAiImageGenerationCallItem,
): boolean {
  const currentResult = getNonEmptyString(current.result)
  const nextResult = getNonEmptyString(next.result)
  if (!currentResult && nextResult) {
    return true
  }
  if (currentResult && !nextResult) {
    return false
  }
  const currentRank = getImageGenerationCallStatusRank(current.status)
  const nextRank = getImageGenerationCallStatusRank(next.status)
  if (nextRank !== currentRank) {
    return nextRank > currentRank
  }
  return Object.keys(next).length > Object.keys(current).length
}

function getImageGenerationCallStatusRank(status: string | undefined): number {
  switch (status) {
    case 'completed':
    case 'succeeded':
      return 4
    case 'generating':
      return 3
    case 'in_progress':
      return 2
    case 'queued':
      return 1
    case 'failed':
    case 'cancelled':
      return 0
    default:
      return -1
  }
}

function toRecord(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined
}

function toRecordArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value
        .map(item => toRecord(item))
        .filter((item): item is JsonObject => Boolean(item))
    : []
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
