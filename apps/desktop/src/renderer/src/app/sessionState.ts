import {
  chatMessageToDisplayEvent,
  createDisplayEventFromCompletedItem,
  createSystemNoticeEvent,
  displayEventToChatMessage,
  type DisplayEvent,
} from '../domain/displayEvents.js'
import type {
  ChatMessage,
  JsonObject,
  PermissionCard,
  TurnRuntimeMetadata,
} from '../domain/displayTypes.js'
import {
  createDisplayEventIdentity,
  type DisplayEventContractContext,
} from '../domain/eventContract.js'
import { extractFileDisplaySnapshotsFromToolSnapshot } from '../domain/fileEvents.js'
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
  | { type: 'reset-session'; notice?: string; noticeId?: string }
  | {
      type: 'replace-messages'
      messages: ChatMessage[]
      notice?: string
      noticeId?: string
    }
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
  | { type: 'clear-noninteractive-permissions' }
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
    if (turnId === state.activeTurnId) {
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
    case 'reset-session':
      return createResetSessionState(action.notice, action.noticeId)

    case 'replace-messages':
      return createReplacedMessageState(
        action.messages,
        action.notice,
        action.noticeId,
      )

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
      {
        const displayEvents = markPendingPermissionsOnEvents(
          upsertCompletedItemMessage(
            state.displayEvents,
            action.itemId,
            action.kind,
            action.content,
            action.statusText,
            action.context,
          ),
          state.permissions,
        )
        return {
          ...state,
          displayEvents,
          permissions: syncInternalPlanDraftsWithPermissions(
            displayEvents,
            state.permissions,
          ),
        }
      }

    case 'set-active-turn':
      return {
        ...state,
        activeTurnId: action.turnId,
      }

    case 'merge-turn-metadata':
      {
        const turnMetadata = {
          ...(state.turnMetadata ?? {}),
          ...action.metadata,
          usage: {
            ...(state.turnMetadata?.usage ?? {}),
            ...(action.metadata.usage ?? {}),
          },
        }
        const terminalToolStatus = getTerminalToolStatus(
          action.metadata.status,
        )
        return {
          ...state,
          turnMetadata,
          displayEvents: terminalToolStatus
            ? markRunningToolsForTerminalTurn(
                state.displayEvents,
                action.metadata.turnId ?? state.activeTurnId,
                terminalToolStatus,
              )
            : state.displayEvents,
        }
      }

    case 'clear-permissions':
      return {
        ...state,
        permissions: [],
      }

    case 'clear-noninteractive-permissions':
      return {
        ...state,
        permissions: state.permissions.filter(shouldKeepAfterTurnCompleted),
      }

    case 'add-permission':
      {
        const resolvedPermission = resolvePermissionAnchorFromEvents(
          state.displayEvents,
          action.permission,
          state.permissions,
        )
        const permissions = syncInternalPlanDraftsWithPermissions(
          state.displayEvents,
          [resolvedPermission, ...state.permissions],
        )
        return {
          ...state,
          permissions,
          displayEvents: markToolPermissionRequested(
            state.displayEvents,
            resolvedPermission,
          ),
        }
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

function createResetSessionState(
  notice?: string,
  noticeId?: string,
): SessionState {
  if (!notice) {
    return {
      displayEvents: [],
      permissions: [],
      activeTurnId: null,
      turnMetadata: null,
    }
  }

  return {
    displayEvents: [
      createSystemNoticeEvent(
        noticeId ?? `session-reset-${Date.now()}`,
        notice,
      ),
    ],
    permissions: [],
    activeTurnId: null,
    turnMetadata: null,
  }
}

function createReplacedMessageState(
  messages: ChatMessage[],
  notice?: string,
  noticeId?: string,
): SessionState {
  return {
    displayEvents: [
      ...(notice
        ? [
            createSystemNoticeEvent(
              noticeId ?? `session-replaced-${Date.now()}`,
              notice,
            ),
          ]
        : []),
      ...messages.map(message => chatMessageToDisplayEvent(message)),
    ],
    permissions: [],
    activeTurnId: null,
    turnMetadata: null,
  }
}

function shouldKeepAfterTurnCompleted(permission: PermissionCard): boolean {
  if (permission.status !== 'pending') {
    return false
  }

  return (
    permission.interactionKind === 'ask_user_question' ||
    permission.interactionKind === 'plan_approval' ||
    permission.interactionKind === 'enter_plan_mode' ||
    permission.toolName === 'AskUserQuestion' ||
    permission.toolName === 'ExitPlanMode' ||
    permission.toolName === 'ExitPlanModeV2' ||
    permission.toolName === 'EnterPlanMode'
  )
}

type InternalPlanDraft = {
  path: string
  status: string
  planSeriesId?: string
  toolUseId?: string
  eventIndex: number
  threadId?: string
  turnId?: string
}

type PlanPermissionAnchor = {
  permission: PermissionCard
  permissionIndex: number
  anchorIndex: number
  planSeriesId?: string
}

function syncInternalPlanDraftsWithPermissions(
  events: DisplayEvent[],
  permissions: PermissionCard[],
): PermissionCard[] {
  const draftAssignments = assignInternalPlanDrafts(events, permissions)
  return permissions.map(permission =>
    applyInternalPlanDraftToPermission(
      permission,
      draftAssignments.get(permission.permissionRequestId),
    ),
  )
}

function applyInternalPlanDraftToPermission(
  permission: PermissionCard,
  draft: InternalPlanDraft | undefined,
): PermissionCard {
  if (!draft) {
    return permission
  }
  const nextInput = {
    ...permission.input,
    internalPlanDraftPath: draft.path,
    internalPlanDraftStatus: draft.status,
    ...(draft.planSeriesId ? { internalPlanSeriesId: draft.planSeriesId } : {}),
    ...(draft.toolUseId ? { internalPlanDraftToolUseId: draft.toolUseId } : {}),
  }
  if (
    nextInput.internalPlanDraftPath === permission.input.internalPlanDraftPath &&
    nextInput.internalPlanDraftStatus ===
      permission.input.internalPlanDraftStatus &&
    nextInput.internalPlanSeriesId === permission.input.internalPlanSeriesId &&
    nextInput.internalPlanDraftToolUseId ===
      permission.input.internalPlanDraftToolUseId
  ) {
    return permission
  }

  return {
    ...permission,
    input: nextInput,
  }
}

function isPlanApprovalPermission(permission: PermissionCard): boolean {
  return (
    permission.interactionKind === 'plan_approval' ||
    permission.toolName === 'ExitPlanMode' ||
    permission.toolName === 'ExitPlanModeV2'
  )
}

function assignInternalPlanDrafts(
  events: DisplayEvent[],
  permissions: PermissionCard[],
): Map<string, InternalPlanDraft> {
  const drafts = collectInternalPlanDrafts(events)
  const anchors = permissions
    .map((permission, permissionIndex): PlanPermissionAnchor | null => {
      if (!isPlanApprovalPermission(permission)) {
        return null
      }
      const anchorIndex = getPlanPermissionAnchorIndex(events, permission)
      return {
        permission,
        permissionIndex,
        anchorIndex,
        planSeriesId:
          getPermissionPlanSeriesId(permission) ??
          getPlanSeriesIdFromEvent(events[anchorIndex]),
      }
    })
    .filter((anchor): anchor is PlanPermissionAnchor => Boolean(anchor))
    .sort(
      (left, right) =>
        left.anchorIndex - right.anchorIndex ||
        left.permissionIndex - right.permissionIndex,
    )

  if (drafts.length === 0 || anchors.length === 0) {
    return new Map()
  }

  const assignments = new Map<string, InternalPlanDraft>()
  const usedDraftIndexes = new Set<number>()
  const lastAnchorIndexByScope = new Map<string, number>()

  for (const anchor of anchors) {
    if (anchor.planSeriesId) {
      const draftIndex = findDraftIndexByPlanSeriesId(
        drafts,
        anchor.permission,
        anchor.planSeriesId,
      )
      if (draftIndex !== -1) {
        assignments.set(
          anchor.permission.permissionRequestId,
          drafts[draftIndex],
        )
        usedDraftIndexes.add(draftIndex)
        continue
      }
    }

    const scopeKey = getPermissionScopeKey(anchor.permission)
    const lowerBound = lastAnchorIndexByScope.get(scopeKey) ?? -1
    const draftIndex = findDraftIndexForPlanPermission(
      drafts,
      anchor.permission,
      anchor.anchorIndex,
      lowerBound,
      usedDraftIndexes,
    )
    if (draftIndex !== -1) {
      assignments.set(
        anchor.permission.permissionRequestId,
        drafts[draftIndex],
      )
      usedDraftIndexes.add(draftIndex)
    }
    lastAnchorIndexByScope.set(
      scopeKey,
      Math.max(lowerBound, anchor.anchorIndex),
    )
  }

  return assignments
}

function collectInternalPlanDrafts(events: DisplayEvent[]): InternalPlanDraft[] {
  return events.flatMap((event, eventIndex): InternalPlanDraft[] => {
    const snapshot = event.toolSnapshot
    if (!snapshot || !isInternalPlanDraftWrite(snapshot)) {
      return []
    }

    const path = getInternalPlanDraftPath(event)
    if (!path) {
      return []
    }
    return [
      {
        path,
        status: snapshot.status || event.status || 'unknown',
        planSeriesId:
          getPlanSeriesIdFromToolSnapshot(snapshot) ??
          getPlanSeriesIdFromPath(path),
        toolUseId: getToolUseId(event),
        eventIndex,
        threadId: event.identity?.threadId ?? snapshot.identity?.threadId,
        turnId: event.identity?.turnId ?? snapshot.identity?.turnId,
      },
    ]
  })
}

function findDraftIndexByPlanSeriesId(
  drafts: InternalPlanDraft[],
  permission: PermissionCard,
  planSeriesId: string,
): number {
  for (let index = drafts.length - 1; index >= 0; index -= 1) {
    const draft = drafts[index]
    if (
      draft.planSeriesId === planSeriesId &&
      isDraftInPermissionScope(draft, permission)
    ) {
      return index
    }
  }
  return -1
}

function findDraftIndexForPlanPermission(
  drafts: InternalPlanDraft[],
  permission: PermissionCard,
  anchorIndex: number,
  lowerBound: number,
  usedDraftIndexes: Set<number>,
): number {
  for (let index = drafts.length - 1; index >= 0; index -= 1) {
    const draft = drafts[index]
    if (
      usedDraftIndexes.has(index) ||
      draft.eventIndex > anchorIndex ||
      draft.eventIndex <= lowerBound ||
      !isDraftInPermissionScope(draft, permission)
    ) {
      continue
    }
    return index
  }
  return -1
}

function getPlanPermissionAnchorIndex(
  events: DisplayEvent[],
  permission: PermissionCard,
): number {
  if (permission.toolUseId) {
    const index = events.findIndex(
      event => getToolUseId(event) === permission.toolUseId,
    )
    if (index !== -1) {
      return index
    }
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    const snapshot = event.toolSnapshot
    if (
      event.type === 'tool_call' &&
      snapshot?.kind === 'call' &&
      snapshot.name === permission.toolName &&
      isInPermissionScope(event, permission)
    ) {
      return index
    }
  }
  return events.length
}

function getPermissionScopeKey(permission: PermissionCard): string {
  return [
    permission.threadId ?? '*',
    permission.turnId ?? '*',
  ].join(':')
}

function getPermissionPlanSeriesId(
  permission: PermissionCard,
): string | undefined {
  return getPlanSeriesIdFromInput(permission.input)
}

function getPlanSeriesIdFromEvent(
  event: DisplayEvent | undefined,
): string | undefined {
  if (!event) {
    return undefined
  }
  return (
    getPlanSeriesIdFromToolSnapshot(event.toolSnapshot) ??
    (event.fileToolSnapshot?.path
      ? getPlanSeriesIdFromPath(event.fileToolSnapshot.path)
      : undefined) ??
    (event.fileSnapshot?.path
      ? getPlanSeriesIdFromPath(event.fileSnapshot.path)
      : undefined)
  )
}

function getPlanSeriesIdFromToolSnapshot(
  snapshot: ToolSnapshot | undefined,
): string | undefined {
  if (!snapshot?.input || typeof snapshot.input !== 'object') {
    return snapshot?.target ? getPlanSeriesIdFromPath(snapshot.target) : undefined
  }

  const input = snapshot.input as JsonObject
  return (
    getPlanSeriesIdFromInput(input) ??
    (snapshot.target ? getPlanSeriesIdFromPath(snapshot.target) : undefined)
  )
}

function getPlanSeriesIdFromInput(input: JsonObject): string | undefined {
  const explicit = getStringFromObject(input, [
    'planSeriesId',
    'plan_series_id',
    'internalPlanSeriesId',
  ])
  if (explicit) {
    return explicit
  }

  const path = getStringFromObject(input, [
    'planFilePath',
    'plan_file_path',
    'internalPlanDraftPath',
    'filePath',
    'file_path',
    'path',
  ])
  return path ? getPlanSeriesIdFromPath(path) : undefined
}

function getPlanSeriesIdFromPath(path: string): string | undefined {
  const normalized = path.replace(/\\/g, '/')
  if (!isInternalPlanDraftPath(normalized)) {
    return undefined
  }

  const filename = normalized.split('/').filter(Boolean).at(-1) ?? ''
  const stem = filename.replace(/\.md$/i, '')
  if (!stem) {
    return undefined
  }

  const agentMarker = '-agent-'
  const markerIndex = stem.indexOf(agentMarker)
  if (markerIndex === -1) {
    return stem
  }

  const planSlug = stem.slice(0, markerIndex)
  const agentId = stem.slice(markerIndex + agentMarker.length)
  return planSlug && agentId ? `${planSlug}:agent:${agentId}` : stem
}

function isDraftInPermissionScope(
  draft: InternalPlanDraft,
  permission: PermissionCard,
): boolean {
  if (
    permission.threadId &&
    draft.threadId &&
    permission.threadId !== draft.threadId
  ) {
    return false
  }
  if (permission.turnId && draft.turnId && permission.turnId !== draft.turnId) {
    return false
  }
  return true
}

function isInPermissionScope(
  event: DisplayEvent,
  permission: PermissionCard,
): boolean {
  const eventThreadId =
    event.identity?.threadId ?? event.toolSnapshot?.identity?.threadId
  if (
    permission.threadId &&
    eventThreadId &&
    permission.threadId !== eventThreadId
  ) {
    return false
  }

  const eventTurnId =
    event.identity?.turnId ?? event.toolSnapshot?.identity?.turnId
  if (
    permission.turnId &&
    eventTurnId &&
    permission.turnId !== eventTurnId
  ) {
    return false
  }

  return true
}

function isInternalPlanDraftWrite(snapshot: ToolSnapshot): boolean {
  if (snapshot.kind !== 'call' || snapshot.name !== 'Write') {
    return false
  }
  const path = getToolPath(snapshot)
  return Boolean(path && isInternalPlanDraftPath(path))
}

function getInternalPlanDraftPath(event: DisplayEvent): string | undefined {
  return (
    event.fileToolSnapshot?.path ??
    event.fileSnapshot?.path ??
    getToolPath(event.toolSnapshot)
  )
}

function getToolPath(snapshot: ToolSnapshot | undefined): string | undefined {
  if (!snapshot) {
    return undefined
  }

  if (typeof snapshot.target === 'string' && snapshot.target.trim()) {
    return snapshot.target
  }

  if (!snapshot.input || typeof snapshot.input !== 'object') {
    return undefined
  }

  const input = snapshot.input as JsonObject
  return getStringFromObject(input, ['file_path', 'filePath', 'path'])
}

function getStringFromObject(
  input: JsonObject,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function isInternalPlanDraftPath(path: string): boolean {
  return /(?:^|\/)\.ccr\/plans\/[^/]+\.md$/i.test(path.replace(/\\/g, '/'))
}

function getTerminalToolStatus(
  turnStatus: string | undefined,
): 'interrupted' | 'failed' | undefined {
  if (
    turnStatus === 'cancelled' ||
    turnStatus === 'canceled' ||
    turnStatus === 'interrupted'
  ) {
    return 'interrupted'
  }
  if (turnStatus === 'failed' || turnStatus === 'error') {
    return 'failed'
  }
  return undefined
}

function markRunningToolsForTerminalTurn(
  events: DisplayEvent[],
  turnId: string | undefined | null,
  status: 'interrupted' | 'failed',
): DisplayEvent[] {
  return events.map(event =>
    shouldFinalizeRunningToolEvent(event, turnId)
      ? finalizeRunningToolEvent(event, status)
      : event,
  )
}

function shouldFinalizeRunningToolEvent(
  event: DisplayEvent,
  turnId: string | undefined | null,
): boolean {
  const snapshot = event.toolSnapshot
  if (!snapshot) {
    return false
  }

  if (
    !isRunningToolStatus(snapshot.status) &&
    !isRunningToolStatus(event.status)
  ) {
    return false
  }

  const eventTurnId = snapshot.identity?.turnId ?? event.identity?.turnId
  if (turnId && eventTurnId !== turnId) {
    return false
  }

  return true
}

function finalizeRunningToolEvent(
  event: DisplayEvent,
  status: 'interrupted' | 'failed',
): DisplayEvent {
  const snapshot = event.toolSnapshot
  if (!snapshot) {
    return event
  }

  const errorClass =
    status === 'failed'
      ? (snapshot.errorClass ?? ('unknown_failure' satisfies ToolErrorClass))
      : snapshot.errorClass
  return {
    ...event,
    status,
    toolSnapshot: {
      ...snapshot,
      status,
      statusLabel: getToolStatusLabel(status),
      errorClass,
      actionableHint:
        status === 'failed'
          ? (snapshot.actionableHint ?? getActionableHint(errorClass))
          : snapshot.actionableHint,
    },
    fileToolSnapshot: event.fileToolSnapshot
      ? { ...event.fileToolSnapshot, status }
      : event.fileToolSnapshot,
  }
}

function isRunningToolStatus(status: string | undefined): boolean {
  return (
    status === 'preparing' ||
    status === 'waiting_permission' ||
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending'
  )
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
    const existing = events.find(event => event.id === itemId)
    if (
      existing?.type === 'assistant_message' &&
      !existing.text.trim() &&
      kind === 'assistant_message'
    ) {
      return events.filter(event => event.id !== itemId)
    }
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

  if (isOrphanToolResult(nextEvent)) {
    return [...events, createOrphanToolResultEvent(nextEvent)]
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
    fileToolSnapshot:
      nextEvent.fileToolSnapshot ?? currentEvent.fileToolSnapshot,
    fileSnapshot: nextEvent.fileSnapshot ?? currentEvent.fileSnapshot,
    attachmentSnapshot:
      nextEvent.attachmentSnapshot ?? currentEvent.attachmentSnapshot,
    attachmentSnapshots:
      nextEvent.attachmentSnapshots ?? currentEvent.attachmentSnapshots,
    referenceSnapshot:
      nextEvent.referenceSnapshot ?? currentEvent.referenceSnapshot,
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
    !nextSnapshot ||
    (nextSnapshot.kind !== 'result' && nextSnapshot.kind !== 'progress')
  ) {
    return -1
  }

  if (nextToolUseId) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (isMatchingToolLifecycleTarget(event, nextToolUseId)) {
        return index
      }
    }
    return -1
  }

  const nextFallbackKey = getToolLifecycleFallbackKey(nextEvent)
  if (!nextFallbackKey) {
    return -1
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (isMatchingToolLifecycleFallbackTarget(event, nextFallbackKey)) {
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

  const mergedSnapshot = mergeToolSnapshots(currentSnapshot, nextSnapshot, status)
  const fileDisplaySnapshots =
    extractFileDisplaySnapshotsFromToolSnapshot(mergedSnapshot)

  return {
    ...currentEvent,
    type: 'tool_call',
    status,
    timelineHidden: status === 'failed' ? false : currentEvent.timelineHidden,
    identity: currentEvent.identity ?? nextEvent.identity,
    toolSnapshot: mergedSnapshot,
    attachmentSnapshots:
      nextEvent.attachmentSnapshots ?? currentEvent.attachmentSnapshots,
    ...fileDisplaySnapshots,
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

function resolvePermissionAnchorFromEvents(
  events: DisplayEvent[],
  permission: PermissionCard,
  existingPermissions: PermissionCard[] = [],
): PermissionCard {
  if (permission.toolUseId) {
    return permission
  }

  const matchedToolUseId = findRecentMatchingToolUseId(
    events,
    permission,
    existingPermissions,
  )
  if (!matchedToolUseId) {
    return permission
  }

  return {
    ...permission,
    toolUseId: matchedToolUseId,
  }
}

function findRecentMatchingToolUseId(
  events: DisplayEvent[],
  permission: PermissionCard,
  existingPermissions: PermissionCard[],
): string | undefined {
  const usedToolUseIds = new Set(
    existingPermissions
      .map(existingPermission => existingPermission.toolUseId)
      .filter((toolUseId): toolUseId is string => Boolean(toolUseId)),
  )

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    const snapshot = event.toolSnapshot
    if (
      event.type !== 'tool_call' ||
      snapshot?.kind !== 'call' ||
      !snapshot.name
    ) {
      continue
    }
    if (
      permission.turnId &&
      event.identity?.turnId &&
      permission.turnId !== event.identity.turnId
    ) {
      continue
    }
    if (snapshot.name !== permission.toolName) {
      continue
    }
    const toolUseId = getToolUseId(event)
    if (toolUseId && !usedToolUseIds.has(toolUseId)) {
      return toolUseId
    }
  }
  return undefined
}

function markPendingPermissionsOnEvents(
  events: DisplayEvent[],
  permissions: PermissionCard[],
): DisplayEvent[] {
  return permissions
    .filter(permission => permission.status === 'pending')
    .reduce(
      (currentEvents, permission) =>
        markToolPermissionRequested(currentEvents, permission),
      events,
    )
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
  return (
    event.toolSnapshot?.identity?.toolUseId ??
    getRawToolUseId(event.toolSnapshot?.raw) ??
    event.fileToolSnapshot?.toolUseId ??
    event.fileToolSnapshot?.identity?.toolUseId ??
    event.fileSnapshot?.toolUseId ??
    event.fileSnapshot?.identity?.toolUseId ??
    event.referenceSnapshot?.toolUseId ??
    event.referenceSnapshot?.identity?.toolUseId ??
    event.identity?.toolUseId
  )
}

function getRawToolUseId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const object = value as Record<string, unknown>
  const id =
    object.id ??
    object.toolUseId ??
    object.toolUseID ??
    object.tool_use_id
  return typeof id === 'string' && id.trim() ? id : undefined
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

function getToolLifecycleFallbackKey(event: DisplayEvent): string | undefined {
  const identity = event.toolSnapshot?.identity ?? event.identity
  if (
    !identity?.turnId ||
    !identity.itemId ||
    identity.contentIndex === undefined
  ) {
    return undefined
  }
  return [
    identity.threadId ?? '',
    identity.turnId,
    identity.itemId,
    String(identity.contentIndex),
  ].join(':')
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

function isMatchingToolLifecycleFallbackTarget(
  event: DisplayEvent,
  fallbackKey: string,
): boolean {
  return (
    event.toolSnapshot?.kind === 'call' &&
    getToolLifecycleFallbackKey(event) === fallbackKey
  )
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

function isOrphanToolResult(event: DisplayEvent): boolean {
  return event.type === 'tool_result' && event.toolSnapshot?.kind === 'result'
}

function createOrphanToolResultEvent(event: DisplayEvent): DisplayEvent {
  const snapshot = event.toolSnapshot
  if (!snapshot) {
    return event
  }

  const reason = getOrphanToolResultReason(event)
  return {
    ...event,
    text: reason,
    toolSnapshot: {
      ...snapshot,
      displayName: '孤立工具结果',
      summary: reason,
      actionableHint:
        '没有找到对应的工具调用，已保留原始结果供排查；不会按文件路径或最近卡片盲目合并。',
    },
  }
}

function getOrphanToolResultReason(event: DisplayEvent): string {
  const lifecycleId = getToolLifecycleMatchId(event)
  if (lifecycleId) {
    return `孤立工具结果：未找到对应 tool_use（${lifecycleId}）`
  }
  return '孤立工具结果：缺少 tool_use_id / parent_tool_use_id，无法安全合并到工具卡'
}
