import type { CoreJsonObject, CoreTurnEvent } from '../core/types.js'
import type { AppServerThreadMessage } from './protocol.js'
import type { ToolDisplayLifecycleSource } from './toolDisplayLifecycle.js'
import {
  normalizeToolProgressSourceIdFromBlock,
  normalizeToolResultSourceIdFromBlock,
  normalizeToolUseIdFromBlock,
} from './toolDisplayLifecycle.js'
import type {
  ThreadDisplayHistoryMessageInputEvent,
  ThreadDisplayInputEventKind,
  ThreadDisplayOrderKey,
  ThreadDisplayRealtimeInputEvent,
  ThreadDisplayReducerInputEvent,
  ThreadDisplayReducerInputSourceIdentity,
  ThreadDisplaySourceIdentity,
} from './threadDisplayInputEvent.js'

export type ThreadDisplayFact =
  | ThreadDisplayMessageFact
  | ThreadDisplayToolLifecycleFact
  | ThreadDisplayFileFact
  | ThreadDisplayAttachmentFact
  | ThreadDisplayErrorFact
  | ThreadDisplaySystemFact
  | ThreadDisplayControlFact
  | ThreadDisplayUnsupportedFact

export type ThreadDisplayFactType = ThreadDisplayFact['factType']

export type ThreadDisplayFactBase = {
  factType:
    | 'message'
    | 'tool_lifecycle'
    | 'file'
    | 'attachment'
    | 'error'
    | 'system'
    | 'control'
    | 'unsupported'
  inputSource: ThreadDisplayReducerInputEvent['source']
  inputKind: ThreadDisplayInputEventKind
  threadId: string
  sessionId?: string
  orderKey: ThreadDisplayOrderKey
  sourceIdentity: ThreadDisplaySourceIdentity
  identity: ThreadDisplayReducerInputSourceIdentity
  blocks: CoreJsonObject[]
  primaryBlock?: CoreJsonObject
  contentIndex?: number
}

export type ThreadDisplayMessageFact = ThreadDisplayFactBase & {
  factType: 'message'
  itemId: string
  message: AppServerThreadMessage
  sourceIndex?: number
}

export type ThreadDisplayAttachmentFact = ThreadDisplayFactBase & {
  factType: 'attachment'
  itemId: string
  message: AppServerThreadMessage
  sourceIndex?: number
  attachmentBlocks: CoreJsonObject[]
}

export type ThreadDisplayErrorFact = ThreadDisplayFactBase & {
  factType: 'error'
  itemId: string
  message?: AppServerThreadMessage
  text: string
}

export type ThreadDisplaySystemFact = ThreadDisplayFactBase & {
  factType: 'system'
  itemId: string
  message?: AppServerThreadMessage
  sourceIndex?: number
  text: string
  systemKind?: string
}

export type ThreadDisplayControlFact = ThreadDisplayFactBase & {
  factType: 'control'
  itemId: string
  text: string
  controlKind: string
  shouldRender: boolean
}

export type ThreadDisplayToolLikeFactBase = ThreadDisplayFactBase & {
  factType: 'tool_lifecycle' | 'file'
  itemId?: string
  message: AppServerThreadMessage
  lifecycleKind: 'tool_use' | 'tool_progress' | 'tool_result'
  block: CoreJsonObject
  source: ToolDisplayLifecycleSource
  toolName?: string
  toolUseId?: string
  parentToolUseId?: string
  completedAt?: string
  durationMs?: number
}

export type ThreadDisplayToolLifecycleFact = ThreadDisplayToolLikeFactBase & {
  factType: 'tool_lifecycle'
}

export type ThreadDisplayFileFact = ThreadDisplayToolLikeFactBase & {
  factType: 'file'
  fileOperation:
    | 'read'
    | 'write'
    | 'edit'
    | 'search'
    | 'notebook_edit'
    | 'unknown'
  filePath?: string
}

export type ThreadDisplayUnsupportedFact = ThreadDisplayFactBase & {
  factType: 'unsupported'
  itemId: string
  rawType: string
  reason: string
}

