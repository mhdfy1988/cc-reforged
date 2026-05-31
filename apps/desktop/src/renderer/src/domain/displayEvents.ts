import {
  createMessageFromCompletedItem,
  normalizeContentBlocks,
} from './contentBlocks.js'
import {
  normalizeCcrContentBlocks,
  type CcrContentBlock,
} from '../../../../../../src/types/contentBlocks.js'
import {
  parseThreadDisplayProjection,
  validateThreadDisplayProjection,
} from '../../../../../../src/display/threadDisplayProjectionSchema.js'
import {
  createCcrErrorSnapshot,
  type CcrErrorSnapshot,
} from '../../../../../../src/types/errorSnapshot.js'
import type { ChatMessage, JsonObject } from './displayTypes.js'
import {
  createDisplayEventIdentity,
  type DisplayEventContractContext,
  type DisplayEventIdentity,
} from './eventContract.js'
import type {
  AttachmentSnapshot,
  FileSnapshot,
  FileToolSnapshot,
  ReferenceSnapshot,
} from './fileEvents.js'
import {
  extractAttachmentSnapshotsFromContentBlocks,
  extractFileDisplaySnapshotsFromToolSnapshot,
  removeGeneratedOutputImagePathsFromText,
  removeUserUploadImagePlaceholderFromText,
} from './fileEvents.js'
import {
  extractTodoOverlaySnapshotFromBlocks,
  type TodoOverlaySnapshot,
} from './todoEvents.js'
import {
  extractToolSnapshotFromBlocks,
  isControlToolName,
  type ToolSnapshot,
} from './toolEvents.js'

export type DisplayEventType =
  | 'user_message'
  | 'assistant_message'
  | 'thinking_summary'
  | 'tool_call'
  | 'tool_result'
  | 'permission_request'
  | 'todo_list'
  | 'file_change'
  | 'file_reference'
  | 'attachment'
  | 'error'
  | 'system_notice'

export type DisplayEvent = {
  id: string
  type: DisplayEventType
  text: string
  status?: string
  sourceKind?: string
  timelineHidden?: boolean
  identity?: DisplayEventIdentity
  todoSnapshot?: TodoOverlaySnapshot
  toolSnapshot?: ToolSnapshot
  fileToolSnapshot?: FileToolSnapshot
  fileSnapshot?: FileSnapshot
  attachmentSnapshot?: AttachmentSnapshot
  attachmentSnapshots?: AttachmentSnapshot[]
  referenceSnapshot?: ReferenceSnapshot
  compactSnapshot?: DisplayCompactSnapshot
  contentBlocks?: CcrContentBlock[]
  errorSnapshot?: CcrErrorSnapshot
}

export type DisplayCompactSnapshot = {
  status?: string
  trigger?: string
  startedAt?: string
  completedAt?: string
  preCompactTokenCount?: number
  postCompactTokenCount?: number
  truePostCompactTokenCount?: number
  summaryMessageCount?: number
  attachmentCount?: number
  hookResultCount?: number
}

export type DisplayAttachmentInput = {
  type: string
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: unknown
  previewDataUrl?: string
}

export function createUserDisplayEvent(
  id: string,
  text: string,
  attachments: readonly DisplayAttachmentInput[] = [],
): DisplayEvent {
  const rawBlocks = [
    ...(text.trim() ? [{ type: 'text', text }] : []),
    ...attachments.map(toAttachmentContentBlock),
  ]
  const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
    eventId: id,
    blocks: rawBlocks,
    source: 'UserUpload',
  })
  const displayText = removeUserUploadImagePlaceholderFromText(
    text,
    attachmentSnapshots,
  )
  return {
    id,
    type: 'user_message',
    text: displayText,
    attachmentSnapshots:
      attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
    contentBlocks: normalizeCcrContentBlocks(rawBlocks),
  }
}

export function createErrorDisplayEvent(id: string, text: string): DisplayEvent {
  return {
    id,
    type: 'error',
    text,
    errorSnapshot: createCcrErrorSnapshot({
      message: text,
      source: 'desktop',
    }),
  }
}

export function createSystemNoticeEvent(id: string, text: string): DisplayEvent {
  return {
    id,
    type: 'system_notice',
    text,
  }
}

