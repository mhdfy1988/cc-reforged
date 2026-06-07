import {
  listCapabilityManagementProjection,
  listExtensionCapabilities,
} from '../services/capabilities/capabilityService.js'
import type {
  CapabilityMcpConfigSnapshot,
  CapabilityPluginSnapshot,
  CapabilityRuntimeEnvironment,
} from '../services/capabilities/capabilityRuntimeEnvironment.js'
import type { AppConnectorCapabilityInput } from '../services/capabilities/appCapabilityProvider.js'
import type { CapabilityManagementProjection } from '../services/capabilities/managementProjectionService.js'
import {
  loadCcrMcpRuntimeSnapshot,
  type CcrMcpRuntimeSnapshot,
} from '../services/mcp/runtimeSnapshot.js'
import { buildAppServerToolPool } from '../services/tools/appServerToolPool.js'
import { getEmptyToolPermissionContext, type ToolPermissionContext } from '../Tool.js'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { pathsEqual } from '../utils/file.js'
import { loadAllPluginsCacheOnly } from '../utils/plugins/pluginLoader.js'
import { listCoreMcpServers } from './mcpCore.js'
import { resolve } from 'node:path'

export type CoreCapabilityListParams = {
  cwd?: string
  configHomeDir?: string
  mcpRuntime?: CcrMcpRuntimeSnapshot
  mcpConfig?: CapabilityMcpConfigSnapshot
  pluginSnapshot?: CapabilityPluginSnapshot
  apps?: readonly AppConnectorCapabilityInput[]
  toolPermissionContext?: ToolPermissionContext
  activeAgentCount?: number
  platform?: NodeJS.Platform
}

export async function listCoreCapabilities(
  params: CoreCapabilityListParams = {},
): Promise<Record<string, unknown>> {
  return listExtensionCapabilities(await createCapabilityProviderContext(params))
}

export async function listCoreCapabilityManagement(
  params: CoreCapabilityListParams = {},
): Promise<CapabilityManagementProjection> {
  return listCapabilityManagementProjection(
    await createCapabilityProviderContext(params),
  )
}

async function createCapabilityProviderContext(
  params: CoreCapabilityListParams,
): Promise<Record<string, unknown>> {
  const capabilityEnvironment = await createCapabilityRuntimeEnvironment(params)
  const { mcpRuntime } = capabilityEnvironment
  const mcpServerStatuses = Object.fromEntries(
    mcpRuntime.clients.map(client => [
      client.name,
      client.type === 'failed'
        ? { state: client.type, error: client.error }
        : client.type,
    ]),
  )
  return {
    capabilityEnvironment,
    cwd: capabilityEnvironment.request.cwd,
    configHomeDir: capabilityEnvironment.request.configHomeDir,
    mcpConfig: capabilityEnvironment.mcpConfig,
    mcp: mcpRuntime,
    mcpCommands: mcpRuntime.commands,
    mcpResources: mcpRuntime.resources,
    loadedPlugins: capabilityEnvironment.plugins.plugins,
    pluginLoadErrors: capabilityEnvironment.plugins.errors,
    apps: capabilityEnvironment.apps,
    runtime: 'app-server',
    activeAgentCount: capabilityEnvironment.activeAgentCount,
    ...(capabilityEnvironment.platform
      ? { platform: capabilityEnvironment.platform }
      : {}),
    connectedMcpServerNames: capabilityEnvironment.connectedMcpServerNames,
    mcpServerStatuses,
    tools: capabilityEnvironment.tools,
  }
}

async function createCapabilityRuntimeEnvironment(
  params: CoreCapabilityListParams,
): Promise<CapabilityRuntimeEnvironment> {
  const cwd = resolve(params.cwd ?? process.cwd())
  const configHomeDir = resolve(
    params.configHomeDir ?? getClaudeConfigHomeDir(),
  )
  const activeConfigHomeDir = resolve(getClaudeConfigHomeDir())
  const usesActiveConfigHome = pathsEqual(configHomeDir, activeConfigHomeDir)
  const pluginSnapshot =
    params.pluginSnapshot ??
    (usesActiveConfigHome
      ? await loadCapabilityPluginSnapshot()
      : createForeignHomePluginSnapshot(configHomeDir))
  const mcpRuntime =
    params.mcpRuntime ??
    (usesActiveConfigHome
      ? await loadCcrMcpRuntimeSnapshot('capability-catalog')
      : createEmptyMcpRuntimeSnapshot())
  const mcpConfig =
    params.mcpConfig ??
    (await listCoreMcpServers({
      includeDisabled: true,
      cwd,
      configHomeDir,
      pluginSnapshot,
    }))
  const connectedMcpServerNames = mcpRuntime.clients
    .filter(client => client.type === 'connected')
    .map(client => client.name)
  const mcpServerStatuses = Object.fromEntries(
    mcpRuntime.clients.map(client => [
      client.name,
      client.type === 'failed'
        ? { state: client.type, error: client.error }
        : client.type,
    ]),
  )
  const activeAgentCount = params.activeAgentCount ?? 0
  const tools = buildAppServerToolPool({
    permissionContext:
      params.toolPermissionContext ?? getEmptyToolPermissionContext(),
    mcpTools: mcpRuntime.tools,
    activeAgentCount,
    connectedMcpServerNames,
    mcpServerStatuses,
    ...(params.platform ? { platform: params.platform } : {}),
  })

  return {
    schemaVersion: 1,
    request: {
      cwd,
      configHomeDir,
    },
    mcpConfig,
    mcpRuntime,
    plugins: pluginSnapshot,
    apps: params.apps ?? [],
    tools,
    activeAgentCount,
    ...(params.platform ? { platform: params.platform } : {}),
    connectedMcpServerNames,
    mcpServerStatuses,
  }
}

async function loadCapabilityPluginSnapshot(): Promise<CapabilityPluginSnapshot> {
  try {
    const result = await loadAllPluginsCacheOnly()
    return {
      plugins: [...result.enabled, ...result.disabled],
      errors: result.errors,
    }
  } catch (error) {
    return {
      plugins: [],
      errors: [
        {
          type: 'generic-error',
          source: 'capability-runtime-environment',
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    }
  }
}

function createForeignHomePluginSnapshot(
  configHomeDir: string,
): CapabilityPluginSnapshot {
  return {
    plugins: [],
    errors: [
      {
        type: 'generic-error',
        source: 'capability-runtime-environment',
        error: `Plugin snapshot for non-active config home is unavailable: ${configHomeDir}`,
      },
    ],
  }
}

function createEmptyMcpRuntimeSnapshot(): CcrMcpRuntimeSnapshot {
  return {
    clients: [],
    tools: [],
    commands: [],
    resources: {},
  }
}
