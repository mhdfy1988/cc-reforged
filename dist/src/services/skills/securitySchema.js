import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';
export const SKILL_SECURITY_SEVERITIES = [
    'info',
    'low',
    'medium',
    'high',
    'critical',
];
export const SKILL_SECURITY_CATEGORIES = [
    'executable-content',
    'shell-command',
    'network-access',
    'secret-access',
    'filesystem-access',
    'package-install',
    'tool-permission',
    'path-escape',
    'binary-content',
    'openclaw-metadata',
    'integrity',
    'unknown',
];
export const SKILL_SECURITY_POLICY_ACTIONS = [
    'allow',
    'warn',
    'require-confirmation',
    'block',
];
export const SKILL_SECURITY_SCAN_SOURCES = [
    'candidate',
    'installed',
    'drifted',
];
export const SKILL_SECURITY_SCANNED_FILE_KINDS = [
    'skill-md',
    'script',
    'reference',
    'asset',
    'metadata',
    'unknown',
];
export const SkillSecuritySeveritySchema = lazySchema(() => z.enum(SKILL_SECURITY_SEVERITIES));
export const SkillSecurityCategorySchema = lazySchema(() => z.enum(SKILL_SECURITY_CATEGORIES));
export const SkillSecurityPolicyActionSchema = lazySchema(() => z.enum(SKILL_SECURITY_POLICY_ACTIONS));
export const SkillSecurityScanSourceSchema = lazySchema(() => z.enum(SKILL_SECURITY_SCAN_SOURCES));
export const SkillSecurityScannedFileKindSchema = lazySchema(() => z.enum(SKILL_SECURITY_SCANNED_FILE_KINDS));
export const SkillSecuritySeverityCountsSchema = lazySchema(() => z.object({
    info: z.number().int().nonnegative().default(0),
    low: z.number().int().nonnegative().default(0),
    medium: z.number().int().nonnegative().default(0),
    high: z.number().int().nonnegative().default(0),
    critical: z.number().int().nonnegative().default(0),
}));
export const SkillSecurityCategoryCountsSchema = lazySchema(() => z.object({
    'executable-content': z.number().int().nonnegative().default(0),
    'shell-command': z.number().int().nonnegative().default(0),
    'network-access': z.number().int().nonnegative().default(0),
    'secret-access': z.number().int().nonnegative().default(0),
    'filesystem-access': z.number().int().nonnegative().default(0),
    'package-install': z.number().int().nonnegative().default(0),
    'tool-permission': z.number().int().nonnegative().default(0),
    'path-escape': z.number().int().nonnegative().default(0),
    'binary-content': z.number().int().nonnegative().default(0),
    'openclaw-metadata': z.number().int().nonnegative().default(0),
    integrity: z.number().int().nonnegative().default(0),
    unknown: z.number().int().nonnegative().default(0),
}));
export const SkillSecurityScanSummarySchema = lazySchema(() => z.object({
    highestSeverity: SkillSecuritySeveritySchema(),
    totalFindings: z.number().int().nonnegative(),
    bySeverity: SkillSecuritySeverityCountsSchema(),
    byCategory: SkillSecurityCategoryCountsSchema(),
}));
export const SkillSecurityFindingSchema = lazySchema(() => z
    .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    ruleId: z.string().min(1),
    severity: SkillSecuritySeveritySchema(),
    category: SkillSecurityCategorySchema(),
    title: z.string().min(1),
    message: z.string().min(1),
    filePath: z.string().min(1).nullable(),
    relativePath: z
        .string()
        .min(1)
        .refine(isSafeRelativePath, {
        message: 'relativePath must stay inside the skill package.',
    })
        .nullable(),
    line: z.number().int().positive().nullable(),
    evidence: z.string().max(240).nullable(),
    recommendation: z.string().min(1),
})
    .refine(finding => finding.filePath !== null ||
    finding.relativePath !== null ||
    finding.category === 'integrity' ||
    finding.category === 'path-escape', {
    message: 'finding must include filePath or relativePath unless it is a structural finding.',
}));
export const SkillSecurityScannedFileSchema = lazySchema(() => z
    .object({
    relativePath: z.string().min(1).refine(isSafeRelativePath, {
        message: 'relativePath must stay inside the skill package.',
    }),
    kind: SkillSecurityScannedFileKindSchema(),
    sizeBytes: z.number().int().nonnegative(),
    skipped: z.boolean(),
    skipReason: z.string().min(1).optional(),
})
    .refine(file => file.skipped || file.skipReason === undefined, {
    message: 'skipReason is only allowed when skipped is true.',
})
    .refine(file => !file.skipped || file.skipReason !== undefined, {
    message: 'skipReason is required when skipped is true.',
}));
export const SkillSecurityScanReportSchema = lazySchema(() => z.object({
    schemaVersion: z.literal(1),
    packageId: z.string().min(1),
    skillName: z.string().min(1),
    scannedAt: z.string().min(1),
    packageDir: z.string().min(1),
    source: SkillSecurityScanSourceSchema(),
    summary: SkillSecurityScanSummarySchema(),
    findings: z.array(SkillSecurityFindingSchema()).default([]),
    scannedFiles: z.array(SkillSecurityScannedFileSchema()).default([]),
}));
export const SkillSecurityPolicyDecisionSchema = lazySchema(() => z
    .object({
    schemaVersion: z.literal(1),
    installAllowed: z.boolean(),
    action: SkillSecurityPolicyActionSchema(),
    requiresOverride: z.boolean(),
    overrideToken: z.string().min(1).optional(),
    reasons: z.array(z.string().min(1)).default([]),
    report: SkillSecurityScanReportSchema(),
})
    .refine(decision => !decision.requiresOverride || decision.overrideToken !== undefined, {
    message: 'overrideToken is required when requiresOverride is true.',
})
    .refine(decision => decision.action !== 'allow' ||
    (!decision.requiresOverride && decision.installAllowed), {
    message: 'allow decisions must be installable and must not require override.',
}));
export function createSkillSecurityFinding(input) {
    return SkillSecurityFindingSchema().parse({
        schemaVersion: 1,
        ...input,
    });
}
export function parseSkillSecurityFinding(input) {
    return SkillSecurityFindingSchema().parse(input);
}
export function createSkillSecurityScanReport(input) {
    const findings = input.findings ?? [];
    return SkillSecurityScanReportSchema().parse({
        schemaVersion: 1,
        ...input,
        findings,
        summary: input.summary ?? summarizeSkillSecurityFindings(findings),
    });
}
export function parseSkillSecurityScanReport(input) {
    return SkillSecurityScanReportSchema().parse(input);
}
export function createSkillSecurityPolicyDecision(input) {
    return SkillSecurityPolicyDecisionSchema().parse({
        schemaVersion: 1,
        ...input,
    });
}
export function parseSkillSecurityPolicyDecision(input) {
    return SkillSecurityPolicyDecisionSchema().parse(input);
}
export function summarizeSkillSecurityFindings(findings) {
    const bySeverity = createEmptySeverityCounts();
    const byCategory = createEmptyCategoryCounts();
    let highestSeverity = 'info';
    for (const input of findings) {
        const finding = parseSkillSecurityFinding(input);
        bySeverity[finding.severity] += 1;
        byCategory[finding.category] += 1;
        if (severityRank(finding.severity) > severityRank(highestSeverity)) {
            highestSeverity = finding.severity;
        }
    }
    return SkillSecurityScanSummarySchema().parse({
        highestSeverity,
        totalFindings: findings.length,
        bySeverity,
        byCategory,
    });
}
export function createEmptySeverityCounts() {
    return {
        info: 0,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
    };
}
export function createEmptyCategoryCounts() {
    return {
        'executable-content': 0,
        'shell-command': 0,
        'network-access': 0,
        'secret-access': 0,
        'filesystem-access': 0,
        'package-install': 0,
        'tool-permission': 0,
        'path-escape': 0,
        'binary-content': 0,
        'openclaw-metadata': 0,
        integrity: 0,
        unknown: 0,
    };
}
export function severityRank(severity) {
    switch (severity) {
        case 'info':
            return 0;
        case 'low':
            return 1;
        case 'medium':
            return 2;
        case 'high':
            return 3;
        case 'critical':
            return 4;
    }
}
function isSafeRelativePath(relativePath) {
    if (!relativePath.trim())
        return false;
    if (relativePath.startsWith('/') || relativePath.startsWith('\\'))
        return false;
    if (/^[a-zA-Z]:[\\/]/.test(relativePath))
        return false;
    return !relativePath.split(/[\\/]+/).some(segment => segment === '..');
}
//# sourceMappingURL=securitySchema.js.map