import { feature } from 'bun:bundle';
import { getCachedMCConfig as getRawCachedMCConfig } from './cachedMCConfig.js';
const DEFAULT_CACHED_MC_CONFIG = Object.freeze({
    enabled: false,
    triggerThreshold: 40,
    keepRecent: 8,
    supportedModels: [],
    systemPromptSuggestSummaries: false,
});
function isObjectRecord(value) {
    return typeof value === 'object' && value !== null;
}
function asPositiveInteger(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    const normalized = Math.floor(value);
    return normalized > 0 ? normalized : fallback;
}
function asStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === 'string');
}
function normalizeCachedMCConfig(value) {
    if (!isObjectRecord(value)) {
        return DEFAULT_CACHED_MC_CONFIG;
    }
    const keepRecent = asPositiveInteger(value.keepRecent, DEFAULT_CACHED_MC_CONFIG.keepRecent);
    const triggerThreshold = asPositiveInteger(value.triggerThreshold, DEFAULT_CACHED_MC_CONFIG.triggerThreshold);
    return {
        enabled: value.enabled === true,
        keepRecent,
        // Trigger should never sit below keepRecent; otherwise we'd delete every turn.
        triggerThreshold: Math.max(keepRecent, triggerThreshold),
        supportedModels: asStringArray(value.supportedModels),
        systemPromptSuggestSummaries: value.systemPromptSuggestSummaries === true,
    };
}
export function createCachedMCState() {
    return {
        toolOrder: [],
        registeredTools: new Set(),
        sentToAPI: new Set(),
        pendingSend: new Set(),
        deletedRefs: new Set(),
        toolGroups: [],
        pinnedEdits: [],
    };
}
export function resetCachedMCState(state) {
    state.toolOrder.length = 0;
    state.toolGroups.length = 0;
    state.pinnedEdits.length = 0;
    state.registeredTools.clear();
    state.sentToAPI.clear();
    state.pendingSend.clear();
    state.deletedRefs.clear();
}
export function getCachedMCConfig() {
    return normalizeCachedMCConfig(getRawCachedMCConfig());
}
export function isCachedMicrocompactEnabled() {
    if (!feature('CACHED_MICROCOMPACT')) {
        return false;
    }
    return getCachedMCConfig().enabled;
}
export function isModelSupportedForCacheEditing(model) {
    if (typeof model !== 'string' || model.length === 0) {
        return false;
    }
    const patterns = getCachedMCConfig().supportedModels;
    if (patterns.length === 0) {
        return false;
    }
    return patterns.some(pattern => model.includes(pattern));
}
export function registerToolResult(state, toolUseID) {
    if (typeof toolUseID !== 'string' || toolUseID.length === 0) {
        return;
    }
    if (state.registeredTools.has(toolUseID)) {
        return;
    }
    state.registeredTools.add(toolUseID);
    state.pendingSend.add(toolUseID);
    state.toolOrder.push(toolUseID);
}
export function registerToolMessage(state, toolUseIDs) {
    if (!Array.isArray(toolUseIDs) || toolUseIDs.length === 0) {
        return;
    }
    const group = toolUseIDs.filter((id) => typeof id === 'string' &&
        id.length > 0 &&
        state.registeredTools.has(id) &&
        !state.deletedRefs.has(id));
    if (group.length > 0) {
        state.toolGroups.push(group);
    }
}
export function markToolsSentToAPI(state) {
    if (state.pendingSend.size === 0) {
        return;
    }
    for (const toolID of state.pendingSend) {
        state.sentToAPI.add(toolID);
    }
    state.pendingSend.clear();
}
export function getToolResultsToDelete(state) {
    const config = getCachedMCConfig();
    if (!config.enabled) {
        return [];
    }
    const activeSent = state.toolOrder.filter(toolID => state.sentToAPI.has(toolID) && !state.deletedRefs.has(toolID));
    if (activeSent.length <= config.triggerThreshold) {
        return [];
    }
    const keepRecent = Math.max(1, config.keepRecent);
    const deleteCount = Math.max(0, activeSent.length - keepRecent);
    if (deleteCount === 0) {
        return [];
    }
    return activeSent.slice(0, deleteCount);
}
export function createCacheEditsBlock(state, toolUseIDs) {
    if (!Array.isArray(toolUseIDs) || toolUseIDs.length === 0) {
        return null;
    }
    const uniqueToolIDs = toolUseIDs.filter((id) => typeof id === 'string' &&
        id.length > 0 &&
        !state.deletedRefs.has(id) &&
        state.registeredTools.has(id));
    if (uniqueToolIDs.length === 0) {
        return null;
    }
    for (const toolID of uniqueToolIDs) {
        state.deletedRefs.add(toolID);
    }
    return {
        type: 'cache_edits',
        edits: uniqueToolIDs.map(toolID => ({
            type: 'delete',
            cache_reference: toolID,
        })),
    };
}
//# sourceMappingURL=cachedMicrocompact.js.map