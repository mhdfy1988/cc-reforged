import {
  enableAppServerPlatformToolDefaults,
  filterAppServerPlatformTools,
} from '../dist/src/services/tools/appServerToolFilters.js'

enableAppServerPlatformToolDefaults()

const { enableConfigs } = await import('../dist/src/utils/config.js')
enableConfigs()

const { getEmptyToolPermissionContext } = await import('../dist/src/Tool.js')
const { assembleToolPool, getAllBaseTools, getTools } = await import(
  '../dist/src/tools.js'
)
const { buildCcrToolRegistry, summarizeCcrToolRegistry } = await import(
  '../dist/src/services/tools/toolRegistry.js'
)
const { summarizeCcrToolAvailability } = await import(
  '../dist/src/services/tools/toolAvailability.js'
)
const {
  resolveLlmProviderCapabilityTools,
  summarizeLlmProviderCapabilityTools,
} = await import('../dist/src/services/llm/providerCapabilityTools.js')
const { summarizeCcrMcpConfigInventory } = await import(
  '../dist/src/services/mcp/configInventory.js'
)

const permissionContext = getEmptyToolPermissionContext()
const baseTools = getAllBaseTools()
const enabledBuiltInTools = getTools(permissionContext)
const assembledTools = assembleToolPool(permissionContext, [])
const appServerTools = filterAppServerPlatformTools(assembledTools, {
  activeAgentCount: 0,
})
const registry = buildCcrToolRegistry(appServerTools)
const providerCapabilityTools = resolveLlmProviderCapabilityTools()
const appServerAvailability = summarizeCcrToolAvailability(assembledTools, {
  runtime: 'app-server',
  platform: process.platform,
  activeAgentCount: 0,
  providerCapabilityTools,
})

const appServerToolNames = new Set(appServerTools.map(tool => tool.name))
const baseToolNames = new Set(baseTools.map(tool => tool.name))
const enabledBuiltInToolNames = new Set(enabledBuiltInTools.map(tool => tool.name))
const removedBeforeFinalPool = [...baseToolNames]
  .filter(name => !enabledBuiltInToolNames.has(name))
  .sort()
const removedByAppServerPlatformFilter = [...enabledBuiltInToolNames]
  .filter(name => !appServerToolNames.has(name))
  .sort()

const payload = {
  ok: true,
  platform: process.platform,
  environment: {
    CLAUDE_CODE_USE_POWERSHELL_TOOL:
      process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL ?? null,
    USER_TYPE: process.env.USER_TYPE ?? null,
  },
  base: summarizeTools(baseTools),
  enabledBuiltIn: {
    ...summarizeTools(enabledBuiltInTools),
    removedBeforeFinalPool,
  },
  appServer: {
    ...summarizeTools(appServerTools),
    removedByAppServerPlatformFilter,
    availability: appServerAvailability,
  },
  registry: summarizeCcrToolRegistry(registry),
  providerCapabilityTools: summarizeLlmProviderCapabilityTools(
    providerCapabilityTools,
  ),
  mcpConfigInventory: summarizeCcrMcpConfigInventory(),
  tools: registry.toJSON().entries.map(entry => ({
    name: entry.name,
    aliases: entry.aliases,
    displayName: entry.displayName,
    category: entry.category,
    source: entry.source,
    exposure: entry.exposure,
    display: entry.display,
    flags: entry.flags,
  })),
}

console.log(JSON.stringify(payload, null, 2))

function summarizeTools(tools) {
  return {
    count: tools.length,
    names: tools.map(tool => tool.name).sort(),
    alwaysLoad: tools
      .filter(tool => tool.alwaysLoad === true)
      .map(tool => tool.name)
      .sort(),
    shouldDefer: tools
      .filter(tool => tool.shouldDefer === true)
      .map(tool => tool.name)
      .sort(),
    mcp: tools
      .filter(tool => tool.isMcp === true)
      .map(tool => ({
        name: tool.name,
        serverName: tool.mcpInfo?.serverName ?? null,
        toolName: tool.mcpInfo?.toolName ?? null,
        alwaysLoad: tool.alwaysLoad === true,
        shouldDefer: tool.shouldDefer === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
