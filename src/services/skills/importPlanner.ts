import { existsSync } from 'fs'
import { join } from 'path'
import {
  getCcrImportedSkillDir,
  getCcrSkillImportMarkerPath,
} from './importPaths.js'
import {
  parseSkillImportPlan,
  type SkillImportCandidate,
  type SkillImportPlan,
} from './importSource.js'

export type CreateSkillImportPlanOptions = {
  configHomeDir?: string
}

export function createSkillImportPlan(
  candidate: SkillImportCandidate,
  options: CreateSkillImportPlanOptions = {},
): SkillImportPlan {
  const targetDir = getCcrImportedSkillDir(candidate.targetName, options.configHomeDir)
  const conflicts = existsSync(targetDir)
    ? [
        {
          kind: 'target-exists' as const,
          message: `目标导入目录已存在：${targetDir}`,
        },
      ]
    : []
  const importable = candidate.state === 'available' && conflicts.length === 0
  const conversion =
    candidate.source.kind === 'claude-command'
      ? {
          required: true,
          kind: 'claude-command-to-skill' as const,
          notes: candidate.warnings,
        }
      : {
          required: false,
          kind: 'none' as const,
          notes: [],
        }

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
        toPath: getCcrSkillImportMarkerPath(
          candidate.targetName,
          options.configHomeDir,
        ),
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
  })
}

function getSkillMarkdownSourcePath(
  candidate: SkillImportCandidate,
): string | undefined {
  if (candidate.source.kind === 'claude-command') {
    return undefined
  }
  if (candidate.source.kind === 'local-archive') {
    if (!candidate.source.extractedPath) {
      throw new Error('local-archive import candidate is missing extractedPath.')
    }
    return join(candidate.source.extractedPath, 'SKILL.md')
  }
  return join(candidate.source.path, 'SKILL.md')
}

function createConfirmationToken(candidateId: string, targetDir: string): string {
  return Buffer.from(`${candidateId}\n${targetDir}`, 'utf8')
    .toString('base64url')
    .slice(0, 32)
}
