import { createHash, randomUUID } from 'node:crypto'
import type {
  CapabilityManagementAction,
  CapabilityManagementItem,
  CapabilityManagementProjection,
} from './managementProjectionService.js'

export type CapabilityManagementActionRequestContext = {
  cwd?: string
  configHomeDir?: string
}

export type CapabilityManagementActionRequest = {
  capabilityId: string
  action: CapabilityManagementAction
  actionRef?: string
  params?: Record<string, unknown>
  context?: CapabilityManagementActionRequestContext
}

export type CapabilityManagementActionApplyRequest =
  CapabilityManagementActionRequest & {
    confirmed?: boolean
    confirmationToken?: string
  }

export type CapabilityManagementActionPlan = {
  schemaVersion: 1
  planId: string
  issuedAt: string
  expiresAt: string
  stateDigest: string
  allowed: boolean
  blockedReason?: string
  request: CapabilityManagementActionRequest
  target?: {
    capabilityId: string
    kind: CapabilityManagementItem['kind']
    name: string
    displayName: string
    managementOwnership: CapabilityManagementItem['managementOwnership']
    actionRef?: string
    metadata?: Record<string, unknown>
  }
  requiresConfirmation: boolean
  confirmation?: {
    token: string
    message: string
    issuedAt: string
    expiresAt: string
    stateDigest: string
  }
  effects: string[]
}

export type CapabilityManagementActionPlanOptions = {
  now?: Date
  tokenTtlMs?: number
  issueConfirmationToken?: boolean
}

export type CapabilityManagementActionApplyOptions = {
  now?: Date
  consumeToken?: boolean
}

type ConfirmationTokenRecord = {
  token: string
  stateDigest: string
  issuedAtMs: number
  expiresAtMs: number
  consumed: boolean
}

const CONFIRMATION_TOKEN_TTL_MS = 5 * 60 * 1000
const confirmationTokenStore = new Map<string, ConfirmationTokenRecord>()

const ACTIONS_REQUIRING_ACTION_REF = new Set<CapabilityManagementAction>([
  'enable',
  'disable',
  'set-model-invocation',
  'set-user-invocation',
  'test',
  'restart',
  'repair',
  'uninstall',
])

const ACTIONS_REQUIRING_CONFIRMATION = new Set<CapabilityManagementAction>([
  'repair',
  'uninstall',
])

export function createCapabilityManagementActionPlan(
  projection: CapabilityManagementProjection,
  request: CapabilityManagementActionRequest,
  options: CapabilityManagementActionPlanOptions = {},
): CapabilityManagementActionPlan {
  const item = projection.capabilities.find(
    capability => capability.capabilityId === request.capabilityId,
  )
  if (!item) {
    return createBlockedPlan(request, 'Capability was not found.', options)
  }

  const targetActionRef = resolveActionRef(item, request)
  const basePlan = createBasePlan(item, request, targetActionRef, options)

  if (!item.allowedActions.includes(request.action)) {
    return blockPlan(
      basePlan,
      `Action "${request.action}" is not allowed for this capability.`,
    )
  }

  if (
    item.actionRef &&
    request.actionRef &&
    request.actionRef !== item.actionRef
  ) {
    return blockPlan(
      basePlan,
      'Action reference does not match the management projection.',
    )
  }

  if (
    ACTIONS_REQUIRING_ACTION_REF.has(request.action) &&
    !targetActionRef
  ) {
    return blockPlan(basePlan, 'Action requires a concrete action reference.')
  }

  const paramsBlockReason = getActionParamsBlockReason(request)
  if (paramsBlockReason) {
    return blockPlan(basePlan, paramsBlockReason)
  }

  return basePlan
}

export function canApplyCapabilityManagementAction(
  plan: CapabilityManagementActionPlan,
  request: CapabilityManagementActionApplyRequest,
  options: CapabilityManagementActionApplyOptions = {},
): { ok: true } | { ok: false; reason: string } {
  if (!plan.allowed) {
    return {
      ok: false,
      reason: plan.blockedReason ?? 'Capability management action is blocked.',
    }
  }
  if (!plan.requiresConfirmation) {
    return { ok: true }
  }
  if (!request.confirmed) {
    return {
      ok: false,
      reason: 'Capability management action requires explicit confirmation.',
    }
  }
  if (!request.confirmationToken) {
    return {
      ok: false,
      reason: 'Capability management action confirmation token is missing.',
    }
  }

  const record = confirmationTokenStore.get(request.confirmationToken)
  if (!record) {
    return {
      ok: false,
      reason: 'Capability management action confirmation token is invalid.',
    }
  }
  if (record.consumed) {
    return {
      ok: false,
      reason: 'Capability management action confirmation token was already used.',
    }
  }

  const nowMs = (options.now ?? new Date()).getTime()
  if (nowMs > record.expiresAtMs) {
    return {
      ok: false,
      reason: 'Capability management action confirmation token has expired.',
    }
  }
  if (record.stateDigest !== plan.stateDigest) {
    return {
      ok: false,
      reason:
        'Capability management action confirmation token no longer matches current state.',
    }
  }

  if (options.consumeToken !== false) {
    // Confirmation tokens are apply-attempt tokens: once the guard accepts the
    // attempt, callers must re-plan after any later domain action failure.
    record.consumed = true
  }
  return { ok: true }
}

