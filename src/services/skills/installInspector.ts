import { createHash } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { loadSkillPackageFromDir } from './installCandidates.js'
import {
  parseCcrSkillInstalledIndex,
  parseCcrSkillLockIndex,
  parseCcrSkillPackageOwnerMarker,
  type CcrSkillInstalledIndex,
  type CcrSkillInstalledRecord,
  type CcrSkillLockIndex,
  type CcrSkillLockRecord,
  type CcrSkillPackageOwnerMarker,
} from './installManifest.js'
import { getCcrSkillInstallPaths } from './installPaths.js'
import type { CcrSkillPackage } from '../../skills/model.js'
import { scanSkillPackage } from './securityScanner.js'
import {
  createSkillSecurityFinding,
  createSkillSecurityScanReport,
  type SkillSecurityScanReport,
  type SkillSecurityScanSource,
} from './securitySchema.js'

export type InstalledSkillInspectionStatus =
  | 'installed'
  | 'disabled'
  | 'missing-package'
  | 'missing-skill-md'
  | 'missing-owner-marker'
  | 'missing-lock'
  | 'drifted'
  | 'invalid'

export type InstalledSkillInspection = {
  schemaVersion: 1
  lockKey: string
  name: string
  scope: CcrSkillInstalledRecord['scope']
  status: InstalledSkillInspectionStatus
  statusMessage: string
  installedRecord: CcrSkillInstalledRecord
  lockRecord: CcrSkillLockRecord | null
  ownerMarker: CcrSkillPackageOwnerMarker | null
  package: CcrSkillPackage | null
  securityReport: SkillSecurityScanReport | null
  checksum: {
    algorithm: 'sha256'
    expectedSkillMd: string | null
    actualSkillMd: string | null
    drifted: boolean
  }
  errors: string[]
}

export type InstalledSkillListResult = {
  schemaVersion: 1
  installed: InstalledSkillInspection[]
  summary: Record<InstalledSkillInspectionStatus, number>
}

export async function listInstalledSkills(
  options: {
    configHomeDir?: string
  } = {},
): Promise<InstalledSkillListResult> {
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const [installedIndex, lockIndex] = await Promise.all([
    readInstalledIndex(paths.installedIndexPath),
    readLockIndex(paths.lockFilePath),
  ])
  const installed = await Promise.all(
    Object.entries(installedIndex.installed).map(([lockKey, record]) =>
      inspectInstalledRecord(lockKey, record, lockIndex, options.configHomeDir),
    ),
  )

  return {
    schemaVersion: 1,
    installed: installed.sort(compareInstalledSkills),
    summary: summarizeInstalledSkills(installed),
  }
}

export async function inspectInstalledSkill(
  skillRef: string,
  options: {
    configHomeDir?: string
  } = {},
): Promise<InstalledSkillInspection | null> {
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const [installedIndex, lockIndex] = await Promise.all([
    readInstalledIndex(paths.installedIndexPath),
    readLockIndex(paths.lockFilePath),
  ])
  const match = Object.entries(installedIndex.installed).find(
    ([lockKey, record]) => lockKey === skillRef || record.name === skillRef,
  )
  if (!match) return null

  const [lockKey, record] = match
  return inspectInstalledRecord(lockKey, record, lockIndex, options.configHomeDir)
}

