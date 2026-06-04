export function detectSkillVendor(input) {
    if (input.compatibilityHints?.vendor) {
        return input.compatibilityHints.vendor;
    }
    if (input.compatibilityHints?.legacyCommand) {
        return 'claude';
    }
    if (input.openaiYaml != null) {
        return 'codex';
    }
    if (hasOpenClawMetadata(input.rawFrontmatter)) {
        return 'openclaw';
    }
    if (input.source === 'bundled' || input.source === 'mcp') {
        return 'ccr';
    }
    if (input.source === 'plugin') {
        return 'claude';
    }
    return 'agent-skills';
}
export function createSkillOrigin(input) {
    return {
        vendor: detectSkillVendor(input),
        sourcePath: input.sourcePath,
        ...(input.compatibilityHints?.importedFrom
            ? { importedFrom: input.compatibilityHints.importedFrom }
            : {}),
    };
}
export function normalizeOpenAiSkillInterface(openaiYaml) {
    const root = asRecord(openaiYaml);
    const iface = asRecord(root?.interface);
    if (!iface) {
        return undefined;
    }
    const result = {};
    assignString(result, 'shortDescription', iface.short_description);
    assignString(result, 'iconSmall', iface.icon_small);
    assignString(result, 'iconLarge', iface.icon_large);
    assignString(result, 'brandColor', iface.brand_color);
    assignString(result, 'defaultPrompt', iface.default_prompt);
    return Object.keys(result).length > 0 ? result : undefined;
}
export function asRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function hasOpenClawMetadata(frontmatter) {
    const metadata = asRecord(frontmatter.metadata);
    return asRecord(metadata?.openclaw) != null;
}
function assignString(target, key, value) {
    if (typeof value === 'string' && value.trim()) {
        target[key] = value.trim();
    }
}
//# sourceMappingURL=skillCompatibility.js.map