import { projectPluginImpact } from './pluginImpactProjection.js';
export function createCapabilityManagementProjection(catalog) {
    const capabilities = catalog.capabilities.map(toManagementItem);
    const byId = new Map(capabilities.map(item => [item.capabilityId, item]));
    const plugins = catalog.capabilities
        .filter(capability => capability.kind === 'plugin')
        .map(capability => ({
        ...byId.get(capability.id),
        impact: projectPluginImpact(catalog.capabilities, capability.source.pluginId ?? capability.name),
    }));
    const skills = capabilities.filter(item => item.kind === 'skill');
    const mcp = capabilities.filter(item => item.kind.startsWith('mcp-'));
    return {
        schemaVersion: 1,
        summary: {
            total: capabilities.length,
            skills: skills.length,
            mcp: mcp.length,
            plugins: plugins.length,
            runtimeVisible: capabilities.filter(item => item.state.runtimeVisible).length,
            needsAttention: capabilities.filter(item => item.diagnostics.some(diagnostic => diagnostic.severity !== 'info')).length,
        },
        skills,
        mcp,
        plugins,
        capabilities,
    };
}
function toManagementItem(capability) {
    const managementOwnership = getManagementOwnership(capability);
    const actionRef = capability.relations.installedRef ??
        (capability.kind === 'mcp-server' ? capability.name : undefined);
    return {
        capabilityId: capability.id,
        kind: capability.kind,
        name: capability.name,
        displayName: capability.displayName,
        description: capability.description,
        source: { ...capability.source },
        relations: { ...capability.relations },
        state: {
            ...capability.state,
            hiddenReasons: [...(capability.state.hiddenReasons ?? [])],
        },
        invocation: { ...capability.invocation },
        hiddenReasons: [...(capability.state.hiddenReasons ?? [])],
        diagnostics: capability.diagnostics.map(diagnostic => ({ ...diagnostic })),
        managementOwnership,
        ...(actionRef ? { actionRef } : {}),
        allowedActions: getAllowedActions(capability, managementOwnership),
        ...(capability.metadata ? { metadata: { ...capability.metadata } } : {}),
    };
}
function getManagementOwnership(capability) {
    if (capability.kind !== 'plugin' && capability.relations.parentPluginId) {
        return 'plugin-owned';
    }
    if (capability.kind === 'mcp-server' &&
        capability.metadata?.installKind === 'manual-config') {
        return 'manual-config';
    }
    if (capability.state.installed || capability.relations.installedRef) {
        return 'installer-owned';
    }
    return 'runtime-only';
}
function getAllowedActions(capability, ownership) {
    if (capability.kind === 'skill') {
        if (ownership !== 'installer-owned')
            return ['inspect'];
        return [
            capability.state.enabled ? 'disable' : 'enable',
            'set-model-invocation',
            'set-user-invocation',
            'inspect',
            'repair',
            'uninstall',
        ];
    }
    if (capability.kind === 'mcp-server') {
        const actions = ['inspect'];
        if (ownership === 'manual-config' || ownership === 'installer-owned') {
            actions.unshift(capability.state.enabled ? 'disable' : 'enable');
            actions.push('test', 'restart');
        }
        if (ownership === 'installer-owned') {
            actions.push('repair', 'uninstall');
        }
        return actions;
    }
    return ['inspect'];
}
//# sourceMappingURL=managementProjectionService.js.map