import type { SkillInstallCandidate } from './installCandidates.js'
import {
  summarizeSkillSecurityDecision,
  summarizeSkillSecurityReport,
} from './securityReporter.js'
import type {
  SkillSecurityPolicyDecision,
  SkillSecurityScanReport,
} from './securitySchema.js'

export function addCandidateDigest(candidate: SkillInstallCandidate) {
  return {
    ...candidate,
    securityDigest: summarizeSkillSecurityReport(candidate.securityReport),
  }
}

export function addPlanDigest<
  T extends { securityDecision?: unknown; securityReport?: unknown },
>(plan: T): T & { securityDigest: unknown } {
  const decision = plan.securityDecision
  if (isSecurityDecision(decision)) {
    return {
      ...plan,
      securityDigest: summarizeSkillSecurityDecision(decision),
    }
  }
  if (isSecurityReport(plan.securityReport)) {
    return {
      ...plan,
      securityDigest: summarizeSkillSecurityReport(plan.securityReport),
    }
  }
  return {
    ...plan,
    securityDigest: null,
  }
}

export function addInspectionDigest<T extends { securityReport: unknown }>(
  inspection: T,
): T & { securityDigest: unknown } {
  return {
    ...inspection,
    securityDigest: isSecurityReport(inspection.securityReport)
      ? summarizeSkillSecurityReport(inspection.securityReport)
      : null,
  }
}

export function isProblemInspectionStatus(status: string): boolean {
  return (
    status === 'missing-package' ||
    status === 'missing-skill-md' ||
    status === 'missing-owner-marker' ||
    status === 'missing-lock' ||
    status === 'drifted' ||
    status === 'invalid'
  )
}

function isSecurityDecision(
  value: unknown,
): value is SkillSecurityPolicyDecision {
  return Boolean(value && typeof value === 'object' && 'installAllowed' in value)
}

function isSecurityReport(value: unknown): value is SkillSecurityScanReport {
  return Boolean(value && typeof value === 'object' && 'summary' in value)
}
