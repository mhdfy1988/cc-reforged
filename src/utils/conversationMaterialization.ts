import type { UUID } from 'crypto'
import { readFile } from 'fs/promises'

import type { Entry, SerializedMessage, TranscriptMessage } from '../types/logs.js'
import { isCompactBoundaryMessage } from './messages.js'
import {
  buildConversationChain,
  isTranscriptMessage,
  loadTranscriptFile,
  removeExtraFields,
} from './sessionStorage.js'

type LoadedTranscript = Awaited<ReturnType<typeof loadTranscriptFile>>
type OrderedTranscriptMessage = {
  rawIndex: number
  message: TranscriptMessage
}
type TranscriptMalformedJsonlLine = {
  rawIndex: number
  error: string
}
type ParsedTranscriptJsonlLine<T> = {
  rawIndex: number
  entry: T
}

export type ConversationMaterializationStatus = 'ok' | 'error'

export type ConversationMaterializationDiagnostic = {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
  details?: Record<string, unknown>
}

export type MaterializedTranscriptEventKind =
  | 'user_input'
  | 'assistant_response'
  | 'tool_use'
  | 'tool_result'
  | 'compact_boundary'
  | 'sidechain'
  | 'system_event'
  | 'diagnostic'

export type MaterializedTranscriptEvent = {
  kind: MaterializedTranscriptEventKind
  rawIndex: number
  materializedIndex: number
  uuid: UUID | undefined
  parentUuid: UUID | null | undefined
  logicalParentUuid: UUID | null | undefined
  sourceToolAssistantUUID: UUID | undefined
  sessionId: UUID | undefined
  transcriptType: TranscriptMessage['type']
  isSidechain: boolean
  contentIndex?: number
  toolUseId?: string
  advancesMainTail: boolean
  skipReason?: string
}

export type MaterializedConversationMetadata = Omit<
  LoadedTranscript,
  'messages' | 'leafUuids'
>

export type MaterializedConversation = {
  status: ConversationMaterializationStatus
  /** @deprecated 兼容字段；语义等同 currentContextMessages。 */
  messages: SerializedMessage[]
  currentContextMessages: SerializedMessage[]
  displayReplayEvents: SerializedMessage[]
  sessionId: UUID | undefined
  currentContextTailUuid: UUID | undefined
  currentContextTailEvent: MaterializedTranscriptEvent | undefined
  /** @deprecated 兼容字段；语义等同 currentContextTailUuid，不再表示 parent graph leaf。 */
  canonicalLeafUuid: UUID | undefined
  rawTranscriptEvents: number
  materializedTranscriptEvents: number
  coreContextMessages: number
  classifiedTranscriptEvents: MaterializedTranscriptEvent[]
  diagnostics: ConversationMaterializationDiagnostic[]
  metadata: MaterializedConversationMetadata
}

type PreservedSegment = {
  headUuid: UUID
  tailUuid: UUID
  anchorUuid: UUID
}

type CompactBoundaryInfo = {
  uuid: UUID
  entry: TranscriptMessage
  index: number
  rawIndex: number
  preservedSegment: PreservedSegment | undefined
}

type AssistantUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

type AssistantTranscriptEntry = TranscriptMessage & {
  type: 'assistant'
  message: {
    usage?: Partial<AssistantUsage>
  }
}

const TOOL_USE_ID_KEYS = ['id', 'toolUseId', 'toolUseID', 'tool_use_id']
const TOOL_RESULT_SOURCE_ID_KEYS = [
  'tool_use_id',
  'toolUseId',
  'toolUseID',
  'toolCallId',
  'tool_call_id',
]

export async function materializeConversationFromTranscript(
  filePath: string,
): Promise<MaterializedConversation> {
  const loaded = await loadTranscriptFile(filePath, { keepAllLeaves: true })
  const transcriptView = await loadTranscriptMaterializationView(
    filePath,
    loaded.messages,
  )
  return materializeConversationFromLoadedTranscript(loaded, {
    orderedMessages: transcriptView.orderedMessages,
    malformedJsonlLines: transcriptView.malformedJsonlLines,
    displayReplayEvents: transcriptView.displayReplayEvents,
  })
}

function getOrderedTranscriptMessages(
  loaded: LoadedTranscript,
  options?: {
    orderedMessages?: OrderedTranscriptMessage[]
  },
): OrderedTranscriptMessage[] {
  if (options?.orderedMessages && options.orderedMessages.length > 0) {
    return options.orderedMessages
  }

  return Array.from(loaded.messages.values()).map((message, rawIndex) => ({
    rawIndex,
    message,
  }))
}

