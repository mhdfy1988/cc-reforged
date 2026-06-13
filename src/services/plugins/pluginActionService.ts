import { createHash, randomUUID } from 'node:crypto'
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js'
import type { ResolutionResult } from '../../utils/plugins/dependencyResolver.js'
import type {
  PluginScope,
  PluginSource,
} from '../../utils/plugins/schemas.js'
import { PluginInspector } from './pluginInspector.js'
import type { PluginDomainSession } from './pluginDomainSession.js'
import type {
  PluginCatalogSnapshot,
  PluginCandidate,
  PluginManagementRecord,
} from './pluginDomainTypes.js'
import { PluginPersistentOperationStore } from './pluginPersistence.js'
import {
  analyzePluginDependencies,
  createRollbackPackagePlan,
} from './pluginVersionLifecycle.js'

export type PluginAction =
  | 'install'
  | 'enable'
  | 'disable'
  | 'uninstall'
  | 'update'
  | 'rollback'
  | 'repair'

export type PluginActionTarget = {
  pluginId: string
  scope: PluginScope
  workspaceRoot?: string
  sourceId?: string
  version?: string
}

export type PluginActionDeleteOptions = {
  removeData: boolean
  removeOptions: boolean
  removeSecrets: boolean
}

export type PluginActionRequest = {
  action: PluginAction
  target: PluginActionTarget
  deleteOptions?: Partial<PluginActionDeleteOptions>
  installOptions?: {
    enableAfterInstall?: boolean
  }
}

export type PluginActionEffect = {
  kind:
    | 'materialize-package'
    | 'write-installation'
    | 'write-intent'
    | 'remove-installation'
    | 'remove-package-reference'
    | 'remove-options'
    | 'remove-secrets'
    | 'remove-data'
    | 'request-runtime-activation'
    | 'request-runtime-deactivation'
  description: string
}

export type PluginActionPlan = {
  schemaVersion: 1
  planId: string
  issuedAt: string
  expiresAt: string
  allowed: boolean
  blockedReason?: string
  action: PluginAction
  target: PluginActionTarget
  context: {
    workspaceRoot: string
    currentCwd: string
    configHomeDir: string
    runtimeInstanceId: string
  }
  revisions: {
    catalog: string
    plugin: string
    installations: string[]
    runtime: string[]
  }
  dependencies: {
    direct: string[]
    required: string[]
    reverseDependents: string[]
    crossMarketplaceEdges: Array<{
      from: string
      to: string
      trusted: boolean
    }>
    semverSupport: 'exact-version-only'
  }
  install?: {
    mode: 'install' | 'update' | 'repair' | 'rollback'
    enableAfterInstall: boolean
    packages: PluginInstallPackagePlan[]
  }
  effects: PluginActionEffect[]
  risks: string[]
  deleteOptions: PluginActionDeleteOptions
  requiresConfirmation: boolean
  confirmation?: {
    token: string
    message: string
    expiresAt: string
  }
}

export type PluginInstallPackagePlan = {
  pluginId: string
  sourceId: string
  source?: PluginSource
  version?: string
  cachedPath?: string
  marketplaceRoot?: string
  strict: boolean
  manifest?: import('../../types/plugin.js').PluginManifest
}

export type PluginActionApplyRequest = {
  planId: string
  confirmed?: boolean
  confirmationToken?: string
}

export type PluginOperationStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type PluginOperationRecord = {
  schemaVersion: 1
  operationId: string
  planId: string
  action: PluginAction
  target: PluginActionTarget
  status: PluginOperationStatus
  phase: string
  createdAt: string
  updatedAt: string
  cancellationRequested: boolean
  commitBoundaryReached: boolean
  result?: Record<string, unknown>
  error?: {
    code: string
    message: string
  }
}

export type PluginActionExecutionContext = {
  plan: PluginActionPlan
  session: PluginDomainSession
  operation: PluginOperationRecord
  update(input: {
    phase?: string
    commitBoundaryReached?: boolean
  }): void
  isCancellationRequested(): boolean
}

export type PluginActionExecutor = (
  context: PluginActionExecutionContext,
) => Promise<Record<string, unknown>>

