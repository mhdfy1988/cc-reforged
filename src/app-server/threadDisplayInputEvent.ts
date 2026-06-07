import type { CoreJsonObject, CoreTurnEvent } from '../core/types.js'
import type { AppServerThreadMessage, ThreadDisplayIdentity } from './protocol.js'
import { materializeGeneratedOutputImageBlocks } from './threadDisplayGeneratedOutputMaterializer.js'

export type ThreadDisplayReducerInputEvent =
  | ThreadDisplayHistoryMessageInputEvent
  | ThreadDisplayRealtimeInputEvent

export type ThreadDisplayInputSource = 'history' | 'realtime'

export type ThreadDisplayOrderKey = {
  source: ThreadDisplayInputSource
  ordinal: number
  timestamp?: string
  turnId?: string
  itemId?: string
}

export type ThreadDisplaySourceIdentity =
  | ThreadDisplayMessageSourceIdentity
  | ThreadDisplayToolSourceIdentity
  | ThreadDisplayAttachmentSourceIdentity
  | ThreadDisplayErrorSourceIdentity
  | ThreadDisplaySystemSourceIdentity
  | ThreadDisplayControlSourceIdentity
  | ThreadDisplayUnsupportedSourceIdentity

export type ThreadDisplayMessageSourceIdentity = {
  kind: 'message'
  sourceId: string
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string
  messageUuid?: string
}

export type ThreadDisplayToolSourceIdentity = {
  kind: 'tool'
  sourceId: string
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string
  messageUuid?: string
  toolUseId?: string
  toolCallId?: string
  parentToolUseId?: string
  sourceToolAssistantUUID?: string
}

export type ThreadDisplayAttachmentSourceIdentity = {
  kind: 'attachment'
  sourceId: string
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string
  parentSourceId?: string
}

export type ThreadDisplayErrorSourceIdentity = {
  kind: 'error'
  sourceId: string
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string
  parentSourceId?: string
  toolUseId?: string
}

export type ThreadDisplaySystemSourceIdentity = {
  kind: 'system'
  sourceId: string
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string
}

export type ThreadDisplayControlSourceIdentity = {
  kind: 'control'
  sourceId: string
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string
}

export type ThreadDisplayUnsupportedSourceIdentity = {
  kind: 'unsupported'
  sourceId: string
  threadId: string
  sessionId?: string
  rawType: string
  reason: string
}

export type ThreadDisplayInputPayload =
  | {
      type: 'message'
      message: AppServerThreadMessage
      blocks: CoreJsonObject[]
    }
  | {
      type: 'core_event'
      eventType: Exclude<ThreadDisplayInputEventKind, 'message'>
      blocks: CoreJsonObject[]
    }
  | {
      type: 'unsupported'
      rawType: string
      reason: string
      raw?: unknown
    }

export type ThreadDisplayInputDiagnostic = {
  code: string
  message: string
  details?: CoreJsonObject
}

export type ThreadDisplayInputEventKind =
  | 'message'
  | 'item_started'
  | 'item_delta'
  | 'item_completed'
  | 'turn_failed'
  | 'turn_cancelled'
  | 'turn_started'
  | 'turn_completed'
  | 'thread_started'
  | 'context_compaction_started'
  | 'context_compacted'
  | 'permission_requested'
  | 'permission_cancelled'

export type ThreadDisplayReducerInputSourceIdentity = ThreadDisplayIdentity & {
  source: ThreadDisplayInputSource
}

export type ThreadDisplayHistoryMessageInputEvent = {
  source: 'history'
  kind: 'message'
  threadId: string
  sessionId?: string
  orderKey: ThreadDisplayOrderKey
  sourceIdentity: ThreadDisplaySourceIdentity
  payload: ThreadDisplayInputPayload
  diagnostics: ThreadDisplayInputDiagnostic[]
  message: AppServerThreadMessage
  blocks: CoreJsonObject[]
  identity: ThreadDisplayReducerInputSourceIdentity
  raw: {
    message: AppServerThreadMessage
  }
}

