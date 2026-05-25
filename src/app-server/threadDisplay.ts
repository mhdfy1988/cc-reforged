import type { CoreJsonObject, CoreTurnEvent } from '../core/types.js'
import { projectThreadDisplayItem } from '../display/threadDisplayProjection.js'
import { assertThreadDisplayProjection } from '../display/threadDisplayProjectionSchema.js'
import type {
  AppServerThreadMessage,
  ThreadDisplayDiagnostic,
  ThreadDisplayItem,
  ThreadDisplayItemType,
  ThreadDisplayPatch,
  ThreadDisplayPatchOperation,
  ThreadDisplaySnapshot,
} from './protocol.js'
import {
  createToolDisplayLifecycleReducer,
  normalizeToolUseIdFromBlock,
  normalizeToolResultSourceIdFromBlock,
  type ToolDisplayLifecycleItem,
} from './toolDisplayLifecycle.js'

export type BuildThreadDisplaySnapshotInput = {
  threadId: string
  sessionId?: string
  source: ThreadDisplaySnapshot['source']
  messages: AppServerThreadMessage[]
  rawTranscriptEvents?: number
  coreContextMessages?: number
  canonicalLeafUuid?: string
  diagnostics?: ThreadDisplayDiagnostic[]
}

const activeContextCompactionItemIds = new Map<string, string>()
const liveToolLifecycles = new Map<
  string,
  ReturnType<typeof createToolDisplayLifecycleReducer>
>()

export function buildThreadDisplaySnapshot(
  input: BuildThreadDisplaySnapshotInput,
): ThreadDisplaySnapshot {
  const items = threadMessagesToDisplayItems(input.messages, {
      threadId: input.threadId,
      sessionId: input.sessionId,
  })
  const projectedDisplayItems = items.length
  const visibleTimelineItems = countVisibleThreadDisplayItems(items)
  const hiddenDisplayItems = Math.max(
    0,
    projectedDisplayItems - visibleTimelineItems,
  )
  const rawTranscriptEvents = input.rawTranscriptEvents ?? input.messages.length
  const filteredTranscriptEvents = Math.max(
    0,
    rawTranscriptEvents - projectedDisplayItems,
  )

  return {
    threadId: input.threadId,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    source: input.source,
    generatedAt: new Date().toISOString(),
    ...(input.canonicalLeafUuid
      ? { canonicalLeafUuid: input.canonicalLeafUuid }
      : {}),
    items,
    counts: {
      rawTranscriptEvents,
      coreContextMessages: input.coreContextMessages ?? input.messages.length,
      projectedDisplayItems,
      visibleTimelineItems,
      hiddenDisplayItems,
      filteredTranscriptEvents,
      hiddenTimelineItems: hiddenDisplayItems + filteredTranscriptEvents,
    },
    ...(input.diagnostics?.length ? { diagnostics: input.diagnostics } : {}),
  }
}

function threadMessagesToDisplayItems(
  messages: AppServerThreadMessage[],
  context: {
    threadId: string
    sessionId?: string
  },
): ThreadDisplayItem[] {
  const items: ThreadDisplayItem[] = []
  const lifecycle = createToolDisplayLifecycleReducer()
  const toolItemIndexes = new Map<string, number>()

  for (const [sourceIndex, message] of messages.entries()) {
    const blocks = getMessageJsonBlocks(message)
    if (!blocks.some(isToolLifecycleBlock)) {
      items.push(
        threadMessageToDisplayItem(message, {
          ...context,
          sourceIndex,
        }),
      )
      continue
    }

    let pendingBlocks: CoreJsonObject[] = []
    let pendingStartIndex: number | undefined
    const flushPendingBlocks = (): void => {
      if (pendingBlocks.length === 0) return
      items.push(
        threadMessageToDisplayItem(
          {
            ...message,
            id:
              pendingStartIndex === undefined
                ? message.id
                : `${message.id}:content:${pendingStartIndex}`,
            content: pendingBlocks,
            text: extractDisplayText(pendingBlocks),
          },
          {
            ...context,
            sourceIndex,
            contentIndex: pendingStartIndex,
          },
        ),
      )
      pendingBlocks = []
      pendingStartIndex = undefined
    }

    for (const [contentIndex, block] of blocks.entries()) {
      const blockType = getContentBlockType(block)
      if (blockType !== 'tool_use' && blockType !== 'tool_result') {
        pendingStartIndex ??= contentIndex
        pendingBlocks.push(block)
        continue
      }

      flushPendingBlocks()
      const source = {
        threadId: context.threadId,
        ...(context.sessionId ? { sessionId: context.sessionId } : {}),
        messageUuid: message.id,
        rawIndex: sourceIndex,
        materializedIndex: sourceIndex,
        contentIndex,
        ...(message.createdAt ? { createdAt: message.createdAt } : {}),
      }

      if (blockType === 'tool_use') {
        const state = lifecycle.accept({ kind: 'tool_use', block, source })
        const item = createToolLifecycleDisplayItem(message, state, sourceIndex)
        const itemIndex = items.length
        items.push(item)
        if (state.toolUseId) {
          toolItemIndexes.set(state.toolUseId, itemIndex)
        }
        continue
      }

      const state = lifecycle.accept({ kind: 'tool_result', block, source })
      const sourceToolUseId = normalizeToolResultSourceIdFromBlock(block)
      const existingItemIndex = sourceToolUseId
        ? toolItemIndexes.get(sourceToolUseId)
        : undefined
      if (existingItemIndex !== undefined) {
        items[existingItemIndex] = createToolLifecycleDisplayItem(
          message,
          state,
          sourceIndex,
          items[existingItemIndex],
        )
      } else {
        items.push(createToolLifecycleDisplayItem(message, state, sourceIndex))
      }
    }

    flushPendingBlocks()
  }

  return items
}

