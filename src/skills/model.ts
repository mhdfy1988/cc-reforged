import type { CcrSkillOriginVendor, CcrSkillSource } from './sourceTypes.js'

export type CcrSkillOrigin = {
  vendor: CcrSkillOriginVendor
  sourcePath: string | null
  importedFrom?: string
}

export type CcrSkillResources = {
  scripts: string[]
  references: string[]
  assets: string[]
}

export type CcrSkillInterface = {
  shortDescription?: string
  iconSmall?: string
  iconLarge?: string
  brandColor?: string
  defaultPrompt?: string
}

export type CcrSkillInvocation = {
  modelInvocable: boolean
  userInvocable: boolean
  context: 'inline' | 'fork'
  allowedTools: string[]
  argumentHint?: string
  argumentNames: string[]
  model?: string
  effort?: string | number
  agent?: string
  whenToUse?: string
}

export type CcrSkillCompatibility = {
  rawFrontmatter: Record<string, unknown>
  openaiYaml?: Record<string, unknown>
  warnings: string[]
}

export type CcrSkillPackage = {
  schemaVersion: 1
  id: string
  name: string
  displayName?: string
  description: string
  bodyPath: string | null
  body: string
  baseDir: string | null
  source: CcrSkillSource
  origin: CcrSkillOrigin
  resources: CcrSkillResources
  interface?: CcrSkillInterface
  invocation: CcrSkillInvocation
  compatibility: CcrSkillCompatibility
}

