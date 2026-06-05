import assert from 'node:assert/strict'
import { buildExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'

const catalog = buildExtensionCapabilityCatalog([
  capability('alpha', 'skill', 'managed-skill'),
  capability('web', 'tool', 'builtin'),
])

assert.equal(catalog.schemaVersion, 1)
assert.equal(catalog.summary.total, 2)
assert.equal(catalog.summary.byKind.skill, 1)
assert.equal(catalog.summary.byKind.tool, 1)
assert.equal(catalog.summary.bySourceKind['managed-skill'], 1)
assert.equal(catalog.summary.byStatus.enabled, 2)
assert.equal(catalog.runtimeVisible.length, 2)

function capability(name, kind, sourceKind) {
  return {
    schemaVersion: 1,
    id: `${kind}:${name}`,
    name,
    displayName: name,
    description: `${name} capability`,
    kind,
    source: { kind: sourceKind, label: sourceKind },
    state: {
      installed: false,
      enabled: true,
      available: true,
      runtimeVisible: true,
      status: 'enabled',
    },
    invocation: {
      modelInvocable: true,
      userInvocable: kind === 'skill',
      toolInvocable: kind === 'tool',
    },
    relations: {},
    diagnostics: [],
  }
}

console.log('smoke-capability-model: ok')