export type ThreadDisplayToolLikeFact =
  | ThreadDisplayToolLifecycleFact
  | ThreadDisplayFileFact

export type ThreadDisplayFactMetadata = {
  factType: ThreadDisplayFactType
  inputSource: ThreadDisplayReducerInputEvent['source']
  inputKind: ThreadDisplayInputEventKind
  sourceId: string
  sourceIdentityKind: ThreadDisplaySourceIdentity['kind']
  orderKey: ThreadDisplayOrderKey
  contentIndex?: number
  blockType?: string
  toolUseId?: string
  parentToolUseId?: string
  fileOperation?: ThreadDisplayFileFact['fileOperation']
  filePath?: string
  systemKind?: string
  controlKind?: string
  shouldRender?: boolean
  rawType?: string
  reason?: string
}

export function resolveThreadDisplayFacts(
  inputEvent: ThreadDisplayReducerInputEvent,
): ThreadDisplayFact[] {
  return inputEvent.source === 'history'
    ? resolveHistoryDisplayFacts(inputEvent)
    : resolveRealtimeDisplayFacts(inputEvent)
}

export function isThreadDisplayToolLikeFact(
  fact: ThreadDisplayFact,
): fact is ThreadDisplayToolLikeFact {
  return fact.factType === 'tool_lifecycle' || fact.factType === 'file'
}

export function isThreadDisplayMessageLikeFact(
  fact: ThreadDisplayFact,
): fact is
  | ThreadDisplayMessageFact
  | ThreadDisplayAttachmentFact
  | ThreadDisplayErrorFact
  | ThreadDisplaySystemFact {
  return (
    fact.factType === 'message' ||
    fact.factType === 'attachment' ||
    fact.factType === 'error' ||
    fact.factType === 'system'
  )
}

export function isThreadDisplaySystemFact(
  fact: ThreadDisplayFact,
): fact is ThreadDisplaySystemFact {
  return fact.factType === 'system'
}

export function isThreadDisplayControlFact(
  fact: ThreadDisplayFact,
): fact is ThreadDisplayControlFact {
  return fact.factType === 'control'
}

export function createDisplayFactMetadata(
  fact: ThreadDisplayFact,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    displayFact: compactObject({
      factType: fact.factType,
      inputSource: fact.inputSource,
      inputKind: fact.inputKind,
      sourceId: fact.sourceIdentity.sourceId,
      sourceIdentityKind: fact.sourceIdentity.kind,
      orderKey: fact.orderKey,
      contentIndex: fact.contentIndex,
      blockType: fact.primaryBlock ? getContentBlockType(fact.primaryBlock) : undefined,
      toolUseId: isThreadDisplayToolLikeFact(fact) ? fact.toolUseId : undefined,
      parentToolUseId: isThreadDisplayToolLikeFact(fact)
        ? fact.parentToolUseId
        : undefined,
      fileOperation: fact.factType === 'file' ? fact.fileOperation : undefined,
      filePath: fact.factType === 'file' ? fact.filePath : undefined,
      systemKind: fact.factType === 'system' ? fact.systemKind : undefined,
      controlKind: fact.factType === 'control' ? fact.controlKind : undefined,
      shouldRender: fact.factType === 'control' ? fact.shouldRender : undefined,
      rawType: fact.factType === 'unsupported' ? fact.rawType : undefined,
      reason: fact.factType === 'unsupported' ? fact.reason : undefined,
    } satisfies ThreadDisplayFactMetadata),
  }
  if (fact.primaryBlock) {
    metadata.primaryBlock = fact.primaryBlock
  }
  if (fact.factType === 'attachment') {
    metadata.attachmentBlocks = fact.attachmentBlocks
  }
  return metadata
}