export function createDisplayEventFromCompletedItem(
  itemId: string,
  kind: string | undefined,
  content: unknown,
  statusText: string,
  context?: DisplayEventContractContext,
): DisplayEvent | null {
  const projectionIssue = getThreadDisplayProjectionProtocolIssue(context?.item)
  if (
    isThreadDisplayContext(context) &&
    projectionIssue
  ) {
    return createThreadDisplayProjectionProtocolErrorEvent(
      itemId,
      context?.item,
      projectionIssue,
      context,
    )
  }

  const projectedEvent = createDisplayEventFromThreadDisplayProjection(
    itemId,
    context?.item,
  )
  if (projectedEvent) {
    return projectedEvent
  }

  const blocks = normalizeContentBlocks(content)
  const contentBlocks = normalizeCcrContentBlocks(content)
  const identity = createDisplayEventIdentity(context ?? { itemId })
  if (kind === 'assistant_message' && isRawThinkingOnly(blocks)) {
    return {
      id: itemId,
      type: 'system_notice',
      text: '模型只返回了推理内容，未返回最终回复。',
      status: statusText,
      sourceKind: kind,
      timelineHidden: true,
      identity,
      contentBlocks,
    }
  }
  if (isRawThinkingOnly(blocks) || isSyntheticMessageOnly(blocks)) {
    return null
  }

  if (kind === 'user_message') {
    return isHistoryReplayContext(context)
      ? createUserDisplayEventFromBlocks(
          itemId,
          blocks,
          identity,
          contentBlocks,
        )
      : null
  }

  const todoSnapshot = extractTodoOverlaySnapshotFromBlocks(
    itemId,
    blocks,
    context,
  )
  if (todoSnapshot) {
    return {
      id: itemId,
      type: 'todo_list',
      text: `TodoWrite 已更新 ${todoSnapshot.items.length} 个任务。`,
      status: statusText,
      sourceKind: kind,
      identity,
      todoSnapshot,
      contentBlocks,
    }
  }

  const toolSnapshot = extractToolSnapshotFromBlocks(
    itemId,
    blocks,
    statusText,
    context,
  )
  if (toolSnapshot) {
    const fileDisplaySnapshots =
      extractFileDisplaySnapshotsFromToolSnapshot(toolSnapshot)
    const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
      eventId: itemId,
      blocks,
      source: 'ToolResult',
      identity,
    })
    return {
      id: itemId,
      type: toolSnapshot.kind === 'call' ? 'tool_call' : 'tool_result',
      text: toolSnapshot.summary,
      status: statusText,
      sourceKind: kind,
      timelineHidden: shouldHideToolFromTimeline(toolSnapshot),
      identity,
      toolSnapshot,
      ...fileDisplaySnapshots,
      attachmentSnapshots:
        attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
      contentBlocks,
      errorSnapshot: toolSnapshot.errorMessage
        ? createCcrErrorSnapshot({
            message: toolSnapshot.errorMessage,
            source: 'tool',
            category: 'tool_error',
            turnId: identity.turnId,
            toolUseId: identity.toolUseId,
            safeDetails: {
              toolName: toolSnapshot.name,
              errorClass: toolSnapshot.errorClass,
              status: toolSnapshot.status,
            },
          })
        : undefined,
    }
  }

  const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
    eventId: itemId,
    blocks,
    source: kind === 'assistant_message' ? 'ModelOutput' : 'ToolResult',
    identity,
  })
  const message = createMessageFromCompletedItem(itemId, kind, blocks, statusText)
  if (!message) {
    return attachmentSnapshots.length > 0
      ? {
          id: itemId,
          type: kind === 'assistant_message' ? 'assistant_message' : 'system_notice',
          text: '',
          status: statusText,
          sourceKind: kind,
          identity,
          attachmentSnapshots,
          contentBlocks,
        }
      : null
  }

  const event = chatMessageToDisplayEvent(message, identity)
  const text = removeGeneratedOutputImagePathsFromText(
    event.text,
    attachmentSnapshots,
  )
  return attachmentSnapshots.length > 0
    ? { ...event, text, attachmentSnapshots, contentBlocks }
    : { ...event, text, contentBlocks }
}

