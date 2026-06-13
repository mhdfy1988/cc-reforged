import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilitiesListParamsSchema } from '../dist/src/app-server/protocol.js'
import { setInlinePlugins } from '../dist/src/bootstrap/state.js'
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
import { createPluginDomainSession } from '../dist/src/services/plugins/pluginDomainSession.js'
import { PluginInspector } from '../dist/src/services/plugins/pluginInspector.js'
import {
  clearPluginSkillsCache,
  getPluginSkills,
} from '../dist/src/utils/plugins/loadPluginCommands.js'
import { clearPluginCache } from '../dist/src/utils/plugins/pluginLoader.js'

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
      skillPackage: {
        schemaVersion: 1,
        id: 'plugin:bundle@openai:bundle:review-helper',
        name: 'bundle:review-helper',
        displayName: 'Review Helper',
        description: 'Review helper skill.',
        bodyPath: 'D:/plugins/bundle/skills/review-helper/SKILL.md',
        body: 'Review helper body.',
        baseDir: 'D:/plugins/bundle/skills/review-helper',
        source: 'plugin',
        origin: {
          vendor: 'claude',
          sourcePath: 'D:/plugins/bundle/skills/review-helper/SKILL.md',
          importedFrom: 'D:/plugins/bundle',
        },
        resources: {
          scripts: [],
          references: ['references/review.md'],
          assets: [],
        },
        invocation: {
          modelInvocable: true,
          userInvocable: true,
          context: 'inline',
          allowedTools: [],
          argumentNames: [],
        },
        compatibility: {
          rawFrontmatter: {
            name: 'Review Helper',
            description: 'Review helper skill.',
          },
          warnings: [],
        },
      },
      async getPromptForCommand() {
        return []
      },
    },
  ],
})
assert.equal(pluginSkillCatalog.capabilities.length, 1)
assert.equal(pluginSkillCatalog.capabilities[0].parentPluginId, 'bundle@openai')
assert.equal(pluginSkillCatalog.capabilities[0].sourceLabel, 'bundle@openai/plugin')
assert.equal(pluginSkillCatalog.capabilities[0].skillPackage?.body, 'Review helper body.')
assert.equal(
  pluginSkillCatalog.capabilities[0].skillPackage?.resources.references[0],
  'references/review.md',
)

const pluginSkillFixtureRoot = join(
  tmpdir(),
  `ccr-plugin-skill-metadata-${process.pid}-${Date.now()}`,
)
try {
  await mkdir(join(pluginSkillFixtureRoot, '.claude-plugin'), {
    recursive: true,
  })
  await mkdir(
    join(pluginSkillFixtureRoot, 'skills', 'web-reading', 'references'),
    { recursive: true },
  )
  await writeFile(
    join(pluginSkillFixtureRoot, '.claude-plugin', 'plugin.json'),
    JSON.stringify(
      {
        name: 'web-reader-toolkit',
        version: '0.1.0',
        description: 'Web reader plugin.',
        skills: ['./skills/web-reading'],
      },
      null,
      2,
    ),
  )
  await writeFile(
    join(pluginSkillFixtureRoot, 'skills', 'web-reading', 'SKILL.md'),
    [
      '---',
      'name: web-reading',
      'description: Read and summarize web pages.',
      'allowed-tools: Read',
      '---',
      '# Web Reading',
      '',
      'Use this skill to read web pages.',
    ].join('\n'),
  )
  await writeFile(
    join(
      pluginSkillFixtureRoot,
      'skills',
      'web-reading',
      'references',
      'guide.md',
    ),
    'Reference guide.',
  )

  setInlinePlugins([pluginSkillFixtureRoot])
  clearPluginCache('smoke plugin skill package metadata')
  clearPluginSkillsCache()
  const loadedPluginSkills = await getPluginSkills()
  const webReading = loadedPluginSkills.find(command =>
    command.name.endsWith(':web-reading'),
  )
  assert.ok(webReading, 'expected plugin skill to load from fixture')
  assert.equal(webReading.skillPackage?.displayName, 'web-reading')
  assert.equal(webReading.skillPackage?.body.includes('# Web Reading'), true)
  assert.equal(
    webReading.skillPackage?.bodyPath.endsWith('skills/web-reading/SKILL.md') ||
      webReading.skillPackage?.bodyPath.endsWith(
        'skills\\web-reading\\SKILL.md',
      ),
    true,
  )
  assert.equal(
    webReading.skillPackage?.resources.references[0],
    'references/guide.md',
  )
} finally {
  setInlinePlugins([])
  clearPluginCache('smoke plugin skill package metadata cleanup')
  clearPluginSkillsCache()
  await rm(pluginSkillFixtureRoot, { recursive: true, force: true })
}

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