export type PluginDomainSessionFactory = (context: {
  workspaceRoot: string
  currentCwd: string
  configHomeDir: string
  runtimeInstanceId: string
  requestId: string
}) => PluginDomainSession

export type PluginActionServiceOptions = {
  createSession: PluginDomainSessionFactory
  executor?: PluginActionExecutor
  now?: () => Date
  planTtlMs?: number
}

type StoredPlan = {
  plan: PluginActionPlan
  consumed: boolean
  confirmationConsumed: boolean
}

const DEFAULT_PLAN_TTL_MS = 5 * 60 * 1000
const CONFIRMATION_ACTIONS = new Set<PluginAction>([
  'install',
  'uninstall',
  'update',
  'rollback',
  'repair',
])

export class PluginActionService {
  private readonly inspector = new PluginInspector()
  private readonly plans = new Map<string, StoredPlan>()
  private readonly operations = new Map<string, PluginOperationRecord>()
  private readonly operationSessions = new Map<string, PluginDomainSession>()
  private readonly createSession: PluginDomainSessionFactory
  private readonly executor: PluginActionExecutor
  private readonly now: () => Date
  private readonly planTtlMs: number

  constructor(options: PluginActionServiceOptions) {
    this.createSession = options.createSession
    this.executor = options.executor ?? unavailableExecutor
    this.now = options.now ?? (() => new Date())
    this.planTtlMs = options.planTtlMs ?? DEFAULT_PLAN_TTL_MS
  }

  async plan(
    request: PluginActionRequest,
    session: PluginDomainSession,
  ): Promise<PluginActionPlan> {
    const catalog = await this.inspector.listCatalog(session)
    const record =
      catalog.plugins.find(
        plugin => plugin.pluginId === request.target.pluginId,
      ) ?? null
    const blockedReason = validateActionRequest(request, record, session)
    const issuedAt = this.now()
    const expiresAt = new Date(issuedAt.getTime() + this.planTtlMs)
    const requiresConfirmation = CONFIRMATION_ACTIONS.has(request.action)
    const deleteOptions = {
      removeData: request.deleteOptions?.removeData === true,
      removeOptions: request.deleteOptions?.removeOptions === true,
      removeSecrets: request.deleteOptions?.removeSecrets === true,
    }
    const dependencyAnalysis = analyzePluginDependencies(
      catalog,
      request.target.pluginId,
    )
    const installResolution = !blockedReason
      ? await resolvePackagePlan(request, catalog, record, session)
      : undefined
    const effectiveBlockedReason =
      blockedReason ??
      (installResolution && installResolution.ok === false
        ? formatInstallResolutionError(installResolution)
        : undefined)
    const revisions = createRevisions(catalog, record)
    const planId = `plugin-plan:${randomUUID()}`
    const plan: PluginActionPlan = {
      schemaVersion: 1,
      planId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      allowed: effectiveBlockedReason === undefined,
      ...(effectiveBlockedReason
        ? { blockedReason: effectiveBlockedReason }
        : {}),
      action: request.action,
      target: normalizeTarget(request.target, session),
      context: {
        workspaceRoot: session.context.workspaceRoot,
        currentCwd: session.context.currentCwd,
        configHomeDir: session.context.configHomeDir,
        runtimeInstanceId: session.context.runtimeInstanceId,
      },
      revisions,
      dependencies: {
        direct: dependencyAnalysis.directDependencies,
        required:
          installResolution?.ok === true
            ? installResolution.packages
                .map(item => item.pluginId)
                .filter(pluginId => pluginId !== request.target.pluginId)
            : [],
        reverseDependents: dependencyAnalysis.reverseDependents,
        crossMarketplaceEdges:
          dependencyAnalysis.crossMarketplaceEdges,
        semverSupport: dependencyAnalysis.semverSupport,
      },
      ...(installResolution?.ok === true
        ? {
            install: {
              mode: request.action as
                | 'install'
                | 'update'
                | 'repair'
                | 'rollback',
              enableAfterInstall:
                request.installOptions?.enableAfterInstall === true,
              packages: installResolution.packages,
            },
          }
        : {}),
      effects: effectiveBlockedReason
        ? []
        : createActionEffects(
            request.action,
            deleteOptions,
            request.installOptions?.enableAfterInstall === true,
          ),
      risks: effectiveBlockedReason ? [] : createActionRisks(request.action),
      deleteOptions,
      requiresConfirmation: effectiveBlockedReason
        ? false
        : requiresConfirmation,
    }
    if (!effectiveBlockedReason && requiresConfirmation) {
      plan.confirmation = {
        token: `plugin-confirmation:${randomUUID()}`,
        message: createConfirmationMessage(plan),
        expiresAt: plan.expiresAt,
      }
    }
    const stored = structuredClone(plan)
    this.plans.set(planId, {
      plan: stored,
      consumed: false,
      confirmationConsumed: false,
    })
    return structuredClone(stored)
  }

