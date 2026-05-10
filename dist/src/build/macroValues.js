import { readFileSync } from 'node:fs';
const defaultBuildTime = new Date().toISOString();
const defaultPackageVersion = readPackageVersion();
export const RECOVERY_MACRO_VALUES = Object.freeze({
    VERSION: process.env.CC_REFORGED_VERSION ?? defaultPackageVersion,
    BUILD_TIME: process.env.CC_REFORGED_BUILD_TIME ?? defaultBuildTime,
    PACKAGE_URL: process.env.CC_REFORGED_PACKAGE_URL ?? 'ccr-cli',
    NATIVE_PACKAGE_URL: process.env.CC_REFORGED_NATIVE_PACKAGE_URL ?? 'ccr-cli',
    FEEDBACK_CHANNEL: process.env.CC_REFORGED_FEEDBACK_CHANNEL ?? '#ccr',
    ISSUES_EXPLAINER: process.env.CC_REFORGED_ISSUES_EXPLAINER ??
        'open an issue against the recovery build maintainers',
    VERSION_CHANGELOG: process.env.CC_REFORGED_VERSION_CHANGELOG ?? '',
});
function readPackageVersion() {
    for (const relativePackageUrl of ['../../package.json', '../../../package.json']) {
        try {
            const packageJson = JSON.parse(readFileSync(new URL(relativePackageUrl, import.meta.url), 'utf8'));
            if (typeof packageJson.version === 'string' && packageJson.version.trim()) {
                return packageJson.version.trim();
            }
        }
        catch {
            // Try the next candidate. Source runs from src/build; built code runs
            // from dist/src/build or app.asar/dist/src/build.
        }
    }
    return '0.0.0-dev';
}
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