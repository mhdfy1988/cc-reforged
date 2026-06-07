import assert from 'node:assert/strict'
import { CapabilitiesListParamsSchema } from '../dist/src/app-server/protocol.js'
import { createExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'
import {
  createAppCapabilityProvider,
} from '../dist/src/services/capabilities/appCapabilityProvider.js'
import {
  createPluginCapabilityProvider,
  listPluginBundleCapabilities,
} from '../dist/src/services/capabilities/pluginCapabilityProvider.js'
import { listMcpRuntimeSurfaceCapabilities } from '../dist/src/services/capabilities/mcpCapabilityProvider.js'
import { createSkillRuntimeCapabilityCatalog } from '../dist/src/skills/skillRuntimeCatalog.js'
import {
  normalizePluginId,
  resolveLoadedPluginId,
} from '../dist/src/services/capabilities/pluginIdentityResolver.js'
import { projectPluginImpact } from '../dist/src/services/capabilities/pluginImpactProjection.js'

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

const appParams = CapabilitiesListParamsSchema.parse({
  apps: [
    {
      id: 'github-app',
      name: 'GitHub App',
      description: 'GitHub connector.',
      authStatus: 'connected',
      parentPluginId: 'github@openai',
      providedToolIds: ['tool:GitHub'],
      providedMcpServerNames: ['github'],
      providedSkillIds: ['skill:plugin:github@openai:review-follow-up'],
      metadata: { category: 'Developer Tools' },
    },
  ],
})
assert.equal(appParams.apps[0].parentPluginId, 'github@openai')

const appCatalog = await createExtensionCapabilityCatalog({
  providers: [createAppCapabilityProvider({ apps: appParams.apps })],
})
const githubAppCapability = appCatalog.capabilities.find(
  capability => capability.kind === 'app' && capability.name === 'github-app',
)
assert.equal(githubAppCapability?.source.pluginId, 'github@openai')
assert.equal(githubAppCapability?.relations.parentPluginId, 'github@openai')
assert.equal(githubAppCapability?.metadata.authStatus, 'connected')
assert.deepEqual(githubAppCapability?.metadata.providedToolIds, ['tool:GitHub'])
assert.deepEqual(githubAppCapability?.metadata.providedMcpServerNames, ['github'])
assert.deepEqual(githubAppCapability?.metadata.providedSkillIds, [
  'skill:plugin:github@openai:review-follow-up',
])

const bundleCapabilities = listPluginBundleCapabilities([
  {
    name: 'github',
    manifest: {
      name: 'GitHub',
      description: 'Triage PRs, issues, CI, and publish flows.',
      version: '1.0.0',
    },
    path: '/plugins/github',
    source: 'github@openai',
    repository: 'github@openai',
    enabled: true,
    skillsPath: 'skills',
    mcpServers: {
      github: {
        type: 'stdio',
        command: 'node',
        args: ['server.mjs'],
      },
    },
    hooksConfig: {
      PreToolUse: [],
    },
  },
  {
    name: 'disabled-pack',
    manifest: {
      name: 'Disabled Pack',
      description: 'Disabled plugin.',
    },
    path: '/plugins/disabled-pack',
    source: 'disabled-pack@openai',
    repository: 'disabled-pack@openai',
    enabled: false,
  },
])

const bundlesByPluginId = new Map(
  bundleCapabilities.map(capability => [
    capability.source.pluginId,
    capability,
  ]),
)
const githubBundle = bundlesByPluginId.get('github@openai')
assert.equal(githubBundle.kind, 'plugin')
assert.equal(githubBundle.displayName, 'GitHub')
assert.equal(githubBundle.source.pluginId, 'github@openai')
assert.equal(githubBundle.relations.parentPluginId, undefined)
assert.equal(githubBundle.state.runtimeVisible, false)
assert.equal(githubBundle.state.status, 'enabled')
assert.equal(githubBundle.metadata.components.skills, 1)
assert.equal(githubBundle.metadata.components.mcpServers, 1)
assert.equal(githubBundle.metadata.components.hooks, 1)

const disabledBundle = bundlesByPluginId.get('disabled-pack@openai')
assert.equal(disabledBundle.state.status, 'disabled')
assert.equal(disabledBundle.diagnostics[0].code, 'plugin-disabled')

const providerCatalog = await createExtensionCapabilityCatalog({
  providers: [
    createPluginCapabilityProvider({ loadedPlugins: [bundleCapabilitiesFixture()] }),
  ],
})
assert.equal(
  providerCatalog.capabilities.some(
    capability =>
      capability.kind === 'plugin' &&
      capability.source.pluginId === 'bundle@openai',
  ),
  true,
)

const pluginSkillCatalog = createSkillRuntimeCapabilityCatalog({
  commands: [
    {
      type: 'prompt',
      name: 'bundle:review-helper',
      description: 'Review helper skill.',
      source: 'plugin',
      loadedFrom: 'plugin',
      pluginInfo: {
        repository: 'bundle@openai',
        pluginManifest: {
          name: 'Bundle',
          description: 'Fixture bundle.',
        },
      },
      contentLength: 0,
      progressMessage: 'loading',
      async getPromptForCommand() {
        return []
      },
    },
  ],
})
assert.equal(pluginSkillCatalog.capabilities.length, 1)
assert.equal(pluginSkillCatalog.capabilities[0].parentPluginId, 'bundle@openai')
assert.equal(pluginSkillCatalog.capabilities[0].sourceLabel, 'bundle@openai/plugin')

const mcpSurfaceCapabilities = listMcpRuntimeSurfaceCapabilities({
  mcp: {
    resources: {
      docs: [
        {
          uri: 'file:///readme.md',
          name: 'readme',
          description: 'Readme resource.',
          mimeType: 'text/markdown',
          server: 'docs',
        },
      ],
    },
    commands: [
      {
        type: 'prompt',
        name: 'mcp__docs__summarize',
        description: 'Summarize docs prompt.',
        source: 'mcp',
        isMcp: true,
        contentLength: 0,
        progressMessage: 'running',
        userFacingName() {
          return 'docs:summarize (MCP)'
        },
        async getPromptForCommand() {
          return []
        },
      },
      {
        type: 'prompt',
        name: 'mcp-skill-helper',
        description: 'MCP skill command, not an MCP prompt capability.',
        source: 'mcp',
        loadedFrom: 'mcp',
        isMcp: true,
        contentLength: 0,
        progressMessage: 'running',
        async getPromptForCommand() {
          return []
        },
      },
    ],
  },
})
const mcpSurfaceByKind = new Map(
  mcpSurfaceCapabilities.map(capability => [capability.kind, capability]),
)
assert.equal(mcpSurfaceByKind.get('mcp-resource').name, 'readme')
assert.equal(
  mcpSurfaceByKind.get('mcp-resource').relations.parentMcpServerName,
  'docs',
)
assert.equal(mcpSurfaceByKind.get('mcp-prompt').name, 'mcp__docs__summarize')
assert.equal(
  mcpSurfaceCapabilities.some(
    capability => capability.name === 'mcp-skill-helper',
  ),
  false,
)

assert.equal(normalizePluginId(' github@openai '), 'github@openai')
assert.equal(
  resolveLoadedPluginId({
    ...bundleCapabilitiesFixture(),
    source: 'bundle',
    repository: 'bundle@openai',
  }),
  'bundle@openai',
)

const disabledPluginGraph = await createExtensionCapabilityCatalog({
  providers: [
    {
      id: 'plugin-graph',
      listCapabilities() {
        return [
          {
            ...pluginCapability,
            id: 'plugin:bundle@openai',
            name: 'bundle',
            source: {
              kind: 'plugin',
              label: 'plugin',
              pluginId: 'bundle@openai',
            },
            state: {
              ...pluginCapability.state,
              enabled: false,
              available: false,
              status: 'disabled',
            },
            relations: { parentPluginId: 'bundle@openai' },
          },
          graphCapability({
            id: 'mcp-server:bundle-server',
            name: 'bundle-server',
            kind: 'mcp-server',
            relations: { parentPluginId: 'bundle@openai' },
          }),
          graphCapability({
            id: 'mcp-tool:bundle-server:review',
            name: 'mcp__bundle-server__review',
            kind: 'mcp-tool',
            relations: { parentMcpServerName: 'bundle-server' },
          }),
          graphCapability({
            id: 'skill:bundle-review',
            name: 'bundle-review',
            kind: 'skill',
            relations: { parentPluginId: 'bundle@openai' },
          }),
        ]
      },
    },
  ],
})

const graphById = new Map(
  disabledPluginGraph.capabilities.map(capability => [capability.id, capability]),
)
const pluginMcpServer = graphById.get('mcp-server:bundle-server')
assert.ok(pluginMcpServer.state.hiddenReasons.includes('plugin-disabled'))
const pluginMcpTool = graphById.get('mcp-tool:bundle-server:review')
assert.equal(pluginMcpTool.relations.parentPluginId, 'bundle@openai')
assert.ok(pluginMcpTool.state.hiddenReasons.includes('plugin-disabled'))
assert.ok(pluginMcpTool.state.hiddenReasons.includes('mcp-server-unavailable'))

const impact = projectPluginImpact(
  disabledPluginGraph.capabilities,
  'bundle@openai',
)
assert.deepEqual(impact.childCapabilityIds, [
  'mcp-server:bundle-server',
  'mcp-tool:bundle-server:review',
  'skill:bundle-review',
])
assert.deepEqual(impact.affectedRuntimeSurfaces, [
  'mcp-server',
  'mcp-tool',
  'skill',
])

function bundleCapabilitiesFixture() {
  return {
    name: 'bundle',
    manifest: {
      name: 'Bundle',
      description: 'Fixture bundle.',
    },
    path: '/plugins/bundle',
    source: 'bundle@openai',
    repository: 'bundle@openai',
    enabled: true,
  }
}

function graphCapability({ id, name, kind, relations }) {
  return {
    schemaVersion: 1,
    id,
    name,
    displayName: name,
    description: name,
    kind,
    source: {
      kind: kind === 'skill' ? 'plugin' : 'mcp',
      label: 'fixture',
    },
    state: {
      installed: false,
      enabled: true,
      available: true,
      runtimeVisible: kind === 'skill' || kind === 'mcp-tool',
      status: 'available',
    },
    invocation: {
      modelInvocable: kind === 'skill' || kind === 'mcp-tool',
      userInvocable: kind === 'skill',
      toolInvocable: kind === 'mcp-tool',
    },
    relations,
    diagnostics: [],
  }
}

console.log('smoke-capability-catalog-plugin-relations: ok')
