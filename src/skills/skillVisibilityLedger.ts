import type { ToolUseContext } from '../Tool.js'
import type { Command } from '../types/command.js'
import {
  resolveSkillCommandRuntimeEligibility,
  type PromptSkillCommand,
} from './skillCommandRuntimeVisibility.js'

export type SkillVisibilityState = {
  visibleSkillNames?: Set<string> | ReadonlySet<string>
  visibleSkillCapabilityIds?: Set<string> | ReadonlySet<string>
  loadedSkillNames?: Set<string> | ReadonlySet<string>
  loadedSkillCapabilityIds?: Set<string> | ReadonlySet<string>
  discoveredSkillNames?: Set<string> | ReadonlySet<string>
  discoveredSkillCapabilityIds?: Set<string> | ReadonlySet<string>
}

export type SkillVisibilityEntry = {
  name: string
  capabilityId?: string
}

type MutableSkillVisibilitySetKey =
  | 'visibleSkillNames'
  | 'visibleSkillCapabilityIds'
  | 'loadedSkillNames'
  | 'loadedSkillCapabilityIds'
  | 'discoveredSkillNames'
  | 'discoveredSkillCapabilityIds'

export function toSkillVisibilityEntry(
  command: Command,
): SkillVisibilityEntry | null {
  const runtime = resolveSkillCommandRuntimeEligibility(command)
  if (runtime.eligible === false) {
    return command.type === 'prompt' ? { name: command.name } : null
  }
  return {
    name: runtime.command.name,
    capabilityId: runtime.capability.id,
  }
}

export function recordVisibleSkill(
  state: ToolUseContext,
  entry: SkillVisibilityEntry,
): void {
  recordSkillVisibilityEntry(state, entry, {
    nameKey: 'visibleSkillNames',
    capabilityIdKey: 'visibleSkillCapabilityIds',
  })
}

export function recordVisibleSkillCommand(
  state: ToolUseContext,
  command: Command,
): void {
  const entry = toSkillVisibilityEntry(command)
  if (entry) recordVisibleSkill(state, entry)
}

export function recordDiscoveredSkill(
  state: ToolUseContext,
  entry: SkillVisibilityEntry,
): void {
  recordSkillVisibilityEntry(state, entry, {
    nameKey: 'discoveredSkillNames',
    capabilityIdKey: 'discoveredSkillCapabilityIds',
  })
}

export function recordLoadedSkill(
  state: ToolUseContext,
  entry: SkillVisibilityEntry,
): void {
  recordSkillVisibilityEntry(state, entry, {
    nameKey: 'loadedSkillNames',
    capabilityIdKey: 'loadedSkillCapabilityIds',
  })
}

export function recordLoadedSkillCommand(
  state: ToolUseContext,
  command: PromptSkillCommand,
): void {
  const entry = toSkillVisibilityEntry(command)
  if (entry) recordLoadedSkill(state, entry)
}

export function isSkillAlreadySurfaced(
  entry: SkillVisibilityEntry,
  visibility: SkillVisibilityState,
): boolean {
  if (entry.capabilityId) {
    return (
      visibility.visibleSkillCapabilityIds?.has(entry.capabilityId) === true ||
      visibility.loadedSkillCapabilityIds?.has(entry.capabilityId) === true ||
      visibility.discoveredSkillCapabilityIds?.has(entry.capabilityId) === true
    )
  }

  return (
    visibility.visibleSkillNames?.has(entry.name) === true ||
    visibility.loadedSkillNames?.has(entry.name) === true ||
    visibility.discoveredSkillNames?.has(entry.name) === true
  )
}

function recordSkillVisibilityEntry(
  state: ToolUseContext,
  entry: SkillVisibilityEntry,
  keys: {
    nameKey: MutableSkillVisibilitySetKey
    capabilityIdKey: MutableSkillVisibilitySetKey
  },
): void {
  ensureMutableSet(state, keys.nameKey).add(entry.name)
  if (entry.capabilityId) {
    ensureMutableSet(state, keys.capabilityIdKey).add(entry.capabilityId)
  }
}

function ensureMutableSet(
  state: ToolUseContext,
  key: MutableSkillVisibilitySetKey,
): Set<string> {
  const existing = state[key]
  if (existing instanceof Set) return existing
  const next = new Set(existing ? [...existing] : [])
  state[key] = next
  return next
}