export function createDisplayEventFromThreadDisplayProjection(
  itemId: string,
  item: unknown,
): DisplayEvent | null {
  const projection = parseThreadDisplayProjection(
    getObjectRecord(item)?.projection,
  )
  const projectedEvent = projection?.event
  if (!projectedEvent) {
    return null
  }

  const type = getProjectedString(projectedEvent.type)
  const text = getProjectedString(projectedEvent.text)
  if (!type || text === undefined) {
    return null
  }

  const attachmentSnapshots = Array.isArray(projectedEvent.attachmentSnapshots)
    ? (projectedEvent.attachmentSnapshots as AttachmentSnapshot[])
    : undefined
  const displayText = removeUserUploadImagePlaceholderFromText(
    removeGeneratedOutputImagePathsFromText(text, attachmentSnapshots),
    attachmentSnapshots,
  )

  return {
    id: itemId,
    type: type as DisplayEventType,
    text: displayText,
    status: getProjectedString(projectedEvent.status),
    sourceKind: getProjectedString(projectedEvent.sourceKind),
    timelineHidden:
      typeof projectedEvent.timelineHidden === 'boolean'
        ? projectedEvent.timelineHidden
        : undefined,
    identity: getObjectRecord(projectedEvent.identity) as
      | DisplayEventIdentity
      | undefined,
    todoSnapshot: getObjectRecord(projectedEvent.todoSnapshot) as
      | TodoOverlaySnapshot
      | undefined,
    toolSnapshot: getObjectRecord(projectedEvent.toolSnapshot) as
      | ToolSnapshot
      | undefined,
    fileToolSnapshot: getObjectRecord(projectedEvent.fileToolSnapshot) as
      | FileToolSnapshot
      | undefined,
    fileSnapshot: getObjectRecord(projectedEvent.fileSnapshot) as
      | FileSnapshot
      | undefined,
    attachmentSnapshot: getObjectRecord(projectedEvent.attachmentSnapshot) as
      | AttachmentSnapshot
      | undefined,
    attachmentSnapshots,
    referenceSnapshot: getObjectRecord(projectedEvent.referenceSnapshot) as
      | ReferenceSnapshot
      | undefined,
    compactSnapshot: getObjectRecord(projectedEvent.compactSnapshot) as
      | DisplayCompactSnapshot
      | undefined,
    contentBlocks: Array.isArray(projectedEvent.contentBlocks)
      ? (projectedEvent.contentBlocks as CcrContentBlock[])
      : undefined,
    errorSnapshot: getObjectRecord(projectedEvent.errorSnapshot) as unknown as
      | CcrErrorSnapshot
      | undefined,
  }
}

export function getThreadDisplayProjectionProtocolIssue(
  item: unknown,
): string | null {
  const object = getObjectRecord(item)
  if (!object || !('projection' in object)) {
    return '缺少 ThreadDisplayItem.projection'
  }

  const result = validateThreadDisplayProjection(object.projection)
  return 'issue' in result ? result.issue : null
}

export function createThreadDisplayProjectionProtocolErrorEvent(
  itemId: string,
  item: unknown,
  issue = getThreadDisplayProjectionProtocolIssue(item) ??
    'ThreadDisplayItem.projection 无效',
  context?: DisplayEventContractContext,
): DisplayEvent {
  const itemObject = getObjectRecord(item)
  const itemType = getProjectedString(itemObject?.type) ?? 'unknown'
  const event = createErrorDisplayEvent(
    `${itemId}:projection-protocol-error`,
    `展示协议错误：${issue}。itemId=${itemId}，itemType=${itemType}。`,
  )
  return {
    ...event,
    status: 'failed',
    sourceKind: 'thread_display_projection',
    identity: createDisplayEventIdentity(context ?? { itemId }),
  }
}

function getObjectRecord(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined
}

function getProjectedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function toAttachmentContentBlock(attachment: DisplayAttachmentInput): JsonObject {
  return {
    ...attachment,
    type: attachment.type === 'text' ? 'file' : attachment.type,
  }
}

function isHistoryReplayContext(
  context: DisplayEventContractContext | undefined,
): boolean {
  return context?.params?.source === 'history'
}

function isThreadDisplayContext(
  context: DisplayEventContractContext | undefined,
): boolean {
  return (
    Boolean(context?.item) &&
    (context?.params?.source === 'history' || context?.params?.source === 'live')
  )
}

function createUserDisplayEventFromBlocks(
  itemId: string,
  blocks: JsonObject[],
  identity: DisplayEventIdentity,
  contentBlocks: CcrContentBlock[],
): DisplayEvent | null {
  const text = blocks
    .map(getHistoryUserTextBlockValue)
    .filter(Boolean)
    .join('\n\n')
  const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
    eventId: itemId,
    blocks,
    source: 'UserUpload',
    identity,
  })
  const displayText = removeUserUploadImagePlaceholderFromText(
    text,
    attachmentSnapshots,
  )

  if (!displayText && attachmentSnapshots.length === 0) {
    return null
  }

  return {
    id: itemId,
    type: 'user_message',
    text: displayText,
    status: 'completed',
    sourceKind: 'user_message',
    identity,
    attachmentSnapshots:
      attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
    contentBlocks,
  }
}

