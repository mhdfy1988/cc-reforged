import { summarizeCcrMcpInstallManifest, } from '../installManifest.js';
import { CONTEXT7_INSTALL_PRESET } from './context7.js';
import { PLAYWRIGHT_INSTALL_PRESET } from './playwright.js';
import { SENTRY_INSTALL_PRESET } from './sentry.js';
export function createCcrMcpInstallPresetRegistry(presets) {
    const indexedPresets = createValidatedPresetIndex(presets);
    return {
        list: () => [...indexedPresets],
        get: presetId => indexedPresets.find(preset => preset.id === presetId),
        search: (input = {}) => searchPresetIndex(indexedPresets, input),
    };
}
const CCR_MCP_INSTALL_PRESET_REGISTRY = createCcrMcpInstallPresetRegistry([
    PLAYWRIGHT_INSTALL_PRESET,
    CONTEXT7_INSTALL_PRESET,
    SENTRY_INSTALL_PRESET,
]);
export function listCcrMcpInstallPresets() {
    return CCR_MCP_INSTALL_PRESET_REGISTRY.list();
}
export function getCcrMcpInstallPreset(presetId) {
    return CCR_MCP_INSTALL_PRESET_REGISTRY.get(presetId);
}
export function searchCcrMcpInstallPresets(input = {}) {
    return CCR_MCP_INSTALL_PRESET_REGISTRY.search(input);
}
function createValidatedPresetIndex(presets) {
    const seenIds = new Set();
    const indexedPresets = presets.map(preset => {
        const id = preset.id.trim();
        if (!id) {
            throw new Error('MCP install preset id must not be empty.');
        }
        if (seenIds.has(id)) {
            throw new Error(`Duplicate MCP install preset id "${id}".`);
        }
        seenIds.add(id);
        return preset;
    });
    return Object.freeze([...indexedPresets]);
}
function searchPresetIndex(presets, input) {
    const query = input.query?.trim().toLowerCase() ?? '';
    const candidates = presets
        .filter(candidate => query
        ? getPresetSearchText(candidate).some(value => value.toLowerCase().includes(query))
        : true)
        .map(candidate => ({
        manifest: summarizeCcrMcpInstallManifest(candidate.manifest),
        manifestInput: candidate.manifest,
        displayName: candidate.displayName,
        description: candidate.description,
        trusted: candidate.trusted,
    }));
    return {
        query,
        candidates,
    };
}
function getPresetSearchText(preset) {
    return [
        preset.id,
        preset.manifest.name,
        preset.manifest.displayName ?? '',
        preset.manifest.description ?? '',
        preset.displayName,
        preset.description,
        preset.manifest.source.kind === 'stdio-npm-package'
            ? preset.manifest.source.packageName
            : '',
        preset.manifest.source.kind === 'remote-url'
            ? preset.manifest.source.url
            : '',
    ].filter(Boolean);
}
//# sourceMappingURL=registry.js.map