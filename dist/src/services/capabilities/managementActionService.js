import { createHash, randomUUID } from 'node:crypto';
const CONFIRMATION_TOKEN_TTL_MS = 5 * 60 * 1000;
const confirmationTokenStore = new Map();
const ACTIONS_REQUIRING_ACTION_REF = new Set([
    'enable',
    'disable',
    'set-model-invocation',
    'set-user-invocation',
    'test',
    'restart',
    'repair',
    'uninstall',
]);
const ACTIONS_REQUIRING_CONFIRMATION = new Set([
    'repair',
    'uninstall',
]);
export function createCapabilityManagementActionPlan(projection, request, options = {}) {
    const item = projection.capabilities.find(capability => capability.capabilityId === request.capabilityId);
    if (!item) {
        return createBlockedPlan(request, 'Capability was not found.', options);
    }
    const targetActionRef = resolveActionRef(item, request);
    const basePlan = createBasePlan(item, request, targetActionRef, options);
    if (!item.allowedActions.includes(request.action)) {
        return blockPlan(basePlan, `Action "${request.action}" is not allowed for this capability.`);
    }
    if (item.actionRef &&
        request.actionRef &&
        request.actionRef !== item.actionRef) {
        return blockPlan(basePlan, 'Action reference does not match the management projection.');
    }
    if (ACTIONS_REQUIRING_ACTION_REF.has(request.action) &&
        !targetActionRef) {
        return blockPlan(basePlan, 'Action requires a concrete action reference.');
    }
    const paramsBlockReason = getActionParamsBlockReason(request);
    if (paramsBlockReason) {
        return blockPlan(basePlan, paramsBlockReason);
    }
    return basePlan;
}
export function canApplyCapabilityManagementAction(plan, request, options = {}) {
    if (!plan.allowed) {
        return {
            ok: false,
            reason: plan.blockedReason ?? 'Capability management action is blocked.',
        };
    }
    if (!plan.requiresConfirmation) {
        return { ok: true };
    }
    if (!request.confirmed) {
        return {
            ok: false,
            reason: 'Capability management action requires explicit confirmation.',
        };
    }
    if (!request.confirmationToken) {
        return {
            ok: false,
            reason: 'Capability management action confirmation token is missing.',
        };
    }
    const record = confirmationTokenStore.get(request.confirmationToken);
    if (!record) {
        return {
            ok: false,
            reason: 'Capability management action confirmation token is invalid.',
        };
    }
    if (record.consumed) {
        return {
            ok: false,
            reason: 'Capability management action confirmation token was already used.',
        };
    }
    const nowMs = (options.now ?? new Date()).getTime();
    if (nowMs > record.expiresAtMs) {
        return {
            ok: false,
            reason: 'Capability management action confirmation token has expired.',
        };
    }
    if (record.stateDigest !== plan.stateDigest) {
        return {
            ok: false,
            reason: 'Capability management action confirmation token no longer matches current state.',
        };
    }
    if (options.consumeToken !== false) {
        // Confirmation tokens are apply-attempt tokens: once the guard accepts the
        // attempt, callers must re-plan after any later domain action failure.
        record.consumed = true;
    }
    return { ok: true };
}
export function getCapabilityManagementActionTargetRef(plan) {
    return plan.target?.actionRef;
}
export function clearCapabilityManagementConfirmationTokensForTests() {
    confirmationTokenStore.clear();
}
function createBlockedPlan(request, reason, options) {
    const issuedAt = options.now ?? new Date();
    const expiresAt = new Date(issuedAt.getTime() + (options.tokenTtlMs ?? CONFIRMATION_TOKEN_TTL_MS));
    const stateDigest = createStateDigest({ request, reason, target: null });
    return {
        schemaVersion: 1,
        planId: createPlanId(stateDigest),
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        stateDigest,
        allowed: false,
        blockedReason: reason,
        request,
        requiresConfirmation: false,
        effects: [],
    };
}
function createBasePlan(item, request, targetActionRef, options) {
    const issuedAt = options.now ?? new Date();
    const expiresAt = new Date(issuedAt.getTime() + (options.tokenTtlMs ?? CONFIRMATION_TOKEN_TTL_MS));
    const stateDigest = createStateDigest({
        request,
        target: {
            capabilityId: item.capabilityId,
            action: request.action,
            actionRef: targetActionRef,
            managementOwnership: item.managementOwnership,
            allowedActions: [...item.allowedActions].sort(),
            state: pickDigestState(item),
        },
    });
    const requiresConfirmation = ACTIONS_REQUIRING_CONFIRMATION.has(request.action);
    const plan = {
        schemaVersion: 1,
        planId: createPlanId(stateDigest),
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        stateDigest,
        allowed: true,
        request,
        target: {
            capabilityId: item.capabilityId,
            kind: item.kind,
            name: item.name,
            displayName: item.displayName,
            managementOwnership: item.managementOwnership,
            ...(targetActionRef ? { actionRef: targetActionRef } : {}),
        },
        requiresConfirmation,
        effects: getActionEffects(item, request.action),
    };
    if (requiresConfirmation && options.issueConfirmationToken !== false) {
        const token = createCapabilityManagementActionConfirmationToken({
            stateDigest,
            issuedAtMs: issuedAt.getTime(),
            expiresAtMs: expiresAt.getTime(),
        });
        plan.confirmation = {
            token,
            message: getConfirmationMessage(item, request.action),
            issuedAt: plan.issuedAt,
            expiresAt: plan.expiresAt,
            stateDigest,
        };
    }
    return plan;
}
function blockPlan(plan, blockedReason) {
    const { confirmation: _confirmation, ...rest } = plan;
    void _confirmation;
    return {
        ...rest,
        allowed: false,
        blockedReason,
        requiresConfirmation: false,
        effects: [],
    };
}
function resolveActionRef(item, request) {
    if (request.actionRef)
        return request.actionRef;
    if (item.actionRef)
        return item.actionRef;
    if (item.kind === 'mcp-server')
        return item.name;
    if (request.action === 'inspect')
        return item.name;
    return undefined;
}
function getActionParamsBlockReason(request) {
    if (request.action === 'set-model-invocation' &&
        typeof request.params?.modelInvocable !== 'boolean') {
        return 'Model invocation action requires params.modelInvocable.';
    }
    if (request.action === 'set-user-invocation' &&
        typeof request.params?.userInvocable !== 'boolean') {
        return 'User invocation action requires params.userInvocable.';
    }
    return undefined;
}
function createCapabilityManagementActionConfirmationToken(input) {
    const token = `capability-action:${randomUUID()}`;
    confirmationTokenStore.set(token, {
        token,
        stateDigest: input.stateDigest,
        issuedAtMs: input.issuedAtMs,
        expiresAtMs: input.expiresAtMs,
        consumed: false,
    });
    return token;
}
function createPlanId(stateDigest) {
    return `capability-plan:${stateDigest.slice(0, 16)}`;
}
function createStateDigest(input) {
    return createHash('sha256').update(stableStringify(input)).digest('hex');
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(item => stableStringify(item)).join(',')}]`;
    }
    const entries = Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
        .join(',')}}`;
}
function pickDigestState(item) {
    return {
        available: item.state.available,
        configured: item.state.configured,
        enabled: item.state.enabled,
        installed: item.state.installed,
        runtimeConnected: item.state.runtimeConnected,
        status: item.state.status,
    };
}
function getConfirmationMessage(item, action) {
    if (action === 'repair') {
        return `Repair managed capability "${item.displayName}".`;
    }
    if (action === 'uninstall') {
        return `Uninstall managed capability "${item.displayName}".`;
    }
    return `Apply "${action}" to "${item.displayName}".`;
}
function getActionEffects(item, action) {
    switch (action) {
        case 'enable':
            return [`Enable ${item.kind} runtime state.`];
        case 'disable':
            return [`Disable ${item.kind} runtime state.`];
        case 'set-model-invocation':
            return ['Update model invocation permission.'];
        case 'set-user-invocation':
            return ['Update user invocation permission.'];
        case 'inspect':
            return ['Inspect capability state.'];
        case 'test':
            return ['Run capability diagnostics.'];
        case 'restart':
            return ['Request runtime restart.'];
        case 'repair':
            return ['Repair installer-owned package or configuration.'];
        case 'uninstall':
            return ['Remove installer-owned package or configuration.'];
    }
}
//# sourceMappingURL=managementActionService.js.map