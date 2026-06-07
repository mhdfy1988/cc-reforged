import assert from 'node:assert/strict'
import { buildExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'
import { createCapabilityManagementProjection } from '../dist/src/services/capabilities/managementProjectionService.js'
import {
  canApplyCapabilityManagementAction,
  clearCapabilityManagementConfirmationTokensForTests,
  createCapabilityManagementActionPlan,
} from '../dist/src/services/capabilities/managementActionService.js'
import {
  createSkillRuntimeCapabilityCatalog,
  createSkillRuntimeCatalog,
  getSkillRuntimePriority,
  listUserInvocableSkillCommands,
} from '../dist/src/skills/skillRuntimeCatalog.js'
import {
  isSkillAlreadySurfaced,
  recordDiscoveredSkill,
  recordLoadedSkill,
  recordVisibleSkill,
  toSkillVisibilityEntry,
} from '../dist/src/skills/skillVisibilityLedger.js'
import { createCcrToolCapabilitySnapshot } from '../dist/src/services/tools/toolCapabilitySnapshot.js'
import { buildCcrToolRegistry } from '../dist/src/services/tools/toolRegistry.js'
import { listToolCapabilities } from '../dist/src/services/capabilities/toolCapabilityProvider.js'
import { listAppCapabilities } from '../dist/src/services/capabilities/appCapabilityProvider.js'

const MIN_CASES = 50
const cases = []

test('catalog keeps model-off Skill runtime visible', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:model-off',
      name: 'model-off',
      kind: 'skill',
      invocation: { modelInvocable: false, userInvocable: true, toolInvocable: false },
    }),
  )
  assert.equal(item.state.runtimeVisible, true)
  assert.equal(item.state.available, true)
  assertIncludes(item.state.hiddenReasons, 'model-invocation-disabled')
  assertNotIncludes(item.state.hiddenReasons, 'disabled')
})

test('catalog keeps user-off Skill model visible', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:user-off',
      name: 'user-off',
      kind: 'skill',
      invocation: { modelInvocable: true, userInvocable: false, toolInvocable: false },
    }),
  )
  assert.equal(item.state.runtimeVisible, true)
  assertIncludes(item.state.hiddenReasons, 'user-invocation-disabled')
  assertNotIncludes(item.state.hiddenReasons, 'no-invocation-surface')
})

test('catalog blocks Skill with no invocation surface', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:no-surface',
      name: 'no-surface',
      kind: 'skill',
      invocation: { modelInvocable: false, userInvocable: false, toolInvocable: false },
    }),
  )
  assert.equal(item.state.runtimeVisible, false)
  assert.equal(item.state.available, false)
  assertIncludes(item.state.hiddenReasons, 'no-invocation-surface')
})

test('catalog blocks disabled capability', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:disabled',
      name: 'disabled',
      kind: 'skill',
      state: { enabled: false, status: 'disabled', runtimeVisible: true },
    }),
  )
  assert.equal(item.state.runtimeVisible, false)
  assertIncludes(item.state.hiddenReasons, 'disabled')
})

test('catalog maps missing status to missing-package', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:missing',
      name: 'missing',
      kind: 'skill',
      state: { installed: true, status: 'missing' },
    }),
  )
  assert.equal(item.state.runtimeVisible, false)
  assertIncludes(item.state.hiddenReasons, 'missing-package')
})

test('catalog maps missing SKILL.md metadata to hidden reason', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:missing-md',
      name: 'missing-md',
      kind: 'skill',
      metadata: { hiddenReason: 'inspection:missing-skill-md' },
    }),
  )
  assert.equal(item.state.runtimeVisible, false)
  assertIncludes(item.state.hiddenReasons, 'missing-skill-md')
})

test('catalog maps drifted status to drifted hidden reason', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:drifted',
      name: 'drifted',
      kind: 'skill',
      state: { installed: true, status: 'drifted' },
    }),
  )
  assert.equal(item.state.runtimeVisible, false)
  assertIncludes(item.state.hiddenReasons, 'drifted')
})

test('catalog maps invalid status to invalid hidden reason', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:invalid',
      name: 'invalid',
      kind: 'skill',
      state: { installed: true, status: 'invalid' },
    }),
  )
  assert.equal(item.state.runtimeVisible, false)
  assertIncludes(item.state.hiddenReasons, 'invalid')
})

test('catalog blocks tool without invocation surface', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'tool:denied',
      name: 'denied',
      kind: 'tool',
      invocation: { modelInvocable: false, userInvocable: false, toolInvocable: false },
    }),
  )
  assert.equal(item.state.runtimeVisible, false)
  assertIncludes(item.state.hiddenReasons, 'tool-denied')
})

test('catalog keeps MCP tool conflict separate from Skill with same name', () => {
  const catalog = buildExtensionCapabilityCatalog([
    capability({ id: 'skill:shared', name: 'shared', kind: 'skill' }),
    capability({ id: 'mcp-tool:shared', name: 'shared', kind: 'mcp-tool' }),
  ])
  assert.equal(catalog.runtimeVisible.length, 2)
  assert.equal(catalog.diagnostics.length, 0)
})

