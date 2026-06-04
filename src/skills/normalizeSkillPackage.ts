import type { FrontmatterData } from '../utils/frontmatterParser.js'
import type { CcrSkillInterface, CcrSkillPackage } from './model.js'
import {
  parseCcrSkillPackage,
  type CcrSkillPackageInput,
} from './packageSchema.js'
import {
  createSkillOrigin,
  normalizeOpenAiSkillInterface,
  type CcrSkillCompatibilityHints,
} from './skillCompatibility.js'
import {
  normalizeSkillResources,
  type CcrSkillResourceInput,
} from './skillResourceScanner.js'
import type { CcrSkillSource } from './sourceTypes.js'

export type NormalizedSkillFrontmatterFields = {
  displayName?: string
  description: string
  hasUserSpecifiedDescription: boolean
  allowedTools: string[]
  argumentHint?: string
  argumentNames: string[]
  whenToUse?: string
  version?: string
  model?: string
  disableModelInvocation: boolean
  userInvocable: boolean
  executionContext?: 'inline' | 'fork'
  agent?: string
  effort?: string | number
}

export type NormalizeSkillPackageInput = {
  id?: string
  skillName: string
  markdownContent: string
  frontmatter: FrontmatterData | Record<string, unknown>
  parsed: NormalizedSkillFrontmatterFields
  source: CcrSkillSource
  filePath: string | null
  baseDir: string | null
  resources?: CcrSkillResourceInput
  openaiYaml?: unknown
  compatibilityHints?: CcrSkillCompatibilityHints
}

export function normalizeSkillPackage(
  input: NormalizeSkillPackageInput,
): CcrSkillPackage {
  const rawFrontmatter = normalizeRawFrontmatter(input.frontmatter)
  const openaiInterface = normalizeOpenAiSkillInterface(input.openaiYaml)
  const skillInterface = mergeSkillInterface(
    openaiInterface,
    normalizeParsedInterface(input.parsed),
  )

  const candidate: CcrSkillPackageInput = {
    schemaVersion: 1,
    id: input.id ?? createSkillPackageId(input),
    name: input.skillName,
    ...(input.parsed.displayName
      ? { displayName: input.parsed.displayName }
      : {}),
    description: input.parsed.description,
    bodyPath: input.filePath,
    body: input.markdownContent,
    baseDir: input.baseDir,
    source: input.source,
    origin: createSkillOrigin({
      source: input.source,
      sourcePath: input.filePath ?? input.baseDir,
      rawFrontmatter,
      openaiYaml: input.openaiYaml,
      compatibilityHints: input.compatibilityHints,
    }),
    resources: normalizeSkillResources(input.resources),
    ...(skillInterface ? { interface: skillInterface } : {}),
    invocation: {
      modelInvocable: !input.parsed.disableModelInvocation,
      userInvocable: input.parsed.userInvocable,
      context: input.parsed.executionContext ?? 'inline',
      allowedTools: input.parsed.allowedTools,
      ...(input.parsed.argumentHint
        ? { argumentHint: input.parsed.argumentHint }
        : {}),
      argumentNames: input.parsed.argumentNames,
      ...(input.parsed.model ? { model: input.parsed.model } : {}),
      ...(input.parsed.effort !== undefined
        ? { effort: input.parsed.effort }
        : {}),
      ...(input.parsed.agent ? { agent: input.parsed.agent } : {}),
      ...(input.parsed.whenToUse ? { whenToUse: input.parsed.whenToUse } : {}),
    },
    compatibility: {
      rawFrontmatter,
      ...(input.openaiYaml != null
        ? { openaiYaml: normalizeUnknownRecord(input.openaiYaml) }
        : {}),
      warnings: [],
    },
  }

  return parseCcrSkillPackage(candidate)
}

function createSkillPackageId(input: NormalizeSkillPackageInput): string {
  return [input.source, input.skillName, input.filePath ?? input.baseDir ?? '']
    .filter(Boolean)
    .join(':')
}

function normalizeRawFrontmatter(
  frontmatter: FrontmatterData | Record<string, unknown>,
): Record<string, unknown> {
  return normalizeUnknownRecord(frontmatter)
}

function normalizeUnknownRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function normalizeParsedInterface(
  parsed: NormalizedSkillFrontmatterFields,
): CcrSkillInterface | undefined {
  return parsed.displayName
    ? {
        shortDescription: parsed.description,
      }
    : undefined
}

function mergeSkillInterface(
  primary: CcrSkillInterface | undefined,
  fallback: CcrSkillInterface | undefined,
): CcrSkillInterface | undefined {
  if (!primary) {
    return fallback
  }
  if (!fallback) {
    return primary
  }
  return {
    ...fallback,
    ...primary,
  }
}

