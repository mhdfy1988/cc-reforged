import assert from 'node:assert/strict'
import { buildExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'
import { listAppCapabilities } from '../dist/src/services/capabilities/appCapabilityProvider.js'
import { listToolCapabilities } from '../dist/src/services/capabilities/toolCapabilityProvider.js'

const duplicateNameTools = listToolCapabilities({
  runtime: 'app-server',
  tools: [
    mcpTool('alpha', 'search'),
    mcpTool('beta', 'search'),
  ],
  mcpServerStatuses: {
    alpha: 'connected',
    beta: 'connected',
  },
})
assert.equal(duplicateNameTools.length, 2)
assert.notEqual(
  duplicateNameTools[0].id,
  duplicateNameTools[1].id,
  'same-name MCP tools from different servers need distinct canonical ids',
)
assert.deepEqual(
  new Set(duplicateNameTools.map(capability => capability.relations.runtimeRef)),
  new Set(['tool:search']),
  'runtime invocation name remains unchanged',
)

const childTool = duplicateNameTools[0]
const [app] = listAppCapabilities([
  {
    id: 'search-app',
    name: 'Search App',
    authStatus: 'needs-auth',
    providedToolIds: [childTool.id],
  },
])
const catalog = buildExtensionCapabilityCatalog([app, childTool])
const relatedTool = catalog.capabilities.find(
  capability => capability.id === childTool.id,
)
const relatedApp = catalog.capabilities.find(
  capability => capability.kind === 'app',
)
assert.equal(relatedApp.relations.parentAppId, undefined)
assert.equal(relatedTool.relations.parentAppId, 'search-app')
assert.equal(relatedTool.source.appId, 'search-app')
assert.equal(relatedTool.state.runtimeVisible, false)
assert.equal(
  relatedTool.state.hiddenReasons.includes('app-needs-auth'),
  true,
)

const missingParentCatalog = buildExtensionCapabilityCatalog([
  {
    ...childTool,
    id: `${childTool.id}:missing-app`,
    relations: {
      ...childTool.relations,
      parentAppId: 'missing-app',
    },
  },
])
const missingParentTool = missingParentCatalog.capabilities[0]
assert.equal(
  missingParentTool.diagnostics.some(
    diagnostic => diagnostic.code === 'parent-app-missing',
  ),
  true,
)
assert.equal(
  missingParentTool.state.hiddenReasons.includes('app-missing'),
  true,
)

const [competingApp] = listAppCapabilities([
  {
    id: 'competing-search-app',
    name: 'Competing Search App',
    authStatus: 'connected',
    providedToolIds: [childTool.id],
  },
])
const ambiguousCatalog = buildExtensionCapabilityCatalog([
  {
    ...app,
    state: {
      ...app.state,
      enabled: true,
      available: true,
      status: 'enabled',
    },
  },
  competingApp,
  childTool,
])
const ambiguousTool = ambiguousCatalog.capabilities.find(
  capability => capability.id === childTool.id,
)
assert.equal(ambiguousTool.relations.parentAppId, undefined)
assert.equal(
  ambiguousTool.diagnostics.some(
    diagnostic => diagnostic.code === 'parent-app-ambiguous',
  ),
  true,
)
assert.equal(
  ambiguousTool.state.hiddenReasons.includes('app-ambiguous'),
  true,
)
assert.equal(ambiguousTool.state.runtimeVisible, false)

console.log('smoke-capability-identity-relations: ok')

function mcpTool(serverName, toolName) {
  return {
    name: toolName,
    aliases: [],
    description: `${serverName} ${toolName}`,
    isMcp: true,
    mcpInfo: {
      serverName,
      toolName,
    },
    isEnabled() {
      return true
    },
  }
}