test('catalog hides lower-priority duplicate Skill', () => {
  const catalog = buildExtensionCapabilityCatalog([
    capability({
      id: 'skill:plugin:shared',
      name: 'shared',
      kind: 'skill',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
    }),
    capability({
      id: 'skill:project:shared',
      name: 'shared',
      kind: 'skill',
      source: { kind: 'project-skill', label: 'project' },
    }),
  ])
  assert.equal(catalog.runtimeVisible.length, 1)
  assert.equal(catalog.runtimeVisible[0].source.kind, 'project-skill')
  assert.equal(catalog.diagnostics[0].code, 'duplicate-runtime-name')
})

test('catalog propagates disabled plugin to child Skill', () => {
  const catalog = buildExtensionCapabilityCatalog([
    capability({
      id: 'plugin:bundle',
      name: 'bundle',
      kind: 'plugin',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
      state: { installed: true, enabled: false, status: 'disabled' },
    }),
    capability({
      id: 'skill:plugin-child',
      name: 'plugin-child',
      kind: 'skill',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
      relations: { parentPluginId: 'bundle' },
    }),
  ])
  const child = byId(catalog).get('skill:plugin-child')
  assert.equal(child.state.runtimeVisible, false)
  assertIncludes(child.state.hiddenReasons, 'plugin-disabled')
})

test('catalog reports missing parent plugin without hiding child', () => {
  const item = onlyCatalogCapability(
    capability({
      id: 'skill:orphan',
      name: 'orphan',
      kind: 'skill',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'missing' },
      relations: { parentPluginId: 'missing' },
    }),
  )
  assert.equal(item.state.runtimeVisible, true)
  assertNotIncludes(item.state.hiddenReasons, 'plugin-disabled')
  assert.equal(
    item.diagnostics.some(diagnostic => diagnostic.code === 'parent-plugin-missing'),
    true,
  )
})

test('catalog propagates unavailable MCP server to child tool', () => {
  const catalog = buildExtensionCapabilityCatalog([
    capability({
      id: 'mcp-server:srv',
      name: 'srv',
      kind: 'mcp-server',
      state: { status: 'unavailable', available: false },
    }),
    capability({
      id: 'mcp-tool:srv:echo',
      name: 'echo',
      kind: 'mcp-tool',
      relations: { parentMcpServerName: 'srv' },
    }),
  ])
  const child = byId(catalog).get('mcp-tool:srv:echo')
  assert.equal(child.state.runtimeVisible, false)
  assertIncludes(child.state.hiddenReasons, 'mcp-server-unavailable')
})

test('catalog keeps MCP child visible when server is available', () => {
  const catalog = buildExtensionCapabilityCatalog([
    capability({ id: 'mcp-server:srv', name: 'srv', kind: 'mcp-server' }),
    capability({
      id: 'mcp-tool:srv:echo',
      name: 'echo',
      kind: 'mcp-tool',
      relations: { parentMcpServerName: 'srv' },
    }),
  ])
  assert.equal(byId(catalog).get('mcp-tool:srv:echo').state.runtimeVisible, true)
})

test('catalog inherits plugin relation from MCP server to child tool', () => {
  const catalog = buildExtensionCapabilityCatalog([
    capability({
      id: 'plugin:bundle',
      name: 'bundle',
      kind: 'plugin',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
    }),
    capability({
      id: 'mcp-server:srv',
      name: 'srv',
      kind: 'mcp-server',
      relations: { parentPluginId: 'bundle' },
    }),
    capability({
      id: 'mcp-tool:srv:echo',
      name: 'echo',
      kind: 'mcp-tool',
      relations: { parentMcpServerName: 'srv' },
    }),
  ])
  assert.equal(byId(catalog).get('mcp-tool:srv:echo').relations.parentPluginId, 'bundle')
})

test('catalog summary counts kinds and runtime visible capabilities', () => {
  const catalog = buildExtensionCapabilityCatalog([
    capability({ id: 'skill:one', name: 'one', kind: 'skill' }),
    capability({ id: 'plugin:bundle', name: 'bundle', kind: 'plugin' }),
    capability({ id: 'mcp-server:srv', name: 'srv', kind: 'mcp-server' }),
  ])
  assert.equal(catalog.summary.total, 3)
  assert.equal(catalog.summary.byKind.skill, 1)
  assert.equal(catalog.summary.byKind.plugin, 1)
  assert.equal(catalog.summary.runtimeVisible, 3)
})

test('skill runtime priority keeps policy first', () => {
  assert.equal(getSkillRuntimePriority(promptCommand('policy', { source: 'policySettings' })), 0)
})

test('skill runtime priority keeps project before user', () => {
  assert.equal(getSkillRuntimePriority(promptCommand('project', { source: 'projectSettings' })), 1)
  assert.equal(getSkillRuntimePriority(promptCommand('user', { source: 'userSettings' })), 2)
})

test('skill runtime priority keeps managed before plugin', () => {
  assert.equal(getSkillRuntimePriority(promptCommand('managed', { loadedFrom: 'managed' })), 3)
  assert.equal(getSkillRuntimePriority(promptCommand('plugin', { source: 'plugin', loadedFrom: 'plugin' })), 4)
})

