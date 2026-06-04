import { createHash } from 'crypto'
import { cp, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  loadSkillPackageForManifest,
  loadSkillPackageFromDir,
} from './installCandidates.js'
import {
  createCcrSkillInstallManifest,
  parseCcrSkillInstalledIndex,
  parseCcrSkillLockIndex,
  parseCcrSkillPackageOwnerMarker,
  parseSkillInstallResult,
  type CcrSkillInstalledIndex,
  type CcrSkillLockIndex,
  type SkillInstallResult,
} from './installManifest.js'
import {
  CCR_SKILL_PACKAGE_OWNER_MARKER_FILE,
  getCcrSkillInstallPaths,
} from './installPaths.js'
import type { SkillInstallPlan } from './installPlanner.js'
import { evaluateSkillSecurityPolicy } from './securityPolicy.js'
import { scanSkillPackage } from './securityScanner.js'

export type ApplySkillInstallPlanOptions = {
  confirmationToken: string
  securityOverrideToken?: string
  configHomeDir?: string
  now?: Date
}

export async function applySkillInstallPlan(
  plan: SkillInstallPlan,
  options: ApplySkillInstallPlanOptions,
): Promise<SkillInstallResult> {
  if (options.confirmationToken !== plan.confirmation.token) {
    throw new Error('Skill install confirmation token mismatch.')
  }
  const securityOverrideAccepted = isSecurityOverrideAccepted(plan, options)
  const nonSecurityConflicts = plan.conflicts.filter(
    conflict => conflict.kind !== 'security-blocked',
  )
  if (!plan.installable && !securityOverrideAccepted) {
    throw new Error(
      `Skill install plan is not installable: ${plan.conflicts
        .map(conflict => conflict.message)
        .join('; ')}`,
    )
  }
  if (nonSecurityConflicts.length > 0) {
    throw new Error(
      `Skill install plan has non-security conflicts: ${nonSecurityConflicts
        .map(conflict => conflict.message)
        .join('; ')}`,
    )
  }
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const packageDir = plan.writes.find(write => write.kind === 'package')?.path
  if (!packageDir) {
    throw new Error('Skill install plan missing package write.')
  }

  const liveSource = await loadSkillPackageForManifest({
    manifest: plan.manifestInput,
    configHomeDir: options.configHomeDir,
    risks: [],
  })
  const liveSourcePackage = liveSource.packagePreview
  const liveSecurityReport = await scanSkillPackage(liveSourcePackage, {
    source: 'candidate',
  })
  const liveSecurityDecision = evaluateSkillSecurityPolicy(liveSecurityReport, {
    overrideToken: options.securityOverrideToken,
  })
  if (!liveSecurityDecision.installAllowed) {
    throw new Error(
      `Skill install blocked by live security scan: ${liveSecurityDecision.reasons.join('; ')}`,
    )
  }

  await mkdir(dirname(packageDir), { recursive: true })
  await cp(liveSource.packageDir, packageDir, {
    recursive: true,
    errorOnExist: true,
    force: false,
  })

  const now = options.now ?? new Date()
  const lockKey = `${plan.scope}:${plan.name}`
  const ownerMarkerPath = join(packageDir, CCR_SKILL_PACKAGE_OWNER_MARKER_FILE)
  const ownerMarker = parseCcrSkillPackageOwnerMarker({
    schemaVersion: 1,
    packageId: lockKey,
    name: plan.name,
    installedAt: now.toISOString(),
    source: plan.manifestInput.source,
    owner: 'ccr-skill-installer',
  })
  await writeJson(ownerMarkerPath, ownerMarker)

  const warnings: string[] = [
    ...plan.risks,
    ...(securityOverrideAccepted ? ['Security override token accepted.'] : []),
  ]
  const skillPackage = await loadSkillPackageFromDir({
    skillDir: packageDir,
    originVendor: liveSource.originVendor,
    importedFrom: liveSource.importedFrom,
    legacyCommand: liveSource.legacyCommand,
    risks: warnings,
  })
  const skillFilePath = join(packageDir, 'SKILL.md')
  const checksum = await hashFileSha256(skillFilePath)
  const manifest = createCcrSkillInstallManifest(plan.manifestInput)

  const installedRecord = {
    schemaVersion: 1 as const,
    name: plan.name,
    scope: plan.scope,
    installedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    manifest,
    packageDir,
    skillFilePath,
    packageOwnerMarkerPath: ownerMarkerPath,
    enabled: manifest.defaults.enabled,
    modelInvocable: manifest.defaults.modelInvocable,
    userInvocable: manifest.defaults.userInvocable,
    lockKey,
  }
  const lockRecord = {
    name: plan.name,
    scope: plan.scope,
    sourceKind: manifest.source.kind,
    packageDir,
    skillFilePath,
    checksum: {
      algorithm: 'sha256' as const,
      skillMd: checksum,
    },
    originVendor: skillPackage.origin.vendor,
    updatedAt: now.toISOString(),
  }

  const installedIndex = await readInstalledIndex(paths.installedIndexPath)
  installedIndex.installed[lockKey] = installedRecord
  await writeJson(paths.installedIndexPath, installedIndex)

  const lockIndex = await readLockIndex(paths.lockFilePath)
  lockIndex.locks[lockKey] = lockRecord
  await writeJson(paths.lockFilePath, lockIndex)

  return parseSkillInstallResult({
    schemaVersion: 1,
    name: plan.name,
    scope: plan.scope,
    packageDir,
    installedRecord,
    lockRecord,
    package: skillPackage,
    warnings,
  })
}

function isSecurityOverrideAccepted(
  plan: SkillInstallPlan,
  options: ApplySkillInstallPlanOptions,
): boolean {
  return (
    plan.securityDecision.requiresOverride &&
    plan.securityDecision.overrideToken !== undefined &&
    options.securityOverrideToken === plan.securityDecision.overrideToken
  )
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

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${jsonStringify(value, null, 2)}\n`, 'utf8')
}

async function hashFileSha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

function getErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error != null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined
}
