import type {
  CcrSkillInstalledRecord,
  CcrSkillLockRecord,
  CcrSkillPackageOwnerMarker,
} from './installManifest.js'
import type { CcrSkillPackage } from '../../skills/model.js'
import {
  inspectInstalledSkillPackage,
  listInstalledSkillPackageInspections,
  type InstalledSkillPackageInspection,
  type InstalledSkillPackageInspectionStatus,
} from './installedPackageInspection.js'
import { scanSkillPackage } from './securityScanner.js'
import {
  createSkillSecurityFinding,
  createSkillSecurityScanReport,
  type SkillSecurityScanReport,
  type SkillSecurityScanSource,
} from './securitySchema.js'

export type InstalledSkillInspectionStatus = InstalledSkillPackageInspectionStatus

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
    expectedPackageTree: string | null
    actualPackageTree: string | null
    drifted: boolean
    driftedPaths: Array<'skillMd' | 'packageTree'>
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
  const result = await listInstalledSkillPackageInspections(options)
  return {
    schemaVersion: 1,
    installed: await Promise.all(result.installed.map(toManagementInspection)),
    summary: result.summary,
  }
}

export async function inspectInstalledSkill(
  skillRef: string,
  options: {
    configHomeDir?: string
  } = {},
): Promise<InstalledSkillInspection | null> {
  const inspection = await inspectInstalledSkillPackage(skillRef, options)
  return inspection ? toManagementInspection(inspection) : null
}

async function toManagementInspection(
  inspection: InstalledSkillPackageInspection,
): Promise<InstalledSkillInspection> {
  return {
    schemaVersion: 1,
    lockKey: inspection.lockKey,
    name: inspection.name,
    scope: inspection.scope,
    status: inspection.status,
    statusMessage: inspection.statusMessage,
    installedRecord: inspection.installedRecord,
    lockRecord: inspection.lockRecord,
    ownerMarker: inspection.ownerMarker,
    package: inspection.package,
    securityReport: await createInspectionSecurityReport(inspection),
    checksum: {
      algorithm: inspection.integrity.algorithm,
      expectedSkillMd: inspection.integrity.expectedSkillMd,
      actualSkillMd: inspection.integrity.actualSkillMd,
      expectedPackageTree: inspection.integrity.expectedPackageTree,
      actualPackageTree: inspection.integrity.actualPackageTree,
      drifted: inspection.integrity.drifted,
      driftedPaths: inspection.integrity.driftedPaths,
    },
    errors: inspection.errors,
  }
}

async function createInspectionSecurityReport(
  inspection: InstalledSkillPackageInspection,
): Promise<SkillSecurityScanReport | null> {
  if (inspection.package) {
    return scanSkillPackage(inspection.package, {
      source: inspection.status === 'drifted' ? 'drifted' : 'installed',
      packageId: inspection.installedRecord.lockKey,
    })
  }
  if (inspection.status === 'installed' || inspection.status === 'disabled') {
    return null
  }
  return createIntegritySecurityReport({
    record: inspection.installedRecord,
    source: 'installed',
    ruleId: `inspection.${inspection.status}`,
    severity: inspection.status === 'missing-lock' ? 'medium' : 'high',
    message: inspection.statusMessage,
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