function addMalformedJsonlDiagnostics(
  malformedLines: TranscriptMalformedJsonlLine[] | undefined,
  diagnostics: ConversationMaterializationDiagnostic[],
): void {
  if (!malformedLines || malformedLines.length === 0) {
    return
  }

  diagnostics.push({
    level: 'warning',
    code: 'malformed_jsonl_lines_skipped',
    message: 'transcript 中存在无法解析的 JSONL 行，已跳过这些行。',
    details: {
      count: malformedLines.length,
      rawIndexes: malformedLines.slice(0, 20).map(line => line.rawIndex),
    },
  })
}

async function loadTranscriptMaterializationView(
  filePath: string,
  messages: Map<UUID, TranscriptMessage>,
): Promise<{
  orderedMessages: OrderedTranscriptMessage[]
  malformedJsonlLines: TranscriptMalformedJsonlLine[]
  displayReplayEvents: SerializedMessage[]
}> {
  const parsed = parseTranscriptJsonlWithRawIndex<Entry>(await readFile(filePath))
  const rawIndexByUuid = new Map<UUID, number>()
  const displayMessages: TranscriptMessage[] = []

  for (const { rawIndex, entry } of parsed.entries) {
    if (!isTranscriptMessage(entry)) {
      continue
    }

    const uuid = getMessageUuid(entry)
    if (uuid) {
      rawIndexByUuid.set(uuid, rawIndex)
    }

    if (isMainDisplayTranscriptMessage(entry)) {
      displayMessages.push(entry)
    }
  }

  return {
    orderedMessages: createOrderedTranscriptMessages(messages, rawIndexByUuid),
    malformedJsonlLines: parsed.malformedLines,
    displayReplayEvents: removeExtraFields(displayMessages),
  }
}

