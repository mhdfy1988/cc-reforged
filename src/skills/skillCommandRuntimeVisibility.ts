import type { ExtensionCapability } from '../services/capabilities/capabilityTypes.js'
import { resolveCapabilityRuntimeVisibility } from '../services/capabilities/capabilityRuntimeVisibility.js'
import type { Command } from '../types/command.js'
import { resolveCommandPluginId } from '../services/capabilities/pluginIdentityResolver.js'
import { createSkillCapabilityId } from '../services/capabilities/capabilityIdentity.js'

export type PromptSkillCommand = Extract<Command, { type: 'prompt' }>
export type SkillCommandAdapterKind =
  | 'skill'
  | 'legacy-command'
  | 'plugin-skill'
  | 'mcp-skill'

export type SkillCommandRuntimeEligibility =
  | {
      eligible: true
      command: PromptSkillCommand
      capability: ExtensionCapability
    }
  | {
      eligible: false
      reason:
        | 'unsupported-command-type'
        | 'model-invocation-disabled'
        | 'command-disabled'
    }

export type SkillCommandInvocationBlocker = {
  errorCode: number
  message: string
}

export function getSkillCommandCapabilityId(
  command: PromptSkillCommand,
): string {
  const loadedFrom = command.loadedFrom ?? 'unknown'
  const pluginId = resolveCommandPluginId(command) ?? ''
  const mcpServerName = command.mcpServerName ?? ''
  return createSkillCapabilityId({
    sourceKind: getSkillCommandExtensionSourceKind(command),
    name: command.name,
    loadedFrom,
    pluginId,
    mcpServerName,
    installedRef:
      command.loadedFrom === 'managed' &&
      typeof command.installedSkillRef === 'string'
        ? command.installedSkillRef
        : null,
  })
}

export function resolveSkillCommandRuntimeVisibility(
  command: PromptSkillCommand,
): ExtensionCapability {
  const enabled = isCommandEnabled(command)
  const pluginId = resolveCommandPluginId(command)
  const mcpServerName = command.mcpServerName
  return resolveCapabilityRuntimeVisibility({
    schemaVersion: 1,
    id: getSkillCommandCapabilityId(command),
    name: command.name,
    displayName: command.userFacingName?.() ?? command.name,
    description: command.description,
    kind: 'skill',
    source: {
      kind: getSkillCommandExtensionSourceKind(command),
      label: command.loadedFrom ?? String(command.source),
      ...(pluginId ? { pluginId } : {}),
      ...(mcpServerName ? { mcpServerName } : {}),
    },
    state: {
      installed: false,
      enabled,
      available: enabled,
      runtimeVisible: enabled,
      status: enabled ? 'enabled' : 'disabled',
    },
    invocation: {
      modelInvocable: !command.disableModelInvocation,
      userInvocable: command.userInvocable !== false,
      toolInvocable: false,
    },
    relations: {
      ...(pluginId ? { parentPluginId: pluginId } : {}),
      ...(mcpServerName ? { parentMcpServerName: mcpServerName } : {}),
      runtimeRef: `skill:${command.name}`,
    },
    diagnostics: [],
    metadata: {
      loadedFrom: command.loadedFrom,
      source: command.source,
    },
  })
}

function getSkillCommandExtensionSourceKind(
  command: PromptSkillCommand,
): ExtensionCapability['source']['kind'] {
  if (command.loadedFrom === 'managed') return 'managed-skill'
  if (command.loadedFrom === 'dynamic') return 'dynamic'
  if (command.loadedFrom === 'bundled') return 'bundled'
  if (command.loadedFrom === 'mcp' || command.source === 'mcp') return 'mcp'
  if (command.loadedFrom === 'commands_DEPRECATED') return 'legacy'
  if (command.loadedFrom === 'plugin' || command.source === 'plugin') {
    return 'plugin'
  }
  if (command.source === 'policySettings') return 'builtin'
  if (command.source === 'userSettings') return 'user-skill'
  if (
    command.source === 'projectSettings' ||
    command.source === 'localSettings' ||
    command.source === 'flagSettings'
  ) {
    return 'project-skill'
  }
  return 'unknown'
}

export function resolveSkillCommandRuntimeEligibility(
  command: Command,
): SkillCommandRuntimeEligibility {
  if (command.type !== 'prompt') {
    return { eligible: false, reason: 'unsupported-command-type' }
  }
  const capability = resolveSkillCommandRuntimeVisibility(command)
  if (!capability.invocation.modelInvocable) {
    return { eligible: false, reason: 'model-invocation-disabled' }
  }
  if (!capability.state.enabled || !capability.state.runtimeVisible) {
    return { eligible: false, reason: 'command-disabled' }
  }
  return { eligible: true, command, capability }
}

export function getSkillCommandAdapterKind(
  command: Command,
): SkillCommandAdapterKind | null {
  if (command.type !== 'prompt') return null
  if (command.loadedFrom === 'mcp') return 'mcp-skill'
  if (command.isMcp === true) return null
  if (command.loadedFrom === 'commands_DEPRECATED') return 'legacy-command'
  if (command.loadedFrom === 'plugin' || command.source === 'plugin') {
    return 'plugin-skill'
  }
  return 'skill'
}

export function isSkillToolCommandCandidate(
  command: Command,
): command is PromptSkillCommand {
  const runtime = resolveSkillCommandRuntimeEligibility(command)
  if (runtime.eligible === false) return false
  const skill = runtime.command
  return (
    getSkillCommandAdapterKind(skill) !== null &&
    skill.source !== 'builtin' &&
    (skill.loadedFrom === 'bundled' ||
      skill.loadedFrom === 'managed' ||
      skill.loadedFrom === 'dynamic' ||
      skill.loadedFrom === 'skills' ||
      skill.loadedFrom === 'commands_DEPRECATED' ||
      Boolean(skill.hasUserSpecifiedDescription) ||
      Boolean(skill.whenToUse))
  )
}

export function isUserInvocableSkillCommandCandidate(
  command: Command,
): command is PromptSkillCommand {
  if (command.type !== 'prompt') return false
  if (getSkillCommandAdapterKind(command) === null) return false
  if (command.source === 'builtin') return false

  const capability = resolveSkillCommandRuntimeVisibility(command)
  return (
    capability.state.enabled &&
    capability.state.runtimeVisible &&
    capability.invocation.userInvocable
  )
}

export function getSkillCommandModelInvocationBlocker(
  command: PromptSkillCommand,
  toolName: string,
): SkillCommandInvocationBlocker | null {
  const capability = resolveSkillCommandRuntimeVisibility(command)
  if (!capability.state.enabled) {
    return {
      errorCode: 3,
      message: `Skill ${command.name} is disabled.`,
    }
  }
  if (!capability.invocation.modelInvocable) {
    return {
      errorCode: 4,
      message: `Skill ${command.name} cannot be used with ${toolName} tool due to disable-model-invocation`,
    }
  }
  if (!capability.state.runtimeVisible) {
    return {
      errorCode: 6,
      message: `Skill ${command.name} is not runtime-visible: ${(capability.state.hiddenReasons ?? []).join(', ')}`,
    }
  }
  return null
}

function isCommandEnabled(command: PromptSkillCommand): boolean {
  if (!command.isEnabled) return true
  try {
    return command.isEnabled()
  } catch {
    return false
  }
}
