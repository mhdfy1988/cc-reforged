import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enableAppServerPlatformToolDefaults } from '../dist/src/services/tools/appServerToolFilters.js'

enableAppServerPlatformToolDefaults()

const { enableConfigs } = await import('../dist/src/utils/config.js')
enableConfigs()

const { getEmptyToolPermissionContext } = await import('../dist/src/Tool.js')
const { assembleToolPool, getAllBaseTools } = await import(
  '../dist/src/tools.js'
)
const {
  buildCcrToolRegistry,
  summarizeCcrToolRegistry,
} = await import('../dist/src/services/tools/toolRegistry.js')
const { filterAppServerPlatformTools } = await import(
  '../dist/src/services/tools/appServerToolFilters.js'
)
const {
  getCcrToolAvailability,
  summarizeCcrToolAvailability,
} = await import('../dist/src/services/tools/toolAvailability.js')
const {
  resolveLlmProviderCapabilityTools,
} = await import('../dist/src/services/llm/providerCapabilityTools.js')
const {
  collectCcrMcpConfigInventory,
  getCcrMcpProjectConfigReadPaths,
  summarizeCcrMcpConfigInventory,
} = await import('../dist/src/services/mcp/configInventory.js')
const { runWithCwdOverride } = await import('../dist/src/utils/cwd.js')
const {
  CcrMcpInstallManifestSchema,
  createCcrMcpInstallManifest,
  inferCcrMcpInstallKindFromConfig,
  summarizeCcrMcpInstallManifest,
} = await import('../dist/src/services/mcp/installManifest.js')
const {
  getCcrToolSearchCandidates,
  summarizeCcrToolSearchCandidates,
} = await import('../dist/src/services/tools/toolSearchPolicy.js')
const {
  createCcrToolCapabilitySnapshot,
} = await import('../dist/src/services/tools/toolCapabilitySnapshot.js')
const {
  listToolCapabilities,
} = await import('../dist/src/services/capabilities/toolCapabilityProvider.js')
const { getDefaultAppState } = await import(
  '../dist/src/state/AppStateStore.js'
)
const { ToolSearchTool } = await import(
  '../dist/src/tools/ToolSearchTool/ToolSearchTool.js'
)

const baseTools = getAllBaseTools()
const registry = buildCcrToolRegistry(baseTools)
const registryNames = registry.entries.map(entry => entry.name)
const baseNames = baseTools.map(tool => tool.name)

assert.deepEqual(registryNames, baseNames)
assert.equal(registry.entries.length, baseTools.length)
assert.equal(registry.has('GenerateImage'), true)
assert.equal(registry.has('image_generation'), true)

const generateImage = registry.get('GenerateImage')
assert.equal(generateImage?.displayName, '生成图片')
assert.equal(generateImage?.category, 'media')
assert.equal(generateImage?.source.kind, 'provider')
assert.equal(generateImage?.exposure, 'direct')
assert.equal(generateImage?.tool.alwaysLoad, true)

const todoWrite = registry.get('TodoWrite')
assert.equal(todoWrite?.category, 'control')
assert.equal(todoWrite?.display.showInMainTimeline, false)

const toolSearch = registry.get('ToolSearch')
if (toolSearch) {
  assert.equal(toolSearch.category, 'internal')
  assert.equal(toolSearch.exposure, 'internal')
  assert.equal(toolSearch.display.showInMainTimeline, false)
}

const listMcpResources = registry.get('ListMcpResourcesTool')
if (listMcpResources) {
  assert.equal(listMcpResources.category, 'internal')
  assert.equal(listMcpResources.exposure, 'internal')
}

const appServerTools = filterAppServerPlatformTools(
  assembleToolPool(getEmptyToolPermissionContext(), []),
  { activeAgentCount: 0 },
)
const appServerNames = new Set(appServerTools.map(tool => tool.name))
const appServerAvailability = summarizeCcrToolAvailability(
  assembleToolPool(getEmptyToolPermissionContext(), []),
  {
    runtime: 'app-server',
    platform: process.platform,
    activeAgentCount: 0,
  },
)
if (process.platform === 'win32') {
  assert.equal(appServerNames.has('PowerShell'), true)
  assert.equal(appServerNames.has('Bash'), false)
  assert.equal(appServerNames.has('Agent'), false)
  assert.deepEqual(
    appServerAvailability.unavailable.map(item => item.name).sort(),
    ['Agent', 'Bash'],
  )
  assert.equal(
    appServerAvailability.unavailable.find(item => item.name === 'Bash')
      ?.reason,
    'platform_unsupported',
  )
  assert.equal(
    appServerAvailability.unavailable.find(item => item.name === 'Agent')
      ?.reason,
    'agent_definitions_missing',
  )
}