test('skill runtime priority keeps bundled before dynamic', () => {
  assert.equal(
    getSkillRuntimePriority(
      promptCommand('bundled', { source: 'bundled', loadedFrom: 'bundled' }),
    ),
    5,
  )
  assert.equal(getSkillRuntimePriority(promptCommand('dynamic', { loadedFrom: 'dynamic' })), 6)
})

test('skill runtime priority keeps MCP before legacy', () => {
  assert.equal(getSkillRuntimePriority(promptCommand('mcp', { source: 'mcp', loadedFrom: 'mcp' })), 7)
  assert.equal(
    getSkillRuntimePriority(promptCommand('legacy', { loadedFrom: 'commands_DEPRECATED' })),
    8,
  )
})

test('skill runtime catalog keeps managed over bundled duplicate', () => {
  const managed = promptCommand('shared', { loadedFrom: 'managed' })
  const bundled = promptCommand('shared', { source: 'bundled', loadedFrom: 'bundled' })
  const catalog = createSkillRuntimeCatalog([bundled, managed])
  assert.equal(catalog.commands[0], managed)
  assert.equal(catalog.diagnostics[0].kept.loadedFrom, 'managed')
})

test('skill runtime catalog keeps MCP over legacy duplicate', () => {
  const legacy = promptCommand('shared', { loadedFrom: 'commands_DEPRECATED' })
  const mcp = promptCommand('shared', { source: 'mcp', loadedFrom: 'mcp' })
  const catalog = createSkillRuntimeCatalog([legacy, mcp])
  assert.equal(catalog.commands[0], mcp)
  assert.equal(catalog.diagnostics[0].kept.loadedFrom, 'mcp')
  assert.equal(catalog.diagnostics[0].skipped.loadedFrom, 'commands_DEPRECATED')
})

test('skill runtime catalog keeps plugin over bundled duplicate', () => {
  const plugin = promptCommand('shared', { source: 'plugin', loadedFrom: 'plugin' })
  const bundled = promptCommand('shared', { source: 'bundled', loadedFrom: 'bundled' })
  const catalog = createSkillRuntimeCatalog([bundled, plugin])
  assert.equal(catalog.commands[0], plugin)
})

test('skill runtime catalog keeps dynamic over MCP duplicate', () => {
  const dynamic = promptCommand('shared', { loadedFrom: 'dynamic' })
  const mcp = promptCommand('shared', { source: 'mcp', loadedFrom: 'mcp' })
  const catalog = createSkillRuntimeCatalog([mcp, dynamic])
  assert.equal(catalog.commands[0], dynamic)
})

test('skill runtime catalog excludes non-prompt commands', () => {
  const catalog = createSkillRuntimeCatalog([
    { type: 'local', name: 'not-a-skill', description: 'not a skill' },
    promptCommand('real-skill'),
  ])
  assert.deepEqual(catalog.commands.map(command => command.name), ['real-skill'])
})

test('skill user-invocable adapter filters userInvocable false', () => {
  const visible = promptCommand('visible')
  const hidden = promptCommand('hidden', { userInvocable: false })
  assert.deepEqual(listUserInvocableSkillCommands([hidden, visible]), [visible])
})

test('skill user-invocable adapter filters disabled command', () => {
  const disabled = promptCommand('disabled', { isEnabled: () => false })
  assert.deepEqual(listUserInvocableSkillCommands([disabled]), [])
})

test('skill capability catalog attaches installedRef by lockKey', () => {
  const command = promptCommand('managed', {
    loadedFrom: 'managed',
    installedSkillRef: 'skill:user:managed',
  })
  const catalog = createSkillRuntimeCapabilityCatalog({
    commands: [command],
    installed: [installedInspection('managed', 'skill:user:managed')],
  })
  assert.equal(catalog.capabilities[0].installedRef, 'skill:user:managed')
})

test('skill capability catalog leaves same-name user command uninstalled', () => {
  const command = promptCommand('same-name', { source: 'userSettings', loadedFrom: 'skills' })
  const catalog = createSkillRuntimeCapabilityCatalog({
    commands: [command],
    installed: [installedInspection('same-name', 'skill:user:other')],
  })
  const runtime = catalog.capabilities.find(item => item.sourceKind === 'user')
  assert.equal(runtime.installedRef, null)
})

test('skill capability catalog keeps installed-only missing package', () => {
  const catalog = createSkillRuntimeCapabilityCatalog({
    commands: [],
    installed: [installedInspection('missing', 'skill:user:missing', 'missing')],
  })
  assert.equal(catalog.capabilities[0].runtimeVisible, false)
  assert.equal(catalog.capabilities[0].hiddenReason, 'inspection:missing')
})

test('management projection gives installer-owned Skill destructive actions', () => {
  const item = managementItem(
    capability({
      id: 'skill:managed',
      name: 'managed',
      kind: 'skill',
      state: { installed: true },
      relations: { installedRef: 'skill:user:managed' },
    }),
  )
  assert.equal(item.managementOwnership, 'installer-owned')
  assertIncludes(item.allowedActions, 'repair')
  assertIncludes(item.allowedActions, 'uninstall')
})

