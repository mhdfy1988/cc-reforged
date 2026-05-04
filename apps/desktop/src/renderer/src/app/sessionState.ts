import {
  chatMessageToDisplayEvent,
  createDisplayEventFromCompletedItem,
  createSystemNoticeEvent,
  displayEventToChatMessage,
  type DisplayEvent,
} from '../domain/displayEvents.js'
import type {
  ChatMessage,
  PermissionCard,
  TurnRuntimeMetadata,
} from '../domain/displayTypes.js'
import {
  createDisplayEventIdentity,
  type DisplayEventContractContext,
} from '../domain/eventContract.js'
import type { TodoOverlaySnapshot } from '../domain/todoEvents.js'
import {
  getActionableHint,
  isControlToolResultText,
  getToolStatusLabel,
  type ToolSnapshot,
  type ToolErrorClass,
} from '../domain/toolEvents.js'

export type SessionState = {
  displayEvents: DisplayEvent[]
  permissions: PermissionCard[]
  activeTurnId: string | null
  turnMetadata: TurnRuntimeMetadata | null
}

export type SessionAction =
  | { type: 'append-display-event'; event: DisplayEvent }
  | { type: 'append-message'; message: ChatMessage }
  | {
      type: 'upsert-assistant-delta'
      itemId: string
      text: string
      context?: DisplayEventContractContext
    }
  | {
      type: 'upsert-thinking-delta'
      itemId: string
      thinking: string
      context?: DisplayEventContractContext
    }
  | {
      type: 'upsert-completed-item-message'
      itemId: string
      kind: string | undefined
      content: unknown
      statusText: string
      context?: DisplayEventContractContext
    }
  | { type: 'set-active-turn'; turnId: string | null }
  | { type: 'merge-turn-metadata'; metadata: TurnRuntimeMetadata }
  | { type: 'clear-permissions' }
  | { type: 'add-permission'; permission: PermissionCard }
  | { type: 'remove-permission'; permissionRequestId: string }
  | {
      type: 'set-permission-status'
      permissionRequestId: string
      status: PermissionCard['status']
    }

export const initialSessionState: SessionState = {
  displayEvents: [
    createSystemNoticeEvent(
      'welcome',
      'Desktop 原型已启动。你可以先打开工作区，再发送一条任务测试 App Server 事件流。',
    ),
  ],
  permissions: [],
  activeTurnId: null,
  turnMetadata: null,
}

export function selectChatMessages(state: SessionState): ChatMessage[] {
  return selectTimelineEvents(state).map(displayEventToChatMessage)
}

export function selectTimelineEvents(state: SessionState): DisplayEvent[] {
  return state.displayEvents.filter(
    event => event.type !== 'todo_list' && !event.timelineHidden,
  )
}

export function selectTodoOverlay(
  state: SessionState,
): TodoOverlaySnapshot | null {
  if (!state.activeTurnId || state.activeTurnId === 'pending') {
    return null
  }

  for (let index = state.displayEvents.length - 1; index >= 0; index -= 1) {
    const event = state.displayEvents[index]
    const snapshot = event.todoSnapshot
    if (!snapshot) {
      continue
    }

    const turnId = snapshot.identity?.turnId ?? event.identity?.turnId
    if (!turnId || turnId === state.activeTurnId) {
      return snapshot
    }
  }
  return null
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'append-display-event':
      return {
        ...state,
        displayEvents: [...state.displayEvents, action.event],
      }

    case 'append-message':
      return {
        ...state,
        displayEvents: [
          ...state.displayEvents,
          chatMessageToDisplayEvent(action.message),
        ],
      }

    case 'upsert-assistant-delta':
      return {
        ...state,
        displayEvents: upsertAssistantDelta(
          state.displayEvents,
          action.itemId,
          action.text,
          action.context,
        ),
      }

    case 'upsert-thinking-delta':
      return {
        ...state,
        displayEvents: upsertThinkingDelta(
          state.displayEvents,
          action.itemId,
          action.thinking,
          action.context,
        ),
      }

    case 'upsert-completed-item-message':
      return {
        ...state,
        displayEvents: upsertCompletedItemMessage(
          state.displayEvents,
          action.itemId,
          action.kind,
          action.content,
          action.statusText,
          action.context,
        ),
      }

    case 'set-active-turn':
      return {
        ...state,
        activeTurnId: action.turnId,
      }

    case 'merge-turn-metadata':
      return {
        ...state,
        turnMetadata: {
          ...(state.turnMetadata ?? {}),
          ...action.metadata,
          usage: {
            ...(state.turnMetadata?.usage ?? {}),
            ...(action.metadata.usage ?? {}),
          },
        },
      }

    case 'clear-permissions':
      return {
        ...state,
        permissions: [],
      }

    case 'add-permission':
      return {
        ...state,
        permissions: [action.permission, ...state.permissions],
        displayEvents: markToolPermissionRequested(
          state.displayEvents,
          action.permission,
        ),
      }

    case 'remove-permission':
      return {
        ...state,
        permissions: state.permissions.filter(
          permission =>
            permission.permissionRequestId !== action.permissionRequestId,
        ),
      }

    case 'set-permission-status':
      return {
        ...state,
        permissions: state.permissions.map(permission =>
          permission.permissionRequestId === action.permissionRequestId
            ? { ...permission, status: action.status }
            : permission,
        ),
        displayEvents: markToolPermissionStatus(
          state.displayEvents,
          action.permissionRequestId,
          action.status,
        ),
      }

    default:
      return state
  }
}

