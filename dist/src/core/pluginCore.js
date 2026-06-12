import { resolve } from 'node:path';
import { getClaudeConfigHomeDir } from '../utils/envUtils.js';
import { createPluginDomainSession, } from '../services/plugins/pluginDomainSession.js';
import { PluginInspector } from '../services/plugins/pluginInspector.js';
import { PluginActionService, } from '../services/plugins/pluginActionService.js';
import { createPluginTransactionExecutor } from '../services/plugins/pluginInstallTransaction.js';
import { PluginConfigurationService } from '../services/plugins/pluginConfigurationService.js';
import { PluginRuntimeActivator, } from '../services/plugins/pluginRuntimeActivator.js';
import { PluginMarketplaceService, } from '../services/plugins/pluginMarketplaceService.js';
import { PluginLocalImportService, } from '../services/plugins/pluginLocalImportService.js';
export class CorePluginService {
    inspector = new PluginInspector();
    actions;
    runtimeActivator = new PluginRuntimeActivator();
    configuration = new PluginConfigurationService();
    marketplaces = new PluginMarketplaceService();
    localImports = new PluginLocalImportService();
    runtimeHostAdapterFactory;
    constructor(options = {}) {
        this.actions = new PluginActionService({
            createSession: context => this.createSession(context),
            executor: options.executor ?? createPluginTransactionExecutor(),
        });
        this.runtimeHostAdapterFactory = options.runtimeHostAdapterFactory;
    }
    async listCatalog(context) {
        return this.inspector.listCatalog(this.createSession(context));
    }
    async inspect(pluginId, context) {
        return this.inspector.inspect(pluginId, this.createSession(context));
    }
    async listMarketplaces(context) {
        return this.marketplaces.list(this.createSession(context));
    }
    async addMarketplace(input, context) {
        return this.marketplaces.add(this.createSession(context), input);
    }
    async removeMarketplace(input, context) {
        return this.marketplaces.remove(this.createSession(context), input);
    }
    async refreshMarketplace(name, context) {
        return this.marketplaces.refresh(this.createSession(context), name);
    }
    async importLocal(input, context) {
        return this.localImports.importLocal(this.createSession(context), input);
    }
    async plan(request, context) {
        return this.actions.plan(request, this.createSession(context));
    }
    async apply(request) {
        return this.actions.apply(request);
    }
    getOperation(operationId, context) {
        if (!context)
            return this.actions.getOperation(operationId);
        return this.actions.getPersistedOperation(operationId, this.createSession(context));
    }
    cancelOperation(operationId) {
        return this.actions.cancelOperation(operationId);
    }
    async activateRuntime(context) {
        if (!this.runtimeHostAdapterFactory) {
            throw Object.assign(new Error('This Plugin API host has not registered a runtime activation adapter.'), { code: 'plugin-runtime-host-unavailable' });
        }
        const host = await this.runtimeHostAdapterFactory(context);
        return this.runtimeActivator.activate(this.createSession(context), host);
    }
    async getRuntimeSnapshot(context) {
        return this.createSession(context).runtime.read();
    }
    async inspectConfiguration(identity, context) {
        return this.configuration.inspect(this.createSession(context), identity);
    }
    async saveConfiguration(request, context) {
        return this.configuration.save(this.createSession(context), request);
    }
    async deleteConfiguration(request, context) {
        return this.configuration.delete(this.createSession(context), request);
    }
    getActionServiceForTests() {
        return this.actions;
    }
    createSession(context) {
        return createPluginDomainSession({
            workspaceRoot: resolve(context.workspaceRoot),
            currentCwd: resolve(context.currentCwd),
            configHomeDir: resolve(context.configHomeDir),
            runtimeInstanceId: context.runtimeInstanceId,
            ...(context.requestId ? { requestId: context.requestId } : {}),
            environment: process.env,
        });
    }
}
export function createCurrentProcessPluginRequestContext(options = {}) {
    const currentCwd = resolve(options.currentCwd ?? process.cwd());
    return {
        workspaceRoot: resolve(options.workspaceRoot ?? currentCwd),
        currentCwd,
        configHomeDir: resolve(options.configHomeDir ?? getClaudeConfigHomeDir()),
        runtimeInstanceId: options.runtimeInstanceId ?? 'current-process',
        ...(options.requestId ? { requestId: options.requestId } : {}),
    };
}
//# sourceMappingURL=pluginCore.js.map