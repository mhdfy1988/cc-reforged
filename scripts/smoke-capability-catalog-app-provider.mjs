import assert from 'node:assert/strict'
import { createExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'
import {
  createAppCapabilityProvider,
  listAppCapabilities,
} from '../dist/src/services/capabilities/appCapabilityProvider.js'

const capabilities = listAppCapabilities([
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository, issue, PR, and CI connector.',
    authStatus: 'connected',
    enabled: true,
    pluginId: 'github@openai',
    providedToolIds: ['github.pr.list'],
    metadata: {
      category: 'Developer Tools',
    },
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Design connector.',
    connected: false,
    enabled: true,
    authStatus: 'needs-auth',
  },
  {
    id: 'disabled-app',
    name: 'Disabled App',
    enabled: false,
  },
])

const byName = new Map(
  capabilities.map(capability => [capability.name, capability]),
)
const github = byName.get('github')
assert.equal(github.kind, 'app')
assert.equal(github.source.kind, 'app')
assert.equal(github.source.appId, 'github')
assert.equal(github.source.pluginId, 'github@openai')
assert.equal(github.relations.parentAppId, undefined)
assert.equal(github.relations.parentPluginId, 'github@openai')
assert.equal(github.state.status, 'enabled')
assert.equal(github.state.runtimeVisible, false)
assert.equal(github.invocation.modelInvocable, false)
assert.deepEqual(github.metadata.providedToolIds, ['github.pr.list'])
assert.equal(github.metadata.authStatus, 'connected')

const figma = byName.get('figma')
assert.equal(figma.state.status, 'needs-auth')
assert.equal(figma.diagnostics[0].code, 'app-needs-auth')

const disabled = byName.get('disabled-app')
assert.equal(disabled.state.status, 'disabled')
assert.equal(disabled.diagnostics[0].code, 'app-disabled')

const catalog = await createExtensionCapabilityCatalog({
  providers: [
    createAppCapabilityProvider({
      apps: [
        {
          id: 'sentry',
          name: 'Sentry',
          connected: true,
        },
      ],
    }),
  ],
})
assert.equal(catalog.summary.byKind.app, 1)
assert.equal(catalog.summary.bySourceKind.app, 1)
assert.equal(catalog.capabilities[0].name, 'sentry')

const emptyCatalog = await createExtensionCapabilityCatalog({
  providers: [createAppCapabilityProvider()],
})
assert.equal(emptyCatalog.summary.byKind.app ?? 0, 0)
assert.equal(
  emptyCatalog.capabilities.some(capability => capability.kind === 'app'),
  false,
)

console.log('smoke-capability-catalog-app-provider: ok')
