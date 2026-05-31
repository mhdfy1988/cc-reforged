import type { SessionAction } from './sessionState.js'
import {
  createDisplayEventFromThreadDisplayProjection,
  createErrorDisplayEvent,
  createThreadDisplayProjectionProtocolErrorEvent,
  getThreadDisplayProjectionProtocolIssue,
} from '../domain/displayEvents.js'
import type {
  JsonObject,
  NotificationPayload,
  PermissionCard,
  PermissionInteractionKind,
  ThreadDisplayItem,
  ThreadDisplayPatch,
  ThreadDisplayPatchOperation,
  ThreadDisplaySnapshot,
  TurnRuntimeMetadata,
  TurnUsage,
} from '../domain/displayTypes.js'
import {
  createCompletedItemContractContext,
} from '../domain/eventContract.js'
import type { CcrDesktopEvent } from '../global.js'

export type RoutedDesktopEvent = {
  sessionActions: SessionAction[]
  itemMetadata?: {
    itemId: string
    item: JsonObject
  }
}

const STATUS_SNAPSHOT_REPLAY_MESSAGES = new Set([
  'permission responded',
  'runtime snapshots refreshed',
])

export function shouldReplayThreadDisplaySnapshotFromStatusEvent(
  event: CcrDesktopEvent,
  status: { threadDisplaySnapshot?: ThreadDisplaySnapshot | null } | null,
): boolean {
  if (event.type !== 'state' || !status?.threadDisplaySnapshot) {
    return false
  }

  const payload = getObjectRecord(event.payload)
  const message = typeof payload?.message === 'string' ? payload.message : ''
  return STATUS_SNAPSHOT_REPLAY_MESSAGES.has(message)
}

export function routeDesktopEvent(
  event: CcrDesktopEvent,
  itemMetadata: ReadonlyMap<string, JsonObject>,
): RoutedDesktopEvent {
  if (event.type !== 'notification') {
    return routeNonNotificationEvent(event)
  }

  const notification = event.payload as NotificationPayload
  const params = notification.params ?? {}

  switch (notification.method) {
    case 'turn/started':
      return {
        sessionActions: [
          {
            type: 'set-active-turn',
            turnId: String(params.turnId ?? 'pending'),
          },
          {
            type: 'merge-turn-metadata',
            metadata: getTurnMetadataFromParams(params, 'running'),
          },
        ],
      }

    case 'thread/display/patch':
      return {
        sessionActions: createThreadDisplayPatchActions(
          params as unknown as ThreadDisplayPatch,
        ),
      }

    case 'turn/completed':
      return {
        sessionActions: [
          {
            type: 'merge-turn-metadata',
            metadata: getTurnMetadataFromParams(params, 'completed'),
          },
          { type: 'set-active-turn', turnId: null },
          { type: 'clear-noninteractive-permissions' },
        ],
      }

    case 'turn/cancelled':
      return {
        sessionActions: [
          {
            type: 'merge-turn-metadata',
            metadata: getTurnMetadataFromParams(params, 'cancelled'),
          },
          { type: 'set-active-turn', turnId: null },
          { type: 'clear-permissions' },
        ],
      }

    default:
      return { sessionActions: [] }
  }
}

export function createThreadDisplayPatchActions(
  patch: ThreadDisplayPatch | null | undefined,
): SessionAction[] {
  if (!patch || !Array.isArray(patch.operations)) {
    return []
  }
  return patch.operations.flatMap(operation =>
    createThreadDisplayPatchOperationActions(patch, operation),
  )
}

export function createThreadDisplaySnapshotActions(
  snapshot: ThreadDisplaySnapshot | null | undefined,
): SessionAction[] {
  if (!snapshot || !Array.isArray(snapshot.items)) {
    return []
  }
  return snapshot.items.flatMap((item, sourceIndex) =>
    createThreadDisplayItemActions(item, 'history', snapshot, sourceIndex),
  )
}

function createThreadDisplayPatchOperationActions(
  patch: ThreadDisplayPatch,
  operation: ThreadDisplayPatchOperation,
): SessionAction[] {
  switch (operation.op) {
    case 'append_item':
      return createThreadDisplayItemActions(operation.item, 'live', patch)

    case 'update_item':
      return createThreadDisplayItemUpdateActions(patch, operation)

    case 'complete_item':
      return operation.item
        ? createThreadDisplayItemActions(
            {
              ...operation.item,
              status: operation.status ?? operation.item.status,
            },
            'live',
            patch,
          )
        : []

    case 'replace_active_stream':
      return operation.item
        ? createThreadDisplayItemActions(operation.item, 'live', patch)
        : []

    case 'update_counts':
      return []
  }
}

