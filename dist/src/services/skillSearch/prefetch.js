import { planSkillContextInjection, } from '../../skills/skillContextInjectionPlanner.js';
import { recordDiscoveredSkill } from '../../skills/skillVisibilityLedger.js';
import { createSkillDiscoveryIndex, discoverSkills, filterAlreadySurfacedSkillDiscoveryIndex, isSkillCatalogQuery, } from './skillDiscoveryService.js';
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
export function startSkillDiscoveryPrefetch(input, messages, toolUseContext) {
    return getSkillDiscoveryAttachments(input ?? '', messages, toolUseContext)
        .then(attachments => ({
        kind: 'attachments',
        attachments,
    }))
        .catch(error => ({
        kind: 'unavailable',
        error: error instanceof SkillDiscoveryPrefetchUnavailableError
            ? error
            : new SkillDiscoveryPrefetchUnavailableError(String(error)),
    }));
}
export async function collectSkillDiscoveryPrefetch(handle) {
    const result = await handle;
    if (result.kind === 'unavailable') {
        throw result.error;
    }
    return result.attachments;
}
export async function getTurnZeroSkillDiscovery(input, messages, toolUseContext) {
    return getSkillDiscoveryAttachments(input, messages, toolUseContext);
}
export async function discoverRuntimeSkills(query, toolUseContext, options = {}) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
        return {
            query: '',
            matches: [],
            totalIndexedSkills: 0,
            catalogQuery: false,
            diagnostics: [],
        };
    }
    const catalog = await buildRuntimeSkillDiscoveryCatalog(toolUseContext);
    const catalogQuery = isSkillCatalogQuery(normalizedQuery);
    const index = catalogQuery
        ? catalog.index
        : filterAlreadySurfacedSkillDiscoveryIndex(catalog.index, toolUseContext);
    const discovery = discoverSkills(index, normalizedQuery, options);
    return {
        ...discovery,
        totalIndexedSkills: catalog.index.length,
        diagnostics: catalog.diagnostics,
    };
}
export async function buildRuntimeSkillDiscoveryCatalog(toolUseContext) {
    const { loadModelInvocableSkillRuntimeCatalog } = await import('../../skills/skillRuntimeCatalogLoader.js');
    const runtimeCatalog = await loadModelInvocableSkillRuntimeCatalog(toolUseContext);
    const plan = planSkillContextInjection(runtimeCatalog.catalog.commands, {
        skillSearchEnabled: true,
    });
    return {
        index: createSkillDiscoveryIndex(plan.discoveryCandidates),
        diagnostics: runtimeCatalog.catalog.diagnostics,
    };
}
export async function buildRuntimeSkillDiscoveryIndex(toolUseContext) {
    return (await buildRuntimeSkillDiscoveryCatalog(toolUseContext)).index;
}
export function getInterTurnSkillDiscoverySignal(messages) {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (!message || message.type !== 'user')
            continue;
        const content = message.message.content;
        if (!Array.isArray(content))
            continue;
        const parts = content
            .filter((block) => Boolean(block) &&
            typeof block === 'object' &&
            block.type === 'tool_result' &&
            block.is_error !== true)
            .flatMap(block => toolResultContentToText(block.content))
            .map(part => part.trim())
            .filter(Boolean);
        if (parts.length > 0) {
            return parts.join('\n').slice(0, 2_000);
        }
    }
    return null;
}
export { isSkillCatalogQuery };
async function getSkillDiscoveryAttachments(input, _messages, toolUseContext) {
    const result = await discoverRuntimeSkills(input, toolUseContext, isSkillCatalogQuery(input) ? {} : { limit: 1 });
    if (result.matches.length === 0)
        return [];
    const skills = result.matches.map(match => ({
        capabilityId: match.entry.capabilityId,
        name: match.entry.name,
        description: match.entry.description,
        sourceKind: match.entry.sourceKind,
        reason: match.reason,
    }));
    for (const match of result.matches) {
        recordDiscoveredSkill(toolUseContext, {
            name: match.entry.name,
            capabilityId: match.entry.capabilityId,
        });
    }
    return [
        {
            type: 'skill_discovery',
            skills,
            signal: { cli: [result.query] },
            source: 'native',
        },
    ];
}
function toolResultContentToText(content) {
    if (typeof content === 'string')
        return [content];
    if (!Array.isArray(content))
        return [];
    return content.flatMap(block => {
        if (block &&
            typeof block === 'object' &&
            'type' in block &&
            block.type === 'text' &&
            'text' in block &&
            typeof block.text === 'string') {
            return [block.text];
        }
        return [];
    });
}
//# sourceMappingURL=prefetch.js.map