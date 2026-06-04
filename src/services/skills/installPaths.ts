import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { sanitizeImportedSkillDirName } from './importPaths.js'

export const CCR_SKILL_PACKAGE_OWNER_MARKER_FILE = '.ccr-skill-package.json'

export type CcrSkillInstallPaths = {
  skillsRootDir: string
  importedRootDir: string
  packagesRootDir: string
  manifestsDir: string
  cacheDir: string
  installedIndexPath: string
  lockFilePath: string
}

export function getCcrSkillInstallPaths(
  configHomeDir = getClaudeConfigHomeDir(),
): CcrSkillInstallPaths {
  const skillsRootDir = join(configHomeDir, 'skills')
  return {
    skillsRootDir,
    importedRootDir: join(skillsRootDir, 'imported'),
    packagesRootDir: join(skillsRootDir, 'packages'),
    manifestsDir: join(skillsRootDir, 'manifests'),
    cacheDir: join(skillsRootDir, 'cache'),
    installedIndexPath: join(skillsRootDir, 'installed.json'),
    lockFilePath: join(skillsRootDir, 'lock.json'),
  }
}

export function getCcrSkillPackageDir(
  skillName: string,
  configHomeDir?: string,
): string {
  return join(
    getCcrSkillInstallPaths(configHomeDir).packagesRootDir,
    sanitizeInstalledSkillDirName(skillName),
  )
}

export function getCcrSkillPackageOwnerMarkerPath(
  skillName: string,
  configHomeDir?: string,
): string {
  return join(
    getCcrSkillPackageDir(skillName, configHomeDir),
    CCR_SKILL_PACKAGE_OWNER_MARKER_FILE,
  )
}

export function sanitizeInstalledSkillDirName(skillName: string): string {
  return sanitizeImportedSkillDirName(skillName)
}
