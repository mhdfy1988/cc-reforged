import { existsSync } from 'fs';
import { join } from 'path';
import { getCcrImportedSkillDir, getCcrSkillImportMarkerPath, } from './importPaths.js';
import { parseSkillImportPlan, } from './importSource.js';
export function createSkillImportPlan(candidate, options = {}) {
    const targetDir = getCcrImportedSkillDir(candidate.targetName, options.configHomeDir);
    const conflicts = existsSync(targetDir)
        ? [
            {
                kind: 'target-exists',
                message: `目标导入目录已存在：${targetDir}`,
            },
        ]
        : [];
    const importable = candidate.state === 'available' && conflicts.length === 0;
    const conversion = candidate.source.kind === 'claude-command'
        ? {
            required: true,
            kind: 'claude-command-to-skill',
            notes: candidate.warnings,
        }
        : {
            required: false,
            kind: 'none',
            notes: [],
        };
    return parseSkillImportPlan({
        schemaVersion: 1,
        planId: `skill-import:${candidate.candidateId}`,
        candidateId: candidate.candidateId,
        name: candidate.name,
        source: candidate.source,
        originVendor: candidate.originVendor,
        targetDir,
        writes: [
            {
                kind: 'skill-md',
                fromPath: getSkillMarkdownSourcePath(candidate),
                toPath: join(targetDir, 'SKILL.md'),
                mode: candidate.source.kind === 'claude-command' ? 'write' : 'copy',
            },
            {
                kind: 'import-marker',
                toPath: getCcrSkillImportMarkerPath(candidate.targetName, options.configHomeDir),
                mode: 'record',
            },
        ],
        conversion,
        conflicts,
        risks: candidate.warnings,
        importable,
        requiresConfirmation: true,
        confirmation: {
            token: createConfirmationToken(candidate.candidateId, targetDir),
            message: `确认导入 Skill ${candidate.name} 到 ${targetDir}`,
        },
    });
}
function getSkillMarkdownSourcePath(candidate) {
    if (candidate.source.kind === 'claude-command') {
        return undefined;
    }
    if (candidate.source.kind === 'local-archive') {
        if (!candidate.source.extractedPath) {
            throw new Error('local-archive import candidate is missing extractedPath.');
        }
        return join(candidate.source.extractedPath, 'SKILL.md');
    }
    return join(candidate.source.path, 'SKILL.md');
}
function createConfirmationToken(candidateId, targetDir) {
    return Buffer.from(`${candidateId}\n${targetDir}`, 'utf8')
        .toString('base64url')
        .slice(0, 32);
}
//# sourceMappingURL=importPlanner.js.map