function upsertAssistantDelta(
  events: DisplayEvent[],
  itemId: string,
  text: string,
  context?: DisplayEventContractContext,
): DisplayEvent[] {
  const index = events.findIndex(event => event.id === itemId)
  if (index === -1) {
    return [
      ...events,
      {
        id: itemId,
        type: 'assistant_message',
        text,
        status: 'streaming',
        identity: context ? createDisplayEventIdentity(context) : undefined,
      },
    ]
  }

  return events.map((event, eventIndex) =>
    eventIndex === index
      ? { ...event, text: `${event.text}${text}`, status: 'streaming' }
      : event,
  )
}

function upsertThinkingDelta(
  events: DisplayEvent[],
  itemId: string,
  thinking: string,
  context?: DisplayEventContractContext,
): DisplayEvent[] {
  if (!thinking.trim()) {
    return events
  }

  const index = events.findIndex(event => event.id === itemId)
  if (index === -1) {
    return [
      ...events,
      {
        id: itemId,
        type: 'thinking_summary',
        text: `思考\n${thinking}`,
        status: 'streaming',
        identity: context ? createDisplayEventIdentity(context) : undefined,
      },
    ]
  }

  return events.map((event, eventIndex) =>
    eventIndex === index
      ? {
          ...event,
          type: 'thinking_summary',
          text: `${event.text}${thinking}`,
          status: 'streaming',
        }
      : event,
  )
}

function upsertCompletedItemMessage(
  events: DisplayEvent[],
  itemId: string,
  kind: string | undefined,
  content: unknown,
  statusText: string,
  context?: DisplayEventContractContext,
): DisplayEvent[] {
  const nextEvent = createDisplayEventFromCompletedItem(
    itemId,
    kind,
    content,
    statusText,
    context,
  )

  if (!nextEvent) {
    return events.map(event =>
      event.id === itemId ? { ...event, status: statusText } : event,
    )
  }

  const existing = events.find(event => event.id === itemId)
  if (existing) {
    return events.map(event =>
      event.id === itemId
        ? mergeCompletedDisplayEvent(event, nextEvent, statusText)
        : event,
    )
  }

  const toolLifecycleIndex = findMatchingToolLifecycleEventIndex(
    events,
    nextEvent,
  )
  if (toolLifecycleIndex !== -1) {
    return events.map((event, eventIndex) =>
      eventIndex === toolLifecycleIndex
        ? mergeToolLifecycleDisplayEvent(event, nextEvent, statusText)
        : event,
    )
  }

  if (shouldDropOrphanControlToolResult(nextEvent)) {
    return events
  }

  if (shouldDropOrphanProgress(nextEvent)) {
    return events
  }

  return [...events, nextEvent]
}

function mergeCompletedDisplayEvent(
  currentEvent: DisplayEvent,
  nextEvent: DisplayEvent,
  statusText: string,
): DisplayEvent {
  return {
    ...currentEvent,
    type: nextEvent.type,
    sourceKind: nextEvent.sourceKind,
    identity: nextEvent.identity ?? currentEvent.identity,
    todoSnapshot: nextEvent.todoSnapshot,
    toolSnapshot: nextEvent.toolSnapshot,
    status: statusText,
    text:
      nextEvent.type === 'assistant_message' && currentEvent.text.trim()
        ? currentEvent.text
        : nextEvent.text,
  }
}

function findMatchingToolLifecycleEventIndex(
  events: DisplayEvent[],
  nextEvent: DisplayEvent,
): number {
  const nextToolUseId = getToolLifecycleMatchId(nextEvent)
  const nextSnapshot = nextEvent.toolSnapshot
  if (
    !nextToolUseId ||
    !nextSnapshot ||
    (nextSnapshot.kind !== 'result' && nextSnapshot.kind !== 'progress')
  ) {
    return -1
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (isMatchingToolLifecycleTarget(event, nextToolUseId)) {
      return index
    }
  }

  return -1
}

