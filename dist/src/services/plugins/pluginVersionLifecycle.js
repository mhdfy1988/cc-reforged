import { createHash } from 'node:crypto';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getVersionedCachePathIn } from '../../utils/plugins/pluginLoader.js';
import { atomicWriteJson, readJsonOrNull, } from './pluginPersistence.js';
export function analyzePluginDependencies(catalog, pluginId) {
    const dependenciesByPlugin = new Map();
    const trustByMarketplace = new Map();
    for (const candidate of catalog.candidates) {
        const marketplace = pluginMarketplace(candidate.pluginId);
        if (marketplace) {
            const trusted = trustByMarketplace.get(marketplace) ?? new Set();
            for (const item of candidate.allowCrossMarketplaceDependenciesOn ?? []) {
                trusted.add(item);
            }
            trustByMarketplace.set(marketplace, trusted);
        }
    }
    for (const record of catalog.plugins) {
        const manifests = [
            ...record.installations.flatMap(installation => installation.manifest ? [installation.manifest] : []),
            ...record.candidates.flatMap(candidate => candidate.manifest ? [candidate.manifest] : []),
        ];
        const dependencies = dependenciesByPlugin.get(record.pluginId) ??
            new Set();
        for (const manifest of manifests) {
            for (const dependency of manifest.dependencies ?? []) {
                dependencies.add(qualifyDependency(dependency, record.pluginId));
            }
        }
        dependenciesByPlugin.set(record.pluginId, dependencies);
    }
    const directDependencies = [
        ...(dependenciesByPlugin.get(pluginId) ?? new Set()),
    ].sort();
    const transitive = new Set();
    const walk = (current) => {
        for (const dependency of dependenciesByPlugin.get(current) ?? []) {
            if (transitive.has(dependency))
                continue;
            transitive.add(dependency);
            walk(dependency);
        }
    };
    walk(pluginId);
    const reverseDependents = [...dependenciesByPlugin.entries()]
        .filter(([candidateId, dependencies]) => candidateId !== pluginId && dependencies.has(pluginId))
        .map(([candidateId]) => candidateId)
        .sort();
    const crossMarketplaceEdges = [...dependenciesByPlugin.entries()]
        .flatMap(([from, dependencies]) => [...dependencies].flatMap(to => {
        const fromMarketplace = pluginMarketplace(from);
        const toMarketplace = pluginMarketplace(to);
        if (!fromMarketplace ||
            !toMarketplace ||
            fromMarketplace === toMarketplace) {
            return [];
        }
        return [
            {
                from,
                to,
                trusted: trustByMarketplace.get(fromMarketplace)?.has(toMarketplace) ??
                    false,
            },
        ];
    }))
        .sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`));
    return {
        directDependencies,
        transitiveDependencies: [...transitive].sort(),
        reverseDependents,
        crossMarketplaceEdges,
        semverSupport: 'exact-version-only',
    };
}
export async function createRollbackPackagePlan(session, record, target) {
    if (!target.version) {
        throw lifecycleError('plugin-rollback-version-required', 'Rollback requires an exact cached target version.');
    }
    const installation = record.installations.find(item => item.applicableToRequest &&
        item.target.scope === target.scope &&
        item.target.workspaceRoot ===
            (target.scope === 'project' || target.scope === 'local'
                ? session.context.workspaceRoot
                : undefined));
    if (!installation) {
        throw lifecycleError('plugin-rollback-installation-not-found', 'Rollback target installation was not found.');
    }
    if (installation.installedVersion === target.version) {
        throw lifecycleError('plugin-rollback-version-current', 'Rollback target version is already installed.');
    }
    const cachedPath = getVersionedCachePathIn(session.paths.pluginsRootDir, target.pluginId, target.version);
    if (!(await isDirectory(cachedPath))) {
        throw lifecycleError('plugin-rollback-cache-missing', `Cached rollback version does not exist: ${target.version}.`);
    }
    const inspection = await session.packages.inspect({
        pluginId: target.pluginId,
        scope: target.scope,
        ...(target.scope === 'project' || target.scope === 'local'
            ? { projectPath: session.context.workspaceRoot }
            : {}),
        installPath: cachedPath,
        version: target.version,
    });
    if (inspection.materialization !== 'present' || !inspection.manifest) {
        throw lifecycleError('plugin-rollback-cache-invalid', `Cached rollback version is not a valid Plugin package: ${target.version}.`);
    }
    return {
        pluginId: target.pluginId,
        sourceId: 'rollback-cache',
        version: target.version,
        cachedPath,
        strict: true,
        manifest: inspection.manifest,
    };
}
export async function retainPreviousPluginVersions(session, input) {
    const now = input.now ?? new Date();
    const retentionMs = input.retentionMs ?? 7 * 24 * 60 * 60 * 1000;
    const current = (await readJsonOrNull(session.paths.retentionPath)) ?? { schemaVersion: 1, records: [] };
    const records = current.records.filter(record => Date.parse(record.expiresAt) > now.getTime());
    const added = input.previous.flatMap(item => {
        if (!item.version)
            return [];
        const record = {
            retentionId: createHash('sha256')
                .update([
                item.pluginId,
                item.version,
                item.packagePath,
                input.operationId,
            ].join('::'))
                .digest('hex')
                .slice(0, 24),
            pluginId: item.pluginId,
            version: item.version,
            packagePath: item.packagePath,
            reason: input.reason,
            operationId: input.operationId,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + retentionMs).toISOString(),
        };
        return [record];
    });
    const merged = new Map([...records, ...added].map(record => [record.retentionId, record]));
    await atomicWriteJson(session.paths.retentionPath, {
        schemaVersion: 1,
        records: [...merged.values()],
    });
    return added;
}
export async function collectPluginCacheGarbage(session, options = {}) {
    const now = options.now ?? new Date();
    const references = new Map();
    const addReference = (path, reason) => {
        if (!path)
            return;
        const reasons = references.get(path) ?? new Set();
        reasons.add(reason);
        references.set(path, reasons);
    };
    const [installations, runtime, retention, operations, journals] = await Promise.all([
        session.installations.read(),
        session.runtime.read(),
        readJsonOrNull(session.paths.retentionPath),
        readJsonFiles(session.paths.operationStoreDir),
        readJsonFiles(session.paths.journalDir),
    ]);
    for (const entry of installations.entries) {
        addReference(entry.installPath, 'installation');
    }
    for (const activation of runtime.activations) {
        if (!activation.activeVersion)
            continue;
        addReference(getVersionedCachePathIn(session.paths.pluginsRootDir, activation.pluginId, activation.activeVersion), 'runtime');
    }
    for (const record of retention?.records ?? []) {
        if (Date.parse(record.expiresAt) > now.getTime()) {
            addReference(record.packagePath, 'rollback-retention');
        }
    }
    for (const operation of operations) {
        if (operation &&
            typeof operation === 'object' &&
            'status' in operation &&
            (operation.status === 'pending' || operation.status === 'running')) {
            for (const path of extractPaths(operation)) {
                addReference(path, 'operation');
            }
        }
    }
    for (const journal of journals) {
        if (journal &&
            typeof journal === 'object' &&
            !('completed' in journal && journal.completed === true)) {
            for (const path of extractPaths(journal)) {
                addReference(path, 'journal');
            }
        }
    }
    const result = {
        deleted: [],
        retained: [],
    };
    for (const versionPath of await listVersionDirectories(session.paths.packageCacheDir)) {
        const reasons = references.get(versionPath);
        if (reasons) {
            result.retained.push({
                path: versionPath,
                reasons: [...reasons].sort(),
            });
            continue;
        }
        if (options.delete) {
            await rm(versionPath, { recursive: true, force: true });
        }
        result.deleted.push(versionPath);
    }
    return result;
}
async function listVersionDirectories(cacheRoot) {
    const result = [];
    for (const marketplace of await readDirectories(cacheRoot)) {
        for (const plugin of await readDirectories(join(cacheRoot, marketplace))) {
            const pluginRoot = join(cacheRoot, marketplace, plugin);
            for (const version of await readDirectories(pluginRoot)) {
                result.push(join(pluginRoot, version));
            }
        }
    }
    return result;
}
async function readDirectories(path) {
    try {
        return (await readdir(path, { withFileTypes: true }))
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT')
            return [];
        throw error;
    }
}
async function readJsonFiles(path) {
    const entries = await readDirectoriesAndFiles(path);
    return Promise.all(entries
        .filter(entry => entry.endsWith('.json'))
        .map(entry => readJsonOrNull(join(path, entry))));
}
async function readDirectoriesAndFiles(path) {
    try {
        return await readdir(path);
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT')
            return [];
        throw error;
    }
}
function extractPaths(value) {
    if (Array.isArray(value))
        return value.flatMap(extractPaths);
    if (!value || typeof value !== 'object')
        return [];
    return Object.entries(value).flatMap(([key, item]) => {
        if (typeof item === 'string' &&
            (key === 'finalPath' ||
                key === 'stagedPath' ||
                key === 'installPath' ||
                key === 'packagePath')) {
            return [item];
        }
        return extractPaths(item);
    });
}
async function isDirectory(path) {
    try {
        return (await stat(path)).isDirectory();
    }
    catch {
        return false;
    }
}
function qualifyDependency(dependency, declaringId) {
    if (pluginMarketplace(dependency))
        return dependency;
    const marketplace = pluginMarketplace(declaringId);
    return marketplace ? `${dependency}@${marketplace}` : dependency;
}
function pluginMarketplace(pluginId) {
    const separator = pluginId.lastIndexOf('@');
    return separator > 0 ? pluginId.slice(separator + 1) : undefined;
}
function getErrorCode(error) {
    return typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
}
function lifecycleError(code, message) {
    return Object.assign(new Error(message), { code });
}
//# sourceMappingURL=pluginVersionLifecycle.js.map