import assert from 'node:assert/strict'
import { createExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'
import { createPluginCapabilityProvider } from '../dist/src/services/capabilities/pluginCapabilityProvider.js'

const pluginCapability = {
  schemaVersion: 1,
  id: 'plugin:github',
  name: 'github',
  displayName: 'GitHub',
  description: 'GitHub plugin.',
  kind: 'plugin',
  source: {
    kind: 'plugin',
    label: 'plugin',
    pluginId: 'github',
  },
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
  relations: {
    parentPluginId: 'github',
  },
  diagnostics: [],
}

const catalog = await createExtensionCapabilityCatalog({
  providers: [createPluginCapabilityProvider({ plugins: [pluginCapability] })],
})

assert.equal(catalog.summary.byKind.plugin, 1)
assert.equal(catalog.capabilities[0].relations.parentPluginId, 'github')

console.log('smoke-capability-catalog-plugin-relations: ok')
