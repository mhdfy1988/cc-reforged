import { resolveLoadedPluginId } from './pluginIdentityResolver.js';
import { createExtensionCapabilityId } from './capabilityIdentity.js';
export function createPluginCapabilityProvider(input = {}) {
    return {
        id: 'plugins',
        async listCapabilities(context) {
            const runtimePlugins = context.plugins;
            const explicitCapabilities = runtimePlugins ?? input.plugins;
            const loadedPlugins = resolveLoadedPlugins(context, input);
            const managementRecords = context
                .capabilityEnvironment?.pluginCatalog?.plugins;
            return [
                ...(explicitCapabilities ?? []),
                ...(managementRecords
                    ? managementRecords
                        .filter(shouldExposePluginManagementRecordAsCapability)
                        .map(pluginManagementRecordToCapability)
                    : [
                        ...listPluginBundleCapabilities(loadedPlugins.plugins),
                        ...pluginLoadErrorsToCapabilities(loadedPlugins.errors),
                    ]),
            ];
        },
    };
}
function shouldExposePluginManagementRecordAsCapability(record) {
    if (record.installations.length > 0)
        return true;
    if (record.runtimeActivations.length > 0)
        return true;
    if (record.derivedState.installed)
        return true;
    if (record.derivedState.active)
        return true;
    return record.candidates.some(candidate => candidate.sourceKind !== 'marketplace');
}
function pluginManagementRecordToCapability(record) {
    const candidate = record.candidates[0];
    const selectedInstallation = record.installations.find(installation => installation.key === record.effectiveSelection?.installationKey);
    const sourceKind = candidate?.sourceKind === 'builtin' ? 'builtin' : 'plugin';
    const status = toCapabilityStatus(record.derivedState.status);
    return {
        schemaVersion: 1,
        id: createExtensionCapabilityId({
            kind: 'plugin',
            sourceKind,
            name: record.pluginId,
            sourceRef: candidate?.sourceId ?? record.pluginId,
            pluginId: record.pluginId,
        }),
        name: record.pluginId,
        displayName: record.displayName,
        description: record.description,
        kind: 'plugin',
        source: {
            kind: sourceKind,
            label: candidate?.sourceKind ?? 'plugin',
            ref: candidate?.sourceId ?? record.pluginId,
            pluginId: record.pluginId,
        },
        state: {
            installed: record.derivedState.installed,
            enabled: record.derivedState.enabled || record.derivedState.active,
            available: status !== 'missing' && status !== 'invalid' && status !== 'failed',
            runtimeVisible: record.derivedState.active,
            status,
        },
        invocation: {
            modelInvocable: false,
            userInvocable: false,
            toolInvocable: false,
        },
        relations: {
            ...(selectedInstallation
                ? { installedRef: selectedInstallation.packagePath }
                : {}),
            ...(record.derivedState.active
                ? {
                    runtimeRef: record.runtimeActivations.find(activation => activation.state === 'active')?.runtimeInstanceId,
                }
                : {}),
        },
        diagnostics: record.diagnostics.map(diagnostic => ({
            kind: diagnostic.layer === 'runtime'
                ? 'runtime'
                : diagnostic.layer === 'package' ||
                    diagnostic.layer === 'installation'
                    ? 'integrity'
                    : 'plugin',
            severity: diagnostic.severity,
            code: diagnostic.code,
            message: diagnostic.message,
        })),
        metadata: {
            candidates: record.candidates,
            installations: record.installations,
            intents: record.intents,
            effectiveSelection: record.effectiveSelection,
            runtimeActivations: record.runtimeActivations,
            appRelations: record.appRelations,
            derivedState: record.derivedState,
        },
    };
}
function toCapabilityStatus(status) {
    switch (status) {
        case 'installed-disabled':
            return 'disabled';
        case 'enabled-pending-activation':
        case 'active':
        case 'active-partial':
        case 'restart-required':
            return 'enabled';
        case 'missing':
        case 'invalid':
        case 'failed':
            return status;
        case 'available':
            return 'available';
    }
}
export function listPluginBundleCapabilities(plugins = []) {
    return plugins.map(pluginToCapability);
}
function pluginToCapability(plugin) {
    const enabled = plugin.enabled !== false;
    const pluginId = resolveLoadedPluginId(plugin);
    const componentCounts = getPluginComponentCounts(plugin);
    const sourceKind = plugin.isBuiltin ? 'builtin' : 'plugin';
    return {
        schemaVersion: 1,
        id: createExtensionCapabilityId({
            kind: 'plugin',
            sourceKind,
            name: pluginId,
            sourceRef: plugin.source,
            pluginId,
        }),
        name: plugin.name,
        displayName: plugin.manifest.name || plugin.name,
        description: plugin.manifest.description ?? '',
        kind: 'plugin',
        source: {
            kind: sourceKind,
            label: plugin.isBuiltin ? 'builtin plugin' : 'plugin',
            ref: plugin.source,
            pluginId,
        },
        state: {
            installed: true,
            enabled,
            available: enabled,
            runtimeVisible: false,
            status: enabled ? 'enabled' : 'disabled',
        },
        invocation: {
            modelInvocable: false,
            userInvocable: false,
            toolInvocable: false,
        },
        relations: {
            installedRef: plugin.path,
        },
        diagnostics: enabled
            ? []
            : [
                {
                    kind: 'availability',
                    severity: 'info',
                    code: 'plugin-disabled',
                    message: `Plugin ${pluginId} is disabled.`,
                },
            ],
        metadata: {
            repository: plugin.repository,
            source: plugin.source,
            version: plugin.manifest.version,
            isBuiltin: plugin.isBuiltin === true,
            sha: plugin.sha,
            components: componentCounts,
        },
    };
}
function resolveLoadedPlugins(context, input) {
    return {
        plugins: context.capabilityEnvironment?.plugins.plugins ??
            context.loadedPlugins ??
            input.loadedPlugins ??
            [],
        errors: context.capabilityEnvironment?.plugins.errors ??
            context.pluginLoadErrors ??
            input.pluginLoadErrors ??
            [],
    };
}
function pluginLoadErrorsToCapabilities(errors) {
    if (errors.length === 0)
        return [];
    return [
        {
            schemaVersion: 1,
            id: 'plugin:catalog-errors',
            name: 'plugin:catalog-errors',
            displayName: 'Plugin catalog errors',
            description: 'Plugin 加载存在错误。',
            kind: 'plugin',
            source: {
                kind: 'plugin',
                label: 'plugin loader',
            },
            state: {
                installed: false,
                enabled: false,
                available: false,
                runtimeVisible: false,
                status: 'failed',
            },
            invocation: {
                modelInvocable: false,
                userInvocable: false,
                toolInvocable: false,
            },
            relations: {},
            diagnostics: errors.map(error => ({
                kind: 'plugin',
                severity: 'error',
                message: summarizePluginError(error),
            })),
        },
    ];
}
function summarizePluginError(error) {
    if ('error' in error && typeof error.error === 'string') {
        return error.error;
    }
    if ('message' in error && typeof error.message === 'string') {
        return error.message;
    }
    if ('reason' in error && typeof error.reason === 'string') {
        return error.reason;
    }
    return `${error.type} from ${'source' in error ? error.source : 'plugin loader'}`;
}
function getPluginComponentCounts(plugin) {
    return {
        commands: countPaths(plugin.commandsPath, plugin.commandsPaths),
        agents: countPaths(plugin.agentsPath, plugin.agentsPaths),
        skills: countPaths(plugin.skillsPath, plugin.skillsPaths),
        hooks: countObjectKeys(plugin.hooksConfig),
        mcpServers: countObjectKeys(plugin.mcpServers),
        lspServers: countObjectKeys(plugin.lspServers),
        outputStyles: countPaths(plugin.outputStylesPath, plugin.outputStylesPaths),
    };
}
function countPaths(primary, additional) {
    const paths = new Set();
    if (primary)
        paths.add(primary);
    for (const path of additional ?? []) {
        paths.add(path);
    }
    return paths.size;
}
function countObjectKeys(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return 0;
    }
    return Object.keys(value).length;
}
//# sourceMappingURL=pluginCapabilityProvider.js.map