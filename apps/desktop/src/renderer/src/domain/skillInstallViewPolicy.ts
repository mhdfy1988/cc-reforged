import type { SkillInstallPlanState } from './displayTypes.js'

export function isSkillInstallSecurityOverrideRequired(
  plan: SkillInstallPlanState,
): boolean {
  return Boolean(
    plan.overrideRequired || plan.securityDecision?.requiresOverride,
  )
}

export function canOverrideSkillInstallSecurityBlock(
  plan: SkillInstallPlanState,
): boolean {
  if (!isSkillInstallSecurityOverrideRequired(plan)) {
    return false
  }
  if (!plan.securityDecision?.overrideToken) {
    return false
  }
  return (plan.conflicts ?? []).every(
    conflict => conflict.kind === 'security-blocked',
  )
}

export function isSkillInstallPlanHardBlocked(
  plan: SkillInstallPlanState,
): boolean {
  return (
    plan.installable === false &&
    !canOverrideSkillInstallSecurityBlock(plan)
  )
}
