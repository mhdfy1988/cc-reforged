import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { InstalledPluginsFileSchemaV2, } from '../../utils/plugins/schemas.js';
import { cachePlugin, createPluginFromPath, getVersionedCachePathIn, } from '../../utils/plugins/pluginLoader.js';
import { calculatePluginVersion } from '../../utils/plugins/pluginVersioning.js';
import { acquirePluginScopeLock, atomicWriteJson, journalPath, readJsonOrNull, } from './pluginPersistence.js';
import { readPluginRegistryV2ForWrite } from './pluginRegistryCompatibility.js';
import { retainPreviousPluginVersions } from './pluginVersionLifecycle.js';
import { PluginLifecycleTransaction, } from './pluginLifecycleTransaction.js';
export class PluginInstallTransaction {
    materialize;
    injectFault;
    now;
    constructor(options = {}) {
        this.materialize = options.materialize ?? materializePluginPackage;
        this.injectFault = options.injectFault;
        this.now = options.now ?? (() => new Date());
    }
    async execute(context) {
        if (!['install', 'update', 'repair', 'rollback'].includes(context.plan.action) ||
            !context.plan.install) {
            throw transactionError('plugin-action-not-implemented', `Plugin action ${context.plan.action} is not implemented by the install transaction.`);
        }
        if (context.plan.target.scope === 'managed') {
            throw transactionError('plugin-managed-scope-read-only', 'Managed Plugin scope is read-only.');
        }
        const lock = await acquirePluginScopeLock(context.session, {
            operationId: context.operation.operationId,
            scope: context.plan.target.scope,
            workspaceRoot: context.plan.target.workspaceRoot,
        });
        try {
            const existing = await this.readJournal(context);
            if (existing) {
                return this.reconcileJournal(existing, context);
            }
            return await this.install(context);
        }
        finally {
            await lock.release();
        }
    }
    async reconcile(operationId, context) {
        const journal = await readJsonOrNull(journalPath(context.session, operationId));
        if (!journal) {
            throw transactionError('plugin-journal-not-found', `Plugin operation journal was not found: ${operationId}`);
        }
        const lock = await acquirePluginScopeLock(context.session, {
            operationId,
            scope: journal.target.scope,
            workspaceRoot: journal.target.workspaceRoot,
        });
        try {
            return await this.reconcileJournal(journal, context);
        }
        finally {
            await lock.release();
        }
    }
    async install(context) {
        const install = context.plan.install;
        const stagingRoot = join(context.session.paths.stagingDir, safeOperationSegment(context.operation.operationId));
        const now = this.now().toISOString();
        let journal = withJournalRevision({
            schemaVersion: 1,
            operationId: context.operation.operationId,
            planId: context.plan.planId,
            phase: 'created',
            target: {
                scope: context.plan.target.scope,
                ...(context.plan.target.workspaceRoot
                    ? { workspaceRoot: context.plan.target.workspaceRoot }
                    : {}),
            },
            enableAfterInstall: install.enableAfterInstall,
            action: context.plan.action,
            packages: [],
            retentionCommitted: false,
            registryCommitted: false,
            intentCommitted: false,
            completed: false,
            createdAt: now,
            updatedAt: now,
        });
        await this.writeJournal(context.session, journal);
        context.update({ phase: 'staging' });
        try {
            await rm(stagingRoot, { recursive: true, force: true });
            await mkdir(stagingRoot, { recursive: true });
            for (const packagePlan of install.packages) {
                if (context.isCancellationRequested()) {
                    throw transactionError('plugin-operation-cancelled', 'Plugin installation was cancelled before commit.');
                }
                const materialized = await this.materialize({
                    packagePlan,
                    stagingRoot: join(stagingRoot, safeOperationSegment(packagePlan.pluginId)),
                    session: context.session,
                });
                journal.packages.push({
                    pluginId: packagePlan.pluginId,
                    version: materialized.version,
                    stagedPath: materialized.stagedPath,
                    finalPath: getVersionedCachePathIn(context.session.paths.pluginsRootDir, packagePlan.pluginId, materialized.version),
                    ...(materialized.gitCommitSha
                        ? { gitCommitSha: materialized.gitCommitSha }
                        : {}),
                    committed: false,
                });
            }
            journal = await this.advance(context.session, journal, 'staged');
            await this.injectFault?.('after-stage');
        }
        catch (error) {
            await rm(stagingRoot, { recursive: true, force: true });
            journal = await this.failJournal(context.session, journal, error, false);
            throw error;
        }
        context.update({
            phase: 'committing-packages',
            commitBoundaryReached: true,
        });
        try {
            return await this.reconcileJournal(journal, context);
        }
        catch (error) {
            const current = (await this.readJournal(context)) ?? journal;
            await this.failJournal(context.session, current, error, true);
            throw error;
        }
    }
    async reconcileJournal(initial, context) {
        let journal = initial;
        if (journal.completed)
            return resultFromJournal(journal);
        context.update({
            phase: `reconcile:${journal.phase}`,
            commitBoundaryReached: journal.phase !== 'created' && journal.phase !== 'staged'
                ? true
                : context.operation.commitBoundaryReached,
        });
        for (const item of journal.packages) {
            if (item.committed)
                continue;
            if (await isDirectory(item.finalPath)) {
                item.committed = true;
                journal = await this.rewrite(context.session, journal);
                continue;
            }
            if (!(await isDirectory(item.stagedPath))) {
                throw transactionError('plugin-reconciliation-package-missing', `Neither staged nor final package exists for ${item.pluginId}.`);
            }
            await mkdir(dirname(item.finalPath), { recursive: true });
            await rename(item.stagedPath, item.finalPath);
            item.committed = true;
            journal = await this.rewrite(context.session, journal);
        }
        if (journal.phase === 'staged' || journal.phase === 'reconciliation-required') {
            journal = await this.advance(context.session, journal, 'packages-committed');
            await this.injectFault?.('after-packages-commit');
        }
        if ((journal.action === 'update' || journal.action === 'rollback') &&
            !journal.retentionCommitted) {
            await commitRollbackRetention(context.session, journal);
            journal.retentionCommitted = true;
            journal = await this.advance(context.session, journal, 'retention-committed');
        }
        if (!journal.registryCommitted) {
            await commitInstallationRegistry(context.session, journal);
            journal.registryCommitted = true;
            journal = await this.advance(context.session, journal, 'registry-committed');
            await this.injectFault?.('after-registry-commit');
        }
        if (journal.enableAfterInstall && !journal.intentCommitted) {
            await commitEnabledIntent(context.session, journal);
            journal.intentCommitted = true;
            journal = await this.advance(context.session, journal, 'intent-committed');
            await this.injectFault?.('after-intent-commit');
        }
        journal.intentCommitted =
            journal.intentCommitted || !journal.enableAfterInstall;
        journal.completed = true;
        journal = await this.advance(context.session, journal, 'completed');
        await rm(join(context.session.paths.stagingDir, safeOperationSegment(journal.operationId)), { recursive: true, force: true });
        return resultFromJournal(journal);
    }
    readJournal(context) {
        return readJsonOrNull(journalPath(context.session, context.operation.operationId));
    }
    async advance(session, journal, phase) {
        return this.rewrite(session, { ...journal, phase, error: undefined });
    }
    async rewrite(session, journal) {
        const next = withJournalRevision({
            ...journal,
            updatedAt: this.now().toISOString(),
        });
        await this.writeJournal(session, next);
        return next;
    }
    async failJournal(session, journal, error, reconciliationRequired) {
        return this.rewrite(session, {
            ...journal,
            phase: reconciliationRequired
                ? 'reconciliation-required'
                : journal.phase,
            error: {
                code: getErrorCode(error),
                message: error instanceof Error ? error.message : String(error),
            },
        });
    }
    writeJournal(session, journal) {
        return atomicWriteJson(journalPath(session, journal.operationId), journal);
    }
}
export function createPluginTransactionExecutor(options = {}) {
    const installTransaction = new PluginInstallTransaction(options);
    const lifecycleTransaction = new PluginLifecycleTransaction(options.lifecycle);
    return context => context.plan.action === 'enable' ||
        context.plan.action === 'disable' ||
        context.plan.action === 'uninstall'
        ? lifecycleTransaction.execute(context)
        : installTransaction.execute(context);
}
async function materializePluginPackage(input) {
    await mkdir(input.stagingRoot, { recursive: true });
    const cached = input.packagePlan.cachedPath
        ? await materializeCachedRollback(input)
        : await materializePackageSource(input);
    const loaded = await createPluginFromPath(cached.path, input.packagePlan.pluginId, false, pluginName(input.packagePlan.pluginId), input.packagePlan.strict);
    if (loaded.errors.length > 0) {
        throw transactionError('plugin-package-not-loadable', `Plugin ${input.packagePlan.pluginId} failed load validation: ${loaded.errors
            .map(error => error.type)
            .join(', ')}`);
    }
    if (loaded.plugin.name !== pluginName(input.packagePlan.pluginId)) {
        throw transactionError('plugin-package-name-mismatch', `Plugin package name ${loaded.plugin.name} does not match ${input.packagePlan.pluginId}.`);
    }
    const version = input.packagePlan.cachedPath
        ? input.packagePlan.version
        : await calculatePluginVersion(input.packagePlan.pluginId, resolvePackageSource(input.packagePlan), cached.manifest, cached.path, input.packagePlan.version, cached.gitCommitSha);
    return {
        stagedPath: cached.path,
        version,
        ...(cached.gitCommitSha ? { gitCommitSha: cached.gitCommitSha } : {}),
    };
}
async function materializeCachedRollback(input) {
    if (!input.packagePlan.cachedPath || !input.packagePlan.version) {
        throw transactionError('plugin-rollback-plan-invalid', 'Rollback package plan requires cachedPath and exact version.');
    }
    if (!input.packagePlan.manifest) {
        throw transactionError('plugin-rollback-plan-invalid', 'Rollback package plan requires a validated manifest.');
    }
    await rm(input.stagingRoot, { recursive: true, force: true });
    await cp(input.packagePlan.cachedPath, input.stagingRoot, {
        recursive: true,
        errorOnExist: true,
        force: false,
    });
    return {
        path: input.stagingRoot,
        manifest: input.packagePlan.manifest,
    };
}
async function materializePackageSource(input) {
    const source = resolvePackageSource(input.packagePlan);
    return cachePlugin(source, {
        ...(input.packagePlan.manifest
            ? { manifest: input.packagePlan.manifest }
            : {}),
        cachePath: input.stagingRoot,
    });
}
function resolvePackageSource(packagePlan) {
    if (!packagePlan.source) {
        throw transactionError('plugin-package-source-missing', `Plugin package source is missing for ${packagePlan.pluginId}.`);
    }
    if (typeof packagePlan.source !== 'string') {
        return packagePlan.source;
    }
    if (!packagePlan.marketplaceRoot) {
        throw transactionError('plugin-local-source-root-missing', `Marketplace root is required for local source ${packagePlan.source}.`);
    }
    const root = resolve(packagePlan.marketplaceRoot);
    const resolvedSource = resolve(root, packagePlan.source);
    const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
    if (resolvedSource !== root && !resolvedSource.startsWith(rootPrefix)) {
        throw transactionError('plugin-source-path-traversal', `Plugin source escapes its Marketplace root: ${packagePlan.source}`);
    }
    return resolvedSource;
}
async function commitRollbackRetention(session, journal) {
    const current = await readInstalledPluginsV2(session.paths.installedRegistryPath);
    const previous = journal.packages.flatMap(item => {
        const projectPath = journal.target.scope === 'project' || journal.target.scope === 'local'
            ? journal.target.workspaceRoot
            : undefined;
        const installation = (current.plugins[item.pluginId] ?? []).find(candidate => candidate.scope === journal.target.scope &&
            candidate.projectPath === projectPath);
        if (!installation ||
            !installation.version ||
            installation.version === item.version) {
            return [];
        }
        return [
            {
                pluginId: item.pluginId,
                version: installation.version,
                packagePath: installation.installPath,
            },
        ];
    });
    await retainPreviousPluginVersions(session, {
        operationId: journal.operationId,
        reason: journal.action === 'rollback' ? 'rollback' : 'update',
        previous,
        now: new Date(journal.updatedAt),
    });
}
async function commitInstallationRegistry(session, journal) {
    const current = await readInstalledPluginsV2(session.paths.installedRegistryPath);
    const now = journal.updatedAt;
    for (const item of journal.packages) {
        const projectPath = journal.target.scope === 'project' || journal.target.scope === 'local'
            ? journal.target.workspaceRoot
            : undefined;
        const entry = {
            scope: journal.target.scope,
            ...(projectPath ? { projectPath } : {}),
            installPath: item.finalPath,
            version: item.version,
            installedAt: now,
            lastUpdated: now,
            ...(item.gitCommitSha ? { gitCommitSha: item.gitCommitSha } : {}),
        };
        const installations = current.plugins[item.pluginId] ?? [];
        const index = installations.findIndex(installation => installation.scope === journal.target.scope &&
            installation.projectPath === projectPath);
        if (index >= 0)
            installations[index] = entry;
        else
            installations.push(entry);
        current.plugins[item.pluginId] = installations;
    }
    InstalledPluginsFileSchemaV2().parse(current);
    await atomicWriteJson(session.paths.installedRegistryPath, current);
}
async function commitEnabledIntent(session, journal) {
    const path = settingsPathForScope(session, journal.target.scope);
    const current = await readJsonOrNull(path);
    const settings = current ?? {};
    const enabledPlugins = settings.enabledPlugins &&
        typeof settings.enabledPlugins === 'object' &&
        !Array.isArray(settings.enabledPlugins)
        ? { ...settings.enabledPlugins }
        : {};
    for (const item of journal.packages)
        enabledPlugins[item.pluginId] = true;
    await atomicWriteJson(path, { ...settings, enabledPlugins });
}
async function readInstalledPluginsV2(path) {
    return readPluginRegistryV2ForWrite(path);
}
function settingsPathForScope(session, scope) {
    switch (scope) {
        case 'user':
            return session.paths.userSettingsPath;
        case 'project':
            return session.paths.projectSettingsPath;
        case 'local':
            return session.paths.localSettingsPath;
    }
}
async function isDirectory(path) {
    try {
        return (await stat(path)).isDirectory();
    }
    catch {
        return false;
    }
}
function resultFromJournal(journal) {
    return {
        installed: journal.packages.map(item => ({
            pluginId: item.pluginId,
            version: item.version,
            installPath: item.finalPath,
        })),
        enabled: journal.enableAfterInstall,
        journalRevision: journal.journalRevision,
    };
}
function withJournalRevision(journal) {
    const { journalRevision: _ignored, ...content } = journal;
    return {
        ...content,
        journalRevision: createHash('sha256')
            .update(JSON.stringify(content))
            .digest('hex')
            .slice(0, 16),
    };
}
function safeOperationSegment(value) {
    return createHash('sha256').update(value).digest('hex').slice(0, 24);
}
function pluginName(pluginId) {
    const separator = pluginId.lastIndexOf('@');
    return separator > 0 ? pluginId.slice(0, separator) : pluginId;
}
function transactionError(code, message) {
    return Object.assign(new Error(message), { code });
}
function getErrorCode(error) {
    return ((typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code) ||
        'plugin-install-transaction-failed');
}
//# sourceMappingURL=pluginInstallTransaction.js.map