  async apply(
    request: PluginActionApplyRequest,
  ): Promise<PluginOperationRecord> {
    const stored = this.plans.get(request.planId)
    if (!stored) {
      throw pluginActionError(
        'plugin-plan-not-found',
        'Plugin action plan was not found.',
      )
    }
    if (stored.consumed) {
      throw pluginActionError(
        'plugin-plan-consumed',
        'Plugin action plan was already applied.',
      )
    }
    const plan = stored.plan
    if (!plan.allowed) {
      throw pluginActionError(
        'plugin-plan-blocked',
        plan.blockedReason ?? 'Plugin action plan is blocked.',
      )
    }
    if (this.now().getTime() > Date.parse(plan.expiresAt)) {
      throw pluginActionError(
        'plugin-plan-expired',
        'Plugin action plan has expired.',
      )
    }
    validateConfirmation(stored, request)

    const session = this.createSession({
      ...plan.context,
      requestId: `plugin-apply:${plan.planId}`,
    })
    const currentCatalog = await this.inspector.listCatalog(session)
    const currentRecord =
      currentCatalog.plugins.find(
        plugin => plugin.pluginId === plan.target.pluginId,
      ) ?? null
    const currentRevisions = createRevisions(currentCatalog, currentRecord)
    if (
      currentRevisions.catalog !== plan.revisions.catalog ||
      currentRevisions.plugin !== plan.revisions.plugin
    ) {
      throw pluginActionError(
        'plugin-plan-stale',
        'Plugin state changed after planning. Create a new plan.',
      )
    }

    stored.consumed = true
    if (plan.requiresConfirmation) stored.confirmationConsumed = true
    const operation = this.createOperation(plan)
    this.operations.set(operation.operationId, operation)
    this.operationSessions.set(operation.operationId, session)
    await this.operationStore(session).writeOperation(operation)
    queueMicrotask(() => {
      void this.executeOperation(operation.operationId, session)
    })
    return structuredClone(operation)
  }

  getOperation(operationId: string): PluginOperationRecord | null {
    const operation = this.operations.get(operationId)
    return operation ? structuredClone(operation) : null
  }

  async getPersistedOperation(
    operationId: string,
    session: PluginDomainSession,
  ): Promise<PluginOperationRecord | null> {
    return (
      this.getOperation(operationId) ??
      (await this.operationStore(session).readOperation(operationId))
    )
  }

  cancelOperation(operationId: string): PluginOperationRecord {
    const operation = this.operations.get(operationId)
    if (!operation) {
      throw pluginActionError(
        'plugin-operation-not-found',
        'Plugin operation was not found.',
      )
    }
    if (
      operation.status === 'succeeded' ||
      operation.status === 'failed' ||
      operation.status === 'cancelled'
    ) {
      return structuredClone(operation)
    }
    if (operation.commitBoundaryReached) {
      throw pluginActionError(
        'plugin-operation-commit-started',
        'Plugin operation can no longer be cancelled after commit begins.',
      )
    }
    operation.cancellationRequested = true
    if (operation.status === 'pending') {
      operation.status = 'cancelled'
      operation.phase = 'cancelled-before-start'
    }
    operation.updatedAt = this.now().toISOString()
    const session = this.operationSessions.get(operationId)
    if (session) {
      void this.operationStore(session).writeOperation(operation)
    }
    return structuredClone(operation)
  }