test('management projection gives disabled installer Skill enable action', () => {
  const item = managementItem(
    capability({
      id: 'skill:disabled',
      name: 'disabled',
      kind: 'skill',
      state: { installed: true, enabled: false, status: 'disabled' },
      relations: { installedRef: 'skill:user:disabled' },
    }),
  )
  assertIncludes(item.allowedActions, 'enable')
  assertNotIncludes(item.allowedActions, 'disable')
})

test('management projection restricts runtime-only Skill to inspect', () => {
  const item = managementItem(
    capability({ id: 'skill:runtime', name: 'runtime', kind: 'skill' }),
  )
  assert.equal(item.managementOwnership, 'runtime-only')
  assert.deepEqual(item.allowedActions, ['inspect'])
})

test('management projection restricts plugin-owned Skill to inspect', () => {
  const item = managementItem(
    capability({
      id: 'skill:plugin-owned',
      name: 'plugin-owned',
      kind: 'skill',
      relations: { parentPluginId: 'bundle' },
    }),
  )
  assert.equal(item.managementOwnership, 'plugin-owned')
  assert.deepEqual(item.allowedActions, ['inspect'])
})

test('management projection allows manual MCP lifecycle actions', () => {
  const item = managementItem(
    capability({
      id: 'mcp-server:manual',
      name: 'manual',
      kind: 'mcp-server',
      metadata: { installKind: 'manual-config' },
    }),
  )
  assert.equal(item.managementOwnership, 'manual-config')
  assert.deepEqual(item.allowedActions, ['disable', 'inspect', 'test', 'restart'])
})

test('management projection allows installer MCP repair and uninstall', () => {
  const item = managementItem(
    capability({
      id: 'mcp-server:installed',
      name: 'installed',
      kind: 'mcp-server',
      state: { installed: true },
    }),
  )
  assert.equal(item.managementOwnership, 'installer-owned')
  assertIncludes(item.allowedActions, 'repair')
  assertIncludes(item.allowedActions, 'uninstall')
})

test('management projection restricts runtime MCP to inspect', () => {
  const item = managementItem(
    capability({ id: 'mcp-server:runtime', name: 'runtime', kind: 'mcp-server' }),
  )
  assert.equal(item.managementOwnership, 'runtime-only')
  assert.deepEqual(item.allowedActions, ['inspect'])
})

test('management projection restricts plugin-owned MCP to inspect', () => {
  const item = managementItem(
    capability({
      id: 'mcp-server:plugin-owned',
      name: 'plugin-owned',
      kind: 'mcp-server',
      relations: { parentPluginId: 'bundle' },
    }),
  )
  assert.equal(item.managementOwnership, 'plugin-owned')
  assert.deepEqual(item.allowedActions, ['inspect'])
})

test('management projection summarizes Skill MCP and Plugin counts', () => {
  const projection = managementProjection([
    capability({ id: 'skill:one', name: 'one', kind: 'skill' }),
    capability({ id: 'mcp-server:srv', name: 'srv', kind: 'mcp-server' }),
    capability({
      id: 'plugin:bundle',
      name: 'bundle',
      kind: 'plugin',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
    }),
  ])
  assert.equal(projection.summary.skills, 1)
  assert.equal(projection.summary.mcp, 1)
  assert.equal(projection.summary.plugins, 1)
})

test('management projection counts warning diagnostics as attention', () => {
  const projection = managementProjection([
    capability({
      id: 'skill:warn',
      name: 'warn',
      kind: 'skill',
      diagnostics: [{ kind: 'runtime', severity: 'warning', code: 'warn', message: 'warn' }],
    }),
  ])
  assert.equal(projection.summary.needsAttention, 1)
})

test('management action plan issues opaque token for uninstall', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const request = uninstallRequest()
  const plan = createCapabilityManagementActionPlan(planProjection(), request)
  assert.equal(plan.allowed, true)
  assert.equal(plan.requiresConfirmation, true)
  assert.ok(plan.confirmation?.token)
  assert.equal(plan.confirmation.token.includes('skill:managed'), false)
})

test('management action plan issues unique tokens for same request', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const request = uninstallRequest()
  const first = createCapabilityManagementActionPlan(planProjection(), request)
  const second = createCapabilityManagementActionPlan(planProjection(), request)
  assert.notEqual(first.confirmation.token, second.confirmation.token)
})

test('management action blocked plan does not issue token', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const plan = createCapabilityManagementActionPlan(planProjection(), {
    capabilityId: 'skill:runtime-only',
    action: 'repair',
    context: planContext(),
  })
  assert.equal(plan.allowed, false)
  assert.equal(plan.confirmation, undefined)
})

test('management action apply rejects missing confirmation flag', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const request = uninstallRequest()
  const plan = createCapabilityManagementActionPlan(planProjection(), request)
  const result = canApplyCapabilityManagementAction(plan, request)
  assert.equal(result.ok, false)
  assert.match(result.reason, /explicit confirmation/)
})

test('management action apply rejects missing token', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const request = uninstallRequest()
  const plan = createCapabilityManagementActionPlan(planProjection(), request)
  const result = canApplyCapabilityManagementAction(plan, { ...request, confirmed: true })
  assert.equal(result.ok, false)
  assert.match(result.reason, /missing/)
})

