import { getOriginalCwd } from '../../bootstrap/state.js';
import { createCcrCore } from '../../core/ccrCore.js';
import { createCurrentProcessPluginRequestContext, } from '../../core/pluginCore.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { parsePluginIdentifier } from '../../utils/plugins/pluginIdentifier.js';
import { buildPluginTelemetryFields, } from '../../utils/telemetry/pluginTelemetry.js';
import { getManagedPluginNames } from '../../utils/plugins/managedPlugins.js';
import { isOfficialMarketplaceName } from '../../utils/plugins/pluginIdentifier.js';
import { logEvent, } from '../analytics/index.js';
const TERMINAL_OPERATION_STATUSES = new Set([
    'succeeded',
    'failed',
    'cancelled',
]);
const SCOPE_PRIORITY = [
    'local',
    'project',
    'user',
];
export class PluginDomainAdapter {
    core;
    contextFactory;
    operationTimeoutMs;
    constructor(options = {}) {
        this.core = options.core ?? createCcrCore();
        this.contextFactory =
            options.contextFactory ??
                (() => {
                    const workspaceRoot = getOriginalCwd();
                    return createCurrentProcessPluginRequestContext({
                        workspaceRoot,
                        currentCwd: workspaceRoot,
                        runtimeInstanceId: 'cli-ink',
                    });
                });
        this.operationTimeoutMs = options.operationTimeoutMs ?? 120_000;
    }
    async listCatalog() {
        return this.core.plugins.listCatalog(this.contextFactory());
    }
    async planAction(input) {
        const context = this.contextFactory();
        const { record, scope } = await this.resolveTarget(input.plugin, input.scope, context);
        return this.core.plugins.planAction({
            action: input.action,
            target: {
                pluginId: record.pluginId,
                scope,
                ...((scope === 'project' || scope === 'local')
                    ? { workspaceRoot: context.workspaceRoot }
                    : {}),
            },
            ...(input.deleteOptions
                ? { deleteOptions: input.deleteOptions }
                : {}),
            ...(input.action === 'install'
                ? {
                    installOptions: {
                        enableAfterInstall: input.enableAfterInstall === true,
                    },
                }
                : {}),
        }, context);
    }
    async executeAction(input) {
        const context = this.contextFactory();
        const { record, scope } = await this.resolveTarget(input.plugin, input.scope, context);
        const plan = await this.core.plugins.planAction({
            action: input.action,
            target: {
                pluginId: record.pluginId,
                scope,
                ...((scope === 'project' || scope === 'local')
                    ? { workspaceRoot: context.workspaceRoot }
                    : {}),
            },
            ...(input.deleteOptions
                ? { deleteOptions: input.deleteOptions }
                : {}),
            ...(input.action === 'install'
                ? {
                    installOptions: {
                        enableAfterInstall: input.enableAfterInstall === true,
                    },
                }
                : {}),
        }, context);
        if (!plan.allowed) {
            throw pluginAdapterError('plugin-action-not-allowed', plan.blockedReason ?? 'Plugin action is not allowed.');
        }
        const operation = await this.core.plugins.applyAction({
            planId: plan.planId,
            ...(plan.requiresConfirmation
                ? {
                    confirmed: true,
                    confirmationToken: plan.confirmation?.token,
                }
                : {}),
        });
        const completed = await this.waitForOperation(operation.operationId);
        if (completed.status !== 'succeeded') {
            throw pluginAdapterError(completed.error?.code ?? 'plugin-operation-failed', completed.error?.message ??
                `Plugin operation ended with status ${completed.status}.`);
        }
        clearAllCaches();
        return { plan, operation: completed, before: record };
    }
    async resolveTarget(plugin, requestedScope, context) {
        const catalog = await this.core.plugins.listCatalog(context);
        const record = resolvePluginRecord(catalog, plugin);
        if (!record) {
            throw pluginAdapterError('plugin-not-found', `Plugin "${plugin}" was not found in the request-scoped catalog.`);
        }
        return {
            record,
            scope: requestedScope ?? resolveEditableScope(record),
        };
    }
    async waitForOperation(operationId) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < this.operationTimeoutMs) {
            const operation = this.core.plugins.getOperation(operationId);
            if (!operation) {
                throw pluginAdapterError('plugin-operation-not-found', `Plugin operation was not found: ${operationId}.`);
            }
            if (TERMINAL_OPERATION_STATUSES.has(operation.status)) {
                return operation;
            }
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw pluginAdapterError('plugin-operation-timeout', `Timed out waiting for Plugin operation: ${operationId}.`);
    }
}
const currentProcessPluginAdapter = new PluginDomainAdapter();
export function getCurrentProcessPluginDomainAdapter() {
    return currentProcessPluginAdapter;
}
export async function installPluginFromMarketplace({ pluginId, entry, marketplaceName, scope = 'user', trigger = 'user', }) {
    try {
        const execution = await currentProcessPluginAdapter.executeAction({
            action: 'install',
            plugin: pluginId,
            scope,
            enableAfterInstall: true,
        });
        logEvent('tengu_plugin_installed', {
            _PROTO_plugin_name: entry.name,
            _PROTO_marketplace_name: marketplaceName,
            plugin_id: (isOfficialMarketplaceName(marketplaceName)
                ? pluginId
                : 'third-party'),
            trigger: trigger,
            install_source: (trigger === 'hint'
                ? 'ui-suggestion'
                : 'ui-discover'),
            ...buildPluginTelemetryFields(entry.name, marketplaceName, getManagedPluginNames()),
        });
        return {
            success: true,
            message: `Successfully installed plugin: ${execution.plan.target.pluginId} (scope: ${scope})${formatDependencySuffix(execution.plan.dependencies.required)}`,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function resolvePluginRecord(catalog, plugin) {
    const exact = catalog.plugins.find(record => record.pluginId === plugin);
    if (exact)
        return exact;
    const { name } = parsePluginIdentifier(plugin);
    const matches = catalog.plugins.filter(record => parsePluginIdentifier(record.pluginId).name === name);
    if (matches.length === 1)
        return matches[0];
    if (matches.length > 1) {
        throw pluginAdapterError('plugin-identifier-ambiguous', `Plugin name "${plugin}" matches multiple marketplaces. Use plugin@marketplace format.`);
    }
    return null;
}
function resolveEditableScope(record) {
    for (const scope of SCOPE_PRIORITY) {
        const intent = record.intents.find(item => item.target.scope === scope && item.intent !== 'unset');
        if (intent)
            return scope;
    }
    for (const scope of SCOPE_PRIORITY) {
        if (record.installations.some(item => item.target.scope === scope && item.applicableToRequest)) {
            return scope;
        }
    }
    return 'user';
}
function formatDependencySuffix(dependencies) {
    if (dependencies.length === 0)
        return '';
    return ` with ${dependencies.length} ${dependencies.length === 1 ? 'dependency' : 'dependencies'}`;
}
function pluginAdapterError(code, message) {
    return Object.assign(new Error(message), { code });
}
//# sourceMappingURL=pluginDomainAdapter.js.map