import type {
  CcrSkillInterface,
  CcrSkillOrigin,
} from './model.js'
import type {
  CcrSkillOriginVendor,
  CcrSkillSource,
} from './sourceTypes.js'

export type CcrSkillCompatibilityHints = {
  vendor?: CcrSkillOriginVendor
  importedFrom?: string
  legacyCommand?: boolean
}

export function detectSkillVendor(input: {
  source: CcrSkillSource
  rawFrontmatter: Record<string, unknown>
  openaiYaml?: unknown
  compatibilityHints?: CcrSkillCompatibilityHints
}): CcrSkillOriginVendor {
  if (input.compatibilityHints?.vendor) {
    return input.compatibilityHints.vendor
  }
  if (input.compatibilityHints?.legacyCommand) {
    return 'claude'
  }
  if (input.openaiYaml != null) {
    return 'codex'
  }
  if (hasOpenClawMetadata(input.rawFrontmatter)) {
    return 'openclaw'
  }
  if (input.source === 'bundled' || input.source === 'mcp') {
    return 'ccr'
  }
  if (input.source === 'plugin') {
    return 'claude'
  }
  return 'agent-skills'
}

export function createSkillOrigin(input: {
  source: CcrSkillSource
  sourcePath: string | null
  rawFrontmatter: Record<string, unknown>
  openaiYaml?: unknown
  compatibilityHints?: CcrSkillCompatibilityHints
}): CcrSkillOrigin {
  return {
    vendor: detectSkillVendor(input),
    sourcePath: input.sourcePath,
    ...(input.compatibilityHints?.importedFrom
      ? { importedFrom: input.compatibilityHints.importedFrom }
      : {}),
  }
}

export function normalizeOpenAiSkillInterface(
  openaiYaml: unknown,
): CcrSkillInterface | undefined {
  const root = asRecord(openaiYaml)
  const iface = asRecord(root?.interface)
  if (!iface) {
    return undefined
  }
  const result: CcrSkillInterface = {}
  assignString(result, 'shortDescription', iface.short_description)
  assignString(result, 'iconSmall', iface.icon_small)
  assignString(result, 'iconLarge', iface.icon_large)
  assignString(result, 'brandColor', iface.brand_color)
  assignString(result, 'defaultPrompt', iface.default_prompt)
  return Object.keys(result).length > 0 ? result : undefined
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function hasOpenClawMetadata(frontmatter: Record<string, unknown>): boolean {
  const metadata = asRecord(frontmatter.metadata)
  return asRecord(metadata?.openclaw) != null
}

function assignString<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  value: unknown,
): void {
  if (typeof value === 'string' && value.trim()) {
    target[key] = value.trim() as T[keyof T]
  }
}
