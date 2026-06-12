import { cp, mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { setTimeout as sleep } from 'timers/promises';
import { jsonStringify } from '../../utils/slowOperations.js';
import { createCcrSkillInstallManifest, parseCcrSkillInstalledIndex, parseCcrSkillLockIndex, parseCcrSkillPackageOwnerMarker, } from './installManifest.js';
import { CCR_SKILL_PACKAGE_OWNER_MARKER_FILE } from './installPaths.js';
export async function applySkillInstallTransaction(input) {
    await stageAndReplacePackageDir({
        sourceDir: input.sourceDir,
        packageDir: input.packageDir,
        expectedOwner: {
            packageId: input.lockKey,
            name: input.plan.name,
        },
    });
    const ownerMarkerPath = join(input.packageDir, CCR_SKILL_PACKAGE_OWNER_MARKER_FILE);
    const installedAt = input.now.toISOString();
    const manifest = createCcrSkillInstallManifest(input.plan.manifestInput);
    const ownerMarker = parseCcrSkillPackageOwnerMarker({
        schemaVersion: 1,
        packageId: input.lockKey,
        name: input.plan.name,
        installedAt,
        source: input.plan.manifestInput.source,
        owner: 'ccr-skill-installer',
    });
    await writeJson(ownerMarkerPath, ownerMarker);
    const skillFilePath = join(input.packageDir, 'SKILL.md');
    const installedRecord = {
        schemaVersion: 1,
        name: input.plan.name,
        scope: input.plan.scope,
        installedAt,
        updatedAt: installedAt,
        manifest,
        packageDir: input.packageDir,
        skillFilePath,
        packageOwnerMarkerPath: ownerMarkerPath,
        enabled: manifest.defaults.enabled,
        modelInvocable: manifest.defaults.modelInvocable,
        userInvocable: manifest.defaults.userInvocable,
        lockKey: input.lockKey,
    };
    const lockRecord = {
        name: input.plan.name,
        scope: input.plan.scope,
        sourceKind: manifest.source.kind,
        packageDir: input.packageDir,
        skillFilePath,
        checksum: {
            algorithm: 'sha256',
            skillMd: input.checksum.skillMd,
            packageTree: input.checksum.packageTree,
        },
        originVendor: input.originVendor,
        updatedAt: installedAt,
    };
    const installedIndex = await readInstalledIndex(input.installedIndexPath);
    installedIndex.installed[input.lockKey] = installedRecord;
    await writeJson(input.installedIndexPath, installedIndex);
    const lockIndex = await readLockIndex(input.lockFilePath);
    lockIndex.locks[input.lockKey] = lockRecord;
    await writeJson(input.lockFilePath, lockIndex);
    return {
        ownerMarkerPath,
        installedRecord,
        lockRecord,
    };
}
export async function readInstalledIndex(path) {
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
export async function readLockIndex(path) {
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
export async function writeJson(path, value) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${jsonStringify(value, null, 2)}\n`, 'utf8');
}
async function stageAndReplacePackageDir(input) {
    const parentDir = dirname(input.packageDir);
    const baseName = input.packageDir.split(/[\\/]/).pop() ?? 'skill-package';
    const stagingDir = join(parentDir, `.${baseName}.install-staging`);
    const backupDir = join(parentDir, `.${baseName}.install-backup`);
    await mkdir(parentDir, { recursive: true });
    await rm(stagingDir, { recursive: true, force: true });
    await rm(backupDir, { recursive: true, force: true });
    await cp(input.sourceDir, stagingDir, {
        recursive: true,
        errorOnExist: true,
        force: false,
    });
    if (!existsSync(input.packageDir)) {
        await renameWithRetry(stagingDir, input.packageDir);
        return;
    }
    await assertExistingPackageIsInstallerOwned(input.packageDir, input.expectedOwner);
    await renameWithRetry(input.packageDir, backupDir);
    try {
        await renameWithRetry(stagingDir, input.packageDir);
    }
    catch (error) {
        if (!existsSync(input.packageDir) && existsSync(backupDir)) {
            await renameWithRetry(backupDir, input.packageDir);
        }
        throw error;
    }
    await rm(backupDir, { recursive: true, force: true });
}
async function assertExistingPackageIsInstallerOwned(packageDir, expectedOwner) {
    const ownerMarkerPath = join(packageDir, CCR_SKILL_PACKAGE_OWNER_MARKER_FILE);
    const ownerMarker = parseCcrSkillPackageOwnerMarker(JSON.parse(await readFile(ownerMarkerPath, 'utf8')));
    if (ownerMarker.owner !== 'ccr-skill-installer' ||
        ownerMarker.packageId !== expectedOwner.packageId ||
        ownerMarker.name !== expectedOwner.name) {
        throw new Error(`Skill package is not owned by CCR installer: ${packageDir}`);
    }
}
function getErrorCode(error) {
    return typeof error === 'object' && error != null && 'code' in error
        ? error.code
        : undefined;
}
async function renameWithRetry(from, to) {
    const delaysMs = [25, 50, 100, 200, 400, 800];
    for (let attempt = 0;; attempt += 1) {
        try {
            await rename(from, to);
            return;
        }
        catch (error) {
            if (attempt >= delaysMs.length ||
                !isRetryableRenameError(error)) {
                throw error;
            }
            await sleep(delaysMs[attempt]);
        }
    }
}
function isRetryableRenameError(error) {
    const code = getErrorCode(error);
    return (code === 'EPERM' ||
        code === 'EACCES' ||
        code === 'EBUSY' ||
        code === 'ENOTEMPTY');
}
//# sourceMappingURL=installTransaction.js.map