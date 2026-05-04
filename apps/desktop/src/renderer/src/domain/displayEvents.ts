import {
  createMessageFromCompletedItem,
  normalizeContentBlocks,
} from './contentBlocks.js'
import type { ChatMessage } from './displayTypes.js'
import {
  createDisplayEventIdentity,
  type DisplayEventContractContext,
  type DisplayEventIdentity,
} from './eventContract.js'
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
}

export function createUserDisplayEvent(id: string, text: string): DisplayEvent {
  return {
    id,
    type: 'user_message',
    text,
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
  if (isRawThinkingOnly(blocks)) {
    return null
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
    return {
      id: itemId,
      type: toolSnapshot.kind === 'call' ? 'tool_call' : 'tool_result',
      text: toolSnapshot.summary,
      status: statusText,
      sourceKind: kind,
      timelineHidden: shouldHideToolFromTimeline(toolSnapshot),
      identity,
      toolSnapshot,
    }
  }

  const message = createMessageFromCompletedItem(itemId, kind, blocks, statusText)
  if (!message) {
    return null
  }

  return chatMessageToDisplayEvent(message, identity)
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
    event.type === 'file_change'
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
