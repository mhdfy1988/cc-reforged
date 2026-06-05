import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { parseCcrSkillInstalledIndex, parseCcrSkillLockIndex, parseCcrSkillPackageOwnerMarker, } from './installManifest.js';
import { getCcrSkillInstallPaths } from './installPaths.js';
import { loadSkillPackageFromDir } from './installCandidates.js';
import { hashSkillPackageTree } from './packageTreeIntegrity.js';
export async function listInstalledSkillPackageInspections(options = {}) {
    const paths = getCcrSkillInstallPaths(options.configHomeDir);
    const [installedIndex, lockIndex] = await Promise.all([
        readInstalledIndex(paths.installedIndexPath),
        readLockIndex(paths.lockFilePath),
    ]);
    const installed = await Promise.all(Object.entries(installedIndex.installed).map(([lockKey, record]) => inspectInstalledSkillPackageRecord(lockKey, record, lockIndex)));
    return {
        schemaVersion: 1,
        installed: installed.sort(compareInstalledSkillPackageInspections),
        summary: summarizeInstalledSkillPackageInspections(installed),
    };
}
export async function inspectInstalledSkillPackage(skillRef, options = {}) {
    const paths = getCcrSkillInstallPaths(options.configHomeDir);
    const [installedIndex, lockIndex] = await Promise.all([
        readInstalledIndex(paths.installedIndexPath),
        readLockIndex(paths.lockFilePath),
    ]);
    const match = Object.entries(installedIndex.installed).find(([lockKey, record]) => lockKey === skillRef || record.lockKey === skillRef || record.name === skillRef);
    if (!match)
        return null;
    const [lockKey, record] = match;
    return inspectInstalledSkillPackageRecord(lockKey, record, lockIndex);
}
export async function inspectInstalledSkillPackageRecord(lockKey, record, lockIndex) {
    const lockRecord = lockIndex.locks[record.lockKey] ?? null;
    const base = createInspectionBase(lockKey, record, lockRecord);
    if (!(await isDirectory(record.packageDir))) {
        return completeInspection(base, {
            status: 'missing-package',
            message: `Skill package directory is missing: ${record.packageDir}`,
            diagnosticKind: 'package',
            severity: 'high',
        });
    }
    if (!(await isFile(record.skillFilePath))) {
        return completeInspection(base, {
            status: 'missing-skill-md',
            message: `Skill package is missing SKILL.md: ${record.skillFilePath}`,
            diagnosticKind: 'package',
            severity: 'high',
        });
    }
    const ownerMarker = await readOwnerMarker(record.packageOwnerMarkerPath);
    if (!ownerMarker) {
        return completeInspection({
            ...base,
            ownerMarker,
        }, {
            status: 'missing-owner-marker',
            message: `Skill package owner marker is missing or invalid: ${record.packageOwnerMarkerPath}`,
            diagnosticKind: 'owner-marker',
            severity: 'high',
        });
    }
    if (ownerMarker.packageId !== record.lockKey || ownerMarker.name !== record.name) {
        return completeInspection({
            ...base,
            ownerMarker,
        }, {
            status: 'invalid',
            message: `Skill package owner marker does not match installed record: ${record.packageOwnerMarkerPath}`,
            diagnosticKind: 'owner-marker',
            severity: 'high',
        });
    }
    if (!lockRecord) {
        return completeInspection({
            ...base,
            ownerMarker,
        }, {
            status: 'missing-lock',
            message: `Skill lock record is missing: ${record.lockKey}`,
            diagnosticKind: 'lock',
            severity: 'medium',
        });
    }
    const actualSkillMd = await hashFileSha256(record.skillFilePath);
    const actualPackageTree = (await hashSkillPackageTree(record.packageDir)).sha256;
    const expectedPackageTree = lockRecord.checksum.packageTree ?? null;
    const driftedPaths = [];
    if (actualSkillMd !== lockRecord.checksum.skillMd) {
        driftedPaths.push('skillMd');
    }
    if (expectedPackageTree !== null && actualPackageTree !== expectedPackageTree) {
        driftedPaths.push('packageTree');
    }
    const integrity = {
        algorithm: 'sha256',
        expectedSkillMd: lockRecord.checksum.skillMd,
        actualSkillMd,
        expectedPackageTree,
        actualPackageTree,
        drifted: driftedPaths.length > 0,
        driftedPaths,
    };
    if (integrity.drifted) {
        return completeInspection({
            ...base,
            ownerMarker,
            integrity,
            package: await loadInstalledSkillPackageOrNull(record, lockRecord),
        }, {
            status: 'drifted',
            message: `Skill package checksum drift detected: ${record.name}`,
            diagnosticKind: 'integrity',
            severity: 'high',
        });
    }
    try {
        const skillPackage = await loadInstalledSkillPackage(record, lockRecord);
        return completeInspection({
            ...base,
            ownerMarker,
            package: skillPackage,
            integrity,
        }, record.enabled
            ? {
                status: 'installed',
                message: `Skill is installed: ${record.name}`,
                diagnosticKind: 'package',
                severity: 'info',
            }
            : {
                status: 'disabled',
                message: `Skill is installed but disabled: ${record.name}`,
                diagnosticKind: 'package',
                severity: 'info',
            });
    }
    catch (error) {
        return completeInspection({
            ...base,
            ownerMarker,
            integrity,
            errors: [formatErrorMessage(error)],
        }, {
            status: 'invalid',
            message: `Skill package cannot be normalized: ${record.name}`,
            diagnosticKind: 'normalize',
            severity: 'high',
        });
    }
}
async function loadInstalledSkillPackageOrNull(record, lockRecord) {
    try {
        return await loadInstalledSkillPackage(record, lockRecord);
    }
    catch {
        return null;
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
function createInspectionBase(lockKey, record, lockRecord) {
    return {
        schemaVersion: 1,
        lockKey,
        name: record.name,
        scope: record.scope,
        status: 'invalid',
        statusMessage: 'Skill package inspection has not completed.',
        installedRecord: record,
        lockRecord,
        ownerMarker: null,
        package: null,
        integrity: {
            algorithm: 'sha256',
            expectedSkillMd: lockRecord?.checksum.skillMd ?? null,
            actualSkillMd: null,
            expectedPackageTree: lockRecord?.checksum.packageTree ?? null,
            actualPackageTree: null,
            drifted: false,
            driftedPaths: [],
        },
        errors: [],
        diagnostics: [],
    };
}
function completeInspection(inspection, result) {
    return {
        ...inspection,
        status: result.status,
        statusMessage: result.message,
        diagnostics: result.status === 'installed' || result.status === 'disabled'
            ? inspection.diagnostics
            : [
                ...inspection.diagnostics,
                {
                    kind: result.diagnosticKind,
                    severity: result.severity,
                    message: result.message,
                },
            ],
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
    catch {
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
export function summarizeInstalledSkillPackageInspections(inspections) {
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
export function compareInstalledSkillPackageInspections(a, b) {
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
//# sourceMappingURL=installedPackageInspection.js.map