export type ThreadDisplayRealtimeInputEvent = {
  source: 'realtime'
  kind: Exclude<ThreadDisplayInputEventKind, 'message'>
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string
  orderKey: ThreadDisplayOrderKey
  sourceIdentity: ThreadDisplaySourceIdentity
  payload: ThreadDisplayInputPayload
  diagnostics: ThreadDisplayInputDiagnostic[]
  blocks: CoreJsonObject[]
  identity: ThreadDisplayReducerInputSourceIdentity
  raw: {
    event: CoreTurnEvent
  }
}

export function appServerThreadMessagesToDisplayReducerInputEvents(
  messages: readonly AppServerThreadMessage[],
  context: {
    threadId: string
    sessionId?: string
  },
): ThreadDisplayHistoryMessageInputEvent[] {
  return messages.map((message, sourceIndex) =>
    appServerThreadMessageToDisplayReducerInputEvent(message, {
      ...context,
      sourceIndex,
    }),
  )
}

export function appServerThreadMessageToDisplayReducerInputEvent(
  message: AppServerThreadMessage,
  context: {
    threadId: string
    sessionId?: string
    sourceIndex?: number
  },
): ThreadDisplayHistoryMessageInputEvent {
  const blocks = getDisplayInputBlocksFromUnknownContent(message.content, {
    materializeGeneratedOutputImages: message.role === 'assistant',
  })
  const identity: ThreadDisplayReducerInputSourceIdentity = {
    source: 'history',
    threadId: context.threadId,
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    itemId: message.id,
    messageUuid: message.id,
    sourceIndex: context.sourceIndex,
    rawIndex: context.sourceIndex,
    materializedIndex: context.sourceIndex,
  }
  const orderKey = createHistoryOrderKey(message, context.sourceIndex)
  const sourceIdentity = createHistorySourceIdentity(message, {
    threadId: context.threadId,
    sessionId: context.sessionId,
    blocks,
  })
  const inputEvent: ThreadDisplayHistoryMessageInputEvent = {
    source: 'history',
    kind: 'message',
    threadId: context.threadId,
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    orderKey,
    sourceIdentity,
    payload: {
      type: 'message',
      message,
      blocks,
    },
    diagnostics: [],
    message,
    blocks,
    identity,
    raw: { message },
  }
  return assertThreadDisplayHistoryInputEvent(
    inputEvent,
    'appServerThreadMessageToDisplayReducerInputEvent',
  )
}

export function coreTurnEventToDisplayReducerInputEvent(
  event: CoreTurnEvent,
  context: {
    sourceIndex?: number
  } = {},
): ThreadDisplayRealtimeInputEvent {
  const threadId = getCoreEventThreadId(event)
  if (!threadId) {
    throw new Error(`CoreTurnEvent ${event.type} is missing threadId`)
  }

  const turnId = getCoreEventTurnId(event)
  const itemId = getCoreEventItemId(event)
  const blocks = getCoreEventBlocks(event)
  const sessionId = getCoreEventSessionId(event)
  const orderKey = createRealtimeOrderKey(event, {
    sourceIndex: context.sourceIndex,
    turnId,
    itemId,
  })
  const sourceIdentity = createRealtimeSourceIdentity(event, {
    threadId,
    sessionId,
    turnId,
    itemId,
    blocks,
  })
  const identity: ThreadDisplayReducerInputSourceIdentity = {
    source: 'realtime',
    threadId,
    ...(sessionId ? { sessionId } : {}),
    ...(turnId ? { turnId } : {}),
    ...(itemId ? { itemId } : {}),
  }
  const inputEvent: ThreadDisplayRealtimeInputEvent = {
    source: 'realtime',
    kind: event.type,
    threadId,
    ...(sessionId ? { sessionId } : {}),
    ...(turnId ? { turnId } : {}),
    ...(itemId ? { itemId } : {}),
    orderKey,
    sourceIdentity,
    payload: {
      type: 'core_event',
      eventType: event.type,
      blocks,
    },
    diagnostics: [],
    blocks,
    identity,
    raw: { event },
  }
  return assertThreadDisplayRealtimeInputEvent(
    inputEvent,
    'coreTurnEventToDisplayReducerInputEvent',
  )
}

