import assert from 'node:assert/strict'
import {
  canOverrideSkillInstallSecurityBlock,
  isSkillInstallPlanHardBlocked,
  isSkillInstallSecurityOverrideRequired,
} from '../apps/desktop/src/renderer/src/domain/skillInstallViewPolicy.ts'

const highRiskOverridePlan = {
  installable: false,
  overrideRequired: true,
  securityDecision: {
    requiresOverride: true,
    overrideToken: 'override-token',
  },
  conflicts: [
    {
      kind: 'security-blocked',
      message: '安全策略阻断安装。',
    },
  ],
}

assert.equal(
  isSkillInstallSecurityOverrideRequired(highRiskOverridePlan),
  true,
)
assert.equal(
  canOverrideSkillInstallSecurityBlock(highRiskOverridePlan),
  true,
)
assert.equal(isSkillInstallPlanHardBlocked(highRiskOverridePlan), false)

const mixedConflictPlan = {
  ...highRiskOverridePlan,
  conflicts: [
    ...highRiskOverridePlan.conflicts,
    {
      kind: 'package-exists',
      message: '目标 package 目录已存在。',
    },
  ],
}

assert.equal(canOverrideSkillInstallSecurityBlock(mixedConflictPlan), false)
assert.equal(isSkillInstallPlanHardBlocked(mixedConflictPlan), true)

const normalInstallPlan = {
  installable: true,
  securityDecision: {
    requiresOverride: false,
  },
  conflicts: [],
}

assert.equal(isSkillInstallSecurityOverrideRequired(normalInstallPlan), false)
assert.equal(canOverrideSkillInstallSecurityBlock(normalInstallPlan), false)
assert.equal(isSkillInstallPlanHardBlocked(normalInstallPlan), false)

console.log('smoke-desktop-skill-install-override-ui: ok')