assert.equal(
  getCcrToolAvailability(generateImage, {
    providerSupportsImageGeneration: false,
  }).reason,
  'provider_unsupported',
)

const glmCapabilityTools = resolveLlmProviderCapabilityTools({
  providerId: 'glm-api',
  model: 'glm-5.1',
})
assert.equal(glmCapabilityTools.imageGeneration.available, true)
assert.equal(glmCapabilityTools.imageGeneration.provider, 'glm-api')
assert.equal(glmCapabilityTools.imageGeneration.model, 'glm-image')
assert.equal(glmCapabilityTools.imageGeneration.route, 'same_provider')
assert.equal(glmCapabilityTools.imageGeneration.dataBoundary, 'same_provider')

const openAiCapabilityTools = resolveLlmProviderCapabilityTools({
  providerId: 'openai',
  model: 'gpt-5.4',
})
assert.equal(openAiCapabilityTools.imageGeneration.available, true)
assert.equal(openAiCapabilityTools.imageGeneration.model, 'gpt-image-1')

const minimaxCapabilityTools = resolveLlmProviderCapabilityTools({
  providerId: 'minimax',
  model: 'MiniMax-M2.7',
})
assert.equal(minimaxCapabilityTools.imageGeneration.available, true)
assert.equal(minimaxCapabilityTools.imageGeneration.model, 'image-01')

const deepSeekCapabilityTools = resolveLlmProviderCapabilityTools({
  providerId: 'deepseek',
  model: 'deepseek-v4-flash',
})
assert.equal(deepSeekCapabilityTools.imageGeneration.available, false)
assert.equal(
  getCcrToolAvailability(generateImage, {
    providerCapabilityTools: deepSeekCapabilityTools,
  }).message,
  deepSeekCapabilityTools.imageGeneration.message,
)

const mcpConfigInventory = collectCcrMcpConfigInventory()
const mcpSourceIds = new Set(
  mcpConfigInventory.sources.map(source => source.id),
)
for (const expectedSourceId of [
  'enterprise',
  'claudeai',
  'plugin',
  'user-legacy',
  'user-file',
  'project',
  'local',
  'dynamic',
]) {
  assert.equal(mcpSourceIds.has(expectedSourceId), true)
}
assert.equal(
  mcpConfigInventory.installPaths.packageRootDir.endsWith('mcp\\packages') ||
    mcpConfigInventory.installPaths.packageRootDir.endsWith('mcp/packages'),
  true,
)
assert.equal(
  mcpConfigInventory.installPaths.installedManifestPath.endsWith(
    'mcp\\installed.json',
  ) ||
    mcpConfigInventory.installPaths.installedManifestPath.endsWith(
      'mcp/installed.json',
    ),
  true,
)
assert.equal(
  getCcrMcpProjectConfigReadPaths(process.cwd()).at(-1)?.endsWith('.mcp.json'),
  true,
)
const mcpInventorySummary = summarizeCcrMcpConfigInventory(mcpConfigInventory)
assert.equal(
  mcpInventorySummary.sources.some(
    source => source.id === 'user-file' && source.writePath?.endsWith('mcp.json'),
  ),
  true,
)
assert.equal(
  mcpInventorySummary.sources.some(
    source =>
      source.id === 'project' && source.writePath?.endsWith('.mcp.json'),
  ),
  true,
)

const inventoryTempDir = mkdtempSync(join(tmpdir(), 'ccr-mcp-inventory-smoke-'))
try {
  const parentDir = join(inventoryTempDir, 'parent')
  const childDir = join(parentDir, 'child')
  mkdirSync(childDir, { recursive: true })
  writeMcpJson(join(parentDir, '.mcp.json'), {
    overlap_smoke: { command: 'node', args: ['parent.js'] },
  })
  writeMcpJson(join(childDir, '.mcp.json'), {
    overlap_smoke: { command: 'node', args: ['child.js'] },
  })

  const nestedInventory = runWithCwdOverride(childDir, () =>
    collectCcrMcpConfigInventory(),
  )
  const overlapEntries = nestedInventory.servers.filter(
    server => server.name === 'overlap_smoke',
  )
  assert.equal(overlapEntries.length, 2)
  assert.equal(
    overlapEntries.find(server => server.active)?.configPath,
    join(childDir, '.mcp.json'),
  )
  assert.equal(
    overlapEntries.find(server => !server.active)?.suppressionReason,
    'shadowed_by_project',
  )
} finally {
  rmSync(inventoryTempDir, { recursive: true, force: true })
}

