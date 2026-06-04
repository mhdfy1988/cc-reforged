import { join } from 'path';
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js';
export const CCR_SKILL_IMPORT_MARKER_FILE = '.ccr-skill-import.json';
export function getCcrSkillImportPaths(configHomeDir = getClaudeConfigHomeDir()) {
    const skillsRootDir = join(configHomeDir, 'skills');
    return {
        skillsRootDir,
        importedRootDir: join(skillsRootDir, 'imported'),
        manifestsDir: join(skillsRootDir, 'manifests'),
        cacheDir: join(skillsRootDir, 'cache'),
    };
}
export function getCcrImportedSkillDir(skillName, configHomeDir) {
    return join(getCcrSkillImportPaths(configHomeDir).importedRootDir, sanitizeImportedSkillDirName(skillName));
}
export function getCcrSkillImportMarkerPath(skillName, configHomeDir) {
    return join(getCcrImportedSkillDir(skillName, configHomeDir), CCR_SKILL_IMPORT_MARKER_FILE);
}
export function sanitizeImportedSkillDirName(skillName) {
    const sanitized = skillName
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/\.+$/g, '')
        .replace(/^-+|-+$/g, '');
    return sanitized || 'skill';
}
//# sourceMappingURL=importPaths.js.map