function createThreadDisplayItemUpdateActions(
  patch: ThreadDisplayPatch,
  operation: Extract<ThreadDisplayPatchOperation, { op: 'update_item' }>,
): SessionAction[] {
  const item = operation.item
  const metadata = getObjectRecord(item.metadata)

  if (
    item.status === 'cancelled' &&
    metadata?.coreEventType === 'permission_cancelled'
  ) {
    return [
      {
        type: 'set-permission-status',
        permissionRequestId: operation.itemId,
        status: 'cancelled',
      },
      {
        type: 'remove-permission',
        permissionRequestId: operation.itemId,
      },
    ]
  }

  if (metadata?.deltaMode !== 'append_text') {
    return isRenderableThreadDisplayItemUpdate(operation.item)
      ? createThreadDisplayItemActions(
          {
            ...operation.item,
            id: operation.item.id ?? operation.itemId,
          },
          'live',
          patch,
        )
      : []
  }

  const text = typeof item.text === 'string' ? item.text : ''
  if (!text) {
    return []
  }
  const context = createCompletedItemContractContext({
    itemId: operation.itemId,
    params: createThreadDisplayContextParams(
      {
        id: operation.itemId,
        type: item.type ?? 'assistant_message',
        text,
        status: item.status,
        metadata: item.metadata,
      },
      'live',
      patch,
    ),
  })

  return [
    isThinkingPatchItem(item)
      ? {
          type: 'upsert-thinking-delta',
          itemId: operation.itemId,
          thinking: text,
          context,
        }
      : {
          type: 'upsert-assistant-delta',
          itemId: operation.itemId,
          text,
          context,
        },
  ]
}

function isRenderableThreadDisplayItemUpdate(
  item: Partial<ThreadDisplayItem>,
): item is ThreadDisplayItem {
  return Boolean(
    (item.content !== undefined || item.projection !== undefined) &&
      item.type &&
      item.text !== undefined,
  )
}

function createThreadDisplayItemActions(
  item: ThreadDisplayItem,
  source: 'history' | 'live',
  owner: ThreadDisplayPatch | ThreadDisplaySnapshot,
  sourceIndex?: number,
): SessionAction[] {
  if (!item || !item.id) {
    return []
  }

  if (source === 'live' && item.type === 'user_message') {
    return []
  }

  const projectionIssue = getThreadDisplayProjectionProtocolIssue(item)
  if (projectionIssue) {
    return withThreadDisplayLifecycleActions(item, [
      {
        type: 'append-display-event',
        event: createThreadDisplayProjectionProtocolErrorEvent(
          item.id,
          item,
          projectionIssue,
          createCompletedItemContractContext({
            itemId: item.id,
            params: createThreadDisplayContextParams(
              item,
              source,
              owner,
              sourceIndex,
            ),
            item: item as unknown as JsonObject,
          }),
        ),
      },
    ])
  }

  if (item.type === 'permission_request') {
    const permission = createPermissionFromThreadDisplayItem(item)
    return withThreadDisplayLifecycleActions(
      item,
      permission ? [{ type: 'add-permission', permission }] : [],
    )
  }

  if (item.content !== undefined) {
    return withThreadDisplayLifecycleActions(
      item,
      createThreadDisplayCompletedItemActions(
        item,
        source,
        owner,
        sourceIndex,
      ),
    )
  }

  const event = createDisplayEventFromThreadDisplayProjection(
    item.id,
    item as unknown as JsonObject,
  )
  return withThreadDisplayLifecycleActions(
    item,
    event ? [{ type: 'append-display-event', event }] : [],
  )
}

function withThreadDisplayLifecycleActions(
  item: ThreadDisplayItem,
  actions: SessionAction[],
): SessionAction[] {
  const metadata = getObjectRecord(item.metadata)
  if (metadata?.coreEventType !== 'turn_failed') {
    return actions
  }

  return [
    {
      type: 'merge-turn-metadata',
      metadata: getTurnMetadataFromParams(
        compactObject({
          threadId: item.identity?.threadId,
          turnId: item.identity?.turnId,
          metadata: item.metadata,
        }),
        'failed',
      ),
    },
    { type: 'set-active-turn', turnId: null },
    { type: 'clear-permissions' },
    ...actions,
  ]
}

