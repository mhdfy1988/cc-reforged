export class SkillDiscoveryPrefetchUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SkillDiscoveryPrefetchUnavailableError';
    }
}
export function isSkillDiscoveryPrefetchUnavailableError(error) {
    return (error instanceof Error &&
        error.name === 'SkillDiscoveryPrefetchUnavailableError');
}
function unavailable(message) {
    return {
        kind: 'unavailable',
        error: new SkillDiscoveryPrefetchUnavailableError(message),
    };
}
export function startSkillDiscoveryPrefetch(_input, _messages, _toolUseContext) {
    return Promise.resolve(unavailable('Skill discovery prefetch is unavailable in this recovery build.'));
}
export async function collectSkillDiscoveryPrefetch(handle) {
    const result = await handle;
    if (result.kind === 'unavailable') {
        throw result.error;
    }
    return result.attachments;
}
export function getTurnZeroSkillDiscovery(_input, _messages, _toolUseContext) {
    return Promise.reject(new SkillDiscoveryPrefetchUnavailableError('Turn-zero skill discovery is unavailable in this recovery build.'));
}
//# sourceMappingURL=prefetch.js.map