test('management action apply rejects expired token', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const request = uninstallRequest()
  const plan = createCapabilityManagementActionPlan(planProjection(), request, {
    now: new Date('2026-06-07T00:00:00.000Z'),
    tokenTtlMs: 1,
  })
  const result = canApplyCapabilityManagementAction(
    plan,
    { ...request, confirmed: true, confirmationToken: plan.confirmation.token },
    { now: new Date('2026-06-07T00:00:00.002Z') },
  )
  assert.equal(result.ok, false)
  assert.match(result.reason, /expired/)
})

test('management action apply rejects state drift', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const request = uninstallRequest()
  const originalPlan = createCapabilityManagementActionPlan(planProjection(), request)
  const driftPlan = createCapabilityManagementActionPlan(
    planProjection({ enabled: false, status: 'disabled' }),
    request,
    { issueConfirmationToken: false },
  )
  const result = canApplyCapabilityManagementAction(driftPlan, {
    ...request,
    confirmed: true,
    confirmationToken: originalPlan.confirmation.token,
  })
  assert.equal(result.ok, false)
  assert.match(result.reason, /current state/)
})

test('management action apply consumes token after first use', () => {
  clearCapabilityManagementConfirmationTokensForTests()
  const request = uninstallRequest()
  const plan = createCapabilityManagementActionPlan(planProjection(), request)
  const apply = { ...request, confirmed: true, confirmationToken: plan.confirmation.token }
  assert.equal(canApplyCapabilityManagementAction(plan, apply).ok, true)
  const second = canApplyCapabilityManagementAction(plan, apply)
  assert.equal(second.ok, false)
  assert.match(second.reason, /already used/)
})

test('management action apply allows non-confirmation inspect without token', () => {
  const request = {
    capabilityId: 'skill:managed',
    action: 'inspect',
    actionRef: 'skill:user:managed',
    context: planContext(),
  }
  const plan = createCapabilityManagementActionPlan(planProjection(), request)
  assert.equal(plan.requiresConfirmation, false)
  assert.equal(canApplyCapabilityManagementAction(plan, request).ok, true)
})

test('management action plan blocks wrong actionRef', () => {
  const plan = createCapabilityManagementActionPlan(planProjection(), {
    ...uninstallRequest(),
    actionRef: 'skill:user:other',
  })
  assert.equal(plan.allowed, false)
  assert.match(plan.blockedReason, /reference/)
})

test('management action plan blocks missing model invocation param', () => {
  const plan = createCapabilityManagementActionPlan(planProjection(), {
    capabilityId: 'skill:managed',
    action: 'set-model-invocation',
    actionRef: 'skill:user:managed',
    context: planContext(),
  })
  assert.equal(plan.allowed, false)
  assert.match(plan.blockedReason, /modelInvocable/)
})

test('management action digest changes with configHomeDir', () => {
  const baseRequest = uninstallRequest()
  const first = createCapabilityManagementActionPlan(planProjection(), baseRequest)
  const second = createCapabilityManagementActionPlan(planProjection(), {
    ...baseRequest,
    context: { ...planContext(), configHomeDir: 'D:/tmp/other-home' },
  })
  assert.notEqual(first.stateDigest, second.stateDigest)
})

test('skill visibility ledger records visible names and capability IDs', () => {
  const state = {}
  recordVisibleSkill(state, { name: 'visible', capabilityId: 'skill:visible' })
  assert.equal(state.visibleSkillNames.has('visible'), true)
  assert.equal(state.visibleSkillCapabilityIds.has('skill:visible'), true)
})

test('skill visibility ledger records discovered names and capability IDs', () => {
  const state = {}
  recordDiscoveredSkill(state, { name: 'found', capabilityId: 'skill:found' })
  assert.equal(state.discoveredSkillNames.has('found'), true)
  assert.equal(state.discoveredSkillCapabilityIds.has('skill:found'), true)
})

test('skill visibility ledger records loaded names and capability IDs', () => {
  const state = {}
  recordLoadedSkill(state, { name: 'loaded', capabilityId: 'skill:loaded' })
  assert.equal(state.loadedSkillNames.has('loaded'), true)
  assert.equal(state.loadedSkillCapabilityIds.has('skill:loaded'), true)
})

test('skill visibility ledger detects surfaced capability by ID', () => {
  const state = { visibleSkillCapabilityIds: new Set(['skill:visible']) }
  assert.equal(isSkillAlreadySurfaced({ name: 'visible', capabilityId: 'skill:visible' }, state), true)
})

test('skill visibility ledger does not hide same-name different capability ID', () => {
  const state = {
    visibleSkillNames: new Set(['same']),
    visibleSkillCapabilityIds: new Set(['skill:same:a']),
  }
  assert.equal(isSkillAlreadySurfaced({ name: 'same', capabilityId: 'skill:same:b' }, state), false)
})

test('skill visibility ledger uses name fallback only without capability ID', () => {
  const state = { visibleSkillNames: new Set(['legacy']) }
  assert.equal(isSkillAlreadySurfaced({ name: 'legacy' }, state), true)
})

