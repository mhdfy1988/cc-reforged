import { randomUUID } from 'node:crypto'
import type { SDKControlPermissionRequest } from '../entrypoints/sdk/controlTypes.js'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import type { ToolUseContext } from '../Tool.js'
import { errorMessage } from '../utils/errors.js'
import {
  outputSchema as permissionPromptOutputSchema,
  permissionPromptToolResultToPermissionDecision,
  type Output as PermissionPromptToolOutput,
} from '../utils/permissions/PermissionPromptToolResultSchema.js'
import { hasPermissionsToUseTool } from '../utils/permissions/permissions.js'
import { CoreError } from './errors.js'
import {
  getCorePermissionSettingsSnapshot,
  updateCorePermissionSettings,
  type CorePermissionSettingsSnapshot,
  type CorePermissionSettingsUpdateInput,
} from './permissionSettingsCore.js'
import type {
  CoreEventEmitter,
  CoreJsonObject,
  CorePermissionRequest,
} from './types.js'

type PendingPermissionRequest = {
  request: CorePermissionRequest
  status: 'pending' | 'resolved' | 'cancelled'
  resolve(result: PermissionPromptToolOutput): void
  reject(error: unknown): void
  cleanup(): void
}

type RequestPermissionInput = {
  threadId: string
  turnId: string
  request: SDKControlPermissionRequest
  signal?: AbortSignal
}

type RespondPermissionInput = {
  permissionRequestId: string
  result: unknown
}

export class CorePermissionService {
  readonly #requests = new Map<string, PendingPermissionRequest>()

  constructor(
    private readonly options: {
      emit: CoreEventEmitter
    },
  ) {}

  createCanUseTool(input: {
    threadId: string
    turnId: string
  }): CanUseToolFn {
    return async (
      tool,
      toolInput,
      toolUseContext,
      assistantMessage,
      toolUseID,
      forceDecision,
    ) => {
      const mainPermissionResult =
        forceDecision ??
        (await hasPermissionsToUseTool(
          tool,
          toolInput,
          toolUseContext,
          assistantMessage,
          toolUseID,
        ))

      if (
        mainPermissionResult.behavior === 'allow' ||
        mainPermissionResult.behavior === 'deny'
      ) {
        return mainPermissionResult
      }

      try {
        const description = await describeTool(tool, toolInput, toolUseContext)
        const response = await this.requestPermission({
          threadId: input.threadId,
          turnId: input.turnId,
          signal: toolUseContext.abortController.signal,
          request: {
            subtype: 'can_use_tool',
            tool_name: tool.name,
            input: toolInput,
            permission_suggestions: mainPermissionResult.suggestions,
            blocked_path: mainPermissionResult.blockedPath,
            decision_reason: mainPermissionResult.message,
            display_name: tool.userFacingName(toolInput),
            tool_use_id: toolUseID,
            ...(toolUseContext.agentId
              ? { agent_id: toolUseContext.agentId }
              : {}),
            ...(description ? { description } : {}),
          },
        })

        return permissionPromptToolResultToPermissionDecision(
          response,
          tool,
          toolInput,
          toolUseContext,
        )
      } catch (error) {
        return permissionPromptToolResultToPermissionDecision(
          {
            behavior: 'deny',
            message: `Tool permission request failed: ${errorMessage(error)}`,
            toolUseID,
          },
          tool,
          toolInput,
          toolUseContext,
        )
      }
    }
  }

  requestPermission(
    input: RequestPermissionInput,
  ): Promise<PermissionPromptToolOutput> {
    const permissionRequestId = createPermissionRequestId()
    const request = toCorePermissionRequest(permissionRequestId, input)
    const signal = input.signal

    return new Promise<PermissionPromptToolOutput>((resolve, reject) => {
      const abortHandler = () => {
        this.cancelPermissionRequest(
          permissionRequestId,
          'permission_request_aborted',
        )
      }
      const cleanup = () => {
        signal?.removeEventListener('abort', abortHandler)
      }

      const pending: PendingPermissionRequest = {
        request,
        status: 'pending',
        resolve,
        reject,
        cleanup,
      }

      this.#requests.set(permissionRequestId, pending)
      signal?.addEventListener('abort', abortHandler, { once: true })
      this.options.emit({ type: 'permission_requested', request })
    })
  }

