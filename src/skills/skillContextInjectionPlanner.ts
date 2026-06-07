import type { Command } from '../types/command.js'
import {
  resolveSkillCommandRuntimeEligibility,
  type PromptSkillCommand,
} from './skillCommandRuntimeVisibility.js'
import {
  applyStaticSkillListingPolicy,
  type SkillContextInjectionDecision,
  type SkillContextInjectionDiagnostic,
} from './skillContextInjectionPolicy.js'

export type SkillContextInjectionPlanOptions = {
  skillSearchEnabled: boolean
  filteredListingMax?: number
  sentSkillNames?: ReadonlySet<string>
  sentSkillCapabilityIds?: ReadonlySet<string>
}

export type SkillContextInjectionBudgetUsage = {
  staticSkillListingCount: number
  newStaticSkillListingCount: number
  discoveryCandidateCount: number
  hiddenCount: number
  filteredListingMax: number | null
}

export type SkillContextDiscoveryCandidate = {
  capabilityId: string
  name: string
  displayName: string
  description: string
  whenToUse: string
  sourceKind: NonNullable<Command['loadedFrom']> | 'unknown'
  parentPluginId?: string
  parentMcpServerName?: string
  modelInvocable: true
  userInvocable: boolean
  runtimeVisible: true
  command: PromptSkillCommand
}

export type SkillContextInjectionPlan = {
  staticSkillListing: Command[]
  newStaticSkillListing: Command[]
  discoveryCandidates: SkillContextDiscoveryCandidate[]
  hidden: SkillContextInjectionDecision[]
  diagnostics: SkillContextInjectionDiagnostic[]
  budgetUsage: SkillContextInjectionBudgetUsage
}

export const DEFAULT_SKILL_CONTEXT_LISTING_MAX = 30

export function planSkillContextInjection(
  commands: readonly Command[],
  options: SkillContextInjectionPlanOptions,
): SkillContextInjectionPlan {
  const policy = options.skillSearchEnabled
    ? applyStaticSkillListingPolicy([...commands], {
        filteredListingMax:
          options.filteredListingMax ?? DEFAULT_SKILL_CONTEXT_LISTING_MAX,
      })
    : applyLegacyFullStaticListingPolicy(commands)

  const staticSkillListing = policy.included.map(decision => decision.command)
  const sentSkillNames = options.sentSkillNames ?? new Set<string>()
  const sentSkillCapabilityIds =
    options.sentSkillCapabilityIds ?? new Set<string>()
  const newStaticSkillListing = staticSkillListing.filter(
    command => !hasSentSkillListing(command, sentSkillNames, sentSkillCapabilityIds),
  )
  const discoveryCandidates = commands.flatMap(toDiscoveryCandidate)

  return {
    staticSkillListing,
    newStaticSkillListing,
    discoveryCandidates,
    hidden: policy.hidden,
    diagnostics: policy.diagnostics,
    budgetUsage: {
      staticSkillListingCount: staticSkillListing.length,
      newStaticSkillListingCount: newStaticSkillListing.length,
      discoveryCandidateCount: discoveryCandidates.length,
      hiddenCount: policy.hidden.length,
      filteredListingMax: options.skillSearchEnabled
        ? (options.filteredListingMax ?? DEFAULT_SKILL_CONTEXT_LISTING_MAX)
        : null,
    },
  }
}

function hasSentSkillListing(
  command: Command,
  sentSkillNames: ReadonlySet<string>,
  sentSkillCapabilityIds: ReadonlySet<string>,
): boolean {
  const runtime = resolveSkillCommandRuntimeEligibility(command)
  if (runtime.eligible === true) {
    return (
      sentSkillCapabilityIds.has(runtime.capability.id) ||
      sentSkillNames.has(command.name)
    )
  }
  return sentSkillNames.has(command.name)
}

function applyLegacyFullStaticListingPolicy(
  commands: readonly Command[],
): {
  included: SkillContextInjectionDecision[]
  hidden: SkillContextInjectionDecision[]
  diagnostics: SkillContextInjectionDiagnostic[]
} {
  const included: SkillContextInjectionDecision[] = []
  const hidden: SkillContextInjectionDecision[] = []

  for (const command of commands) {
    const sourceKind = (command.loadedFrom ??
      'unknown') as SkillContextInjectionDecision['sourceKind']
    const base = { command, sourceKind }

    const runtime = resolveSkillCommandRuntimeEligibility(command)
    if (runtime.eligible === false) {
      hidden.push({ ...base, reason: runtime.reason })
      continue
    }

    included.push({ ...base, reason: 'static-managed' })
  }

  return {
    included,
    hidden,
    diagnostics: [],
  }
}

function toDiscoveryCandidate(
  command: Command,
): SkillContextDiscoveryCandidate[] {
  const runtime = resolveSkillCommandRuntimeEligibility(command)
  if (runtime.eligible === false) return []
  const capability = runtime.capability
  return [
    {
      capabilityId: capability.id,
      name: command.name,
      displayName: command.userFacingName?.() ?? command.name,
      description: command.description,
      whenToUse: command.whenToUse ?? '',
      sourceKind: command.loadedFrom ?? 'unknown',
      ...(capability.relations.parentPluginId
        ? { parentPluginId: capability.relations.parentPluginId }
        : {}),
      ...(capability.relations.parentMcpServerName
        ? { parentMcpServerName: capability.relations.parentMcpServerName }
        : {}),
      modelInvocable: true,
      userInvocable: capability.invocation.userInvocable,
      runtimeVisible: true,
      command: runtime.command,
    },
  ]
}