  async waitForOperationForTests(
    operationId: string,
    timeoutMs = 5_000,
  ): Promise<PluginOperationRecord> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      const operation = this.getOperation(operationId)
      if (!operation) {
        throw new Error(`Plugin operation not found: ${operationId}`)
      }
      if (
        operation.status === 'succeeded' ||
        operation.status === 'failed' ||
        operation.status === 'cancelled'
      ) {
        return operation
      }
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`Timed out waiting for plugin operation: ${operationId}`)
  }

  clearForTests(): void {
    this.plans.clear()
    this.operations.clear()
    this.operationSessions.clear()
  }

  private createOperation(plan: PluginActionPlan): PluginOperationRecord {
    const now = this.now().toISOString()
    return {
      schemaVersion: 1,
      operationId: `plugin-operation:${randomUUID()}`,
      planId: plan.planId,
      action: plan.action,
      target: structuredClone(plan.target),
      status: 'pending',
      phase: 'queued',
      createdAt: now,
      updatedAt: now,
      cancellationRequested: false,
      commitBoundaryReached: false,
    }
  }

  private async executeOperation(
    operationId: string,
    session: PluginDomainSession,
  ): Promise<void> {
    const operation = this.operations.get(operationId)
    if (!operation) return
    if (operation.status === 'cancelled') {
      await this.operationStore(session).writeOperation(operation)
      return
    }
    const plan = this.plans.get(operation.planId)?.plan
    if (!plan) return
    operation.status = 'running'
    operation.phase = 'preparing'
    operation.updatedAt = this.now().toISOString()
    await this.operationStore(session).writeOperation(operation)
    try {
      const result = await this.executor({
        plan: structuredClone(plan),
        session,
        operation,
        update: input => {
          if (input.phase) operation.phase = input.phase
          if (input.commitBoundaryReached !== undefined) {
            operation.commitBoundaryReached = input.commitBoundaryReached
          }
          operation.updatedAt = this.now().toISOString()
        },
        isCancellationRequested: () => operation.cancellationRequested,
      })
      const finalOperation = structuredClone(operation)
      if (
        finalOperation.cancellationRequested &&
        !finalOperation.commitBoundaryReached
      ) {
        finalOperation.status = 'cancelled'
        finalOperation.phase = 'cancelled'
      } else {
        finalOperation.status = 'succeeded'
        finalOperation.phase = 'completed'
        finalOperation.result = result
      }
      finalOperation.updatedAt = this.now().toISOString()
      if (finalOperation.status === 'succeeded') {
        clearAllCaches()
      }
      await this.operationStore(session).writeOperation(finalOperation)
      this.operations.set(operationId, finalOperation)
    } catch (error) {
      const finalOperation = structuredClone(operation)
      finalOperation.status = 'failed'
      finalOperation.phase = 'failed'
      finalOperation.error = {
        code: getErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
      }
      finalOperation.updatedAt = this.now().toISOString()
      await this.operationStore(session).writeOperation(finalOperation)
      this.operations.set(operationId, finalOperation)
    }
  }

  private operationStore(
    session: PluginDomainSession,
  ): PluginPersistentOperationStore {
    return new PluginPersistentOperationStore(session)
  }
}