function parseTranscriptJsonlWithRawIndex<T>(buf: Buffer): {
  entries: ParsedTranscriptJsonlLine<T>[]
  malformedLines: TranscriptMalformedJsonlLine[]
} {
  const entries: ParsedTranscriptJsonlLine<T>[] = []
  const malformedLines: TranscriptMalformedJsonlLine[] = []
  const bufLen = buf.length
  let start = 0
  let rawIndex = 0

  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    start = 3
  }

  while (start < bufLen) {
    let end = buf.indexOf(0x0a, start)
    if (end === -1) end = bufLen

    const line = buf.toString('utf8', start, end).trim()
    start = end + 1
    if (!line) {
      rawIndex += 1
      continue
    }

    try {
      entries.push({ rawIndex, entry: JSON.parse(line) as T })
    } catch (error) {
      malformedLines.push({
        rawIndex,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    rawIndex += 1
  }

  return { entries, malformedLines }
}

function createOrderedTranscriptMessages(
  messages: Map<UUID, TranscriptMessage>,
  rawIndexByUuid: Map<UUID, number>,
): OrderedTranscriptMessage[] {
  return Array.from(messages.entries())
    .map(([uuid, message], fallbackIndex) => ({
      rawIndex: rawIndexByUuid.get(uuid) ?? fallbackIndex,
      message,
    }))
    .sort((left, right) => left.rawIndex - right.rawIndex)
}

export function materializeConversationFromLoadedTranscript(
  loaded: LoadedTranscript,
  options?: {
    displayReplayEvents?: SerializedMessage[]
    orderedMessages?: OrderedTranscriptMessage[]
    malformedJsonlLines?: TranscriptMalformedJsonlLine[]
  },
): MaterializedConversation {
  const diagnostics: ConversationMaterializationDiagnostic[] = []
  const orderedMessages = getOrderedTranscriptMessages(loaded, options)
  const displayReplayEvents =
    options?.displayReplayEvents ?? createDisplayReplayEvents(orderedMessages)
  const messages = new Map<UUID, TranscriptMessage>(
    orderedMessages
      .map(({ message }) => {
        const uuid = getMessageUuid(message)
        return uuid ? ([uuid, message] as const) : undefined
      })
      .filter(
        (
          value,
        ): value is readonly [UUID, TranscriptMessage] => value !== undefined,
      ),
  )
  const rawTranscriptEvents =
    displayReplayEvents.length > 0 ? displayReplayEvents.length : orderedMessages.length
  const classifiedTranscriptEvents =
    classifyTranscriptEvents(orderedMessages)
  addMalformedJsonlDiagnostics(
    options?.malformedJsonlLines,
    diagnostics,
  )
  addTranscriptClassificationDiagnostics(classifiedTranscriptEvents, diagnostics)

  applyCompactMaterialization(messages, orderedMessages, diagnostics)
  addLegacyLeafDiagnostics(messages, diagnostics)

  const currentContextTail = resolveCurrentContextTail(
    classifiedTranscriptEvents,
    messages,
    diagnostics,
  )
  if (!currentContextTail) {
    return {
      status: 'error',
      messages: [],
      currentContextMessages: [],
      displayReplayEvents,
      sessionId: undefined,
      currentContextTailUuid: undefined,
      currentContextTailEvent: undefined,
      canonicalLeafUuid: undefined,
      rawTranscriptEvents,
      materializedTranscriptEvents: messages.size,
      coreContextMessages: 0,
      classifiedTranscriptEvents,
      diagnostics,
      metadata: getMetadata(loaded),
    }
  }

  // Tail resolution already happened above from ordered materialized events.
  // buildConversationChain is only a temporary chain rebuild / parallel-tool
  // recovery helper here, not the source of current-tail product semantics.
  const chain = appendCurrentContextFollowers(
    buildConversationChain(messages, currentContextTail.entry),
    orderedMessages,
    messages,
    currentContextTail.event,
    diagnostics,
  )
  const currentContextMessages = removeExtraFields(chain)

  return {
    status: 'ok',
    messages: currentContextMessages,
    currentContextMessages,
    displayReplayEvents,
    sessionId: currentContextTail.entry.sessionId as UUID | undefined,
    currentContextTailUuid: currentContextTail.uuid,
    currentContextTailEvent: currentContextTail.event,
    canonicalLeafUuid: currentContextTail.uuid,
    rawTranscriptEvents,
    materializedTranscriptEvents: messages.size,
    coreContextMessages: currentContextMessages.length,
    classifiedTranscriptEvents,
    diagnostics,
    metadata: getMetadata(loaded),
  }
}

function createDisplayReplayEvents(
  orderedMessages: OrderedTranscriptMessage[],
): SerializedMessage[] {
  return removeExtraFields(
    orderedMessages
      .map(({ message }) => message)
      .filter(isMainDisplayTranscriptMessage),
  )
}

function appendCurrentContextFollowers(
  chain: TranscriptMessage[],
  orderedMessages: OrderedTranscriptMessage[],
  messages: Map<UUID, TranscriptMessage>,
  currentContextTailEvent: MaterializedTranscriptEvent,
  diagnostics: ConversationMaterializationDiagnostic[],
): TranscriptMessage[] {
  const existingUuids = new Set(
    chain
      .map(message => getMessageUuid(message))
      .filter((uuid): uuid is UUID => Boolean(uuid)),
  )
  const followers: TranscriptMessage[] = []

  for (
    let index = currentContextTailEvent.materializedIndex + 1;
    index < orderedMessages.length;
    index += 1
  ) {
    const ordered = orderedMessages[index]
    if (!ordered) continue
    const uuid = getMessageUuid(ordered.message)
    if (!uuid || existingUuids.has(uuid)) continue
    const materialized = messages.get(uuid)
    if (!materialized || !isCurrentContextFollowerMessage(materialized)) {
      continue
    }
    followers.push(materialized)
    existingUuids.add(uuid)
  }

  if (followers.length === 0) {
    return chain
  }

  diagnostics.push({
    level: 'info',
    code: 'current_context_followers_appended',
    message:
      '已保留当前上下文尾部之后的 compact 附属消息，避免恢复上下文短于实时上下文。',
    details: {
      tailUuid: currentContextTailEvent.uuid,
      followerUuids: followers
        .map(message => getMessageUuid(message))
        .filter((uuid): uuid is UUID => Boolean(uuid)),
    },
  })

  return [...chain, ...followers]
}

function isCurrentContextFollowerMessage(message: TranscriptMessage): boolean {
  if (message.isSidechain === true) return false
  return message.type === 'attachment' || message.type === 'system'
}

function isMainDisplayTranscriptMessage(
  entry: Entry,
): entry is TranscriptMessage {
  return isTranscriptMessage(entry) && entry.isSidechain !== true
}

function classifyTranscriptEvents(
  orderedMessages: OrderedTranscriptMessage[],
): MaterializedTranscriptEvent[] {
  const events: MaterializedTranscriptEvent[] = []

  for (const [materializedIndex, { rawIndex, message }] of orderedMessages.entries()) {
    const source = createTranscriptEventSource(message, {
      rawIndex,
      materializedIndex,
    })

    if (!source.uuid) {
      events.push({
        ...source,
        kind: 'diagnostic',
        advancesMainTail: false,
        skipReason: 'missing_uuid',
      })
      continue
    }

    if (message.isSidechain === true) {
      events.push({
        ...source,
        kind: 'sidechain',
        advancesMainTail: false,
        skipReason: 'sidechain',
      })
      continue
    }

    if (isCompactBoundaryMessage(message)) {
      events.push({
        ...source,
        kind: 'compact_boundary',
        advancesMainTail: false,
        skipReason: 'compact_boundary',
      })
      continue
    }

    if (message.type === 'assistant') {
      events.push({
        ...source,
        kind: 'assistant_response',
        advancesMainTail: true,
      })
      for (const [contentIndex, block] of getContentBlocks(message).entries()) {
        if (getContentBlockType(block) !== 'tool_use') continue
        events.push({
          ...source,
          kind: 'tool_use',
          contentIndex,
          toolUseId: normalizeToolUseIdFromBlock(block),
          advancesMainTail: false,
          skipReason: 'tool_use_block',
        })
      }
      continue
    }

    if (message.type === 'user') {
      if (hasUserInputContent(message)) {
        events.push({
          ...source,
          kind: 'user_input',
          advancesMainTail: true,
        })
      }

      for (const [contentIndex, block] of getContentBlocks(message).entries()) {
        if (getContentBlockType(block) !== 'tool_result') continue
        events.push({
          ...source,
          kind: 'tool_result',
          contentIndex,
          toolUseId: normalizeToolResultSourceIdFromBlock(block),
          advancesMainTail: false,
          skipReason: 'tool_result_block',
        })
      }

      if (!events.some(event => event.uuid === source.uuid)) {
        events.push({
          ...source,
          kind: 'diagnostic',
          advancesMainTail: false,
          skipReason: 'empty_user_message',
        })
      }
      continue
    }

    events.push({
      ...source,
      kind: 'system_event',
      advancesMainTail: false,
      skipReason: 'non_conversation_transcript_event',
    })
  }

  return events
}

function createTranscriptEventSource(
  message: TranscriptMessage,
  source: { rawIndex: number; materializedIndex: number },
): Omit<MaterializedTranscriptEvent, 'kind' | 'advancesMainTail'> {
  return {
    rawIndex: source.rawIndex,
    materializedIndex: source.materializedIndex,
    uuid: getMessageUuid(message),
    parentUuid: getNullableUuidFromUnknown(message.parentUuid),
    logicalParentUuid: getNullableUuidFromUnknown(message.logicalParentUuid),
    sourceToolAssistantUUID: getUuidFromUnknown(
      (message as { sourceToolAssistantUUID?: unknown }).sourceToolAssistantUUID,
    ),
    sessionId: getUuidFromUnknown(message.sessionId),
    transcriptType: message.type,
    isSidechain: message.isSidechain === true,
  }
}

function addTranscriptClassificationDiagnostics(
  events: MaterializedTranscriptEvent[],
  diagnostics: ConversationMaterializationDiagnostic[],
): void {
  if (events.length === 0) return

  const counts = events.reduce<Record<MaterializedTranscriptEventKind, number>>(
    (result, event) => {
      result[event.kind] += 1
      return result
    },
    {
      user_input: 0,
      assistant_response: 0,
      tool_use: 0,
      tool_result: 0,
      compact_boundary: 0,
      sidechain: 0,
      system_event: 0,
      diagnostic: 0,
    },
  )

  diagnostics.push({
    level: 'info',
    code: 'transcript_events_classified',
    message: '已按 transcript 物理顺序生成分类事件。',
    details: {
      count: events.length,
      counts,
      sample: events.slice(0, 20).map(toClassificationDiagnosticSample),
    },
  })
}

function resolveCurrentContextTail(
  events: MaterializedTranscriptEvent[],
  messages: Map<UUID, TranscriptMessage>,
  diagnostics: ConversationMaterializationDiagnostic[],
): { uuid: UUID; entry: TranscriptMessage; event: MaterializedTranscriptEvent } | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event || !event.advancesMainTail || !event.uuid) continue
    const entry = messages.get(event.uuid)
    if (!entry) continue

    diagnostics.push({
      level: 'info',
      code: 'current_context_tail_resolved',
      message: '已从分类事件解析当前上下文尾部。',
      details: {
        currentContextTailUuid: event.uuid,
        kind: event.kind,
        rawIndex: event.rawIndex,
        materializedIndex: event.materializedIndex,
      },
    })
    return { uuid: event.uuid, entry, event }
  }

  diagnostics.push({
    level: 'error',
    code: 'no_current_context_tail',
    message: '物化后没有找到可推进当前上下文的用户输入或助手回复。',
    details: {
      classifiedEvents: events.length,
      materializedMessages: messages.size,
    },
  })
  return undefined
}

