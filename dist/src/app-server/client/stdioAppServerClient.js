import { JsonRpcClient } from './jsonRpcClient.js';
import { startAppServerProcess, } from './appServerProcess.js';
export class StdioAppServerClient {
    rpc;
    constructor(rpc) {
        this.rpc = rpc;
    }
    initialize(params = {}, options) {
        return this.rpc.request('initialize', params, options);
    }
    shutdown(options) {
        return this.rpc.request('shutdown', {}, options);
    }
    getConfig(options) {
        return this.rpc.request('config/get', {}, options);
    }
    getAuthStatus(params = {}, options) {
        return this.rpc.request('auth/status', params, options);
    }
    loginAuth(params = {}, options) {
        return this.rpc.request('auth/login', params, options);
    }
    listModels(params = {}, options) {
        return this.rpc.request('model/list', params, options);
    }
    listModelProfiles(params = {}, options) {
        return this.rpc.request('model/profile/list', params, options);
    }
    setModelProfile(params, options) {
        return this.rpc.request('model/profile/set-current', params, options);
    }
    saveModelProfile(params, options) {
        return this.rpc.request('model/profile/save', params, options);
    }
    copyModelProfile(params, options) {
        return this.rpc.request('model/profile/copy', params, options);
    }
    deleteModelProfile(params, options) {
        return this.rpc.request('model/profile/delete', params, options);
    }
    setModel(params, options) {
        return this.rpc.request('model/set', params, options);
    }
    getModelAvailability(params = {}, options) {
        return this.rpc.request('model/availability', params, options);
    }
    testModelConnection(params = {}, options) {
        return this.rpc.request('model/test', params, options);
    }
    updateModelCredential(params, options) {
        return this.rpc.request('model/credential/update', params, options);
    }
    listMcp(params = {}, options) {
        return this.rpc.request('mcp/list', params, options);
    }
    inspectMcp(params, options) {
        return this.rpc.request('mcp/inspect', params, options);
    }
    addMcp(params, options) {
        return this.rpc.request('mcp/add', params, options);
    }
    updateMcp(params, options) {
        return this.rpc.request('mcp/update', params, options);
    }
    removeMcp(params, options) {
        return this.rpc.request('mcp/remove', params, options);
    }
    enableMcp(params, options) {
        return this.rpc.request('mcp/enable', params, options);
    }
    disableMcp(params, options) {
        return this.rpc.request('mcp/disable', params, options);
    }
    restartMcp(params, options) {
        return this.rpc.request('mcp/restart', params, options);
    }
    testMcp(params, options) {
        return this.rpc.request('mcp/test', params, options);
    }
    searchMcpInstalls(params = {}, options) {
        return this.rpc.request('mcp/install/search', params, options);
    }
    planMcpInstall(params, options) {
        return this.rpc.request('mcp/install/plan', params, options);
    }
    applyMcpInstall(params, options) {
        return this.rpc.request('mcp/install/apply', params, options);
    }
    listMcpInstalls(params = {}, options) {
        return this.rpc.request('mcp/install/list', params, options);
    }
    uninstallMcp(params, options) {
        return this.rpc.request('mcp/install/uninstall', params, options);
    }
    repairMcp(params, options) {
        return this.rpc.request('mcp/install/repair', params, options);
    }
    openWorkspace(params, options) {
        return this.rpc.request('workspace/open', params, options);
    }
    startThread(params = {}, options) {
        return this.rpc.request('thread/start', params, options);
    }
    listThreads(options) {
        return this.rpc.request('thread/list', {}, options);
    }
    listThreadMessages(params, options) {
        return this.rpc.request('thread/messages/list', params, options);
    }
    listSessionHistory(params = {}, options) {
        return this.rpc.request('session/history/list', params, options);
    }
    renameSessionHistory(params, options) {
        return this.rpc.request('session/history/rename', params, options);
    }
    resumeThread(params, options) {
        return this.rpc.request('thread/resume', params, options);
    }
    startTurn(params, options) {
        return this.rpc.request('turn/start', params, options);
    }
    interruptTurn(params, options) {
        return this.rpc.request('turn/interrupt', params, options);
    }
    respondPermission(params, options) {
        return this.rpc.request('permission/respond', params, options);
    }
    listPendingPermissions(options) {
        return this.rpc.request('permission/pending/list', {}, options);
    }
    getPermissionSettings(options) {
        return this.rpc.request('permission/settings/get', {}, options);
    }
    updatePermissionSettings(params, options) {
        return this.rpc.request('permission/settings/update', params, options);
    }
    getContextStatus(params = {}, options) {
        return this.rpc.request('context/status', params, options);
    }
    analyzeContext(params = {}, options) {
        return this.rpc.request('context/analyze', params, options);
    }
    getCompactStatus(params = {}, options) {
        return this.rpc.request('compact/status', params, options);
    }
    runCompact(params, options) {
        return this.rpc.request('compact/run', params, options);
    }
    getMemorySessionStatus(params = {}, options) {
        return this.rpc.request('memory/session/status', params, options);
    }
    onNotification(listener) {
        return this.rpc.onNotification(listener);
    }
    onError(listener) {
        return this.rpc.onError(listener);
    }
    close() {
        this.rpc.close();
    }
}
export function createStdioAppServerClient(transport, options = {}) {
    return new StdioAppServerClient(new JsonRpcClient(transport, options));
}
export function startManagedStdioAppServerClient(options = {}) {
    const process = startAppServerProcess(options.process);
    const client = createStdioAppServerClient(process, options);
    return {
        client,
        process,
        async close() {
            try {
                await client.shutdown({ timeoutMs: 5_000 });
                await process.waitForExit();
            }
            catch {
                process.close();
                await process.waitForExit();
            }
            finally {
                client.close();
            }
        },
    };
}
//# sourceMappingURL=stdioAppServerClient.js.map