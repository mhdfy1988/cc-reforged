import type { Tool, Tools } from '../../Tool.js'
import {
  type CcrToolDisplayCategory,
  type CcrToolDisplayMetadata,
  type CcrToolSourceKind,
  getCcrToolDisplayMetadata,
} from './toolDisplayCatalog.js'

export type CcrToolCategory = CcrToolDisplayCategory

export type CcrToolExposure = 'direct' | 'deferred' | 'internal'

export type CcrToolSource = {
  kind: CcrToolSourceKind
  providerId?: string
  serverId?: string
  serverName?: string
  toolName?: string
  pluginId?: string
}

export type CcrToolDisplaySpec = {
  showInMainTimeline: boolean
  summaryKeys?: string[]
  detailKeys?: string[]
}

export type CcrToolRegistryEntry = {
  name: string
  aliases: readonly string[]
  displayName: string
  category: CcrToolCategory
  source: CcrToolSource
  exposure: CcrToolExposure
  display: CcrToolDisplaySpec
  tool: Tool
}

export type CcrToolRegistry = {
  readonly entries: readonly CcrToolRegistryEntry[]
  get(nameOrAlias: string): CcrToolRegistryEntry | undefined
  has(nameOrAlias: string): boolean
  toJSON(): CcrToolRegistrySnapshot
}

export type CcrToolRegistrySnapshot = {
  entries: Array<
    Omit<CcrToolRegistryEntry, 'tool'> & {
      flags: {
        isMcp: boolean
        shouldDefer: boolean
        alwaysLoad: boolean
      }
    }
  >
}

type ToolMetadata = {
  displayName: string
  category: CcrToolCategory
  sourceKind?: CcrToolSourceKind
  showInMainTimeline?: boolean
  summaryKeys?: string[]
  detailKeys?: string[]
}

const INTERNAL_TOOL_NAMES = new Set([
  'ListMcpResourcesTool',
  'ReadMcpResourceTool',
  'SyntheticOutput',
  'TestingPermission',
  'OverflowTest',
  'CtxInspect',
])

const CONTROL_TOOL_NAMES = new Set([
  'TodoWrite',
  'ExitPlanMode',
  'EnterPlanMode',
  'EnterWorktree',
  'ExitWorktree',
  'AskUserQuestion',
  'Config',
  'TaskCreate',
  'TaskGet',
  'TaskUpdate',
  'TaskList',
  'Sleep',
  'CronCreate',
  'CronDelete',
  'CronList',
  'RemoteTrigger',
  'Monitor',
  'PushNotification',
  'VerifyPlanExecution',
])

export function buildCcrToolRegistry(tools: Tools): CcrToolRegistry {
  const entries = tools.map(tool => buildRegistryEntry(tool))
  const byNameOrAlias = new Map<string, CcrToolRegistryEntry>()

  for (const entry of entries) {
    byNameOrAlias.set(entry.name, entry)
    for (const alias of entry.aliases) {
      byNameOrAlias.set(alias, entry)
    }
  }

  return {
    entries,
    get(nameOrAlias) {
      return byNameOrAlias.get(nameOrAlias)
    },
    has(nameOrAlias) {
      return byNameOrAlias.has(nameOrAlias)
    },
    toJSON() {
      return {
        entries: entries.map(entry => ({
          name: entry.name,
          aliases: entry.aliases,
          displayName: entry.displayName,
          category: entry.category,
          source: entry.source,
          exposure: entry.exposure,
          display: entry.display,
          flags: {
            isMcp: entry.tool.isMcp === true,
            shouldDefer: entry.tool.shouldDefer === true,
            alwaysLoad: entry.tool.alwaysLoad === true,
          },
        })),
      }
    },
  }
}

export function summarizeCcrToolRegistry(registry: CcrToolRegistry): {
  total: number
  byCategory: Record<CcrToolCategory, number>
  byExposure: Record<CcrToolExposure, number>
  bySource: Record<CcrToolSourceKind, number>
} {
  const byCategory = createCounter<CcrToolCategory>([
    'file',
    'runtime',
    'web',
    'agent',
    'media',
    'mcp',
    'control',
    'internal',
  ])
  const byExposure = createCounter<CcrToolExposure>([
    'direct',
    'deferred',
    'internal',
  ])
  const bySource = createCounter<CcrToolSourceKind>([
    'builtin',
    'mcp',
    'provider',
    'skill',
    'plugin',
    'dynamic',
  ])

  for (const entry of registry.entries) {
    byCategory[entry.category] += 1
    byExposure[entry.exposure] += 1
    bySource[entry.source.kind] += 1
  }

  return {
    total: registry.entries.length,
    byCategory,
    byExposure,
    bySource,
  }
}

