import type { Command } from '../types/command.js'
import { resolveSkillCommandRuntimeEligibility } from './skillCommandRuntimeVisibility.js'

type SkillContextInjectionSourceKind =
  | NonNullable<Command['loadedFrom']>
  | 'unknown'

export type SkillContextInjectionHiddenReason =
  | 'source-discovery-only'
  | 'mcp-over-budget'
  | 'model-invocation-disabled'
  | 'command-disabled'
  | 'unsupported-command-type'

export type SkillContextInjectionIncludedReason =
  | 'static-bundled'
  | 'static-managed'
  | 'static-mcp'

export type SkillContextInjectionDecision = {
  command: Command
  sourceKind: SkillContextInjectionSourceKind
  reason: SkillContextInjectionIncludedReason | SkillContextInjectionHiddenReason
}

export type SkillContextInjectionDiagnostic = {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
}

export type StaticSkillListingPolicyOptions = {
  filteredListingMax?: number
}

export type StaticSkillListingPolicyResult = {
  included: SkillContextInjectionDecision[]
  hidden: SkillContextInjectionDecision[]
  diagnostics: SkillContextInjectionDiagnostic[]
}

export const DEFAULT_STATIC_SKILL_LISTING_MAX = 30

export function applyStaticSkillListingPolicy(
  commands: Command[],
  options: StaticSkillListingPolicyOptions = {},
): StaticSkillListingPolicyResult {
  const filteredListingMax =
    options.filteredListingMax ?? DEFAULT_STATIC_SKILL_LISTING_MAX
  const includedCandidates: SkillContextInjectionDecision[] = []
  const hidden: SkillContextInjectionDecision[] = []

  for (const command of commands) {
    const sourceKind: SkillContextInjectionSourceKind =
      command.loadedFrom ?? 'unknown'
    const base = { command, sourceKind }

    const runtime = resolveSkillCommandRuntimeEligibility(command)
    if (runtime.eligible === false) {
      hidden.push({ ...base, reason: runtime.reason })
      continue
    }

    if (command.loadedFrom === 'bundled') {
      includedCandidates.push({ ...base, reason: 'static-bundled' })
    } else if (command.loadedFrom === 'managed') {
      includedCandidates.push({ ...base, reason: 'static-managed' })
    } else if (command.loadedFrom === 'mcp') {
      includedCandidates.push({ ...base, reason: 'static-mcp' })
    } else {
      hidden.push({ ...base, reason: 'source-discovery-only' })
    }
  }

  const diagnostics: SkillContextInjectionDiagnostic[] = []
  if (includedCandidates.length <= filteredListingMax) {
    return {
      included: includedCandidates,
      hidden,
      diagnostics,
    }
  }

  const included = includedCandidates.filter(
    decision =>
      decision.command.loadedFrom === 'bundled' ||
      decision.command.loadedFrom === 'managed',
  )
  const overBudgetHidden = includedCandidates
    .filter(decision => decision.command.loadedFrom === 'mcp')
    .map(decision => ({ ...decision, reason: 'mcp-over-budget' as const }))

  diagnostics.push({
    severity: 'info',
    code: 'static_skill_listing_mcp_over_budget',
    message:
      'MCP skills were omitted from the static skill listing because bundled + managed + MCP exceeded the static listing budget.',
  })

  return {
    included,
    hidden: [...hidden, ...overBudgetHidden],
    diagnostics,
  }
}

export function filterToStaticSkillListing(
  commands: Command[],
  options: StaticSkillListingPolicyOptions = {},
): Command[] {
  return applyStaticSkillListingPolicy(commands, options).included.map(
    decision => decision.command,
  )
}
