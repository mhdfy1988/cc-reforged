import { applySkillManagementImportPlan, applySkillManagementInstallPlan, createSkillManagementImportPlan, createSkillManagementInstallPlan, inspectSkillManagementItem, listSkillManagementState, repairSkillManagementPackage, saveSkillManagementInstallManifest, searchSkillManagementInstallCandidates, setSkillManagementEnabled, setSkillManagementInvocation, uninstallSkillManagementPackage, } from '../services/skills/managementService.js';
export function listCoreSkillInstalls() {
    return listSkillManagementState();
}
export function inspectCoreSkill(input) {
    return inspectSkillManagementItem(input);
}
export function searchCoreSkillInstallCandidates(input = {}) {
    return searchSkillManagementInstallCandidates(input);
}
export function planCoreSkillInstall(input) {
    return createSkillManagementInstallPlan(input);
}
export function applyCoreSkillInstall(input) {
    return applySkillManagementInstallPlan(input);
}
export function planCoreSkillImport(input) {
    return createSkillManagementImportPlan(input);
}
export function applyCoreSkillImport(input) {
    return applySkillManagementImportPlan(input);
}
export function setCoreSkillEnabled(input) {
    return setSkillManagementEnabled(input);
}
export function setCoreSkillInvocation(input) {
    return setSkillManagementInvocation(input);
}
export function uninstallCoreSkill(input) {
    return uninstallSkillManagementPackage(input);
}
export function repairCoreSkill(input) {
    return repairSkillManagementPackage(input);
}
export function saveCoreSkillInstallManifest(input) {
    return saveSkillManagementInstallManifest(input);
}
//# sourceMappingURL=skillCore.js.map