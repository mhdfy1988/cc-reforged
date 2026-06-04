import { createSkillSecurityPolicyDecision, severityRank, } from './securitySchema.js';
export function evaluateSkillSecurityPolicy(report, options = {}) {
    const highestSeverity = report.summary.highestSeverity;
    const reasons = summarizeSecurityPolicyReasons(report);
    const expectedOverrideToken = createSkillSecurityOverrideToken(report);
    if (report.summary.totalFindings === 0) {
        return createSkillSecurityPolicyDecision({
            installAllowed: true,
            action: 'allow',
            requiresOverride: false,
            reasons: ['No security findings detected.'],
            report,
        });
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
        });
    }
    if (highestSeverity === 'high') {
        if (options.overrideToken === expectedOverrideToken) {
            return createSkillSecurityPolicyDecision({
                installAllowed: true,
                action: 'require-confirmation',
                requiresOverride: false,
                reasons: [...reasons, 'High risk override token accepted.'],
                report,
            });
        }
        return createSkillSecurityPolicyDecision({
            installAllowed: false,
            action: 'block',
            requiresOverride: true,
            overrideToken: expectedOverrideToken,
            reasons,
            report,
        });
    }
    if (severityRank(highestSeverity) >= severityRank('medium')) {
        return createSkillSecurityPolicyDecision({
            installAllowed: true,
            action: 'require-confirmation',
            requiresOverride: false,
            reasons,
            report,
        });
    }
    return createSkillSecurityPolicyDecision({
        installAllowed: true,
        action: 'warn',
        requiresOverride: false,
        reasons,
        report,
    });
}
export function createSkillSecurityOverrideToken(report) {
    const material = [
        report.packageId,
        report.skillName,
        report.summary.highestSeverity,
        report.summary.totalFindings,
        report.findings.map(finding => `${finding.ruleId}:${finding.severity}`).join('|'),
    ].join('\n');
    return Buffer.from(material, 'utf8').toString('base64url').slice(0, 32);
}
export function summarizeSecurityReportRisks(report) {
    if (report.summary.totalFindings === 0) {
        return [];
    }
    return [
        `安全扫描最高风险：${report.summary.highestSeverity}`,
        ...report.findings
            .slice()
            .sort(compareFindingsBySeverity)
            .slice(0, 5)
            .map(finding => `${finding.severity}: ${finding.title}`),
    ];
}
function summarizeSecurityPolicyReasons(report) {
    return report.findings
        .slice()
        .sort(compareFindingsBySeverity)
        .slice(0, 3)
        .map(finding => `${finding.severity}: ${finding.message}`);
}
function compareFindingsBySeverity(a, b) {
    const severityDiff = severityRank(b.severity) -
        severityRank(a.severity);
    if (severityDiff !== 0)
        return severityDiff;
    return a.ruleId.localeCompare(b.ruleId);
}
//# sourceMappingURL=securityPolicy.js.map