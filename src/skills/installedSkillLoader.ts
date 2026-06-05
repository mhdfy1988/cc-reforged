import {
  listInstalledSkillPackageInspections,
  type InstalledSkillPackageInspection,
  type InstalledSkillPackageInspectionStatus,
} from '../services/skills/installedPackageInspection.js'
import type { CcrSkillPackage } from './model.js'
import { parseCcrSkillPackage } from './packageSchema.js'
import {
  evaluateInstalledSkillActivation,
  type SkillActivationDiagnostic,
  type SkillActivationResult,
} from './skillActivationPolicy.js'

export type InstalledSkillRuntimeStatus = InstalledSkillPackageInspectionStatus
export type InstalledSkillRuntimeInspection = InstalledSkillPackageInspection

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
  const inspectionResult = await listInstalledSkillPackageInspections(options)
  const entries: InstalledSkillRuntimeEntry[] = []
  const diagnostics: SkillActivationDiagnostic[] = []

  for (const inspection of inspectionResult.installed) {
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
    inspections: inspectionResult.installed,
    diagnostics,
    summary: inspectionResult.summary,
  }
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

function getInstalledSourcePath(
  record: InstalledSkillRuntimeInspection['installedRecord'],
): string {
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