const installManifestSamples = [
  createCcrMcpInstallManifest({
    name: 'manual-demo',
    source: {
      kind: 'manual-config',
      scope: 'user',
      configPath: 'C:\\Users\\demo\\.ccr\\mcp.json',
    },
    transport: 'stdio',
    serverConfig: { command: 'demo', args: [] },
  }),
  createCcrMcpInstallManifest({
    name: 'remote-demo',
    source: { kind: 'remote-url', url: 'https://example.com/mcp' },
    transport: 'http',
    serverConfig: { type: 'http', url: 'https://example.com/mcp' },
    permissions: [{ kind: 'network', required: true }],
  }),
  createCcrMcpInstallManifest({
    name: 'npm-demo',
    version: '1.0.0',
    source: {
      kind: 'stdio-npm-package',
      packageName: '@example/mcp',
      packageManager: 'npx',
    },
    transport: 'stdio',
    entry: { command: 'npx', args: ['@example/mcp'] },
    serverConfig: { command: 'npx', args: ['@example/mcp'] },
  }),
  createCcrMcpInstallManifest({
    name: 'local-demo',
    source: { kind: 'local-directory', path: 'D:\\mcp\\server' },
    transport: 'stdio',
    entry: { command: 'D:\\mcp\\server\\run.cmd', args: [] },
    serverConfig: { command: 'D:\\mcp\\server\\run.cmd', args: [] },
  }),
  createCcrMcpInstallManifest({
    name: 'preset-demo',
    source: { kind: 'builtin-preset', presetId: 'playwright' },
    transport: 'sdk',
    serverConfig: { type: 'sdk', name: 'playwright' },
  }),
  createCcrMcpInstallManifest({
    name: 'plugin-demo',
    source: {
      kind: 'plugin-provided',
      pluginSource: 'browser@openai-bundled',
      pluginName: 'browser',
      serverName: 'browser',
    },
    transport: 'stdio',
    serverConfig: { command: 'node', args: ['server.js'] },
  }),
]
assert.deepEqual(
  installManifestSamples.map(manifest => CcrMcpInstallManifestSchema().parse(manifest).source.kind),
  [
    'manual-config',
    'remote-url',
    'stdio-npm-package',
    'local-directory',
    'builtin-preset',
    'plugin-provided',
  ],
)
assert.deepEqual(
  [
    inferCcrMcpInstallKindFromConfig({ type: 'http', url: 'https://example.com/mcp' }),
    inferCcrMcpInstallKindFromConfig({ command: 'npx', args: ['@example/mcp'] }),
    inferCcrMcpInstallKindFromConfig({
      command: 'D:\\mcp\\server\\run.cmd',
      args: [],
    }),
    inferCcrMcpInstallKindFromConfig({ type: 'sdk', name: 'playwright' }),
    inferCcrMcpInstallKindFromConfig(
      { command: 'node', args: ['server.js'] },
      { pluginSource: 'browser@openai-bundled' },
    ),
  ],
  [
    'remote-url',
    'stdio-npm-package',
    'local-directory',
    'builtin-preset',
    'plugin-provided',
  ],
)
const installManifestSummary = installManifestSamples.map(manifest =>
  summarizeCcrMcpInstallManifest(manifest),
)

