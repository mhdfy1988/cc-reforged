/**
 * CLI and Ink compatibility facade for Plugin lifecycle actions.
 *
 * All marketplace-backed writes go through PluginDomainAdapter and therefore
 * use the same plan/apply/operation path as Core, App Server, and Desktop.
 * Built-in intent writes are isolated in builtinPluginIntentAdapter because
 * built-ins do not have package installation records.
 */
import { getOriginalCwd } from '../../bootstrap/state.js';
import { isBuiltinPluginId } from '../../plugins/builtinPlugins.js';
import { loadInstalledPluginsV2, } from '../../utils/plugins/installedPluginsManager.js';
import { parsePluginIdentifier } from '../../utils/plugins/pluginIdentifier.js';
import { getSettingsForSource, } from '../../utils/settings/settings.js';
import { plural } from '../../utils/stringUtils.js';
import { setBuiltinPluginIntent } from './builtinPluginIntentAdapter.js';
import { getCurrentProcessPluginDomainAdapter, } from './pluginDomainAdapter.js';
export const VALID_INSTALLABLE_SCOPES = ['user', 'project', 'local'];
export const VALID_UPDATE_SCOPES = [
    'user',
    'project',
    'local',
];
export function assertInstallableScope(scope) {
    if (!VALID_INSTALLABLE_SCOPES.includes(scope)) {
        throw new Error(`Invalid scope "${scope}". Must be one of: ${VALID_INSTALLABLE_SCOPES.join(', ')}`);
    }
}
export function isInstallableScope(scope) {
    return VALID_INSTALLABLE_SCOPES.includes(scope);
}
export function getProjectPathForScope(scope) {
    return scope === 'project' || scope === 'local'
        ? getOriginalCwd()
        : undefined;
}
export function isPluginEnabledAtProjectScope(pluginId) {
    return (getSettingsForSource('projectSettings')?.enabledPlugins?.[pluginId] === true);
}
export function getPluginInstallationFromV2(pluginId) {
    const installations = loadInstalledPluginsV2().plugins[pluginId];
    if (!installations || installations.length === 0)
        return { scope: 'user' };
    const workspaceRoot = getOriginalCwd();
    for (const scope of ['local', 'project']) {
        const installation = installations.find(item => item.scope === scope && item.projectPath === workspaceRoot);
        if (installation) {
            return {
                scope,
                ...(installation.projectPath
                    ? { projectPath: installation.projectPath }
                    : {}),
            };
        }
    }
    const user = installations.find(item => item.scope === 'user');
    if (user)
        return { scope: 'user' };
    const first = installations[0];
    return {
        scope: first.scope,
        ...(first.projectPath ? { projectPath: first.projectPath } : {}),
    };
}
export async function installPluginOp(plugin, scope = 'user') {
    assertInstallableScope(scope);
    try {
        const execution = await getCurrentProcessPluginDomainAdapter().executeAction({
            action: 'install',
            plugin,
            scope,
            enableAfterInstall: true,
        });
        const pluginId = execution.plan.target.pluginId;
        const { name } = parsePluginIdentifier(pluginId);
        return {
            success: true,
            message: `Successfully installed plugin: ${pluginId} (scope: ${scope})${formatDependencySuffix(execution.plan.dependencies.required)}`,
            pluginId,
            pluginName: name,
            scope,
        };
    }
    catch (error) {
        return failure(error);
    }
}
export async function uninstallPluginOp(plugin, scope = 'user', deleteDataDir = true) {
    assertInstallableScope(scope);
    try {
        const catalog = await getCurrentProcessPluginDomainAdapter().listCatalog();
        const record = findRecord(catalog.plugins, plugin);
        const isFinalInstallation = record !== undefined && record.installations.length <= 1;
        const execution = await getCurrentProcessPluginDomainAdapter().executeAction({
            action: 'uninstall',
            plugin,
            scope,
            deleteOptions: {
                removeData: deleteDataDir && isFinalInstallation,
                removeOptions: isFinalInstallation,
                removeSecrets: isFinalInstallation,
            },
        });
        const pluginId = execution.plan.target.pluginId;
        const { name } = parsePluginIdentifier(pluginId);
        const reverseDependents = execution.plan.dependencies.reverseDependents;
        return {
            success: true,
            message: `Successfully uninstalled plugin: ${name} (scope: ${scope})${formatReverseDependentsSuffix(reverseDependents)}`,
            pluginId,
            pluginName: name,
            scope,
            ...(reverseDependents.length > 0 ? { reverseDependents } : {}),
        };
    }
    catch (error) {
        return failure(error);
    }
}
export async function setPluginEnabledOp(plugin, enabled, scope) {
    if (isBuiltinPluginId(plugin)) {
        return setBuiltinPluginIntent(plugin, enabled);
    }
    if (scope)
        assertInstallableScope(scope);
    const action = enabled ? 'enable' : 'disable';
    try {
        const execution = await getCurrentProcessPluginDomainAdapter().executeAction({
            action,
            plugin,
            ...(scope ? { scope } : {}),
        });
        const pluginId = execution.plan.target.pluginId;
        const resolvedScope = execution.plan.target.scope;
        const { name } = parsePluginIdentifier(pluginId);
        const reverseDependents = enabled
            ? []
            : execution.plan.dependencies.reverseDependents;
        return {
            success: true,
            message: `Successfully ${action}d plugin: ${name} (scope: ${resolvedScope})${formatReverseDependentsSuffix(reverseDependents)}`,
            pluginId,
            pluginName: name,
            scope: resolvedScope,
            ...(reverseDependents.length > 0 ? { reverseDependents } : {}),
        };
    }
    catch (error) {
        return failure(error);
    }
}
export async function enablePluginOp(plugin, scope) {
    return setPluginEnabledOp(plugin, true, scope);
}
export async function disablePluginOp(plugin, scope) {
    return setPluginEnabledOp(plugin, false, scope);
}
export async function disableAllPluginsOp() {
    const adapter = getCurrentProcessPluginDomainAdapter();
    const catalog = await adapter.listCatalog();
    const targets = catalog.plugins.flatMap(record => {
        for (const scope of ['local', 'project', 'user']) {
            const intent = record.intents.find(item => item.target.scope === scope && item.intent === 'enabled');
            if (intent)
                return [{ pluginId: record.pluginId, scope }];
        }
        return [];
    });
    if (targets.length === 0) {
        return { success: true, message: 'No enabled plugins to disable' };
    }
    const disabled = [];
    const errors = [];
    for (const target of targets) {
        const result = await disablePluginOp(target.pluginId, target.scope);
        if (result.success)
            disabled.push(target.pluginId);
        else
            errors.push(`${target.pluginId}: ${result.message}`);
    }
    if (errors.length > 0) {
        return {
            success: false,
            message: `Disabled ${disabled.length} ${plural(disabled.length, 'plugin')}, ${errors.length} failed:\n${errors.join('\n')}`,
        };
    }
    return {
        success: true,
        message: `Disabled ${disabled.length} ${plural(disabled.length, 'plugin')}`,
    };
}
export async function updatePluginOp(plugin, scope) {
    if (!isInstallableScope(scope)) {
        return {
            success: false,
            message: 'Managed Plugin scope is read-only.',
            scope,
        };
    }
    try {
        const catalog = await getCurrentProcessPluginDomainAdapter().listCatalog();
        const before = findRecord(catalog.plugins, plugin);
        const installation = before?.installations.find(item => item.target.scope === scope && item.applicableToRequest);
        const candidate = before?.candidates.find(item => item.sourceKind === 'marketplace');
        if (installation?.installedVersion &&
            candidate?.version &&
            installation.installedVersion === candidate.version) {
            return {
                success: true,
                message: `Plugin "${before?.displayName ?? plugin}" is already up to date`,
                pluginId: before?.pluginId,
                oldVersion: installation.installedVersion,
                newVersion: candidate.version,
                alreadyUpToDate: true,
                scope,
            };
        }
        const execution = await getCurrentProcessPluginDomainAdapter().executeAction({
            action: 'update',
            plugin,
            scope,
        });
        const installed = Array.isArray(execution.operation.result?.installed)
            ? execution.operation.result.installed
            : [];
        const updated = installed.find(item => typeof item === 'object' &&
            item !== null &&
            'pluginId' in item &&
            item.pluginId === execution.plan.target.pluginId);
        const pluginId = execution.plan.target.pluginId;
        const { name } = parsePluginIdentifier(pluginId);
        return {
            success: true,
            message: `Successfully updated plugin: ${name}${updated?.version ? ` to ${updated.version}` : ''}`,
            pluginId,
            oldVersion: installation?.installedVersion,
            newVersion: updated?.version ?? candidate?.version,
            alreadyUpToDate: false,
            scope,
        };
    }
    catch (error) {
        return {
            success: false,
            message: errorMessage(error),
            scope,
        };
    }
}
function findRecord(records, plugin) {
    const exact = records.find(record => record.pluginId === plugin);
    if (exact)
        return exact;
    const { name } = parsePluginIdentifier(plugin);
    const matches = records.filter(record => parsePluginIdentifier(record.pluginId).name === name);
    return matches.length === 1 ? matches[0] : undefined;
}
function failure(error) {
    return {
        success: false,
        message: errorMessage(error),
    };
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function formatDependencySuffix(dependencies) {
    if (dependencies.length === 0)
        return '';
    return ` with ${dependencies.length} ${dependencies.length === 1 ? 'dependency' : 'dependencies'}`;
}
function formatReverseDependentsSuffix(reverseDependents) {
    if (reverseDependents.length === 0)
        return '';
    return `; required by ${reverseDependents.join(', ')}`;
}
//# sourceMappingURL=pluginOperations.js.map