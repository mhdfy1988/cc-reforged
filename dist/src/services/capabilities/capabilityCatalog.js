import { markCapabilityHiddenByConflict, resolveCapabilityRuntimeVisibility, } from './capabilityRuntimeVisibility.js';
export async function createExtensionCapabilityCatalog(input) {
    const providerResults = await Promise.all(input.providers.map(provider => Promise.resolve(provider.listCapabilities(input.context ?? {}))));
    return buildExtensionCapabilityCatalog(providerResults.flat());
}
export function buildExtensionCapabilityCatalog(capabilities) {
    const initiallyResolved = capabilities
        .map(cloneCapability)
        .map(resolveCapabilityRuntimeVisibility);
    const normalized = applyParentRuntimeVisibility(initiallyResolved);
    const diagnostics = [];
    const visibleByRuntimeKey = new Map();
    for (const capability of normalized.sort(compareCapabilities)) {
        if (!capability.state.runtimeVisible) {
            continue;
        }
        const key = getRuntimeConflictKey(capability);
        const existing = visibleByRuntimeKey.get(key);
        if (!existing) {
            visibleByRuntimeKey.set(key, capability);
            continue;
        }
        const diagnostic = {
            kind: 'conflict',
            severity: 'warning',
            code: 'duplicate-runtime-name',
            message: `Capability '${capability.name}' from ${capability.source.label} was hidden because ${existing.source.label} already provides the same ${capability.kind} runtime name.`,
        };
        markCapabilityHiddenByConflict(capability, diagnostic);
        diagnostics.push(diagnostic);
    }
    const sorted = normalized.sort(compareCapabilities);
    return {
        schemaVersion: 1,
        capabilities: sorted,
        runtimeVisible: sorted.filter(capability => capability.state.runtimeVisible),
        diagnostics,
        summary: summarizeCapabilities(sorted),
    };
}
function applyParentRuntimeVisibility(capabilities) {
    const appRelatedCapabilities = applyDeclaredAppRelations(capabilities);
    const pluginById = new Map();
    const appById = new Map();
    const mcpServerByName = new Map();
    for (const capability of appRelatedCapabilities) {
        if (capability.kind === 'plugin') {
            const pluginId = capability.source.pluginId ??
                capability.relations.parentPluginId ??
                capability.id.replace(/^plugin:/, '');
            pluginById.set(pluginId, capability);
        }
    }
    const pluginResolved = appRelatedCapabilities.map(capability => {
        const parentPluginId = capability.relations.parentPluginId;
        if (!parentPluginId || capability.kind === 'plugin')
            return capability;
        const parent = pluginById.get(parentPluginId);
        if (!parent) {
            return addMissingParentPluginDiagnostic(capability, parentPluginId);
        }
        return parent.state.enabled && parent.state.available
            ? capability
            : addParentHiddenReason(capability, 'plugin-disabled');
    });
    for (const capability of pluginResolved) {
        if (capability.kind === 'app') {
            const appId = capability.source.appId ?? capability.name;
            appById.set(appId, capability);
        }
    }
    const appResolved = pluginResolved.map(capability => {
        const parentAppId = capability.relations.parentAppId;
        if (!parentAppId || capability.kind === 'app')
            return capability;
        const parent = appById.get(parentAppId);
        if (!parent) {
            return addMissingParentAppDiagnostic(capability, parentAppId);
        }
        if (parent.state.enabled && parent.state.available) {
            return capability;
        }
        if (parent.state.hiddenReasons?.includes('plugin-disabled') === true) {
            return addParentHiddenReason(capability, 'plugin-disabled');
        }
        return addParentHiddenReason(capability, parent.state.status === 'needs-auth'
            ? 'app-needs-auth'
            : parent.state.status === 'disabled'
                ? 'app-disabled'
                : 'app-disconnected');
    });
    for (const capability of appResolved) {
        if (capability.kind === 'mcp-server') {
            mcpServerByName.set(capability.name, capability);
        }
    }
    return appResolved.map(capability => {
        const parentServerName = capability.relations.parentMcpServerName;
        if (!parentServerName || capability.kind === 'mcp-server') {
            return capability;
        }
        const parent = mcpServerByName.get(parentServerName);
        const withPluginRelation = parent?.relations.parentPluginId &&
            capability.relations.parentPluginId !== parent.relations.parentPluginId
            ? {
                ...capability,
                source: {
                    ...capability.source,
                    pluginId: parent.relations.parentPluginId,
                },
                relations: {
                    ...capability.relations,
                    parentPluginId: parent.relations.parentPluginId,
                },
            }
            : capability;
        const inheritedPluginId = withPluginRelation.relations.parentPluginId;
        const pluginParent = inheritedPluginId
            ? pluginById.get(inheritedPluginId)
            : undefined;
        const pluginAware = inheritedPluginId && !pluginParent
            ? addMissingParentPluginDiagnostic(withPluginRelation, inheritedPluginId)
            : inheritedPluginId &&
                !(pluginParent.state.enabled && pluginParent.state.available)
                ? addParentHiddenReason(withPluginRelation, 'plugin-disabled')
                : withPluginRelation;
        return parent?.state.enabled && parent.state.available
            ? pluginAware
            : addParentHiddenReason(pluginAware, 'mcp-server-unavailable');
    });
}
function applyDeclaredAppRelations(capabilities) {
    const appClaims = new Map();
    for (const app of capabilities.filter(capability => capability.kind === 'app')) {
        const appId = app.source.appId ?? app.name;
        for (const ref of readStringArray(app.metadata?.providedToolIds)) {
            addAppClaim(appClaims, `tool:${ref}`, appId);
        }
        for (const ref of readStringArray(app.metadata?.providedSkillIds)) {
            addAppClaim(appClaims, `skill:${ref}`, appId);
        }
        for (const ref of readStringArray(app.metadata?.providedMcpServerNames)) {
            addAppClaim(appClaims, `mcp-server:${ref}`, appId);
        }
    }
    return capabilities.map(capability => {
        if (capability.kind === 'app' || capability.relations.parentAppId) {
            return capability;
        }
        const { appId, conflictingAppIds } = resolveDeclaredParentApp(capability, appClaims);
        if (conflictingAppIds) {
            return addAmbiguousParentAppDiagnostic(capability, conflictingAppIds);
        }
        if (!appId)
            return capability;
        return {
            ...capability,
            source: {
                ...capability.source,
                appId,
            },
            relations: {
                ...capability.relations,
                parentAppId: appId,
            },
        };
    });
}
function addAppClaim(claims, ref, appId) {
    const appIds = claims.get(ref) ?? new Set();
    appIds.add(appId);
    claims.set(ref, appIds);
}
function resolveDeclaredParentApp(capability, claims) {
    const refs = [
        capability.id,
        capability.name,
        capability.relations.runtimeRef,
    ].filter((value) => typeof value === 'string');
    let claimKind;
    if (capability.kind === 'skill') {
        claimKind = 'skill';
    }
    else if (capability.kind === 'mcp-server') {
        claimKind = 'mcp-server';
    }
    else if (capability.kind === 'tool' || capability.kind === 'mcp-tool') {
        claimKind = 'tool';
    }
    if (!claimKind)
        return {};
    const appIds = new Set();
    for (const ref of refs) {
        for (const appId of claims.get(`${claimKind}:${ref}`) ?? []) {
            appIds.add(appId);
        }
    }
    if (appIds.size === 1) {
        return { appId: [...appIds][0] };
    }
    return appIds.size > 1
        ? { conflictingAppIds: [...appIds].sort() }
        : {};
}
function readStringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
}
function addMissingParentPluginDiagnostic(capability, parentPluginId) {
    const withDiagnostic = capability.diagnostics.some(diagnostic => diagnostic.kind === 'plugin' &&
        diagnostic.code === 'parent-plugin-missing')
        ? capability
        : {
            ...capability,
            diagnostics: [
                ...capability.diagnostics,
                {
                    kind: 'plugin',
                    severity: 'warning',
                    code: 'parent-plugin-missing',
                    message: `Parent plugin '${parentPluginId}' was not present in the capability catalog snapshot.`,
                },
            ],
        };
    return addParentHiddenReason(withDiagnostic, 'plugin-missing');
}
function addMissingParentAppDiagnostic(capability, parentAppId) {
    const withDiagnostic = capability.diagnostics.some(diagnostic => diagnostic.kind === 'source' &&
        diagnostic.code === 'parent-app-missing')
        ? capability
        : {
            ...capability,
            diagnostics: [
                ...capability.diagnostics,
                {
                    kind: 'source',
                    severity: 'warning',
                    code: 'parent-app-missing',
                    message: `Parent app connector '${parentAppId}' was not present in the capability catalog snapshot.`,
                },
            ],
        };
    return addParentHiddenReason(withDiagnostic, 'app-missing');
}
function addAmbiguousParentAppDiagnostic(capability, appIds) {
    const withDiagnostic = {
        ...capability,
        diagnostics: [
            ...capability.diagnostics,
            {
                kind: 'conflict',
                severity: 'error',
                code: 'parent-app-ambiguous',
                message: `Multiple app connectors claim this capability: ${appIds.join(', ')}.`,
            },
        ],
    };
    return addParentHiddenReason(withDiagnostic, 'app-ambiguous');
}
function addParentHiddenReason(capability, reason) {
    const hiddenReasons = capability.state.hiddenReasons ?? [];
    if (hiddenReasons.includes(reason))
        return capability;
    return resolveCapabilityRuntimeVisibility({
        ...capability,
        state: {
            ...capability.state,
            hiddenReasons: [...hiddenReasons, reason],
        },
    });
}
export function summarizeCapabilities(capabilities) {
    const byKind = createCounter([
        'skill',
        'mcp-server',
        'mcp-tool',
        'mcp-resource',
        'mcp-prompt',
        'tool',
        'command',
        'plugin',
        'app',
    ]);
    const bySourceKind = createCounter([
        'managed-skill',
        'user-skill',
        'project-skill',
        'plugin',
        'bundled',
        'dynamic',
        'mcp',
        'provider',
        'app',
        'builtin',
        'legacy',
        'unknown',
    ]);
    const byStatus = createCounter([
        'available',
        'enabled',
        'disabled',
        'unavailable',
        'needs-auth',
        'failed',
        'missing',
        'drifted',
        'invalid',
        'hidden-by-conflict',
    ]);
    for (const capability of capabilities) {
        byKind[capability.kind] += 1;
        bySourceKind[capability.source.kind] += 1;
        byStatus[capability.state.status] += 1;
    }
    return {
        total: capabilities.length,
        runtimeVisible: capabilities.filter(capability => capability.state.runtimeVisible)
            .length,
        byKind,
        bySourceKind,
        byStatus,
    };
}
function compareCapabilities(a, b) {
    const runtimeDiff = Number(b.state.runtimeVisible) - Number(a.state.runtimeVisible);
    if (runtimeDiff !== 0)
        return runtimeDiff;
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0)
        return nameDiff;
    const rankDiff = sourceRank(a.source.kind) - sourceRank(b.source.kind);
    if (rankDiff !== 0)
        return rankDiff;
    return a.id.localeCompare(b.id);
}
function getRuntimeConflictKey(capability) {
    return `${capability.kind}:${capability.name.toLowerCase()}`;
}
function sourceRank(sourceKind) {
    switch (sourceKind) {
        case 'project-skill':
            return 0;
        case 'user-skill':
            return 1;
        case 'managed-skill':
            return 2;
        case 'plugin':
            return 3;
        case 'bundled':
            return 4;
        case 'dynamic':
            return 5;
        case 'mcp':
            return 6;
        case 'provider':
            return 7;
        case 'app':
            return 8;
        case 'builtin':
            return 9;
        case 'legacy':
            return 10;
        case 'unknown':
            return 11;
    }
}
function cloneCapability(capability) {
    return {
        ...capability,
        source: { ...capability.source },
        state: {
            ...capability.state,
            ...(capability.state.hiddenReasons
                ? { hiddenReasons: [...capability.state.hiddenReasons] }
                : {}),
        },
        invocation: { ...capability.invocation },
        relations: { ...capability.relations },
        diagnostics: capability.diagnostics.map(diagnostic => ({ ...diagnostic })),
        ...(capability.metadata ? { metadata: { ...capability.metadata } } : {}),
    };
}
function createCounter(keys) {
    return Object.fromEntries(keys.map(key => [key, 0]));
}
//# sourceMappingURL=capabilityCatalog.js.map