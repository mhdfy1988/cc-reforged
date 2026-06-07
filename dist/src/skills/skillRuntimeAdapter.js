import { toPromptCommand } from './skillCommandAdapter.js';
import { parseSkillFrontmatterFields, parseSkillPaths, } from './skillFrontmatter.js';
export function createManagedSkillCommandFromInstalledEntry(entry, options) {
    const source = entry.inspection.scope === 'project' ? 'projectSettings' : 'userSettings';
    const rawFrontmatter = entry.package.compatibility.rawFrontmatter;
    const parsed = parseSkillFrontmatterFields(rawFrontmatter, entry.package.body, entry.package.name, 'Skill');
    const command = toPromptCommand(entry.package, {
        source,
        loadedFrom: 'managed',
        createSkillCommand: options.createSkillCommand,
        hasUserSpecifiedDescription: parsed.hasUserSpecifiedDescription,
        hooks: parsed.hooks,
        paths: parseSkillPaths(rawFrontmatter),
        shell: parsed.shell,
        version: parsed.version,
    });
    return {
        skill: {
            ...command,
            installedSkillRef: entry.inspection.lockKey,
        },
        filePath: entry.inspection.installedRecord.skillFilePath,
    };
}
//# sourceMappingURL=skillRuntimeAdapter.js.map