function resolveHistoryDisplayFacts(
  inputEvent: ThreadDisplayHistoryMessageInputEvent,
): ThreadDisplayFact[] {
  if (inputEvent.payload.type === 'unsupported') {
    return [createUnsupportedFact(inputEvent)]
  }

  const message = inputEvent.message
  const blocks = inputEvent.blocks.length
    ? inputEvent.blocks
    : getCoreJsonBlocksFromUnknownContent(message.content)
  if (!blocks.some(isToolLifecycleBlock)) {
    return [createMessageLikeFact(inputEvent, message, blocks)]
  }

  const facts: ThreadDisplayFact[] = []
  let pendingBlocks: CoreJsonObject[] = []
  let pendingStartIndex: number | undefined
  const flushPendingBlocks = (): void => {
    if (pendingBlocks.length === 0) {
      return
    }
    facts.push(
      createMessageLikeFact(
        inputEvent,
        {
          ...message,
          id:
            pendingStartIndex === undefined
              ? message.id
              : `${message.id}:content:${pendingStartIndex}`,
          content: pendingBlocks,
          text: extractDisplayText(pendingBlocks),
        },
        pendingBlocks,
        pendingStartIndex,
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
    facts.push(createToolLikeFact(inputEvent, message, block, contentIndex))
  }

  flushPendingBlocks()
  return facts
}

function resolveRealtimeDisplayFacts(
  inputEvent: ThreadDisplayRealtimeInputEvent,
): ThreadDisplayFact[] {
  if (inputEvent.payload.type === 'unsupported') {
    return [createUnsupportedFact(inputEvent)]
  }

  const event = inputEvent.raw.event
  switch (event.type) {
    case 'item_started':
      return createRealtimeItemFacts({
        inputEvent,
        event,
        itemId: event.item.itemId,
        kind: event.item.kind,
        status: event.item.status,
        blocks: getCoreJsonBlocksFromUnknownContent(event.item.content),
        createdAt: getStringField(event.item, ['startedAt', 'createdAt']),
      })

    case 'item_completed':
      return createRealtimeItemFacts({
        inputEvent,
        event,
        itemId: event.itemId,
        kind: event.kind,
        status: event.status,
        blocks: getCoreJsonBlocksFromUnknownContent(event.content),
        createdAt: event.startedAt,
      })

    case 'item_delta':
      if (isToolProgressBlock(event.delta)) {
        return [
          createToolLikeFact(
            inputEvent,
            coreItemDeltaToThreadMessage(event),
            event.delta,
            0,
            event,
          ),
        ]
      }
      return [
        createControlFact(inputEvent, {
          itemId: event.itemId,
          text: '模型输出增量。',
          controlKind: event.type,
          shouldRender: true,
          blocks: [event.delta],
          primaryBlock: event.delta,
        }),
      ]

    case 'turn_failed':
      return [
        {
          ...createBaseFact(inputEvent, {
            factType: 'error',
            blocks: [event.error],
            primaryBlock: event.error,
          }),
          factType: 'error',
          itemId: `${event.turnId}:error`,
          text: extractDisplayText(event.error) || '当前 turn 失败。',
        },
      ]

    case 'context_compaction_started':
    case 'context_compacted':
      return [
        {
          ...createBaseFact(inputEvent, { factType: 'system', blocks: [] }),
          factType: 'system',
          itemId:
            event.type === 'context_compaction_started'
              ? `${event.threadId}:context-compaction:${event.startedAt}`
              : `${event.threadId}:context-compacted:${event.compactedAt}`,
          text:
            event.type === 'context_compaction_started'
              ? '正在压缩上下文。'
              : '上下文已压缩。',
          systemKind: event.type,
        },
      ]

    case 'permission_requested':
      return [
        createControlFact(inputEvent, {
          itemId: event.request.permissionRequestId,
          text: `权限请求：${event.request.tool.displayName ?? event.request.tool.name}`,
          controlKind: event.type,
          shouldRender: true,
          blocks: [],
        }),
      ]

    case 'permission_cancelled':
      return [
        createControlFact(inputEvent, {
          itemId: event.permissionRequestId,
          text: '权限请求已取消。',
          controlKind: event.type,
          shouldRender: true,
          blocks: [],
        }),
      ]

    case 'thread_started':
    case 'turn_started':
    case 'turn_completed':
    case 'turn_cancelled':
      return [
        createControlFact(inputEvent, {
          itemId:
            inputEvent.itemId ?? inputEvent.turnId ?? inputEvent.sourceIdentity.sourceId,
          text: event.type,
          controlKind: event.type,
          shouldRender: false,
          blocks: [],
        }),
      ]
  }
}

function createRealtimeItemFacts(input: {
  inputEvent: ThreadDisplayRealtimeInputEvent
  event: Extract<CoreTurnEvent, { type: 'item_started' | 'item_completed' }>
  itemId: string
  kind: string
  status: string
  blocks: CoreJsonObject[]
  createdAt?: string
}): ThreadDisplayFact[] {
  const { inputEvent, event, blocks } = input
  const message = createRealtimeThreadMessage(input)
  if (!blocks.some(isToolLifecycleBlock)) {
    return [
      createMessageLikeFact(
        inputEvent,
        message,
        blocks,
        undefined,
        input.itemId,
      ),
    ]
  }

  return blocks
    .map((block, contentIndex) => {
      const blockType = getContentBlockType(block)
      return isToolLifecycleBlock(block)
        ? createToolLikeFact(inputEvent, message, block, contentIndex, event)
        : null
    })
    .filter((fact): fact is ThreadDisplayToolLikeFact => Boolean(fact))
}

function createMessageLikeFact(
  inputEvent: ThreadDisplayHistoryMessageInputEvent | ThreadDisplayRealtimeInputEvent,
  message: AppServerThreadMessage,
  blocks: CoreJsonObject[],
  contentIndex?: number,
  itemId = message.id,
):
  | ThreadDisplayMessageFact
  | ThreadDisplayAttachmentFact
  | ThreadDisplayErrorFact
  | ThreadDisplaySystemFact {
  const attachmentBlocks = blocks.filter(isAttachmentBlock)
  const base = createBaseFact(inputEvent, {
    factType: 'message',
    blocks,
    primaryBlock: blocks[0],
    contentIndex,
  })
  const sourceIndex = inputEvent.identity.sourceIndex
  if (message.role === 'error') {
    return {
      ...base,
      factType: 'error',
      itemId,
      message,
      text: extractDisplayText(blocks) || message.text || '错误。',
    }
  }
  if (attachmentBlocks.length > 0) {
    return {
      ...base,
      factType: 'attachment',
      itemId,
      message,
      sourceIndex,
      attachmentBlocks,
    }
  }
  if (message.role === 'system' || isSystemMessageKind(message.kind)) {
    return {
      ...base,
      factType: 'system',
      itemId,
      message,
      sourceIndex,
      text: extractDisplayText(blocks) || message.text || '系统提示。',
      systemKind: message.kind,
    }
  }
  return {
    ...base,
    factType: 'message',
    itemId,
    message,
    sourceIndex,
  }
}

function createToolLikeFact(
  inputEvent: ThreadDisplayHistoryMessageInputEvent | ThreadDisplayRealtimeInputEvent,
  message: AppServerThreadMessage,
  block: CoreJsonObject,
  contentIndex: number,
  realtimeEvent?: Extract<
    CoreTurnEvent,
    { type: 'item_started' | 'item_delta' | 'item_completed' }
  >,
): ThreadDisplayToolLikeFact {
  const blockType = getContentBlockType(block)
  const lifecycleKind: ThreadDisplayToolLikeFact['lifecycleKind'] =
    blockType === 'tool_result'
      ? 'tool_result'
      : blockType === 'progress'
        ? 'tool_progress'
        : 'tool_use'
  const toolName = getStringField(block, ['name'])
  const toolUseId =
    lifecycleKind === 'tool_use'
      ? normalizeToolUseIdFromBlock(block)
      : lifecycleKind === 'tool_progress'
        ? normalizeToolProgressSourceIdFromBlock(block)
        : normalizeToolResultSourceIdFromBlock(block)
  const fileOperation = getFileOperation(toolName)
  const base = {
    ...createBaseFact(inputEvent, {
      factType: fileOperation ? 'file' : 'tool_lifecycle',
      blocks: [block],
      primaryBlock: block,
      contentIndex,
    }),
    message,
    lifecycleKind,
    block,
    source: createToolLifecycleSource(inputEvent, message, contentIndex, realtimeEvent),
    toolName,
    toolUseId,
    parentToolUseId:
      lifecycleKind === 'tool_result' || lifecycleKind === 'tool_progress'
        ? lifecycleKind === 'tool_progress'
          ? normalizeToolProgressSourceIdFromBlock(block)
          : normalizeToolResultSourceIdFromBlock(block)
        : undefined,
    ...(realtimeEvent &&
    'completedAt' in realtimeEvent &&
    realtimeEvent.completedAt
      ? { completedAt: realtimeEvent.completedAt }
      : {}),
    ...(realtimeEvent &&
    'durationMs' in realtimeEvent &&
    typeof realtimeEvent.durationMs === 'number'
      ? { durationMs: realtimeEvent.durationMs }
      : {}),
  }
  if (!fileOperation) {
    return {
      ...base,
      factType: 'tool_lifecycle',
    }
  }
  return {
    ...base,
    factType: 'file',
    fileOperation,
    ...(getPrimaryFilePathFromBlock(block)
      ? { filePath: getPrimaryFilePathFromBlock(block) }
      : {}),
  }
}

function createUnsupportedFact(
  inputEvent: ThreadDisplayReducerInputEvent,
): ThreadDisplayUnsupportedFact {
  const payload =
    inputEvent.payload.type === 'unsupported'
      ? inputEvent.payload
      : {
          rawType: inputEvent.kind,
          reason: 'unsupported display input',
        }
  return {
    ...createBaseFact(inputEvent, { factType: 'unsupported', blocks: [] }),
    factType: 'unsupported',
    itemId: `diagnostic:${inputEvent.sourceIdentity.sourceId}`,
    rawType: payload.rawType,
    reason: payload.reason,
  }
}

function createControlFact(
  inputEvent: ThreadDisplayRealtimeInputEvent,
  input: {
    itemId: string
    text: string
    controlKind: string
    shouldRender: boolean
    blocks: CoreJsonObject[]
    primaryBlock?: CoreJsonObject
  },
): ThreadDisplayControlFact {
  return {
    ...createBaseFact(inputEvent, {
      factType: 'control',
      blocks: input.blocks,
      primaryBlock: input.primaryBlock,
    }),
    factType: 'control',
    itemId: input.itemId,
    text: input.text,
    controlKind: input.controlKind,
    shouldRender: input.shouldRender,
  }
}

function createBaseFact(
  inputEvent: ThreadDisplayReducerInputEvent,
  input: {
    factType: ThreadDisplayFactBase['factType']
    blocks: CoreJsonObject[]
    primaryBlock?: CoreJsonObject
    contentIndex?: number
  },
): ThreadDisplayFactBase {
  return {
    factType: input.factType,
    inputSource: inputEvent.source,
    inputKind: inputEvent.kind,
    threadId: inputEvent.threadId,
    ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
    orderKey: inputEvent.orderKey,
    sourceIdentity: inputEvent.sourceIdentity,
    identity: inputEvent.identity,
    blocks: input.blocks,
    ...(input.primaryBlock ? { primaryBlock: input.primaryBlock } : {}),
    ...(input.contentIndex !== undefined ? { contentIndex: input.contentIndex } : {}),
  }
}

function createToolLifecycleSource(
  inputEvent: ThreadDisplayHistoryMessageInputEvent | ThreadDisplayRealtimeInputEvent,
  message: AppServerThreadMessage,
  contentIndex: number,
  realtimeEvent?: Extract<
    CoreTurnEvent,
    { type: 'item_started' | 'item_delta' | 'item_completed' }
  >,
): ToolDisplayLifecycleSource {
  const sourceIndex = inputEvent.identity.sourceIndex
  const createdAt =
    realtimeEvent && 'item' in realtimeEvent
      ? getStringField(realtimeEvent.item, ['startedAt', 'createdAt'])
      : realtimeEvent && 'completedAt' in realtimeEvent
        ? realtimeEvent.startedAt ?? realtimeEvent.completedAt
        : realtimeEvent && realtimeEvent.type === 'item_delta'
          ? getStringField(realtimeEvent, ['timestamp'])
          : message.createdAt
  return {
    threadId: inputEvent.threadId,
    ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
    ...('turnId' in inputEvent && inputEvent.turnId
      ? { turnId: inputEvent.turnId }
      : {}),
    messageUuid: message.id,
    ...(sourceIndex !== undefined ? { rawIndex: sourceIndex } : {}),
    ...(sourceIndex !== undefined ? { materializedIndex: sourceIndex } : {}),
    contentIndex,
    ...(createdAt ? { createdAt } : {}),
  }
}

function createRealtimeThreadMessage(input: {
  event: Extract<CoreTurnEvent, { type: 'item_started' | 'item_completed' }>
  itemId: string
  kind: string
  status: string
  blocks: CoreJsonObject[]
  createdAt?: string
}): AppServerThreadMessage {
  return {
    id: input.itemId,
    role: getThreadMessageRoleFromKind(input.kind),
    text: extractDisplayText(input.blocks),
    status: input.status,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    content: input.blocks,
  }
}

function coreItemDeltaToThreadMessage(
  event: Extract<CoreTurnEvent, { type: 'item_delta' }>,
): AppServerThreadMessage {
  return {
    id: event.itemId,
    role: 'assistant',
    text: extractDisplayText([event.delta]),
    status: 'running',
    kind: 'tool_progress',
    content: [event.delta],
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

function isSystemMessageKind(kind: string | undefined): boolean {
  return Boolean(
    kind &&
      (kind.includes('system') ||
        kind.includes('compact') ||
        kind.includes('context_compact')),
  )
}

function isToolLifecycleBlock(block: CoreJsonObject): boolean {
  const type = getContentBlockType(block)
  return type === 'tool_use' || type === 'tool_result' || type === 'progress'
}

function isToolProgressBlock(block: CoreJsonObject): boolean {
  return getContentBlockType(block) === 'progress'
}

function isAttachmentBlock(block: CoreJsonObject): boolean {
  const type = getContentBlockType(block)
  return (
    type === 'attachment' ||
    type === 'image' ||
    type === 'file' ||
    type === 'audio' ||
    type === 'video'
  )
}

function getFileOperation(
  toolName: string | undefined,
): ThreadDisplayFileFact['fileOperation'] | undefined {
  switch (toolName) {
    case 'Read':
      return 'read'
    case 'Write':
      return 'write'
    case 'Edit':
    case 'MultiEdit':
      return 'edit'
    case 'NotebookEdit':
      return 'notebook_edit'
    case 'Glob':
    case 'Grep':
      return 'search'
    default:
      return undefined
  }
}

function getPrimaryFilePathFromBlock(block: CoreJsonObject): string | undefined {
  const input = getJsonObject(block.input)
  const result = getJsonObject(block.result)
  return (
    getStringField(input, ['file_path', 'filePath', 'path']) ??
    getStringField(input, ['notebook_path', 'notebookPath']) ??
    getStringField(result, ['filePath', 'path']) ??
    getStringField(result, ['notebookPath', 'notebook_path'])
  )
}

function getCoreJsonBlocksFromUnknownContent(content: unknown): CoreJsonObject[] {
  return Array.isArray(content) ? content.filter(isCoreJsonObject) : []
}

function isCoreJsonObject(value: unknown): value is CoreJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getJsonObject(value: unknown): CoreJsonObject | undefined {
  return isCoreJsonObject(value) ? value : undefined
}

function getContentBlockType(block: CoreJsonObject): string {
  return typeof block.type === 'string' ? block.type : ''
}

function getStringField(
  input: CoreJsonObject | undefined,
  keys: readonly string[],
): string | undefined {
  if (!input) {
    return undefined
  }
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function extractDisplayText(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (!value || depth > 4) {
    return ''
  }
  if (Array.isArray(value)) {
    return value
      .map(item => extractDisplayText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim()
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    for (const key of ['text', 'summary', 'message', 'content', 'value']) {
      const rendered = extractDisplayText(object[key], depth + 1)
      if (rendered) {
        return rendered
      }
    }
  }
  return ''
}

function compactObject<T extends Record<string, unknown>>(object: T): T {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as T
}
