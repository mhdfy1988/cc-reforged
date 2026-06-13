import { getSkillRuntimeCatalogForCwd } from '../../commands.js'
import type { Command } from '../../types/command.js'
import {
  createSkillRuntimeCapabilityCatalog,
  type SkillRuntimeCapability,
} from '../../skills/skillRuntimeCatalog.js'
import { listInstalledSkillPackageInspections } from '../skills/installedPackageInspection.js'
import { scanSkillPackage } from '../skills/securityScanner.js'
import { summarizeSkillSecurityReport } from '../skills/securityReporter.js'
import type {
  ExtensionCapability,
  ExtensionCapabilityDiagnostic,
  ExtensionCapabilitySourceKind,
  ExtensionCapabilityStatus,
} from './capabilityTypes.js'
import { createSkillCapabilityId } from './capabilityIdentity.js'
import type { CapabilityRuntimeEnvironment } from './capabilityRuntimeEnvironment.js'
import type {
  ExtensionCapabilityProvider,
  ExtensionCapabilityProviderContext,
} from './capabilityCatalog.js'

export type SkillCapabilityProviderContext = ExtensionCapabilityProviderContext & {
  capabilityEnvironment?: CapabilityRuntimeEnvironment
  cwd?: string
  configHomeDir?: string
  mcp?: {
    commands?: readonly Command[]
  }
  mcpCommands?: readonly Command[]
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
  const request = context.capabilityEnvironment?.request
  const cwd =
    request?.cwd ?? (typeof context.cwd === 'string' ? context.cwd : undefined)
  if (!cwd) {
    throw new Error('Skill capability provider requires request-scoped cwd.')
  }
  const configHomeDir =
    request?.configHomeDir ??
    (typeof context.configHomeDir === 'string'
      ? context.configHomeDir
      : undefined)
  const [runtime, installedInspections] = await Promise.all([
    getSkillRuntimeCatalogForCwd(cwd, { configHomeDir }),
    listInstalledSkillPackageInspections({
      configHomeDir,
    }),
  ])

  const catalog = createSkillRuntimeCapabilityCatalog({
    commands: [...runtime.sourceCommands, ...getMcpSkillCommands(context)],
    installed: installedInspections.installed,
  })

  return Promise.all(catalog.capabilities.map(toExtensionCapability))
}

async function toExtensionCapability(
  capability: SkillRuntimeCapability,
): Promise<ExtensionCapability> {
  const sourceKind = mapSkillSourceKind(capability.sourceKind)
  const status = mapSkillStatus(capability)
  const pluginId = getPluginId(capability)
  const runtimeSkillSecurityDigest = capability.skillPackage
    ? summarizeSkillSecurityReport(
        await scanSkillPackage(capability.skillPackage, {
          source: 'installed',
          packageId: capability.skillPackage.id,
        }),
      )
    : null
  return {
    schemaVersion: 1,
    id: createSkillCapabilityId({
      sourceKind,
      name: capability.name,
      loadedFrom: capability.loadedFrom,
      pluginId,
      mcpServerName: capability.parentMcpServerName,
      installedRef: capability.installedRef,
    }),
    name: capability.name,
    displayName: capability.displayName,
    description: capability.description,
    kind: 'skill',
    source: {
      kind: sourceKind,
      label: capability.sourceLabel,
      ref: capability.loadedFrom,
      ...(pluginId ? { pluginId } : {}),
      ...(capability.parentMcpServerName
        ? { mcpServerName: capability.parentMcpServerName }
        : {}),
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
      ...(capability.parentMcpServerName
        ? { parentMcpServerName: capability.parentMcpServerName }
        : {}),
      ...(capability.installedRef ? { installedRef: capability.installedRef } : {}),
      runtimeRef: `skill:${capability.name}`,
    },
    diagnostics: capability.diagnostics.map(toDiagnostic),
    metadata: {
      hiddenReason: capability.hiddenReason,
      sourceKind: capability.sourceKind,
      parentPluginId: capability.parentPluginId,
      parentMcpServerName: capability.parentMcpServerName,
      ...(capability.skillPackage
        ? {
            skillPackage: capability.skillPackage,
            packageDir: capability.skillPackage.baseDir,
            skillFilePath: capability.skillPackage.bodyPath,
            skillSecurityDigest: runtimeSkillSecurityDigest,
          }
        : {}),
    },
  }
}

function getMcpSkillCommands(
  context: SkillCapabilityProviderContext,
): readonly Command[] {
  return (
    context.capabilityEnvironment?.mcpRuntime.commands ??
    context.mcpCommands ??
    context.mcp?.commands ??
    []
  ).filter(
    command => command.type === 'prompt' && command.loadedFrom === 'mcp',
  )
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
  return capability.parentPluginId ?? undefined
}