function toClassificationDiagnosticSample(
  event: MaterializedTranscriptEvent,
): Record<string, unknown> {
  return {
    kind: event.kind,
    rawIndex: event.rawIndex,
    materializedIndex: event.materializedIndex,
    uuid: event.uuid,
    parentUuid: event.parentUuid,
    sourceToolAssistantUUID: event.sourceToolAssistantUUID,
    contentIndex: event.contentIndex,
    toolUseId: event.toolUseId,
    advancesMainTail: event.advancesMainTail,
    skipReason: event.skipReason,
  }
}

function hasUserInputContent(entry: TranscriptMessage): boolean {
  const content = getMessageContent(entry)
  if (typeof content === 'string') return content.length > 0
  const blocks = getContentBlocks(entry)
  if (blocks.length === 0) return false
  return blocks.some(block => getContentBlockType(block) !== 'tool_result')
}

function getContentBlocks(entry: TranscriptMessage): Record<string, unknown>[] {
  const content = getMessageContent(entry)
  if (!Array.isArray(content)) return []
  return content.filter(isRecord)
}

function getMessageContent(entry: TranscriptMessage): unknown {
  return (entry as { message?: { content?: unknown } }).message?.content
}

function getContentBlockType(block: Record<string, unknown>): string | undefined {
  return typeof block.type === 'string' ? block.type : undefined
}

