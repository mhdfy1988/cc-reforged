const defaultBuildTime = new Date().toISOString();
export const RECOVERY_MACRO_VALUES = Object.freeze({
    VERSION: process.env.CC_REFORGED_VERSION ?? '0.4',
    BUILD_TIME: process.env.CC_REFORGED_BUILD_TIME ?? defaultBuildTime,
    PACKAGE_URL: process.env.CC_REFORGED_PACKAGE_URL ?? 'ccr-cli',
    NATIVE_PACKAGE_URL: process.env.CC_REFORGED_NATIVE_PACKAGE_URL ?? 'ccr-cli',
    FEEDBACK_CHANNEL: process.env.CC_REFORGED_FEEDBACK_CHANNEL ?? '#ccr',
    ISSUES_EXPLAINER: process.env.CC_REFORGED_ISSUES_EXPLAINER ??
        'open an issue against the recovery build maintainers',
    VERSION_CHANGELOG: process.env.CC_REFORGED_VERSION_CHANGELOG ?? '',
});
export function installRecoveryMacroGlobals(target = globalThis) {
    if (!target.MACRO) {
        Object.defineProperty(target, 'MACRO', {
            configurable: true,
            enumerable: false,
            writable: false,
            value: RECOVERY_MACRO_VALUES,
        });
    }
    return target.MACRO;
}
export function getRecoveryMacroValue(key) {
    return RECOVERY_MACRO_VALUES[key];
}
//# sourceMappingURL=macroValues.js.map