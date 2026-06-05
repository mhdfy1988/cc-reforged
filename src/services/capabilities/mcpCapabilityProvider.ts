import { listCoreMcpServers } from '../../core/mcpCore.js'
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

type CoreMcpServer = {
  name: string
  enabled?: boolean
  scope?: string
  type?: string
  transport?: string
  source?: string
  installKind?: string
  command?: string
  url?: string
  args?: string[]
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
  _context: ExtensionCapabilityProviderContext = {},
): Promise<ExtensionCapability[]> {
  const result = await listCoreMcpServers({ includeDisabled: true })
  const servers = Object.values(result.servers ?? {}) as CoreMcpServer[]
  const capabilities = servers.map(toExtensionCapability)
  const errors = Array.isArray(result.errors) ? result.errors : []
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
        message: String(error),
      })),
    },
  ]
}

function toExtensionCapability(server: CoreMcpServer): ExtensionCapability {
  const enabled = server.enabled !== false
  const status: ExtensionCapabilityStatus = enabled ? 'enabled' : 'disabled'
  const sourceKind: ExtensionCapabilitySourceKind =
    server.source === 'plugin' ? 'plugin' : 'mcp'
  const diagnostics: ExtensionCapabilityDiagnostic[] = enabled
    ? []
    : [
        {
          kind: 'availability',
          severity: 'info',
          code: 'mcp-disabled',
          message: `MCP server ${server.name} is disabled.`,
        },
      ]
  return {
    schemaVersion: 1,
    id: `mcp-server:${server.name}`,
    name: server.name,
    displayName: server.name,
    description: server.command ?? server.url ?? server.transport ?? server.name,
    kind: 'mcp-server',
    source: {
      kind: sourceKind,
      label: server.source ?? 'mcp',
      ref: server.scope,
      ...(sourceKind === 'plugin' ? { pluginId: server.installKind } : {}),
      mcpServerName: server.name,
    },
    state: {
      installed: true,
      enabled,
      available: enabled,
      runtimeVisible: false,
      status,
    },
    invocation: {
      modelInvocable: false,
      userInvocable: false,
      toolInvocable: false,
    },
    relations: {
      ...(sourceKind === 'plugin' && server.installKind
        ? { parentPluginId: server.installKind }
        : {}),
      runtimeRef: `mcp:${server.name}`,
    },
    diagnostics,
    metadata: {
      scope: server.scope,
      type: server.type,
      transport: server.transport,
      installKind: server.installKind,
      command: server.command,
      url: server.url,
      args: server.args,
    },
  }
}