  respondPermission(input: RespondPermissionInput): { accepted: boolean } {
    const pending = this.#requests.get(input.permissionRequestId)
    if (!pending) {
      throw new CoreError(
        'permission_not_found',
        'Permission request not found.',
      )
    }
    if (pending.status !== 'pending') {
      throw new CoreError(
        'permission_not_pending',
        'Permission request is no longer pending.',
      )
    }

    let result: PermissionPromptToolOutput
    try {
      result = permissionPromptOutputSchema().parse(input.result)
    } catch (error) {
      throw new CoreError(
        'invalid_params',
        'Invalid permission response.',
        error instanceof Error ? error.message : String(error),
      )
    }
    pending.status = 'resolved'
    pending.cleanup()
    pending.resolve(result)
    return { accepted: true }
  }

  cancelForTurn(input: {
    threadId: string
    turnId: string
    reason: string
  }): void {
    for (const pending of this.#requests.values()) {
      if (
        pending.status !== 'pending' ||
        pending.request.threadId !== input.threadId ||
        pending.request.turnId !== input.turnId
      ) {
        continue
      }
      this.cancelPermissionRequest(
        pending.request.permissionRequestId,
        input.reason,
      )
    }
  }

  listPending(): CorePermissionRequest[] {
    return Array.from(this.#requests.values())
      .filter(request => request.status === 'pending')
      .map(request => request.request)
  }

  getSettingsSnapshot(): CorePermissionSettingsSnapshot {
    return getCorePermissionSettingsSnapshot()
  }

  updateSettings(
    input: CorePermissionSettingsUpdateInput,
  ): CorePermissionSettingsSnapshot {
    return updateCorePermissionSettings(input)
  }

  private cancelPermissionRequest(
    permissionRequestId: string,
    reason: string,
  ): void {
    const pending = this.#requests.get(permissionRequestId)
    if (!pending || pending.status !== 'pending') {
      return
    }

    pending.status = 'cancelled'
    pending.cleanup()
    pending.reject(new CoreError('turn_not_active', reason))
    this.options.emit({
      type: 'permission_cancelled',
      permissionRequestId,
      threadId: pending.request.threadId,
      turnId: pending.request.turnId,
      reason,
    })
  }
}

async function describeTool(
  tool: Parameters<CanUseToolFn>[0],
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
): Promise<string | undefined> {
  try {
    const appState = toolUseContext.getAppState()
    return await tool.description(input as never, {
      isNonInteractiveSession:
        toolUseContext.options.isNonInteractiveSession,
      toolPermissionContext: appState.toolPermissionContext,
      tools: toolUseContext.options.tools,
    })
  } catch {
    return tool.userFacingName(input)
  }
}

function toCorePermissionRequest(
  permissionRequestId: string,
  input: RequestPermissionInput,
): CorePermissionRequest {
  return {
    permissionRequestId,
    threadId: input.threadId,
    turnId: input.turnId,
    tool: {
      name: input.request.tool_name,
      ...(input.request.display_name
        ? { displayName: input.request.display_name }
        : {}),
      ...(input.request.description
        ? { description: input.request.description }
        : {}),
    },
    input: input.request.input as CoreJsonObject,
    ...(input.request.permission_suggestions
      ? {
          permissionSuggestions:
            input.request.permission_suggestions as readonly CoreJsonObject[],
        }
      : {}),
    ...(input.request.blocked_path
      ? { blockedPath: input.request.blocked_path }
      : {}),
    ...(input.request.decision_reason
      ? { decisionReason: input.request.decision_reason }
      : {}),
    toolUseId: input.request.tool_use_id,
    ...(input.request.agent_id ? { agentId: input.request.agent_id } : {}),
    createdAt: new Date().toISOString(),
  }
}

function createPermissionRequestId(): string {
  return `perm_${randomUUID()}`
}
