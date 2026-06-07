import { resolveSkillCommandRuntimeEligibility, } from './skillCommandRuntimeVisibility.js';
import { applyStaticSkillListingPolicy, } from './skillContextInjectionPolicy.js';
export const DEFAULT_SKILL_CONTEXT_LISTING_MAX = 30;
export function planSkillContextInjection(commands, options) {
    const policy = options.skillSearchEnabled
        ? applyStaticSkillListingPolicy([...commands], {
            filteredListingMax: options.filteredListingMax ?? DEFAULT_SKILL_CONTEXT_LISTING_MAX,
        })
        : applyLegacyFullStaticListingPolicy(commands);
    const staticSkillListing = policy.included.map(decision => decision.command);
    const sentSkillNames = options.sentSkillNames ?? new Set();
    const sentSkillCapabilityIds = options.sentSkillCapabilityIds ?? new Set();
    const newStaticSkillListing = staticSkillListing.filter(command => !hasSentSkillListing(command, sentSkillNames, sentSkillCapabilityIds));
    const discoveryCandidates = commands.flatMap(toDiscoveryCandidate);
    return {
        staticSkillListing,
        newStaticSkillListing,
        discoveryCandidates,
        hidden: policy.hidden,
        diagnostics: policy.diagnostics,
        budgetUsage: {
            staticSkillListingCount: staticSkillListing.length,
            newStaticSkillListingCount: newStaticSkillListing.length,
            discoveryCandidateCount: discoveryCandidates.length,
            hiddenCount: policy.hidden.length,
            filteredListingMax: options.skillSearchEnabled
                ? (options.filteredListingMax ?? DEFAULT_SKILL_CONTEXT_LISTING_MAX)
                : null,
        },
    };
}
function hasSentSkillListing(command, sentSkillNames, sentSkillCapabilityIds) {
    const runtime = resolveSkillCommandRuntimeEligibility(command);
    if (runtime.eligible === true) {
        return (sentSkillCapabilityIds.has(runtime.capability.id) ||
            sentSkillNames.has(command.name));
    }
    return sentSkillNames.has(command.name);
}
function applyLegacyFullStaticListingPolicy(commands) {
    const included = [];
    const hidden = [];
    for (const command of commands) {
        const sourceKind = (command.loadedFrom ??
            'unknown');
        const base = { command, sourceKind };
        const runtime = resolveSkillCommandRuntimeEligibility(command);
        if (runtime.eligible === false) {
            hidden.push({ ...base, reason: runtime.reason });
            continue;
        }
        included.push({ ...base, reason: 'static-managed' });
    }
    return {
        included,
        hidden,
        diagnostics: [],
    };
}
function toDiscoveryCandidate(command) {
    const runtime = resolveSkillCommandRuntimeEligibility(command);
    if (runtime.eligible === false)
        return [];
    const capability = runtime.capability;
    return [
        {
            capabilityId: capability.id,
            name: command.name,
            displayName: command.userFacingName?.() ?? command.name,
            description: command.description,
            whenToUse: command.whenToUse ?? '',
            sourceKind: command.loadedFrom ?? 'unknown',
            ...(capability.relations.parentPluginId
                ? { parentPluginId: capability.relations.parentPluginId }
                : {}),
            ...(capability.relations.parentMcpServerName
                ? { parentMcpServerName: capability.relations.parentMcpServerName }
                : {}),
            modelInvocable: true,
            userInvocable: capability.invocation.userInvocable,
            runtimeVisible: true,
            command: runtime.command,
        },
    ];
}
//# sourceMappingURL=skillContextInjectionPlanner.js.map