function createThreadDisplayCompletedItemActions(
  item: ThreadDisplayItem,
  source: 'history' | 'live',
  owner: ThreadDisplayPatch | ThreadDisplaySnapshot,
  sourceIndex?: number,
): SessionAction[] {
  const kind = getCompletedItemKindFromThreadDisplayItem(item)
  const statusText = item.status ?? 'completed'
  const context = createCompletedItemContractContext({
    itemId: item.id,
    params: createThreadDisplayContextParams(item, source, owner, sourceIndex),
    item: item as unknown as JsonObject,
  })
  return [
    {
      type: 'upsert-completed-item-message',
      itemId: item.id,
      kind,
      content: item.content,
      statusText,
      context,
    },
  ]
}

function createPermissionFromThreadDisplayItem(
  item: ThreadDisplayItem,
): PermissionCard | null {
  const content = getObjectRecord(item.content)
  const identity = item.identity
  return createPermissionCardFromPayload(
    compactObject({
      ...(content ?? {}),
      permissionRequestId: content?.permissionRequestId ?? item.id,
      threadId: content?.threadId ?? identity?.threadId,
      turnId: content?.turnId ?? identity?.turnId,
      toolUseId: content?.toolUseId ?? identity?.toolUseId,
      createdAt: content?.createdAt ?? item.createdAt,
    }),
    item.id,
  )
}

function createThreadDisplayContextParams(
  item: Pick<
    ThreadDisplayItem,
    'id' | 'type' | 'text' | 'status' | 'createdAt' | 'identity' | 'metadata'
  >,
  source: 'history' | 'live',
  owner: ThreadDisplayPatch | ThreadDisplaySnapshot,
  sourceIndex?: number,
): JsonObject {
  const ownerSessionId =
    'sessionId' in owner && typeof owner.sessionId === 'string'
      ? owner.sessionId
      : undefined
  return compactObject({
    source,
    threadId: item.identity?.threadId ?? owner.threadId,
    sessionId: item.identity?.sessionId ?? ownerSessionId,
    turnId: item.identity?.turnId,
    itemId: item.identity?.itemId ?? item.id,
    toolUseId: item.identity?.toolUseId,
    parentToolUseId: item.identity?.parentToolUseId,
    createdAt: item.createdAt,
    status: item.status,
    displayItemType: item.type,
    sourceIndex: item.identity?.sourceIndex ?? sourceIndex,
  })
}

function getCompletedItemKindFromThreadDisplayItem(
  item: ThreadDisplayItem,
): string | undefined {
  if (item.sourceKind) {
    return item.sourceKind
  }
  if (item.type === 'user_message') {
    return 'user_message'
  }
  if (
    item.type === 'tool_call' ||
    item.type === 'tool_result' ||
    item.type === 'file_change' ||
    item.type === 'todo_list'
  ) {
    return 'assistant'
  }
  if (item.type === 'assistant_message' || item.type === 'thinking_summary') {
    return 'assistant_message'
  }
  return item.type
}

function isThinkingPatchItem(item: Partial<ThreadDisplayItem>): boolean {
  if (item.type === 'thinking_summary') {
    return true
  }
  const delta = getObjectRecord(getObjectRecord(item.metadata)?.delta)
  const deltaType = typeof delta?.type === 'string' ? delta.type : ''
  return (
    deltaType === 'thinking' ||
    deltaType === 'thinking_summary' ||
    deltaType === 'redacted_thinking' ||
    deltaType === 'reasoning' ||
    deltaType === 'reasoning_summary' ||
    deltaType === 'summary_text'
  )
}

function routeNonNotificationEvent(event: CcrDesktopEvent): RoutedDesktopEvent {
  if (event.type !== 'client-error') {
    return { sessionActions: [] }
  }

  return {
    sessionActions: [
      { type: 'set-active-turn', turnId: null },
      {
        type: 'append-display-event',
        event: createErrorDisplayEvent(
          `${event.at}-client-error`,
          stringifyErrorPayload(event.payload),
        ),
      },
    ],
  }
}