const stalePluginId = 'web-reader-toolkit@local-import'
const stalePluginManifest = {
  name: 'web-reader-toolkit',
  description: 'Web reader plugin.',
  version: '0.1.0',
}
const staleRuntimeSession = createPluginDomainSession({
  workspaceRoot: '/tmp/ccr-workspace',
  configHomeDir: '/tmp/ccr-home',
  runtimeInstanceId: 'app-server',
  runtimeActivations: [
    {
      runtimeInstanceId: 'app-server',
      pluginId: stalePluginId,
      activeVersion: '0.1.0',
      activationRevision: 'stale-active',
      state: 'active',
      components: [{ component: 'skill', state: 'active' }],
    },
  ],
  runtimePlugins: [
    {
      name: 'web-reader-toolkit',
      manifest: stalePluginManifest,
      path: '/plugins/web-reader-toolkit',
      source: stalePluginId,
      repository: stalePluginId,
      enabled: true,
      skillsPath: 'skills',
    },
  ],
  repositories: {
    settings: {
      async read() {
        return {
          entries: [
            {
              scope: 'user',
              path: '/tmp/ccr-home/settings.json',
              enabledPlugins: { [stalePluginId]: false },
              diagnostics: [],
            },
          ],
          diagnostics: [],
        }
      },
    },
    installations: {
      async read() {
        return {
          schemaVersion: 2,
          entries: [
            {
              pluginId: stalePluginId,
              scope: 'user',
              installPath: '/plugins/web-reader-toolkit',
              version: '0.1.0',
              installedAt: '2026-06-12T00:00:00.000Z',
            },
          ],
          diagnostics: [],
        }
      },
    },
    marketplaces: {
      async read() {
        return { sources: [], candidates: [], diagnostics: [] }
      },
    },
    packages: {
      async inspect() {
        return {
          materialization: 'present',
          manifest: stalePluginManifest,
          diagnostics: [],
        }
      },
    },
    retention: {
      async read() {
        return { schemaVersion: 1, records: [] }
      },
    },
  },
})
const stalePluginCatalog = await new PluginInspector().listCatalog(
  staleRuntimeSession,
)
const stalePluginRecord = stalePluginCatalog.plugins.find(
  plugin => plugin.pluginId === stalePluginId,
)
assert.equal(stalePluginRecord.effectiveSelection.intent, 'disabled')
assert.equal(stalePluginRecord.effectiveSelection.active, false)
assert.equal(stalePluginRecord.derivedState.active, false)
assert.equal(stalePluginRecord.derivedState.status, 'installed-disabled')

const staleCapabilityCatalog = await createExtensionCapabilityCatalog({
  providers: [
    createPluginCapabilityProvider(),
    {
      id: 'stale-plugin-child',
      listCapabilities() {
        return [
          graphCapability({
            id: 'skill:web-reading',
            name: 'web-reading',
            kind: 'skill',
            relations: { parentPluginId: stalePluginId },
          }),
        ]
      },
    },
  ],
  context: {
    capabilityEnvironment: {
      pluginCatalog: stalePluginCatalog,
      plugins: { plugins: stalePluginCatalog.loadedPlugins, errors: [] },
    },
  },
})
const stalePluginCapability = staleCapabilityCatalog.capabilities.find(
  capability =>
    capability.kind === 'plugin' &&
    capability.source.pluginId === stalePluginId,
)
assert.equal(stalePluginCapability.state.runtimeVisible, false)
assert.equal(stalePluginCapability.state.status, 'disabled')
const stalePluginChild = staleCapabilityCatalog.capabilities.find(
  capability => capability.id === 'skill:web-reading',
)
assert.equal(stalePluginChild.state.runtimeVisible, false)
assert.ok(stalePluginChild.state.hiddenReasons.includes('plugin-disabled'))

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
