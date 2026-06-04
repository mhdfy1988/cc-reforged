import { createSkillSecurityFinding, } from './securitySchema.js';
const TEXT_RULES = [
    {
        ruleId: 'text.network-access',
        severity: 'medium',
        scriptSeverity: 'high',
        category: 'network-access',
        title: 'Network access pattern detected',
        recommendation: 'Review whether this skill can send data outside the local machine.',
        patterns: [
            /\b(?:curl|wget)\b/i,
            /\bInvoke-WebRequest\b/i,
            /\biwr\b/i,
            /\bfetch\s*\(/i,
            /\baxios\./i,
            /\bhttps?:\/\/[^\s"'<>]+/i,
        ],
    },
    {
        ruleId: 'text.secret-access',
        severity: 'medium',
        scriptSeverity: 'high',
        category: 'secret-access',
        title: 'Secret or environment access pattern detected',
        recommendation: 'Confirm the skill does not read or expose secrets without consent.',
        patterns: [
            /\bprocess\.env\b/i,
            /\$env:/i,
            /\bos\.environ\b/i,
            /\b(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)\b/i,
            /\b(?:id_rsa|id_ed25519)\b/i,
        ],
    },
    {
        ruleId: 'text.filesystem-sensitive-path',
        severity: 'medium',
        scriptSeverity: 'high',
        category: 'filesystem-access',
        title: 'Sensitive filesystem path detected',
        recommendation: 'Review file access instructions before installing or invoking this skill.',
        patterns: [
            /(?:^|[\s\\/])\.ssh(?:[\\/]|$)/i,
            /(?:^|[\s\\/])\.env(?:[\\/]|$)/i,
            /\bAppData\b/i,
            /\/etc\/passwd/i,
            /\bC:\\Users\\/i,
        ],
    },
    {
        ruleId: 'text.shell-command',
        severity: 'medium',
        scriptSeverity: 'high',
        category: 'shell-command',
        title: 'Shell execution pattern detected',
        recommendation: 'Require explicit review before allowing this skill to execute commands.',
        patterns: [
            /\bpowershell(?:\.exe)?\b/i,
            /\bcmd\.exe\b/i,
            /\bbash\b/i,
            /\bsh\s+-c\b/i,
            /\bchild_process\b/i,
            /\b(?:execSync|spawn|spawnSync)\s*\(/i,
            /\bInvoke-Expression\b/i,
        ],
    },
    {
        ruleId: 'text.package-install',
        severity: 'medium',
        scriptSeverity: 'high',
        category: 'package-install',
        title: 'Package installation pattern detected',
        recommendation: 'Do not execute installer commands automatically; convert them to an explicit plan.',
        patterns: [
            /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add)\b/i,
            /\bpip(?:3)?\s+install\b/i,
            /\bcargo\s+install\b/i,
            /\bInstall-Module\b/i,
            /\bwinget\s+install\b/i,
        ],
    },
];
const HIGH_RISK_TOOL_NAMES = new Set([
    'bash',
    'shell',
    'powershell',
    'cmd',
    'write',
    'edit',
    'multiedit',
]);
const EXECUTABLE_EXTENSIONS = new Set([
    '.ps1',
    '.bat',
    '.cmd',
    '.sh',
    '.js',
    '.ts',
    '.py',
    '.mjs',
    '.cjs',
]);
const BINARY_EXTENSIONS = new Set([
    '.exe',
    '.dll',
    '.bin',
    '.so',
    '.dylib',
    '.jar',
]);
export function scanTextSecurityRules(context) {
    const findings = [];
    const lines = context.text.split(/\r?\n/);
    for (const rule of TEXT_RULES) {
        for (const pattern of rule.patterns) {
            const match = findFirstLineMatch(lines, pattern);
            if (!match)
                continue;
            findings.push(createSkillSecurityFinding({
                id: createFindingId(rule.ruleId, context.relativePath, match.line),
                ruleId: rule.ruleId,
                severity: context.sourceKind === 'script' && rule.scriptSeverity
                    ? rule.scriptSeverity
                    : rule.severity,
                category: rule.category,
                title: rule.title,
                message: `${rule.title} in ${context.relativePath ?? 'skill text'}.`,
                filePath: context.filePath,
                relativePath: context.relativePath,
                line: match.line,
                evidence: truncateEvidence(match.evidence),
                recommendation: rule.recommendation,
            }));
            break;
        }
    }
    return findings;
}
export function scanFrontmatterSecurityRules(skillPackage) {
    const findings = [];
    for (const tool of skillPackage.invocation.allowedTools) {
        const normalized = tool.toLowerCase().replace(/[^a-z]/g, '');
        if (!HIGH_RISK_TOOL_NAMES.has(normalized))
            continue;
        findings.push(createSkillSecurityFinding({
            id: createFindingId('frontmatter.high-risk-tool', 'SKILL.md', normalized),
            ruleId: 'frontmatter.high-risk-tool',
            severity: normalized === 'bash' || normalized === 'shell' ? 'high' : 'medium',
            category: 'tool-permission',
            title: 'High risk allowed tool declared',
            message: `The skill declares high risk tool access: ${tool}.`,
            filePath: skillPackage.bodyPath,
            relativePath: 'SKILL.md',
            line: null,
            evidence: tool,
            recommendation: 'Require explicit review before granting tool permissions to this skill.',
        }));
    }
    findings.push(...scanHookSecurityRules(skillPackage));
    findings.push(...scanOpenClawMetadataRules(skillPackage));
    return findings;
}
function scanHookSecurityRules(skillPackage) {
    const hooks = asRecord(skillPackage.compatibility.rawFrontmatter.hooks);
    if (!hooks)
        return [];
    const findings = [];
    for (const [eventName, matcherValue] of Object.entries(hooks)) {
        if (!Array.isArray(matcherValue))
            continue;
        matcherValue.forEach((matcherEntry, matcherIndex) => {
            const matcher = asRecord(matcherEntry);
            if (!matcher || !Array.isArray(matcher.hooks))
                return;
            matcher.hooks.forEach((hookEntry, hookIndex) => {
                const hook = asRecord(hookEntry);
                if (!hook)
                    return;
                const hookType = typeof hook.type === 'string' ? hook.type.toLowerCase() : '';
                const salt = `${eventName}:${matcherIndex}:${hookIndex}`;
                if (hookType === 'command') {
                    const command = asNonEmptyString(hook.command);
                    if (!command)
                        return;
                    findings.push(createSkillSecurityFinding({
                        id: createFindingId('frontmatter.hook-command', 'SKILL.md', salt),
                        ruleId: 'frontmatter.hook-command',
                        severity: 'high',
                        category: 'shell-command',
                        title: 'Hook command declared',
                        message: `The skill declares a command hook for ${eventName}.`,
                        filePath: skillPackage.bodyPath,
                        relativePath: 'SKILL.md',
                        line: null,
                        evidence: truncateEvidence(command),
                        recommendation: 'Require explicit review before installing a skill that declares command hooks.',
                    }));
                    findings.push(...scanHookTextSecurityRules({
                        skillPackage,
                        text: command,
                        salt,
                        eventName,
                        hookType,
                    }));
                    return;
                }
                if (hookType === 'http') {
                    const url = asNonEmptyString(hook.url);
                    if (url) {
                        findings.push(createSkillSecurityFinding({
                            id: createFindingId('frontmatter.hook-http-url', 'SKILL.md', salt),
                            ruleId: 'frontmatter.hook-http-url',
                            severity: 'high',
                            category: 'network-access',
                            title: 'Hook HTTP URL declared',
                            message: `The skill declares an HTTP hook for ${eventName}.`,
                            filePath: skillPackage.bodyPath,
                            relativePath: 'SKILL.md',
                            line: null,
                            evidence: truncateEvidence(url),
                            recommendation: 'Confirm the destination and data flow before installing this skill.',
                        }));
                    }
                    const envRefs = collectHookHttpEnvRefs(hook);
                    if (envRefs.length > 0) {
                        findings.push(createSkillSecurityFinding({
                            id: createFindingId('frontmatter.hook-http-env', 'SKILL.md', `${salt}:${envRefs.join(',')}`),
                            ruleId: 'frontmatter.hook-http-env',
                            severity: 'high',
                            category: 'secret-access',
                            title: 'Hook HTTP environment access declared',
                            message: `The skill declares environment access for an HTTP hook on ${eventName}.`,
                            filePath: skillPackage.bodyPath,
                            relativePath: 'SKILL.md',
                            line: null,
                            evidence: truncateEvidence(envRefs.join(', ')),
                            recommendation: 'Require explicit review before allowing a hook to attach environment-derived headers.',
                        }));
                    }
                }
            });
        });
    }
    return findings;
}
function scanHookTextSecurityRules(input) {
    const findings = [];
    const lines = input.text.split(/\r?\n/);
    for (const rule of TEXT_RULES) {
        const severity = rule.scriptSeverity ?? rule.severity;
        for (const pattern of rule.patterns) {
            const match = findFirstLineMatch(lines, pattern);
            if (!match)
                continue;
            findings.push(createSkillSecurityFinding({
                id: createFindingId(`frontmatter.hook.${rule.ruleId}`, 'SKILL.md', `${input.salt}:${match.line}`),
                ruleId: `frontmatter.hook.${rule.ruleId}`,
                severity,
                category: rule.category,
                title: `Hook ${rule.title}`,
                message: `The ${input.hookType} hook for ${input.eventName} matches ${rule.ruleId}.`,
                filePath: input.skillPackage.bodyPath,
                relativePath: 'SKILL.md',
                line: null,
                evidence: truncateEvidence(match.evidence),
                recommendation: rule.recommendation,
            }));
            break;
        }
    }
    return findings;
}
export function scanResourcePathRules(input) {
    const findings = [];
    const extension = getLowerExtension(input.relativePath);
    if (EXECUTABLE_EXTENSIONS.has(extension)) {
        findings.push(createSkillSecurityFinding({
            id: createFindingId('resource.executable-extension', input.relativePath, extension),
            ruleId: 'resource.executable-extension',
            severity: input.kind === 'script' ? 'medium' : 'low',
            category: 'executable-content',
            title: 'Executable resource detected',
            message: `The skill contains executable-like resource: ${input.relativePath}.`,
            filePath: input.absolutePath,
            relativePath: input.relativePath,
            line: null,
            evidence: input.relativePath,
            recommendation: 'Review executable resources before installing this skill.',
        }));
    }
    if (BINARY_EXTENSIONS.has(extension)) {
        findings.push(createSkillSecurityFinding({
            id: createFindingId('resource.binary-extension', input.relativePath, extension),
            ruleId: 'resource.binary-extension',
            severity: 'medium',
            category: 'binary-content',
            title: 'Binary resource detected',
            message: `The skill contains binary resource: ${input.relativePath}.`,
            filePath: input.absolutePath,
            relativePath: input.relativePath,
            line: null,
            evidence: input.relativePath,
            recommendation: 'Do not execute binary resources unless they are explicitly trusted.',
        }));
    }
    return findings;
}
export function createPathEscapeFinding(input) {
    return createSkillSecurityFinding({
        id: createFindingId('resource.path-escape', input.relativePath, 'escape'),
        ruleId: 'resource.path-escape',
        severity: 'critical',
        category: 'path-escape',
        title: 'Resource path escapes skill package',
        message: `Resource path escapes package root: ${input.relativePath}.`,
        filePath: null,
        relativePath: null,
        line: null,
        evidence: input.relativePath,
        recommendation: 'Reject this skill package or remove the unsafe resource path.',
    });
}
export function createSkippedFileFinding(input) {
    return createSkillSecurityFinding({
        id: createFindingId('resource.scan-skipped', input.relativePath, input.reason),
        ruleId: 'resource.scan-skipped',
        severity: 'medium',
        category: 'unknown',
        title: 'Resource scan skipped',
        message: `Resource scan skipped for ${input.relativePath}: ${input.reason}.`,
        filePath: input.filePath,
        relativePath: input.relativePath,
        line: null,
        evidence: input.reason,
        recommendation: 'Review skipped files manually before trusting this skill package.',
    });
}
export function createMissingFileFinding(input) {
    return createSkillSecurityFinding({
        id: createFindingId('resource.missing-file', input.relativePath, 'missing'),
        ruleId: 'resource.missing-file',
        severity: 'medium',
        category: 'integrity',
        title: 'Declared resource is missing',
        message: input.message,
        filePath: input.filePath,
        relativePath: input.relativePath,
        line: null,
        evidence: input.relativePath,
        recommendation: 'Rebuild or re-import the skill package before installing it.',
    });
}
export function createBinaryContentFinding(input) {
    return createSkillSecurityFinding({
        id: createFindingId('resource.binary-content', input.relativePath, 'binary'),
        ruleId: 'resource.binary-content',
        severity: 'medium',
        category: 'binary-content',
        title: 'Binary-like resource content detected',
        message: `Resource appears to contain binary data: ${input.relativePath}.`,
        filePath: input.filePath,
        relativePath: input.relativePath,
        line: null,
        evidence: input.relativePath,
        recommendation: 'Review binary resources manually before trusting this skill package.',
    });
}
function scanOpenClawMetadataRules(skillPackage) {
    const metadata = asRecord(skillPackage.compatibility.rawFrontmatter.metadata);
    const openclaw = asRecord(metadata?.openclaw);
    if (!openclaw)
        return [];
    const findings = [];
    const requires = asRecord(openclaw.requires);
    const requiredBins = asStringArray(requires?.bins);
    const requiredEnv = asStringArray(requires?.env);
    if (requiredBins.length > 0) {
        findings.push(createSkillSecurityFinding({
            id: createFindingId('openclaw.requires-bins', 'SKILL.md', 'bins'),
            ruleId: 'openclaw.requires-bins',
            severity: 'low',
            category: 'openclaw-metadata',
            title: 'OpenClaw binary requirement declared',
            message: `OpenClaw metadata declares required binaries: ${requiredBins.join(', ')}.`,
            filePath: skillPackage.bodyPath,
            relativePath: 'SKILL.md',
            line: null,
            evidence: requiredBins.join(', '),
            recommendation: 'Show these requirements to the user before installing the skill.',
        }));
    }
    if (requiredEnv.length > 0) {
        findings.push(createSkillSecurityFinding({
            id: createFindingId('openclaw.requires-env', 'SKILL.md', 'env'),
            ruleId: 'openclaw.requires-env',
            severity: 'medium',
            category: 'secret-access',
            title: 'OpenClaw environment requirement declared',
            message: `OpenClaw metadata declares required environment variables: ${requiredEnv.join(', ')}.`,
            filePath: skillPackage.bodyPath,
            relativePath: 'SKILL.md',
            line: null,
            evidence: requiredEnv.join(', '),
            recommendation: 'Require confirmation before installing skills that depend on secrets.',
        }));
    }
    if (openclaw.install != null) {
        findings.push(createSkillSecurityFinding({
            id: createFindingId('openclaw.install-metadata', 'SKILL.md', 'install'),
            ruleId: 'openclaw.install-metadata',
            severity: 'high',
            category: 'package-install',
            title: 'OpenClaw install metadata detected',
            message: 'OpenClaw metadata declares install steps. CCR must not execute them automatically.',
            filePath: skillPackage.bodyPath,
            relativePath: 'SKILL.md',
            line: null,
            evidence: 'metadata.openclaw.install',
            recommendation: 'Convert install metadata into an explicit plan and require user approval.',
        }));
    }
    return findings;
}
function findFirstLineMatch(lines, pattern) {
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? '';
        if (pattern.test(line)) {
            return {
                line: index + 1,
                evidence: line.trim(),
            };
        }
    }
    return null;
}
function getLowerExtension(relativePath) {
    const match = relativePath.match(/(\.[^.\\/]+)$/);
    return match?.[1]?.toLowerCase() ?? '';
}
function createFindingId(ruleId, relativePath, salt) {
    return [ruleId, relativePath ?? 'package', String(salt)]
        .join(':')
        .replace(/[^a-zA-Z0-9:._-]+/g, '-');
}
function truncateEvidence(value) {
    return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}
function asRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function asStringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
}
function asNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function collectHookHttpEnvRefs(hook) {
    const refs = new Set();
    for (const value of asStringArray(hook.allowedEnvVars)) {
        const trimmed = value.trim();
        if (trimmed)
            refs.add(trimmed);
    }
    const headers = asRecord(hook.headers);
    if (headers) {
        for (const [name, value] of Object.entries(headers)) {
            if (typeof value !== 'string')
                continue;
            for (const ref of findEnvironmentReferences(value)) {
                refs.add(`${name}:${ref}`);
            }
        }
    }
    return [...refs].sort();
}
function findEnvironmentReferences(value) {
    const refs = new Set();
    const pattern = /\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g;
    let match;
    while ((match = pattern.exec(value)) !== null) {
        refs.add(match[1] ?? match[2] ?? '');
    }
    refs.delete('');
    return [...refs];
}
//# sourceMappingURL=securityRules.js.map