export function createUnsupportedDisplayReducerInputEvent(input: {
  source: ThreadDisplayInputSource
  threadId: string
  sessionId?: string
  rawType: string
  reason: string
  ordinal?: number
  raw?: unknown
}): ThreadDisplayReducerInputEvent {
  const orderKey: ThreadDisplayOrderKey = {
    source: input.source,
    ordinal: input.ordinal ?? -1,
  }
  const sourceIdentity: ThreadDisplayUnsupportedSourceIdentity = {
    kind: 'unsupported',
    sourceId: `${input.source}:unsupported:${input.rawType}:${orderKey.ordinal}`,
    threadId: input.threadId,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    rawType: input.rawType,
    reason: input.reason,
  }
  const diagnostics = [
    {
      code: 'unsupported_thread_display_input',
      message: input.reason,
      details: {
        rawType: input.rawType,
        source: input.source,
      },
    },
  ]

  if (input.source === 'history') {
    const message: AppServerThreadMessage = {
      id: sourceIdentity.sourceId,
      role: 'system',
      text: input.reason,
      content: [{ type: 'text', text: input.reason }],
    }
    return assertThreadDisplayReducerInputEvent({
      source: 'history',
      kind: 'message',
      threadId: input.threadId,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      orderKey,
      sourceIdentity,
      payload: {
        type: 'unsupported',
        rawType: input.rawType,
        reason: input.reason,
        ...(input.raw !== undefined ? { raw: input.raw } : {}),
      },
      diagnostics,
      message,
      blocks: [],
      identity: {
        source: 'history',
        threadId: input.threadId,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        itemId: sourceIdentity.sourceId,
        messageUuid: sourceIdentity.sourceId,
      },
      raw: { message },
    }, 'createUnsupportedDisplayReducerInputEvent')
  }

  const event = input.raw as CoreTurnEvent
  return assertThreadDisplayReducerInputEvent({
    source: 'realtime',
    kind: 'turn_cancelled',
    threadId: input.threadId,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    orderKey,
    sourceIdentity,
    payload: {
      type: 'unsupported',
      rawType: input.rawType,
      reason: input.reason,
      ...(input.raw !== undefined ? { raw: input.raw } : {}),
    },
    diagnostics,
    blocks: [],
    identity: {
      source: 'realtime',
      threadId: input.threadId,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      itemId: sourceIdentity.sourceId,
    },
    raw: {
      event:
        event && typeof event === 'object' && 'type' in event
          ? event
          : {
              type: 'turn_cancelled',
              threadId: input.threadId,
              turnId: sourceIdentity.sourceId,
              reason: input.reason,
          },
    },
  }, 'createUnsupportedDisplayReducerInputEvent')
}

export function assertThreadDisplayHistoryInputEvent(
  inputEvent: ThreadDisplayReducerInputEvent,
  context = 'ThreadDisplayHistoryMessageInputEvent',
): ThreadDisplayHistoryMessageInputEvent {
  const event = assertThreadDisplayReducerInputEvent(inputEvent, context)
  if (event.source !== 'history' || event.kind !== 'message') {
    throw new Error(
      `${context} protocol violation: expected history message input event`,
    )
  }
  return event
}

export function assertThreadDisplayRealtimeInputEvent(
  inputEvent: ThreadDisplayReducerInputEvent,
  context = 'ThreadDisplayRealtimeInputEvent',
): ThreadDisplayRealtimeInputEvent {
  const event = assertThreadDisplayReducerInputEvent(inputEvent, context)
  if (event.source !== 'realtime') {
    throw new Error(
      `${context} protocol violation: expected realtime input event`,
    )
  }
  return event
}

export function assertThreadDisplayReducerInputEvent<
  T extends ThreadDisplayReducerInputEvent,
>(inputEvent: T, context = 'ThreadDisplayReducerInputEvent'): T {
  const diagnostics = validateThreadDisplayReducerInputEvent(inputEvent)
  if (diagnostics.length > 0) {
    throw new Error(
      `${context} protocol violation: ${diagnostics
        .map(diagnostic => diagnostic.message)
        .join('; ')}`,
    )
  }
  return inputEvent
}

