import { createHash } from 'node:crypto'
import {
  InstalledPluginsFileSchemaV2,
  type InstalledPluginsFileV2,
} from '../../utils/plugins/schemas.js'
import type {
  PluginActionExecutionContext,
  PluginActionExecutor,
} from './pluginActionService.js'
import { PluginConfigurationService } from './pluginConfigurationService.js'
import {
  createPluginDomainSession,
  type PluginDomainSession,
} from './pluginDomainSession.js'
import {
  acquirePluginScopeLock,
  atomicWriteJson,
  journalPath,
  readJsonOrNull,
} from './pluginPersistence.js'
import { readPluginRegistryV2ForWrite } from './pluginRegistryCompatibility.js'
import { collectPluginCacheGarbage } from './pluginVersionLifecycle.js'

export type PluginLifecycleJournalPhase =
  | 'created'
  | 'intent-committed'
  | 'registry-committed'
  | 'configuration-committed'
  | 'gc-completed'
  | 'completed'
  | 'reconciliation-required'

export type PluginLifecycleTransactionFault =
  | 'after-intent-commit'
  | 'after-registry-commit'
  | 'after-configuration-commit'
  | 'after-gc'

export type PluginLifecycleTransactionOptions = {
  injectFault?: (
    fault: PluginLifecycleTransactionFault,
  ) => void | Promise<void>
  now?: () => Date
}

type PluginLifecycleJournal = {
  schemaVersion: 1
  operationId: string
  planId: string
  action: 'enable' | 'disable' | 'uninstall'
  phase: PluginLifecycleJournalPhase
  target: {
    pluginId: string
    scope: 'user' | 'project' | 'local'
    workspaceRoot?: string
  }
  deleteOptions: {
    removeData: boolean
    removeOptions: boolean
    removeSecrets: boolean
  }
  intentCommitted: boolean
  registryCommitted: boolean
  configurationCommitted: boolean
  gcCompleted: boolean
  completed: boolean
  journalRevision: string
  createdAt: string
  updatedAt: string
  releasedPackagePath?: string
  garbageCollection?: {
    deleted: string[]
    retained: Array<{ path: string; reasons: string[] }>
  }
  error?: {
    code: string
    message: string
  }
}

export class PluginLifecycleTransaction {
  private readonly configuration = new PluginConfigurationService()
  private readonly injectFault?: PluginLifecycleTransactionOptions['injectFault']
  private readonly now: () => Date

  constructor(options: PluginLifecycleTransactionOptions = {}) {
    this.injectFault = options.injectFault
    this.now = options.now ?? (() => new Date())
  }

  async execute(
    context: PluginActionExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (
      context.plan.action !== 'enable' &&
      context.plan.action !== 'disable' &&
      context.plan.action !== 'uninstall'
    ) {
      throw lifecycleError(
        'plugin-action-not-implemented',
        `Plugin action ${context.plan.action} is not implemented by the lifecycle transaction.`,
      )
    }
    if (context.plan.target.scope === 'managed') {
      throw lifecycleError(
        'plugin-managed-scope-read-only',
        'Managed Plugin scope is read-only.',
      )
    }

    const lock = await acquirePluginScopeLock(context.session, {
      operationId: context.operation.operationId,
      scope: context.plan.target.scope,
      workspaceRoot: context.plan.target.workspaceRoot,
    })
    try {
      const existing = await this.readJournal(context)
      if (existing) return this.reconcileJournal(existing, context)
      return this.start(context)
    } finally {
      await lock.release()
    }
  }

  async reconcile(
    operationId: string,
    context: PluginActionExecutionContext,
  ): Promise<Record<string, unknown>> {
    const journal = await readJsonOrNull<PluginLifecycleJournal>(
      journalPath(context.session, operationId),
    )
    if (!journal) {
      throw lifecycleError(
        'plugin-journal-not-found',
        `Plugin operation journal was not found: ${operationId}`,
      )
    }
    const lock = await acquirePluginScopeLock(context.session, {
      operationId,
      scope: journal.target.scope,
      workspaceRoot: journal.target.workspaceRoot,
    })
    try {
      return this.reconcileJournal(journal, context)
    } finally {
      await lock.release()
    }
  }

