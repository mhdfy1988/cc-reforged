import {
  SkillImportApplyParamsSchema,
  SkillImportPlanParamsSchema,
  SkillInspectParamsSchema,
  SkillInstallApplyParamsSchema,
  SkillInstallListParamsSchema,
  SkillInstallPlanParamsSchema,
  SkillInstallRepairParamsSchema,
  SkillInstallSaveManifestParamsSchema,
  SkillInstallSearchParamsSchema,
  SkillInstallUninstallParamsSchema,
  SkillSetEnabledParamsSchema,
  SkillSetInvocationParamsSchema,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'

type SkillCore = AppServerContext['core']['skills']

export async function handleSkillInstallList(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  SkillInstallListParamsSchema.parse(params ?? {})
  return context.core.skills.listInstalls()
}

export async function handleSkillInspect(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillInspectParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['inspect']>[0]
  return context.core.skills.inspect(parsedParams)
}

export async function handleSkillInstallSearch(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillInstallSearchParamsSchema.parse(
    params ?? {},
  ) as Parameters<SkillCore['searchInstallCandidates']>[0]
  return context.core.skills.searchInstallCandidates(parsedParams)
}

export async function handleSkillInstallPlan(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillInstallPlanParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['planInstall']>[0]
  return context.core.skills.planInstall(parsedParams)
}

export async function handleSkillInstallApply(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillInstallApplyParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['applyInstall']>[0]
  return context.core.skills.applyInstall(parsedParams)
}

export async function handleSkillImportPlan(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillImportPlanParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['planImport']>[0]
  return context.core.skills.planImport(parsedParams)
}

export async function handleSkillImportApply(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillImportApplyParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['applyImport']>[0]
  return context.core.skills.applyImport(parsedParams)
}

export async function handleSkillSetEnabled(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillSetEnabledParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['setEnabled']>[0]
  return context.core.skills.setEnabled(parsedParams)
}

export async function handleSkillSetInvocation(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillSetInvocationParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['setInvocation']>[0]
  return context.core.skills.setInvocation(parsedParams)
}

export async function handleSkillInstallUninstall(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillInstallUninstallParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['uninstall']>[0]
  return context.core.skills.uninstall(parsedParams)
}

export async function handleSkillInstallRepair(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillInstallRepairParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['repair']>[0]
  return context.core.skills.repair(parsedParams)
}

export async function handleSkillInstallSaveManifest(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SkillInstallSaveManifestParamsSchema.parse(
    params,
  ) as Parameters<SkillCore['saveInstallManifest']>[0]
  return context.core.skills.saveInstallManifest(parsedParams)
}
