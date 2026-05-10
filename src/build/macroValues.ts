import { readFileSync } from 'node:fs'

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
const defaultPackageVersion = readPackageVersion()

export const RECOVERY_MACRO_VALUES: RecoveryMacroValues = Object.freeze({
  VERSION: process.env.CC_REFORGED_VERSION ?? defaultPackageVersion,
  BUILD_TIME: process.env.CC_REFORGED_BUILD_TIME ?? defaultBuildTime,
  PACKAGE_URL: process.env.CC_REFORGED_PACKAGE_URL ?? 'ccr-cli',
  NATIVE_PACKAGE_URL: process.env.CC_REFORGED_NATIVE_PACKAGE_URL ?? 'ccr-cli',
  FEEDBACK_CHANNEL: process.env.CC_REFORGED_FEEDBACK_CHANNEL ?? '#ccr',
  ISSUES_EXPLAINER:
    process.env.CC_REFORGED_ISSUES_EXPLAINER ??
    'open an issue against the recovery build maintainers',
  VERSION_CHANGELOG: process.env.CC_REFORGED_VERSION_CHANGELOG ?? '',
})

function readPackageVersion(): string {
  for (const relativePackageUrl of ['../../package.json', '../../../package.json']) {
    try {
      const packageJson = JSON.parse(
        readFileSync(new URL(relativePackageUrl, import.meta.url), 'utf8'),
      ) as { version?: unknown }
      if (typeof packageJson.version === 'string' && packageJson.version.trim()) {
        return packageJson.version.trim()
      }
    } catch {
      // Try the next candidate. Source runs from src/build; built code runs
      // from dist/src/build or app.asar/dist/src/build.
    }
  }

  return '0.0.0-dev'
}

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