function createToolLifecycleDisplayItem(
  message: AppServerThreadMessage,
  state: ToolDisplayLifecycleItem,
  fallbackSourceIndex?: number,
  existingItem?: ThreadDisplayItem,
  extraMetadata?: Record<string, unknown>,
): ThreadDisplayItem {
  const isDiagnostic = Boolean(state.diagnostic)
  const primaryBlock = state.callBlock ?? state.resultBlock
  const content = isDiagnostic
    ? [{ type: 'text', text: state.diagnostic?.message ?? '工具结果诊断。' }]
    : createToolLifecycleItemContent(state)
  const sourceIndex = state.firstSeen.rawIndex ?? fallbackSourceIndex
  const contentIndex = state.firstSeen.contentIndex
  const itemId = existingItem?.id ?? state.itemId
  const startedAt =
    state.firstSeen.createdAt ?? existingItem?.createdAt ?? message.createdAt
  const lifecycleMetadata = createToolLifecycleTimingMetadata(
    state,
    startedAt,
    extraMetadata,
  )

  return withThreadDisplayProjection({
    ...(existingItem ?? {}),
    id: itemId,
    type: isDiagnostic
      ? 'error'
      : getSpecificThreadDisplayItemTypeFromUnknownContent(content) ??
        'tool_call',
    text: state.diagnostic?.message ?? extractDisplayText(content),
    status: state.status,
    sourceKind: state.diagnostic ? 'tool_result_diagnostic' : 'tool_lifecycle',
    ...(startedAt ? { createdAt: startedAt } : {}),
    identity: {
      ...(existingItem?.identity ?? {}),
      threadId: state.firstSeen.threadId,
      ...(state.firstSeen.sessionId
        ? { sessionId: state.firstSeen.sessionId }
        : {}),
      ...(state.firstSeen.turnId ? { turnId: state.firstSeen.turnId } : {}),
      itemId,
      messageUuid: state.firstSeen.messageUuid ?? message.id,
      ...(state.firstSeen.parentUuid !== undefined
        ? { parentUuid: state.firstSeen.parentUuid }
        : {}),
      ...(state.toolUseId ? { toolUseId: state.toolUseId } : {}),
      ...(sourceIndex !== undefined
        ? {
            sourceIndex,
            rawIndex: sourceIndex,
          }
        : {}),
      ...(state.firstSeen.materializedIndex !== undefined ||
      sourceIndex !== undefined
        ? {
            materializedIndex:
              state.firstSeen.materializedIndex ?? sourceIndex,
          }
        : {}),
      ...(contentIndex !== undefined ? { contentIndex } : {}),
    },
    content,
    metadata: {
      ...(existingItem?.metadata ?? {}),
      role: message.role,
      sourceType: message.sourceType,
      ...lifecycleMetadata,
      toolLifecycle: state,
      ...(!isDiagnostic && primaryBlock ? { primaryBlock } : {}),
    },
  })
}

