import { resolveSkillCommandRuntimeEligibility } from './skillCommandRuntimeVisibility.js';
export const DEFAULT_STATIC_SKILL_LISTING_MAX = 30;
export function applyStaticSkillListingPolicy(commands, options = {}) {
    const filteredListingMax = options.filteredListingMax ?? DEFAULT_STATIC_SKILL_LISTING_MAX;
    const includedCandidates = [];
    const hidden = [];
    for (const command of commands) {
        const sourceKind = command.loadedFrom ?? 'unknown';
        const base = { command, sourceKind };
        const runtime = resolveSkillCommandRuntimeEligibility(command);
        if (runtime.eligible === false) {
            hidden.push({ ...base, reason: runtime.reason });
            continue;
        }
        if (command.loadedFrom === 'bundled') {
            includedCandidates.push({ ...base, reason: 'static-bundled' });
        }
        else if (command.loadedFrom === 'managed') {
            includedCandidates.push({ ...base, reason: 'static-managed' });
        }
        else if (command.loadedFrom === 'mcp') {
            includedCandidates.push({ ...base, reason: 'static-mcp' });
        }
        else {
            hidden.push({ ...base, reason: 'source-discovery-only' });
        }
    }
    const diagnostics = [];
    if (includedCandidates.length <= filteredListingMax) {
        return {
            included: includedCandidates,
            hidden,
            diagnostics,
        };
    }
    const included = includedCandidates.filter(decision => decision.command.loadedFrom === 'bundled' ||
        decision.command.loadedFrom === 'managed');
    const overBudgetHidden = includedCandidates
        .filter(decision => decision.command.loadedFrom === 'mcp')
        .map(decision => ({ ...decision, reason: 'mcp-over-budget' }));
    diagnostics.push({
        severity: 'info',
        code: 'static_skill_listing_mcp_over_budget',
        message: 'MCP skills were omitted from the static skill listing because bundled + managed + MCP exceeded the static listing budget.',
    });
    return {
        included,
        hidden: [...hidden, ...overBudgetHidden],
        diagnostics,
    };
}
export function filterToStaticSkillListing(commands, options = {}) {
    return applyStaticSkillListingPolicy(commands, options).included.map(decision => decision.command);
}
//# sourceMappingURL=skillContextInjectionPolicy.js.map