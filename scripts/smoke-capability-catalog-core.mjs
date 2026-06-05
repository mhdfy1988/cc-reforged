import assert from 'node:assert/strict'
import {
  buildExtensionCapabilityCatalog,
  createExtensionCapabilityCatalog,
} from '../dist/src/services/capabilities/capabilityCatalog.js'

const lowerPriority = capability('same-name', 'bundled')
const higherPriority = capability('same-name', 'project-skill')
const catalog = buildExtensionCapabilityCatalog([lowerPriority, higherPriority])

assert.equal(catalog.capabilities.length, 2)
assert.equal(catalog.runtimeVisible.length, 1)
assert.equal(catalog.runtimeVisible[0].source.kind, 'project-skill')
assert.equal(
  catalog.capabilities.find(item => item.source.kind === 'bundled').state.status,
  'hidden-by-conflict',
)
assert.equal(catalog.diagnostics[0].code, 'duplicate-runtime-name')

const providerCatalog = await createExtensionCapabilityCatalog({
  providers: [
    {
      id: 'fixture',
      listCapabilities() {
        return [capability('provider-cap', 'dynamic')]
      },
    },
  ],
})
assert.equal(providerCatalog.capabilities[0].name, 'provider-cap')

function capability(name, sourceKind) {
  return {
    schemaVersion: 1,
    id: `${sourceKind}:${name}`,
    name,
    displayName: name,
    description: name,
    kind: 'skill',
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
      userInvocable: true,
      toolInvocable: false,
    },
    relations: {},
    diagnostics: [],
  }
}

console.log('smoke-capability-catalog-core: ok')
