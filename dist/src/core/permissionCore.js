import { randomUUID } from 'node:crypto';
import { errorMessage } from '../utils/errors.js';
import { outputSchema as permissionPromptOutputSchema, permissionPromptToolResultToPermissionDecision, } from '../utils/permissions/PermissionPromptToolResultSchema.js';
import { hasPermissionsToUseTool } from '../utils/permissions/permissions.js';
import { CoreError } from './errors.js';
export class CorePermissionService {
    options;
    #requests = new Map();
    constructor(options) {
        this.options = options;
    }
    createCanUseTool(input) {
        return async (tool, toolInput, toolUseContext, assistantMessage, toolUseID, forceDecision) => {
            const mainPermissionResult = forceDecision ??
                (await hasPermissionsToUseTool(tool, toolInput, toolUseContext, assistantMessage, toolUseID));
            if (mainPermissionResult.behavior === 'allow' ||
                mainPermissionResult.behavior === 'deny') {
                return mainPermissionResult;
            }
            try {
                const description = await describeTool(tool, toolInput, toolUseContext);
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
                });
                return permissionPromptToolResultToPermissionDecision(response, tool, toolInput, toolUseContext);
            }
            catch (error) {
                return permissionPromptToolResultToPermissionDecision({
                    behavior: 'deny',
                    message: `Tool permission request failed: ${errorMessage(error)}`,
                    toolUseID,
                }, tool, toolInput, toolUseContext);
            }
        };
    }
    requestPermission(input) {
        const permissionRequestId = createPermissionRequestId();
        const request = toCorePermissionRequest(permissionRequestId, input);
        const signal = input.signal;
        return new Promise((resolve, reject) => {
            const abortHandler = () => {
                this.cancelPermissionRequest(permissionRequestId, 'permission_request_aborted');
            };
            const cleanup = () => {
                signal?.removeEventListener('abort', abortHandler);
            };
            const pending = {
                request,
                status: 'pending',
                resolve,
                reject,
                cleanup,
            };
            this.#requests.set(permissionRequestId, pending);
            signal?.addEventListener('abort', abortHandler, { once: true });
            this.options.emit({ type: 'permission_requested', request });
        });
    }
    respondPermission(input) {
        const pending = this.#requests.get(input.permissionRequestId);
        if (!pending) {
            throw new CoreError('permission_not_found', 'Permission request not found.');
        }
        if (pending.status !== 'pending') {
            throw new CoreError('permission_not_pending', 'Permission request is no longer pending.');
        }
        let result;
        try {
            result = permissionPromptOutputSchema().parse(input.result);
        }
        catch (error) {
            throw new CoreError('invalid_params', 'Invalid permission response.', error instanceof Error ? error.message : String(error));
        }
        pending.status = 'resolved';
        pending.cleanup();
        pending.resolve(result);
        return { accepted: true };
    }
    cancelForTurn(input) {
        for (const pending of this.#requests.values()) {
            if (pending.status !== 'pending' ||
                pending.request.threadId !== input.threadId ||
                pending.request.turnId !== input.turnId) {
                continue;
            }
            this.cancelPermissionRequest(pending.request.permissionRequestId, input.reason);
        }
    }
    listPending() {
        return Array.from(this.#requests.values())
            .filter(request => request.status === 'pending')
            .map(request => request.request);
    }
    cancelPermissionRequest(permissionRequestId, reason) {
        const pending = this.#requests.get(permissionRequestId);
        if (!pending || pending.status !== 'pending') {
            return;
        }
        pending.status = 'cancelled';
        pending.cleanup();
        pending.reject(new CoreError('turn_not_active', reason));
        this.options.emit({
            type: 'permission_cancelled',
            permissionRequestId,
            threadId: pending.request.threadId,
            turnId: pending.request.turnId,
            reason,
        });
    }
}
async function describeTool(tool, input, toolUseContext) {
    try {
        const appState = toolUseContext.getAppState();
        return await tool.description(input, {
            isNonInteractiveSession: toolUseContext.options.isNonInteractiveSession,
            toolPermissionContext: appState.toolPermissionContext,
            tools: toolUseContext.options.tools,
        });
    }
    catch {
        return tool.userFacingName(input);
    }
}
function toCorePermissionRequest(permissionRequestId, input) {
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
        input: input.request.input,
        ...(input.request.permission_suggestions
            ? {
                permissionSuggestions: input.request.permission_suggestions,
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
    };
}
function createPermissionRequestId() {
    return `perm_${randomUUID()}`;
}
//# sourceMappingURL=permissionCore.js.map