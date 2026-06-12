import type { LoadedPlugin, PluginManifest } from '../../types/plugin.js'
import type {
  MarketplaceSource,
  PluginScope,
  PluginSource,
} from '../../utils/plugins/schemas.js'

export type PluginDomainContext = {
  workspaceRoot: string
  currentCwd: string
  configHomeDir: string
  runtimeInstanceId: string
  requestId: string
  environment: Readonly<Record<string, string | undefined>>
}

export type PluginInstallationTarget = {
  scope: PluginScope
  workspaceRoot?: string
}

export type PluginDiagnosticLayer =
  | 'settings'
  | 'installation'
  | 'marketplace'
  | 'package'
  | 'runtime'

export type PluginDiagnostic = {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
  layer: PluginDiagnosticLayer
  pluginId?: string
  installationKey?: string
  component?: string
  path?: string
}

export type PluginCandidate = {
  pluginId: string
  sourceId: string
  sourceKind: 'marketplace' | 'builtin' | 'inline' | 'managed' | 'runtime'
  version?: string
  manifestDigest?: string
  manifest?: PluginManifest
  marketplacePath?: string
  marketplaceRoot?: string
  source?: PluginSource
  strict?: boolean
  allowCrossMarketplaceDependenciesOn?: string[]
}

export type PluginMaterialization =
  | 'present'
  | 'missing'
  | 'drifted'
  | 'invalid'

export type PluginInstallationInstance = {
  key: string
  pluginId: string
  target: PluginInstallationTarget
  installedVersion?: string
  packagePath: string
  materialization: PluginMaterialization
  installationRevision: string
  installedAt?: string
  lastUpdated?: string
  gitCommitSha?: string
  applicableToRequest: boolean
  manifest?: PluginManifest
}

export type PluginIntent = 'enabled' | 'disabled' | 'unset' | 'blocked'

export type PluginIntentByScope = {
  pluginId: string
  target: PluginInstallationTarget
  intent: PluginIntent
  source: 'managed' | 'user' | 'project' | 'local'
  settingsPath: string
}

export type PluginComponentActivation = {
  component: string
  state: 'inactive' | 'active' | 'failed' | 'restart-required'
  diagnostic?: string
}

export type PluginRuntimeActivation = {
  runtimeInstanceId: string
  pluginId: string
  activeVersion?: string
  activationRevision: string
  state: 'inactive' | 'activating' | 'active' | 'partial' | 'failed'
  components: PluginComponentActivation[]
}

export type PluginRuntimeSnapshot = {
  activations: readonly PluginRuntimeActivation[]
  loadedPlugins: readonly LoadedPlugin[]
}

export type PluginRollbackVersion = {
  retentionId: string
  pluginId: string
  version: string
  packagePath: string
  reason: 'update' | 'rollback'
  operationId: string
  createdAt: string
  expiresAt: string
}

export type PluginRollbackRetentionSnapshot = {
  schemaVersion: 1
  records: PluginRollbackVersion[]
}

export type PluginDependencyState = {
  directDependencies: string[]
  transitiveDependencies: string[]
  reverseDependents: string[]
  crossMarketplaceEdges: Array<{
    from: string
    to: string
    trusted: boolean
  }>
  semverSupport: 'exact-version-only'
}

export type PluginEffectiveSelection = {
  installationKey?: string
  target?: PluginInstallationTarget
  intent: PluginIntent
  enabled: boolean
  installed: boolean
  active: boolean
  pendingActivation: boolean
}

export type PluginDerivedManagementState = {
  installed: boolean
  enabled: boolean
  active: boolean
  partialActivation: boolean
  restartRequired: boolean
  updateAvailable: boolean
  needsAttention: boolean
  status:
    | 'available'
    | 'installed-disabled'
    | 'enabled-pending-activation'
    | 'active'
    | 'active-partial'
    | 'restart-required'
    | 'missing'
    | 'invalid'
    | 'failed'
}

export type PluginManagementRecord = {
  pluginId: string
  displayName: string
  description: string
  candidates: PluginCandidate[]
  installations: PluginInstallationInstance[]
  intents: PluginIntentByScope[]
  effectiveSelection?: PluginEffectiveSelection
  runtimeActivations: PluginRuntimeActivation[]
  rollbackVersions: PluginRollbackVersion[]
  dependencies: PluginDependencyState
  appRelations: PluginAppRelation[]
  derivedState: PluginDerivedManagementState
  diagnostics: PluginDiagnostic[]
}

export type PluginAppRelationKind =
  | 'provides'
  | 'requires'
  | 'suggests'
  | 'configures'

export type PluginAppRelation = {
  pluginId: string
  appId: string
  displayName?: string
  description?: string
  relation: PluginAppRelationKind
  skillIds: string[]
  mcpServerNames: string[]
  toolIds: string[]
}

export type PluginCatalogSnapshot = {
  schemaVersion: 1
  context: PluginDomainContext
  marketplaces: PluginMarketplaceSnapshot
  candidates: PluginCandidate[]
  plugins: PluginManagementRecord[]
  diagnostics: PluginDiagnostic[]
  loadedPlugins: LoadedPlugin[]
}

export type PluginSettingsScope = 'managed' | 'user' | 'project' | 'local'

export type PluginSettingsEntry = {
  scope: PluginSettingsScope
  path: string
  enabledPlugins: Record<string, boolean | string[]>
  diagnostics: PluginDiagnostic[]
}

export type PluginSettingsSnapshot = {
  entries: PluginSettingsEntry[]
  diagnostics: PluginDiagnostic[]
}

export type PluginInstallationRegistryEntry = {
  pluginId: string
  scope: PluginScope
  projectPath?: string
  installPath: string
  version?: string
  installedAt?: string
  lastUpdated?: string
  gitCommitSha?: string
}

export type PluginInstallationRegistrySnapshot = {
  schemaVersion: 1 | 2 | null
  entries: PluginInstallationRegistryEntry[]
  diagnostics: PluginDiagnostic[]
}

export type PluginMarketplaceSnapshot = {
  sources: PluginMarketplaceSourceRecord[]
  candidates: PluginCandidate[]
  diagnostics: PluginDiagnostic[]
}

export type PluginMarketplaceSourceRecord = {
  name: string
  source: MarketplaceSource
  installLocation: string
  lastUpdated: string
  autoUpdate: boolean
  candidateCount: number
  declaredScopes: PluginConfigurationScope[]
  state: 'available' | 'missing' | 'invalid'
  diagnostics: PluginDiagnostic[]
}

export type PluginPackageInspection = {
  materialization: PluginMaterialization
  manifest?: PluginManifest
  loadedPlugin?: LoadedPlugin
  diagnostics: PluginDiagnostic[]
}

export type PluginConfigurationScope = 'user' | 'project' | 'local'

export type PluginConfigurationIdentity = {
  pluginId: string
  scope: PluginConfigurationScope
  workspaceRoot?: string
}

export type PluginOptionLayerSnapshot = {
  scope: PluginConfigurationScope
  path: string
  values: Readonly<Record<string, unknown>>
}

export type PluginSecretStatusSnapshot = {
  configured: boolean
  keyCount: number
  storageKey: string
  storagePath: string
  error?: string
}

export type PluginConfigurationSnapshot = {
  identity: PluginConfigurationIdentity
  layers: PluginOptionLayerSnapshot[]
  effectiveOptions: Readonly<Record<string, unknown>>
  secretStatus: PluginSecretStatusSnapshot
  data: {
    path: string
    exists: boolean
  }
  diagnostics: PluginDiagnostic[]
}
