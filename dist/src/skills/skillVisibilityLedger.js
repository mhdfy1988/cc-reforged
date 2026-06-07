import { resolveSkillCommandRuntimeEligibility, } from './skillCommandRuntimeVisibility.js';
export function toSkillVisibilityEntry(command) {
    const runtime = resolveSkillCommandRuntimeEligibility(command);
    if (runtime.eligible === false) {
        return command.type === 'prompt' ? { name: command.name } : null;
    }
    return {
        name: runtime.command.name,
        capabilityId: runtime.capability.id,
    };
}
export function recordVisibleSkill(state, entry) {
    recordSkillVisibilityEntry(state, entry, {
        nameKey: 'visibleSkillNames',
        capabilityIdKey: 'visibleSkillCapabilityIds',
    });
}
export function recordVisibleSkillCommand(state, command) {
    const entry = toSkillVisibilityEntry(command);
    if (entry)
        recordVisibleSkill(state, entry);
}
export function recordDiscoveredSkill(state, entry) {
    recordSkillVisibilityEntry(state, entry, {
        nameKey: 'discoveredSkillNames',
        capabilityIdKey: 'discoveredSkillCapabilityIds',
    });
}
export function recordLoadedSkill(state, entry) {
    recordSkillVisibilityEntry(state, entry, {
        nameKey: 'loadedSkillNames',
        capabilityIdKey: 'loadedSkillCapabilityIds',
    });
}
export function recordLoadedSkillCommand(state, command) {
    const entry = toSkillVisibilityEntry(command);
    if (entry)
        recordLoadedSkill(state, entry);
}
export function isSkillAlreadySurfaced(entry, visibility) {
    if (entry.capabilityId) {
        return (visibility.visibleSkillCapabilityIds?.has(entry.capabilityId) === true ||
            visibility.loadedSkillCapabilityIds?.has(entry.capabilityId) === true ||
            visibility.discoveredSkillCapabilityIds?.has(entry.capabilityId) === true);
    }
    return (visibility.visibleSkillNames?.has(entry.name) === true ||
        visibility.loadedSkillNames?.has(entry.name) === true ||
        visibility.discoveredSkillNames?.has(entry.name) === true);
}
function recordSkillVisibilityEntry(state, entry, keys) {
    ensureMutableSet(state, keys.nameKey).add(entry.name);
    if (entry.capabilityId) {
        ensureMutableSet(state, keys.capabilityIdKey).add(entry.capabilityId);
    }
}
function ensureMutableSet(state, key) {
    const existing = state[key];
    if (existing instanceof Set)
        return existing;
    const next = new Set(existing ? [...existing] : []);
    state[key] = next;
    return next;
}
//# sourceMappingURL=skillVisibilityLedger.js.map