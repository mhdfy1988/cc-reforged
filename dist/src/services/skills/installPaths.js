import { join } from 'path';
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js';
import { sanitizeImportedSkillDirName } from './importPaths.js';
export const CCR_SKILL_PACKAGE_OWNER_MARKER_FILE = '.ccr-skill-package.json';
export function getCcrSkillInstallPaths(configHomeDir = getClaudeConfigHomeDir()) {
    const skillsRootDir = join(configHomeDir, 'skills');
    return {
        skillsRootDir,
        importedRootDir: join(skillsRootDir, 'imported'),
        packagesRootDir: join(skillsRootDir, 'packages'),
        manifestsDir: join(skillsRootDir, 'manifests'),
        cacheDir: join(skillsRootDir, 'cache'),
        installedIndexPath: join(skillsRootDir, 'installed.json'),
        lockFilePath: join(skillsRootDir, 'lock.json'),
    };
}
export function getCcrSkillPackageDir(skillName, configHomeDir) {
    return join(getCcrSkillInstallPaths(configHomeDir).packagesRootDir, sanitizeInstalledSkillDirName(skillName));
}
export function getCcrSkillPackageOwnerMarkerPath(skillName, configHomeDir) {
    return join(getCcrSkillPackageDir(skillName, configHomeDir), CCR_SKILL_PACKAGE_OWNER_MARKER_FILE);
}
export function sanitizeInstalledSkillDirName(skillName) {
    return sanitizeImportedSkillDirName(skillName);
}
//# sourceMappingURL=installPaths.js.map