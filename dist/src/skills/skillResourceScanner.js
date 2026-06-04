export function createEmptySkillResources() {
    return {
        scripts: [],
        references: [],
        assets: [],
    };
}
export function normalizeSkillResources(input) {
    if (!input) {
        return createEmptySkillResources();
    }
    return {
        scripts: normalizeResourceList(input.scripts),
        references: normalizeResourceList(input.references),
        assets: normalizeResourceList(input.assets),
    };
}
function normalizeResourceList(values) {
    return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))];
}
//# sourceMappingURL=skillResourceScanner.js.map