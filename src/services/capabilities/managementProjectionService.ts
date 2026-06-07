import type {
  ExtensionCapability,
  ExtensionCapabilityCatalog,
  ExtensionCapabilityDiagnostic,
  ExtensionCapabilityHiddenReason,
  ExtensionCapabilityInvocation,
  ExtensionCapabilityKind,
  ExtensionCapabilityRelations,
  ExtensionCapabilitySource,
  ExtensionCapabilityState,
} from './capabilityTypes.js'
import { projectPluginImpact, type PluginImpactProjection } from './pluginImpactProjection.js'

export type CapabilityManagementOwnership =
  | 'installer-owned'
  | 'manual-config'
  | 'plugin-owned'
  | 'runtime-only'

export type CapabilityManagementAction =
  | 'enable'
  | 'disable'
  | 'set-model-invocation'
  | 'set-user-invocation'
  | 'inspect'
  | 'test'
  | 'restart'
  | 'repair'
  | 'uninstall'

export type CapabilityManagementItem = {
  capabilityId: string
  kind: ExtensionCapabilityKind
  name: string
  displayName: string
  description: string
  source: ExtensionCapabilitySource
  relations: ExtensionCapabilityRelations
  state: ExtensionCapabilityState
  invocation: ExtensionCapabilityInvocation
  hiddenReasons: ExtensionCapabilityHiddenReason[]
  diagnostics: ExtensionCapabilityDiagnostic[]
  managementOwnership: CapabilityManagementOwnership
  actionRef?: string
  allowedActions: CapabilityManagementAction[]
  metadata?: Record<string, unknown>
}

export type CapabilityManagementProjection = {
  schemaVersion: 1
  summary: {
    total: number
    skills: number
    mcp: number
    plugins: number
    runtimeVisible: number
    needsAttention: number
  }
  skills: CapabilityManagementItem[]
  mcp: CapabilityManagementItem[]
  plugins: Array<
    CapabilityManagementItem & {
      impact: PluginImpactProjection
    }
  >
  capabilities: CapabilityManagementItem[]
}

export function createCapabilityManagementProjection(
  catalog: ExtensionCapabilityCatalog,
): CapabilityManagementProjection {
  const capabilities = catalog.capabilities.map(toManagementItem)
  const byId = new Map(capabilities.map(item => [item.capabilityId, item]))
  const plugins = catalog.capabilities
    .filter(capability => capability.kind === 'plugin')
    .map(capability => ({
      ...byId.get(capability.id)!,
      impact: projectPluginImpact(catalog.capabilities, capability.source.pluginId ?? capability.name),
    }))

  const skills = capabilities.filter(item => item.kind === 'skill')
  const mcp = capabilities.filter(item => item.kind.startsWith('mcp-'))
  return {
    schemaVersion: 1,
    summary: {
      total: capabilities.length,
      skills: skills.length,
      mcp: mcp.length,
      plugins: plugins.length,
      runtimeVisible: capabilities.filter(item => item.state.runtimeVisible).length,
      needsAttention: capabilities.filter(item =>
        item.diagnostics.some(diagnostic => diagnostic.severity !== 'info'),
      ).length,
    },
    skills,
    mcp,
    plugins,
    capabilities,
  }
}

function toManagementItem(
  capability: ExtensionCapability,
): CapabilityManagementItem {
  const managementOwnership = getManagementOwnership(capability)
  const actionRef =
    capability.relations.installedRef ??
    (capability.kind === 'mcp-server' ? capability.name : undefined)
  return {
    capabilityId: capability.id,
    kind: capability.kind,
    name: capability.name,
    displayName: capability.displayName,
    description: capability.description,
    source: { ...capability.source },
    relations: { ...capability.relations },
    state: {
      ...capability.state,
      hiddenReasons: [...(capability.state.hiddenReasons ?? [])],
    },
    invocation: { ...capability.invocation },
    hiddenReasons: [...(capability.state.hiddenReasons ?? [])],
    diagnostics: capability.diagnostics.map(diagnostic => ({ ...diagnostic })),
    managementOwnership,
    ...(actionRef ? { actionRef } : {}),
    allowedActions: getAllowedActions(capability, managementOwnership),
    ...(capability.metadata ? { metadata: { ...capability.metadata } } : {}),
  }
}

function getManagementOwnership(
  capability: ExtensionCapability,
): CapabilityManagementOwnership {
  if (capability.kind !== 'plugin' && capability.relations.parentPluginId) {
    return 'plugin-owned'
  }
  if (
    capability.kind === 'mcp-server' &&
    capability.metadata?.installKind === 'manual-config'
  ) {
    return 'manual-config'
  }
  if (capability.state.installed || capability.relations.installedRef) {
    return 'installer-owned'
  }
  return 'runtime-only'
}

function getAllowedActions(
  capability: ExtensionCapability,
  ownership: CapabilityManagementOwnership,
): CapabilityManagementAction[] {
  if (capability.kind === 'skill') {
    if (ownership !== 'installer-owned') return ['inspect']
    return [
      capability.state.enabled ? 'disable' : 'enable',
      'set-model-invocation',
      'set-user-invocation',
      'inspect',
      'repair',
      'uninstall',
    ]
  }
  if (capability.kind === 'mcp-server') {
    const actions: CapabilityManagementAction[] = ['inspect']
    if (ownership === 'manual-config' || ownership === 'installer-owned') {
      actions.unshift(capability.state.enabled ? 'disable' : 'enable')
      actions.push('test', 'restart')
    }
    if (ownership === 'installer-owned') {
      actions.push('repair', 'uninstall')
    }
    return actions
  }
  return ['inspect']
}
