import {
  createSkillSecurityPolicyDecision,
  severityRank,
  type SkillSecurityFinding,
  type SkillSecurityPolicyDecision,
  type SkillSecurityScanReport,
  type SkillSecuritySeverity,
} from './securitySchema.js'

export type EvaluateSkillSecurityPolicyOptions = {
  overrideToken?: string
}

export function evaluateSkillSecurityPolicy(
  report: SkillSecurityScanReport,
  options: EvaluateSkillSecurityPolicyOptions = {},
): SkillSecurityPolicyDecision {
  const highestSeverity = report.summary.highestSeverity
  const reasons = summarizeSecurityPolicyReasons(report)
  const expectedOverrideToken = createSkillSecurityOverrideToken(report)

  if (report.summary.totalFindings === 0) {
    return createSkillSecurityPolicyDecision({
      installAllowed: true,
      action: 'allow',
      requiresOverride: false,
      reasons: ['No security findings detected.'],
      report,
    })
  }

  if (highestSeverity === 'critical') {
    return createSkillSecurityPolicyDecision({
      installAllowed: false,
      action: 'block',
      requiresOverride: false,
      reasons: [
        ...reasons,
        'Critical security findings cannot be overridden in the first policy version.',
      ],
      report,
    })
  }

  if (highestSeverity === 'high') {
    if (options.overrideToken === expectedOverrideToken) {
      return createSkillSecurityPolicyDecision({
        installAllowed: true,
        action: 'require-confirmation',
        requiresOverride: false,
        reasons: [...reasons, '已确认高风险安装。'],
        report,
      })
    }
    return createSkillSecurityPolicyDecision({
      installAllowed: false,
      action: 'block',
      requiresOverride: true,
      overrideToken: expectedOverrideToken,
      reasons,
      report,
    })
  }

  if (severityRank(highestSeverity) >= severityRank('medium')) {
    return createSkillSecurityPolicyDecision({
      installAllowed: true,
      action: 'require-confirmation',
      requiresOverride: false,
      reasons,
      report,
    })
  }

  return createSkillSecurityPolicyDecision({
    installAllowed: true,
    action: 'warn',
    requiresOverride: false,
    reasons,
    report,
  })
}

export function createSkillSecurityOverrideToken(
  report: SkillSecurityScanReport,
): string {
  const material = [
    report.packageId,
    report.skillName,
    report.summary.highestSeverity,
    report.summary.totalFindings,
    report.findings.map(finding => `${finding.ruleId}:${finding.severity}`).join('|'),
  ].join('\n')
  return Buffer.from(material, 'utf8').toString('base64url').slice(0, 32)
}

export function summarizeSecurityReportRisks(
  report: SkillSecurityScanReport,
): string[] {
  if (report.summary.totalFindings === 0) {
    return []
  }
  return [
    `安全扫描最高风险：${report.summary.highestSeverity}`,
    ...report.findings
      .slice()
      .sort(compareFindingsBySeverity)
      .slice(0, 5)
      .map(finding => `${finding.severity}: ${finding.title}`),
  ]
}

function summarizeSecurityPolicyReasons(
  report: SkillSecurityScanReport,
): string[] {
  return report.findings
    .slice()
    .sort(compareFindingsBySeverity)
    .slice(0, 3)
    .map(finding => `${finding.severity}: ${finding.message}`)
}

function compareFindingsBySeverity(
  a: SkillSecurityFinding,
  b: SkillSecurityFinding,
): number {
  const severityDiff =
    severityRank(b.severity as SkillSecuritySeverity) -
    severityRank(a.severity as SkillSecuritySeverity)
  if (severityDiff !== 0) return severityDiff
  return a.ruleId.localeCompare(b.ruleId)
}
