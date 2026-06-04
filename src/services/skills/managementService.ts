import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getLastSkillRuntimeCatalogDiagnostics } from '../../skills/skillRuntimeCatalog.js'
import { discoverSkillImportCandidate } from './importDiscovery.js'
import { applySkillImportPlan } from './importManager.js'
import { createSkillImportPlan } from './importPlanner.js'
import {
  parseSkillImportSource,
  type SkillImportSourceInput,
} from './importSource.js'
import {
  loadSkillPackageForManifest,
  type SkillInstallCandidate,
} from './installCandidates.js'
import { inspectInstalledSkill, listInstalledSkills } from './installInspector.js'
import { applySkillInstallPlan } from './installManager.js'
import {
  createCcrSkillInstallManifest,
  parseCcrSkillInstallManifest,
  parseCcrSkillInstalledIndex,
  parseCcrSkillLockIndex,
  parseCcrSkillPackageOwnerMarker,
  summarizeCcrSkillInstallManifest,
  type CcrSkillInstalledIndex,
  type CcrSkillInstalledRecord,
  type CcrSkillInstallManifest,
  type CcrSkillInstallManifestInput,
  type CcrSkillLockIndex,
} from './installManifest.js'
import {
  getCcrSkillInstallPaths,
} from './installPaths.js'
import { createSkillInstallPlan } from './installPlanner.js'
import {
  summarizeSecurityReportRisks,
} from './securityPolicy.js'
import {
  summarizeSkillSecurityDecision,
  summarizeSkillSecurityReport,
} from './securityReporter.js'
import { scanSkillPackage } from './securityScanner.js'
import type {
  SkillSecurityPolicyDecision,
  SkillSecurityScanReport,
} from './securitySchema.js'

export type SkillManagementOptions = {
  configHomeDir?: string
}

export type SkillInstallPlanInput = {
  manifest: CcrSkillInstallManifestInput
  scope?: 'user' | 'project'
  force?: boolean
  securityOverrideToken?: string
}

export type SkillInstallApplyInput = SkillInstallPlanInput & {
  confirmed: boolean
  confirmationToken: string
}

export type SkillImportPlanInput = {
  source: SkillImportSourceInput
}

export type SkillImportApplyInput = SkillImportPlanInput & {
  confirmed: boolean
  confirmationToken: string
}

export type SkillStateRefInput = {
  skillRef: string
}

export type SkillEnabledInput = SkillStateRefInput & {
  enabled: boolean
}

export type SkillInvocationInput = SkillStateRefInput & {
  modelInvocable?: boolean
  userInvocable?: boolean
}

export type SkillConfirmedInput = SkillStateRefInput & {
  confirmed: boolean
}

export type SkillManifestSaveInput = {
  manifest: CcrSkillInstallManifestInput
  overwrite?: boolean
}

export async function listSkillManagementState(
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  const [installed, search] = await Promise.all([
    listInstalledSkills(options),
    searchSkillManagementInstallCandidates({}, options),
  ])
  const normalizedInstalled = installed.installed.map(addInspectionDigest)
  const problemCount = normalizedInstalled.filter(item =>
    isProblemInspectionStatus(String(item.status)),
  ).length

  return {
    schemaVersion: 1,
    installPaths: getCcrSkillInstallPaths(options.configHomeDir),
    installed: normalizedInstalled,
    summary: {
      ...installed.summary,
      totalInstalled: normalizedInstalled.length,
      totalCandidates: (search.candidates as unknown[]).length,
      problemCount,
    },
    candidates: search.candidates,
    candidateErrors: search.errors,
    sources: search.sources,
    runtimeDiagnostics: getLastSkillRuntimeCatalogDiagnostics(),
  }
}

export async function inspectSkillManagementItem(
  input: SkillStateRefInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  const inspection = await inspectInstalledSkill(input.skillRef, options)
  return {
    schemaVersion: 1,
    skillRef: input.skillRef,
    found: inspection !== null,
    inspection: inspection ? addInspectionDigest(inspection) : null,
  }
}

export async function searchSkillManagementInstallCandidates(
  input: { query?: string } = {},
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  const { searchSkillInstallCandidates } = await import('./installCandidates.js')
  const result = await searchSkillInstallCandidates({
    query: input.query,
    configHomeDir: options.configHomeDir,
  })
  return {
    ...result,
    candidates: result.candidates.map(addCandidateDigest),
  }
}

