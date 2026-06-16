import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile, } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { createPluginFromPath } from '../../utils/plugins/pluginLoader.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { extractZipToDirectory } from '../../utils/plugins/zipCache.js';
import { stripBOM } from '../../utils/jsonRead.js';
import { createPluginTransactionExecutor, } from './pluginInstallTransaction.js';
export class PluginLocalImportService {
    executor = createPluginTransactionExecutor();
    async importLocal(session, request) {
        const importPath = resolve(request.path);
        const prepared = await prepareLocalPluginRoot(session, importPath, request.kind);
        try {
            const loaded = await createPluginFromPath(prepared.pluginRoot, 'local-import', false, basename(prepared.pluginRoot), true);
            if (loaded.errors.length > 0) {
                throw pluginLocalImportError('plugin-local-import-invalid-package', `Plugin 包校验失败：${loaded.errors.map(error => error.type).join(', ')}`);
            }
            const pluginId = `${loaded.plugin.name}@local-import`;
            const now = new Date();
            const plan = createLocalInstallPlan({
                session,
                pluginId,
                pluginRoot: prepared.pluginRoot,
                manifest: loaded.plugin.manifest,
                enableAfterInstall: request.enableAfterInstall !== false,
                issuedAt: now,
            });
            const operation = createLocalImportOperation(plan, now);
            try {
                const result = await this.executor(createExecutionContext(plan, operation, session));
                operation.status = 'succeeded';
                operation.phase = 'completed';
                operation.result = result;
                operation.updatedAt = new Date().toISOString();
                clearAllCaches();
                return { pluginId, operation: structuredClone(operation) };
            }
            catch (error) {
                operation.status = 'failed';
                operation.phase = 'failed';
                operation.error = {
                    code: getErrorCode(error),
                    message: error instanceof Error ? error.message : String(error),
                };
                operation.updatedAt = new Date().toISOString();
                throw error;
            }
        }
        finally {
            for (const cleanupRoot of prepared.cleanupRoots) {
                await rm(cleanupRoot, { recursive: true, force: true });
            }
        }
    }
}
function createLocalInstallPlan(input) {
    const expiresAt = new Date(input.issuedAt.getTime() + 5 * 60 * 1000);
    return {
        schemaVersion: 1,
        planId: `plugin-plan:${randomUUID()}`,
        issuedAt: input.issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        allowed: true,
        action: 'install',
        target: {
            pluginId: input.pluginId,
            scope: 'user',
            sourceId: 'local-import',
        },
        context: {
            workspaceRoot: input.session.context.workspaceRoot,
            currentCwd: input.session.context.currentCwd,
            configHomeDir: input.session.context.configHomeDir,
            runtimeInstanceId: input.session.context.runtimeInstanceId,
        },
        revisions: {
            catalog: 'local-import',
            plugin: 'local-import',
            installations: [],
            runtime: [],
        },
        dependencies: {
            direct: [],
            required: [],
            reverseDependents: [],
            crossMarketplaceEdges: [],
            semverSupport: 'exact-version-only',
        },
        install: {
            mode: 'install',
            enableAfterInstall: input.enableAfterInstall,
            packages: [
                {
                    pluginId: input.pluginId,
                    sourceId: 'local-import',
                    source: `./${basename(input.pluginRoot)}`,
                    marketplaceRoot: dirname(input.pluginRoot),
                    strict: true,
                    manifest: input.manifest,
                },
            ],
        },
        effects: [
            {
                kind: 'materialize-package',
                description: 'Stage and validate the local Plugin package.',
            },
            {
                kind: 'write-installation',
                description: 'Create the user-scope installation record.',
            },
            ...(input.enableAfterInstall
                ? [
                    {
                        kind: 'write-intent',
                        description: 'Enable the Plugin after import.',
                    },
                ]
                : []),
        ],
        risks: ['local-package-import'],
        deleteOptions: {
            removeData: false,
            removeOptions: false,
            removeSecrets: false,
        },
        requiresConfirmation: false,
    };
}
function createLocalImportOperation(plan, now) {
    return {
        schemaVersion: 1,
        operationId: `plugin-operation:${randomUUID()}`,
        planId: plan.planId,
        action: 'install',
        target: structuredClone(plan.target),
        status: 'running',
        phase: 'preparing',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        cancellationRequested: false,
        commitBoundaryReached: false,
    };
}
function createExecutionContext(plan, operation, session) {
    return {
        plan,
        operation,
        session,
        update(input) {
            if (input.phase)
                operation.phase = input.phase;
            if (input.commitBoundaryReached !== undefined) {
                operation.commitBoundaryReached = input.commitBoundaryReached;
            }
            operation.updatedAt = new Date().toISOString();
        },
        isCancellationRequested() {
            return false;
        },
    };
}
async function prepareLocalPluginRoot(session, importPath, kind) {
    const sourceStat = await stat(importPath).catch(() => null);
    if (!sourceStat) {
        throw pluginLocalImportError('plugin-local-import-path-not-found', `Plugin 导入路径不存在：${importPath}`);
    }
    if (kind === 'directory') {
        if (!sourceStat.isDirectory()) {
            throw pluginLocalImportError('plugin-local-import-not-directory', `请选择 Plugin 文件夹：${importPath}`);
        }
        return resolvePluginRoot(session, importPath);
    }
    if (!sourceStat.isFile()) {
        throw pluginLocalImportError('plugin-local-import-not-archive', `请选择 Plugin 压缩包：${importPath}`);
    }
    if (extname(importPath).toLowerCase() !== '.zip') {
        throw pluginLocalImportError('plugin-local-import-unsupported-archive', '当前只支持 .zip Plugin 压缩包。');
    }
    await mkdir(session.paths.stagingDir, { recursive: true });
    const cleanupRoot = await mkdtemp(join(session.paths.stagingDir, 'local-import-'));
    const extractRoot = join(cleanupRoot, 'package');
    await extractZipToDirectory(importPath, extractRoot);
    const resolved = await resolvePluginRoot(session, extractRoot);
    return {
        pluginRoot: resolved.pluginRoot,
        cleanupRoots: [cleanupRoot, ...resolved.cleanupRoots],
    };
}
async function resolvePluginRoot(session, path) {
    const resolved = resolve(path);
    const directCandidate = await getPluginRootCandidate(resolved);
    if (directCandidate)
        return preparePluginRootCandidate(session, directCandidate);
    if (await hasCodexPluginManifest(resolved)) {
        throw pluginLocalImportError('plugin-local-import-codex-manifest', '检测到 .codex-plugin/plugin.json，但当前 CCR Plugin 包标准是根目录 plugin.json 或 .claude-plugin/plugin.json。');
    }
    const entries = await readdir(resolved, { withFileTypes: true });
    if (entries.length === 0) {
        throw pluginLocalImportError('plugin-local-import-empty-root', `所选目录是空的，不是 Plugin 包：${resolved}。请选择包含 plugin.json 的 Plugin 根目录，或切换为压缩包导入 .zip。`);
    }
    const candidates = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const child = join(resolved, entry.name);
        const childCandidate = await getPluginRootCandidate(child);
        if (childCandidate)
            candidates.push(childCandidate);
    }
    if (candidates.length === 1) {
        return preparePluginRootCandidate(session, candidates[0]);
    }
    if (candidates.length > 1) {
        throw pluginLocalImportError('plugin-local-import-ambiguous-root', '压缩包或文件夹内包含多个 Plugin，请选择单个 Plugin 文件夹。');
    }
    throw pluginLocalImportError('plugin-local-import-manifest-missing', `所选内容不是标准 Plugin 包：未找到 plugin.json 或 .claude-plugin/plugin.json。请选择 Plugin 根目录，或选择包含单个 Plugin 根目录的 .zip 压缩包。当前选择：${resolved}`);
}
async function getPluginRootCandidate(path) {
    if (await hasStandardPluginManifest(path)) {
        return { pluginRoot: path, manifestKind: 'standard' };
    }
    if (await hasRootPluginManifest(path)) {
        return { pluginRoot: path, manifestKind: 'root' };
    }
    return null;
}
async function preparePluginRootCandidate(session, candidate) {
    if (candidate.manifestKind === 'standard') {
        return { pluginRoot: candidate.pluginRoot, cleanupRoots: [] };
    }
    return normalizeRootManifestPlugin(session, candidate.pluginRoot);
}
async function normalizeRootManifestPlugin(session, pluginRoot) {
    await mkdir(session.paths.stagingDir, { recursive: true });
    const cleanupRoot = await mkdtemp(join(session.paths.stagingDir, 'local-import-root-'));
    const normalizedRoot = join(cleanupRoot, basename(pluginRoot));
    await cp(pluginRoot, normalizedRoot, {
        recursive: true,
        errorOnExist: true,
        force: false,
    });
    const rootManifestPath = join(normalizedRoot, 'plugin.json');
    const standardManifestDir = join(normalizedRoot, '.claude-plugin');
    await mkdir(standardManifestDir, { recursive: true });
    const manifestContent = await readFile(rootManifestPath, 'utf8');
    await writeFile(join(standardManifestDir, 'plugin.json'), stripBOM(manifestContent), 'utf8');
    return { pluginRoot: normalizedRoot, cleanupRoots: [cleanupRoot] };
}
async function hasStandardPluginManifest(path) {
    const manifest = join(path, '.claude-plugin', 'plugin.json');
    return (await stat(manifest).catch(() => null))?.isFile() === true;
}
async function hasRootPluginManifest(path) {
    return (await stat(join(path, 'plugin.json')).catch(() => null))?.isFile() === true;
}
async function hasCodexPluginManifest(path) {
    return ((await stat(join(path, '.codex-plugin', 'plugin.json')).catch(() => null))
        ?.isFile() === true);
}
function pluginLocalImportError(code, message) {
    return Object.assign(new Error(message), { code });
}
function getErrorCode(error) {
    return ((error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code) ||
        'plugin-local-import-failed');
}
//# sourceMappingURL=pluginLocalImportService.js.map