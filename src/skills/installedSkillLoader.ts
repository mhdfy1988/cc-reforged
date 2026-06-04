import { createHash } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import {
  parseCcrSkillPackageOwnerMarker,
  parseCcrSkillInstalledIndex,
  parseCcrSkillLockIndex,
  type CcrSkillInstalledIndex,
  type CcrSkillInstalledRecord,
  type CcrSkillLockIndex,
  type CcrSkillLockRecord,
  type CcrSkillPackageOwnerMarker,
} from '../services/skills/installManifest.js'
import { getCcrSkillInstallPaths } from '../services/skills/installPaths.js'
import { collectSkillResourceDirs } from '../services/skills/importDiscovery.js'
import { parseFrontmatter } from '../utils/frontmatterParser.js'
import { parseYaml } from '../utils/yaml.js'
import type { CcrSkillPackage } from './model.js'
import { normalizeSkillPackage } from './normalizeSkillPackage.js'
import { parseCcrSkillPackage } from './packageSchema.js'
import {
  evaluateInstalledSkillActivation,
  type InstalledSkillRuntimeStatus,
  type SkillActivationDiagnostic,
  type SkillActivationResult,
} from './skillActivationPolicy.js'
import { parseSkillFrontmatterFields } from './skillFrontmatter.js'

export type InstalledSkillRuntimeInspection = {
  schemaVersion: 1
  lockKey: string
  name: string
  scope: CcrSkillInstalledRecord['scope']
  status: InstalledSkillRuntimeStatus
  statusMessage: string
  installedRecord: CcrSkillInstalledRecord
  lockRecord: CcrSkillLockRecord | null
  ownerMarker: CcrSkillPackageOwnerMarker | null
  package: CcrSkillPackage | null
  checksum: {
    algorithm: 'sha256'
    expectedSkillMd: string | null
    actualSkillMd: string | null
    drifted: boolean
  }
  errors: string[]
}

export type InstalledSkillRuntimeEntry = {
  package: CcrSkillPackage
  inspection: InstalledSkillRuntimeInspection
  activation: SkillActivationResult
}

export type InstalledSkillRuntimeLoadResult = {
  schemaVersion: 1
  entries: InstalledSkillRuntimeEntry[]
  inspections: InstalledSkillRuntimeInspection[]
  diagnostics: SkillActivationDiagnostic[]
  summary: Record<InstalledSkillRuntimeStatus, number>
}

export async function loadInstalledSkillRuntimePackages(
  options: {
    configHomeDir?: string
  } = {},
): Promise<InstalledSkillRuntimeLoadResult> {
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const [installedIndex, lockIndex] = await Promise.all([
    readInstalledIndex(paths.installedIndexPath),
    readLockIndex(paths.lockFilePath),
  ])
  const inspections = await Promise.all(
    Object.entries(installedIndex.installed).map(([lockKey, record]) =>
      inspectInstalledRuntimeRecord(lockKey, record, lockIndex),
    ),
  )

  const entries: InstalledSkillRuntimeEntry[] = []
  const diagnostics: SkillActivationDiagnostic[] = []
  for (const inspection of inspections) {
    const activation = evaluateInstalledSkillActivation(inspection)
    diagnostics.push(...activation.diagnostics)
    if (!activation.runtimeVisible || !inspection.package) {
      continue
    }
    entries.push({
      package: applyRuntimeActivation(inspection.package, inspection, activation),
      inspection,
      activation,
    })
  }

  return {
    schemaVersion: 1,
    entries,
    inspections: inspections.sort(compareRuntimeInspections),
    diagnostics,
    summary: summarizeRuntimeInspections(inspections),
  }
}