test('skill visibility entry includes capability ID for eligible command', () => {
  const entry = toSkillVisibilityEntry(promptCommand('eligible', { loadedFrom: 'managed' }))
  assert.equal(entry.name, 'eligible')
  assert.equal(typeof entry.capabilityId, 'string')
})

test('skill visibility entry falls back to name for model-disabled command', () => {
  const entry = toSkillVisibilityEntry(
    promptCommand('model-off', { disableModelInvocation: true }),
  )
  assert.deepEqual(entry, { name: 'model-off' })
})

test('skill visibility entry ignores non-prompt command', () => {
  assert.equal(toSkillVisibilityEntry({ type: 'local', name: 'noop' }), null)
})

test('tool registry resolves aliases', () => {
  const registry = buildCcrToolRegistry([tool('CustomTool', { aliases: ['custom_alias'] })])
  assert.equal(registry.get('custom_alias')?.name, 'CustomTool')
})

test('tool snapshot counts direct deferred and internal tools', () => {
  const snapshot = createCcrToolCapabilitySnapshot([
    tool('Read'),
    tool('DeferredSearch', { shouldDefer: true }),
    tool('TestingPermission'),
  ])
  assert.equal(snapshot.summary.total, 3)
  assert.equal(snapshot.summary.direct, 1)
  assert.equal(snapshot.summary.deferred, 1)
  assert.equal(snapshot.summary.internal, 1)
})

test('tool snapshot marks deferred available tool searchable', () => {
  const snapshot = createCcrToolCapabilitySnapshot([
    tool('DeferredSearch', { shouldDefer: true }),
  ])
  assert.equal(snapshot.entries[0].searchable, true)
})

test('tool snapshot does not mark direct tool searchable', () => {
  const snapshot = createCcrToolCapabilitySnapshot([tool('Read')])
  assert.equal(snapshot.entries[0].searchable, false)
})

test('tool snapshot marks connected MCP tool searchable', () => {
  const snapshot = createCcrToolCapabilitySnapshot(
    [mcpTool('srv', 'echo')],
    { connectedMcpServerNames: ['srv'] },
  )
  assert.equal(snapshot.entries[0].availability.available, true)
  assert.equal(snapshot.entries[0].searchable, true)
})

test('tool snapshot blocks disconnected MCP tool', () => {
  const snapshot = createCcrToolCapabilitySnapshot(
    [mcpTool('srv', 'echo')],
    { connectedMcpServerNames: [] },
  )
  assert.equal(snapshot.entries[0].availability.available, false)
  assert.equal(snapshot.entries[0].availability.reason, 'mcp_not_connected')
  assert.equal(snapshot.entries[0].searchable, false)
})

test('tool snapshot maps MCP needs-auth status', () => {
  const snapshot = createCcrToolCapabilitySnapshot(
    [mcpTool('srv', 'echo')],
    { mcpServerStatuses: { srv: 'needs-auth' } },
  )
  assert.equal(snapshot.entries[0].availability.reason, 'mcp_needs_auth')
  assert.equal(snapshot.entries[0].availability.mcpState, 'needs-auth')
})

test('tool capability provider maps connected MCP tool relation', () => {
  const capabilities = listToolCapabilities({
    tools: [mcpTool('srv', 'echo')],
    connectedMcpServerNames: ['srv'],
  })
  assert.equal(capabilities[0].kind, 'mcp-tool')
  assert.equal(capabilities[0].relations.parentMcpServerName, 'srv')
  assert.equal(capabilities[0].state.runtimeVisible, true)
})

test('tool capability provider maps internal tool as not runtime visible', () => {
  const capabilities = listToolCapabilities({ tools: [tool('TestingPermission')] })
  assert.equal(capabilities[0].kind, 'tool')
  assert.equal(capabilities[0].state.available, true)
  assert.equal(capabilities[0].state.runtimeVisible, false)
})

test('tool capability provider maps provider unsupported GenerateImage', () => {
  const capabilities = listToolCapabilities({
    tools: [tool('GenerateImage', { alwaysLoad: true })],
    providerSupportsImageGeneration: false,
  })
  assert.equal(capabilities[0].state.status, 'unavailable')
  assert.equal(capabilities[0].diagnostics[0].code, 'provider_unsupported')
})

test('tool capability provider maps MCP disabled to disabled state', () => {
  const capabilities = listToolCapabilities({
    tools: [mcpTool('srv', 'echo')],
    mcpServerStatuses: { srv: 'disabled' },
  })
  assert.equal(capabilities[0].state.enabled, false)
  assert.equal(capabilities[0].state.status, 'disabled')
})

test('tool capability provider maps plugin ID from MCP tool source', () => {
  const capabilities = listToolCapabilities({
    tools: [mcpTool('srv', 'echo', { pluginId: 'plugin-one' })],
    connectedMcpServerNames: ['srv'],
  })
  assert.equal(capabilities[0].relations.parentPluginId, 'plugin-one')
  assert.equal(capabilities[0].source.pluginId, 'plugin-one')
})

