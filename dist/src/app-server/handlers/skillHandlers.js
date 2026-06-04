import { SkillImportApplyParamsSchema, SkillImportPlanParamsSchema, SkillInspectParamsSchema, SkillInstallApplyParamsSchema, SkillInstallListParamsSchema, SkillInstallPlanParamsSchema, SkillInstallRepairParamsSchema, SkillInstallSaveManifestParamsSchema, SkillInstallSearchParamsSchema, SkillInstallUninstallParamsSchema, SkillSetEnabledParamsSchema, SkillSetInvocationParamsSchema, } from '../protocol.js';
export async function handleSkillInstallList(context, params) {
    SkillInstallListParamsSchema.parse(params ?? {});
    return context.core.skills.listInstalls();
}
export async function handleSkillInspect(context, params) {
    const parsedParams = SkillInspectParamsSchema.parse(params);
    return context.core.skills.inspect(parsedParams);
}
export async function handleSkillInstallSearch(context, params) {
    const parsedParams = SkillInstallSearchParamsSchema.parse(params ?? {});
    return context.core.skills.searchInstallCandidates(parsedParams);
}
export async function handleSkillInstallPlan(context, params) {
    const parsedParams = SkillInstallPlanParamsSchema.parse(params);
    return context.core.skills.planInstall(parsedParams);
}
export async function handleSkillInstallApply(context, params) {
    const parsedParams = SkillInstallApplyParamsSchema.parse(params);
    return context.core.skills.applyInstall(parsedParams);
}
export async function handleSkillImportPlan(context, params) {
    const parsedParams = SkillImportPlanParamsSchema.parse(params);
    return context.core.skills.planImport(parsedParams);
}
export async function handleSkillImportApply(context, params) {
    const parsedParams = SkillImportApplyParamsSchema.parse(params);
    return context.core.skills.applyImport(parsedParams);
}
export async function handleSkillSetEnabled(context, params) {
    const parsedParams = SkillSetEnabledParamsSchema.parse(params);
    return context.core.skills.setEnabled(parsedParams);
}
export async function handleSkillSetInvocation(context, params) {
    const parsedParams = SkillSetInvocationParamsSchema.parse(params);
    return context.core.skills.setInvocation(parsedParams);
}
export async function handleSkillInstallUninstall(context, params) {
    const parsedParams = SkillInstallUninstallParamsSchema.parse(params);
    return context.core.skills.uninstall(parsedParams);
}
export async function handleSkillInstallRepair(context, params) {
    const parsedParams = SkillInstallRepairParamsSchema.parse(params);
    return context.core.skills.repair(parsedParams);
}
export async function handleSkillInstallSaveManifest(context, params) {
    const parsedParams = SkillInstallSaveManifestParamsSchema.parse(params);
    return context.core.skills.saveInstallManifest(parsedParams);
}
//# sourceMappingURL=skillHandlers.js.map