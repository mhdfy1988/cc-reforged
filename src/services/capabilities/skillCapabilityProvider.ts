import { getSkillRuntimeCatalogForCwd } from '../../commands.js'
import {
  createSkillRuntimeCapabilityCatalog,
  type SkillRuntimeCapability,
} from '../../skills/skillRuntimeCatalog.js'
import { listInstalledSkillPackageInspections } from '../skills/installedPackageInspection.js'
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

export type SkillCapabilityProviderContext = ExtensionCapabilityProviderContext & {
  cwd?: string
  configHomeDir?: string
}

export function createSkillCapabilityProvider(): ExtensionCapabilityProvider {
  return {
    id: 'skills',
    async listCapabilities(context) {
      return listSkillCapabilities(context as SkillCapabilityProviderContext)
    },
  }
}

export async function listSkillCapabilities(
  context: SkillCapabilityProviderContext = {},
): Promise<ExtensionCapability[]> {
  const cwd = typeof context.cwd === 'string' ? context.cwd : process.cwd()
  const [runtime, installedInspections] = await Promise.all([
    getSkillRuntimeCatalogForCwd(cwd),
    listInstalledSkillPackageInspections({
      configHomeDir:
        typeof context.configHomeDir === 'string'
          ? context.configHomeDir
          : undefined,
    }),
  ])

  const catalog = createSkillRuntimeCapabilityCatalog({
    commands: runtime.sourceCommands,
    installed: installedInspections.installed,
  })

  return catalog.capabilities.map(toExtensionCapability)
}

function toExtensionCapability(
  capability: SkillRuntimeCapability,
): ExtensionCapability {
  const sourceKind = mapSkillSourceKind(capability.sourceKind)
  const status = mapSkillStatus(capability)
  const pluginId = getPluginId(capability)
  return {
    schemaVersion: 1,
    id: `skill:${sourceKind}:${capability.name}:${capability.loadedFrom}:${capability.installedRef ?? ''}`,
    name: capability.name,
    displayName: capability.displayName,
    description: capability.description,
    kind: 'skill',
    source: {
      kind: sourceKind,
      label: capability.sourceLabel,
      ref: capability.loadedFrom,
      ...(pluginId ? { pluginId } : {}),
    },
    state: {
      installed: capability.installedRef !== null,
      enabled: capability.enabled,
      available: capability.runtimeVisible,
      runtimeVisible: capability.runtimeVisible,
      status,
    },
    invocation: {
      modelInvocable: capability.modelInvocable,
      userInvocable: capability.userInvocable,
      toolInvocable: false,
    },
    relations: {
      ...(pluginId ? { parentPluginId: pluginId } : {}),
      ...(capability.installedRef ? { installedRef: capability.installedRef } : {}),
      runtimeRef: `skill:${capability.name}`,
    },
    diagnostics: capability.diagnostics.map(toDiagnostic),
    metadata: {
      hiddenReason: capability.hiddenReason,
      sourceKind: capability.sourceKind,
    },
  }
}

function mapSkillSourceKind(
  sourceKind: SkillRuntimeCapability['sourceKind'],
): ExtensionCapabilitySourceKind {
  switch (sourceKind) {
    case 'managed-installed':
      return 'managed-skill'
    case 'plugin':
    case 'builtin-plugin':
      return 'plugin'
    case 'bundled':
      return 'bundled'
    case 'dynamic':
      return 'dynamic'
    case 'mcp':
      return 'mcp'
    case 'project':
      return 'project-skill'
    case 'user':
      return 'user-skill'
    case 'policy':
      return 'builtin'
    case 'legacy-command':
      return 'legacy'
    case 'unknown':
      return 'unknown'
  }
}

function mapSkillStatus(
  capability: SkillRuntimeCapability,
): ExtensionCapabilityStatus {
  if (capability.runtimeVisible) {
    return capability.enabled ? 'enabled' : 'disabled'
  }
  if (capability.hiddenReason === 'disabled') return 'disabled'
  if (capability.hiddenReason === 'duplicate-name') return 'hidden-by-conflict'
  if (capability.hiddenReason?.includes('missing')) return 'missing'
  if (capability.hiddenReason?.includes('drifted')) return 'drifted'
  if (capability.hiddenReason?.includes('invalid')) return 'invalid'
  return capability.enabled ? 'unavailable' : 'disabled'
}

function toDiagnostic(message: string): ExtensionCapabilityDiagnostic {
  return {
    kind: message.includes('hidden') ? 'conflict' : 'runtime',
    severity: message.includes('missing') || message.includes('drift')
      ? 'error'
      : 'warning',
    message,
  }
}

function getPluginId(capability: SkillRuntimeCapability): string | undefined {
  if (
    capability.sourceKind !== 'plugin' &&
    capability.sourceKind !== 'builtin-plugin'
  ) {
    return undefined
  }
  const parts = capability.sourceLabel.split('/')
  return parts[0] && parts[0] !== 'plugin' ? parts[0] : undefined
}