function validateActionRequest(
  request: PluginActionRequest,
  record: PluginManagementRecord | null,
  session: PluginDomainSession,
): string | undefined {
  if (
    (request.target.scope === 'project' ||
      request.target.scope === 'local') &&
    request.target.workspaceRoot &&
    request.target.workspaceRoot !== session.context.workspaceRoot
  ) {
    return 'Plugin action target workspace does not match request context.'
  }
  if (request.target.scope === 'managed') {
    return 'Managed Plugin scope is read-only.'
  }
  if (!record) return 'Plugin was not found in the request-scoped catalog.'
  if (request.installOptions && request.action !== 'install') {
    return 'Install options are only valid for install actions.'
  }
  const installed = record.installations.some(installation =>
    installationMatchesTarget(installation, request.target, session),
  )
  if (request.action === 'install') {
    if (installed) return 'Plugin is already installed at the target scope.'
    if (
      !record.candidates.some(
        candidate =>
          candidate.sourceKind === 'marketplace' &&
          candidate.source !== undefined,
      )
    ) {
      return 'Plugin has no installable candidate.'
    }
    if (
      request.target.sourceId &&
      !record.candidates.some(
        candidate => candidate.sourceId === request.target.sourceId,
      )
    ) {
      return 'Plugin candidate source does not match the target.'
    }
    return undefined
  }
  if (
    !installed &&
    request.action !== 'enable' &&
    request.action !== 'disable'
  ) {
    return 'Plugin is not installed at the target scope.'
  }
  const targetIntent = record.intents.find(intent =>
    intentMatchesTarget(intent, request.target, session),
  )
  if (request.action === 'enable' && targetIntent?.intent === 'enabled') {
    return 'Plugin is already enabled.'
  }
  if (request.action === 'disable' && targetIntent?.intent === 'disabled') {
    return 'Plugin is already disabled.'
  }
  if (request.action === 'rollback' && !request.target.version) {
    return 'Rollback requires an exact cached target version.'
  }
  if (request.action === 'update') {
    const selected = record.installations.find(
      installation =>
        installation.applicableToRequest &&
        installation.target.scope === request.target.scope,
    )
    const candidates = record.candidates.filter(
      candidate =>
        candidate.sourceKind === 'marketplace' &&
        (!request.target.sourceId ||
          candidate.sourceId === request.target.sourceId) &&
        (!request.target.version ||
          candidate.version === request.target.version),
    )
    if (candidates.length === 0) {
      return 'Plugin has no matching update candidate.'
    }
    if (
      candidates[0]?.version &&
      selected?.installedVersion === candidates[0].version
    ) {
      return 'Plugin target version is already installed.'
    }
  }
  if (
    request.deleteOptions &&
    request.action !== 'uninstall'
  ) {
    return 'Delete options are only valid for uninstall actions.'
  }
  if (
    request.action === 'uninstall' &&
    request.deleteOptions?.removeData === true &&
    record.installations.some(
      installation =>
        !installationMatchesTarget(
          installation,
          request.target,
          session,
        ),
    )
  ) {
    return 'Plugin data can only be deleted with the final installation instance.'
  }
  return undefined
}

function installationMatchesTarget(
  installation: PluginManagementRecord['installations'][number],
  target: PluginActionTarget,
  session: PluginDomainSession,
): boolean {
  if (
    !installation.applicableToRequest ||
    installation.target.scope !== target.scope
  ) {
    return false
  }
  if (target.scope !== 'project' && target.scope !== 'local') return true
  return installation.target.workspaceRoot === session.context.workspaceRoot
}

function intentMatchesTarget(
  intent: PluginManagementRecord['intents'][number],
  target: PluginActionTarget,
  session: PluginDomainSession,
): boolean {
  if (intent.target.scope !== target.scope) return false
  if (target.scope !== 'project' && target.scope !== 'local') return true
  return intent.target.workspaceRoot === session.context.workspaceRoot
}

function validateConfirmation(
  stored: StoredPlan,
  request: PluginActionApplyRequest,
): void {
  if (!stored.plan.requiresConfirmation) return
  if (!request.confirmed) {
    throw pluginActionError(
      'plugin-confirmation-required',
      'Plugin action requires explicit confirmation.',
    )
  }
  if (!request.confirmationToken) {
    throw pluginActionError(
      'plugin-confirmation-missing',
      'Plugin action confirmation token is missing.',
    )
  }
  if (stored.confirmationConsumed) {
    throw pluginActionError(
      'plugin-confirmation-consumed',
      'Plugin action confirmation token was already used.',
    )
  }
  if (request.confirmationToken !== stored.plan.confirmation?.token) {
    throw pluginActionError(
      'plugin-confirmation-invalid',
      'Plugin action confirmation token is invalid.',
    )
  }
}

