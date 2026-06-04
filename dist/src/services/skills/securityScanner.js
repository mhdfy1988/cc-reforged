import { readFile, stat } from 'fs/promises';
import { isAbsolute, relative, resolve } from 'path';
import { createSkillSecurityScanReport, } from './securitySchema.js';
import { createBinaryContentFinding, createMissingFileFinding, createPathEscapeFinding, createSkippedFileFinding, scanFrontmatterSecurityRules, scanResourcePathRules, scanTextSecurityRules, } from './securityRules.js';
export const DEFAULT_SKILL_SECURITY_SCAN_LIMITS = {
    maxFileBytes: 256 * 1024,
    maxFiles: 200,
    maxTotalBytes: 2 * 1024 * 1024,
};
export async function scanSkillPackage(skillPackage, options = {}) {
    const limits = normalizeLimits(options.limits);
    const packageDir = skillPackage.baseDir ?? inferPackageDir(skillPackage);
    const findings = [
        ...scanTextSecurityRules({
            text: skillPackage.body,
            filePath: skillPackage.bodyPath,
            relativePath: 'SKILL.md',
            sourceKind: 'skill-body',
        }),
        ...scanFrontmatterSecurityRules(skillPackage),
    ];
    const scannedFiles = [
        {
            relativePath: 'SKILL.md',
            kind: 'skill-md',
            sizeBytes: Buffer.byteLength(skillPackage.body, 'utf8'),
            skipped: false,
        },
    ];
    const resources = listResourceEntries(skillPackage);
    if (packageDir == null && resources.length > 0) {
        for (const resource of resources.slice(0, limits.maxFiles)) {
            findings.push(createSkippedFileFinding({
                relativePath: resource.relativePath,
                filePath: null,
                reason: 'skill package has no baseDir',
            }));
            scannedFiles.push({
                relativePath: resource.relativePath,
                kind: resource.kind,
                sizeBytes: 0,
                skipped: true,
                skipReason: 'skill package has no baseDir',
            });
        }
    }
    else if (packageDir != null) {
        const scanState = { totalBytes: scannedFiles[0]?.sizeBytes ?? 0 };
        for (let index = 0; index < resources.length; index += 1) {
            const resource = resources[index];
            if (!resource)
                continue;
            if (index >= limits.maxFiles) {
                findings.push(createSkippedFileFinding({
                    relativePath: resource.relativePath,
                    filePath: null,
                    reason: `file count limit exceeded: ${limits.maxFiles}`,
                }));
                scannedFiles.push({
                    relativePath: resource.relativePath,
                    kind: resource.kind,
                    sizeBytes: 0,
                    skipped: true,
                    skipReason: `file count limit exceeded: ${limits.maxFiles}`,
                });
                continue;
            }
            const result = await scanResourceFile({
                packageDir,
                resource,
                limits,
                scanState,
            });
            findings.push(...result.findings);
            scannedFiles.push(result.scannedFile);
        }
    }
    return createSkillSecurityScanReport({
        packageId: options.packageId ?? skillPackage.id,
        skillName: skillPackage.name,
        scannedAt: (options.now ?? new Date()).toISOString(),
        packageDir: packageDir ?? skillPackage.baseDir ?? 'unknown',
        source: options.source ?? 'candidate',
        findings,
        scannedFiles,
    });
}
async function scanResourceFile(input) {
    const { packageDir, resource, limits, scanState } = input;
    const resolvedPath = resolve(packageDir, resource.relativePath);
    if (!isSafeRelativePath(resource.relativePath) || !isInsideRoot(packageDir, resolvedPath)) {
        return {
            findings: [
                createPathEscapeFinding({
                    relativePath: resource.relativePath,
                }),
            ],
            scannedFile: {
                relativePath: sanitizeScannedRelativePath(resource.relativePath),
                kind: resource.kind,
                sizeBytes: 0,
                skipped: true,
                skipReason: 'resource path escapes skill package',
            },
        };
    }
    const findings = scanResourcePathRules({
        absolutePath: resolvedPath,
        relativePath: resource.relativePath,
        kind: resource.kind,
    });
    let sizeBytes = 0;
    try {
        const fileStat = await stat(resolvedPath);
        if (!fileStat.isFile()) {
            return {
                findings: [
                    ...findings,
                    createMissingFileFinding({
                        relativePath: resource.relativePath,
                        filePath: resolvedPath,
                        message: `Declared resource is not a regular file: ${resource.relativePath}.`,
                    }),
                ],
                scannedFile: {
                    relativePath: resource.relativePath,
                    kind: resource.kind,
                    sizeBytes: 0,
                    skipped: true,
                    skipReason: 'not a regular file',
                },
            };
        }
        sizeBytes = fileStat.size;
    }
    catch (error) {
        return {
            findings: [
                ...findings,
                createMissingFileFinding({
                    relativePath: resource.relativePath,
                    filePath: resolvedPath,
                    message: `Declared resource cannot be read: ${resource.relativePath}. ${formatErrorMessage(error)}`,
                }),
            ],
            scannedFile: {
                relativePath: resource.relativePath,
                kind: resource.kind,
                sizeBytes: 0,
                skipped: true,
                skipReason: 'read failed',
            },
        };
    }
    if (sizeBytes > limits.maxFileBytes) {
        const reason = `file size exceeds limit: ${sizeBytes} > ${limits.maxFileBytes}`;
        return {
            findings: [
                ...findings,
                createSkippedFileFinding({
                    relativePath: resource.relativePath,
                    filePath: resolvedPath,
                    reason,
                }),
            ],
            scannedFile: {
                relativePath: resource.relativePath,
                kind: resource.kind,
                sizeBytes,
                skipped: true,
                skipReason: reason,
            },
        };
    }
    if (scanState.totalBytes + sizeBytes > limits.maxTotalBytes) {
        const reason = `total scan size exceeds limit: ${limits.maxTotalBytes}`;
        return {
            findings: [
                ...findings,
                createSkippedFileFinding({
                    relativePath: resource.relativePath,
                    filePath: resolvedPath,
                    reason,
                }),
            ],
            scannedFile: {
                relativePath: resource.relativePath,
                kind: resource.kind,
                sizeBytes,
                skipped: true,
                skipReason: reason,
            },
        };
    }
    scanState.totalBytes += sizeBytes;
    const buffer = await readFile(resolvedPath);
    if (looksBinary(buffer)) {
        return {
            findings: [
                ...findings,
                createBinaryContentFinding({
                    relativePath: resource.relativePath,
                    filePath: resolvedPath,
                }),
            ],
            scannedFile: {
                relativePath: resource.relativePath,
                kind: resource.kind,
                sizeBytes,
                skipped: true,
                skipReason: 'binary-like content',
            },
        };
    }
    const text = buffer.toString('utf8');
    return {
        findings: [
            ...findings,
            ...scanTextSecurityRules({
                text,
                filePath: resolvedPath,
                relativePath: resource.relativePath,
                sourceKind: resource.kind,
            }),
        ],
        scannedFile: {
            relativePath: resource.relativePath,
            kind: resource.kind,
            sizeBytes,
            skipped: false,
        },
    };
}
function listResourceEntries(skillPackage) {
    return [
        ...skillPackage.resources.scripts.map((relativePath) => ({ relativePath, kind: 'script' })),
        ...skillPackage.resources.references.map((relativePath) => ({ relativePath, kind: 'reference' })),
        ...skillPackage.resources.assets.map((relativePath) => ({ relativePath, kind: 'asset' })),
    ].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
function normalizeLimits(limits) {
    return {
        maxFileBytes: limits?.maxFileBytes ?? DEFAULT_SKILL_SECURITY_SCAN_LIMITS.maxFileBytes,
        maxFiles: limits?.maxFiles ?? DEFAULT_SKILL_SECURITY_SCAN_LIMITS.maxFiles,
        maxTotalBytes: limits?.maxTotalBytes ??
            DEFAULT_SKILL_SECURITY_SCAN_LIMITS.maxTotalBytes,
    };
}
function inferPackageDir(skillPackage) {
    if (!skillPackage.bodyPath)
        return null;
    const normalized = resolve(skillPackage.bodyPath);
    return normalized.replace(/[\\/][^\\/]*$/, '');
}
function isSafeRelativePath(relativePath) {
    if (!relativePath.trim())
        return false;
    if (isAbsolute(relativePath))
        return false;
    return !relativePath.split(/[\\/]+/).some(segment => segment === '..');
}
function isInsideRoot(root, candidate) {
    const relativePath = relative(resolve(root), resolve(candidate));
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}
function sanitizeScannedRelativePath(relativePath) {
    const sanitized = relativePath
        .replace(/^[a-zA-Z]:[\\/]/, '')
        .replace(/^[\\/]+/, '')
        .replace(/\.\.(?:[\\/]|$)/g, '')
        .trim();
    return sanitized || 'unsafe-resource';
}
function looksBinary(buffer) {
    if (buffer.length === 0)
        return false;
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    return sample.includes(0);
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=securityScanner.js.map