function normalizeToolUseIdFromBlock(
  block: Record<string, unknown>,
): string | undefined {
  return getStringField(block, TOOL_USE_ID_KEYS)
}

function normalizeToolResultSourceIdFromBlock(
  block: Record<string, unknown>,
): string | undefined {
  return getStringField(block, TOOL_RESULT_SOURCE_ID_KEYS)
}

function getStringField(
  block: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = block[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function applyCompactMaterialization(
  messages: Map<UUID, TranscriptMessage>,
  orderedMessages: OrderedTranscriptMessage[],
  diagnostics: ConversationMaterializationDiagnostic[],
): void {
  const boundaries = findCompactBoundaries(orderedMessages)
  const absoluteLastBoundary = boundaries.at(-1)
  if (!absoluteLastBoundary) return

  const lastSegmentBoundary = findLastBoundaryWithPreservedSegment(boundaries)
  if (!lastSegmentBoundary) {
    pruneBeforeBoundary(
      messages,
      orderedMessages,
      absoluteLastBoundary.index,
      new Set(),
    )
    diagnostics.push({
      level: 'info',
      code: 'compact_boundary_pruned_without_preserved_segment',
      message:
        '已按最后一个 compact boundary 裁掉边界前的旧上下文。',
      details: {
        boundaryUuid: absoluteLastBoundary.uuid,
        boundaryRawIndex: absoluteLastBoundary.rawIndex,
      },
    })
    return
  }

  const segmentIsLive = lastSegmentBoundary.index === absoluteLastBoundary.index
  if (!segmentIsLive) {
    pruneBeforeBoundary(
      messages,
      orderedMessages,
      absoluteLastBoundary.index,
      new Set(),
    )
    diagnostics.push({
      level: 'warning',
      code: 'compact_preserved_segment_stale',
      message:
        '最后一个 preservedSegment 已过期，已按最新 compact boundary 裁掉旧上下文。',
      details: {
        segmentBoundaryUuid: lastSegmentBoundary.uuid,
        segmentBoundaryRawIndex: lastSegmentBoundary.rawIndex,
        absoluteBoundaryUuid: absoluteLastBoundary.uuid,
        absoluteBoundaryRawIndex: absoluteLastBoundary.rawIndex,
      },
    })
    return
  }

  const segment = lastSegmentBoundary.preservedSegment
  if (!segment) return

  const preserved = collectPreservedSegment(messages, segment)
  if (!preserved.reachedHead) {
    pruneBeforeBoundary(
      messages,
      orderedMessages,
      absoluteLastBoundary.index,
      new Set(),
    )
    diagnostics.push({
      level: 'error',
      code: 'compact_preserved_segment_malformed',
      message:
        'compact preservedSegment 不完整，已阻止旧上下文回流。',
      details: {
        boundaryUuid: absoluteLastBoundary.uuid,
        boundaryRawIndex: absoluteLastBoundary.rawIndex,
        headUuid: segment.headUuid,
        tailUuid: segment.tailUuid,
        anchorUuid: segment.anchorUuid,
        tailInTranscript: messages.has(segment.tailUuid),
        headInTranscript: messages.has(segment.headUuid),
        anchorInTranscript: messages.has(segment.anchorUuid),
        walkSteps: preserved.uuids.size,
      },
    })
    return
  }

  relinkPreservedSegment(messages, segment, preserved.uuids)
  pruneBeforeBoundary(
    messages,
    orderedMessages,
    absoluteLastBoundary.index,
    preserved.uuids,
  )
}

function findCompactBoundaries(
  orderedMessages: OrderedTranscriptMessage[],
): CompactBoundaryInfo[] {
  const boundaries: CompactBoundaryInfo[] = []
  for (const [index, { rawIndex, message: entry }] of orderedMessages.entries()) {
    const uuid = getMessageUuid(entry)
    if (uuid && isCompactBoundaryMessage(entry)) {
      boundaries.push({
        uuid,
        entry,
        index,
        rawIndex,
        preservedSegment: getCompactPreservedSegment(entry),
      })
    }
  }
  return boundaries
}

function findLastBoundaryWithPreservedSegment(
  boundaries: CompactBoundaryInfo[],
): CompactBoundaryInfo | undefined {
  for (let i = boundaries.length - 1; i >= 0; i -= 1) {
    if (boundaries[i]?.preservedSegment) return boundaries[i]
  }
  return undefined
}

function collectPreservedSegment(
  messages: Map<UUID, TranscriptMessage>,
  segment: PreservedSegment,
): { reachedHead: boolean; uuids: Set<UUID> } {
  const uuids = new Set<UUID>()
  const seen = new Set<UUID>()
  let current = messages.get(segment.tailUuid)
  while (current) {
    const currentUuid = getMessageUuid(current)
    if (!currentUuid || seen.has(currentUuid)) break
    seen.add(currentUuid)
    uuids.add(currentUuid)
    if (currentUuid === segment.headUuid) {
      return { reachedHead: true, uuids }
    }
    current = current.parentUuid ? messages.get(current.parentUuid) : undefined
  }
  return { reachedHead: false, uuids }
}

function relinkPreservedSegment(
  messages: Map<UUID, TranscriptMessage>,
  segment: PreservedSegment,
  preservedUuids: Set<UUID>,
): void {
  const head = messages.get(segment.headUuid)
  if (head) {
    messages.set(segment.headUuid, {
      ...head,
      parentUuid: segment.anchorUuid,
    })
  }

  for (const [uuid, msg] of messages) {
    if (msg.parentUuid === segment.anchorUuid && uuid !== segment.headUuid) {
      messages.set(uuid, { ...msg, parentUuid: segment.tailUuid })
    }
  }

  for (const uuid of preservedUuids) {
    const msg = messages.get(uuid)
    if (!msg || msg.type !== 'assistant') continue
    const usage = getAssistantUsage(msg)
    if (!usage) continue
    messages.set(uuid, {
      ...msg,
      message: {
        ...msg.message,
        usage: {
          ...usage,
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    })
  }
}

function pruneBeforeBoundary(
  messages: Map<UUID, TranscriptMessage>,
  orderedMessages: OrderedTranscriptMessage[],
  boundaryIndex: number,
  preservedUuids: Set<UUID>,
): void {
  const toDelete: UUID[] = []
  for (const [index, { message }] of orderedMessages.entries()) {
    const uuid = getMessageUuid(message)
    if (!uuid || !messages.has(uuid)) continue
    if (index < boundaryIndex && !preservedUuids.has(uuid)) {
      toDelete.push(uuid)
    }
  }
  for (const uuid of toDelete) messages.delete(uuid)
}

function addLegacyLeafDiagnostics(
  messages: Map<UUID, TranscriptMessage>,
  diagnostics: ConversationMaterializationDiagnostic[],
): void {
  const leaves = collectLegacyLeafCandidates(messages)
  if (leaves.length <= 1) return

  diagnostics.push({
    level: 'warning',
    code: 'legacy_multiple_main_leaves_diagnostic',
    message:
      '旧 parent leaf 诊断发现多个候选；正常恢复已改用分类事件尾部，不再按最长链兜底。',
    details: {
      leafUuids: leaves.map(leaf => leaf.uuid),
    },
  })
}

function collectLegacyLeafCandidates(
  messages: Map<UUID, TranscriptMessage>,
): { uuid: UUID; entry: TranscriptMessage }[] {
  const mainParentUuids = new Set<UUID>()
  const mainConversationChildUuids = new Set<UUID>()
  for (const entry of messages.values()) {
    if (entry.isSidechain || !entry.parentUuid) continue
    mainParentUuids.add(entry.parentUuid)
    if (isConversationMessage(entry)) {
      mainConversationChildUuids.add(entry.parentUuid)
    }
  }

  const leavesByUuid = new Map<UUID, { uuid: UUID; entry: TranscriptMessage }>()
  for (const [uuid, entry] of messages) {
    if (entry.isSidechain || mainParentUuids.has(uuid)) continue
    const leaf = findNearestMainConversationAncestor(
      messages,
      entry,
      mainConversationChildUuids,
    )
    if (leaf) leavesByUuid.set(leaf.uuid, leaf)
  }

  return [...leavesByUuid.values()]
}

function findNearestMainConversationAncestor(
  messages: Map<UUID, TranscriptMessage>,
  terminal: TranscriptMessage,
  mainConversationChildUuids: Set<UUID>,
): { uuid: UUID; entry: TranscriptMessage } | undefined {
  const seen = new Set<UUID>()
  let current: TranscriptMessage | undefined = terminal
  while (current) {
    const currentUuid = getMessageUuid(current)
    if (!currentUuid || seen.has(currentUuid)) return undefined
    seen.add(currentUuid)
    if (!current.isSidechain && isConversationMessage(current)) {
      return mainConversationChildUuids.has(currentUuid)
        ? undefined
        : { uuid: currentUuid, entry: current }
    }
    current =
      !current.isSidechain && current.parentUuid
        ? messages.get(current.parentUuid)
        : undefined
  }
  return undefined
}

function isConversationMessage(entry: TranscriptMessage): boolean {
  return entry.type === 'user' || entry.type === 'assistant'
}

function getCompactPreservedSegment(
  entry: TranscriptMessage,
): PreservedSegment | undefined {
  const metadata = (entry as {
    compactMetadata?: { preservedSegment?: unknown }
  }).compactMetadata
  const segment = metadata?.preservedSegment
  if (!segment || typeof segment !== 'object') return undefined

  const headUuid = getUuidFromUnknown((segment as { headUuid?: unknown }).headUuid)
  const tailUuid = getUuidFromUnknown((segment as { tailUuid?: unknown }).tailUuid)
  const anchorUuid = getUuidFromUnknown(
    (segment as { anchorUuid?: unknown }).anchorUuid,
  )
  if (!headUuid || !tailUuid || !anchorUuid) return undefined

  return { headUuid, tailUuid, anchorUuid }
}

function getMessageUuid(entry: TranscriptMessage): UUID | undefined {
  return getUuidFromUnknown(entry.uuid)
}

function getUuidFromUnknown(value: unknown): UUID | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  return value as UUID
}

function getNullableUuidFromUnknown(value: unknown): UUID | null | undefined {
  if (value === null) return null
  return getUuidFromUnknown(value)
}

function getAssistantUsage(
  entry: TranscriptMessage,
): Partial<AssistantUsage> | undefined {
  const candidate = entry as AssistantTranscriptEntry
  const usage = candidate.message?.usage
  if (!usage || typeof usage !== 'object') return undefined
  return usage
}

function getMetadata(
  loaded: LoadedTranscript,
): MaterializedConversationMetadata {
  const {
    messages: _messages,
    leafUuids: _leafUuids,
    ...metadata
  } = loaded
  void _messages
  void _leafUuids
  return metadata
}
