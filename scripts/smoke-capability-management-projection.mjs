import assert from 'node:assert/strict'
import { createCapabilityManagementProjection } from '../dist/src/services/capabilities/managementProjectionService.js'

const capabilities = [
  capability({
    id: 'skill:installed',
    kind: 'skill',
    name: 'installed',
    relations: { installedRef: 'user:installed' },
    state: { installed: true },
  }),
  capability({
    id: 'skill:runtime-only',
    kind: 'skill',
    name: 'runtime-only',
    source: { kind: 'dynamic', label: 'dynamic' },
    state: {
      installed: false,
      runtimeVisible: false,
      status: 'disabled',
      hiddenReasons: ['model-invocation-disabled'],
    },
  }),
  capability({
    id: 'mcp-server:manual',
    kind: 'mcp-server',
    name: 'manual',
    state: { installed: false, configured: true, runtimeVisible: false },
    metadata: { installKind: 'manual-config', scope: 'user' },
  }),
  capability({
    id: 'mcp-server:project-manual',
    kind: 'mcp-server',
    name: 'project-manual',
    state: { installed: false, configured: true, runtimeVisible: false },
    metadata: { installKind: 'manual-config', scope: 'project' },
  }),
  capability({
    id: 'mcp-server:runtime',
    kind: 'mcp-server',
    name: 'runtime',
    state: {
      installed: false,
      configured: false,
      runtimeConnected: true,
      runtimeVisible: false,
    },
  }),
  capability({
    id: 'plugin:bundle',
    kind: 'plugin',
    name: 'bundle',
    source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
    state: { installed: true, runtimeVisible: false },
    relations: { parentPluginId: 'bundle' },
  }),
  capability({
    id: 'mcp-server:bundle',
    kind: 'mcp-server',
    name: 'bundle-server',
    relations: { parentPluginId: 'bundle' },
    state: { installed: true, runtimeVisible: false },
  }),
  capability({
    id: 'mcp-tool:bundle:review',
    kind: 'mcp-tool',
    name: 'review',
    relations: {
      parentPluginId: 'bundle',
      parentMcpServerName: 'bundle-server',
    },
  }),
]

const projection = createCapabilityManagementProjection({
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  capabilities,
  diagnostics: [],
  summary: {
    total: capabilities.length,
    runtimeVisible: capabilities.filter(item => item.state.runtimeVisible).length,
    byKind: {},
    bySourceKind: {},
    byStatus: {},
  },
})

const byId = new Map(
  projection.capabilities.map(item => [item.capabilityId, item]),
)
const installedSkill = byId.get('skill:installed')
assert.equal(installedSkill.managementOwnership, 'installer-owned')
assert.ok(installedSkill.allowedActions.includes('uninstall'))

const runtimeSkill = byId.get('skill:runtime-only')
assert.equal(runtimeSkill.managementOwnership, 'runtime-only')
assert.equal(runtimeSkill.allowedActions.includes('uninstall'), false)
assert.deepEqual(runtimeSkill.hiddenReasons, ['model-invocation-disabled'])

const manualMcp = byId.get('mcp-server:manual')
assert.equal(manualMcp.managementOwnership, 'manual-config')
assert.deepEqual(manualMcp.allowedActions, [
  'disable',
  'inspect',
  'test',
  'restart',
  'uninstall',
])
assert.equal(manualMcp.allowedActions.includes('uninstall'), true)

const projectManualMcp = byId.get('mcp-server:project-manual')
assert.equal(projectManualMcp.managementOwnership, 'manual-config')
assert.deepEqual(projectManualMcp.allowedActions, [
  'disable',
  'inspect',
  'test',
  'restart',
])
assert.equal(projectManualMcp.allowedActions.includes('uninstall'), false)

const runtimeMcp = byId.get('mcp-server:runtime')
assert.equal(runtimeMcp.managementOwnership, 'runtime-only')
assert.deepEqual(runtimeMcp.allowedActions, ['inspect'])

const pluginMcp = byId.get('mcp-server:bundle')
assert.equal(pluginMcp.managementOwnership, 'plugin-owned')
assert.deepEqual(pluginMcp.allowedActions, ['inspect'])

const plugin = projection.plugins.find(item => item.capabilityId === 'plugin:bundle')
assert.deepEqual(plugin.impact.childCapabilityIds, [
  'mcp-server:bundle',
  'mcp-tool:bundle:review',
])
assert.deepEqual(plugin.impact.affectedRuntimeSurfaces, [
  'mcp-server',
  'mcp-tool',
])

console.log('smoke-capability-management-projection: ok')

function capability(input) {
  const state = input.state ?? {}
  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    displayName: input.name,
    description: `${input.name} fixture`,
    kind: input.kind,
    source: input.source ?? { kind: 'mcp', label: 'fixture' },
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
