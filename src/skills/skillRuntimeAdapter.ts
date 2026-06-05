import type { PromptCommand } from '../types/command.js'
import type { FrontmatterData } from '../utils/frontmatterParser.js'
import type { InstalledSkillRuntimeEntry } from './installedSkillLoader.js'
import type { CreateSkillCommandFn } from './skillCommandAdapter.js'
import { toPromptCommand } from './skillCommandAdapter.js'
import {
  parseSkillFrontmatterFields,
  parseSkillPaths,
} from './skillFrontmatter.js'

export type RuntimeSkillWithPath = {
  skill: ReturnType<CreateSkillCommandFn>
  filePath: string
}

export function createManagedSkillCommandFromInstalledEntry(
  entry: InstalledSkillRuntimeEntry,
  options: {
    createSkillCommand: CreateSkillCommandFn
  },
): RuntimeSkillWithPath {
  const source: PromptCommand['source'] =
    entry.inspection.scope === 'project' ? 'projectSettings' : 'userSettings'
  const rawFrontmatter =
    entry.package.compatibility.rawFrontmatter as FrontmatterData
  const parsed = parseSkillFrontmatterFields(
    rawFrontmatter,
    entry.package.body,
    entry.package.name,
    'Skill',
  )
  return {
    skill: toPromptCommand(entry.package, {
      source,
      loadedFrom: 'managed',
      createSkillCommand: options.createSkillCommand,
      hasUserSpecifiedDescription: parsed.hasUserSpecifiedDescription,
      hooks: parsed.hooks,
      paths: parseSkillPaths(rawFrontmatter),
      shell: parsed.shell,
      version: parsed.version,
    }),
    filePath: entry.inspection.installedRecord.skillFilePath,
  }
}