export async function createSkillManagementInstallPlan(
  input: SkillInstallPlanInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  const candidate = await createCandidateFromManifestInput(input.manifest, {
    configHomeDir: options.configHomeDir,
    scope: input.scope,
  })
  const plan = createSkillInstallPlan(candidate, {
    configHomeDir: options.configHomeDir,
    force: input.force,
    securityOverrideToken: input.securityOverrideToken,
  })
  return addPlanDigest(plan)
}

export async function applySkillManagementInstallPlan(
  input: SkillInstallApplyInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new Error('Skill install requires explicit user confirmation.')
  }
  const candidate = await createCandidateFromManifestInput(input.manifest, {
    configHomeDir: options.configHomeDir,
    scope: input.scope,
  })
  const plan = createSkillInstallPlan(candidate, {
    configHomeDir: options.configHomeDir,
    force: input.force,
    securityOverrideToken: input.securityOverrideToken,
  })
  const result = await applySkillInstallPlan(plan, {
    configHomeDir: options.configHomeDir,
    confirmationToken: input.confirmationToken,
    securityOverrideToken: input.securityOverrideToken,
  })
  await clearSkillRuntimeCaches()
  return {
    schemaVersion: 1,
    result,
    inspection: addInspectionDigest(
      (await inspectInstalledSkill(result.lockRecord.name, options))!,
    ),
  }
}

export async function createSkillManagementImportPlan(
  input: SkillImportPlanInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  const source = parseSkillImportSource(input.source)
  const discovered = await discoverSkillImportCandidate(source)
  if (discovered.success === false) {
    throw new Error(discovered.error.message)
  }
  return createSkillImportPlan(discovered.candidate, {
    configHomeDir: options.configHomeDir,
  })
}

export async function applySkillManagementImportPlan(
  input: SkillImportApplyInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new Error('Skill import requires explicit user confirmation.')
  }
  const source = parseSkillImportSource(input.source)
  const discovered = await discoverSkillImportCandidate(source)
  if (discovered.success === false) {
    throw new Error(discovered.error.message)
  }
  const plan = createSkillImportPlan(discovered.candidate, {
    configHomeDir: options.configHomeDir,
  })
  const result = await applySkillImportPlan(plan, {
    configHomeDir: options.configHomeDir,
    confirmationToken: input.confirmationToken,
  })
  return {
    schemaVersion: 1,
    result,
    search: await searchSkillManagementInstallCandidates({}, options),
  }
}

export async function setSkillManagementEnabled(
  input: SkillEnabledInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  await updateInstalledRecord(input.skillRef, options, record => {
    record.enabled = input.enabled
    record.manifest.defaults.enabled = input.enabled
  })
  await clearSkillRuntimeCaches()
  return inspectSkillManagementItem(input, options)
}

export async function setSkillManagementInvocation(
  input: SkillInvocationInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  if (
    input.modelInvocable === undefined &&
    input.userInvocable === undefined
  ) {
    throw new Error('Skill invocation update requires at least one field.')
  }
  await updateInstalledRecord(input.skillRef, options, record => {
    if (input.modelInvocable !== undefined) {
      record.modelInvocable = input.modelInvocable
      record.manifest.defaults.modelInvocable = input.modelInvocable
    }
    if (input.userInvocable !== undefined) {
      record.userInvocable = input.userInvocable
      record.manifest.defaults.userInvocable = input.userInvocable
    }
  })
  await clearSkillRuntimeCaches()
  return inspectSkillManagementItem(input, options)
}

export async function uninstallSkillManagementPackage(
  input: SkillConfirmedInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new Error('Skill uninstall requires explicit user confirmation.')
  }
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const [installedIndex, lockIndex] = await Promise.all([
    readInstalledIndex(paths.installedIndexPath),
    readLockIndex(paths.lockFilePath),
  ])
  const match = findInstalledEntry(installedIndex, input.skillRef)
  if (!match) {
    throw new Error(`Skill install record was not found: ${input.skillRef}`)
  }
  const { lockKey, record } = match
  await assertPackageOwnership(record)

  await rm(record.packageDir, { recursive: true, force: true })
  delete installedIndex.installed[lockKey]
  delete lockIndex.locks[record.lockKey]
  await Promise.all([
    writeJson(paths.installedIndexPath, installedIndex),
    writeJson(paths.lockFilePath, lockIndex),
  ])
  await clearSkillRuntimeCaches()

  return {
    schemaVersion: 1,
    uninstalled: true,
    name: record.name,
    lockKey,
    removedPackageDir: record.packageDir,
    installed: await listSkillManagementState(options),
  }
}

