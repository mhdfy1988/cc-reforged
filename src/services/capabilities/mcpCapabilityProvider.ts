import type { Tool } from '../../Tool.js'
import type { Command } from '../../types/command.js'
import type { MCPServerConnection, ServerResource } from '../mcp/types.js'
import type {
  ExtensionCapability,
  ExtensionCapabilityDiagnostic,
  ExtensionCapabilitySourceKind,
  ExtensionCapabilityStatus,
} from './capabilityTypes.js'
import type {
  ExtensionCapabilityProvider,
  ExtensionCapabilityProviderContext,
} from './capabilityCatalog.js'
import { normalizePluginId } from './pluginIdentityResolver.js'
import { createExtensionCapabilityId } from './capabilityIdentity.js'
import type {
  CapabilityMcpConfigServer,
  CapabilityMcpConfigSnapshot,
  CapabilityRuntimeEnvironment,
} from './capabilityRuntimeEnvironment.js'

type CoreMcpServer = CapabilityMcpConfigServer

export type McpRuntimeSurfaceCapabilityProviderContext =
  ExtensionCapabilityProviderContext & {
    capabilityEnvironment?: CapabilityRuntimeEnvironment
    mcpConfig?: CapabilityMcpConfigSnapshot
    mcp?: {
      clients?: readonly MCPServerConnection[]
      tools?: readonly Tool[]
      commands?: readonly Command[]
      resources?: Record<string, readonly ServerResource[]>
    }
    mcpClients?: readonly MCPServerConnection[]
    mcpTools?: readonly Tool[]
    mcpCommands?: readonly Command[]
    mcpResources?: Record<string, readonly ServerResource[]>
  }

export function createMcpCapabilityProvider(): ExtensionCapabilityProvider {
  return {
    id: 'mcp',
    async listCapabilities(context) {
      return listMcpCapabilities(context)
    },
  }
}

export async function listMcpCapabilities(
  context: ExtensionCapabilityProviderContext = {},
): Promise<ExtensionCapability[]> {
  const providerContext =
    context as McpRuntimeSurfaceCapabilityProviderContext
  const result =
    providerContext.capabilityEnvironment?.mcpConfig ??
    providerContext.mcpConfig ?? {
      servers: [],
      errors: [],
    }
  const servers = [...result.servers] as CoreMcpServer[]
  const runtimeClients = getMcpClients(providerContext)
  const runtimeClientByName = new Map(
    runtimeClients.map(client => [client.name, client]),
  )
  const configuredServerNames = new Set(servers.map(server => server.name))
  const capabilities = [
    ...servers.map(server =>
      toExtensionCapability(server, runtimeClientByName.get(server.name)),
    ),
    ...runtimeClients
      .filter(client => !configuredServerNames.has(client.name))
      .map(toRuntimeServerCapability),
    ...listMcpRuntimeSurfaceCapabilities(
      providerContext,
    ),
  ]
  const errors = [...result.errors]
  if (errors.length === 0) {
    return capabilities
  }
  return [
    ...capabilities,
    {
      schemaVersion: 1,
      id: 'mcp:catalog-errors',
      name: 'mcp:catalog-errors',
      displayName: 'MCP catalog errors',
      description: 'MCP 配置读取存在错误。',
      kind: 'mcp-server',
      source: {
        kind: 'mcp',
        label: 'MCP config',
      },
      state: {
        installed: false,
        enabled: false,
        available: false,
        runtimeVisible: false,
        status: 'failed',
      },
      invocation: {
        modelInvocable: false,
        userInvocable: false,
        toolInvocable: false,
      },
      relations: {},
      diagnostics: errors.map(error => ({
        kind: 'source',
        severity: 'error',
        message: formatMcpCatalogError(error),
      })),
    },
  ]
}