export function validateThreadDisplayReducerInputEvent(
  inputEvent: unknown,
): ThreadDisplayInputDiagnostic[] {
  const diagnostics: ThreadDisplayInputDiagnostic[] = []
  if (!isObjectRecord(inputEvent)) {
    return [
      createInputProtocolDiagnostic(
        'thread_display_input_not_object',
        'ThreadDisplayReducerInputEvent must be an object.',
      ),
    ]
  }

  const source = inputEvent.source
  if (!isThreadDisplayInputSource(source)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_missing_source',
        'ThreadDisplayReducerInputEvent.source must be history or realtime.',
      ),
    )
  }

  const threadId = inputEvent.threadId
  if (!isNonEmptyString(threadId)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_missing_thread_id',
        'ThreadDisplayReducerInputEvent.threadId is required.',
      ),
    )
  }

  const orderKey = inputEvent.orderKey
  if (!isObjectRecord(orderKey)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_missing_order_key',
        'ThreadDisplayReducerInputEvent.orderKey is required.',
      ),
    )
  } else {
    if (!isThreadDisplayInputSource(orderKey.source)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_invalid_order_source',
          'ThreadDisplayReducerInputEvent.orderKey.source must be history or realtime.',
        ),
      )
    } else if (source === 'history' || source === 'realtime') {
      if (orderKey.source !== source) {
        diagnostics.push(
          createInputProtocolDiagnostic(
            'thread_display_input_order_source_mismatch',
            'ThreadDisplayReducerInputEvent.orderKey.source must match source.',
          ),
        )
      }
    }
    if (typeof orderKey.ordinal !== 'number' || !Number.isFinite(orderKey.ordinal)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_invalid_order_ordinal',
          'ThreadDisplayReducerInputEvent.orderKey.ordinal must be a finite number.',
        ),
      )
    }
  }

  const sourceIdentity = inputEvent.sourceIdentity
  if (!isObjectRecord(sourceIdentity)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_missing_source_identity',
        'ThreadDisplayReducerInputEvent.sourceIdentity is required.',
      ),
    )
  } else {
    if (!isThreadDisplaySourceIdentityKind(sourceIdentity.kind)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_invalid_source_identity_kind',
          'ThreadDisplayReducerInputEvent.sourceIdentity.kind is invalid.',
        ),
      )
    }
    if (!isNonEmptyString(sourceIdentity.sourceId)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_missing_source_identity_id',
          'ThreadDisplayReducerInputEvent.sourceIdentity.sourceId is required.',
        ),
      )
    }
    if (!isNonEmptyString(sourceIdentity.threadId)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_source_identity_missing_thread_id',
          'ThreadDisplayReducerInputEvent.sourceIdentity.threadId is required.',
        ),
      )
    } else if (isNonEmptyString(threadId) && sourceIdentity.threadId !== threadId) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_source_identity_thread_mismatch',
          'ThreadDisplayReducerInputEvent.sourceIdentity.threadId must match threadId.',
        ),
      )
    }
  }

  const payload = inputEvent.payload
  if (!isObjectRecord(payload)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_missing_payload',
        'ThreadDisplayReducerInputEvent.payload is required.',
      ),
    )
  } else if (!isThreadDisplayInputPayloadType(payload.type)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_invalid_payload_type',
        'ThreadDisplayReducerInputEvent.payload.type is invalid.',
      ),
    )
  } else {
    if (source === 'history' && payload.type !== 'message' && payload.type !== 'unsupported') {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_history_payload_mismatch',
          'history input payload must be message or unsupported.',
        ),
      )
    }
    if (source === 'realtime' && payload.type !== 'core_event' && payload.type !== 'unsupported') {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_realtime_payload_mismatch',
          'realtime input payload must be core_event or unsupported.',
        ),
      )
    }
    if (payload.type === 'message') {
      if (!isObjectRecord(payload.message)) {
        diagnostics.push(
          createInputProtocolDiagnostic(
            'thread_display_input_message_payload_missing_message',
            'message payload requires message.',
          ),
        )
      }
      if (!Array.isArray(payload.blocks)) {
        diagnostics.push(
          createInputProtocolDiagnostic(
            'thread_display_input_message_payload_missing_blocks',
            'message payload requires blocks array.',
          ),
        )
      }
    }
    if (payload.type === 'core_event' && !isNonEmptyString(payload.eventType)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_core_payload_missing_event_type',
          'core_event payload requires eventType.',
        ),
      )
    }
    if (payload.type === 'unsupported') {
      if (!isNonEmptyString(payload.rawType) || !isNonEmptyString(payload.reason)) {
        diagnostics.push(
          createInputProtocolDiagnostic(
            'thread_display_input_unsupported_payload_incomplete',
            'unsupported payload requires rawType and reason.',
          ),
        )
      }
    }
  }

  if (!Array.isArray(inputEvent.diagnostics)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_missing_diagnostics',
        'ThreadDisplayReducerInputEvent.diagnostics must be an array.',
      ),
    )
  } else {
    for (const [index, diagnostic] of inputEvent.diagnostics.entries()) {
      if (!isObjectRecord(diagnostic)) {
        diagnostics.push(
          createInputProtocolDiagnostic(
            'thread_display_input_invalid_diagnostic',
            `ThreadDisplayReducerInputEvent.diagnostics[${index}] must be an object.`,
          ),
        )
        continue
      }
      if (!isNonEmptyString(diagnostic.code) || !isNonEmptyString(diagnostic.message)) {
        diagnostics.push(
          createInputProtocolDiagnostic(
            'thread_display_input_invalid_diagnostic_fields',
            `ThreadDisplayReducerInputEvent.diagnostics[${index}] requires code and message.`,
          ),
        )
      }
    }
  }

  const identity = inputEvent.identity
  if (!isObjectRecord(identity)) {
    diagnostics.push(
      createInputProtocolDiagnostic(
        'thread_display_input_missing_identity',
        'ThreadDisplayReducerInputEvent.identity is required.',
      ),
    )
  } else {
    if (identity.source !== source) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_identity_source_mismatch',
          'ThreadDisplayReducerInputEvent.identity.source must match source.',
        ),
      )
    }
    if (identity.threadId !== threadId) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_identity_thread_mismatch',
          'ThreadDisplayReducerInputEvent.identity.threadId must match threadId.',
        ),
      )
    }
  }

  if (source === 'history') {
    if (inputEvent.kind !== 'message') {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_history_kind_mismatch',
          'history input kind must be message.',
        ),
      )
    }
    if (!isObjectRecord(inputEvent.message) || !Array.isArray(inputEvent.blocks)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_history_shape_invalid',
          'history input requires message and blocks.',
        ),
      )
    }
    if (!isObjectRecord(inputEvent.raw) || !isObjectRecord(inputEvent.raw.message)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_history_raw_missing',
          'history input requires raw.message.',
        ),
      )
    }
  }

  if (source === 'realtime') {
    if (inputEvent.kind === 'message') {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_realtime_kind_mismatch',
          'realtime input kind must not be message.',
        ),
      )
    }
    if (!Array.isArray(inputEvent.blocks)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_realtime_blocks_missing',
          'realtime input requires blocks array.',
        ),
      )
    }
    if (!isObjectRecord(inputEvent.raw) || !isObjectRecord(inputEvent.raw.event)) {
      diagnostics.push(
        createInputProtocolDiagnostic(
          'thread_display_input_realtime_raw_missing',
          'realtime input requires raw.event.',
        ),
      )
    }
  }

  return diagnostics
}