async function inspectInstalledRecord(
  lockKey: string,
  record: CcrSkillInstalledRecord,
  lockIndex: CcrSkillLockIndex,
  configHomeDir?: string,
): Promise<InstalledSkillInspection> {
  const lockRecord = lockIndex.locks[record.lockKey] ?? null
  const base = createInspectionBase(lockKey, record, lockRecord)

  if (!(await isDirectory(record.packageDir))) {
    return completeInspection(
      {
        ...base,
        securityReport: createIntegritySecurityReport({
          record,
          source: 'installed',
          ruleId: 'inspection.missing-package',
          severity: 'high',
          message: `Skill package directory is missing: ${record.packageDir}`,
        }),
      },
      {
        status: 'missing-package',
        message: `Skill package directory is missing: ${record.packageDir}`,
      },
    )
  }

  if (!(await isFile(record.skillFilePath))) {
    return completeInspection(
      {
        ...base,
        securityReport: createIntegritySecurityReport({
          record,
          source: 'installed',
          ruleId: 'inspection.missing-skill-md',
          severity: 'high',
          message: `Skill package is missing SKILL.md: ${record.skillFilePath}`,
        }),
      },
      {
        status: 'missing-skill-md',
        message: `Skill package is missing SKILL.md: ${record.skillFilePath}`,
      },
    )
  }

  const ownerMarker = await readOwnerMarker(record.packageOwnerMarkerPath)
  if (ownerMarker == null) {
    return completeInspection(
      {
        ...base,
        ownerMarker,
        securityReport: createIntegritySecurityReport({
          record,
          source: 'installed',
          ruleId: 'inspection.missing-owner-marker',
          severity: 'high',
          message: `Skill package owner marker is missing or invalid: ${record.packageOwnerMarkerPath}`,
        }),
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
        securityReport: createIntegritySecurityReport({
          record,
          source: 'installed',
          ruleId: 'inspection.owner-marker-mismatch',
          severity: 'high',
          message: `Skill package owner marker does not match installed record: ${record.packageOwnerMarkerPath}`,
        }),
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
        securityReport: createIntegritySecurityReport({
          record,
          source: 'installed',
          ruleId: 'inspection.missing-lock',
          severity: 'medium',
          message: `Skill lock record is missing: ${record.lockKey}`,
        }),
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
    const driftedSecurity = await scanInstalledPackageForInspection({
      record,
      lockRecord,
      source: 'drifted',
    })
    return completeInspection(
      {
        ...base,
        ownerMarker,
        package: driftedSecurity.package,
        securityReport: driftedSecurity.securityReport,
        checksum,
        errors: driftedSecurity.errors,
      },
      {
        status: 'drifted',
        message: `Skill package checksum drift detected: ${record.name}`,
      },
    )
  }

  try {
    const installedSecurity = await scanInstalledPackageForInspection({
      record,
      lockRecord,
      source: 'installed',
    })
    const enabled = record.enabled
    return completeInspection(
      {
        ...base,
        ownerMarker,
        package: installedSecurity.package,
        securityReport: installedSecurity.securityReport,
        checksum,
        errors: installedSecurity.errors,
      },
      enabled
        ? {
            status: 'installed',
            message: `Skill is installed: ${record.name}`,
          }
        : {
            status: 'disabled',
            message: `Skill is installed but disabled: ${record.name}`,
          },
    )
  } catch (error) {
    return completeInspection(
      {
        ...base,
        ownerMarker,
        checksum,
        securityReport: createIntegritySecurityReport({
          record,
          source: 'installed',
          ruleId: 'inspection.normalize-failed',
          severity: 'high',
          message: `Skill package cannot be normalized: ${record.name}. ${formatErrorMessage(error)}`,
        }),
        errors: [formatErrorMessage(error)],
      },
      {
        status: 'invalid',
        message: `Skill package cannot be normalized: ${record.name}`,
      },
    )
  }
}

function createInspectionBase(
  lockKey: string,
  record: CcrSkillInstalledRecord,
  lockRecord: CcrSkillLockRecord | null,
): InstalledSkillInspection {
  return {
    schemaVersion: 1,
    lockKey,
    name: record.name,
    scope: record.scope,
    status: 'invalid',
    statusMessage: 'Skill inspection has not completed.',
    installedRecord: record,
    lockRecord,
    ownerMarker: null,
    package: null,
    securityReport: null,
    checksum: {
      algorithm: 'sha256',
      expectedSkillMd: lockRecord?.checksum.skillMd ?? null,
      actualSkillMd: null,
      drifted: false,
    },
    errors: [],
  }
}

async function scanInstalledPackageForInspection(input: {
  record: CcrSkillInstalledRecord
  lockRecord: CcrSkillLockRecord
  source: SkillSecurityScanSource
}): Promise<{
  package: CcrSkillPackage | null
  securityReport: SkillSecurityScanReport
  errors: string[]
}> {
  try {
    const skillPackage = await loadInstalledSkillPackage(
      input.record,
      input.lockRecord,
    )
    return {
      package: skillPackage,
      securityReport: await scanSkillPackage(skillPackage, {
        source: input.source,
        packageId: input.record.lockKey,
      }),
      errors: [],
    }
  } catch (error) {
    return {
      package: null,
      securityReport: createIntegritySecurityReport({
        record: input.record,
        source: input.source,
        ruleId: 'inspection.security-scan-failed',
        severity: 'high',
        message: `Skill security scan failed: ${formatErrorMessage(error)}`,
      }),
      errors: [formatErrorMessage(error)],
    }
  }
}

async function loadInstalledSkillPackage(
  record: CcrSkillInstalledRecord,
  lockRecord: CcrSkillLockRecord,
): Promise<CcrSkillPackage> {
  return loadSkillPackageFromDir({
    skillDir: record.packageDir,
    originVendor: record.manifest.compatibility?.vendor ?? lockRecord.originVendor,
    importedFrom: getInstalledSourcePath(record),
    legacyCommand: record.manifest.compatibility?.convertedFromCommand ?? false,
    risks: [],
  })
}

function createIntegritySecurityReport(input: {
  record: CcrSkillInstalledRecord
  source: SkillSecurityScanSource
  ruleId: string
  severity: 'medium' | 'high' | 'critical'
  message: string
}): SkillSecurityScanReport {
  return createSkillSecurityScanReport({
    packageId: input.record.lockKey,
    skillName: input.record.name,
    scannedAt: new Date().toISOString(),
    packageDir: input.record.packageDir,
    source: input.source,
    findings: [
      createSkillSecurityFinding({
        id: `${input.ruleId}:${input.record.lockKey}`,
        ruleId: input.ruleId,
        severity: input.severity,
        category: 'integrity',
        title: 'Installed skill integrity issue',
        message: input.message,
        filePath: input.record.packageDir,
        relativePath: null,
        line: null,
        evidence: input.record.lockKey,
        recommendation:
          'Repair or reinstall this skill before trusting its installed package.',
      }),
    ],
  })
}

function completeInspection(
  inspection: InstalledSkillInspection,
  result: {
    status: InstalledSkillInspectionStatus
    message: string
  },
): InstalledSkillInspection {
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
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') return null
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

function getInstalledSourcePath(record: CcrSkillInstalledRecord): string {
  if (record.manifest.source.kind === 'imported-skill') {
    return record.manifest.source.path
  }
  if (record.manifest.source.kind === 'local-manifest') {
    return record.manifest.source.path
  }
  if (record.manifest.source.kind === 'builtin-preset') {
    return `builtin-preset:${record.manifest.source.presetId}`
  }
  return record.packageDir
}

function summarizeInstalledSkills(
  inspections: InstalledSkillInspection[],
): Record<InstalledSkillInspectionStatus, number> {
  const summary: Record<InstalledSkillInspectionStatus, number> = {
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

function compareInstalledSkills(
  a: InstalledSkillInspection,
  b: InstalledSkillInspection,
): number {
  const statusDiff = statusRank(a.status) - statusRank(b.status)
  if (statusDiff !== 0) return statusDiff
  return a.name.localeCompare(b.name)
}

function statusRank(status: InstalledSkillInspectionStatus): number {
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
