export {}

interface RecoveryMacroValues {
  VERSION: string
  BUILD_TIME?: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL?: string
  FEEDBACK_CHANNEL?: string
  ISSUES_EXPLAINER?: string
  VERSION_CHANGELOG?: string
}

declare global {
  var MACRO: RecoveryMacroValues
}
