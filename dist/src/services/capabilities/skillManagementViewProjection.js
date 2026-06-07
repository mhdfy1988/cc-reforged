export function createSkillManagementViewItems(input) {
    const installedByRef = createInstalledSkillInspectionRefMap(input.installed ?? []);
    return (input.management?.skills ?? [])
        .map(capability => ({
        capability,
        inspection: findInstalledSkillInspection(capability, installedByRef),
        actionRef: capability.actionRef ?? capability.relations.installedRef ?? null,
        allowedActions: [...capability.allowedActions],
    }))
        .sort(compareSkillManagementViewItems);
}
export function hasSkillManagementAction(item, action) {
    return item.allowedActions.includes(action);
}
export function getSkillManagementActionRef(item, action) {
    if (!hasSkillManagementAction(item, action))
        return null;
    return item.actionRef;
}
export function getSkillManagementToggleEnabledTarget(item) {
    const action = item.capability.state.enabled ? 'disable' : 'enable';
    const skillRef = getSkillManagementActionRef(item, action);
    if (!skillRef)
        return null;
    return {
        skillRef,
        enabled: !item.capability.state.enabled,
    };
}
function createInstalledSkillInspectionRefMap(installed) {
    const installedByRef = new Map();
    for (const inspection of installed) {
        addInstalledSkillInspectionRef(installedByRef, inspection.lockKey, inspection);
        addInstalledSkillInspectionRef(installedByRef, inspection.installedRecord?.lockKey, inspection);
    }
    return installedByRef;
}
function addInstalledSkillInspectionRef(installedByRef, ref, inspection) {
    if (!ref)
        return;
    if (!installedByRef.has(ref)) {
        installedByRef.set(ref, inspection);
    }
}
function findInstalledSkillInspection(capability, installedByRef) {
    const installedRef = capability.relations.installedRef ?? capability.actionRef;
    if (!installedRef)
        return null;
    return installedByRef.get(installedRef) ?? null;
}
function compareSkillManagementViewItems(a, b) {
    const attentionDiff = getSkillManagementAttentionRank(a) - getSkillManagementAttentionRank(b);
    if (attentionDiff !== 0)
        return attentionDiff;
    const sourceDiff = getSkillManagementSourceRank(a.capability.source.kind) -
        getSkillManagementSourceRank(b.capability.source.kind);
    if (sourceDiff !== 0)
        return sourceDiff;
    return a.capability.displayName.localeCompare(b.capability.displayName);
}
function getSkillManagementAttentionRank(item) {
    if (item.capability.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
        return 0;
    }
    if (item.inspection?.status &&
        !['installed', 'disabled'].includes(item.inspection.status)) {
        return 1;
    }
    if (item.capability.diagnostics.some(diagnostic => diagnostic.severity === 'warning')) {
        return 2;
    }
    if (!item.capability.state.runtimeVisible)
        return 3;
    return 4;
}
function getSkillManagementSourceRank(sourceKind) {
    switch (sourceKind) {
        case 'managed-skill':
            return 0;
        case 'user-skill':
            return 1;
        case 'project-skill':
            return 2;
        case 'plugin':
            return 3;
        case 'mcp':
            return 4;
        case 'dynamic':
            return 5;
        case 'bundled':
            return 6;
        default:
            return 7;
    }
}
//# sourceMappingURL=skillManagementViewProjection.js.map