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
  summarizeCcrSkillInstallManifest,
  type CcrSkillInstallManifest,
  type CcrSkillInstallManifestInput,
} from './installManifest.js'
import {
  getCcrSkillInstallPaths,
} from './installPaths.js'
import { createSkillInstallPlan } from './installPlanner.js'
import {
  summarizeSecurityReportRisks,
} from './securityPolicy.js'
import { scanSkillPackage } from './securityScanner.js'
import { createSkillManagementCapabilityCatalog } from './capabilityProvider.js'
import {
  addCandidateDigest,
  addInspectionDigest,
  addPlanDigest,
  isProblemInspectionStatus,
} from './managementDtos.js'
import {
  assertPackageOwnership,
  findInstalledEntry,
  isSkillNameInstalled,
  saveSkillInstallManifestFile,
  uninstallInstalledSkillPackage,
  updateInstalledRecord,
} from './managementStore.js'
import { readInstalledIndex } from './installTransaction.js'

export type SkillManagementOptions = {
  configHomeDir?: string
  cwd?: string
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
  const capabilityCatalog = await createSkillManagementCapabilityCatalog({
    cwd: options.cwd ?? process.cwd(),
    configHomeDir: options.configHomeDir,
    installed: normalizedInstalled,
  })
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
      totalCapabilities: capabilityCatalog.capabilities.length,
      totalCandidates: (search.candidates as unknown[]).length,
      problemCount,
    },
    capabilities: capabilityCatalog.capabilities,
    candidates: search.candidates,
    candidateErrors: search.errors,
    sources: search.sources,
    runtimeDiagnostics: capabilityCatalog.diagnostics,
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
  const removed = await uninstallInstalledSkillPackage(
    { skillRef: input.skillRef },
    options,
  )
  await clearSkillRuntimeCaches()

  return {
    schemaVersion: 1,
    uninstalled: true,
    name: removed.name,
    lockKey: removed.lockKey,
    removedPackageDir: removed.removedPackageDir,
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
  return saveSkillInstallManifestFile(
    { manifest, overwrite: input.overwrite },
    options,
  )
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

async function clearSkillRuntimeCaches(): Promise<void> {
  const [{ clearSkillCaches }, { clearCommandMemoizationCaches }] =
    await Promise.all([
      import('../../skills/loadSkillsDir.js'),
      import('../../commands.js'),
    ])
  clearSkillCaches()
  clearCommandMemoizationCaches()
}
