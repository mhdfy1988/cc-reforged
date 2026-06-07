import assert from 'node:assert/strict'

import {
  createSkillManagementViewItems,
  getSkillManagementActionRef,
  getSkillManagementToggleEnabledTarget,
} from '../dist/src/services/capabilities/skillManagementViewProjection.js'

const installed = [
  inspection({
    lockKey: 'skill:user:shared',
    name: 'shared-skill',
    status: 'installed',
  }),
  inspection({
    lockKey: 'skill:user:missing',
    name: 'missing-installed',
    status: 'missing-package',
  }),
]

const management = {
  skills: [
    skillCapability({
      capabilityId: 'skill:managed:shared',
      name: 'shared-skill',
      source: { kind: 'managed-skill', label: 'ccr' },
      relations: { installedRef: 'skill:user:shared' },
      actionRef: 'skill:user:shared',
      managementOwnership: 'installer-owned',
      allowedActions: [
        'disable',
        'set-model-invocation',
        'set-user-invocation',
        'inspect',
        'repair',
        'uninstall',
      ],
      state: { installed: true, enabled: true, runtimeVisible: true },
    }),
    skillCapability({
      capabilityId: 'skill:user:shared',
      name: 'shared-skill',
      source: { kind: 'user-skill', label: 'user' },
      managementOwnership: 'runtime-only',
      allowedActions: ['inspect'],
      state: { installed: false, enabled: true, runtimeVisible: true },
    }),
    skillCapability({
      capabilityId: 'skill:plugin:review',
      name: 'plugin-review',
      source: { kind: 'plugin', label: 'GitHub', pluginId: 'github' },
      relations: { parentPluginId: 'github' },
      managementOwnership: 'plugin-owned',
      allowedActions: ['inspect'],
    }),
    skillCapability({
      capabilityId: 'skill:mcp:browser',
      name: 'mcp-browser',
      source: { kind: 'mcp', label: 'Browser MCP', mcpServerName: 'browser' },
      relations: { parentMcpServerName: 'browser' },
      managementOwnership: 'runtime-only',
      allowedActions: ['inspect'],
    }),
    skillCapability({
      capabilityId: 'skill:dynamic:hint',
      name: 'dynamic-hint',
      source: { kind: 'dynamic', label: 'dynamic discovery' },
      managementOwnership: 'runtime-only',
      allowedActions: ['inspect'],
      invocation: { modelInvocable: false, userInvocable: true },
      state: {
        installed: false,
        enabled: true,
        runtimeVisible: false,
        status: 'unavailable',
        hiddenReasons: ['model-invocation-disabled'],
      },
    }),
    skillCapability({
      capabilityId: 'skill:managed:missing',
      name: 'missing-installed',
      source: { kind: 'managed-skill', label: 'ccr' },
      relations: { installedRef: 'skill:user:missing' },
      actionRef: 'skill:user:missing',
      managementOwnership: 'installer-owned',
      allowedActions: [
        'enable',
        'set-model-invocation',
        'set-user-invocation',
        'inspect',
        'repair',
        'uninstall',
      ],
      state: {
        installed: true,
        enabled: false,
        runtimeVisible: false,
        status: 'missing',
        hiddenReasons: ['missing-package'],
      },
      diagnostics: [
        {
          kind: 'integrity',
          severity: 'error',
          message: 'Skill package directory is missing.',
        },
      ],
    }),
  ],
}

const viewItems = createSkillManagementViewItems({ management, installed })
const byId = new Map(
  viewItems.map(item => [item.capability.capabilityId, item]),
)

assert.equal(viewItems.length, 6)
assert.deepEqual(
  Array.from(byId.keys()).sort(),
  [
    'skill:dynamic:hint',
    'skill:managed:missing',
    'skill:managed:shared',
    'skill:mcp:browser',
    'skill:plugin:review',
    'skill:user:shared',
  ],
)

const managedShared = byId.get('skill:managed:shared')
assert.equal(managedShared.inspection.lockKey, 'skill:user:shared')
assert.deepEqual(getSkillManagementToggleEnabledTarget(managedShared), {
  skillRef: 'skill:user:shared',
  enabled: false,
})
assert.equal(
  getSkillManagementActionRef(managedShared, 'uninstall'),
  'skill:user:shared',
)

const userShared = byId.get('skill:user:shared')
assert.equal(userShared.inspection, null)
assert.equal(getSkillManagementActionRef(userShared, 'repair'), null)
assert.equal(getSkillManagementToggleEnabledTarget(userShared), null)

const pluginSkill = byId.get('skill:plugin:review')
assert.equal(pluginSkill.capability.managementOwnership, 'plugin-owned')
assert.equal(getSkillManagementActionRef(pluginSkill, 'uninstall'), null)

const mcpSkill = byId.get('skill:mcp:browser')
assert.equal(mcpSkill.capability.relations.parentMcpServerName, 'browser')
assert.equal(getSkillManagementActionRef(mcpSkill, 'repair'), null)

const dynamicSkill = byId.get('skill:dynamic:hint')
assert.equal(dynamicSkill.capability.state.runtimeVisible, false)
assert.deepEqual(dynamicSkill.capability.hiddenReasons, [
  'model-invocation-disabled',
])

const missingInstalled = byId.get('skill:managed:missing')
assert.equal(missingInstalled.inspection.status, 'missing-package')
assert.equal(
  getSkillManagementActionRef(missingInstalled, 'repair'),
  'skill:user:missing',
)
assert.deepEqual(getSkillManagementToggleEnabledTarget(missingInstalled), {
  skillRef: 'skill:user:missing',
  enabled: true,
})

console.log('smoke-desktop-skill-management-projection: ok')

function inspection(input) {
  return {
    schemaVersion: 1,
    lockKey: input.lockKey,
    name: input.name,
    status: input.status,
    statusMessage: input.status,
    installedRecord: {
      lockKey: input.lockKey,
      name: input.name,
    },
  }
}

function skillCapability(input) {
  const state = input.state ?? {}
  const invocation = input.invocation ?? {}
  return {
    capabilityId: input.capabilityId,
    kind: 'skill',
    name: input.name,
    displayName: input.name,
    description: `${input.name} fixture`,
    source: input.source,
    relations: input.relations ?? {},
    state: {
      installed: false,
      enabled: true,
      available: true,
      runtimeVisible: true,
      status: 'enabled',
      hiddenReasons: [],
      ...state,
    },
    invocation: {
      modelInvocable: true,
      userInvocable: true,
      toolInvocable: false,
      ...invocation,
    },
    hiddenReasons: state.hiddenReasons ?? [],
    diagnostics: input.diagnostics ?? [],
    managementOwnership: input.managementOwnership,
    ...(input.actionRef ? { actionRef: input.actionRef } : {}),
    allowedActions: input.allowedActions,
    metadata: input.metadata ?? {},
  }
}
