import type { CcrSkillResources } from './model.js'

export type CcrSkillResourceInput = Partial<
  Record<keyof CcrSkillResources, readonly string[] | undefined>
>

export function createEmptySkillResources(): CcrSkillResources {
  return {
    scripts: [],
    references: [],
    assets: [],
  }
}

export function normalizeSkillResources(
  input: CcrSkillResourceInput | undefined,
): CcrSkillResources {
  if (!input) {
    return createEmptySkillResources()
  }
  return {
    scripts: normalizeResourceList(input.scripts),
    references: normalizeResourceList(input.references),
    assets: normalizeResourceList(input.assets),
  }
}

function normalizeResourceList(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))]
}

