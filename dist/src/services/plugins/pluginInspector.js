import { createHash } from 'node:crypto';
import { pathsEqual } from '../../utils/file.js';
import { analyzePluginDependencies } from './pluginVersionLifecycle.js';
const SCOPE_PRIORITY = ['managed', 'local', 'project', 'user'];
const INSTALLATION_PRIORITY = ['local', 'project', 'user', 'managed'];
export class PluginInspector {
    async listCatalog(session) {
        const [settings, registry, marketplaces, runtimeSnapshot, retention] = await Promise.all([
            session.settings.read(),
            session.installations.read(),
            session.marketplaces.read(),
            session.runtime.read(),
            session.retention.read(),
        ]);
        const packageInspections = await Promise.all(registry.entries.map(async (entry) => ({
            entry,
            inspection: await session.packages.inspect(entry),
        })));
        const installationInstances = packageInspections.map(({ entry, inspection }) => toInstallationInstance(session, entry, inspection));
        const runtimeCandidates = runtimeSnapshot.loadedPlugins.map(plugin => ({
            pluginId: plugin.source,
            sourceId: plugin.isBuiltin
                ? 'builtin'
                : plugin.source.endsWith('@inline')
                    ? 'inline'
                    : 'runtime',
            sourceKind: plugin.isBuiltin
                ? 'builtin'
                : plugin.source.endsWith('@inline')
                    ? 'inline'
                    : 'runtime',
            ...(plugin.manifest.version
                ? { version: plugin.manifest.version }
                : {}),
            manifest: plugin.manifest,
        }));
        const candidates = [...marketplaces.candidates, ...runtimeCandidates];
        const runtimeActivations = [
            ...runtimeSnapshot.activations,
            ...runtimeSnapshot.loadedPlugins
                .filter(plugin => !runtimeSnapshot.activations.some(activation => activation.pluginId === plugin.source))
                .map(plugin => ({
                runtimeInstanceId: session.context.runtimeInstanceId,
                pluginId: plugin.source,
                ...(plugin.manifest.version
                    ? { activeVersion: plugin.manifest.version }
                    : {}),
                activationRevision: digest(`${session.context.runtimeInstanceId}:${plugin.source}:${plugin.manifest.version ?? ''}`),
                state: 'active',
                components: [],
            })),
        ];
        const loadedPlugins = selectLoadedPlugins(session, settings.entries, packageInspections, runtimeSnapshot.loadedPlugins);
        const pluginIds = new Set([
            ...candidates.map(candidate => candidate.pluginId),
            ...registry.entries.map(entry => entry.pluginId),
            ...settings.entries.flatMap(entry => Object.keys(entry.enabledPlugins)),
            ...runtimeActivations.map(activation => activation.pluginId),
        ]);
        const records = [...pluginIds]
            .sort((left, right) => left.localeCompare(right))
            .map(pluginId => createManagementRecord({
            pluginId,
            session,
            candidates: candidates.filter(candidate => candidate.pluginId === pluginId),
            installations: installationInstances.filter(installation => installation.pluginId === pluginId),
            intents: createIntents(pluginId, settings.entries, session),
            runtimeActivations: runtimeActivations.filter(activation => activation.pluginId === pluginId),
            rollbackVersions: retention.records.filter(record => record.pluginId === pluginId &&
                Date.parse(record.expiresAt) > Date.now()),
            diagnostics: [
                ...settings.diagnostics.filter(diagnostic => appliesToPlugin(diagnostic, pluginId)),
                ...registry.diagnostics.filter(diagnostic => appliesToPlugin(diagnostic, pluginId)),
                ...marketplaces.diagnostics.filter(diagnostic => appliesToPlugin(diagnostic, pluginId)),
                ...packageInspections.flatMap(({ entry, inspection }) => entry.pluginId === pluginId ? inspection.diagnostics : []),
            ],
        }));
        const draftCatalog = {
            schemaVersion: 1,
            context: session.context,
            marketplaces,
            candidates,
            plugins: records,
            diagnostics: [
                ...settings.diagnostics,
                ...registry.diagnostics,
                ...marketplaces.diagnostics,
                ...packageInspections.flatMap(({ inspection }) => inspection.diagnostics),
            ],
            loadedPlugins,
        };
        return {
            ...draftCatalog,
            plugins: records.map(record => ({
                ...record,
                dependencies: analyzePluginDependencies(draftCatalog, record.pluginId),
            })),
        };
    }
    async inspect(pluginId, session) {
        const catalog = await this.listCatalog(session);
        return catalog.plugins.find(plugin => plugin.pluginId === pluginId) ?? null;
    }
}
function toInstallationInstance(session, entry, inspection) {
    const target = {
        scope: entry.scope,
        ...((entry.scope === 'project' || entry.scope === 'local') &&
            entry.projectPath
            ? { workspaceRoot: entry.projectPath }
            : {}),
    };
    const key = [
        entry.pluginId,
        entry.scope,
        entry.projectPath ?? '',
        entry.installPath,
        entry.version ?? '',
    ].join('::');
    return {
        key,
        pluginId: entry.pluginId,
        target,
        ...(entry.version ? { installedVersion: entry.version } : {}),
        packagePath: entry.installPath,
        materialization: inspection.materialization,
        installationRevision: digest(key),
        ...(entry.installedAt ? { installedAt: entry.installedAt } : {}),
        ...(entry.lastUpdated ? { lastUpdated: entry.lastUpdated } : {}),
        ...(entry.gitCommitSha ? { gitCommitSha: entry.gitCommitSha } : {}),
        applicableToRequest: isInstallationApplicable(session, entry),
        ...(inspection.manifest ? { manifest: inspection.manifest } : {}),
    };
}
function createIntents(pluginId, settingsEntries, session) {
    return settingsEntries.map(entry => ({
        pluginId,
        target: {
            scope: entry.scope,
            ...((entry.scope === 'project' || entry.scope === 'local')
                ? { workspaceRoot: session.context.workspaceRoot }
                : {}),
        },
        intent: toIntent(entry.enabledPlugins[pluginId], entry.scope),
        source: entry.scope,
        settingsPath: entry.path,
    }));
}
function createManagementRecord(input) {
    const applicableInstallations = input.installations.filter(installation => installation.applicableToRequest);
    const intent = resolveIntentFromFacts(input.intents);
    const selectedInstallation = selectInstallation(applicableInstallations);
    const runtimeActive = input.runtimeActivations.some(activation => activation.runtimeInstanceId ===
        input.session.context.runtimeInstanceId &&
        (activation.state === 'active' || activation.state === 'partial'));
    const active = runtimeActive &&
        shouldHonorRuntimeActivation({
            candidates: input.candidates,
            intent,
        });
    const effectiveSelection = {
        ...(selectedInstallation
            ? {
                installationKey: selectedInstallation.key,
                target: selectedInstallation.target,
            }
            : {}),
        intent,
        enabled: intent === 'enabled',
        installed: selectedInstallation !== undefined,
        active,
        pendingActivation: intent === 'enabled' &&
            selectedInstallation?.materialization === 'present' &&
            !active,
    };
    const diagnostics = [
        ...input.diagnostics,
        ...deriveRuntimeDiagnostics(input.pluginId, input.session.context.runtimeInstanceId, input.runtimeActivations),
        ...deriveRecordDiagnostics(input.pluginId, applicableInstallations, effectiveSelection),
    ];
    const candidate = input.candidates[0];
    const manifest = selectedInstallation?.manifest ?? candidate?.manifest;
    return {
        pluginId: input.pluginId,
        displayName: manifest?.name ?? pluginName(input.pluginId),
        description: manifest?.description ?? '',
        candidates: input.candidates,
        installations: input.installations,
        intents: input.intents,
        effectiveSelection,
        runtimeActivations: [...input.runtimeActivations],
        rollbackVersions: [...input.rollbackVersions],
        dependencies: {
            directDependencies: [],
            transitiveDependencies: [],
            reverseDependents: [],
            crossMarketplaceEdges: [],
            semverSupport: 'exact-version-only',
        },
        appRelations: createAppRelations(input.pluginId, manifest),
        derivedState: deriveManagementState(input.candidates, applicableInstallations, effectiveSelection, diagnostics, input.runtimeActivations, input.session.context.runtimeInstanceId),
        diagnostics,
    };
}
function shouldHonorRuntimeActivation(input) {
    if (input.intent === 'disabled' || input.intent === 'blocked')
        return false;
    if (input.intent === 'enabled')
        return true;
    return input.candidates.some(candidate => candidate.sourceKind === 'builtin' || candidate.sourceKind === 'inline');
}
function createAppRelations(pluginId, manifest) {
    return (manifest?.ccr?.apps ?? []).map(app => ({
        pluginId,
        appId: app.id,
        ...(app.displayName ? { displayName: app.displayName } : {}),
        ...(app.description ? { description: app.description } : {}),
        relation: app.relation,
        skillIds: [...(app.skillIds ?? [])],
        mcpServerNames: [...(app.mcpServerNames ?? [])],
        toolIds: [...(app.toolIds ?? [])],
    }));
}
function deriveManagementState(candidates, installations, selection, diagnostics, runtimeActivations, runtimeInstanceId) {
    const selected = installations.find(installation => installation.key === selection.installationKey);
    const updateAvailable = candidates.some(candidate => candidate.version &&
        selected?.installedVersion &&
        candidate.version !== selected.installedVersion);
    const hasError = diagnostics.some(diagnostic => diagnostic.severity === 'error');
    const currentActivation = runtimeActivations.find(activation => activation.runtimeInstanceId === runtimeInstanceId);
    const partialActivation = currentActivation?.state === 'partial';
    const restartRequired = currentActivation?.components.some(component => component.state === 'restart-required') === true;
    let status = 'available';
    if (selected?.materialization === 'missing')
        status = 'missing';
    else if (selected?.materialization === 'invalid' ||
        selected?.materialization === 'drifted') {
        status = 'invalid';
    }
    else if (selection.active && restartRequired)
        status = 'restart-required';
    else if (selection.active && partialActivation)
        status = 'active-partial';
    else if (hasError)
        status = 'failed';
    else if (selection.active)
        status = 'active';
    else if (selection.pendingActivation)
        status = 'enabled-pending-activation';
    else if (selection.installed)
        status = 'installed-disabled';
    return {
        installed: selection.installed,
        enabled: selection.enabled,
        active: selection.active,
        partialActivation,
        restartRequired,
        updateAvailable,
        needsAttention: hasError ||
            partialActivation ||
            restartRequired ||
            status === 'missing' ||
            status === 'invalid',
        status,
    };
}
function deriveRuntimeDiagnostics(pluginId, runtimeInstanceId, activations) {
    const activation = activations.find(item => item.runtimeInstanceId === runtimeInstanceId);
    if (!activation)
        return [];
    return activation.components.flatMap(component => {
        if (component.state === 'active' || component.state === 'inactive') {
            return [];
        }
        return [
            {
                severity: component.state === 'failed'
                    ? 'error'
                    : 'warning',
                code: component.state === 'failed'
                    ? 'plugin-runtime-component-failed'
                    : 'plugin-runtime-restart-required',
                message: component.diagnostic ??
                    `Plugin runtime component ${component.component} is ${component.state}.`,
                layer: 'runtime',
                pluginId,
                component: component.component,
            },
        ];
    });
}
function deriveRecordDiagnostics(pluginId, installations, selection) {
    const diagnostics = [];
    if (selection.enabled && !selection.installed) {
        diagnostics.push({
            severity: 'error',
            code: 'plugin-enabled-without-installation',
            message: 'Plugin 已声明启用，但当前请求作用域没有可用安装实例。',
            layer: 'settings',
            pluginId,
        });
    }
    if (selection.pendingActivation) {
        diagnostics.push({
            severity: 'info',
            code: 'plugin-pending-activation',
            message: 'Plugin 已启用且包可用，但当前运行时实例尚未激活。',
            layer: 'runtime',
            pluginId,
        });
    }
    for (const installation of installations) {
        if (installation.materialization === 'missing') {
            diagnostics.push({
                severity: 'error',
                code: 'plugin-installation-missing',
                message: '安装记录指向的 Plugin 包不存在。',
                layer: 'installation',
                pluginId,
                installationKey: installation.key,
                path: installation.packagePath,
            });
        }
    }
    return diagnostics;
}
function resolveEffectiveIntent(pluginId, settingsEntries, session) {
    return resolveIntentFromFacts(createIntents(pluginId, settingsEntries, session));
}
function resolveIntentFromFacts(intents) {
    for (const scope of SCOPE_PRIORITY) {
        const intent = intents.find(entry => entry.source === scope)?.intent;
        if (intent && intent !== 'unset')
            return intent;
    }
    return 'unset';
}
function selectInstallation(installations) {
    for (const scope of INSTALLATION_PRIORITY) {
        const selected = installations.find(installation => installation.target.scope === scope);
        if (selected)
            return selected;
    }
    return undefined;
}
function isInstallationApplicable(session, entry) {
    if (entry.scope === 'user' || entry.scope === 'managed')
        return true;
    return (entry.projectPath !== undefined &&
        pathsEqual(entry.projectPath, session.context.workspaceRoot));
}
function toIntent(value, scope) {
    if (value === false)
        return scope === 'managed' ? 'blocked' : 'disabled';
    if (value === true || Array.isArray(value))
        return 'enabled';
    return 'unset';
}
function selectLoadedPlugins(session, settingsEntries, packageInspections, runtimePlugins) {
    const runtimeById = new Map(runtimePlugins.map(plugin => [plugin.source, plugin]));
    const pluginIds = new Set([
        ...packageInspections.map(item => item.entry.pluginId),
        ...runtimeById.keys(),
    ]);
    return [...pluginIds].flatMap(pluginId => {
        const runtimePlugin = runtimeById.get(pluginId);
        if (runtimePlugin?.isBuiltin ||
            runtimePlugin?.source.endsWith('@inline')) {
            return [{ ...runtimePlugin }];
        }
        const applicable = packageInspections.filter(item => item.entry.pluginId === pluginId &&
            isInstallationApplicable(session, item.entry) &&
            item.inspection.loadedPlugin);
        const selected = selectPackageInspection(applicable);
        if (!selected?.inspection.loadedPlugin)
            return [];
        return [
            {
                ...selected.inspection.loadedPlugin,
                enabled: resolveEffectiveIntent(pluginId, settingsEntries, session) ===
                    'enabled',
            },
        ];
    });
}
function selectPackageInspection(items) {
    for (const scope of INSTALLATION_PRIORITY) {
        const selected = items.find(item => item.entry.scope === scope);
        if (selected)
            return selected;
    }
    return undefined;
}
function appliesToPlugin(diagnostic, pluginId) {
    return diagnostic.pluginId === undefined || diagnostic.pluginId === pluginId;
}
function pluginName(pluginId) {
    const separator = pluginId.lastIndexOf('@');
    return separator > 0 ? pluginId.slice(0, separator) : pluginId;
}
function digest(value) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
//# sourceMappingURL=pluginInspector.js.map