import assert from 'node:assert/strict'
import {
  canApplyCapabilityManagementAction,
  clearCapabilityManagementConfirmationTokensForTests,
  createCapabilityManagementActionPlan,
} from '../dist/src/services/capabilities/managementActionService.js'
import { createCapabilityManagementProjection } from '../dist/src/services/capabilities/managementProjectionService.js'

clearCapabilityManagementConfirmationTokensForTests()

const projection = createCapabilityManagementProjection({
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  capabilities: [
    capability({
      id: 'skill:managed',
      kind: 'skill',
      name: 'managed',
      relations: { installedRef: 'user:managed' },
      state: { installed: true, enabled: true, status: 'enabled' },
    }),
    capability({
      id: 'skill:runtime-only',
      kind: 'skill',
      name: 'runtime-only',
      state: { installed: false },
    }),
  ],
  diagnostics: [],
  summary: {
    total: 2,
    runtimeVisible: 2,
    byKind: {},
    bySourceKind: {},
    byStatus: {},
  },
})

const request = {
  capabilityId: 'skill:managed',
  action: 'uninstall',
  actionRef: 'user:managed',
  context: {
    cwd: 'D:/workspace-a',
    configHomeDir: 'D:/ccr-home-a',
  },
}

const first = createCapabilityManagementActionPlan(projection, request)
const second = createCapabilityManagementActionPlan(projection, request)
assert.equal(first.allowed, true)
assert.equal(first.requiresConfirmation, true)
assert.ok(first.planId)
assert.ok(first.issuedAt)
assert.ok(first.expiresAt)
assert.ok(first.stateDigest)
assert.ok(first.confirmation?.token)
assert.ok(second.confirmation?.token)
assert.notEqual(first.confirmation.token, second.confirmation.token)
assert.equal(first.confirmation.token.includes('skill:managed'), false)

const missing = canApplyCapabilityManagementAction(first, request)
assert.equal(missing.ok, false)
assert.match(missing.reason, /explicit confirmation/)

const expired = createCapabilityManagementActionPlan(projection, request, {
  now: new Date('2026-06-07T00:00:00.000Z'),
  tokenTtlMs: 1,
})
const expiredApply = canApplyCapabilityManagementAction(
  expired,
  {
    ...request,
    confirmed: true,
    confirmationToken: expired.confirmation.token,
  },
  { now: new Date('2026-06-07T00:00:00.002Z') },
)
assert.equal(expiredApply.ok, false)
assert.match(expiredApply.reason, /expired/)

const driftTokenPlan = createCapabilityManagementActionPlan(projection, request)
const driftProjection = createCapabilityManagementProjection({
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  capabilities: [
    capability({
      id: 'skill:managed',
      kind: 'skill',
      name: 'managed',
      relations: { installedRef: 'user:managed' },
      state: { installed: true, enabled: false, status: 'disabled' },
    }),
  ],
  diagnostics: [],
  summary: {
    total: 1,
    runtimeVisible: 1,
    byKind: {},
    bySourceKind: {},
    byStatus: {},
  },
})
const driftPlan = createCapabilityManagementActionPlan(driftProjection, request, {
  issueConfirmationToken: false,
})
const driftApply = canApplyCapabilityManagementAction(driftPlan, {
  ...request,
  confirmed: true,
  confirmationToken: driftTokenPlan.confirmation.token,
})
assert.equal(driftApply.ok, false)
assert.match(driftApply.reason, /current state/)

const reusable = createCapabilityManagementActionPlan(projection, request)
const firstUse = canApplyCapabilityManagementAction(reusable, {
  ...request,
  confirmed: true,
  confirmationToken: reusable.confirmation.token,
})
assert.equal(firstUse.ok, true)
const secondUse = canApplyCapabilityManagementAction(reusable, {
  ...request,
  confirmed: true,
  confirmationToken: reusable.confirmation.token,
})
assert.equal(secondUse.ok, false)
assert.match(secondUse.reason, /already used/)

const failedDomainAttempt = createCapabilityManagementActionPlan(projection, request)
const guardBeforeDomainFailure = canApplyCapabilityManagementAction(
  failedDomainAttempt,
  {
    ...request,
    confirmed: true,
    confirmationToken: failedDomainAttempt.confirmation.token,
  },
)
assert.equal(guardBeforeDomainFailure.ok, true)
const retryAfterDomainFailure = canApplyCapabilityManagementAction(
  failedDomainAttempt,
  {
    ...request,
    confirmed: true,
    confirmationToken: failedDomainAttempt.confirmation.token,
  },
)
assert.equal(retryAfterDomainFailure.ok, false)
assert.match(retryAfterDomainFailure.reason, /already used/)

const blocked = createCapabilityManagementActionPlan(projection, {
  capabilityId: 'skill:runtime-only',
  action: 'repair',
  context: request.context,
})
assert.equal(blocked.allowed, false)
assert.equal(blocked.confirmation, undefined)
assert.equal(blocked.requiresConfirmation, false)

const wrongRef = createCapabilityManagementActionPlan(
  projection,
  {
    ...request,
    actionRef: 'user:other',
  },
  { issueConfirmationToken: false },
)
assert.equal(wrongRef.allowed, false)
assert.equal(wrongRef.confirmation, undefined)

console.log('smoke-capability-management-confirmation-token: ok')

function capability(input) {
  const state = input.state ?? {}
  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    displayName: input.name,
    description: `${input.name} fixture`,
    kind: input.kind,
    source: input.source ?? { kind: 'managed-skill', label: 'fixture' },
    state: {
      installed: false,
      enabled: true,
      available: true,
      runtimeVisible: true,
      status: 'available',
      ...state,
    },
    invocation: {
      modelInvocable: input.kind === 'skill',
      userInvocable: input.kind === 'skill',
      toolInvocable: input.kind === 'mcp-tool',
    },
    relations: input.relations ?? {},
    diagnostics: [],
    ...(input.metadata ? { metadata: input.metadata } : {}),
  }
}
