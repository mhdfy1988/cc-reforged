import assert from 'node:assert/strict'
import { buildExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'
import {
  getSkillCommandModelInvocationBlocker,
  getSkillCommandCapabilityId,
  resolveSkillCommandRuntimeVisibility,
} from '../dist/src/skills/skillCommandRuntimeVisibility.js'
import { createSkillCapabilityId } from '../dist/src/services/capabilities/capabilityIdentity.js'

const catalog = buildExtensionCapabilityCatalog([
  capability({
    id: 'skill:model-off',
    name: 'model-off-helper',
    kind: 'skill',
    invocation: {
      modelInvocable: false,
      userInvocable: true,
      toolInvocable: false,
    },
  }),
  capability({
    id: 'skill:dupe-project',
    name: 'shared-name',
    kind: 'skill',
    source: { kind: 'project-skill', label: 'project skill' },
  }),
  capability({
    id: 'plugin:bundle@openai',
    name: 'bundle@openai',
    kind: 'plugin',
    source: {
      kind: 'plugin',
      label: 'plugin',
      pluginId: 'bundle@openai',
    },
    relations: { parentPluginId: 'bundle@openai' },
    state: {
      installed: true,
      enabled: true,
      available: true,
      runtimeVisible: false,
      status: 'enabled',
    },
    invocation: {
      modelInvocable: false,
      userInvocable: false,
      toolInvocable: false,
    },
  }),
  capability({
    id: 'skill:dupe-plugin',
    name: 'shared-name',
    kind: 'skill',
    source: { kind: 'plugin', label: 'plugin skill', pluginId: 'bundle@openai' },
    relations: { parentPluginId: 'bundle@openai' },
  }),
  capability({
    id: 'mcp-server:server',
    name: 'server',
    kind: 'mcp-server',
    state: {
      installed: true,
      enabled: true,
      available: true,
      runtimeVisible: false,
      status: 'enabled',
    },
    invocation: {
      modelInvocable: false,
      userInvocable: false,
      toolInvocable: false,
    },
  }),
  capability({
    id: 'mcp-tool:shared-name',
    name: 'shared-name',
    kind: 'mcp-tool',
    source: { kind: 'mcp', label: 'MCP server', mcpServerName: 'server' },
    relations: { parentMcpServerName: 'server' },
    invocation: {
      modelInvocable: true,
      userInvocable: false,
      toolInvocable: true,
    },
  }),
  capability({
    id: 'skill:missing-md',
    name: 'missing-md',
    kind: 'skill',
    state: {
      installed: true,
      enabled: true,
      available: false,
      runtimeVisible: true,
      status: 'missing',
    },
    metadata: {
      hiddenReason: 'inspection:missing-skill-md',
    },
  }),
])

const byId = new Map(catalog.capabilities.map(item => [item.id, item]))

const modelOff = byId.get('skill:model-off')
assert.equal(modelOff.state.status, 'enabled')
assert.equal(modelOff.state.available, true)
assert.equal(modelOff.state.runtimeVisible, true)
assert.equal(
  modelOff.state.hiddenReasons.includes('model-invocation-disabled'),
  true,
)
assert.equal(modelOff.state.hiddenReasons.includes('disabled'), false)

const conflictLoser = byId.get('skill:dupe-plugin')
assert.equal(conflictLoser.state.status, 'hidden-by-conflict')
assert.equal(conflictLoser.state.runtimeVisible, false)
assert.equal(conflictLoser.state.hiddenReasons.includes('conflict-loser'), true)

const mcpTool = byId.get('mcp-tool:shared-name')
assert.equal(mcpTool.state.runtimeVisible, true)
assert.equal(mcpTool.state.hiddenReasons.includes('conflict-loser'), false)

const missing = byId.get('skill:missing-md')
assert.equal(missing.state.runtimeVisible, false)
assert.equal(missing.state.hiddenReasons.includes('missing-package'), true)
assert.equal(missing.state.hiddenReasons.includes('missing-skill-md'), true)

const orphanCatalog = buildExtensionCapabilityCatalog([
  capability({
    id: 'skill:plugin:orphan',
    name: 'orphan-plugin-skill',
    kind: 'skill',
    source: {
      kind: 'plugin',
      label: 'missing plugin skill',
      pluginId: 'missing-plugin',
    },
    relations: { parentPluginId: 'missing-plugin' },
  }),
])
const orphan = orphanCatalog.capabilities.find(
  item => item.id === 'skill:plugin:orphan',
)
assert.equal(orphan.state.runtimeVisible, true)
assert.equal(orphan.state.hiddenReasons.includes('plugin-disabled'), false)
assert.equal(
  orphan.diagnostics.some(
    item => item.kind === 'plugin' && item.code === 'parent-plugin-missing',
  ),
  true,
)

assert.equal(catalog.diagnostics.length, 1)
assert.equal(catalog.summary.byStatus['hidden-by-conflict'], 1)

const userOnlyCommand = promptCommand('user-only-skill', {
  disableModelInvocation: true,
  userInvocable: true,
})
const managedCommand = promptCommand('managed-canonical-id', {
  loadedFrom: 'managed',
  installedSkillRef: 'skill:user:managed-canonical-id',
})
assert.equal(
  getSkillCommandCapabilityId(managedCommand),
  createSkillCapabilityId({
    sourceKind: 'managed-skill',
    name: 'managed-canonical-id',
    loadedFrom: 'managed',
    installedRef: 'skill:user:managed-canonical-id',
  }),
)
const userOnlyCapability = resolveSkillCommandRuntimeVisibility(userOnlyCommand)
assert.equal(userOnlyCapability.state.runtimeVisible, true)
assert.equal(
  userOnlyCapability.state.hiddenReasons.includes('model-invocation-disabled'),
  true,
)
assert.equal(
  getSkillCommandModelInvocationBlocker(userOnlyCommand, 'Skill').errorCode,
  4,
)

const disabledCommand = promptCommand('disabled-skill', {
  isEnabled: () => false,
})
const disabledCapability = resolveSkillCommandRuntimeVisibility(disabledCommand)
assert.equal(disabledCapability.state.runtimeVisible, false)
assert.equal(disabledCapability.state.hiddenReasons.includes('disabled'), true)
assert.equal(
  getSkillCommandModelInvocationBlocker(disabledCommand, 'Skill').errorCode,
  3,
)

function capability(overrides = {}) {
  const kind = overrides.kind ?? 'skill'
  const name = overrides.name ?? overrides.id
  return {
    schemaVersion: 1,
    id: overrides.id,
    name,
    displayName: name,
    description: `${name} description`,
    kind,
    source: overrides.source ?? { kind: 'managed-skill', label: 'managed' },
    state: overrides.state ?? {
      installed: true,
      enabled: true,
      available: true,
      runtimeVisible: true,
      status: 'enabled',
    },
    invocation: overrides.invocation ?? {
      modelInvocable: true,
      userInvocable: true,
      toolInvocable: false,
    },
    relations: overrides.relations ?? {},
    diagnostics: overrides.diagnostics ?? [],
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  }
}

function promptCommand(name, options = {}) {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    source: 'userSettings',
    loadedFrom: 'managed',
    contentLength: 0,
    progressMessage: 'running',
    ...options,
    async getPromptForCommand() {
      return []
    },
  }
}

console.log('smoke-extension-runtime-visibility: ok')
