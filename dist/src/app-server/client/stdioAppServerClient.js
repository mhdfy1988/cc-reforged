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
    listModels(params = {}, options) {
        return this.rpc.request('model/list', params, options);
    }
    listMcp(params = {}, options) {
        return this.rpc.request('mcp/list', params, options);
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
    startTurn(params, options) {
        return this.rpc.request('turn/start', params, options);
    }
    interruptTurn(params, options) {
        return this.rpc.request('turn/interrupt', params, options);
    }
    respondPermission(params, options) {
        return this.rpc.request('permission/respond', params, options);
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