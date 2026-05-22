import { getCcrToolAvailability, } from './toolAvailability.js';
import { buildCcrToolRegistry, } from './toolRegistry.js';
export function isCcrToolSearchCandidate(entry, context = {}) {
    if (entry.exposure !== 'deferred')
        return false;
    return getCcrToolAvailability(entry, context).available;
}
export function getCcrToolSearchCandidates(tools, context = {}) {
    const registry = buildCcrToolRegistry(tools);
    return registry.entries
        .filter(entry => isCcrToolSearchCandidate(entry, context))
        .map(entry => entry.tool);
}
export function summarizeCcrToolSearchCandidates(tools, context = {}) {
    const registry = buildCcrToolRegistry(tools);
    const names = [];
    const excluded = [];
    for (const entry of registry.entries) {
        const availability = getCcrToolAvailability(entry, context);
        if (entry.exposure === 'deferred' && availability.available) {
            names.push(entry.name);
            continue;
        }
        excluded.push({
            name: entry.name,
            exposure: entry.exposure,
            available: availability.available,
            ...(availability.reason ? { reason: availability.reason } : {}),
        });
    }
    names.sort();
    excluded.sort((a, b) => a.name.localeCompare(b.name));
    return {
        total: names.length,
        names,
        excluded,
    };
}
//# sourceMappingURL=toolSearchPolicy.js.map