function createHistoryOrderKey(
  message: AppServerThreadMessage,
  sourceIndex?: number,
): ThreadDisplayOrderKey {
  return {
    source: 'history',
    ordinal: sourceIndex ?? 0,
    ...(message.createdAt ? { timestamp: message.createdAt } : {}),
    itemId: message.id,
  }
}

function createRealtimeOrderKey(
  event: CoreTurnEvent,
  context: {
    sourceIndex?: number
    turnId?: string
    itemId?: string
  },
): ThreadDisplayOrderKey {
  const timestamp = getCoreEventTimestamp(event)
  return {
    source: 'realtime',
    ordinal: context.sourceIndex ?? getRealtimeEventFallbackOrdinal(event),
    ...(timestamp ? { timestamp } : {}),
    ...(context.turnId ? { turnId: context.turnId } : {}),
    ...(context.itemId ? { itemId: context.itemId } : {}),
  }
}

function createHistorySourceIdentity(
  message: AppServerThreadMessage,
  context: {
    threadId: string
    sessionId?: string
    blocks: CoreJsonObject[]
  },
): ThreadDisplaySourceIdentity {
  const toolIdentity = getPrimaryToolSourceIdentityFromBlocks(context.blocks, {
    sourcePrefix: 'history',
    threadId: context.threadId,
    sessionId: context.sessionId,
    messageUuid: message.id,
    itemId: message.id,
  })
  if (toolIdentity) {
    return toolIdentity
  }
  const attachmentIdentity = getPrimaryAttachmentSourceIdentityFromBlocks(
    context.blocks,
    {
      sourcePrefix: 'history',
      threadId: context.threadId,
      sessionId: context.sessionId,
      itemId: message.id,
    },
  )
  if (attachmentIdentity) {
    return attachmentIdentity
  }
  if (message.role === 'error') {
    return {
      kind: 'error',
      sourceId: `history:error:${message.id}`,
      threadId: context.threadId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      itemId: message.id,
    }
  }
  if (message.role === 'system' || message.kind?.includes('system')) {
    return {
      kind: 'system',
      sourceId: `history:system:${message.id}`,
      threadId: context.threadId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      itemId: message.id,
    }
  }
  return {
    kind: 'message',
    sourceId: `history:message:${message.id}`,
    threadId: context.threadId,
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    itemId: message.id,
    messageUuid: message.id,
  }
}

