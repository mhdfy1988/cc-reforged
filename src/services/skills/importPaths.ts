import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

export const CCR_SKILL_IMPORT_MARKER_FILE = '.ccr-skill-import.json'

export type CcrSkillImportPaths = {
  skillsRootDir: string
  importedRootDir: string
  manifestsDir: string
  cacheDir: string
}

export function getCcrSkillImportPaths(
  configHomeDir = getClaudeConfigHomeDir(),
): CcrSkillImportPaths {
  const skillsRootDir = join(configHomeDir, 'skills')
  return {
    skillsRootDir,
    importedRootDir: join(skillsRootDir, 'imported'),
    manifestsDir: join(skillsRootDir, 'manifests'),
    cacheDir: join(skillsRootDir, 'cache'),
  }
}

export function getCcrImportedSkillDir(
  skillName: string,
  configHomeDir?: string,
): string {
  return join(
    getCcrSkillImportPaths(configHomeDir).importedRootDir,
    sanitizeImportedSkillDirName(skillName),
  )
}

export function getCcrSkillImportMarkerPath(
  skillName: string,
  configHomeDir?: string,
): string {
  return join(getCcrImportedSkillDir(skillName, configHomeDir), CCR_SKILL_IMPORT_MARKER_FILE)
}

export function sanitizeImportedSkillDirName(skillName: string): string {
  const sanitized = skillName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\.+$/g, '')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'skill'
}
