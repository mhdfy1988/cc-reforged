import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { parseCcrSkillPackageOwnerMarker, parseCcrSkillInstalledIndex, parseCcrSkillLockIndex, } from '../services/skills/installManifest.js';
import { getCcrSkillInstallPaths } from '../services/skills/installPaths.js';
import { collectSkillResourceDirs } from '../services/skills/importDiscovery.js';
import { parseFrontmatter } from '../utils/frontmatterParser.js';
import { parseYaml } from '../utils/yaml.js';
import { normalizeSkillPackage } from './normalizeSkillPackage.js';
import { parseCcrSkillPackage } from './packageSchema.js';
import { evaluateInstalledSkillActivation, } from './skillActivationPolicy.js';
import { parseSkillFrontmatterFields } from './skillFrontmatter.js';
export async function loadInstalledSkillRuntimePackages(options = {}) {
    const paths = getCcrSkillInstallPaths(options.configHomeDir);
    const [installedIndex, lockIndex] = await Promise.all([
        readInstalledIndex(paths.installedIndexPath),
        readLockIndex(paths.lockFilePath),
    ]);
    const inspections = await Promise.all(Object.entries(installedIndex.installed).map(([lockKey, record]) => inspectInstalledRuntimeRecord(lockKey, record, lockIndex)));
    const entries = [];
    const diagnostics = [];
    for (const inspection of inspections) {
        const activation = evaluateInstalledSkillActivation(inspection);
        diagnostics.push(...activation.diagnostics);
        if (!activation.runtimeVisible || !inspection.package) {
            continue;
        }
        entries.push({
            package: applyRuntimeActivation(inspection.package, inspection, activation),
            inspection,
            activation,
        });
    }
    return {
        schemaVersion: 1,
        entries,
        inspections: inspections.sort(compareRuntimeInspections),
        diagnostics,
        summary: summarizeRuntimeInspections(inspections),
    };
}
async function inspectInstalledRuntimeRecord(lockKey, record, lockIndex) {
    const lockRecord = lockIndex.locks[record.lockKey] ?? null;
    const base = createInspectionBase(lockKey, record, lockRecord);
    if (!(await isDirectory(record.packageDir))) {
        return completeInspection(base, {
            status: 'missing-package',
            message: `Skill package directory is missing: ${record.packageDir}`,
        });
    }
    if (!(await isFile(record.skillFilePath))) {
        return completeInspection(base, {
            status: 'missing-skill-md',
            message: `Skill package is missing SKILL.md: ${record.skillFilePath}`,
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
        });
    }
    if (ownerMarker.packageId !== record.lockKey || ownerMarker.name !== record.name) {
        return completeInspection({
            ...base,
            ownerMarker,
        }, {
            status: 'invalid',
            message: `Skill package owner marker does not match installed record: ${record.packageOwnerMarkerPath}`,
        });
    }
    if (!lockRecord) {
        return completeInspection({
            ...base,
            ownerMarker,
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
        return completeInspection({
            ...base,
            ownerMarker,
            checksum,
        }, {
            status: 'drifted',
            message: `Skill package checksum drift detected: ${record.name}`,
        });
    }
    try {
        const skillPackage = await loadManagedSkillPackage(record, lockRecord);
        return completeInspection({
            ...base,
            ownerMarker,
            package: skillPackage,
            checksum,
        }, record.enabled
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
            errors: [formatErrorMessage(error)],
        }, {
            status: 'invalid',
            message: `Skill package cannot be normalized: ${record.name}`,
        });
    }
}
async function loadManagedSkillPackage(record, lockRecord) {
    const rawMarkdown = await readFile(record.skillFilePath, 'utf8');
    const { frontmatter, content } = parseFrontmatter(rawMarkdown, record.skillFilePath);
    const parsed = parseSkillFrontmatterFields(frontmatter, content, record.name, 'Skill');
    const risks = [];
    const resources = await collectSkillResourceDirs(record.packageDir, risks);
    const openaiYaml = await readOptionalOpenAiYaml(record.packageDir, risks);
    return normalizeSkillPackage({
        id: `managed:${record.lockKey}:${record.skillFilePath}`,
        skillName: record.name,
        markdownContent: content,
        frontmatter,
        parsed,
        source: 'managed',
        filePath: record.skillFilePath,
        baseDir: record.packageDir,
        resources,
        openaiYaml,
        compatibilityHints: {
            vendor: record.manifest.compatibility?.vendor ?? lockRecord.originVendor,
            importedFrom: getInstalledSourcePath(record),
            legacyCommand: record.manifest.compatibility?.convertedFromCommand ?? false,
        },
    });
}
function applyRuntimeActivation(skillPackage, inspection, activation) {
    const warnings = [
        ...skillPackage.compatibility.warnings,
        ...activation.diagnostics.map(diagnostic => diagnostic.message),
    ];
    return parseCcrSkillPackage({
        ...skillPackage,
        id: `managed:${inspection.installedRecord.lockKey}:${inspection.installedRecord.skillFilePath}`,
        source: 'managed',
        bodyPath: inspection.installedRecord.skillFilePath,
        baseDir: inspection.installedRecord.packageDir,
        origin: {
            ...skillPackage.origin,
            sourcePath: inspection.installedRecord.skillFilePath,
            importedFrom: getInstalledSourcePath(inspection.installedRecord),
        },
        invocation: {
            ...skillPackage.invocation,
            modelInvocable: activation.modelInvocable,
            userInvocable: activation.userInvocable,
        },
        compatibility: {
            ...skillPackage.compatibility,
            warnings,
        },
    });
}
function createInspectionBase(lockKey, record, lockRecord) {
    return {
        schemaVersion: 1,
        lockKey,
        name: record.name,
        scope: record.scope,
        status: 'invalid',
        statusMessage: 'Skill runtime inspection has not completed.',
        installedRecord: record,
        lockRecord,
        ownerMarker: null,
        package: null,
        checksum: {
            algorithm: 'sha256',
            expectedSkillMd: lockRecord?.checksum.skillMd ?? null,
            actualSkillMd: null,
            drifted: false,
        },
        errors: [],
    };
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
async function readOptionalOpenAiYaml(skillDir, risks) {
    try {
        return parseYaml(await readFile(join(skillDir, 'agents', 'openai.yaml'), 'utf8'));
    }
    catch (error) {
        if (getErrorCode(error) !== 'ENOENT') {
            risks.push(`Failed to read agents/openai.yaml: ${formatErrorMessage(error)}`);
        }
        return undefined;
    }
}
function getInstalledSourcePath(record) {
    if (record.manifest.source.kind === 'imported-skill') {
        return record.manifest.source.path;
    }
    if (record.manifest.source.kind === 'local-manifest') {
        return record.manifest.source.path;
    }
    return record.packageDir;
}
function summarizeRuntimeInspections(inspections) {
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
function compareRuntimeInspections(a, b) {
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
//# sourceMappingURL=installedSkillLoader.js.map