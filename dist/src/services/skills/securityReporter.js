import { severityRank } from './securitySchema.js';
export function summarizeSkillSecurityReport(report) {
    return createDigest({
        report,
        action: 'scan-only',
        installAllowed: null,
        requiresOverride: false,
    });
}
export function summarizeSkillSecurityDecision(decision) {
    return createDigest({
        report: decision.report,
        action: decision.action,
        installAllowed: decision.installAllowed,
        requiresOverride: decision.requiresOverride,
    });
}
export function formatSkillSecurityHeadline(input) {
    if ('headline' in input) {
        return input.headline;
    }
    return summarizeSkillSecurityReport(input).headline;
}
function createDigest(input) {
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
    }));
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
    };
}
function createHeadline(input) {
    if (input.report.summary.totalFindings === 0) {
        return `安全扫描未发现风险：${input.report.skillName}`;
    }
    const actionText = formatAction(input.action, input.requiresOverride);
    return `安全扫描最高风险 ${input.report.summary.highestSeverity}，共 ${input.report.summary.totalFindings} 项：${actionText}`;
}
function formatAction(action, requiresOverride) {
    if (requiresOverride) {
        return '需要显式 override';
    }
    switch (action) {
        case 'allow':
            return '允许安装';
        case 'warn':
            return '提示风险';
        case 'require-confirmation':
            return '需要确认';
        case 'block':
            return '阻断安装';
        case 'scan-only':
            return '仅展示扫描结果';
    }
}
function compareFindings(a, b) {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff !== 0)
        return severityDiff;
    return a.ruleId.localeCompare(b.ruleId);
}
//# sourceMappingURL=securityReporter.js.map