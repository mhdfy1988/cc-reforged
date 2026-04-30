export type RecoveryMacroValues = {
  VERSION: string
  BUILD_TIME?: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL?: string
  FEEDBACK_CHANNEL?: string
  ISSUES_EXPLAINER?: string
  VERSION_CHANGELOG?: string
}

const defaultBuildTime = new Date().toISOString()

export const RECOVERY_MACRO_VALUES: RecoveryMacroValues = Object.freeze({
  VERSION: process.env.CC_REFORGED_VERSION ?? '0.3',
  BUILD_TIME: process.env.CC_REFORGED_BUILD_TIME ?? defaultBuildTime,
  PACKAGE_URL: process.env.CC_REFORGED_PACKAGE_URL ?? 'ccr-cli',
  NATIVE_PACKAGE_URL: process.env.CC_REFORGED_NATIVE_PACKAGE_URL ?? 'ccr-cli',
  FEEDBACK_CHANNEL: process.env.CC_REFORGED_FEEDBACK_CHANNEL ?? '#ccr',
  ISSUES_EXPLAINER:
    process.env.CC_REFORGED_ISSUES_EXPLAINER ??
    'open an issue against the recovery build maintainers',
  VERSION_CHANGELOG: process.env.CC_REFORGED_VERSION_CHANGELOG ?? '',
})

type GlobalWithMacro = typeof globalThis & {
  MACRO?: RecoveryMacroValues
}

export function installRecoveryMacroGlobals(
  target: GlobalWithMacro = globalThis as GlobalWithMacro,
): RecoveryMacroValues {
  if (!target.MACRO) {
    Object.defineProperty(target, 'MACRO', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: RECOVERY_MACRO_VALUES,
    })
  }

  return target.MACRO
}

export function getRecoveryMacroValue<K extends keyof RecoveryMacroValues>(
  key: K,
): RecoveryMacroValues[K] {
  return RECOVERY_MACRO_VALUES[key]
}
