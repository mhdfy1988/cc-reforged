import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const catalogModule = await importDist('src/skills/skillRuntimeCatalog.js')
const managementModule = await importDist('src/services/skills/managementService.js')
const {
  createSkillRuntimeCapabilityCatalog,
  createSkillRuntimeCatalog,
  getLastSkillRuntimeCatalogDiagnostics,
} = catalogModule
const { listSkillManagementState } = managementModule

const installed = [
  {
    name: 'managed-cap',
    lockKey: 'user:managed-cap',
    status: 'installed',
    statusMessage: 'Skill is installed: managed-cap',
    installedRecord: {
      enabled: true,
      modelInvocable: true,
      userInvocable: true,
    },
  },
  {
    name: 'drifted-cap',
    lockKey: 'user:drifted-cap',
    status: 'drifted',
    statusMessage: 'Skill package checksum drift detected: drifted-cap',
    installedRecord: {
      enabled: true,
      modelInvocable: true,
      userInvocable: true,
    },
  },
]

const capabilityCatalog = createSkillRuntimeCapabilityCatalog({
  commands: [
    promptCommand('plugin-cap', 'plugin', 'plugin'),
    promptCommand('bundled-cap', 'bundled', 'bundled'),
    promptCommand('dynamic-cap', 'projectSettings', 'dynamic'),
    promptCommand('mcp-cap', 'mcp', 'mcp'),
    promptCommand('dupe-cap', 'mcp', 'mcp'),
    promptCommand('dupe-cap', 'bundled', 'bundled'),
  ],
  installed,
})

const capabilitiesByName = new Map(
  capabilityCatalog.capabilities.map(capability => [capability.name, capability]),
)
assert.equal(capabilitiesByName.get('plugin-cap').sourceKind, 'builtin-plugin')
assert.equal(capabilitiesByName.get('bundled-cap').sourceKind, 'bundled')
assert.equal(capabilitiesByName.get('dynamic-cap').sourceKind, 'dynamic')
assert.equal(capabilitiesByName.get('mcp-cap').sourceKind, 'mcp')
assert.equal(capabilitiesByName.get('managed-cap').sourceKind, 'managed-installed')
assert.equal(capabilitiesByName.get('drifted-cap').runtimeVisible, false)
assert.equal(capabilitiesByName.get('drifted-cap').hiddenReason, 'inspection:drifted')
assert.equal(capabilityCatalog.diagnostics.length, 1)

const identityCatalog = createSkillRuntimeCapabilityCatalog({
  commands: [
    promptCommand('shared-name', 'userSettings', 'skills'),
    promptCommand('managed-runtime', 'userSettings', 'managed', {
      installedSkillRef: 'user:managed-runtime',
    }),
    promptCommand('shadowed-name', 'userSettings', 'skills'),
    promptCommand('shadowed-name', 'userSettings', 'managed', {
      installedSkillRef: 'user:shadowed-name',
    }),
  ],
  installed: [
    installedInspection('shared-name', 'user:shared-name'),
    installedInspection('managed-runtime', 'user:managed-runtime'),
    installedInspection('shadowed-name', 'user:shadowed-name'),
  ],
})
const identityCapabilitiesByName = groupByName(identityCatalog.capabilities)
const sharedNameCapabilities = identityCapabilitiesByName.get('shared-name')
assert.equal(sharedNameCapabilities.length, 2)
assert.equal(
  sharedNameCapabilities.find(capability => capability.sourceKind === 'user')
    .installedRef,
  null,
)
assert.equal(
  sharedNameCapabilities.find(
    capability => capability.sourceKind === 'managed-installed',
  ).installedRef,
  'user:shared-name',
)
const managedRuntimeCapabilities =
  identityCapabilitiesByName.get('managed-runtime')
assert.equal(managedRuntimeCapabilities.length, 1)
assert.equal(managedRuntimeCapabilities[0].installedRef, 'user:managed-runtime')
const shadowedNameCapabilities = identityCapabilitiesByName.get('shadowed-name')
assert.equal(
  shadowedNameCapabilities.find(capability => capability.sourceKind === 'user')
    .installedRef,
  null,
)
const shadowedManaged = shadowedNameCapabilities.find(
  capability => capability.sourceKind === 'managed-installed',
)
assert.equal(shadowedManaged.installedRef, 'user:shadowed-name')
assert.equal(shadowedManaged.runtimeVisible, false)
assert.equal(shadowedManaged.hiddenReason, 'duplicate-name')

createSkillRuntimeCatalog([
  promptCommand('stale-diagnostic', 'mcp', 'mcp'),
  promptCommand('stale-diagnostic', 'bundled', 'bundled'),
])
assert.equal(getLastSkillRuntimeCatalogDiagnostics().length, 1)

const env = await createRuntimeSmokeEnv('ccr-skill-capability-catalog-')
try {
  const sourceDir = await writeSourceSkill(env.root, 'managed-state-cap')
  await installSkillFromSource({
    name: 'managed-state-cap',
    sourceDir,
    configHome: env.configHome,
  })
  const state = await listSkillManagementState({
    configHomeDir: env.configHome,
    cwd: env.root,
  })
  assert.equal(Array.isArray(state.capabilities), true)
  assert.equal(
    state.capabilities.some(
      capability =>
        capability.name === 'managed-state-cap' &&
        capability.sourceKind === 'managed-installed',
    ),
    true,
  )
  assert.equal(
    state.runtimeDiagnostics.some(
      diagnostic => diagnostic.name === 'stale-diagnostic',
    ),
    false,
  )
} finally {
  await env.cleanup()
}

function groupByName(capabilities) {
  const grouped = new Map()
  for (const capability of capabilities) {
    const group = grouped.get(capability.name) ?? []
    group.push(capability)
    grouped.set(capability.name, group)
  }
  return grouped
}

function installedInspection(name, lockKey) {
  return {
    name,
    lockKey,
    status: 'installed',
    statusMessage: `Skill is installed: ${name}`,
    installedRecord: {
      enabled: true,
      modelInvocable: true,
      userInvocable: true,
    },
  }
}

function promptCommand(name, source, loadedFrom, extra = {}) {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    source,
    loadedFrom,
    contentLength: 0,
    progressMessage: 'running',
    async getPromptForCommand() {
      return []
    },
    ...extra,
  }
}

console.log('smoke-skill-capability-catalog: ok')