async function inspectInstalledRuntimeRecord(
  lockKey: string,
  record: CcrSkillInstalledRecord,
  lockIndex: CcrSkillLockIndex,
): Promise<InstalledSkillRuntimeInspection> {
  const lockRecord = lockIndex.locks[record.lockKey] ?? null
  const base = createInspectionBase(lockKey, record, lockRecord)

  if (!(await isDirectory(record.packageDir))) {
    return completeInspection(base, {
      status: 'missing-package',
      message: `Skill package directory is missing: ${record.packageDir}`,
    })
  }

  if (!(await isFile(record.skillFilePath))) {
    return completeInspection(base, {
      status: 'missing-skill-md',
      message: `Skill package is missing SKILL.md: ${record.skillFilePath}`,
    })
  }

  const ownerMarker = await readOwnerMarker(record.packageOwnerMarkerPath)
  if (!ownerMarker) {
    return completeInspection(
      {
        ...base,
        ownerMarker,
      },
      {
        status: 'missing-owner-marker',
        message: `Skill package owner marker is missing or invalid: ${record.packageOwnerMarkerPath}`,
      },
    )
  }

  if (ownerMarker.packageId !== record.lockKey || ownerMarker.name !== record.name) {
    return completeInspection(
      {
        ...base,
        ownerMarker,
      },
      {
        status: 'invalid',
        message: `Skill package owner marker does not match installed record: ${record.packageOwnerMarkerPath}`,
      },
    )
  }

  if (!lockRecord) {
    return completeInspection(
      {
        ...base,
        ownerMarker,
      },
      {
        status: 'missing-lock',
        message: `Skill lock record is missing: ${record.lockKey}`,
      },
    )
  }

  const actualSkillMd = await hashFileSha256(record.skillFilePath)
  const checksum = {
    algorithm: 'sha256' as const,
    expectedSkillMd: lockRecord.checksum.skillMd,
    actualSkillMd,
    drifted: actualSkillMd !== lockRecord.checksum.skillMd,
  }
  if (checksum.drifted) {
    return completeInspection(
      {
        ...base,
        ownerMarker,
        checksum,
      },
      {
        status: 'drifted',
        message: `Skill package checksum drift detected: ${record.name}`,
      },
    )
  }

  try {
    const skillPackage = await loadManagedSkillPackage(record, lockRecord)
    return completeInspection(
      {
        ...base,
        ownerMarker,
        package: skillPackage,
        checksum,
      },
      record.enabled && record.modelInvocable
        ? {
            status: 'installed',
            message: `Skill is installed: ${record.name}`,
          }
        : {
            status: 'disabled',
            message: `Skill is installed but disabled for at least one runtime surface: ${record.name}`,
          },
    )
  } catch (error) {
    return completeInspection(
      {
        ...base,
        ownerMarker,
        checksum,
        errors: [formatErrorMessage(error)],
      },
      {
        status: 'invalid',
        message: `Skill package cannot be normalized: ${record.name}`,
      },
    )
  }
}

async function loadManagedSkillPackage(
  record: CcrSkillInstalledRecord,
  lockRecord: CcrSkillLockRecord,
): Promise<CcrSkillPackage> {
  const rawMarkdown = await readFile(record.skillFilePath, 'utf8')
  const { frontmatter, content } = parseFrontmatter(
    rawMarkdown,
    record.skillFilePath,
  )
  const parsed = parseSkillFrontmatterFields(
    frontmatter,
    content,
    record.name,
    'Skill',
  )
  const risks: string[] = []
  const resources = await collectSkillResourceDirs(record.packageDir, risks)
  const openaiYaml = await readOptionalOpenAiYaml(record.packageDir, risks)

  return normalizeSkillPackage({
    id: `managed:${record.lockKey}:${record.skillFilePath}`,
    skillName: record.name,
    markdownContent: content,
    frontmatter,
    parsed,
    source: 'managed',
    filePath: record.skillFilePath,
    baseDir: record.packageDir,
    resources,
    openaiYaml,
    compatibilityHints: {
      vendor: record.manifest.compatibility?.vendor ?? lockRecord.originVendor,
      importedFrom: getInstalledSourcePath(record),
      legacyCommand: record.manifest.compatibility?.convertedFromCommand ?? false,
    },
  })
}

function applyRuntimeActivation(
  skillPackage: CcrSkillPackage,
  inspection: InstalledSkillRuntimeInspection,
  activation: SkillActivationResult,
): CcrSkillPackage {
  const warnings = [
    ...skillPackage.compatibility.warnings,
    ...activation.diagnostics.map(diagnostic => diagnostic.message),
  ]
  return parseCcrSkillPackage({
    ...skillPackage,
    id: `managed:${inspection.installedRecord.lockKey}:${inspection.installedRecord.skillFilePath}`,
    source: 'managed',
    bodyPath: inspection.installedRecord.skillFilePath,
    baseDir: inspection.installedRecord.packageDir,
    origin: {
      ...skillPackage.origin,
      sourcePath: inspection.installedRecord.skillFilePath,
      importedFrom: getInstalledSourcePath(inspection.installedRecord),
    },
    invocation: {
      ...skillPackage.invocation,
      modelInvocable: activation.modelInvocable,
      userInvocable: activation.userInvocable,
    },
    compatibility: {
      ...skillPackage.compatibility,
      warnings,
    },
  })
}

