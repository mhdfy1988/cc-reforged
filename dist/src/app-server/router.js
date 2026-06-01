import { getClaudeConfigHomeDir } from '../utils/envUtils.js';
import { createCcrCore } from '../core/index.js';
import { coreEventToJsonRpcNotification, coreEventToThreadDisplayPatchNotification, } from './coreEventMapper.js';
import { AppServerError, errorResponse } from './errors.js';
import { handleCompactRun, handleCompactStatus, handleContextAnalyze, handleContextStatus, handleMemorySessionStatus, } from './handlers/contextHandlers.js';
import { handleAuthLogin, handleAuthStatus, handleConfigGet, handleModelAvailability, handleModelProfileCopy, handleModelProfileDelete, handleModelCredentialUpdate, handleModelList, handleModelProfileList, handleModelProfileSave, handleModelProfileSetCurrent, handleModelSet, handleModelTest, } from './handlers/llmHandlers.js';
import { handleMcpAdd, handleMcpDisable, handleMcpEnable, handleMcpInstallApply, handleMcpInstallList, handleMcpInstallPlan, handleMcpInstallRepair, handleMcpInstallSearch, handleMcpInstallUninstall, handleMcpInspect, handleMcpList, handleMcpRemove, handleMcpRestart, handleMcpTest, handleMcpUpdate, } from './handlers/mcpHandlers.js';
import { handlePermissionPendingList, handlePermissionRespond, handlePermissionSettingsGet, handlePermissionSettingsUpdate, } from './handlers/permissionHandlers.js';
import { handleSessionHistoryList, handleSessionHistoryRename, handleThreadList, handleThreadMessagesList, handleThreadResume, handleThreadStart, handleTurnInterrupt, handleTurnStart, } from './handlers/sessionHandlers.js';
import { handleWorkspaceOpen } from './handlers/workspaceHandlers.js';
import { setupAppServerRuntime } from './setup.js';
import { APP_SERVER_CONFIG_SCHEMA_VERSION, APP_SERVER_PROTOCOL_VERSION, DEFAULT_SERVER_CAPABILITIES, InitializeParamsSchema, JsonRpcRequestSchema, ShutdownParamsSchema, successResponse, } from './protocol.js';
export function createAppServerContext(options = {}) {
    const emit = options.emit ?? (() => { });
    const core = createCcrCore({
        emit: event => {
            const displayPatchNotification = coreEventToThreadDisplayPatchNotification(event);
            if (displayPatchNotification) {
                emit(displayPatchNotification);
            }
            const notification = coreEventToJsonRpcNotification(event);
            if (notification) {
                emit(notification);
            }
        },
    });
    return {
        initialized: false,
        shutdownRequested: false,
        startedAt: Date.now(),
        ccrHome: getClaudeConfigHomeDir(),
        capabilities: DEFAULT_SERVER_CAPABILITIES,
        emit,
        core,
    };
}
export async function handleJsonRpcMessage(context, rawMessage) {
    const requestParse = JsonRpcRequestSchema.safeParse(rawMessage);
    if (!requestParse.success) {
        const id = extractResponseId(rawMessage);
        return errorResponse(id, new AppServerError('invalid_request', undefined, requestParse.error.issues));
    }
    const request = requestParse.data;
    if (!context.initialized && !isPreInitializeMethod(request.method)) {
        return errorResponse(request.id, new AppServerError('not_initialized'));
    }
    try {
        switch (request.method) {
            case 'initialize':
                return successResponse(request.id, await initialize(context, request.params));
            case 'shutdown':
                return successResponse(request.id, shutdown(context, request.params));
            case 'config/get':
                return successResponse(request.id, handleConfigGet(context, request.params));
            case 'auth/status':
                return successResponse(request.id, await handleAuthStatus(context, request.params));
            case 'auth/login':
                return successResponse(request.id, await handleAuthLogin(context, request.params));
            case 'model/list':
                return successResponse(request.id, handleModelList(context, request.params));
            case 'model/profile/list':
                return successResponse(request.id, handleModelProfileList(context, request.params));
            case 'model/profile/set-current':
                return successResponse(request.id, await handleModelProfileSetCurrent(context, request.params));
            case 'model/profile/save':
                return successResponse(request.id, await handleModelProfileSave(context, request.params));
            case 'model/profile/copy':
                return successResponse(request.id, await handleModelProfileCopy(context, request.params));
            case 'model/profile/delete':
                return successResponse(request.id, await handleModelProfileDelete(context, request.params));
            case 'model/availability':
                return successResponse(request.id, handleModelAvailability(context, request.params));
            case 'model/set':
                return successResponse(request.id, await handleModelSet(context, request.params));
            case 'model/test':
                return successResponse(request.id, await handleModelTest(context, request.params));
            case 'model/credential/update':
                return successResponse(request.id, await handleModelCredentialUpdate(context, request.params));
            case 'mcp/list':
                return successResponse(request.id, await handleMcpList(context, request.params));
            case 'mcp/inspect':
                return successResponse(request.id, handleMcpInspect(context, request.params));
            case 'mcp/add':
                return successResponse(request.id, await handleMcpAdd(context, request.params));
            case 'mcp/update':
                return successResponse(request.id, await handleMcpUpdate(context, request.params));
            case 'mcp/remove':
                return successResponse(request.id, await handleMcpRemove(context, request.params));
            case 'mcp/enable':
                return successResponse(request.id, handleMcpEnable(context, request.params));
            case 'mcp/disable':
                return successResponse(request.id, handleMcpDisable(context, request.params));
            case 'mcp/restart':
                return successResponse(request.id, handleMcpRestart(context, request.params));
            case 'mcp/test':
                return successResponse(request.id, await handleMcpTest(context, request.params));
            case 'mcp/install/search':
                return successResponse(request.id, handleMcpInstallSearch(context, request.params));
            case 'mcp/install/plan':
                return successResponse(request.id, handleMcpInstallPlan(context, request.params));
            case 'mcp/install/apply':
                return successResponse(request.id, await handleMcpInstallApply(context, request.params));
            case 'mcp/install/list':
                return successResponse(request.id, await handleMcpInstallList(context, request.params));
            case 'mcp/install/uninstall':
                return successResponse(request.id, await handleMcpInstallUninstall(context, request.params));
            case 'mcp/install/repair':
                return successResponse(request.id, await handleMcpInstallRepair(context, request.params));
            case 'workspace/open':
                return successResponse(request.id, await handleWorkspaceOpen(context, request.params));
            case 'thread/start':
                return successResponse(request.id, handleThreadStart(context, request.params));
            case 'thread/list':
                return successResponse(request.id, handleThreadList(context, request.params));
            case 'thread/messages/list':
                return successResponse(request.id, handleThreadMessagesList(context, request.params));
            case 'session/history/list':
                return successResponse(request.id, await handleSessionHistoryList(context, request.params));
            case 'session/history/rename':
                return successResponse(request.id, await handleSessionHistoryRename(context, request.params));
            case 'thread/resume':
                return successResponse(request.id, await handleThreadResume(context, request.params));
            case 'turn/start':
                return successResponse(request.id, handleTurnStart(context, request.params));
            case 'turn/interrupt':
                return successResponse(request.id, handleTurnInterrupt(context, request.params));
            case 'permission/respond':
                return successResponse(request.id, handlePermissionRespond(context, request.params));
            case 'permission/pending/list':
                return successResponse(request.id, handlePermissionPendingList(context, request.params));
            case 'permission/settings/get':
                return successResponse(request.id, handlePermissionSettingsGet(context, request.params));
            case 'permission/settings/update':
                return successResponse(request.id, handlePermissionSettingsUpdate(context, request.params));
            case 'context/status':
                return successResponse(request.id, handleContextStatus(context, request.params));
            case 'context/analyze':
                return successResponse(request.id, await handleContextAnalyze(context, request.params));
            case 'compact/status':
                return successResponse(request.id, handleCompactStatus(context, request.params));
            case 'compact/run':
                return successResponse(request.id, await handleCompactRun(context, request.params));
            case 'memory/session/status':
                return successResponse(request.id, await handleMemorySessionStatus(context, request.params));
            default:
                return errorResponse(request.id, new AppServerError('method_not_found', `Method not found: ${request.method}`));
        }
    }
    catch (error) {
        return errorResponse(request.id, error);
    }
}
function isPreInitializeMethod(method) {
    return method === 'initialize' || method === 'shutdown';
}
async function initialize(context, params) {
    if (context.initialized) {
        throw new AppServerError('already_initialized');
    }
    const parsedParams = InitializeParamsSchema.parse(params ?? {});
    const runtime = await setupAppServerRuntime();
    context.initialized = true;
    context.clientInfo = parsedParams.clientInfo;
    return {
        serverInfo: {
            name: 'ccr-app-server',
            version: APP_SERVER_PROTOCOL_VERSION,
            serverVersion: APP_SERVER_PROTOCOL_VERSION,
            coreVersion: getCoreVersion(),
        },
        serverVersion: APP_SERVER_PROTOCOL_VERSION,
        protocolVersion: APP_SERVER_PROTOCOL_VERSION,
        schemaVersions: {
            config: APP_SERVER_CONFIG_SCHEMA_VERSION,
        },
        ccrHome: context.ccrHome,
        platform: {
            os: process.platform,
            arch: process.arch,
            node: process.version,
        },
        runtime,
        capabilities: context.capabilities,
    };
}
function shutdown(context, params) {
    ShutdownParamsSchema.parse(params ?? {});
    context.shutdownRequested = true;
    process.exitCode = 0;
    return {
        accepted: true,
    };
}
function extractResponseId(rawMessage) {
    if (rawMessage &&
        typeof rawMessage === 'object' &&
        'id' in rawMessage &&
        (typeof rawMessage.id === 'string' || typeof rawMessage.id === 'number')) {
        return rawMessage.id;
    }
    return null;
}
function getCoreVersion() {
    const macro = globalThis.MACRO;
    return typeof macro?.VERSION === 'string' ? macro.VERSION : '0.0.0-dev';
}
//# sourceMappingURL=router.js.map