function createToolLifecycleTimingMetadata(
  state: ToolDisplayLifecycleItem,
  startedAt: string | undefined,
  extraMetadata?: Record<string, unknown>,
): Record<string, unknown> {
  const metadata = { ...(extraMetadata ?? {}) }
  const completedAt = getStringValue(extraMetadata, ['completedAt', 'completed_at'])
  const durationMs =
    startedAt && completedAt
      ? undefined
      : getNumberValue(extraMetadata, [
          'durationMs',
          'duration_ms',
          'elapsedTimeMs',
          'elapsed_ms',
        ])
  if (startedAt && completedAt) {
    delete metadata.durationMs
    delete metadata.duration_ms
    delete metadata.elapsedTimeMs
    delete metadata.elapsed_ms
  }

  return {
    ...metadata,
    ...(startedAt ? { startedAt } : {}),
    ...(state.lastSeen.createdAt ? { lastSeenAt: state.lastSeen.createdAt } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  }
}

function createToolLifecycleItemContent(
  state: ToolDisplayLifecycleItem,
): CoreJsonObject[] {
  if (state.callBlock) {
    const completedAt = getStringValue(state.resultBlock, [
      'completedAt',
      'completed_at',
      'endedAt',
      'ended_at',
      'endTime',
      'end_time',
    ])
    const durationMs = getNumberValue(state.resultBlock, [
      'durationMs',
      'duration_ms',
      'elapsedTimeMs',
      'elapsed_ms',
    ])
    return [
      {
        ...state.callBlock,
        historyStatus: state.status,
        status: state.status,
        ...(state.resultBlock
          ? { result: createToolUseDisplayResult(state.resultBlock) }
          : {}),
        ...(completedAt ? { completedAt } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
      },
    ]
  }
  return state.resultBlock ? [state.resultBlock] : []
}

function createToolUseDisplayResult(resultBlock: CoreJsonObject): unknown {
  const displayOutput = getGeneratedOutputBlocksFromToolResult(resultBlock)
  if (displayOutput.length === 0) {
    return resultBlock.content
  }

  const content = resultBlock.content
  if (Array.isArray(content)) {
    return appendMissingGeneratedOutputBlocks(content, displayOutput)
  }

  if (typeof content === 'string' && content.trim()) {
    return [{ type: 'text', text: content }, ...displayOutput]
  }

  return displayOutput
}

function getGeneratedOutputBlocksFromToolResult(
  resultBlock: CoreJsonObject,
): CoreJsonObject[] {
  const result = isCoreJsonObject(resultBlock.result) ? resultBlock.result : undefined
  const output = Array.isArray(result?.output) ? result.output : []
  return output.filter(
    (block): block is CoreJsonObject =>
      isCoreJsonObject(block) && isGeneratedAttachmentBlock(block),
  )
}

function appendMissingGeneratedOutputBlocks(
  content: readonly unknown[],
  output: readonly CoreJsonObject[],
): unknown[] {
  const existingIds = new Set(
    content
      .filter(isCoreJsonObject)
      .map(getGeneratedOutputBlockKey)
      .filter((key): key is string => Boolean(key)),
  )
  const missingOutput = output.filter(block => {
    const key = getGeneratedOutputBlockKey(block)
    return !key || !existingIds.has(key)
  })
  return missingOutput.length > 0 ? [...content, ...missingOutput] : [...content]
}

function isGeneratedAttachmentBlock(block: CoreJsonObject): boolean {
  return (
    block.type === 'image' ||
    block.type === 'file' ||
    block.type === 'audio' ||
    block.type === 'video'
  )
}

function getGeneratedOutputBlockKey(block: CoreJsonObject): string | undefined {
  return getStringValue(block, ['outputId', 'attachmentId', 'savedPath'])
}

function getMessageJsonBlocks(message: AppServerThreadMessage): CoreJsonObject[] {
  if (!Array.isArray(message.content)) {
    return []
  }
  return message.content.filter(isCoreJsonObject)
}

function isToolLifecycleBlock(block: CoreJsonObject): boolean {
  const type = getContentBlockType(block)
  return type === 'tool_use' || type === 'tool_result'
}

function getContentBlockType(block: CoreJsonObject): string {
  return typeof block.type === 'string' ? block.type : ''
}

function countVisibleThreadDisplayItems(items: ThreadDisplayItem[]): number {
  return items.filter(item => item.timelineHidden !== true).length
}

function threadMessageToDisplayItem(
  message: AppServerThreadMessage,
  context: {
    threadId: string
    sessionId?: string
    sourceIndex: number
    contentIndex?: number
  },
): ThreadDisplayItem {
  return withThreadDisplayProjection({
    id: message.id,
    type: getThreadDisplayItemType(message),
    text: message.text,
    ...(message.status ? { status: message.status } : {}),
    ...(message.kind ? { sourceKind: message.kind } : {}),
    ...(message.createdAt ? { createdAt: message.createdAt } : {}),
    identity: {
      threadId: context.threadId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      itemId: message.id,
      messageUuid: message.id,
      sourceIndex: context.sourceIndex,
      rawIndex: context.sourceIndex,
      materializedIndex: context.sourceIndex,
      ...(context.contentIndex !== undefined
        ? { contentIndex: context.contentIndex }
        : {}),
    },
    ...(message.content !== undefined ? { content: message.content } : {}),
    metadata: {
      role: message.role,
      ...(message.sourceType ? { sourceType: message.sourceType } : {}),
    },
  })
}

function getThreadDisplayItemType(
  message: AppServerThreadMessage,
): ThreadDisplayItemType {
  const contentType = getSpecificThreadDisplayItemTypeFromUnknownContent(
    message.content,
  )
  if (contentType) {
    return contentType
  }
  if (message.role === 'user') {
    return 'user_message'
  }
  if (message.role === 'assistant') {
    return 'assistant_message'
  }
  if (message.role === 'error') {
    return 'error'
  }
  if (message.kind === 'thinking-event') {
    return 'thinking_summary'
  }
  if (message.kind === 'tool-event') {
    return 'tool_result'
  }
  return 'system_notice'
}

function getSpecificThreadDisplayItemTypeFromUnknownContent(
  content: unknown,
): ThreadDisplayItemType | undefined {
  if (!Array.isArray(content)) {
    return undefined
  }
  const blocks = content.filter(isCoreJsonObject)
  const type = getThreadDisplayItemTypeFromContent(blocks)
  return type === 'assistant_message' ? undefined : type
}

export function coreEventToThreadDisplayPatch(
  event: CoreTurnEvent,
): ThreadDisplayPatch | null {
  const threadId = getCoreEventThreadId(event)
  if (!threadId) {
    return null
  }

  const operations = getCoreEventDisplayPatchOperations(event)
  if (operations.length === 0) {
    return null
  }

  return {
    threadId,
    generatedAt: new Date().toISOString(),
    operations,
  }
}

function getCoreEventDisplayPatchOperations(
  event: CoreTurnEvent,
): ThreadDisplayPatchOperation[] {
  switch (event.type) {
    case 'item_started':
      {
        const toolOperations = getItemStartedToolLifecyclePatchOperations(event)
        if (toolOperations) {
          return toolOperations
        }
        const item = coreItemToThreadDisplayItem(event.item)
        return item.projection
          ? [
              {
                op: 'append_item',
                item,
              },
            ]
          : []
      }

    case 'item_delta':
      return [
        {
          op: 'update_item',
          itemId: event.itemId,
          item: {
            type: getThreadDisplayItemTypeFromDelta(event.delta),
            status: 'streaming',
            text: getCoreDeltaDisplayText(event.delta),
            metadata: {
              coreEventType: event.type,
              deltaMode: 'append_text',
              delta: event.delta,
            },
          },
        },
      ]

    case 'item_completed':
      {
        const toolOperations = getItemCompletedToolLifecyclePatchOperations(event)
        if (toolOperations) {
          return toolOperations
        }
        const item = completedCoreItemToThreadDisplayItem(event)
        return item?.projection
          ? [
              {
                op: 'complete_item',
                itemId: event.itemId,
                status: event.status,
                item,
              },
            ]
          : []
      }

    case 'turn_failed':
      {
        const operations: ThreadDisplayPatchOperation[] = [
          {
            op: 'append_item',
            item: withThreadDisplayProjection({
              id: `${event.turnId}:error`,
              type: 'error',
              text: extractDisplayText(event.error) || '当前 turn 失败。',
              status: 'failed',
              identity: {
                threadId: event.threadId,
                turnId: event.turnId,
                itemId: `${event.turnId}:error`,
              },
              content: event.error,
              metadata: {
                coreEventType: event.type,
                ...(event.metadata ?? {}),
              },
            }),
          },
        ]
        clearLiveToolLifecycle(event.threadId, event.turnId)
        return operations
      }

    case 'context_compaction_started':
      return [
        {
          op: 'append_item',
          item: createContextCompactionStartedItem(event),
        },
      ]

    case 'context_compacted':
      {
        const itemId = getContextCompactedDisplayItemId(event)
        return [
          {
            op: 'complete_item',
            itemId,
            status: 'completed',
            item: createContextCompactedItem(event, itemId),
          },
        ]
      }

    case 'permission_requested':
      return [
        {
          op: 'append_item',
          item: withThreadDisplayProjection({
            id: event.request.permissionRequestId,
            type: 'permission_request',
            text: `权限请求：${event.request.tool.displayName ?? event.request.tool.name}`,
            status: 'pending',
            createdAt: event.request.createdAt,
            identity: {
              threadId: event.request.threadId,
              turnId: event.request.turnId,
              itemId: event.request.permissionRequestId,
              toolUseId: event.request.toolUseId,
            },
            content: event.request,
            metadata: {
              coreEventType: event.type,
            },
          }),
        },
      ]

    case 'permission_cancelled':
      return [
        {
          op: 'update_item',
          itemId: event.permissionRequestId,
          item: {
            status: 'cancelled',
            metadata: {
              coreEventType: event.type,
              reason: event.reason,
            },
          },
        },
      ]

    case 'thread_started':
      clearLiveToolLifecyclesForThread(event.thread.threadId)
      return []
    case 'turn_started':
    case 'turn_completed':
      clearLiveToolLifecycle(event.threadId, event.turnId)
      return []
    case 'turn_cancelled':
      clearLiveToolLifecycle(event.threadId, event.turnId)
      return []
  }
}

function getItemStartedToolLifecyclePatchOperations(
  event: Extract<CoreTurnEvent, { type: 'item_started' }>,
): ThreadDisplayPatchOperation[] | null {
  const blocks = getCoreJsonBlocksFromUnknownContent(event.item.content)
  if (!blocks.some(isToolLifecycleBlock)) {
    return null
  }

  const lifecycle = getLiveToolLifecycle(event.item.threadId, event.item.turnId)
  const message = coreItemToThreadMessage(event.item, blocks)
  const operations: ThreadDisplayPatchOperation[] = []

  for (const [contentIndex, block] of blocks.entries()) {
    if (getContentBlockType(block) !== 'tool_use') {
      continue
    }

    const toolUseId = normalizeToolUseIdFromBlock(block)
    const existing = toolUseId ? lifecycle.hasToolUseId(toolUseId) : false
    const state = lifecycle.accept({
      kind: 'tool_use',
      block,
      source: createLiveToolLifecycleSource(event.item, contentIndex),
    })
    const item = createToolLifecycleDisplayItem(
      message,
      state,
      undefined,
      undefined,
      {
        coreEventType: event.type,
      },
    )
    operations.push(
      existing
        ? {
            op: 'update_item',
            itemId: item.id,
            item,
          }
        : {
            op: 'append_item',
            item,
          },
    )
  }

  return operations
}

function getItemCompletedToolLifecyclePatchOperations(
  event: Extract<CoreTurnEvent, { type: 'item_completed' }>,
): ThreadDisplayPatchOperation[] | null {
  const blocks = getCoreJsonBlocksFromUnknownContent(event.content)
  if (!blocks.some(isToolLifecycleBlock)) {
    return null
  }

  const lifecycle = getLiveToolLifecycle(event.threadId, event.turnId)
  const message = coreCompletedItemToThreadMessage(event, blocks)
  const operations: ThreadDisplayPatchOperation[] = []

  for (const [contentIndex, block] of blocks.entries()) {
    const blockType = getContentBlockType(block)
    if (blockType === 'tool_use') {
      const toolUseId = normalizeToolUseIdFromBlock(block)
      if (toolUseId && lifecycle.hasToolUseId(toolUseId)) {
        continue
      }
      const state = lifecycle.accept({
        kind: 'tool_use',
        block,
        source: createLiveToolLifecycleSource(event, contentIndex),
      })
      operations.push({
        op: 'append_item',
        item: createToolLifecycleDisplayItem(
          message,
          state,
          undefined,
          undefined,
          getItemCompletedMetadata(event),
        ),
      })
      continue
    }

    if (blockType !== 'tool_result') {
      continue
    }

    const state = lifecycle.accept({
      kind: 'tool_result',
      block,
      source: createLiveToolLifecycleSource(event, contentIndex),
    })
    const item = createToolLifecycleDisplayItem(
      message,
      state,
      undefined,
      undefined,
      getItemCompletedMetadata(event),
    )
    operations.push(
      state.diagnostic
        ? {
            op: 'append_item',
            item,
          }
        : {
            op: 'complete_item',
            itemId: item.id,
            status: state.status,
            item,
          },
    )
  }

  return operations
}

function getLiveToolLifecycle(
  threadId: string,
  turnId: string,
): ReturnType<typeof createToolDisplayLifecycleReducer> {
  const key = getLiveToolLifecycleKey(threadId, turnId)
  let lifecycle = liveToolLifecycles.get(key)
  if (!lifecycle) {
    lifecycle = createToolDisplayLifecycleReducer()
    liveToolLifecycles.set(key, lifecycle)
  }
  return lifecycle
}

function clearLiveToolLifecycle(threadId: string, turnId: string): void {
  liveToolLifecycles.delete(getLiveToolLifecycleKey(threadId, turnId))
}

function clearLiveToolLifecyclesForThread(threadId: string): void {
  const prefix = `${threadId}:`
  for (const key of liveToolLifecycles.keys()) {
    if (key.startsWith(prefix)) {
      liveToolLifecycles.delete(key)
    }
  }
}

function getLiveToolLifecycleKey(threadId: string, turnId: string): string {
  return `${threadId}:${turnId}`
}

function createLiveToolLifecycleSource(
  source: {
    threadId: string
    turnId: string
    itemId?: string
    startedAt?: unknown
    createdAt?: unknown
  },
  contentIndex: number,
): {
  threadId: string
  turnId: string
  messageUuid?: string
  contentIndex: number
  createdAt?: string
} {
  const createdAt =
    typeof source.startedAt === 'string'
      ? source.startedAt
      : typeof source.createdAt === 'string'
        ? source.createdAt
        : undefined
  return {
    threadId: source.threadId,
    turnId: source.turnId,
    ...(source.itemId ? { messageUuid: source.itemId } : {}),
    contentIndex,
    ...(createdAt ? { createdAt } : {}),
  }
}

function coreItemToThreadMessage(
  item: CoreJsonObject & {
    itemId: string
    threadId: string
    turnId: string
    kind: string
    status: string
  },
  content: CoreJsonObject[],
): AppServerThreadMessage {
  return {
    id: item.itemId,
    role: getThreadMessageRoleFromKind(item.kind),
    text: extractDisplayText(content),
    status: item.status,
    kind: item.kind,
    createdAt: getStringField(item, ['startedAt', 'createdAt']),
    content,
  }
}

function coreCompletedItemToThreadMessage(
  event: Extract<CoreTurnEvent, { type: 'item_completed' }>,
  content: CoreJsonObject[],
): AppServerThreadMessage {
  return {
    id: event.itemId,
    role: getThreadMessageRoleFromKind(event.kind),
    text: extractDisplayText(content),
    status: event.status,
    ...(event.kind ? { kind: event.kind } : {}),
    createdAt: event.startedAt,
    content,
  }
}

function getThreadMessageRoleFromKind(
  kind: string | undefined,
): AppServerThreadMessage['role'] {
  if (kind === 'tool_result' || kind === 'user_message') {
    return 'user'
  }
  if (kind?.includes('system')) {
    return 'system'
  }
  if (kind?.includes('error')) {
    return 'error'
  }
  return 'assistant'
}

function getCoreJsonBlocksFromUnknownContent(content: unknown): CoreJsonObject[] {
  return Array.isArray(content) ? content.filter(isCoreJsonObject) : []
}

function getItemCompletedMetadata(
  event: Extract<CoreTurnEvent, { type: 'item_completed' }>,
): Record<string, unknown> {
  return {
    coreEventType: event.type,
    ...(event.completedAt ? { completedAt: event.completedAt } : {}),
    ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
  }
}

function coreItemToThreadDisplayItem(item: CoreJsonObject & {
  itemId: string
  threadId: string
  turnId: string
  kind: string
  status: string
}): ThreadDisplayItem {
  return withThreadDisplayProjection({
    id: item.itemId,
    type: getThreadDisplayItemTypeFromKind(item.kind),
    text: extractDisplayText(item.content ?? item.text ?? item.summary),
    status: item.status,
    sourceKind: item.kind,
    createdAt: getStringField(item, ['startedAt', 'createdAt']),
    identity: {
      threadId: item.threadId,
      turnId: item.turnId,
      itemId: item.itemId,
      toolUseId: getStringField(item, ['toolUseId', 'toolUseID', 'tool_use_id']),
    },
    content: item.content,
    metadata: {
      coreEventType: 'item_started',
    },
  })
}

function completedCoreItemToThreadDisplayItem(
  event: Extract<CoreTurnEvent, { type: 'item_completed' }>,
): ThreadDisplayItem | null {
  const type = getCompletedThreadDisplayItemType(event)
  if (!type) {
    return null
  }
  return withThreadDisplayProjection({
    id: event.itemId,
    type,
    text: extractDisplayText(event.content),
    status: event.status,
    ...(event.kind ? { sourceKind: event.kind } : {}),
    createdAt: event.startedAt,
    identity: {
      threadId: event.threadId,
      turnId: event.turnId,
      itemId: event.itemId,
      toolUseId: getToolUseIdFromContent(event.content),
    },
    content: event.content,
    metadata: {
      coreEventType: event.type,
      ...(event.completedAt ? { completedAt: event.completedAt } : {}),
      ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
    },
  })
}

function getCompletedThreadDisplayItemType(
  event: Extract<CoreTurnEvent, { type: 'item_completed' }>,
): ThreadDisplayItemType | undefined {
  if (event.kind) {
    return getThreadDisplayItemTypeFromKind(event.kind)
  }
  const type = getThreadDisplayItemTypeFromContent(event.content)
  return type === 'assistant_message' ? undefined : type
}

function withThreadDisplayProjection(item: ThreadDisplayItem): ThreadDisplayItem {
  const projection = projectThreadDisplayItem(item)
  const validatedProjection = projection
    ? assertThreadDisplayProjection(
        projection,
        `ThreadDisplayItem ${item.id}`,
      )
    : undefined
  const timelineHidden =
    item.timelineHidden ?? validatedProjection?.event?.timelineHidden
  return {
    ...item,
    ...(timelineHidden !== undefined ? { timelineHidden } : {}),
    ...(validatedProjection ? { projection: validatedProjection } : {}),
  }
}

function getCoreEventThreadId(event: CoreTurnEvent): string | undefined {
  switch (event.type) {
    case 'thread_started':
      return event.thread.threadId
    case 'item_started':
      return event.item.threadId
    case 'permission_requested':
      return event.request.threadId
    case 'item_delta':
    case 'item_completed':
    case 'turn_started':
    case 'turn_completed':
    case 'turn_failed':
    case 'turn_cancelled':
    case 'context_compaction_started':
    case 'context_compacted':
    case 'permission_cancelled':
      return event.threadId
  }
}

function createContextCompactionStartedItem(
  event: Extract<CoreTurnEvent, { type: 'context_compaction_started' }>,
): ThreadDisplayItem {
  const itemId = getContextCompactionStartedDisplayItemId(event)
  activeContextCompactionItemIds.set(event.threadId, itemId)
  const text =
    event.trigger === 'auto'
      ? '正在自动压缩上下文，完成后会继续当前任务。'
      : '正在压缩上下文，完成后会刷新当前会话上下文。'
  const compactSnapshot = compactJsonObject({
    status: 'running',
    trigger: event.trigger,
    startedAt: event.startedAt,
  })

  return withThreadDisplayProjection({
    id: itemId,
    type: 'system_notice',
    text,
    status: 'running',
    sourceKind: 'context_compaction',
    createdAt: event.startedAt,
    identity: {
      threadId: event.threadId,
      ...(event.turnId ? { turnId: event.turnId } : {}),
      itemId,
    },
    content: [{ type: 'text', text }],
    metadata: compactJsonObject({
      coreEventType: event.type,
      compactSnapshot,
    }),
  })
}

function createContextCompactedItem(
  event: Extract<CoreTurnEvent, { type: 'context_compacted' }>,
  itemId: string,
): ThreadDisplayItem {
  const compactSnapshot = createContextCompactSnapshot(event)
  const text = formatContextCompactedText(compactSnapshot)

  return withThreadDisplayProjection({
    id: itemId,
    type: 'system_notice',
    text,
    status: 'completed',
    sourceKind: 'context_compaction',
    createdAt: event.compactedAt,
    identity: {
      threadId: event.threadId,
      itemId,
    },
    content: [{ type: 'text', text }],
    metadata: compactJsonObject({
      coreEventType: event.type,
      compactSnapshot,
      compactResult: event.result,
    }),
  })
}

function getContextCompactionStartedDisplayItemId(
  event: Extract<CoreTurnEvent, { type: 'context_compaction_started' }>,
): string {
  return `${event.threadId}:context-compaction:${event.startedAt}`
}

function getContextCompactedDisplayItemId(
  event: Extract<CoreTurnEvent, { type: 'context_compacted' }>,
): string {
  const activeItemId = activeContextCompactionItemIds.get(event.threadId)
  if (activeItemId) {
    activeContextCompactionItemIds.delete(event.threadId)
    return activeItemId
  }
  return `${event.threadId}:context-compacted:${event.compactedAt}`
}

function createContextCompactSnapshot(
  event: Extract<CoreTurnEvent, { type: 'context_compacted' }>,
): CoreJsonObject {
  const result = event.result
  const trigger = getStringValue(result, ['trigger'])
  return compactJsonObject({
    status: 'completed',
    trigger: trigger === 'auto' || trigger === 'manual' ? trigger : undefined,
    completedAt: event.compactedAt,
    preCompactTokenCount: getNumberValue(result, [
      'preCompactTokenCount',
      'preTokens',
    ]),
    postCompactTokenCount: getNumberValue(result, [
      'postCompactTokenCount',
      'postTokens',
    ]),
    truePostCompactTokenCount: getNumberValue(result, [
      'truePostCompactTokenCount',
      'truePostTokens',
    ]),
    summaryMessageCount: getNumberValue(result, [
      'summaryMessageCount',
      'messagesSummarized',
    ]),
    attachmentCount: getNumberValue(result, ['attachmentCount']),
    hookResultCount: getNumberValue(result, ['hookResultCount']),
  })
}

function formatContextCompactedText(snapshot: CoreJsonObject): string {
  const preTokens = getNumberValue(snapshot, ['preCompactTokenCount'])
  const postTokens =
    getNumberValue(snapshot, ['truePostCompactTokenCount']) ??
    getNumberValue(snapshot, ['postCompactTokenCount'])
  const summaryCount = getNumberValue(snapshot, ['summaryMessageCount'])
  const attachmentCount = getNumberValue(snapshot, ['attachmentCount'])
  const details = [
    preTokens !== undefined && postTokens !== undefined
      ? `${formatCompactNumber(preTokens)} -> ${formatCompactNumber(postTokens)} token`
      : undefined,
    summaryCount !== undefined ? `摘要 ${formatCompactNumber(summaryCount)} 条` : undefined,
    attachmentCount !== undefined
      ? `附件 ${formatCompactNumber(attachmentCount)} 个`
      : undefined,
  ].filter(Boolean)

  return details.length > 0
    ? `上下文已压缩：${details.join('，')}。`
    : '上下文已压缩，运行状态已刷新。'
}

function getNumberValue(
  input: CoreJsonObject | undefined,
  keys: string[],
): number | undefined {
  if (!input) {
    return undefined
  }
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

function getStringValue(
  input: CoreJsonObject | undefined,
  keys: string[],
): string | undefined {
  if (!input) {
    return undefined
  }
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function compactJsonObject<T extends Record<string, unknown>>(object: T): T {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as T
}

function getThreadDisplayItemTypeFromKind(kind: string): ThreadDisplayItemType {
  if (kind === 'user_message') {
    return 'user_message'
  }
  if (kind === 'assistant_message') {
    return 'assistant_message'
  }
  if (
    kind === 'thinking_summary' ||
    kind === 'reasoning_summary' ||
    kind === 'summary_text' ||
    kind === 'assistant_thinking'
  ) {
    return 'thinking_summary'
  }
  if (kind.includes('tool') || kind === 'assistant') {
    return 'tool_call'
  }
  return 'system_notice'
}

function getThreadDisplayItemTypeFromContent(
  content: readonly CoreJsonObject[] | undefined,
): ThreadDisplayItemType {
  const firstType = getFirstContentBlockType(content)
  if (firstType === 'tool_use') {
    if (isFileMutationToolUseContent(content)) {
      return 'file_change'
    }
    return 'tool_call'
  }
  if (firstType === 'tool_result') {
    return 'tool_result'
  }
  if (
    firstType === 'thinking' ||
    firstType === 'redacted_thinking' ||
    firstType === 'reasoning'
  ) {
    return 'thinking_summary'
  }
  return 'assistant_message'
}

function getThreadDisplayItemTypeFromDelta(
  delta: CoreJsonObject,
): ThreadDisplayItemType {
  const type = typeof delta.type === 'string' ? delta.type : ''
  if (
    type === 'thinking' ||
    type === 'thinking_summary' ||
    type === 'redacted_thinking' ||
    type === 'reasoning' ||
    type === 'reasoning_summary' ||
    type === 'summary_text'
  ) {
    return 'thinking_summary'
  }
  return 'assistant_message'
}

function isFileMutationToolUseContent(
  content: readonly CoreJsonObject[] | undefined,
): boolean {
  const firstBlock = content?.[0]
  if (!firstBlock || firstBlock.type !== 'tool_use') {
    return false
  }
  const name = typeof firstBlock.name === 'string' ? firstBlock.name : ''
  return (
    name === 'Write' ||
    name === 'Edit' ||
    name === 'MultiEdit' ||
    name === 'NotebookEdit' ||
    name === 'FileWrite' ||
    name === 'FileEdit'
  )
}

function getFirstContentBlockType(
  content: readonly CoreJsonObject[] | undefined,
): string | undefined {
  const firstBlock = content?.[0]
  return firstBlock && typeof firstBlock.type === 'string'
    ? firstBlock.type
    : undefined
}

function getCoreDeltaDisplayText(delta: CoreJsonObject): string {
  for (const key of ['text', 'thinking', 'summary']) {
    const value = delta[key]
    if (typeof value === 'string') {
      return value
    }
  }
  return extractDisplayText(delta.text ?? delta.thinking ?? delta.summary)
}

function getToolUseIdFromContent(
  content: readonly CoreJsonObject[] | undefined,
): string | undefined {
  for (const block of content ?? []) {
    const id = getStringField(block, [
      'id',
      'toolUseId',
      'toolUseID',
      'tool_use_id',
      'parentToolUseId',
      'parentToolUseID',
      'parent_tool_use_id',
    ])
    if (id) {
      return id
    }
  }
  return undefined
}

function extractDisplayText(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (!value || depth > 2) {
    return ''
  }
  if (Array.isArray(value)) {
    return value
      .map(item => extractDisplayText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  const object = value as Record<string, unknown>
  const parts: string[] = []
  for (const key of [
    'text',
    'content',
    'summary',
    'message',
    'output',
    'result',
    'error',
  ]) {
    const text = extractDisplayText(object[key], depth + 1)
    if (text) {
      parts.push(text)
    }
  }
  return parts.join('\n').trim()
}

function getStringField(
  value: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const field = value[key]
    if (typeof field === 'string' && field.trim()) {
      return field
    }
  }
  return undefined
}

function isCoreJsonObject(value: unknown): value is CoreJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
