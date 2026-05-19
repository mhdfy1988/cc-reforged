import type { SessionAction } from './sessionState.js'
import {
  createErrorDisplayEvent,
  createSystemNoticeEvent,
} from '../domain/displayEvents.js'
import type {
  JsonObject,
  NotificationPayload,
  PermissionInteractionKind,
  TurnRuntimeMetadata,
  TurnUsage,
} from '../domain/displayTypes.js'
import { normalizeContentBlocks } from '../domain/contentBlocks.js'
import {
  createCompletedItemContractContext,
  withContentBlock,
} from '../domain/eventContract.js'
import type { CcrDesktopEvent } from '../global.js'

export type RoutedDesktopEvent = {
  sessionActions: SessionAction[]
  itemMetadata?: {
    itemId: string
    item: JsonObject
  }
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

    case 'item/started':
      return routeItemStarted(params)

    case 'item/delta':
      return routeItemDelta(event, params, itemMetadata)

    case 'item/completed':
      return routeItemCompleted(params, itemMetadata)

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

    case 'turn/failed':
      return {
        sessionActions: [
          {
            type: 'merge-turn-metadata',
            metadata: getTurnMetadataFromParams(params, 'failed'),
          },
          { type: 'set-active-turn', turnId: null },
          { type: 'clear-permissions' },
          {
            type: 'append-display-event',
            event: createErrorDisplayEvent(
              `${event.at}-turn-failed`,
              stringifyErrorPayload(params.error ?? params),
            ),
          },
        ],
      }

    case 'context/compacted':
      return {
        sessionActions: [
          {
            type: 'append-display-event',
            event: createSystemNoticeEvent(
              `${event.at}-context-compacted`,
              formatCompactNotification(params),
            ),
          },
        ],
      }

    case 'permission/requested': {
      const toolName = getToolName(params)
      const tool = getObjectRecord(params.tool)
      const permissionRequestId =
        getString(params.permissionRequestId) ?? `${event.at}-permission`
      return {
        sessionActions: [
          {
            type: 'add-permission',
            permission: {
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
              decisionReason: getString(
                params.decisionReason ?? params.decision_reason,
              ),
              agentId: getString(params.agentId ?? params.agent_id),
              createdAt: getString(params.createdAt),
              interactionKind: derivePermissionInteractionKind(toolName),
              status: 'pending',
            },
          },
        ],
      }
    }

    case 'permission/cancelled':
      return {
        sessionActions: [
          {
            type: 'set-permission-status',
            permissionRequestId: String(params.permissionRequestId ?? ''),
            status: 'cancelled',
          },
          {
            type: 'remove-permission',
            permissionRequestId: String(params.permissionRequestId ?? ''),
          },
        ],
      }

    default:
      return { sessionActions: [] }
  }
}

