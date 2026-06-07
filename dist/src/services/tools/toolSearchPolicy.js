import {} from './toolAvailability.js';
import { createCcrToolCapabilitySnapshot } from './toolCapabilitySnapshot.js';
export function isCcrToolSearchCandidate(entry, context = {}) {
    return createCcrToolCapabilitySnapshot([entry.tool], context).entries[0]
        ?.searchable === true;
}
export function getCcrToolSearchCandidates(tools, context = {}) {
    return createCcrToolCapabilitySnapshot(tools, context).entries
        .filter(entry => entry.searchable)
        .map(entry => entry.entry.tool);
}
export function summarizeCcrToolSearchCandidates(tools, context = {}) {
    const snapshot = createCcrToolCapabilitySnapshot(tools, context);
    const names = [];
    const excluded = [];
    for (const item of snapshot.entries) {
        if (item.searchable) {
            names.push(item.entry.name);
            continue;
        }
        excluded.push({
            name: item.entry.name,
            exposure: item.entry.exposure,
            available: item.availability.available,
            ...(item.availability.reason ? { reason: item.availability.reason } : {}),
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