function formatMcpCatalogError(error: unknown): string {
  if (typeof error === 'string') return error
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function listMcpRuntimeSurfaceCapabilities(
  context: McpRuntimeSurfaceCapabilityProviderContext = {},
): ExtensionCapability[] {
  return [
    ...listMcpResourceCapabilities(getMcpResources(context)),
    ...listMcpPromptCapabilities(getMcpCommands(context)),
  ].sort((a, b) => a.id.localeCompare(b.id))
}

function toExtensionCapability(
  server: CoreMcpServer,
  runtimeClient?: MCPServerConnection,
  options: { configured?: boolean } = { configured: true },
): ExtensionCapability {
  const configured = options.configured !== false && server.configured !== false
  const availability = getMcpServerAvailability(server, runtimeClient)
  const sourceKind: ExtensionCapabilitySourceKind =
    server.source === 'plugin' ? 'plugin' : 'mcp'
  const pluginId = normalizePluginId(server.pluginSource)
  const diagnostics = createMcpServerDiagnostics(server.name, availability)
  const installed = Boolean(server.installedRef ?? server.ccrInstalled)
  return {
    schemaVersion: 1,
    id: createExtensionCapabilityId({
      kind: 'mcp-server',
      sourceKind,
      name: server.name,
      sourceRef: server.scope,
      pluginId,
      mcpServerName: server.name,
    }),
    name: server.name,
    displayName: server.name,
    description: server.command ?? server.url ?? server.transport ?? server.name,
    kind: 'mcp-server',
    source: {
      kind: sourceKind,
      label: server.source ?? 'mcp',
      ref: server.scope,
      ...(pluginId ? { pluginId } : {}),
      mcpServerName: server.name,
    },
    state: {
      installed,
      configured,
      enabled: availability.enabled,
      available: availability.available,
      runtimeConnected: runtimeClient?.type === 'connected',
      runtimeVisible: false,
      status: availability.status,
    },
    invocation: {
      modelInvocable: false,
      userInvocable: false,
      toolInvocable: false,
    },
    relations: {
      ...(pluginId ? { parentPluginId: pluginId } : {}),
      ...(server.installedRef ? { installedRef: server.installedRef } : {}),
      runtimeRef: `mcp:${server.name}`,
    },
    diagnostics,
    metadata: {
      scope: server.scope,
      type: server.type,
      transport: server.transport,
      installKind: server.installKind,
      ccrInstalled: installed,
      installedRef: server.installedRef,
      installedRecordScope: server.installedRecordScope,
      configured,
      pluginSource: server.pluginSource,
      command: server.command,
      url: server.url,
      args: server.args,
      runtimeType: runtimeClient?.type,
      runtimeError: runtimeClient?.type === 'failed' ? runtimeClient.error : undefined,
    },
  }
}

function toRuntimeServerCapability(
  runtimeClient: MCPServerConnection,
): ExtensionCapability {
  return toExtensionCapability(
    {
      name: runtimeClient.name,
      enabled: runtimeClient.type !== 'disabled',
      scope: runtimeClient.config.scope,
      type: runtimeClient.config.type,
      transport: runtimeClient.config.type,
      source: runtimeClient.config.pluginSource ? 'plugin' : 'mcp',
      pluginSource: runtimeClient.config.pluginSource,
      command:
        'command' in runtimeClient.config ? runtimeClient.config.command : undefined,
      url: 'url' in runtimeClient.config ? runtimeClient.config.url : undefined,
      args: 'args' in runtimeClient.config ? runtimeClient.config.args : undefined,
    },
    runtimeClient,
    { configured: false },
  )
}

type McpServerAvailability = {
  enabled: boolean
  available: boolean
  status: ExtensionCapabilityStatus
  code?: string
  message?: string
  severity?: ExtensionCapabilityDiagnostic['severity']
}

function getMcpServerAvailability(
  server: CoreMcpServer,
  runtimeClient?: MCPServerConnection,
): McpServerAvailability {
  if (server.enabled === false || runtimeClient?.type === 'disabled') {
    return {
      enabled: false,
      available: false,
      status: 'disabled',
      code: 'mcp-disabled',
      message: `MCP server ${server.name} is disabled.`,
      severity: 'info',
    }
  }
  if (!runtimeClient) {
    return {
      enabled: true,
      available: false,
      status: 'unavailable',
      code: 'mcp-runtime-unavailable',
      message: `MCP server ${server.name} is configured but not connected in the current runtime snapshot.`,
      severity: 'warning',
    }
  }
  switch (runtimeClient.type) {
    case 'connected':
      return {
        enabled: true,
        available: true,
        status: 'enabled',
      }
    case 'needs-auth':
      return {
        enabled: true,
        available: false,
        status: 'needs-auth',
        code: 'mcp-needs-auth',
        message: `MCP server ${server.name} needs authentication.`,
      }
    case 'failed':
      return {
        enabled: true,
        available: false,
        status: 'failed',
        code: 'mcp-failed',
        message:
          runtimeClient.error ?? `MCP server ${server.name} failed to connect.`,
      }
    case 'pending':
      return {
        enabled: true,
        available: false,
        status: 'unavailable',
        code: 'mcp-pending',
        message: `MCP server ${server.name} is pending connection.`,
      }
  }
}

function createMcpServerDiagnostics(
  serverName: string,
  availability: McpServerAvailability,
): ExtensionCapabilityDiagnostic[] {
  if (!availability.code || !availability.message) {
    return []
  }
  return [
    {
      kind: 'availability',
      severity:
        availability.severity ??
        (availability.status === 'failed' ? 'error' : 'warning'),
      code: availability.code,
      message: availability.message,
    },
  ]
}

function listMcpResourceCapabilities(
  resourcesByServer: Record<string, readonly ServerResource[]>,
): ExtensionCapability[] {
  const capabilities: ExtensionCapability[] = []
  for (const [serverName, resources] of Object.entries(resourcesByServer)) {
    for (const resource of resources) {
      const name = resource.name ?? resource.uri
      capabilities.push({
        schemaVersion: 1,
        id: createExtensionCapabilityId({
          kind: 'mcp-resource',
          sourceKind: 'mcp',
          name,
          sourceRef: resource.uri,
          mcpServerName: serverName,
        }),
        name,
        displayName: name,
        description:
          resource.description ?? resource.mimeType ?? `MCP resource ${resource.uri}`,
        kind: 'mcp-resource',
        source: {
          kind: 'mcp',
          label: `MCP ${serverName}`,
          mcpServerName: serverName,
        },
        state: {
          installed: false,
          enabled: true,
          available: true,
          runtimeVisible: false,
          status: 'available',
        },
        invocation: {
          modelInvocable: false,
          userInvocable: false,
          toolInvocable: false,
        },
        relations: {
          parentMcpServerName: serverName,
          runtimeRef: `mcp-resource:${serverName}:${resource.uri}`,
        },
        diagnostics: [],
        metadata: {
          uri: resource.uri,
          mimeType: resource.mimeType,
          server: resource.server ?? serverName,
        },
      })
    }
  }
  return capabilities
}

function listMcpPromptCapabilities(
  commands: readonly Command[],
): ExtensionCapability[] {
  return commands
    .filter(isMcpPromptCommand)
    .map(command => {
      const serverName = getMcpPromptServerName(command)
      const enabled = isCommandEnabled(command)
      return {
        schemaVersion: 1,
        id: createExtensionCapabilityId({
          kind: 'mcp-prompt',
          sourceKind: 'mcp',
          name: command.name,
          sourceRef: command.loadedFrom,
          pluginId: command.pluginId,
          mcpServerName: serverName,
        }),
        name: command.name,
        displayName: command.userFacingName?.() ?? command.name,
        description: command.description,
        kind: 'mcp-prompt',
        source: {
          kind: 'mcp',
          label: serverName ? `MCP ${serverName}` : 'MCP prompt',
          ...(serverName ? { mcpServerName: serverName } : {}),
          ...(command.pluginId ? { pluginId: command.pluginId } : {}),
        },
        state: {
          installed: false,
          enabled,
          available: enabled,
          runtimeVisible: false,
          status: enabled ? 'available' : 'disabled',
        },
        invocation: {
          modelInvocable: false,
          userInvocable: command.userInvocable !== false,
          toolInvocable: false,
        },
        relations: {
          ...(command.pluginId ? { parentPluginId: command.pluginId } : {}),
          ...(serverName ? { parentMcpServerName: serverName } : {}),
          runtimeRef: `mcp-prompt:${command.name}`,
        },
        diagnostics: [],
        metadata: {
          argNames: command.argNames,
          loadedFrom: command.loadedFrom,
          isMcp: command.isMcp === true,
        },
      } satisfies ExtensionCapability
    })
}

function isMcpPromptCommand(
  command: Command,
): command is Extract<Command, { type: 'prompt' }> {
  return (
    command.type === 'prompt' &&
    command.isMcp === true &&
    command.loadedFrom !== 'mcp'
  )
}

function getMcpPromptServerName(command: Command): string | undefined {
  const displayName = command.userFacingName?.()
  const displayMatch = displayName?.match(/^([^:]+):/)
  if (displayMatch?.[1]) return displayMatch[1]

  const parts = command.name.split('__')
  if (parts.length >= 3 && parts[0] === 'mcp') {
    return parts[1]
  }
  return undefined
}

function isCommandEnabled(command: Command): boolean {
  if (!command.isEnabled) return true
  try {
    return command.isEnabled()
  } catch {
    return false
  }
}

function getMcpResources(
  context: McpRuntimeSurfaceCapabilityProviderContext,
): Record<string, readonly ServerResource[]> {
  return (
    context.capabilityEnvironment?.mcpRuntime.resources ??
    context.mcpResources ??
    context.mcp?.resources ??
    {}
  )
}

function getMcpClients(
  context: McpRuntimeSurfaceCapabilityProviderContext,
): readonly MCPServerConnection[] {
  return (
    context.capabilityEnvironment?.mcpRuntime.clients ??
    context.mcpClients ??
    context.mcp?.clients ??
    []
  )
}

function getMcpCommands(
  context: McpRuntimeSurfaceCapabilityProviderContext,
): readonly Command[] {
  return (
    context.capabilityEnvironment?.mcpRuntime.commands ??
    context.mcpCommands ??
    context.mcp?.commands ??
    []
  )
}