function createRealtimeSourceIdentity(
  event: CoreTurnEvent,
  context: {
    threadId: string
    sessionId?: string
    turnId?: string
    itemId?: string
    blocks: CoreJsonObject[]
  },
): ThreadDisplaySourceIdentity {
  const toolIdentity = getPrimaryToolSourceIdentityFromBlocks(context.blocks, {
    sourcePrefix: 'realtime',
    threadId: context.threadId,
    sessionId: context.sessionId,
    turnId: context.turnId,
    itemId: context.itemId,
  })
  if (toolIdentity) {
    return toolIdentity
  }
  const attachmentIdentity = getPrimaryAttachmentSourceIdentityFromBlocks(
    context.blocks,
    {
      sourcePrefix: 'realtime',
      threadId: context.threadId,
      sessionId: context.sessionId,
      turnId: context.turnId,
      itemId: context.itemId,
    },
  )
  if (attachmentIdentity) {
    return attachmentIdentity
  }
  if (event.type === 'turn_failed') {
    return {
      kind: 'error',
      sourceId: `realtime:error:${context.turnId ?? event.type}`,
      threadId: context.threadId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context.turnId ? { turnId: context.turnId } : {}),
      ...(context.itemId ? { itemId: context.itemId } : {}),
    }
  }
  if (
    event.type === 'thread_started' ||
    event.type === 'turn_started' ||
    event.type === 'turn_completed' ||
    event.type === 'turn_cancelled' ||
    event.type === 'context_compaction_started' ||
    event.type === 'context_compacted' ||
    event.type === 'permission_requested' ||
    event.type === 'permission_cancelled'
  ) {
    return {
      kind: 'control',
      sourceId: `realtime:control:${event.type}:${context.itemId ?? context.turnId ?? context.threadId}`,
      threadId: context.threadId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context.turnId ? { turnId: context.turnId } : {}),
      ...(context.itemId ? { itemId: context.itemId } : {}),
    }
  }
  return {
    kind: 'message',
    sourceId: `realtime:message:${context.itemId ?? context.turnId ?? event.type}`,
    threadId: context.threadId,
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context.turnId ? { turnId: context.turnId } : {}),
    ...(context.itemId ? { itemId: context.itemId } : {}),
  }
}

