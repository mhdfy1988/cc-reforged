import { projectView } from './operations.js';
const DEFAULT_STATS = {
    collapsedSpans: 0,
    collapsedMessages: 0,
    stagedSpans: 0,
    health: {
        totalSpawns: 0,
        totalErrors: 0,
        emptySpawnWarningEmitted: false,
        totalEmptySpawns: 0,
    },
};
function cloneDefaultStats() {
    return {
        collapsedSpans: DEFAULT_STATS.collapsedSpans,
        collapsedMessages: DEFAULT_STATS.collapsedMessages,
        stagedSpans: DEFAULT_STATS.stagedSpans,
        health: {
            totalSpawns: DEFAULT_STATS.health.totalSpawns,
            totalErrors: DEFAULT_STATS.health.totalErrors,
            lastError: DEFAULT_STATS.health.lastError,
            emptySpawnWarningEmitted: DEFAULT_STATS.health.emptySpawnWarningEmitted,
            totalEmptySpawns: DEFAULT_STATS.health.totalEmptySpawns,
        },
    };
}
let stats = cloneDefaultStats();
const listeners = new Set();
function emit() {
    for (const listener of listeners) {
        listener();
    }
}
export function subscribe(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export function getStats() {
    return stats;
}
export function isContextCollapseEnabled() {
    return false;
}
export function resetContextCollapse() {
    stats = cloneDefaultStats();
    emit();
}
export async function applyCollapsesIfNeeded(messages, _toolUseContext, _querySource) {
    return { messages: projectView(messages) };
}
export function recoverFromOverflow(messages, _querySource) {
    return {
        committed: 0,
        messages: projectView(messages),
    };
}
export function isWithheldPromptTooLong(_message) {
    return false;
}
export { projectView };
//# sourceMappingURL=index.js.map