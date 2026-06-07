import { getCcrToolAvailability, } from './toolAvailability.js';
import { buildCcrToolRegistry, } from './toolRegistry.js';
export function createCcrToolCapabilitySnapshot(tools, context = {}) {
    const registry = buildCcrToolRegistry(tools);
    const entries = registry.entries.map(entry => {
        const availability = getCcrToolAvailability(entry, context);
        return {
            entry,
            availability,
            searchable: entry.exposure === 'deferred' && availability.available,
        };
    });
    return {
        schemaVersion: 1,
        entries,
        summary: {
            total: entries.length,
            searchable: entries.filter(item => item.searchable).length,
            available: entries.filter(item => item.availability.available).length,
            direct: entries.filter(item => item.entry.exposure === 'direct').length,
            deferred: entries.filter(item => item.entry.exposure === 'deferred').length,
            internal: entries.filter(item => item.entry.exposure === 'internal').length,
        },
    };
}
//# sourceMappingURL=toolCapabilitySnapshot.js.map