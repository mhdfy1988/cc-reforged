export function createCapabilityId(kind, parts) {
    return [kind, ...parts.map(encodeCapabilityIdPart)].join(':');
}
export function createSkillCapabilityId(input) {
    return createCapabilityId('skill', [
        input.sourceKind,
        input.name,
        input.loadedFrom,
        input.pluginId,
        input.mcpServerName,
        input.installedRef,
    ]);
}
export function createExtensionCapabilityId(input) {
    return createCapabilityId(input.kind, [
        input.sourceKind,
        input.name,
        input.sourceRef,
        input.pluginId,
        input.mcpServerName,
        input.appId,
    ]);
}
function encodeCapabilityIdPart(value) {
    return encodeURIComponent(value ?? '');
}
//# sourceMappingURL=capabilityIdentity.js.map