function getPrimaryToolSourceIdentityFromBlocks(
  blocks: CoreJsonObject[],
  context: {
    sourcePrefix: ThreadDisplayInputSource
    threadId: string
    sessionId?: string
    turnId?: string
    itemId?: string
    messageUuid?: string
  },
): ThreadDisplayToolSourceIdentity | undefined {
  for (const block of blocks) {
    const blockType = getStringFromObject(block, ['type'])
    if (
      blockType !== 'tool_use' &&
      blockType !== 'tool_result' &&
      blockType !== 'progress'
    ) {
      continue
    }
    const blockToolUseId =
      getStringFromObject(block, ['id', 'toolUseId', 'toolUseID']) ??
      getStringFromObject(block, ['tool_use_id'])
    const toolCallId = getStringFromObject(block, ['toolCallId', 'tool_call_id'])
    const parentToolUseId = getStringFromObject(block, [
      'parentToolUseId',
      'parentToolUseID',
      'parent_tool_use_id',
      'tool_use_id',
    ])
    const toolUseId =
      blockType === 'progress' ? parentToolUseId ?? blockToolUseId : blockToolUseId
    const sourceId =
      toolUseId ?? toolCallId ?? `${context.itemId ?? context.messageUuid ?? 'tool'}`
    return {
      kind: 'tool',
      sourceId: `${context.sourcePrefix}:tool:${sourceId}`,
      threadId: context.threadId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context.turnId ? { turnId: context.turnId } : {}),
      ...(context.itemId ? { itemId: context.itemId } : {}),
      ...(context.messageUuid ? { messageUuid: context.messageUuid } : {}),
      ...(toolUseId ? { toolUseId } : {}),
      ...(toolCallId ? { toolCallId } : {}),
      ...(parentToolUseId ? { parentToolUseId } : {}),
      ...((blockType === 'tool_result' || blockType === 'progress') &&
      parentToolUseId
        ? { sourceToolAssistantUUID: parentToolUseId }
        : {}),
    }
  }
  return undefined
}

function getPrimaryAttachmentSourceIdentityFromBlocks(
  blocks: CoreJsonObject[],
  context: {
    sourcePrefix: ThreadDisplayInputSource
    threadId: string
    sessionId?: string
    turnId?: string
    itemId?: string
  },
): ThreadDisplayAttachmentSourceIdentity | undefined {
  for (const block of blocks) {
    const blockType = getStringFromObject(block, ['type'])
    const attachment =
      blockType === 'attachment' &&
      block.attachment &&
      typeof block.attachment === 'object' &&
      !Array.isArray(block.attachment)
        ? (block.attachment as Record<string, unknown>)
        : block
    const attachmentType =
      getStringFromObject(attachment, ['type']) ?? blockType ?? ''
    if (
      attachmentType !== 'image' &&
      attachmentType !== 'file' &&
      attachmentType !== 'audio' &&
      attachmentType !== 'video'
    ) {
      continue
    }
    const attachmentId =
      getStringFromObject(attachment, ['attachmentId', 'id', 'outputId']) ??
      getStringFromObject(attachment, [
        'path',
        'savedPath',
        'displayPath',
        'displayName',
        'name',
        'fileName',
        'filename',
      ])
    const sourceId = attachmentId ?? `${context.itemId ?? attachmentType}`
    return {
      kind: 'attachment',
      sourceId: `${context.sourcePrefix}:attachment:${sourceId}`,
      threadId: context.threadId,
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context.turnId ? { turnId: context.turnId } : {}),
      ...(context.itemId ? { itemId: context.itemId } : {}),
      parentSourceId: context.itemId,
    }
  }
  return undefined
}

function getRealtimeEventFallbackOrdinal(event: CoreTurnEvent): number {
  switch (event.type) {
    case 'thread_started':
      return 0
    case 'turn_started':
      return 1
    case 'permission_requested':
      return 2
    case 'item_started':
      return 3
    case 'item_delta':
      return 4
    case 'item_completed':
      return 5
    case 'context_compaction_started':
      return 6
    case 'context_compacted':
      return 7
    case 'permission_cancelled':
      return 8
    case 'turn_completed':
      return 9
    case 'turn_failed':
      return 10
    case 'turn_cancelled':
      return 11
  }
}

function getCoreEventTimestamp(event: CoreTurnEvent): string | undefined {
  if (event.type === 'item_started') {
    return getStringFromObject(event.item, ['startedAt', 'createdAt'])
  }
  if (event.type === 'item_completed') {
    return event.completedAt ?? event.startedAt
  }
  if (event.type === 'context_compacted') {
    return event.compactedAt
  }
  if (event.type === 'permission_requested') {
    return event.request.createdAt
  }
  if ('metadata' in event && event.metadata) {
    return getStringFromObject(event.metadata, ['completedAt', 'startedAt'])
  }
  return undefined
}

