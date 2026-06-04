import {
  applySkillManagementImportPlan,
  applySkillManagementInstallPlan,
  createSkillManagementImportPlan,
  createSkillManagementInstallPlan,
  inspectSkillManagementItem,
  listSkillManagementState,
  repairSkillManagementPackage,
  saveSkillManagementInstallManifest,
  searchSkillManagementInstallCandidates,
  setSkillManagementEnabled,
  setSkillManagementInvocation,
  uninstallSkillManagementPackage,
  type SkillConfirmedInput,
  type SkillEnabledInput,
  type SkillImportApplyInput,
  type SkillImportPlanInput,
  type SkillInstallApplyInput,
  type SkillInstallPlanInput,
  type SkillInvocationInput,
  type SkillManifestSaveInput,
  type SkillStateRefInput,
} from '../services/skills/managementService.js'

export function listCoreSkillInstalls(): Promise<Record<string, unknown>> {
  return listSkillManagementState()
}

export function inspectCoreSkill(
  input: SkillStateRefInput,
): Promise<Record<string, unknown>> {
  return inspectSkillManagementItem(input)
}

export function searchCoreSkillInstallCandidates(
  input: { query?: string } = {},
): Promise<Record<string, unknown>> {
  return searchSkillManagementInstallCandidates(input)
}

export function planCoreSkillInstall(
  input: SkillInstallPlanInput,
): Promise<Record<string, unknown>> {
  return createSkillManagementInstallPlan(input)
}

export function applyCoreSkillInstall(
  input: SkillInstallApplyInput,
): Promise<Record<string, unknown>> {
  return applySkillManagementInstallPlan(input)
}

export function planCoreSkillImport(
  input: SkillImportPlanInput,
): Promise<Record<string, unknown>> {
  return createSkillManagementImportPlan(input)
}

export function applyCoreSkillImport(
  input: SkillImportApplyInput,
): Promise<Record<string, unknown>> {
  return applySkillManagementImportPlan(input)
}

export function setCoreSkillEnabled(
  input: SkillEnabledInput,
): Promise<Record<string, unknown>> {
  return setSkillManagementEnabled(input)
}

export function setCoreSkillInvocation(
  input: SkillInvocationInput,
): Promise<Record<string, unknown>> {
  return setSkillManagementInvocation(input)
}

export function uninstallCoreSkill(
  input: SkillConfirmedInput,
): Promise<Record<string, unknown>> {
  return uninstallSkillManagementPackage(input)
}

export function repairCoreSkill(
  input: SkillConfirmedInput,
): Promise<Record<string, unknown>> {
  return repairSkillManagementPackage(input)
}

export function saveCoreSkillInstallManifest(
  input: SkillManifestSaveInput,
): Promise<Record<string, unknown>> {
  return saveSkillManagementInstallManifest(input)
}
