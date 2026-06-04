import { readdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { normalizeSkillPackage } from '../../skills/normalizeSkillPackage.js'
import type { CcrSkillResourceInput } from '../../skills/skillResourceScanner.js'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { parseSkillFrontmatterFields } from '../../skills/skillFrontmatter.js'
import { parseYaml } from '../../utils/yaml.js'
import {
  parseSkillImportCandidate,
  type SkillImportCandidate,
  type SkillImportSource,
} from './importSource.js'
import { sanitizeImportedSkillDirName } from './importPaths.js'
import { convertClaudeCommandToSkill } from './importConverter.js'
import { extractLocalSkillArchive } from './archiveImporter.js'

export type SkillImportDiscoveryResult =
  | { success: true; candidate: SkillImportCandidate }
  | { success: false; error: SkillImportDiscoveryError }

export type SkillImportDiscoveryError = {
  source: SkillImportSource
  message: string
  reason:
    | 'unsupported-source'
    | 'missing-skill-md'
    | 'invalid-archive'
    | 'multiple-skill-md'
    | 'archive-too-large'
    | 'read-failed'
    | 'normalize-failed'
}

export async function discoverSkillImportCandidate(
  source: SkillImportSource,
): Promise<SkillImportDiscoveryResult> {
  switch (source.kind) {
    case 'local-skill-dir':
      return discoverSkillDirCandidate({
        source,
        originVendor: 'agent-skills',
      })
    case 'local-archive':
      return discoverLocalArchiveCandidate(source)
    case 'codex-skill-dir':
      return discoverSkillDirCandidate({
        source,
        originVendor: 'codex',
        openaiYaml: await readOptionalOpenAiYaml(source),
      })
    case 'openclaw-skill-dir':
      return discoverSkillDirCandidate({
        source,
        originVendor: 'openclaw',
        analyzeWarnings: analyzeOpenClawWarnings,
      })
    case 'claude-command':
      return discoverClaudeCommandCandidate(source)
  }
}

async function discoverSkillDirCandidate(input: {
  source: Exclude<SkillImportSource, { kind: 'claude-command' }>
  skillDir?: string
  originVendor: 'agent-skills' | 'codex' | 'openclaw'
  baseWarnings?: string[]
  openaiYaml?: OptionalYamlResult
  analyzeWarnings?: (frontmatter: Record<string, unknown>) => string[]
}): Promise<SkillImportDiscoveryResult> {
  const source = input.source
  const skillDir = input.skillDir ?? source.path
  const baseWarnings: string[] = [...(input.baseWarnings ?? [])]
  if (input.openaiYaml?.warning) {
    baseWarnings.push(input.openaiYaml.warning)
  }
  const skillFilePath = join(skillDir, 'SKILL.md')
  let rawMarkdown: string
  try {
    rawMarkdown = await readFile(skillFilePath, 'utf8')
  } catch (error) {
    return {
      success: false,
      error: {
        source,
        reason: 'missing-skill-md',
        message: `无法读取 skill 入口：${skillFilePath}。${formatErrorMessage(error)}`,
      },
    }
  }

  const { frontmatter, content } = parseFrontmatter(rawMarkdown, skillFilePath)
  const skillName =
    typeof frontmatter.name === 'string' && frontmatter.name.trim()
      ? frontmatter.name.trim()
      : sanitizeImportedSkillDirName(skillDir.split(/[\\/]/).pop() ?? 'skill')
  const warnings: string[] = [
    ...baseWarnings,
    ...(input.analyzeWarnings?.(frontmatter) ?? []),
  ]
  const resources = await collectSkillResourceDirs(skillDir, warnings)

  try {
    const parsed = parseSkillFrontmatterFields(
      frontmatter,
      content,
      skillName,
      'Skill',
    )
    const normalizedPreview = normalizeSkillPackage({
      skillName,
      markdownContent: content,
      frontmatter,
      parsed,
      source: 'imported',
      filePath: skillFilePath,
      baseDir: skillDir,
      resources,
      openaiYaml: input.openaiYaml?.value,
      compatibilityHints: {
        vendor: input.originVendor,
        importedFrom: source.path,
      },
    })

    return {
      success: true,
      candidate: parseSkillImportCandidate({
        candidateId: `${source.kind}:${source.path}`,
        source,
        state: 'available',
        stateMessage: '可导入',
        name: normalizedPreview.name,
        displayName: normalizedPreview.displayName,
        description: normalizedPreview.description,
        originVendor: normalizedPreview.origin.vendor,
        sourcePath: source.path,
        targetName: sanitizeImportedSkillDirName(normalizedPreview.name),
        normalizedPreview,
        warnings,
      }),
    }
  } catch (error) {
    return {
      success: false,
      error: {
        source,
        reason: 'normalize-failed',
        message: `skill 归一失败：${formatErrorMessage(error)}`,
      },
    }
  }
}

async function discoverLocalArchiveCandidate(
  source: Extract<SkillImportSource, { kind: 'local-archive' }>,
): Promise<SkillImportDiscoveryResult> {
  let extraction
  try {
    extraction = await extractLocalSkillArchive(source.path)
  } catch (error) {
    const message = formatErrorMessage(error)
    return {
      success: false,
      error: {
        source,
        reason: classifyArchiveError(message),
        message: `无法解包 Skill archive：${source.path}。${message}`,
      },
    }
  }

  return discoverSkillDirCandidate({
    source: {
      ...source,
      extractedPath: extraction.skillDir,
      archiveFormat: extraction.format,
    },
    skillDir: extraction.skillDir,
    originVendor: 'agent-skills',
    baseWarnings: extraction.warnings,
  })
}

type OptionalYamlResult = {
  value?: unknown
  warning?: string
}

async function readOptionalOpenAiYaml(
  source: Extract<SkillImportSource, { kind: 'codex-skill-dir' }>,
): Promise<OptionalYamlResult> {
  const openaiYamlPath =
    source.openaiYamlPath ?? join(source.path, 'agents', 'openai.yaml')
  try {
    const raw = await readFile(openaiYamlPath, 'utf8')
    return { value: parseYaml(raw) }
  } catch (error) {
    const code = getErrorCode(error)
    if (code === 'ENOENT' && !source.openaiYamlPath) {
      return {}
    }
    return {
      warning: `无法读取或解析 Codex openai.yaml：${formatErrorMessage(error)}`,
    }
  }
}

function analyzeOpenClawWarnings(frontmatter: Record<string, unknown>): string[] {
  const metadata = asRecord(frontmatter.metadata)
  const openclaw = asRecord(metadata?.openclaw)
  if (!openclaw) {
    return []
  }

  const warnings: string[] = []
  const requires = asRecord(openclaw.requires)
  const requiredBins = asStringArray(requires?.bins)
  const requiredEnv = asStringArray(requires?.env)
  if (requiredBins.length > 0) {
    warnings.push(`OpenClaw requires.bins: ${requiredBins.join(', ')}`)
  }
  if (requiredEnv.length > 0) {
    warnings.push(`OpenClaw requires.env: ${requiredEnv.join(', ')}`)
  }
  if (openclaw.install != null) {
    warnings.push('OpenClaw install metadata detected; CCR import will not execute it.')
  }
  return warnings
}

async function discoverClaudeCommandCandidate(
  source: Extract<SkillImportSource, { kind: 'claude-command' }>,
): Promise<SkillImportDiscoveryResult> {
  let rawMarkdown: string
  try {
    rawMarkdown = await readFile(source.path, 'utf8')
  } catch (error) {
    return {
      success: false,
      error: {
        source,
        reason: 'read-failed',
        message: `无法读取 Claude command：${source.path}。${formatErrorMessage(error)}`,
      },
    }
  }

  const { frontmatter, content } = parseFrontmatter(rawMarkdown, source.path)
  const conversion = convertClaudeCommandToSkill({
    commandPath: source.path,
    frontmatter,
    body: content,
  })

  try {
    const parsed = parseSkillFrontmatterFields(
      conversion.frontmatter,
      conversion.body,
      conversion.skillName,
      'Custom command',
    )
    const normalizedPreview = normalizeSkillPackage({
      skillName: conversion.skillName,
      markdownContent: conversion.body,
      frontmatter: conversion.frontmatter,
      parsed,
      source: 'imported',
      filePath: source.path,
      baseDir: dirname(source.path),
      compatibilityHints: {
        vendor: 'claude',
        importedFrom: source.path,
        legacyCommand: true,
      },
    })

    return {
      success: true,
      candidate: parseSkillImportCandidate({
        candidateId: `claude-command:${source.path}`,
        source,
        state: 'available',
        stateMessage: '可转换为标准 Skill',
        name: normalizedPreview.name,
        displayName: normalizedPreview.displayName,
        description: normalizedPreview.description,
        originVendor: normalizedPreview.origin.vendor,
        sourcePath: source.path,
        targetName: sanitizeImportedSkillDirName(normalizedPreview.name),
        normalizedPreview,
        warnings: conversion.notes,
      }),
    }
  } catch (error) {
    return {
      success: false,
      error: {
        source,
        reason: 'normalize-failed',
        message: `Claude command 转换归一失败：${formatErrorMessage(error)}`,
      },
    }
  }
}

export async function collectSkillResourceDirs(
  skillDir: string,
  warnings: string[],
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
        result[key] = (await collectRelativeFiles(dir, key)).sort()
      } catch (error) {
        const code = getErrorCode(error)
        if (code !== 'ENOENT') {
          warnings.push(`无法枚举 ${key} 资源目录：${formatErrorMessage(error)}`)
        }
      }
    }),
  )

  return result
}

async function collectRelativeFiles(
  absoluteDir: string,
  relativeDir: string,
): Promise<string[]> {
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const absolutePath = join(absoluteDir, entry.name)
      const relativePath = join(relativeDir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        return collectRelativeFiles(absolutePath, relativePath)
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function classifyArchiveError(
  message: string,
): SkillImportDiscoveryError['reason'] {
  if (message.includes('too large') || message.includes('expands beyond')) {
    return 'archive-too-large'
  }
  if (message.includes('multiple SKILL.md')) {
    return 'multiple-skill-md'
  }
  if (message.includes('does not contain SKILL.md')) {
    return 'missing-skill-md'
  }
  return 'invalid-archive'
}