function getCoreEventThreadId(event: CoreTurnEvent): string | undefined {
  if ('threadId' in event && typeof event.threadId === 'string') {
    return event.threadId
  }
  if (event.type === 'thread_started') {
    return event.thread.threadId
  }
  if (event.type === 'item_started') {
    return event.item.threadId
  }
  if (event.type === 'permission_requested') {
    return event.request.threadId
  }
  return undefined
}

function getCoreEventTurnId(event: CoreTurnEvent): string | undefined {
  if ('turnId' in event && typeof event.turnId === 'string') {
    return event.turnId
  }
  if (event.type === 'item_started') {
    return event.item.turnId
  }
  if (event.type === 'permission_requested') {
    return event.request.turnId
  }
  return undefined
}

function getCoreEventItemId(event: CoreTurnEvent): string | undefined {
  if ('itemId' in event && typeof event.itemId === 'string') {
    return event.itemId
  }
  if (event.type === 'item_started') {
    return event.item.itemId
  }
  if (event.type === 'permission_requested') {
    return event.request.permissionRequestId
  }
  if (event.type === 'permission_cancelled') {
    return event.permissionRequestId
  }
  return undefined
}

function getCoreEventSessionId(event: CoreTurnEvent): string | undefined {
  if ('metadata' in event && event.metadata?.sessionId) {
    return event.metadata.sessionId
  }
  if (event.type === 'thread_started') {
    const sessionId = event.thread.metadata?.sessionId
    return typeof sessionId === 'string' ? sessionId : undefined
  }
  return undefined
}

function getCoreEventBlocks(event: CoreTurnEvent): CoreJsonObject[] {
  if (event.type === 'item_started') {
    return getDisplayInputBlocksFromUnknownContent(event.item.content, {
      materializeGeneratedOutputImages: event.item.kind === 'assistant_message',
    })
  }
  if (event.type === 'item_completed') {
    return getDisplayInputBlocksFromUnknownContent(event.content, {
      materializeGeneratedOutputImages: event.kind === 'assistant_message',
    })
  }
  if (event.type === 'item_delta') {
    return [event.delta]
  }
  if (event.type === 'turn_failed') {
    return [event.error]
  }
  if (event.type === 'context_compacted') {
    return [event.result]
  }
  if (event.type === 'permission_requested') {
    return [event.request.input]
  }
  return []
}

function getCoreJsonBlocksFromUnknownContent(content: unknown): CoreJsonObject[] {
  return Array.isArray(content)
    ? content.filter(
        (item): item is CoreJsonObject =>
          Boolean(item && typeof item === 'object' && !Array.isArray(item)),
      )
    : []
}

function getDisplayInputBlocksFromUnknownContent(
  content: unknown,
  options: {
    materializeGeneratedOutputImages?: boolean
  } = {},
): CoreJsonObject[] {
  const blocks = getCoreJsonBlocksFromUnknownContent(content)
  if (!options.materializeGeneratedOutputImages) {
    return blocks
  }
  return materializeGeneratedOutputImageBlocks(blocks) ?? []
}

function getStringFromObject(
  value: unknown,
  keys: readonly string[],
): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }
  return undefined
}

function createInputProtocolDiagnostic(
  code: string,
  message: string,
  details?: CoreJsonObject,
): ThreadDisplayInputDiagnostic {
  return {
    code,
    message,
    ...(details ? { details } : {}),
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isThreadDisplayInputSource(
  value: unknown,
): value is ThreadDisplayInputSource {
  return value === 'history' || value === 'realtime'
}

function isThreadDisplaySourceIdentityKind(
  value: unknown,
): value is ThreadDisplaySourceIdentity['kind'] {
  return (
    value === 'message' ||
    value === 'tool' ||
    value === 'attachment' ||
    value === 'error' ||
    value === 'system' ||
    value === 'control' ||
    value === 'unsupported'
  )
}

function isThreadDisplayInputPayloadType(
  value: unknown,
): value is ThreadDisplayInputPayload['type'] {
  return value === 'message' || value === 'core_event' || value === 'unsupported'
}