function mergeToolLifecycleDisplayEvent(
  currentEvent: DisplayEvent,
  nextEvent: DisplayEvent,
  statusText: string,
): DisplayEvent {
  const currentSnapshot = currentEvent.toolSnapshot
  const nextSnapshot = nextEvent.toolSnapshot
  if (currentEvent.type === 'todo_list' && nextSnapshot) {
    return {
      ...currentEvent,
      status:
        nextSnapshot.status === 'failed'
          ? 'failed'
          : nextSnapshot.status || statusText,
    }
  }

  if (!currentSnapshot || !nextSnapshot) {
    return mergeCompletedDisplayEvent(currentEvent, nextEvent, statusText)
  }

  const status =
    nextSnapshot.status === 'failed' ? 'failed' : nextSnapshot.status || statusText

  return {
    ...currentEvent,
    type: 'tool_call',
    status,
    timelineHidden: currentEvent.timelineHidden,
    identity: currentEvent.identity ?? nextEvent.identity,
    toolSnapshot: mergeToolSnapshots(currentSnapshot, nextSnapshot, status),
  }
}

function mergeToolSnapshots(
  currentSnapshot: ToolSnapshot,
  nextSnapshot: ToolSnapshot,
  status: string,
): ToolSnapshot {
  const errorClass = nextSnapshot.errorClass ?? currentSnapshot.errorClass
  return {
    ...currentSnapshot,
    status,
    statusLabel: nextSnapshot.statusLabel ?? getToolStatusLabel(status),
    result: nextSnapshot.result ?? currentSnapshot.result,
    durationMs: nextSnapshot.durationMs ?? currentSnapshot.durationMs,
    completedAt: nextSnapshot.completedAt ?? currentSnapshot.completedAt,
    errorClass,
    errorMessage: nextSnapshot.errorMessage ?? currentSnapshot.errorMessage,
    actionableHint:
      nextSnapshot.actionableHint ??
      currentSnapshot.actionableHint ??
      getActionableHint(errorClass),
    raw: {
      call: currentSnapshot.raw,
      result: nextSnapshot.raw,
    },
  }
}

function markToolPermissionRequested(
  events: DisplayEvent[],
  permission: PermissionCard,
): DisplayEvent[] {
  if (!permission.toolUseId) {
    return events
  }

  return events.map(event => {
    const snapshot = event.toolSnapshot
    if (!snapshot || getToolUseId(event) !== permission.toolUseId) {
      return event
    }

    return {
      ...event,
      status: 'waiting_permission',
      toolSnapshot: {
        ...snapshot,
        status: 'waiting_permission',
        statusLabel: getToolStatusLabel('waiting_permission'),
        permissionRequestId: permission.permissionRequestId,
      },
    }
  })
}

function markToolPermissionStatus(
  events: DisplayEvent[],
  permissionRequestId: string,
  permissionStatus: PermissionCard['status'],
): DisplayEvent[] {
  const status = getToolStatusFromPermissionStatus(permissionStatus)
  return events.map(event => {
    const snapshot = event.toolSnapshot
    if (!snapshot || snapshot.permissionRequestId !== permissionRequestId) {
      return event
    }

    return {
      ...event,
      status,
      toolSnapshot: {
        ...snapshot,
        status,
        statusLabel: getToolStatusLabel(status),
        errorClass:
          status === 'denied'
            ? ('permission_denied' satisfies ToolErrorClass)
            : snapshot.errorClass,
        actionableHint:
          status === 'denied'
            ? getActionableHint('permission_denied')
            : snapshot.actionableHint,
      },
    }
  })
}

function getToolStatusFromPermissionStatus(
  status: PermissionCard['status'],
): string {
  if (status === 'pending') {
    return 'waiting_permission'
  }
  if (status === 'allowed') {
    return 'running'
  }
  if (status === 'denied') {
    return 'denied'
  }
  return 'cancelled'
}

function getToolUseId(event: DisplayEvent): string | undefined {
  return event.toolSnapshot?.identity?.toolUseId ?? event.identity?.toolUseId
}

function getParentToolUseId(event: DisplayEvent): string | undefined {
  return (
    event.toolSnapshot?.identity?.parentToolUseId ??
    event.identity?.parentToolUseId
  )
}

function getToolLifecycleMatchId(event: DisplayEvent): string | undefined {
  return getParentToolUseId(event) ?? getToolUseId(event)
}

function isMatchingToolLifecycleTarget(
  event: DisplayEvent,
  toolUseId: string,
): boolean {
  if (getToolUseId(event) !== toolUseId) {
    return false
  }

  if (event.timelineHidden || event.type === 'todo_list') {
    return true
  }

  return event.toolSnapshot?.kind === 'call'
}

function shouldDropOrphanControlToolResult(event: DisplayEvent): boolean {
  const snapshot = event.toolSnapshot
  return (
    event.type === 'tool_result' &&
    snapshot?.kind === 'result' &&
    snapshot.status === 'completed' &&
    isControlToolResultText(snapshot.result)
  )
}

function shouldDropOrphanProgress(event: DisplayEvent): boolean {
  return event.toolSnapshot?.kind === 'progress'
}
