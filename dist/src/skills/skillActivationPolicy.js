export function evaluateInstalledSkillActivation(inspection) {
    const diagnostics = [];
    const record = inspection.installedRecord;
    if (!isRuntimeIntegrityOk(inspection.status)) {
        diagnostics.push({
            kind: 'runtime-hidden',
            reason: 'integrity-status',
            lockKey: inspection.lockKey,
            name: inspection.name,
            status: inspection.status,
            message: `Installed skill is hidden from runtime because inspection status is ${inspection.status}.`,
        });
        return {
            runtimeVisible: false,
            modelInvocable: false,
            userInvocable: false,
            diagnostics,
        };
    }
    if (!inspection.package) {
        diagnostics.push({
            kind: 'runtime-hidden',
            reason: 'missing-package',
            lockKey: inspection.lockKey,
            name: inspection.name,
            status: inspection.status,
            message: `Installed skill is hidden from runtime because no normalized package is available.`,
        });
        return {
            runtimeVisible: false,
            modelInvocable: false,
            userInvocable: false,
            diagnostics,
        };
    }
    if (!record.enabled) {
        diagnostics.push({
            kind: 'runtime-hidden',
            reason: 'disabled',
            lockKey: inspection.lockKey,
            name: inspection.name,
            status: inspection.status,
            message: `Installed skill is disabled: ${inspection.name}.`,
        });
        return {
            runtimeVisible: false,
            modelInvocable: false,
            userInvocable: false,
            diagnostics,
        };
    }
    const modelInvocable = record.modelInvocable;
    const userInvocable = record.userInvocable;
    if (!modelInvocable && !userInvocable) {
        diagnostics.push({
            kind: 'runtime-hidden',
            reason: 'no-invocation-surface',
            lockKey: inspection.lockKey,
            name: inspection.name,
            status: inspection.status,
            message: `Installed skill has both model and user invocation disabled: ${inspection.name}.`,
        });
    }
    return {
        runtimeVisible: modelInvocable || userInvocable,
        modelInvocable,
        userInvocable,
        diagnostics,
    };
}
export function isRuntimeIntegrityOk(status) {
    return status === 'installed' || status === 'disabled';
}
//# sourceMappingURL=skillActivationPolicy.js.map