test('plugin impact projection includes child capabilities', () => {
  const projection = managementProjection([
    capability({
      id: 'plugin:bundle',
      name: 'bundle',
      kind: 'plugin',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
    }),
    capability({
      id: 'skill:child',
      name: 'child',
      kind: 'skill',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
      relations: { parentPluginId: 'bundle' },
    }),
    capability({
      id: 'mcp-server:child',
      name: 'child-server',
      kind: 'mcp-server',
      relations: { parentPluginId: 'bundle' },
    }),
  ])
  const plugin = projection.plugins[0]
  assertIncludes(plugin.impact.childCapabilityIds, 'skill:child')
  assertIncludes(plugin.impact.childCapabilityIds, 'mcp-server:child')
})

test('same-name MCP tools from different servers keep distinct canonical ids', () => {
  const tools = listToolCapabilities({
    tools: [
      { ...mcpTool('alpha', 'search'), name: 'search' },
      { ...mcpTool('beta', 'search'), name: 'search' },
    ],
    mcpServerStatuses: {
      alpha: 'connected',
      beta: 'connected',
    },
  })
  assert.notEqual(tools[0].id, tools[1].id)
  assert.deepEqual(
    new Set(tools.map(item => item.relations.runtimeRef)),
    new Set(['tool:search']),
  )
})

test('app root capability never points parentAppId to itself', () => {
  const [app] = listAppCapabilities([
    {
      id: 'github',
      name: 'GitHub',
      connected: true,
      authStatus: 'connected',
    },
  ])
  assert.equal(app.relations.parentAppId, undefined)
})

test('catalog propagates app needs-auth to child tool', () => {
  const child = capability({
    id: 'tool:github:search',
    name: 'search',
    kind: 'tool',
  })
  const [app] = listAppCapabilities([
    {
      id: 'github',
      name: 'GitHub',
      authStatus: 'needs-auth',
      providedToolIds: [child.id],
    },
  ])
  const related = byId(buildExtensionCapabilityCatalog([app, child])).get(
    child.id,
  )
  assertIncludes(related.state.hiddenReasons, 'app-needs-auth')
  assert.equal(related.state.runtimeVisible, false)
})

test('catalog propagates disabled app to child Skill', () => {
  const child = capability({
    id: 'skill:github:review',
    name: 'review',
    kind: 'skill',
  })
  const [app] = listAppCapabilities([
    {
      id: 'github',
      name: 'GitHub',
      authStatus: 'disabled',
      providedSkillIds: [child.id],
    },
  ])
  const related = byId(buildExtensionCapabilityCatalog([app, child])).get(
    child.id,
  )
  assertIncludes(related.state.hiddenReasons, 'app-disabled')
  assert.equal(related.state.runtimeVisible, false)
})

test('catalog fails closed when parent app is missing', () => {
  const child = onlyCatalogCapability(
    capability({
      id: 'tool:orphan-app',
      name: 'orphan-app',
      kind: 'tool',
      relations: { parentAppId: 'missing-app' },
    }),
  )
  assertIncludes(child.state.hiddenReasons, 'app-missing')
  assert.equal(
    child.diagnostics.some(
      diagnostic => diagnostic.code === 'parent-app-missing',
    ),
    true,
  )
})

test('catalog fails closed when multiple apps claim one child', () => {
  const child = capability({
    id: 'tool:shared-app-child',
    name: 'shared-app-child',
    kind: 'tool',
  })
  const apps = listAppCapabilities([
    {
      id: 'app-a',
      name: 'App A',
      connected: true,
      authStatus: 'connected',
      providedToolIds: [child.id],
    },
    {
      id: 'app-b',
      name: 'App B',
      connected: true,
      authStatus: 'connected',
      providedToolIds: [child.id],
    },
  ])
  const related = byId(buildExtensionCapabilityCatalog([...apps, child])).get(
    child.id,
  )
  assertIncludes(related.state.hiddenReasons, 'app-ambiguous')
  assert.equal(related.relations.parentAppId, undefined)
  assert.equal(
    related.diagnostics.some(
      diagnostic => diagnostic.code === 'parent-app-ambiguous',
    ),
    true,
  )
})

test('disabled plugin propagates through app to child tool', () => {
  const child = capability({
    id: 'tool:plugin-app-child',
    name: 'plugin-app-child',
    kind: 'tool',
  })
  const [app] = listAppCapabilities([
    {
      id: 'plugin-app',
      name: 'Plugin App',
      connected: true,
      authStatus: 'connected',
      parentPluginId: 'bundle',
      providedToolIds: [child.id],
    },
  ])
  const catalog = buildExtensionCapabilityCatalog([
    capability({
      id: 'plugin:bundle',
      name: 'bundle',
      kind: 'plugin',
      source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
      state: { installed: true, enabled: false, status: 'disabled' },
    }),
    app,
    child,
  ])
  const related = byId(catalog).get(child.id)
  assertIncludes(related.state.hiddenReasons, 'app-disabled')
  assert.equal(related.relations.parentAppId, 'plugin-app')
})