const readTool = registry.get('Read')?.tool
assert.ok(readTool)
const mcpRegistry = buildCcrToolRegistry([
  {
    ...readTool,
    name: 'mcp__demo__search',
    aliases: [],
    isMcp: true,
    mcpInfo: { serverName: 'demo', toolName: 'search' },
  },
])
const mcpEntry = mcpRegistry.get('mcp__demo__search')
assert.equal(mcpEntry?.category, 'mcp')
assert.equal(mcpEntry?.source.kind, 'mcp')
assert.equal(mcpEntry?.source.serverId, 'demo')
assert.equal(mcpEntry?.source.serverName, 'demo')
assert.equal(mcpEntry?.source.toolName, 'search')
assert.equal(mcpEntry?.displayName, 'MCP demo / search')
assert.equal(mcpEntry?.exposure, 'deferred')
assert.equal(
  getCcrToolAvailability(mcpEntry, {
    mcpServerStatuses: { demo: 'connected' },
  }).available,
  true,
)
const connectedMcpContext = {
  mcpServerStatuses: { demo: 'connected' },
}
const toolCapabilitySnapshot = createCcrToolCapabilitySnapshot(
  mcpRegistry.entries.map(entry => entry.tool),
  connectedMcpContext,
)
const mcpSnapshotEntry = toolCapabilitySnapshot.entries.find(
  item => item.entry.name === 'mcp__demo__search',
)
assert.equal(mcpSnapshotEntry?.entry.source.serverName, 'demo')
assert.equal(mcpSnapshotEntry?.entry.source.toolName, 'search')
assert.equal(mcpSnapshotEntry?.entry.exposure, 'deferred')
assert.equal(mcpSnapshotEntry?.availability.available, true)
assert.equal(mcpSnapshotEntry?.searchable, true)
const alignedToolSearchCandidates = getCcrToolSearchCandidates(
  mcpRegistry.entries.map(entry => entry.tool),
  connectedMcpContext,
)
assert.deepEqual(
  alignedToolSearchCandidates.map(tool => tool.name),
  ['mcp__demo__search'],
)
const alignedCapabilities = listToolCapabilities({
  tools: mcpRegistry.entries.map(entry => entry.tool),
  ...connectedMcpContext,
})
const alignedMcpCapability = alignedCapabilities.find(
  capability => capability.name === 'mcp__demo__search',
)
assert.equal(alignedMcpCapability?.metadata.exposure, 'deferred')
assert.equal(alignedMcpCapability?.state.status, 'available')
assert.equal(alignedMcpCapability?.state.runtimeVisible, true)
assert.equal(alignedMcpCapability?.source.mcpServerName, 'demo')
assert.equal(alignedMcpCapability?.metadata.source.toolName, 'search')

const fallbackMcpRegistry = buildCcrToolRegistry([
  {
    ...readTool,
    name: 'mcp__fallback__lookup',
    aliases: [],
    isMcp: true,
  },
])
const fallbackMcpEntry = fallbackMcpRegistry.get('mcp__fallback__lookup')
assert.equal(fallbackMcpEntry?.source.kind, 'mcp')
assert.equal(fallbackMcpEntry?.source.serverName, 'fallback')
assert.equal(fallbackMcpEntry?.source.toolName, 'lookup')
assert.equal(fallbackMcpEntry?.displayName, 'MCP fallback / lookup')
assert.equal(fallbackMcpEntry?.exposure, 'deferred')

const mcpStatusExpectations = [
  ['needs-auth', 'mcp_needs_auth'],
  ['failed', 'mcp_connection_failed'],
  ['disabled', 'mcp_disabled'],
  ['discovery-failed', 'mcp_discovery_failed'],
  ['call-failed', 'mcp_call_failed'],
  ['pending', 'mcp_not_connected'],
]
for (const [state, reason] of mcpStatusExpectations) {
  const availability = getCcrToolAvailability(mcpEntry, {
    mcpServerStatuses: {
      demo: {
        state,
        message: `synthetic ${state}`,
      },
    },
  })
  assert.equal(availability.available, false)
  assert.equal(availability.reason, reason)
  assert.equal(availability.mcpState, state)
  assert.equal(availability.message, `synthetic ${state}`)
}

const mcpAvailabilitySummary = summarizeCcrToolAvailability(mcpRegistry.entries.map(entry => entry.tool), {
  mcpServerStatuses: { demo: 'needs-auth' },
})
assert.equal(mcpAvailabilitySummary.unavailable[0]?.name, 'mcp__demo__search')
assert.equal(mcpAvailabilitySummary.unavailable[0]?.reason, 'mcp_needs_auth')
assert.equal(mcpAvailabilitySummary.unavailable[0]?.mcpState, 'needs-auth')

const toolSearchCandidates = getCcrToolSearchCandidates(appServerTools)
const toolSearchCandidateNames = new Set(
  toolSearchCandidates.map(tool => tool.name),
)
assert.equal(toolSearchCandidateNames.has('GenerateImage'), false)
assert.equal(toolSearchCandidateNames.has('TodoWrite'), false)
assert.equal(toolSearchCandidateNames.has('ToolSearch'), false)
assert.equal(toolSearchCandidateNames.has('ListMcpResourcesTool'), false)
assert.equal(toolSearchCandidateNames.has('WebFetch'), true)
assert.equal(toolSearchCandidateNames.has('TaskOutput'), true)
assert.equal(toolSearchCandidateNames.has('ExitPlanMode'), true)