function buildRegistryEntry(tool: Tool): CcrToolRegistryEntry {
  const metadata = toToolMetadata(getCcrToolDisplayMetadata(tool.name))
  const category = metadata?.category ?? inferCategory(tool)
  const mcpIdentity = getMcpToolIdentity(tool)
  const source = inferSource(tool, metadata)
  const exposure = inferExposure(tool, category)
  const showInMainTimeline =
    metadata?.showInMainTimeline ?? (category !== 'internal' && category !== 'control')

  return {
    name: tool.name,
    aliases: tool.aliases ?? [],
    displayName: metadata?.displayName ?? inferDisplayName(tool, mcpIdentity),
    category,
    source,
    exposure,
    display: {
      showInMainTimeline,
      ...(metadata?.summaryKeys ? { summaryKeys: metadata.summaryKeys } : {}),
      ...(metadata?.detailKeys ? { detailKeys: metadata.detailKeys } : {}),
    },
    tool,
  }
}

function inferCategory(tool: Tool): CcrToolCategory {
  if (tool.isMcp === true) return 'mcp'
  if (INTERNAL_TOOL_NAMES.has(tool.name)) return 'internal'
  if (CONTROL_TOOL_NAMES.has(tool.name)) return 'control'

  if (/^(Read|Edit|Write|Glob|Grep|Notebook)/u.test(tool.name)) {
    return 'file'
  }
  if (/^(Bash|PowerShell|REPL|Workflow|Terminal|LSP)/u.test(tool.name)) {
    return 'runtime'
  }
  if (/^(Web|SubscribePR)/u.test(tool.name)) {
    return 'web'
  }
  if (/^(Agent|Task|Team|SendMessage|Brief|ListPeers)/u.test(tool.name)) {
    return 'agent'
  }
  if (/^(GenerateImage|SendUserFile)/u.test(tool.name)) {
    return 'media'
  }

  return 'control'
}

function inferSource(tool: Tool, metadata?: ToolMetadata): CcrToolSource {
  if (tool.isMcp === true) {
    const mcpIdentity = getMcpToolIdentity(tool)
    return {
      kind: 'mcp',
      ...(mcpIdentity.serverName
        ? {
            serverId: mcpIdentity.serverName,
            serverName: mcpIdentity.serverName,
          }
        : {}),
      ...(mcpIdentity.toolName ? { toolName: mcpIdentity.toolName } : {}),
      ...(tool.pluginId ? { pluginId: tool.pluginId } : {}),
    }
  }

  return {
    kind: metadata?.sourceKind ?? 'builtin',
  }
}

function toToolMetadata(
  metadata: CcrToolDisplayMetadata | undefined,
): ToolMetadata | undefined {
  if (!metadata) {
    return undefined
  }
  return {
    displayName: metadata.displayName,
    category: metadata.category,
    sourceKind: metadata.sourceKind,
    showInMainTimeline: metadata.showInMainTimeline,
    summaryKeys: metadata.summaryKeys,
    detailKeys: metadata.detailKeys,
  }
}

function inferExposure(tool: Tool, category: CcrToolCategory): CcrToolExposure {
  if (category === 'internal' || INTERNAL_TOOL_NAMES.has(tool.name)) {
    return 'internal'
  }
  if (tool.alwaysLoad === true) return 'direct'
  if (tool.isMcp === true || tool.shouldDefer === true) return 'deferred'
  return 'direct'
}

function inferDisplayName(
  tool: Tool,
  mcpIdentity: CcrMcpToolIdentity,
): string {
  if (tool.isMcp === true && mcpIdentity.serverName && mcpIdentity.toolName) {
    return `MCP ${mcpIdentity.serverName} / ${mcpIdentity.toolName}`
  }
  if (tool.isMcp === true && mcpIdentity.serverName) {
    return `MCP ${mcpIdentity.serverName}`
  }
  return tool.name
}

type CcrMcpToolIdentity = {
  serverName?: string
  toolName?: string
}

function getMcpToolIdentity(tool: Tool): CcrMcpToolIdentity {
  if (tool.mcpInfo) {
    return {
      serverName: tool.mcpInfo.serverName,
      toolName: tool.mcpInfo.toolName,
    }
  }

  const nameParts = tool.name.split('__')
  if (tool.isMcp === true && nameParts[0] === 'mcp' && nameParts.length >= 3) {
    return {
      serverName: nameParts[1],
      toolName: nameParts.slice(2).join('__'),
    }
  }

  return {}
}

function createCounter<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map(key => [key, 0])) as Record<T, number>
}
