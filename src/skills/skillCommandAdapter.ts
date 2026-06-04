import type { PromptCommand } from '../types/command.js'
import type { FrontmatterShell } from '../utils/frontmatterParser.js'
import type { EffortValue } from '../utils/effort.js'
import type { HooksSettings } from '../utils/settings/types.js'
import type { Command } from '../types/command.js'
import type { CcrSkillPackage } from './model.js'

export type CcrSkillCommandLoadedFrom =
  | 'commands_DEPRECATED'
  | 'skills'
  | 'plugin'
  | 'managed'
  | 'bundled'
  | 'dynamic'
  | 'mcp'

export type CreateSkillCommandInput = {
  skillName: string
  displayName: string | undefined
  description: string
  hasUserSpecifiedDescription: boolean
  markdownContent: string
  allowedTools: string[]
  argumentHint: string | undefined
  argumentNames: string[]
  whenToUse: string | undefined
  version: string | undefined
  model: string | undefined
  disableModelInvocation: boolean
  userInvocable: boolean
  source: PromptCommand['source']
  baseDir: string | undefined
  loadedFrom: CcrSkillCommandLoadedFrom
  hooks: HooksSettings | undefined
  executionContext: 'inline' | 'fork' | undefined
  agent: string | undefined
  paths: string[] | undefined
  effort: EffortValue | undefined
  shell: FrontmatterShell | undefined
}

export type CreateSkillCommandFn = (input: CreateSkillCommandInput) => Command

export type SkillCommandAdapterOptions = {
  source: PromptCommand['source']
  loadedFrom: CcrSkillCommandLoadedFrom
  createSkillCommand: CreateSkillCommandFn
  hasUserSpecifiedDescription?: boolean
  hooks?: HooksSettings
  paths?: string[]
  shell?: FrontmatterShell
  version?: string
}

export function toPromptCommand(
  skillPackage: CcrSkillPackage,
  options: SkillCommandAdapterOptions,
): Command {
  return options.createSkillCommand({
    skillName: skillPackage.name,
    displayName: skillPackage.displayName,
    description: skillPackage.description,
    hasUserSpecifiedDescription:
      options.hasUserSpecifiedDescription ??
      hasUserSpecifiedDescription(skillPackage),
    markdownContent: skillPackage.body,
    allowedTools: skillPackage.invocation.allowedTools,
    argumentHint: skillPackage.invocation.argumentHint,
    argumentNames: skillPackage.invocation.argumentNames,
    whenToUse: skillPackage.invocation.whenToUse,
    version: options.version ?? getStringFrontmatter(skillPackage, 'version'),
    model: skillPackage.invocation.model,
    disableModelInvocation: !skillPackage.invocation.modelInvocable,
    userInvocable: skillPackage.invocation.userInvocable,
    source: options.source,
    baseDir: skillPackage.baseDir ?? undefined,
    loadedFrom: options.loadedFrom,
    hooks: options.hooks,
    executionContext:
      skillPackage.invocation.context === 'inline'
        ? undefined
        : skillPackage.invocation.context,
    agent: skillPackage.invocation.agent,
    paths: options.paths,
    effort: normalizeEffort(skillPackage.invocation.effort),
    shell: options.shell,
  })
}

function hasUserSpecifiedDescription(skillPackage: CcrSkillPackage): boolean {
  return (
    typeof skillPackage.compatibility.rawFrontmatter.description === 'string' &&
    skillPackage.compatibility.rawFrontmatter.description.trim().length > 0
  )
}

function getStringFrontmatter(
  skillPackage: CcrSkillPackage,
  key: string,
): string | undefined {
  const value = skillPackage.compatibility.rawFrontmatter[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function normalizeEffort(
  effort: CcrSkillPackage['invocation']['effort'],
): EffortValue | undefined {
  if (effort === undefined) {
    return undefined
  }
  return effort as EffortValue
}