test('management projection keeps app and propagated child state together', () => {
  const child = capability({
    id: 'tool:managed-app-child',
    name: 'managed-app-child',
    kind: 'tool',
  })
  const [app] = listAppCapabilities([
    {
      id: 'managed-app',
      name: 'Managed App',
      authStatus: 'needs-auth',
      providedToolIds: [child.id],
    },
  ])
  const projection = managementProjection([app, child])
  const appItem = projection.capabilities.find(item => item.kind === 'app')
  const childItem = projection.capabilities.find(
    item => item.capabilityId === child.id,
  )
  assert.deepEqual(appItem.allowedActions, ['inspect'])
  assertIncludes(childItem.hiddenReasons, 'app-needs-auth')
})

test('external extension matrix contains at least 50 cases', () => {
  assert.ok(cases.length >= MIN_CASES, `expected >= ${MIN_CASES}, got ${cases.length}`)
})

let passed = 0
for (const [index, entry] of cases.entries()) {
  try {
    await entry.fn()
    passed += 1
  } catch (error) {
    error.message = `Case ${index + 1} failed: ${entry.name}\n${error.message}`
    throw error
  }
}

console.log(`smoke-external-extension-test-matrix: ok (${passed} cases)`)

function test(name, fn) {
  cases.push({ name, fn })
}

function byId(catalog) {
  return new Map(catalog.capabilities.map(item => [item.id, item]))
}

function onlyCatalogCapability(input) {
  const catalog = buildExtensionCapabilityCatalog([input])
  assert.equal(catalog.capabilities.length, 1)
  return catalog.capabilities[0]
}

function managementProjection(capabilities) {
  return createCapabilityManagementProjection(
    buildExtensionCapabilityCatalog(capabilities),
  )
}

function managementItem(input) {
  const projection = managementProjection([input])
  assert.equal(projection.capabilities.length, 1)
  return projection.capabilities[0]
}

function planProjection(skillState = {}) {
  return managementProjection([
    capability({
      id: 'skill:managed',
      name: 'managed',
      kind: 'skill',
      state: { installed: true, ...skillState },
      relations: { installedRef: 'skill:user:managed' },
    }),
    capability({
      id: 'skill:runtime-only',
      name: 'runtime-only',
      kind: 'skill',
    }),
  ])
}

function planContext() {
  return { cwd: 'D:/workspace', configHomeDir: 'D:/tmp/ccr-home' }
}

function uninstallRequest() {
  return {
    capabilityId: 'skill:managed',
    action: 'uninstall',
    actionRef: 'skill:user:managed',
    context: planContext(),
  }
}

function capability(overrides = {}) {
  const kind = overrides.kind ?? 'skill'
  const name = overrides.name ?? overrides.id ?? 'capability'
  const source = overrides.source ?? defaultSource(kind, name)
  const state = {
    installed: false,
    enabled: true,
    available: true,
    runtimeVisible: true,
    status: 'available',
    ...(overrides.state ?? {}),
  }
  return {
    schemaVersion: 1,
    id: overrides.id ?? `${kind}:${name}`,
    name,
    displayName: overrides.displayName ?? name,
    description: overrides.description ?? `${name} description`,
    kind,
    source,
    state,
    invocation: overrides.invocation ?? defaultInvocation(kind),
    relations: overrides.relations ?? {},
    diagnostics: overrides.diagnostics ?? [],
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  }
}

function defaultSource(kind, name) {
  if (kind === 'plugin') return { kind: 'plugin', label: 'plugin', pluginId: name }
  if (kind.startsWith('mcp-')) return { kind: 'mcp', label: 'mcp' }
  if (kind === 'tool') return { kind: 'builtin', label: 'builtin' }
  if (kind === 'app') return { kind: 'app', label: 'app', appId: name }
  return { kind: 'managed-skill', label: 'managed' }
}

function defaultInvocation(kind) {
  if (kind === 'skill') {
    return { modelInvocable: true, userInvocable: true, toolInvocable: false }
  }
  if (kind === 'tool' || kind === 'mcp-tool') {
    return { modelInvocable: true, userInvocable: false, toolInvocable: true }
  }
  return { modelInvocable: false, userInvocable: false, toolInvocable: false }
}

function promptCommand(name, options = {}) {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    source: 'userSettings',
    loadedFrom: 'skills',
    contentLength: 0,
    progressMessage: 'running',
    ...options,
    async getPromptForCommand() {
      return []
    },
  }
}

function installedInspection(name, lockKey, status = 'installed') {
  return {
    name,
    lockKey,
    status,
    statusMessage: `${name} ${status}`,
    installedRecord: {
      enabled: true,
      modelInvocable: true,
      userInvocable: true,
    },
  }
}

function tool(name, options = {}) {
  return {
    name,
    aliases: [],
    description: `${name} tool`,
    ...options,
  }
}

function mcpTool(serverName, toolName, options = {}) {
  return tool(`mcp__${serverName}__${toolName}`, {
    isMcp: true,
    shouldDefer: true,
    mcpInfo: { serverName, toolName },
    ...options,
  })
}

function assertIncludes(values, expected, message) {
  assert.equal(values?.includes(expected), true, message)
}

function assertNotIncludes(values, expected, message) {
  assert.equal(values?.includes(expected), false, message)
}