function createRevisions(
  catalog: PluginCatalogSnapshot,
  record: PluginManagementRecord | null,
): PluginActionPlan['revisions'] {
  return {
    catalog: digest({
      context: {
        workspaceRoot: catalog.context.workspaceRoot,
        currentCwd: catalog.context.currentCwd,
        configHomeDir: catalog.context.configHomeDir,
        runtimeInstanceId: catalog.context.runtimeInstanceId,
      },
      candidates: catalog.candidates,
      plugins: catalog.plugins.map(plugin => ({
        pluginId: plugin.pluginId,
        derivedState: plugin.derivedState,
        effectiveSelection: plugin.effectiveSelection,
        installations: plugin.installations.map(item => item.installationRevision),
        intents: plugin.intents,
        runtimeActivations: plugin.runtimeActivations.map(
          activation => activation.activationRevision,
        ),
      })),
    }),
    plugin: digest(record),
    installations:
      record?.installations.map(
        installation => installation.installationRevision,
      ) ?? [],
    runtime:
      record?.runtimeActivations.map(
        activation => activation.activationRevision,
      ) ?? [],
  }
}

function normalizeTarget(
  target: PluginActionTarget,
  session: PluginDomainSession,
): PluginActionTarget {
  return {
    pluginId: target.pluginId,
    scope: target.scope,
    ...((target.scope === 'project' || target.scope === 'local')
      ? { workspaceRoot: session.context.workspaceRoot }
      : {}),
    ...(target.sourceId ? { sourceId: target.sourceId } : {}),
    ...(target.version ? { version: target.version } : {}),
  }
}

function createActionEffects(
  action: PluginAction,
  deleteOptions: PluginActionDeleteOptions,
  enableAfterInstall = false,
): PluginActionEffect[] {
  switch (action) {
    case 'install':
      return [
        effect('materialize-package', 'Stage and validate the Plugin package.'),
        effect('write-installation', 'Create the target-scope installation record.'),
        ...(enableAfterInstall
          ? [
              effect(
                'write-intent',
                'Write enabled intent after all installation records commit.',
              ),
            ]
          : []),
      ]
    case 'enable':
      return [
        effect('write-intent', 'Write enabled intent at the target scope.'),
        effect(
          'request-runtime-activation',
          'Request activation for the current runtime instance.',
        ),
      ]
    case 'disable':
      return [
        effect('write-intent', 'Write disabled intent at the target scope.'),
        effect(
          'request-runtime-deactivation',
          'Request deactivation for the current runtime instance.',
        ),
      ]
    case 'uninstall': {
      const effects = [
        effect(
          'request-runtime-deactivation',
          'Deactivate the target Plugin before removing its installation.',
        ),
        effect('remove-installation', 'Remove the target-scope installation record.'),
        effect(
          'remove-package-reference',
          'Release the installed package version reference.',
        ),
      ]
      if (deleteOptions.removeOptions) {
        effects.push(effect('remove-options', 'Delete saved Plugin options.'))
      }
      if (deleteOptions.removeSecrets) {
        effects.push(
          effect('remove-secrets', 'Delete saved Plugin secrets.'),
        )
      }
      if (deleteOptions.removeData) {
        effects.push(effect('remove-data', 'Delete persistent Plugin data.'))
      }
      return effects
    }
    case 'update':
      return [
        effect('materialize-package', 'Stage and validate the target version.'),
        effect('write-installation', 'Switch the installation record to the target version.'),
        effect(
          'request-runtime-activation',
          'Request activation of the updated version.',
        ),
      ]
    case 'rollback':
      return [
        effect(
          'write-installation',
          'Switch the installation record to an existing validated cached version.',
        ),
        effect(
          'request-runtime-activation',
          'Request activation of the rollback version.',
        ),
      ]
    case 'repair':
      return [
        effect('materialize-package', 'Rebuild and validate the installed package.'),
        effect('write-installation', 'Repair the installation record after validation.'),
        effect(
          'request-runtime-activation',
          'Request activation of the repaired package.',
        ),
      ]
  }
}

type InstallPlanResolution =
  | { ok: true; packages: PluginInstallPackagePlan[] }
  | (ResolutionResult & { ok: false })
  | {
      ok: false
      reason: 'candidate-unavailable' | 'policy-blocked'
      pluginId: string
    }

