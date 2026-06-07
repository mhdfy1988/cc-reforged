import { normalizePluginId } from './pluginIdentityResolver.js';
export function projectPluginImpact(capabilities, rawPluginId) {
    const pluginId = normalizePluginId(rawPluginId) ?? rawPluginId;
    const children = capabilities.filter(capability => capability.kind !== 'plugin' &&
        capability.relations.parentPluginId === pluginId);
    return {
        pluginId,
        childCapabilityIds: children.map(capability => capability.id).sort(),
        affectedRuntimeSurfaces: [
            ...new Set(children.map(capability => capability.kind)),
        ].sort(),
    };
}
//# sourceMappingURL=pluginImpactProjection.js.map