export function getCapabilityManagementActionTargetRef(
  plan: CapabilityManagementActionPlan,
): string | undefined {
  return plan.target?.actionRef
}

export function clearCapabilityManagementConfirmationTokensForTests(): void {
  confirmationTokenStore.clear()
}

function createBlockedPlan(
  request: CapabilityManagementActionRequest,
  reason: string,
  options: CapabilityManagementActionPlanOptions,
): CapabilityManagementActionPlan {
  const issuedAt = options.now ?? new Date()
  const expiresAt = new Date(
    issuedAt.getTime() + (options.tokenTtlMs ?? CONFIRMATION_TOKEN_TTL_MS),
  )
  const stateDigest = createStateDigest({ request, reason, target: null })
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
  }
}

function createBasePlan(
  item: CapabilityManagementItem,
  request: CapabilityManagementActionRequest,
  targetActionRef: string | undefined,
  options: CapabilityManagementActionPlanOptions,
): CapabilityManagementActionPlan {
  const issuedAt = options.now ?? new Date()
  const expiresAt = new Date(
    issuedAt.getTime() + (options.tokenTtlMs ?? CONFIRMATION_TOKEN_TTL_MS),
  )
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
  })
  const requiresConfirmation = ACTIONS_REQUIRING_CONFIRMATION.has(request.action)
  const plan: CapabilityManagementActionPlan = {
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
      ...(item.metadata ? { metadata: { ...item.metadata } } : {}),
    },
    requiresConfirmation,
    effects: getActionEffects(item, request.action),
  }

  if (requiresConfirmation && options.issueConfirmationToken !== false) {
    const token = createCapabilityManagementActionConfirmationToken({
      stateDigest,
      issuedAtMs: issuedAt.getTime(),
      expiresAtMs: expiresAt.getTime(),
    })
    plan.confirmation = {
      token,
      message: getConfirmationMessage(item, request.action),
      issuedAt: plan.issuedAt,
      expiresAt: plan.expiresAt,
      stateDigest,
    }
  }

  return plan
}

function blockPlan(
  plan: CapabilityManagementActionPlan,
  blockedReason: string,
): CapabilityManagementActionPlan {
  const { confirmation: _confirmation, ...rest } = plan
  void _confirmation
  return {
    ...rest,
    allowed: false,
    blockedReason,
    requiresConfirmation: false,
    effects: [],
  }
}

function resolveActionRef(
  item: CapabilityManagementItem,
  request: CapabilityManagementActionRequest,
): string | undefined {
  if (request.actionRef) return request.actionRef
  if (item.actionRef) return item.actionRef
  if (item.kind === 'mcp-server') return item.name
  if (request.action === 'inspect') return item.name
  return undefined
}

function getActionParamsBlockReason(
  request: CapabilityManagementActionRequest,
): string | undefined {
  if (
    request.action === 'set-model-invocation' &&
    typeof request.params?.modelInvocable !== 'boolean'
  ) {
    return 'Model invocation action requires params.modelInvocable.'
  }
  if (
    request.action === 'set-user-invocation' &&
    typeof request.params?.userInvocable !== 'boolean'
  ) {
    return 'User invocation action requires params.userInvocable.'
  }
  return undefined
}

function createCapabilityManagementActionConfirmationToken(input: {
  stateDigest: string
  issuedAtMs: number
  expiresAtMs: number
}): string {
  const token = `capability-action:${randomUUID()}`
  confirmationTokenStore.set(token, {
    token,
    stateDigest: input.stateDigest,
    issuedAtMs: input.issuedAtMs,
    expiresAtMs: input.expiresAtMs,
    consumed: false,
  })
  return token
}

function createPlanId(stateDigest: string): string {
  return `capability-plan:${stateDigest.slice(0, 16)}`
}

function createStateDigest(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`
}

function pickDigestState(item: CapabilityManagementItem): Record<string, unknown> {
  return {
    available: item.state.available,
    configured: item.state.configured,
    enabled: item.state.enabled,
    installed: item.state.installed,
    runtimeConnected: item.state.runtimeConnected,
    status: item.state.status,
  }
}

function getConfirmationMessage(
  item: CapabilityManagementItem,
  action: CapabilityManagementAction,
): string {
  if (action === 'repair') {
    return `Repair managed capability "${item.displayName}".`
  }
  if (action === 'uninstall') {
    return `Uninstall managed capability "${item.displayName}".`
  }
  return `Apply "${action}" to "${item.displayName}".`
}

function getActionEffects(
  item: CapabilityManagementItem,
  action: CapabilityManagementAction,
): string[] {
  switch (action) {
    case 'enable':
      return [`Enable ${item.kind} runtime state.`]
    case 'disable':
      return [`Disable ${item.kind} runtime state.`]
    case 'set-model-invocation':
      return ['Update model invocation permission.']
    case 'set-user-invocation':
      return ['Update user invocation permission.']
    case 'inspect':
      return ['Inspect capability state.']
    case 'test':
      return ['Run capability diagnostics.']
    case 'restart':
      return ['Request runtime restart.']
    case 'repair':
      return ['Repair installer-owned package or configuration.']
    case 'uninstall':
      return ['Remove installer-owned package or configuration.']
  }
}