  private async start(
    context: PluginActionExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (context.isCancellationRequested()) {
      throw lifecycleError(
        'plugin-operation-cancelled',
        'Plugin lifecycle operation was cancelled before commit.',
      )
    }
    const now = this.now().toISOString()
    const targetScope = context.plan.target.scope as
      | 'user'
      | 'project'
      | 'local'
    const journal = withJournalRevision({
      schemaVersion: 1,
      operationId: context.operation.operationId,
      planId: context.plan.planId,
      action: context.plan.action as 'enable' | 'disable' | 'uninstall',
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
    })
    await this.writeJournal(context.session, journal)
    context.update({
      phase: 'committing-lifecycle',
      commitBoundaryReached: true,
    })
    try {
      return await this.reconcileJournal(journal, context)
    } catch (error) {
      const current = (await this.readJournal(context)) ?? journal
      await this.failJournal(context.session, current, error)
      throw error
    }
  }

  private async reconcileJournal(
    initial: PluginLifecycleJournal,
    context: PluginActionExecutionContext,
  ): Promise<Record<string, unknown>> {
    let journal = initial
    if (journal.completed) return resultFromJournal(journal)
    context.update({
      phase: `reconcile:${journal.phase}`,
      commitBoundaryReached: journal.phase !== 'created',
    })

    if (!journal.intentCommitted) {
      await commitPluginIntent(context.session, journal)
      journal.intentCommitted = true
      journal = await this.advance(
        context.session,
        journal,
        'intent-committed',
      )
      await this.injectFault?.('after-intent-commit')
    }

    if (journal.action === 'uninstall' && !journal.registryCommitted) {
      journal.releasedPackagePath = await removeInstallation(
        context.session,
        journal,
      )
      journal.registryCommitted = true
      journal = await this.advance(
        context.session,
        journal,
        'registry-committed',
      )
      await this.injectFault?.('after-registry-commit')
    }

    if (
      journal.action === 'uninstall' &&
      !journal.configurationCommitted
    ) {
      await this.configuration.delete(context.session, {
        identity: {
          pluginId: journal.target.pluginId,
          scope: journal.target.scope,
          ...(journal.target.workspaceRoot
            ? { workspaceRoot: journal.target.workspaceRoot }
            : {}),
        },
        ...journal.deleteOptions,
      })
      journal.configurationCommitted = true
      journal = await this.advance(
        context.session,
        journal,
        'configuration-committed',
      )
      await this.injectFault?.('after-configuration-commit')
    }

    if (journal.action === 'uninstall' && !journal.gcCompleted) {
      const gcSession = createPluginDomainSession({
        ...context.session.context,
        requestId: `${context.session.context.requestId}:gc`,
      })
      journal.garbageCollection = await collectPluginCacheGarbage(
        gcSession,
        { delete: true },
      )
      journal.gcCompleted = true
      journal = await this.advance(
        context.session,
        journal,
        'gc-completed',
      )
      await this.injectFault?.('after-gc')
    }

    journal.completed = true
    journal = await this.advance(context.session, journal, 'completed')
    return resultFromJournal(journal)
  }

  private readJournal(
    context: PluginActionExecutionContext,
  ): Promise<PluginLifecycleJournal | null> {
    return readJsonOrNull<PluginLifecycleJournal>(
      journalPath(context.session, context.operation.operationId),
    )
  }

  private advance(
    session: PluginDomainSession,
    journal: PluginLifecycleJournal,
    phase: PluginLifecycleJournalPhase,
  ): Promise<PluginLifecycleJournal> {
    return this.rewrite(session, {
      ...journal,
      phase,
      error: undefined,
    })
  }

