import {
  createMessageFromCompletedItem,
  normalizeContentBlocks,
} from './contentBlocks.js'
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
  const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
    eventId: id,
    blocks: attachments.map(toAttachmentContentBlock),
    source: 'UserUpload',
  })
  return {
    id,
    type: 'user_message',
    text,
    attachmentSnapshots:
      attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
  }
}

export function createErrorDisplayEvent(id: string, text: string): DisplayEvent {
  return {
    id,
    type: 'error',
    text,
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
  const blocks = normalizeContentBlocks(content)
  const identity = createDisplayEventIdentity(context ?? { itemId })
  if (isRawThinkingOnly(blocks) || isSyntheticMessageOnly(blocks)) {
    return null
  }

  if (kind === 'user_message') {
    return isHistoryReplayContext(context)
      ? createUserDisplayEventFromBlocks(itemId, blocks, identity)
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
    }
  }

  const message = createMessageFromCompletedItem(itemId, kind, blocks, statusText)
  if (!message) {
    return null
  }

  const event = chatMessageToDisplayEvent(message, identity)
  const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
    eventId: itemId,
    blocks,
    source: 'ToolResult',
    identity,
  })
  return attachmentSnapshots.length > 0
    ? { ...event, attachmentSnapshots }
    : event
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

function createUserDisplayEventFromBlocks(
  itemId: string,
  blocks: JsonObject[],
  identity: DisplayEventIdentity,
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

  if (!text && attachmentSnapshots.length === 0) {
    return null
  }

  return {
    id: itemId,
    type: 'user_message',
    text,
    status: 'completed',
    sourceKind: 'user_message',
    identity,
    attachmentSnapshots:
      attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
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
  return (
    snapshot.kind === 'call' &&
    (snapshot.category === 'control' || isControlToolName(snapshot.name))
  )
}
