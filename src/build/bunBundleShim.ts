import { installRecoveryMacroGlobals } from './macroValues.js'
import {
  feature as readFeatureFlag,
  getEnabledRecoveryFeatures,
  RECOVERY_FEATURE_FLAGS,
  type RecoveryFeatureFlagName,
} from './featureFlags.js'

// Best-effort recovery behavior: most build-gated entrypoints import
// bun:bundle early, so install the fallback macro globals here to make
// recovery builds less brittle before the full runtime bootstrap exists.
installRecoveryMacroGlobals()

export { RECOVERY_FEATURE_FLAGS, getEnabledRecoveryFeatures }
export type { RecoveryFeatureFlagMap, RecoveryFeatureFlagName } from './featureFlags.js'

export function feature(name: string): boolean {
  return readFeatureFlag(name)
}

export function hasFeature(name: RecoveryFeatureFlagName): boolean {
  return readFeatureFlag(name)
}
