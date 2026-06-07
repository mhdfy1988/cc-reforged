import type { Tool, Tools } from '../../Tool.js'
import type { LoadedPlugin, PluginError } from '../../types/plugin.js'
import type { CcrMcpRuntimeSnapshot } from '../mcp/runtimeSnapshot.js'
import type { AppConnectorCapabilityInput } from './appCapabilityProvider.js'

export type CapabilityRequestScope = {
  cwd: string
  configHomeDir: string
}

export type CapabilityMcpConfigServer = {
  name: string
  enabled?: boolean
  scope?: string
  type?: string
  transport?: string
  source?: string
  installKind?: string
  pluginSource?: string
  command?: string
  url?: string
  args?: string[]
}

export type CapabilityMcpConfigSnapshot = {
  configPath?: string
  inventory?: unknown
  servers: readonly CapabilityMcpConfigServer[]
  errors: readonly unknown[]
}

export type CapabilityPluginSnapshot = {
  plugins: readonly LoadedPlugin[]
  errors: readonly PluginError[]
}

export type CapabilityRuntimeEnvironment = {
  schemaVersion: 1
  request: CapabilityRequestScope
  mcpConfig: CapabilityMcpConfigSnapshot
  mcpRuntime: CcrMcpRuntimeSnapshot
  plugins: CapabilityPluginSnapshot
  apps: readonly AppConnectorCapabilityInput[]
  tools: Tools
  activeAgentCount: number
  platform?: NodeJS.Platform
  connectedMcpServerNames: readonly string[]
  mcpServerStatuses: Record<string, unknown>
}

export type CapabilityRuntimeEnvironmentContext = {
  capabilityEnvironment?: CapabilityRuntimeEnvironment
  tools?: readonly Tool[]
}
