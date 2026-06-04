import { cp, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { normalizeSkillPackage } from '../../skills/normalizeSkillPackage.js'
import type { CcrSkillPackage } from '../../skills/model.js'
import { parseSkillFrontmatterFields } from '../../skills/loadSkillsDir.js'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { parseYaml } from '../../utils/yaml.js'
import { collectSkillResourceDirs } from './importDiscovery.js'
import { convertClaudeCommandToSkill } from './importConverter.js'
import {
  CCR_SKILL_IMPORT_MARKER_FILE,
  sanitizeImportedSkillDirName,
} from './importPaths.js'
import {
  parseCcrSkillImportMarker,
  parseSkillImportResult,
  type CcrSkillImportMarker,
  type SkillImportPlan,
  type SkillImportResult,
} from './importSource.js'

export type ApplySkillImportPlanOptions = {
  confirmationToken: string
  configHomeDir?: string
  now?: Date
}

export async function applySkillImportPlan(
  plan: SkillImportPlan,
  options: ApplySkillImportPlanOptions,
): Promise<SkillImportResult> {
  if (options.confirmationToken !== plan.confirmation.token) {
    throw new Error('Skill import confirmation token mismatch.')
  }
  if (!plan.importable) {
    throw new Error(
      `Skill import plan is not importable: ${plan.conflicts
        .map(conflict => conflict.message)
        .join('; ')}`,
    )
  }

  if (plan.source.kind === 'claude-command') {
    await writeConvertedCommand(plan)
  } else {
    const sourceDir = getPlanSourceDir(plan)
    await mkdir(dirname(plan.targetDir), { recursive: true })
    await cp(sourceDir, plan.targetDir, {
      recursive: true,
      errorOnExist: true,
      force: false,
    })
  }

  const marker = createImportMarker(plan, options.now ?? new Date())
  const markerPath = join(plan.targetDir, CCR_SKILL_IMPORT_MARKER_FILE)
  await mkdir(dirname(markerPath), { recursive: true })
  await writeFile(markerPath, `${jsonStringify(marker, null, 2)}\n`, 'utf8')

  const warnings: string[] = [...plan.risks]
  const skillPackage = await loadImportedSkillPackage({
    targetDir: plan.targetDir,
    marker,
    warnings,
  })

  return parseSkillImportResult({
    schemaVersion: 1,
    name: skillPackage.name,
    targetDir: plan.targetDir,
    skillFilePath: join(plan.targetDir, 'SKILL.md'),
    markerPath,
    package: skillPackage,
    warnings,
  })
}

async function writeConvertedCommand(plan: SkillImportPlan): Promise<void> {
  const rawMarkdown = await readFile(plan.source.path, 'utf8')
  const { frontmatter, content } = parseFrontmatter(rawMarkdown, plan.source.path)
  const conversion = convertClaudeCommandToSkill({
    commandPath: plan.source.path,
    frontmatter,
    body: content,
  })
  await mkdir(plan.targetDir, { recursive: true })
  await writeFile(join(plan.targetDir, 'SKILL.md'), conversion.markdownContent, 'utf8')
}

function createImportMarker(
  plan: SkillImportPlan,
  now: Date,
): CcrSkillImportMarker {
  return parseCcrSkillImportMarker({
    schemaVersion: 1,
    name: plan.name,
    importedAt: now.toISOString(),
    source: getMarkerSource(plan),
    sourcePath: plan.source.path,
    originVendor: plan.originVendor,
    converted: plan.conversion.required,
    ...(plan.source.kind === 'claude-command'
      ? { originalCommandPath: plan.source.path }
      : {}),
  })
}

function getPlanSourceDir(plan: SkillImportPlan): string {
  if (plan.source.kind === 'local-archive') {
    if (!plan.source.extractedPath) {
      throw new Error('local-archive import plan is missing extractedPath.')
    }
    return plan.source.extractedPath
  }
  return plan.source.path
}

function getMarkerSource(plan: SkillImportPlan): CcrSkillImportMarker['source'] {
  if (plan.source.kind !== 'local-archive') {
    return plan.source
  }
  return {
    kind: 'local-archive',
    path: plan.source.path,
    archiveFormat: plan.source.archiveFormat,
  }
}

async function loadImportedSkillPackage(input: {
  targetDir: string
  marker: CcrSkillImportMarker
  warnings: string[]
}): Promise<CcrSkillPackage> {
  const skillFilePath = join(input.targetDir, 'SKILL.md')
  const rawMarkdown = await readFile(skillFilePath, 'utf8')
  const { frontmatter, content } = parseFrontmatter(rawMarkdown, skillFilePath)
  const skillName =
    typeof frontmatter.name === 'string' && frontmatter.name.trim()
      ? frontmatter.name.trim()
      : sanitizeImportedSkillDirName(input.marker.name)
  const parsed = parseSkillFrontmatterFields(
    frontmatter,
    content,
    skillName,
    'Skill',
  )
  const resources = await collectSkillResourceDirs(input.targetDir, input.warnings)
  const openaiYaml = await readImportedOpenAiYaml(input.targetDir, input.warnings)

  return normalizeSkillPackage({
    skillName,
    markdownContent: content,
    frontmatter,
    parsed,
    source: 'imported',
    filePath: skillFilePath,
    baseDir: input.targetDir,
    resources,
    openaiYaml,
    compatibilityHints: {
      vendor: input.marker.originVendor,
      importedFrom: input.marker.sourcePath,
      legacyCommand: input.marker.source.kind === 'claude-command',
    },
  })
}

async function readImportedOpenAiYaml(
  targetDir: string,
  warnings: string[],
): Promise<unknown | undefined> {
  try {
    return parseYaml(await readFile(join(targetDir, 'agents', 'openai.yaml'), 'utf8'))
  } catch (error) {
    const code =
      typeof error === 'object' && error != null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined
    if (code !== 'ENOENT') {
      warnings.push(
        `导入后读取 Codex openai.yaml 失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    return undefined
  }
}