  private async failJournal(
    session: PluginDomainSession,
    journal: PluginLifecycleJournal,
    error: unknown,
  ): Promise<PluginLifecycleJournal> {
    return this.rewrite(session, {
      ...journal,
      phase: 'reconciliation-required',
      error: {
        code: getErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }

  private async rewrite(
    session: PluginDomainSession,
    journal: PluginLifecycleJournal,
  ): Promise<PluginLifecycleJournal> {
    const next = withJournalRevision({
      ...journal,
      updatedAt: this.now().toISOString(),
    })
    await this.writeJournal(session, next)
    return next
  }

  private writeJournal(
    session: PluginDomainSession,
    journal: PluginLifecycleJournal,
  ): Promise<void> {
    return atomicWriteJson(journalPath(session, journal.operationId), journal)
  }
}

export function createPluginLifecycleExecutor(
  options: PluginLifecycleTransactionOptions = {},
): PluginActionExecutor {
  const transaction = new PluginLifecycleTransaction(options)
  return context => transaction.execute(context)
}

async function commitPluginIntent(
  session: PluginDomainSession,
  journal: PluginLifecycleJournal,
): Promise<void> {
  const path = settingsPathForScope(session, journal.target.scope)
  const settings =
    (await readJsonOrNull<Record<string, unknown>>(path)) ?? {}
  const enabledPlugins = asRecord(settings.enabledPlugins)
  const nextEnabledPlugins = { ...enabledPlugins }
  if (journal.action === 'uninstall') {
    delete nextEnabledPlugins[journal.target.pluginId]
  } else {
    nextEnabledPlugins[journal.target.pluginId] =
      journal.action === 'enable'
  }
  await atomicWriteJson(path, {
    ...settings,
    ...(Object.keys(nextEnabledPlugins).length > 0
      ? { enabledPlugins: nextEnabledPlugins }
      : { enabledPlugins: undefined }),
  })
}

async function removeInstallation(
  session: PluginDomainSession,
  journal: PluginLifecycleJournal,
): Promise<string | undefined> {
  const current = await readInstalledPluginsV2(
    session.paths.installedRegistryPath,
  )
  const installations = current.plugins[journal.target.pluginId] ?? []
  const projectPath =
    journal.target.scope === 'project' || journal.target.scope === 'local'
      ? journal.target.workspaceRoot
      : undefined
  const selected = installations.find(
    installation =>
      installation.scope === journal.target.scope &&
      installation.projectPath === projectPath,
  )
  if (!selected) {
    return undefined
  }
  const remaining = installations.filter(
    installation =>
      !(
        installation.scope === journal.target.scope &&
        installation.projectPath === projectPath
      ),
  )
  if (remaining.length > 0) {
    current.plugins[journal.target.pluginId] = remaining
  } else {
    delete current.plugins[journal.target.pluginId]
  }
  InstalledPluginsFileSchemaV2().parse(current)
  await atomicWriteJson(session.paths.installedRegistryPath, current)
  return selected.installPath
}

async function readInstalledPluginsV2(
  path: string,
): Promise<InstalledPluginsFileV2> {
  return readPluginRegistryV2ForWrite(path)
}

function settingsPathForScope(
  session: PluginDomainSession,
  scope: 'user' | 'project' | 'local',
): string {
  switch (scope) {
    case 'user':
      return session.paths.userSettingsPath
    case 'project':
      return session.paths.projectSettingsPath
    case 'local':
      return session.paths.localSettingsPath
  }
}

function resultFromJournal(
  journal: PluginLifecycleJournal,
): Record<string, unknown> {
  return {
    action: journal.action,
    pluginId: journal.target.pluginId,
    scope: journal.target.scope,
    enabled:
      journal.action === 'enable'
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
  }
}

function withJournalRevision(
  journal: Omit<PluginLifecycleJournal, 'journalRevision'> & {
    journalRevision?: string
  },
): PluginLifecycleJournal {
  const { journalRevision: _ignored, ...content } = journal
  return {
    ...content,
    journalRevision: createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex')
      .slice(0, 16),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function lifecycleError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

function getErrorCode(error: unknown): string {
  return (
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code) ||
    'plugin-lifecycle-transaction-failed'
  )
}
