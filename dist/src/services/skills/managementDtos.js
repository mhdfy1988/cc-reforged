import { summarizeSkillSecurityDecision, summarizeSkillSecurityReport, } from './securityReporter.js';
export function addCandidateDigest(candidate) {
    return {
        ...candidate,
        securityDigest: summarizeSkillSecurityReport(candidate.securityReport),
    };
}
export function addPlanDigest(plan) {
    const decision = plan.securityDecision;
    if (isSecurityDecision(decision)) {
        return {
            ...plan,
            securityDigest: summarizeSkillSecurityDecision(decision),
        };
    }
    if (isSecurityReport(plan.securityReport)) {
        return {
            ...plan,
            securityDigest: summarizeSkillSecurityReport(plan.securityReport),
        };
    }
    return {
        ...plan,
        securityDigest: null,
    };
}
export function addInspectionDigest(inspection) {
    return {
        ...inspection,
        securityDigest: isSecurityReport(inspection.securityReport)
            ? summarizeSkillSecurityReport(inspection.securityReport)
            : null,
    };
}
export function isProblemInspectionStatus(status) {
    return (status === 'missing-package' ||
        status === 'missing-skill-md' ||
        status === 'missing-owner-marker' ||
        status === 'missing-lock' ||
        status === 'drifted' ||
        status === 'invalid');
}
function isSecurityDecision(value) {
    return Boolean(value && typeof value === 'object' && 'installAllowed' in value);
}
function isSecurityReport(value) {
    return Boolean(value && typeof value === 'object' && 'summary' in value);
}
//# sourceMappingURL=managementDtos.js.map