export async function repairSkillManagementPackage(
  input: SkillConfirmedInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new Error('Skill repair requires explicit user confirmation.')
  }
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const installedIndex = await readInstalledIndex(paths.installedIndexPath)
  const match = findInstalledEntry(installedIndex, input.skillRef)
  if (!match) {
    throw new Error(`Skill install record was not found: ${input.skillRef}`)
  }
  const { record } = match
  if (
    record.manifest.source.kind !== 'imported-skill' &&
    record.manifest.source.kind !== 'builtin-preset'
  ) {
    throw new Error(
      `Skill repair currently supports imported-skill and builtin-preset sources only: ${record.name}`,
    )
  }
  await assertPackageOwnership(record)
  await rm(record.packageDir, { recursive: true, force: true })

  const candidate = await createCandidateFromManifest(record.manifest, {
    configHomeDir: options.configHomeDir,
    ignoreInstalled: true,
  })
  const plan = createSkillInstallPlan(candidate, {
    configHomeDir: options.configHomeDir,
    force: true,
  })
  const result = await applySkillInstallPlan(plan, {
    configHomeDir: options.configHomeDir,
    confirmationToken: plan.confirmation.token,
  })
  await clearSkillRuntimeCaches()
  return {
    schemaVersion: 1,
    repaired: true,
    result,
    inspection: addInspectionDigest(
      (await inspectInstalledSkill(record.name, options))!,
    ),
  }
}

export async function saveSkillManagementInstallManifest(
  input: SkillManifestSaveInput,
  options: SkillManagementOptions = {},
): Promise<Record<string, unknown>> {
  const manifest = parseCcrSkillInstallManifest(input.manifest)
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const manifestPath = join(
    paths.manifestsDir,
    `${sanitizeManifestFileName(manifest.name)}.json`,
  )
  if (!input.overwrite && existsSync(manifestPath)) {
    throw new Error(`Skill install manifest already exists: ${manifestPath}`)
  }
  await writeJson(manifestPath, manifest)
  return {
    schemaVersion: 1,
    saved: true,
    name: manifest.name,
    path: manifestPath,
    manifest: summarizeCcrSkillInstallManifest(manifest),
  }
}

async function createCandidateFromManifestInput(
  input: CcrSkillInstallManifestInput,
  options: {
    configHomeDir?: string
    scope?: 'user' | 'project'
  } = {},
): Promise<SkillInstallCandidate> {
  const parsed = parseCcrSkillInstallManifest(input)
  const manifest =
    options.scope && options.scope !== parsed.targetScope
      ? createCcrSkillInstallManifest({
          ...parsed,
          targetScope: options.scope,
        })
      : parsed
  return createCandidateFromManifest(manifest, options)
}

async function createCandidateFromManifest(
  manifest: CcrSkillInstallManifest,
  options: {
    configHomeDir?: string
    ignoreInstalled?: boolean
  } = {},
): Promise<SkillInstallCandidate> {
  const risks: string[] = []
  const { packagePreview } = await loadSkillPackageForManifest({
    manifest,
    configHomeDir: options.configHomeDir,
    risks,
  })
  const securityReport = await scanSkillPackage(packagePreview, {
    source: 'candidate',
  })
  risks.push(...summarizeSecurityReportRisks(securityReport))

  const state =
    options.ignoreInstalled ||
    !(await isSkillNameInstalled(manifest.name, options.configHomeDir))
      ? 'available'
      : 'installed'

  const originPath =
    manifest.source.kind === 'builtin-preset'
      ? `builtin-preset:${manifest.source.presetId}`
      : manifest.source.path
  return {
    candidateId: `${manifest.source.kind}:${originPath}`,
    sourceType: manifest.source.kind,
    sourceLabel: 'Skill 安装配置',
    originPath,
    state,
    stateMessage: state === 'installed' ? '已安装' : '可安装',
    duplicateGroupCount: 1,
    manifest: summarizeCcrSkillInstallManifest(manifest),
    manifestInput: manifest,
    packagePreview,
    securityReport,
    displayName: manifest.displayName ?? packagePreview.displayName ?? manifest.name,
    description: manifest.description ?? packagePreview.description,
    trusted: !manifest.trust.thirdParty,
    risks,
  }
}

