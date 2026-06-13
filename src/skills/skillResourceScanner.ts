import type { CcrSkillResources } from './model.js'
import { join } from 'path'

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

export type SkillResourceDirent = {
  name: string
  isDirectory(): boolean
  isFile(): boolean
}

export type SkillResourceCollectionWarning = {
  key: keyof CcrSkillResources
  dir: string
  error: unknown
}

export async function collectSkillResourceDirsFromFs(
  skillDir: string,
  readdir: (dir: string) => Promise<SkillResourceDirent[]>,
  onWarning?: (warning: SkillResourceCollectionWarning) => void,
): Promise<CcrSkillResourceInput> {
  const result: Required<CcrSkillResourceInput> = {
    scripts: [],
    references: [],
    assets: [],
  }

  await Promise.all(
    (['scripts', 'references', 'assets'] as const).map(async key => {
      const dir = join(skillDir, key)
      try {
        result[key] = (await collectRelativeFiles(readdir, dir, key)).sort()
      } catch (error) {
        if (getErrorCode(error) !== 'ENOENT') {
          onWarning?.({ key, dir, error })
        }
      }
    }),
  )

  return result
}

async function collectRelativeFiles(
  readdir: (dir: string) => Promise<SkillResourceDirent[]>,
  absoluteDir: string,
  relativeDir: string,
): Promise<string[]> {
  const entries = await readdir(absoluteDir)
  const files = await Promise.all(
    entries.map(async entry => {
      const absolutePath = join(absoluteDir, entry.name)
      const relativePath = join(relativeDir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        return collectRelativeFiles(readdir, absolutePath, relativePath)
      }
      if (entry.isFile()) {
        return [relativePath]
      }
      return []
    }),
  )
  return files.flat()
}

function getErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error != null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined
}
