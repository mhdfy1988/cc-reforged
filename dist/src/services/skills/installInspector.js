import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { loadSkillPackageFromDir } from './installCandidates.js';
import { parseCcrSkillInstalledIndex, parseCcrSkillLockIndex, parseCcrSkillPackageOwnerMarker, } from './installManifest.js';
import { getCcrSkillInstallPaths } from './installPaths.js';
import { scanSkillPackage } from './securityScanner.js';
import { createSkillSecurityFinding, createSkillSecurityScanReport, } from './securitySchema.js';
export async function listInstalledSkills(options = {}) {
    const paths = getCcrSkillInstallPaths(options.configHomeDir);
    const [installedIndex, lockIndex] = await Promise.all([
        readInstalledIndex(paths.installedIndexPath),
        readLockIndex(paths.lockFilePath),
    ]);
    const installed = await Promise.all(Object.entries(installedIndex.installed).map(([lockKey, record]) => inspectInstalledRecord(lockKey, record, lockIndex, options.configHomeDir)));
    return {
        schemaVersion: 1,
        installed: installed.sort(compareInstalledSkills),
        summary: summarizeInstalledSkills(installed),
    };
}
export async function inspectInstalledSkill(skillRef, options = {}) {
    const paths = getCcrSkillInstallPaths(options.configHomeDir);
    const [installedIndex, lockIndex] = await Promise.all([
        readInstalledIndex(paths.installedIndexPath),
        readLockIndex(paths.lockFilePath),
    ]);
    const match = Object.entries(installedIndex.installed).find(([lockKey, record]) => lockKey === skillRef || record.name === skillRef);
    if (!match)
        return null;
    const [lockKey, record] = match;
    return inspectInstalledRecord(lockKey, record, lockIndex, options.configHomeDir);
}
async function inspectInstalledRecord(lockKey, record, lockIndex, configHomeDir) {
    const lockRecord = lockIndex.locks[record.lockKey] ?? null;
    const base = createInspectionBase(lockKey, record, lockRecord);
    if (!(await isDirectory(record.packageDir))) {
        return completeInspection({
            ...base,
            securityReport: createIntegritySecurityReport({
                record,
                source: 'installed',
                ruleId: 'inspection.missing-package',
                severity: 'high',
                message: `Skill package directory is missing: ${record.packageDir}`,
            }),
        }, {
            status: 'missing-package',
            message: `Skill package directory is missing: ${record.packageDir}`,
        });
    }
    if (!(await isFile(record.skillFilePath))) {
        return completeInspection({
            ...base,
            securityReport: createIntegritySecurityReport({
                record,
                source: 'installed',
                ruleId: 'inspection.missing-skill-md',
                severity: 'high',
                message: `Skill package is missing SKILL.md: ${record.skillFilePath}`,
            }),
        }, {
            status: 'missing-skill-md',
            message: `Skill package is missing SKILL.md: ${record.skillFilePath}`,
        });
    }
    const ownerMarker = await readOwnerMarker(record.packageOwnerMarkerPath);
    if (ownerMarker == null) {
        return completeInspection({
            ...base,
            ownerMarker,
            securityReport: createIntegritySecurityReport({
                record,
                source: 'installed',
                ruleId: 'inspection.missing-owner-marker',
                severity: 'high',
                message: `Skill package owner marker is missing or invalid: ${record.packageOwnerMarkerPath}`,
            }),
        }, {
            status: 'missing-owner-marker',
            message: `Skill package owner marker is missing or invalid: ${record.packageOwnerMarkerPath}`,
        });
    }
    if (ownerMarker.packageId !== record.lockKey || ownerMarker.name !== record.name) {
        return completeInspection({
            ...base,
            ownerMarker,
            securityReport: createIntegritySecurityReport({
                record,
                source: 'installed',
                ruleId: 'inspection.owner-marker-mismatch',
                severity: 'high',
                message: `Skill package owner marker does not match installed record: ${record.packageOwnerMarkerPath}`,
            }),
        }, {
            status: 'invalid',
            message: `Skill package owner marker does not match installed record: ${record.packageOwnerMarkerPath}`,
        });
    }
    if (!lockRecord) {
        return completeInspection({
            ...base,
            ownerMarker,
            securityReport: createIntegritySecurityReport({
                record,
                source: 'installed',
                ruleId: 'inspection.missing-lock',
                severity: 'medium',
                message: `Skill lock record is missing: ${record.lockKey}`,
            }),
        }, {
            status: 'missing-lock',
            message: `Skill lock record is missing: ${record.lockKey}`,
        });
    }
    const actualSkillMd = await hashFileSha256(record.skillFilePath);
    const checksum = {
        algorithm: 'sha256',
        expectedSkillMd: lockRecord.checksum.skillMd,
        actualSkillMd,
        drifted: actualSkillMd !== lockRecord.checksum.skillMd,
    };
    if (checksum.drifted) {
        const driftedSecurity = await scanInstalledPackageForInspection({
            record,
            lockRecord,
            source: 'drifted',
        });
        return completeInspection({
            ...base,
            ownerMarker,
            package: driftedSecurity.package,
            securityReport: driftedSecurity.securityReport,
            checksum,
            errors: driftedSecurity.errors,
        }, {
            status: 'drifted',
            message: `Skill package checksum drift detected: ${record.name}`,
        });
    }
    try {
        const installedSecurity = await scanInstalledPackageForInspection({
            record,
            lockRecord,
            source: 'installed',
        });
        const enabled = record.enabled;
        return completeInspection({
            ...base,
            ownerMarker,
            package: installedSecurity.package,
            securityReport: installedSecurity.securityReport,
            checksum,
            errors: installedSecurity.errors,
        }, enabled
            ? {
                status: 'installed',
                message: `Skill is installed: ${record.name}`,
            }
            : {
                status: 'disabled',
                message: `Skill is installed but disabled: ${record.name}`,
            });
    }
    catch (error) {
        return completeInspection({
            ...base,
            ownerMarker,
            checksum,
            securityReport: createIntegritySecurityReport({
                record,
                source: 'installed',
                ruleId: 'inspection.normalize-failed',
                severity: 'high',
                message: `Skill package cannot be normalized: ${record.name}. ${formatErrorMessage(error)}`,
            }),
            errors: [formatErrorMessage(error)],
        }, {
            status: 'invalid',
            message: `Skill package cannot be normalized: ${record.name}`,
        });
    }
}
function createInspectionBase(lockKey, record, lockRecord) {
    return {
        schemaVersion: 1,
        lockKey,
        name: record.name,
        scope: record.scope,
        status: 'invalid',
        statusMessage: 'Skill inspection has not completed.',
        installedRecord: record,
        lockRecord,
        ownerMarker: null,
        package: null,
        securityReport: null,
        checksum: {
            algorithm: 'sha256',
            expectedSkillMd: lockRecord?.checksum.skillMd ?? null,
            actualSkillMd: null,
            drifted: false,
        },
        errors: [],
    };
}
async function scanInstalledPackageForInspection(input) {
    try {
        const skillPackage = await loadInstalledSkillPackage(input.record, input.lockRecord);
        return {
            package: skillPackage,
            securityReport: await scanSkillPackage(skillPackage, {
                source: input.source,
                packageId: input.record.lockKey,
            }),
            errors: [],
        };
    }
    catch (error) {
        return {
            package: null,
            securityReport: createIntegritySecurityReport({
                record: input.record,
                source: input.source,
                ruleId: 'inspection.security-scan-failed',
                severity: 'high',
                message: `Skill security scan failed: ${formatErrorMessage(error)}`,
            }),
            errors: [formatErrorMessage(error)],
        };
    }
}
async function loadInstalledSkillPackage(record, lockRecord) {
    return loadSkillPackageFromDir({
        skillDir: record.packageDir,
        originVendor: record.manifest.compatibility?.vendor ?? lockRecord.originVendor,
        importedFrom: getInstalledSourcePath(record),
        legacyCommand: record.manifest.compatibility?.convertedFromCommand ?? false,
        risks: [],
    });
}
function createIntegritySecurityReport(input) {
    return createSkillSecurityScanReport({
        packageId: input.record.lockKey,
        skillName: input.record.name,
        scannedAt: new Date().toISOString(),
        packageDir: input.record.packageDir,
        source: input.source,
        findings: [
            createSkillSecurityFinding({
                id: `${input.ruleId}:${input.record.lockKey}`,
                ruleId: input.ruleId,
                severity: input.severity,
                category: 'integrity',
                title: 'Installed skill integrity issue',
                message: input.message,
                filePath: input.record.packageDir,
                relativePath: null,
                line: null,
                evidence: input.record.lockKey,
                recommendation: 'Repair or reinstall this skill before trusting its installed package.',
            }),
        ],
    });
}
function completeInspection(inspection, result) {
    return {
        ...inspection,
        status: result.status,
        statusMessage: result.message,
    };
}
async function readInstalledIndex(path) {
    try {
        return parseCcrSkillInstalledIndex(JSON.parse(await readFile(path, 'utf8')));
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT') {
            return parseCcrSkillInstalledIndex({ schemaVersion: 1 });
        }
        throw error;
    }
}
async function readLockIndex(path) {
    try {
        return parseCcrSkillLockIndex(JSON.parse(await readFile(path, 'utf8')));
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT') {
            return parseCcrSkillLockIndex({ schemaVersion: 1 });
        }
        throw error;
    }
}
async function readOwnerMarker(ownerMarkerPath) {
    try {
        return parseCcrSkillPackageOwnerMarker(JSON.parse(await readFile(ownerMarkerPath, 'utf8')));
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT')
            return null;
        return null;
    }
}
async function isDirectory(path) {
    try {
        return (await stat(path)).isDirectory();
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT')
            return false;
        throw error;
    }
}
async function isFile(path) {
    try {
        return (await stat(path)).isFile();
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT')
            return false;
        throw error;
    }
}
async function hashFileSha256(path) {
    return createHash('sha256').update(await readFile(path)).digest('hex');
}
function getInstalledSourcePath(record) {
    if (record.manifest.source.kind === 'imported-skill') {
        return record.manifest.source.path;
    }
    if (record.manifest.source.kind === 'local-manifest') {
        return record.manifest.source.path;
    }
    if (record.manifest.source.kind === 'builtin-preset') {
        return `builtin-preset:${record.manifest.source.presetId}`;
    }
    return record.packageDir;
}
function summarizeInstalledSkills(inspections) {
    const summary = {
        installed: 0,
        disabled: 0,
        'missing-package': 0,
        'missing-skill-md': 0,
        'missing-owner-marker': 0,
        'missing-lock': 0,
        drifted: 0,
        invalid: 0,
    };
    for (const inspection of inspections) {
        summary[inspection.status] += 1;
    }
    return summary;
}
function compareInstalledSkills(a, b) {
    const statusDiff = statusRank(a.status) - statusRank(b.status);
    if (statusDiff !== 0)
        return statusDiff;
    return a.name.localeCompare(b.name);
}
function statusRank(status) {
    switch (status) {
        case 'installed':
            return 0;
        case 'disabled':
            return 1;
        case 'drifted':
            return 2;
        case 'missing-lock':
            return 3;
        case 'missing-owner-marker':
            return 4;
        case 'missing-skill-md':
            return 5;
        case 'missing-package':
            return 6;
        case 'invalid':
            return 7;
    }
}
function getErrorCode(error) {
    return typeof error === 'object' && error != null && 'code' in error
        ? error.code
        : undefined;
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=installInspector.js.map