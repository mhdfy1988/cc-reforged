const AVAILABILITY_BLOCKING_REASONS = new Set([
    'disabled',
    'no-invocation-surface',
    'tool-denied',
    'missing-package',
    'missing-skill-md',
    'missing-owner-marker',
    'missing-lock',
    'drifted',
    'invalid',
    'conflict-loser',
    'unsupported-kind',
    'source-unavailable',
    'plugin-disabled',
    'plugin-missing',
    'app-disabled',
    'app-disconnected',
    'app-needs-auth',
    'app-missing',
    'app-ambiguous',
    'mcp-server-unavailable',
]);
export function resolveCapabilityRuntimeVisibility(capability) {
    const hiddenReasons = collectHiddenReasons(capability);
    const runtimeVisible = hiddenReasons.some(reason => AVAILABILITY_BLOCKING_REASONS.has(reason))
        ? false
        : capability.state.runtimeVisible;
    const available = hiddenReasons.some(reason => AVAILABILITY_BLOCKING_REASONS.has(reason))
        ? false
        : capability.state.available;
    return {
        ...capability,
        state: {
            ...capability.state,
            available,
            runtimeVisible,
            hiddenReasons,
        },
        diagnostics: mergeRuntimeDiagnostics(capability.diagnostics, hiddenReasons),
    };
}
export function markCapabilityHiddenByConflict(capability, diagnostic) {
    capability.state.runtimeVisible = false;
    capability.state.available = false;
    capability.state.status = 'hidden-by-conflict';
    capability.state.hiddenReasons = appendHiddenReason(capability.state.hiddenReasons ?? [], 'conflict-loser');
    capability.diagnostics.push(diagnostic);
}
function collectHiddenReasons(capability) {
    let reasons = capability.state.hiddenReasons ?? [];
    if (!capability.state.enabled || capability.state.status === 'disabled') {
        reasons = appendHiddenReason(reasons, 'disabled');
    }
    switch (capability.state.status) {
        case 'missing':
            reasons = appendHiddenReason(reasons, 'missing-package');
            break;
        case 'drifted':
            reasons = appendHiddenReason(reasons, 'drifted');
            break;
        case 'invalid':
            reasons = appendHiddenReason(reasons, 'invalid');
            break;
        case 'failed':
        case 'needs-auth':
        case 'unavailable':
            reasons = appendHiddenReason(reasons, 'source-unavailable');
            break;
        case 'hidden-by-conflict':
            reasons = appendHiddenReason(reasons, 'conflict-loser');
            break;
        case 'available':
        case 'enabled':
        case 'disabled':
            break;
    }
    reasons = appendInspectionHiddenReason(reasons, capability.metadata?.hiddenReason);
    if (capability.kind === 'skill') {
        if (!capability.invocation.modelInvocable) {
            reasons = appendHiddenReason(reasons, 'model-invocation-disabled');
        }
        if (!capability.invocation.userInvocable) {
            reasons = appendHiddenReason(reasons, 'user-invocation-disabled');
        }
        if (!capability.invocation.modelInvocable &&
            !capability.invocation.userInvocable) {
            reasons = appendHiddenReason(reasons, 'no-invocation-surface');
        }
    }
    if (capability.kind === 'tool' || capability.kind === 'mcp-tool') {
        if (!capability.invocation.toolInvocable) {
            reasons = appendHiddenReason(reasons, 'tool-denied');
        }
    }
    if (capability.kind === 'plugin' && !capability.state.enabled) {
        reasons = appendHiddenReason(reasons, 'plugin-disabled');
    }
    if (capability.kind === 'mcp-server' && !capability.state.enabled) {
        reasons = appendHiddenReason(reasons, 'mcp-server-unavailable');
    }
    return reasons;
}
function appendInspectionHiddenReason(reasons, rawReason) {
    if (typeof rawReason !== 'string')
        return [...reasons];
    switch (rawReason) {
        case 'disabled':
            return appendHiddenReason(reasons, 'disabled');
        case 'duplicate-name':
            return appendHiddenReason(reasons, 'conflict-loser');
        case 'inspection:missing-package':
        case 'missing-package':
            return appendHiddenReason(reasons, 'missing-package');
        case 'inspection:missing-skill-md':
        case 'missing-skill-md':
            return appendHiddenReason(reasons, 'missing-skill-md');
        case 'inspection:missing-owner-marker':
        case 'missing-owner-marker':
            return appendHiddenReason(reasons, 'missing-owner-marker');
        case 'inspection:missing-lock':
        case 'missing-lock':
            return appendHiddenReason(reasons, 'missing-lock');
        case 'inspection:drifted':
        case 'drifted':
            return appendHiddenReason(reasons, 'drifted');
        case 'inspection:invalid':
        case 'invalid':
            return appendHiddenReason(reasons, 'invalid');
        default:
            if (rawReason.startsWith('inspection:missing')) {
                return appendHiddenReason(reasons, 'missing-package');
            }
            return [...reasons];
    }
}
function appendHiddenReason(reasons, reason) {
    return reasons.includes(reason) ? [...reasons] : [...reasons, reason];
}
function mergeRuntimeDiagnostics(diagnostics, hiddenReasons) {
    const existing = new Set(diagnostics
        .map(diagnostic => diagnostic.code)
        .filter((code) => typeof code === 'string'));
    const additions = hiddenReasons
        .filter(reason => !existing.has(`runtime-${reason}`))
        .map(reason => hiddenReasonToDiagnostic(reason));
    return [...diagnostics, ...additions];
}
function hiddenReasonToDiagnostic(reason) {
    return {
        kind: hiddenReasonDiagnosticKind(reason),
        severity: hiddenReasonDiagnosticSeverity(reason),
        code: `runtime-${reason}`,
        message: hiddenReasonMessage(reason),
    };
}
function hiddenReasonDiagnosticKind(reason) {
    switch (reason) {
        case 'conflict-loser':
            return 'conflict';
        case 'missing-package':
        case 'missing-skill-md':
        case 'missing-owner-marker':
        case 'missing-lock':
        case 'drifted':
        case 'invalid':
            return 'integrity';
        case 'plugin-disabled':
        case 'plugin-missing':
            return 'plugin';
        case 'app-disabled':
        case 'app-needs-auth':
        case 'app-missing':
        case 'app-ambiguous':
            return 'source';
        default:
            return 'runtime';
    }
}
function hiddenReasonDiagnosticSeverity(reason) {
    switch (reason) {
        case 'missing-package':
        case 'missing-skill-md':
        case 'missing-owner-marker':
        case 'missing-lock':
        case 'drifted':
        case 'invalid':
        case 'source-unavailable':
        case 'mcp-server-unavailable':
        case 'plugin-missing':
        case 'app-missing':
        case 'app-ambiguous':
            return 'error';
        case 'conflict-loser':
        case 'tool-denied':
        case 'unsupported-kind':
        case 'no-invocation-surface':
            return 'warning';
        default:
            return 'info';
    }
}
function hiddenReasonMessage(reason) {
    switch (reason) {
        case 'disabled':
            return 'Capability is disabled.';
        case 'model-invocation-disabled':
            return 'Capability cannot be invoked by the model.';
        case 'user-invocation-disabled':
            return 'Capability cannot be invoked directly by the user.';
        case 'no-invocation-surface':
            return 'Capability has no active invocation surface.';
        case 'tool-denied':
            return 'Tool invocation is unavailable.';
        case 'missing-package':
            return 'Installed package directory is missing.';
        case 'missing-skill-md':
            return 'Installed skill package is missing SKILL.md.';
        case 'missing-owner-marker':
            return 'Installed skill package owner marker is missing or invalid.';
        case 'missing-lock':
            return 'Installed skill package lock record is missing.';
        case 'drifted':
            return 'Installed package integrity drift was detected.';
        case 'invalid':
            return 'Capability metadata or package is invalid.';
        case 'conflict-loser':
            return 'Capability is hidden because another capability owns the same runtime key.';
        case 'unsupported-kind':
            return 'Capability kind is unsupported for this runtime surface.';
        case 'source-unavailable':
            return 'Capability source is unavailable.';
        case 'plugin-disabled':
            return 'Parent plugin is disabled.';
        case 'plugin-missing':
            return 'Parent plugin is missing from the capability snapshot.';
        case 'app-disabled':
            return 'Parent app connector is disabled.';
        case 'app-needs-auth':
            return 'Parent app connector requires authentication.';
        case 'app-missing':
            return 'Parent app connector is missing from the capability snapshot.';
        case 'app-ambiguous':
            return 'Multiple app connectors claim the same capability.';
        case 'mcp-server-unavailable':
            return 'MCP server is unavailable.';
    }
}
//# sourceMappingURL=capabilityRuntimeVisibility.js.map