function createInspectionBase(
  lockKey: string,
  record: CcrSkillInstalledRecord,
  lockRecord: CcrSkillLockRecord | null,
): InstalledSkillRuntimeInspection {
  return {
    schemaVersion: 1,
    lockKey,
    name: record.name,
    scope: record.scope,
    status: 'invalid',
    statusMessage: 'Skill runtime inspection has not completed.',
    installedRecord: record,
    lockRecord,
    ownerMarker: null,
    package: null,
    checksum: {
      algorithm: 'sha256',
      expectedSkillMd: lockRecord?.checksum.skillMd ?? null,
      actualSkillMd: null,
      drifted: false,
    },
    errors: [],
  }
}

function completeInspection(
  inspection: InstalledSkillRuntimeInspection,
  result: {
    status: InstalledSkillRuntimeStatus
    message: string
  },
): InstalledSkillRuntimeInspection {
  return {
    ...inspection,
    status: result.status,
    statusMessage: result.message,
  }
}

async function readInstalledIndex(path: string): Promise<CcrSkillInstalledIndex> {
  try {
    return parseCcrSkillInstalledIndex(JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return parseCcrSkillInstalledIndex({ schemaVersion: 1 })
    }
    throw error
  }
}

async function readLockIndex(path: string): Promise<CcrSkillLockIndex> {
  try {
    return parseCcrSkillLockIndex(JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return parseCcrSkillLockIndex({ schemaVersion: 1 })
    }
    throw error
  }
}

async function readOwnerMarker(
  ownerMarkerPath: string,
): Promise<CcrSkillPackageOwnerMarker | null> {
  try {
    return parseCcrSkillPackageOwnerMarker(
      JSON.parse(await readFile(ownerMarkerPath, 'utf8')),
    )
  } catch {
    return null
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') return false
    throw error
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') return false
    throw error
  }
}

async function hashFileSha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function readOptionalOpenAiYaml(
  skillDir: string,
  risks: string[],
): Promise<unknown | undefined> {
  try {
    return parseYaml(await readFile(join(skillDir, 'agents', 'openai.yaml'), 'utf8'))
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      risks.push(`Failed to read agents/openai.yaml: ${formatErrorMessage(error)}`)
    }
    return undefined
  }
}

function getInstalledSourcePath(record: CcrSkillInstalledRecord): string {
  if (record.manifest.source.kind === 'imported-skill') {
    return record.manifest.source.path
  }
  if (record.manifest.source.kind === 'local-manifest') {
    return record.manifest.source.path
  }
  return record.packageDir
}

function summarizeRuntimeInspections(
  inspections: InstalledSkillRuntimeInspection[],
): Record<InstalledSkillRuntimeStatus, number> {
  const summary: Record<InstalledSkillRuntimeStatus, number> = {
    installed: 0,
    disabled: 0,
    'missing-package': 0,
    'missing-skill-md': 0,
    'missing-owner-marker': 0,
    'missing-lock': 0,
    drifted: 0,
    invalid: 0,
  }
  for (const inspection of inspections) {
    summary[inspection.status] += 1
  }
  return summary
}

function compareRuntimeInspections(
  a: InstalledSkillRuntimeInspection,
  b: InstalledSkillRuntimeInspection,
): number {
  const statusDiff = statusRank(a.status) - statusRank(b.status)
  if (statusDiff !== 0) return statusDiff
  return a.name.localeCompare(b.name)
}

function statusRank(status: InstalledSkillRuntimeStatus): number {
  switch (status) {
    case 'installed':
      return 0
    case 'disabled':
      return 1
    case 'drifted':
      return 2
    case 'missing-lock':
      return 3
    case 'missing-owner-marker':
      return 4
    case 'missing-skill-md':
      return 5
    case 'missing-package':
      return 6
    case 'invalid':
      return 7
  }
}

function getErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error != null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