export function createPermissionCardFromPayload(
  params: JsonObject,
  fallbackPermissionRequestId?: string,
): PermissionCard | null {
  const toolName = getToolName(params)
  const tool = getObjectRecord(params.tool)
  const permissionRequestId =
    getString(params.permissionRequestId) ?? fallbackPermissionRequestId
  if (!permissionRequestId) {
    return null
  }
  return {
    permissionRequestId,
    threadId: getString(params.threadId),
    turnId: getString(params.turnId),
    toolUseId: getString(
      params.toolUseId ?? params.toolUseID ?? params.tool_use_id,
    ),
    toolName,
    displayName: getString(
      params.displayName ??
        params.display_name ??
        params.title ??
        tool?.displayName ??
        tool?.display_name,
    ),
    description: getString(
      params.description ?? params.message ?? tool?.description,
    ),
    input: (params.input ?? {}) as JsonObject,
    permissionSuggestions: getArray(
      params.permissionSuggestions ?? params.permission_suggestions,
    ),
    blockedPath: getString(params.blockedPath ?? params.blocked_path),
    decisionReason: getString(params.decisionReason ?? params.decision_reason),
    agentId: getString(params.agentId ?? params.agent_id),
    createdAt: getString(params.createdAt),
    interactionKind: derivePermissionInteractionKind(toolName),
    status: 'pending',
  }
}

function getToolName(params: JsonObject): string {
  const tool = params.tool
  if (tool && typeof tool === 'object' && 'name' in tool) {
    return String((tool as JsonObject).name)
  }
  return (
    getString(params.toolName ?? params.tool_name ?? params.name) ?? '未知工具'
  )
}

function derivePermissionInteractionKind(
  toolName: string,
): PermissionInteractionKind {
  switch (toolName) {
    case 'AskUserQuestion':
      return 'ask_user_question'
    case 'ExitPlanMode':
    case 'ExitPlanModeV2':
      return 'plan_approval'
    case 'EnterPlanMode':
      return 'enter_plan_mode'
    case 'Bash':
    case 'PowerShell':
      return 'shell_permission'
    case 'FileEdit':
    case 'FileWrite':
    case 'FileRead':
    case 'Glob':
    case 'Grep':
    case 'NotebookEdit':
      return 'file_permission'
    case 'WebFetch':
      return 'web_fetch'
    case 'Skill':
      return 'skill'
    case 'ReviewArtifact':
    case 'ReviewArtifactTool':
      return 'review_artifact'
    case 'Workflow':
    case 'WorkflowTool':
      return 'workflow'
    case 'Monitor':
    case 'MonitorTool':
      return 'monitor'
    default:
      return 'fallback'
  }
}

function getTurnMetadataFromParams(
  params: JsonObject,
  status: string,
): TurnRuntimeMetadata {
  const nestedMetadata = getObjectRecord(params.metadata)
  const usage = normalizeUsage(nestedMetadata?.usage)
  return compactObject({
    threadId: getString(params.threadId),
    turnId: getString(params.turnId),
    status,
    provider: getString(params.provider ?? nestedMetadata?.provider),
    model: getString(params.model ?? nestedMetadata?.model),
    contextWindow: getNumber(nestedMetadata?.contextWindow),
    stopReason: getString(nestedMetadata?.stopReason),
    requestId: getString(nestedMetadata?.requestId),
    latencyMs: getNumber(nestedMetadata?.latencyMs),
    timeToFirstTokenMs: getNumber(nestedMetadata?.timeToFirstTokenMs),
    startedAt: getNullableString(nestedMetadata?.startedAt),
    completedAt: getNullableString(nestedMetadata?.completedAt),
    errorKind: getString(nestedMetadata?.errorKind),
    ...(usage ? { usage } : {}),
  }) as TurnRuntimeMetadata
}

function normalizeUsage(value: unknown): TurnUsage | undefined {
  const usage = getObjectRecord(value)
  if (!usage) {
    return undefined
  }
  return compactObject({
    inputTokens: getNumber(usage.inputTokens),
    outputTokens: getNumber(usage.outputTokens),
    totalTokens: getNumber(usage.totalTokens),
    cacheCreationInputTokens: getNumber(usage.cacheCreationInputTokens),
    cacheReadInputTokens: getNumber(usage.cacheReadInputTokens),
  }) as TurnUsage
}

function getObjectRecord(value: unknown): JsonObject | null {
  return value && typeof value === 'object' ? (value as JsonObject) : null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

function getNullableString(value: unknown): string | null | undefined {
  return value === null ? null : getString(value)
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function compactObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
  )
}

function stringifyErrorPayload(payload: unknown): string {
  if (!payload) {
    return '未知错误'
  }
  if (typeof payload === 'string') {
    return payload
  }
  if (payload instanceof Error) {
    return payload.message
  }
  if (typeof payload === 'object') {
    const object = payload as JsonObject
    if (typeof object.message === 'string') {
      return object.message
    }
    if (typeof object.kind === 'string') {
      return object.kind
    }
  }
  return JSON.stringify(payload)
}
