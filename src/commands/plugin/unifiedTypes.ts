export type UnifiedInstalledPluginItem = {
  type: 'plugin'
  id: string
  name: string
  description?: string
  marketplace: string
  scope: string
  isEnabled: boolean
  errorCount: number
  errors: unknown[]
  plugin: unknown
  pendingEnable?: boolean
  pendingUpdate?: boolean
  pendingToggle?: 'will-enable' | 'will-disable'
  indented?: boolean
}

export type UnifiedInstalledFlaggedPluginItem = {
  type: 'flagged-plugin'
  id: string
  name: string
  marketplace: string
  reason: string
  text: string
  flaggedAt: string
  scope?: string
  indented?: boolean
}

export type UnifiedInstalledFailedPluginItem = {
  type: 'failed-plugin'
  id: string
  name: string
  marketplace: string
  scope: string
  errorCount: number
  errors: unknown[]
  indented?: boolean
}

export type UnifiedInstalledMcpItem = {
  type: 'mcp'
  id: string
  name: string
  description?: string
  scope: string
  status: 'connected' | 'disabled' | 'pending' | 'needs-auth' | 'failed'
  client: unknown
  indented?: boolean
}

export type UnifiedInstalledItem =
  | UnifiedInstalledPluginItem
  | UnifiedInstalledFlaggedPluginItem
  | UnifiedInstalledFailedPluginItem
  | UnifiedInstalledMcpItem
