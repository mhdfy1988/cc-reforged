export type ExtensionCapabilityKind =
  | 'skill'
  | 'mcp-server'
  | 'mcp-tool'
  | 'tool'
  | 'command'
  | 'plugin'

export type ExtensionCapabilitySourceKind =
  | 'managed-skill'
  | 'user-skill'
  | 'project-skill'
  | 'plugin'
  | 'bundled'
  | 'dynamic'
  | 'mcp'
  | 'provider'
  | 'builtin'
  | 'legacy'
  | 'unknown'

export type ExtensionCapabilityStatus =
  | 'available'
  | 'enabled'
  | 'disabled'
  | 'unavailable'
  | 'needs-auth'
  | 'failed'
  | 'missing'
  | 'drifted'
  | 'invalid'
  | 'hidden-by-conflict'

export type ExtensionCapabilityDiagnosticSeverity = 'info' | 'warning' | 'error'

export type ExtensionCapabilityDiagnosticKind =
  | 'conflict'
  | 'availability'
  | 'integrity'
  | 'source'
  | 'runtime'
  | 'plugin'
  | 'unknown'

export type ExtensionCapabilityDiagnostic = {
  kind: ExtensionCapabilityDiagnosticKind
  severity: ExtensionCapabilityDiagnosticSeverity
  message: string
  code?: string
}

export type ExtensionCapabilitySource = {
  kind: ExtensionCapabilitySourceKind
  label: string
  ref?: string
  pluginId?: string
  mcpServerName?: string
}

export type ExtensionCapabilityState = {
  installed: boolean
  enabled: boolean
  available: boolean
  runtimeVisible: boolean
  status: ExtensionCapabilityStatus
}

export type ExtensionCapabilityInvocation = {
  modelInvocable: boolean
  userInvocable: boolean
  toolInvocable: boolean
}

export type ExtensionCapabilityRelations = {
  parentPluginId?: string
  parentMcpServerName?: string
  installedRef?: string
  runtimeRef?: string
}

export type ExtensionCapability = {
  schemaVersion: 1
  id: string
  name: string
  displayName: string
  description: string
  kind: ExtensionCapabilityKind
  source: ExtensionCapabilitySource
  state: ExtensionCapabilityState
  invocation: ExtensionCapabilityInvocation
  relations: ExtensionCapabilityRelations
  diagnostics: ExtensionCapabilityDiagnostic[]
  metadata?: Record<string, unknown>
}

export type ExtensionCapabilityCatalogSummary = {
  total: number
  runtimeVisible: number
  byKind: Record<ExtensionCapabilityKind, number>
  bySourceKind: Record<ExtensionCapabilitySourceKind, number>
  byStatus: Record<ExtensionCapabilityStatus, number>
}

export type ExtensionCapabilityCatalog = {
  schemaVersion: 1
  capabilities: ExtensionCapability[]
  runtimeVisible: ExtensionCapability[]
  diagnostics: ExtensionCapabilityDiagnostic[]
  summary: ExtensionCapabilityCatalogSummary
}