async function resolvePackagePlan(
  request: PluginActionRequest,
  catalog: PluginCatalogSnapshot,
  record: PluginManagementRecord | null,
  session: PluginDomainSession,
): Promise<InstallPlanResolution | undefined> {
  if (
    request.action === 'install' ||
    request.action === 'update' ||
    request.action === 'repair'
  ) {
    return resolveInstallPlan(request, catalog)
  }
  if (request.action !== 'rollback' || !record) return undefined
  try {
    return {
      ok: true,
      packages: [
        await createRollbackPackagePlan(
          session,
          record,
          request.target,
        ),
      ],
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'candidate-unavailable',
      pluginId: `${request.target.pluginId}:${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}

function resolveInstallPlan(
  request: PluginActionRequest,
  catalog: PluginCatalogSnapshot,
): InstallPlanResolution {
  const records = new Map(
    catalog.plugins.map(plugin => [plugin.pluginId, plugin]),
  )
  const candidatesById = new Map<string, PluginCandidate>()
  for (const pluginId of new Set(
    catalog.candidates.map(candidate => candidate.pluginId),
  )) {
    const existing = catalog.candidates.filter(
      candidate => candidate.pluginId === pluginId,
    )
    const matching = existing.find(
        candidate =>
          (pluginId !== request.target.pluginId ||
            !request.target.sourceId ||
            candidate.sourceId === request.target.sourceId) &&
          (pluginId !== request.target.pluginId ||
            !request.target.version ||
            candidate.version === request.target.version),
      )
    const selected =
      pluginId === request.target.pluginId &&
      (request.target.sourceId || request.target.version)
        ? matching
        : matching ?? existing[0]
    if (selected) candidatesById.set(pluginId, selected)
  }
  const rootCandidate = candidatesById.get(request.target.pluginId)
  if (
    !rootCandidate ||
    rootCandidate.sourceKind !== 'marketplace' ||
    !rootCandidate.source
  ) {
    return {
      ok: false,
      reason: 'candidate-unavailable',
      pluginId: request.target.pluginId,
    }
  }
  const installed = new Set(
    catalog.plugins
      .filter(plugin =>
        plugin.installations.some(
          installation =>
            installation.applicableToRequest &&
            installation.materialization === 'present',
        ),
      )
      .map(plugin => plugin.pluginId),
  )
  return resolveInstallPlanSynchronously(
    request.target.pluginId,
    candidatesById,
    records,
    installed,
    new Set(rootCandidate.allowCrossMarketplaceDependenciesOn ?? []),
  )
}

function resolveInstallPlanSynchronously(
  rootId: string,
  candidatesById: ReadonlyMap<string, PluginCandidate>,
  records: ReadonlyMap<string, PluginManagementRecord>,
  installed: ReadonlySet<string>,
  allowedCrossMarketplaces: ReadonlySet<string>,
): InstallPlanResolution {
  const rootMarketplace = pluginMarketplace(rootId)
  const closure: string[] = []
  const visited = new Set<string>()
  const stack: string[] = []
  const walk = (pluginId: string, requiredBy: string): InstallPlanResolution | null => {
    if (pluginId !== rootId && installed.has(pluginId)) return null
    const marketplace = pluginMarketplace(pluginId)
    if (
      marketplace !== rootMarketplace &&
      !(marketplace && allowedCrossMarketplaces.has(marketplace))
    ) {
      return {
        ok: false,
        reason: 'cross-marketplace',
        dependency: pluginId,
        requiredBy,
      }
    }
    if (stack.includes(pluginId)) {
      return { ok: false, reason: 'cycle', chain: [...stack, pluginId] }
    }
    if (visited.has(pluginId)) return null
    const record = records.get(pluginId)
    if (
      record?.intents.some(
        intent => intent.source === 'managed' && intent.intent === 'blocked',
      )
    ) {
      return { ok: false, reason: 'policy-blocked', pluginId }
    }
    const candidate = candidatesById.get(pluginId)
    if (
      !candidate ||
      candidate.sourceKind !== 'marketplace' ||
      !candidate.source
    ) {
      return {
        ok: false,
        reason: 'candidate-unavailable',
        pluginId,
      }
    }
    visited.add(pluginId)
    stack.push(pluginId)
    for (const rawDependency of candidate.manifest?.dependencies ?? []) {
      const dependency = rawDependency.includes('@')
        ? rawDependency
        : `${rawDependency}@${marketplace}`
      const error = walk(dependency, pluginId)
      if (error) return error
    }
    stack.pop()
    closure.push(pluginId)
    return null
  }
  const error = walk(rootId, rootId)
  if (error) return error
  return toInstallPackages(
    { ok: true, closure: closure as import('../../utils/plugins/schemas.js').PluginId[] },
    candidatesById,
  )
}

function toInstallPackages(
  resolution: ResolutionResult,
  candidatesById: ReadonlyMap<string, PluginCandidate>,
): InstallPlanResolution {
  if (resolution.ok === false) return resolution
  const packages: PluginInstallPackagePlan[] = []
  for (const pluginId of resolution.closure) {
    const candidate = candidatesById.get(pluginId)
    if (!candidate?.source) {
      return { ok: false, reason: 'candidate-unavailable', pluginId }
    }
    packages.push({
      pluginId,
      sourceId: candidate.sourceId,
      source: structuredClone(candidate.source),
      ...(candidate.version ? { version: candidate.version } : {}),
      ...(candidate.marketplaceRoot
        ? { marketplaceRoot: candidate.marketplaceRoot }
        : {}),
      strict: candidate.strict !== false,
      ...(candidate.manifest
        ? { manifest: structuredClone(candidate.manifest) }
        : {}),
    })
  }
  return { ok: true, packages }
}

function formatInstallResolutionError(
  resolution: Exclude<InstallPlanResolution, { ok: true }>,
): string {
  switch (resolution.reason) {
    case 'cycle':
      return `Plugin dependency cycle: ${resolution.chain.join(' -> ')}.`
    case 'not-found':
      return `Plugin dependency ${resolution.missing} required by ${resolution.requiredBy} was not found.`
    case 'cross-marketplace':
      return `Plugin dependency ${resolution.dependency} crosses an untrusted Marketplace boundary.`
    case 'candidate-unavailable':
      return `Plugin ${resolution.pluginId} has no materializable Marketplace candidate.`
    case 'policy-blocked':
      return `Plugin ${resolution.pluginId} is blocked by managed policy.`
  }
}

function pluginMarketplace(pluginId: string): string | undefined {
  const separator = pluginId.lastIndexOf('@')
  return separator > 0 ? pluginId.slice(separator + 1) : undefined
}

function createActionRisks(action: PluginAction): string[] {
  switch (action) {
    case 'install':
      return ['downloads-or-copies-code', 'changes-installation-registry']
    case 'enable':
      return ['changes-settings-intent', 'changes-runtime-capabilities']
    case 'disable':
      return ['changes-settings-intent', 'removes-runtime-capabilities']
    case 'uninstall':
      return ['removes-installation', 'may-remove-user-data']
    case 'update':
      return ['changes-installed-version', 'changes-runtime-capabilities']
    case 'rollback':
      return ['changes-installed-version', 'changes-runtime-capabilities']
    case 'repair':
      return ['replaces-installed-package', 'changes-runtime-capabilities']
  }
}

function createConfirmationMessage(plan: PluginActionPlan): string {
  return `Confirm ${plan.action} for ${plan.target.pluginId} at ${plan.target.scope} scope.`
}

function effect(
  kind: PluginActionEffect['kind'],
  description: string,
): PluginActionEffect {
  return { kind, description }
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(stableStringify(value))
    .digest('hex')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function pluginActionError(code: string, message: string): Error {
  const error = new Error(message)
  Object.assign(error, { code })
  return error
}

function getErrorCode(error: unknown): string {
  return (
    (error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code) ||
    'plugin-action-failed'
  )
}

async function unavailableExecutor(): Promise<Record<string, unknown>> {
  throw pluginActionError(
    'plugin-action-executor-unavailable',
    'Plugin action execution is not available until the transaction executor is configured.',
  )
}