const syntheticUnavailable = [readTool, {
  ...readTool,
  name: 'Bash',
  aliases: [],
  shouldDefer: true,
}]
const unavailableCandidates = getCcrToolSearchCandidates(syntheticUnavailable, {
  runtime: 'app-server',
  platform: 'win32',
})
assert.equal(
  unavailableCandidates.some(tool => tool.name === 'Bash'),
  false,
)

async function runToolSearch(query) {
  const result = await ToolSearchTool.call(
    { query, max_results: 5 },
    {
      options: { tools: appServerTools },
      getAppState: () => getDefaultAppState(),
    },
  )
  return result.data
}

assert.deepEqual((await runToolSearch('select:GenerateImage')).matches, [])
assert.deepEqual((await runToolSearch('select:TodoWrite')).matches, [])
assert.deepEqual((await runToolSearch('select:ToolSearch')).matches, [])
assert.deepEqual((await runToolSearch('select:WebFetch')).matches, ['WebFetch'])
assert.deepEqual((await runToolSearch('WebFetch')).matches, ['WebFetch'])

const mcpToolSearchResult = await ToolSearchTool.call(
  { query: 'select:mcp__demo__search', max_results: 5 },
  {
    options: { tools: mcpRegistry.entries.map(entry => entry.tool) },
    getAppState: () => getDefaultAppState(),
  },
)
assert.deepEqual(mcpToolSearchResult.data.matches, ['mcp__demo__search'])
assert.equal(
  mcpToolSearchResult.data.match_details?.[0]?.display_name,
  'MCP demo / search',
)
assert.equal(
  mcpToolSearchResult.data.match_details?.[0]?.source.server_name,
  'demo',
)
assert.equal(
  mcpToolSearchResult.data.match_details?.[0]?.source.tool_name,
  'search',
)
assert.equal(
  mcpToolSearchResult.data.match_details?.[0]?.availability.available,
  true,
)

const unavailableMcpAppState = getDefaultAppState()
unavailableMcpAppState.mcp.clients = [{ name: 'demo', type: 'needs-auth' }]
const unavailableMcpToolSearchResult = await ToolSearchTool.call(
  { query: 'demo', max_results: 5 },
  {
    options: { tools: mcpRegistry.entries.map(entry => entry.tool) },
    getAppState: () => unavailableMcpAppState,
  },
)
assert.deepEqual(unavailableMcpToolSearchResult.data.matches, [])
assert.equal(
  unavailableMcpToolSearchResult.data.unavailable_mcp_servers?.[0]?.name,
  'demo',
)
assert.equal(
  unavailableMcpToolSearchResult.data.unavailable_mcp_servers?.[0]?.reason,
  'mcp_needs_auth',
)

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        'registry_keeps_base_tool_order_and_count',
        'generate_image_metadata',
        'todo_write_control_metadata',
        'tool_search_internal_metadata_when_present',
        'list_mcp_resources_internal_metadata_when_present',
        'windows_app_server_filter_keeps_powershell_and_removes_bash_agent',
        'mcp_tool_metadata',
        'availability_reasons',
        'provider_capability_tools_image_generation',
        'mcp_config_inventory_sources_and_install_paths',
        'mcp_config_inventory_project_nearest_file_wins',
        'mcp_install_manifest_kinds_and_inference',
        'tool_search_candidate_policy',
        'tool_search_tool_uses_candidate_policy',
        'tool_capability_snapshot_aligns_toolsearch_and_catalog',
        'mcp_tool_identity_from_mcp_info_and_name_fallback',
        'mcp_availability_status_reasons',
        'tool_search_mcp_match_details_and_unavailable_server_reasons',
      ],
      registry: summarizeCcrToolRegistry(registry),
      providerCapabilityTools: {
        glm: glmCapabilityTools,
        openai: openAiCapabilityTools,
        minimax: minimaxCapabilityTools,
        deepseek: deepSeekCapabilityTools,
      },
      mcpConfigInventory: mcpInventorySummary,
      mcpInstallManifests: installManifestSummary,
      availability: appServerAvailability,
      toolSearchCandidates: summarizeCcrToolSearchCandidates(appServerTools),
      appServer: {
        count: appServerTools.length,
        names: [...appServerNames].sort(),
      },
    },
    null,
    2,
  ),
)

function writeMcpJson(filePath, mcpServers) {
  writeFileSync(
    filePath,
    `${JSON.stringify({ mcpServers }, null, 2)}\n`,
    'utf8',
  )
}
