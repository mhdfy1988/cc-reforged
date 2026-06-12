import type {
  SkillSecurityFinding,
  SkillSecurityPolicyDecision,
  SkillSecurityScanReport,
  SkillSecuritySeverity,
} from './securitySchema.js'
import { severityRank } from './securitySchema.js'

export type SkillSecurityReportDigest = {
  schemaVersion: 1
  skillName: string
  packageId: string
  highestSeverity: SkillSecuritySeverity
  totalFindings: number
  action: SkillSecurityPolicyDecision['action'] | 'scan-only'
  installAllowed: boolean | null
  requiresOverride: boolean
  headline: string
  primaryFindings: Array<{
    severity: SkillSecuritySeverity
    category: string
    title: string
    message: string
    relativePath: string | null
    recommendation: string
  }>
}

export function summarizeSkillSecurityReport(
  report: SkillSecurityScanReport,
): SkillSecurityReportDigest {
  return createDigest({
    report,
    action: 'scan-only',
    installAllowed: null,
    requiresOverride: false,
  })
}

export function summarizeSkillSecurityDecision(
  decision: SkillSecurityPolicyDecision,
): SkillSecurityReportDigest {
  return createDigest({
    report: decision.report,
    action: decision.action,
    installAllowed: decision.installAllowed,
    requiresOverride: decision.requiresOverride,
  })
}

export function formatSkillSecurityHeadline(
  input: SkillSecurityReportDigest | SkillSecurityScanReport,
): string {
  if ('headline' in input) {
    return input.headline
  }
  return summarizeSkillSecurityReport(input).headline
}

function createDigest(input: {
  report: SkillSecurityScanReport
  action: SkillSecurityReportDigest['action']
  installAllowed: boolean | null
  requiresOverride: boolean
}): SkillSecurityReportDigest {
  const primaryFindings = input.report.findings
    .slice()
    .sort(compareFindings)
    .slice(0, 3)
    .map(finding => ({
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      message: finding.message,
      relativePath: finding.relativePath,
      recommendation: finding.recommendation,
    }))

  return {
    schemaVersion: 1,
    skillName: input.report.skillName,
    packageId: input.report.packageId,
    highestSeverity: input.report.summary.highestSeverity,
    totalFindings: input.report.summary.totalFindings,
    action: input.action,
    installAllowed: input.installAllowed,
    requiresOverride: input.requiresOverride,
    headline: createHeadline({
      report: input.report,
      action: input.action,
      installAllowed: input.installAllowed,
      requiresOverride: input.requiresOverride,
    }),
    primaryFindings,
  }
}

function createHeadline(input: {
  report: SkillSecurityScanReport
  action: SkillSecurityReportDigest['action']
  installAllowed: boolean | null
  requiresOverride: boolean
}): string {
  if (input.report.summary.totalFindings === 0) {
    return `安全扫描未发现风险：${input.report.skillName}`
  }
  const actionText = formatAction(input.action, input.requiresOverride)
  return `安全扫描最高风险 ${formatSeverity(input.report.summary.highestSeverity)}，共 ${input.report.summary.totalFindings} 项：${actionText}`
}

function formatSeverity(severity: SkillSecuritySeverity): string {
  switch (severity) {
    case 'critical':
      return '严重'
    case 'high':
      return '高'
    case 'medium':
      return '中'
    case 'low':
      return '低'
    case 'info':
      return '提示'
  }
}

function formatAction(
  action: SkillSecurityReportDigest['action'],
  requiresOverride: boolean,
): string {
  if (requiresOverride) {
    return '需要确认高风险'
  }
  switch (action) {
    case 'allow':
      return '允许安装'
    case 'warn':
      return '提示风险'
    case 'require-confirmation':
      return '需要确认'
    case 'block':
      return '阻断安装'
    case 'scan-only':
      return '仅展示扫描结果'
  }
}

function compareFindings(
  a: SkillSecurityFinding,
  b: SkillSecurityFinding,
): number {
  const severityDiff = severityRank(b.severity) - severityRank(a.severity)
  if (severityDiff !== 0) return severityDiff
  return a.ruleId.localeCompare(b.ruleId)
}
