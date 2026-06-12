import { createHash } from 'node:crypto';
import { InstalledPluginsFileSchemaV2, } from '../../utils/plugins/schemas.js';
import { PluginConfigurationService } from './pluginConfigurationService.js';
import { createPluginDomainSession, } from './pluginDomainSession.js';
import { acquirePluginScopeLock, atomicWriteJson, journalPath, readJsonOrNull, } from './pluginPersistence.js';
import { readPluginRegistryV2ForWrite } from './pluginRegistryCompatibility.js';
import { collectPluginCacheGarbage } from './pluginVersionLifecycle.js';
export class PluginLifecycleTransaction {
    configuration = new PluginConfigurationService();
    injectFault;
    now;
    constructor(options = {}) {
        this.injectFault = options.injectFault;
        this.now = options.now ?? (() => new Date());
    }
    async execute(context) {
        if (context.plan.action !== 'enable' &&
            context.plan.action !== 'disable' &&
            context.plan.action !== 'uninstall') {
            throw lifecycleError('plugin-action-not-implemented', `Plugin action ${context.plan.action} is not implemented by the lifecycle transaction.`);
        }
        if (context.plan.target.scope === 'managed') {
            throw lifecycleError('plugin-managed-scope-read-only', 'Managed Plugin scope is read-only.');
        }
        const lock = await acquirePluginScopeLock(context.session, {
            operationId: context.operation.operationId,
            scope: context.plan.target.scope,
            workspaceRoot: context.plan.target.workspaceRoot,
        });
        try {
            const existing = await this.readJournal(context);
            if (existing)
                return this.reconcileJournal(existing, context);
            return this.start(context);
        }
        finally {
            await lock.release();
        }
    }
    async reconcile(operationId, context) {
        const journal = await readJsonOrNull(journalPath(context.session, operationId));
        if (!journal) {
            throw lifecycleError('plugin-journal-not-found', `Plugin operation journal was not found: ${operationId}`);
        }
        const lock = await acquirePluginScopeLock(context.session, {
            operationId,
            scope: journal.target.scope,
            workspaceRoot: journal.target.workspaceRoot,
        });
        try {
            return this.reconcileJournal(journal, context);
        }
        finally {
            await lock.release();
        }
    }
    async start(context) {
        if (context.isCancellationRequested()) {
            throw lifecycleError('plugin-operation-cancelled', 'Plugin lifecycle operation was cancelled before commit.');
        }
        const now = this.now().toISOString();
        const targetScope = context.plan.target.scope;
        const journal = withJournalRevision({
            schemaVersion: 1,
            operationId: context.operation.operationId,
            planId: context.plan.planId,
            action: context.plan.action,
            phase: 'created',
            target: {
                pluginId: context.plan.target.pluginId,
                scope: targetScope,
                ...(context.plan.target.workspaceRoot
                    ? { workspaceRoot: context.plan.target.workspaceRoot }
                    : {}),
            },
            deleteOptions: structuredClone(context.plan.deleteOptions),
            intentCommitted: false,
            registryCommitted: context.plan.action !== 'uninstall',
            configurationCommitted: context.plan.action !== 'uninstall',
            gcCompleted: context.plan.action !== 'uninstall',
            completed: false,
            createdAt: now,
            updatedAt: now,
        });
        await this.writeJournal(context.session, journal);
        context.update({
            phase: 'committing-lifecycle',
            commitBoundaryReached: true,
        });
        try {
            return await this.reconcileJournal(journal, context);
        }
        catch (error) {
            const current = (await this.readJournal(context)) ?? journal;
            await this.failJournal(context.session, current, error);
            throw error;
        }
    }
    async reconcileJournal(initial, context) {
        let journal = initial;
        if (journal.completed)
            return resultFromJournal(journal);
        context.update({
            phase: `reconcile:${journal.phase}`,
            commitBoundaryReached: journal.phase !== 'created',
        });
        if (!journal.intentCommitted) {
            await commitPluginIntent(context.session, journal);
            journal.intentCommitted = true;
            journal = await this.advance(context.session, journal, 'intent-committed');
            await this.injectFault?.('after-intent-commit');
        }
        if (journal.action === 'uninstall' && !journal.registryCommitted) {
            journal.releasedPackagePath = await removeInstallation(context.session, journal);
            journal.registryCommitted = true;
            journal = await this.advance(context.session, journal, 'registry-committed');
            await this.injectFault?.('after-registry-commit');
        }
        if (journal.action === 'uninstall' &&
            !journal.configurationCommitted) {
            await this.configuration.delete(context.session, {
                identity: {
                    pluginId: journal.target.pluginId,
                    scope: journal.target.scope,
                    ...(journal.target.workspaceRoot
                        ? { workspaceRoot: journal.target.workspaceRoot }
                        : {}),
                },
                ...journal.deleteOptions,
            });
            journal.configurationCommitted = true;
            journal = await this.advance(context.session, journal, 'configuration-committed');
            await this.injectFault?.('after-configuration-commit');
        }
        if (journal.action === 'uninstall' && !journal.gcCompleted) {
            const gcSession = createPluginDomainSession({
                ...context.session.context,
                requestId: `${context.session.context.requestId}:gc`,
            });
            journal.garbageCollection = await collectPluginCacheGarbage(gcSession, { delete: true });
            journal.gcCompleted = true;
            journal = await this.advance(context.session, journal, 'gc-completed');
            await this.injectFault?.('after-gc');
        }
        journal.completed = true;
        journal = await this.advance(context.session, journal, 'completed');
        return resultFromJournal(journal);
    }
    readJournal(context) {
        return readJsonOrNull(journalPath(context.session, context.operation.operationId));
    }
    advance(session, journal, phase) {
        return this.rewrite(session, {
            ...journal,
            phase,
            error: undefined,
        });
    }
    async failJournal(session, journal, error) {
        return this.rewrite(session, {
            ...journal,
            phase: 'reconciliation-required',
            error: {
                code: getErrorCode(error),
                message: error instanceof Error ? error.message : String(error),
            },
        });
    }
    async rewrite(session, journal) {
        const next = withJournalRevision({
            ...journal,
            updatedAt: this.now().toISOString(),
        });
        await this.writeJournal(session, next);
        return next;
    }
    writeJournal(session, journal) {
        return atomicWriteJson(journalPath(session, journal.operationId), journal);
    }
}
export function createPluginLifecycleExecutor(options = {}) {
    const transaction = new PluginLifecycleTransaction(options);
    return context => transaction.execute(context);
}
async function commitPluginIntent(session, journal) {
    const path = settingsPathForScope(session, journal.target.scope);
    const settings = (await readJsonOrNull(path)) ?? {};
    const enabledPlugins = asRecord(settings.enabledPlugins);
    const nextEnabledPlugins = { ...enabledPlugins };
    if (journal.action === 'uninstall') {
        delete nextEnabledPlugins[journal.target.pluginId];
    }
    else {
        nextEnabledPlugins[journal.target.pluginId] =
            journal.action === 'enable';
    }
    await atomicWriteJson(path, {
        ...settings,
        ...(Object.keys(nextEnabledPlugins).length > 0
            ? { enabledPlugins: nextEnabledPlugins }
            : { enabledPlugins: undefined }),
    });
}
async function removeInstallation(session, journal) {
    const current = await readInstalledPluginsV2(session.paths.installedRegistryPath);
    const installations = current.plugins[journal.target.pluginId] ?? [];
    const projectPath = journal.target.scope === 'project' || journal.target.scope === 'local'
        ? journal.target.workspaceRoot
        : undefined;
    const selected = installations.find(installation => installation.scope === journal.target.scope &&
        installation.projectPath === projectPath);
    if (!selected) {
        return undefined;
    }
    const remaining = installations.filter(installation => !(installation.scope === journal.target.scope &&
        installation.projectPath === projectPath));
    if (remaining.length > 0) {
        current.plugins[journal.target.pluginId] = remaining;
    }
    else {
        delete current.plugins[journal.target.pluginId];
    }
    InstalledPluginsFileSchemaV2().parse(current);
    await atomicWriteJson(session.paths.installedRegistryPath, current);
    return selected.installPath;
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
function resultFromJournal(journal) {
    return {
        action: journal.action,
        pluginId: journal.target.pluginId,
        scope: journal.target.scope,
        enabled: journal.action === 'enable'
            ? true
            : journal.action === 'disable'
                ? false
                : undefined,
        uninstalled: journal.action === 'uninstall',
        pendingActivation: true,
        ...(journal.releasedPackagePath
            ? { releasedPackagePath: journal.releasedPackagePath }
            : {}),
        ...(journal.garbageCollection
            ? { garbageCollection: journal.garbageCollection }
            : {}),
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
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function lifecycleError(code, message) {
    return Object.assign(new Error(message), { code });
}
function getErrorCode(error) {
    return ((typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code) ||
        'plugin-lifecycle-transaction-failed');
}
//# sourceMappingURL=pluginLifecycleTransaction.js.map