function getHistoryUserTextBlockValue(block: JsonObject): string {
  const type = typeof block.type === 'string' ? block.type : ''
  if (
    (type === 'text' || type === 'input_text' || type === 'output_text') &&
    typeof block.text === 'string'
  ) {
    return block.text.trim()
  }
  if (type === 'json' && typeof block.value === 'string') {
    return block.value.trim()
  }
  return ''
}

function isRawThinkingOnly(blocks: Array<{ type?: unknown }>): boolean {
  return (
    blocks.length > 0 &&
    blocks.every(
      block =>
        block.type === 'thinking' ||
        block.type === 'redacted_thinking' ||
        block.type === 'reasoning',
    )
  )
}

function isSyntheticMessageOnly(blocks: JsonObject[]): boolean {
  if (blocks.length !== 1) {
    return false
  }
  const block = blocks[0]
  const type = typeof block.type === 'string' ? block.type : ''
  const text =
    (type === 'text' || type === 'input_text' || type === 'output_text') &&
    typeof block.text === 'string'
      ? block.text
      : type === 'json' && typeof block.value === 'string'
        ? block.value
        : undefined
  return Boolean(text && SYNTHETIC_MESSAGE_TEXT.has(text))
}

const SYNTHETIC_MESSAGE_TEXT = new Set([
  '[Request interrupted by user]',
  '[Request interrupted by user for tool use]',
  "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.",
  "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
  'No response requested.',
])

export function chatMessageToDisplayEvent(
  message: ChatMessage,
  identity?: DisplayEventIdentity,
): DisplayEvent {
  return {
    id: message.id,
    type: getDisplayEventType(message),
    text: message.text,
    status: message.status,
    sourceKind: message.kind,
    identity,
  }
}

export function displayEventToChatMessage(event: DisplayEvent): ChatMessage {
  return {
    id: event.id,
    role: getChatRole(event),
    kind: getChatKind(event),
    status: event.status,
    text: event.text,
  }
}

function getDisplayEventType(message: ChatMessage): DisplayEventType {
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

function getChatRole(event: DisplayEvent): ChatMessage['role'] {
  if (event.type === 'user_message') {
    return 'user'
  }
  if (event.type === 'assistant_message') {
    return 'assistant'
  }
  if (event.type === 'error') {
    return 'error'
  }
  return 'system'
}

function getChatKind(event: DisplayEvent): string | undefined {
  if (event.type === 'thinking_summary') {
    return 'thinking-event'
  }
  if (
    event.type === 'tool_call' ||
    event.type === 'tool_result' ||
    event.type === 'todo_list' ||
    event.type === 'file_change' ||
    event.type === 'file_reference' ||
    event.type === 'attachment'
  ) {
    return 'tool-event'
  }
  return event.sourceKind
}

function shouldHideToolFromTimeline(snapshot: ToolSnapshot): boolean {
  if (snapshot.status === 'failed') {
    return false
  }
  if (snapshot.kind === 'call' && snapshot.showInMainTimeline === false) {
    return true
  }
  return (
    (snapshot.kind === 'call' &&
      (snapshot.category === 'control' || isControlToolName(snapshot.name))) ||
    isInternalPlanDraftWrite(snapshot)
  )
}

function isInternalPlanDraftWrite(snapshot: ToolSnapshot): boolean {
  if (snapshot.kind !== 'call' || snapshot.name !== 'Write') {
    return false
  }

  const path = getToolPath(snapshot)
  if (!path) {
    return false
  }

  return /(?:^|\/)\.ccr\/plans\/[^/]+\.md$/i.test(
    path.replace(/\\/g, '/'),
  )
}

function getToolPath(snapshot: ToolSnapshot): string | undefined {
  if (typeof snapshot.target === 'string' && snapshot.target.trim()) {
    return snapshot.target
  }

  if (!snapshot.input || typeof snapshot.input !== 'object') {
    return undefined
  }

  const input = snapshot.input as JsonObject
  for (const key of ['file_path', 'filePath', 'path']) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}