async function isSkillNameInstalled(
  name: string,
  configHomeDir?: string,
): Promise<boolean> {
  const paths = getCcrSkillInstallPaths(configHomeDir)
  const installedIndex = await readInstalledIndex(paths.installedIndexPath)
  return Object.values(installedIndex.installed).some(
    record => record.name === name,
  )
}

function addCandidateDigest(candidate: SkillInstallCandidate) {
  return {
    ...candidate,
    securityDigest: summarizeSkillSecurityReport(candidate.securityReport),
  }
}

function addPlanDigest<T extends { securityDecision?: unknown; securityReport?: unknown }>(
  plan: T,
): T & { securityDigest: unknown } {
  const decision = plan.securityDecision
  if (isSecurityDecision(decision)) {
    return {
      ...plan,
      securityDigest: summarizeSkillSecurityDecision(decision),
    }
  }
  if (isSecurityReport(plan.securityReport)) {
    return {
      ...plan,
      securityDigest: summarizeSkillSecurityReport(plan.securityReport),
    }
  }
  return {
    ...plan,
    securityDigest: null,
  }
}

function addInspectionDigest<T extends { securityReport: unknown }>(
  inspection: T,
): T & { securityDigest: unknown } {
  return {
    ...inspection,
    securityDigest: isSecurityReport(inspection.securityReport)
      ? summarizeSkillSecurityReport(inspection.securityReport)
      : null,
  }
}

function isSecurityDecision(
  value: unknown,
): value is SkillSecurityPolicyDecision {
  return Boolean(value && typeof value === 'object' && 'installAllowed' in value)
}

function isSecurityReport(value: unknown): value is SkillSecurityScanReport {
  return Boolean(value && typeof value === 'object' && 'summary' in value)
}

async function updateInstalledRecord(
  skillRef: string,
  options: SkillManagementOptions,
  mutate: (record: CcrSkillInstalledRecord) => void,
): Promise<void> {
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const installedIndex = await readInstalledIndex(paths.installedIndexPath)
  const match = findInstalledEntry(installedIndex, skillRef)
  if (!match) {
    throw new Error(`Skill install record was not found: ${skillRef}`)
  }
  mutate(match.record)
  match.record.updatedAt = new Date().toISOString()
  installedIndex.installed[match.lockKey] = match.record
  await writeJson(paths.installedIndexPath, installedIndex)
}

function findInstalledEntry(
  installedIndex: CcrSkillInstalledIndex,
  skillRef: string,
): { lockKey: string; record: CcrSkillInstalledRecord } | null {
  for (const [lockKey, record] of Object.entries(installedIndex.installed)) {
    if (lockKey === skillRef || record.lockKey === skillRef || record.name === skillRef) {
      return { lockKey, record }
    }
  }
  return null
}

async function assertPackageOwnership(
  record: CcrSkillInstalledRecord,
): Promise<void> {
  if (!existsSync(record.packageDir)) {
    return
  }
  const marker = parseCcrSkillPackageOwnerMarker(
    JSON.parse(await readFile(record.packageOwnerMarkerPath, 'utf8')),
  )
  if (
    marker.owner !== 'ccr-skill-installer' ||
    marker.packageId !== record.lockKey ||
    marker.name !== record.name
  ) {
    throw new Error(
      `Skill package is not owned by CCR installer: ${record.packageDir}`,
    )
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

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${jsonStringify(value, null, 2)}\n`, 'utf8')
}

function sanitizeManifestFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

function isProblemInspectionStatus(status: string): boolean {
  return (
    status === 'missing-package' ||
    status === 'missing-skill-md' ||
    status === 'missing-owner-marker' ||
    status === 'missing-lock' ||
    status === 'drifted' ||
    status === 'invalid'
  )
}

function getErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error != null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined
}

async function clearSkillRuntimeCaches(): Promise<void> {
  const [{ clearSkillCaches }, { clearCommandMemoizationCaches }] =
    await Promise.all([
      import('../../skills/loadSkillsDir.js'),
      import('../../commands.js'),
    ])
  clearSkillCaches()
  clearCommandMemoizationCaches()
}