function formatCompactNotification(params: JsonObject): string {
  const metadata = getObjectRecord(params.metadata)
  const result = getObjectRecord(params.result)
  const messageCount = getNumber(metadata?.messageCount ?? result?.messageCount)
  const compactBoundaryCount = getNumber(
    metadata?.compactBoundaryCount ?? result?.compactBoundaryCount,
  )
  const attachmentCount = getNumber(
    result?.attachmentCount ?? metadata?.attachmentCount,
  )
  if (messageCount !== undefined) {
    const attachmentSummary =
      typeof attachmentCount === 'number' && attachmentCount > 0
        ? `，并恢复 ${attachmentCount} 个上下文附件`
        : ''
    return `已压缩上下文：当前保留 ${messageCount} 条消息，压缩边界 ${compactBoundaryCount ?? 0} 个${attachmentSummary}。`
  }
  if (typeof attachmentCount === 'number' && attachmentCount > 0) {
    return `已压缩上下文，并恢复 ${attachmentCount} 个上下文附件。`
  }
  return '已压缩上下文，运行状态已刷新。'
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

function routeItemStarted(params: JsonObject): RoutedDesktopEvent {
  const item = params.item
  if (!item || typeof item !== 'object') {
    return { sessionActions: [] }
  }

  const object = item as JsonObject
  const itemId = String(object.itemId ?? '')
  if (!itemId) {
    return { sessionActions: [] }
  }

  return {
    sessionActions: [],
    itemMetadata: {
      itemId,
      item: object,
    },
  }
}

function routeItemDelta(
  event: CcrDesktopEvent,
  params: JsonObject,
  itemMetadata: ReadonlyMap<string, JsonObject>,
): RoutedDesktopEvent {
  const itemId = String(params.itemId ?? `${event.at}-assistant`)
  const delta = (params.delta ?? {}) as JsonObject
  const sessionActions: SessionAction[] = []

  if (delta.type === 'text' && typeof delta.text === 'string') {
    sessionActions.push({
      type: 'upsert-assistant-delta',
      itemId,
      text: delta.text,
      context: createCompletedItemContractContext({
        itemId,
        params,
        item: itemMetadata.get(itemId),
      }),
    })
  }

  const thinkingSummary = getThinkingSummaryDelta(delta)
  if (thinkingSummary) {
    sessionActions.push({
      type: 'upsert-thinking-delta',
      itemId,
      thinking: thinkingSummary,
      context: createCompletedItemContractContext({
        itemId,
        params,
        item: itemMetadata.get(itemId),
      }),
    })
  }

  return { sessionActions }
}

function getThinkingSummaryDelta(delta: JsonObject): string | null {
  const type = typeof delta.type === 'string' ? delta.type : ''
  if (
    type !== 'thinking_summary' &&
    type !== 'reasoning_summary' &&
    type !== 'summary_text'
  ) {
    return null
  }

  const text = getStringDelta(delta.text ?? delta.thinking ?? delta.summary)
  return text && text.trim() ? text : null
}

function routeItemCompleted(
  params: JsonObject,
  itemMetadata: ReadonlyMap<string, JsonObject>,
): RoutedDesktopEvent {
  const itemId = String(params.itemId ?? '')
  if (!itemId) {
    return { sessionActions: [] }
  }

  const metadata = itemMetadata.get(itemId)
  const kind =
    metadata && typeof metadata.kind === 'string' ? metadata.kind : undefined
  const content =
    'content' in params
      ? params.content
      : metadata && 'content' in metadata
        ? metadata.content
        : undefined
  const statusText = String(params.status ?? 'completed')
  const context = createCompletedItemContractContext({
    itemId,
    params,
    item: metadata,
  })
  const blocks = normalizeContentBlocks(content)

  if (shouldSplitCompletedItemBlocks(blocks)) {
    return {
      sessionActions: blocks.map((block, contentIndex) => ({
        type: 'upsert-completed-item-message',
        itemId: createSplitCompletedItemId(itemId, block, contentIndex),
        kind,
        content: [block],
        statusText,
        context: withContentBlock(context, block, contentIndex),
      })),
    }
  }

  return {
    sessionActions: [
      {
        type: 'upsert-completed-item-message',
        itemId,
        kind,
        content,
        statusText,
        context,
      },
    ],
  }
}

function shouldSplitCompletedItemBlocks(blocks: JsonObject[]): boolean {
  return blocks.length > 1 && blocks.some(isToolLifecycleBlock)
}

function isToolLifecycleBlock(block: JsonObject): boolean {
  const type = typeof block.type === 'string' ? block.type : ''
  return type === 'tool_use' || type === 'tool_result' || type === 'progress'
}

function createSplitCompletedItemId(
  itemId: string,
  block: JsonObject,
  contentIndex: number,
): string {
  const lifecycleId = getString(
    block.id ??
      block.toolUseId ??
      block.toolUseID ??
      block.tool_use_id ??
      block.parentToolUseId ??
      block.parentToolUseID ??
      block.parent_tool_use_id,
  )
  const suffix = lifecycleId
    ? sanitizeItemIdPart(lifecycleId)
    : String(contentIndex)
  return `${itemId}:${contentIndex}:${suffix}`
}

function sanitizeItemIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80)
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

function getStringDelta(value: unknown): string | null {
  return typeof value === 'string' ? value : null
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
