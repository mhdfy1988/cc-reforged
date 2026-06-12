import { getOriginalCwd } from '../../bootstrap/state.js'
import { createCcrCore, type CcrCore } from '../../core/ccrCore.js'
import {
  createCurrentProcessPluginRequestContext,
  type CorePluginRequestContext,
} from '../../core/pluginCore.js'
import type { PluginMarketplaceEntry, PluginScope } from '../../utils/plugins/schemas.js'
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js'
import { parsePluginIdentifier } from '../../utils/plugins/pluginIdentifier.js'
import {
  buildPluginTelemetryFields,
} from '../../utils/telemetry/pluginTelemetry.js'
import { getManagedPluginNames } from '../../utils/plugins/managedPlugins.js'
import { isOfficialMarketplaceName } from '../../utils/plugins/pluginIdentifier.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
  logEvent,
} from '../analytics/index.js'
import type {
  PluginAction,
  PluginActionPlan,
  PluginActionRequest,
  PluginOperationRecord,
} from './pluginActionService.js'
import type {
  PluginCatalogSnapshot,
  PluginManagementRecord,
} from './pluginDomainTypes.js'

export type EditablePluginScope = Exclude<PluginScope, 'managed'>

export type PluginDomainAdapterOptions = {
  core?: CcrCore
  contextFactory?: () => CorePluginRequestContext
  operationTimeoutMs?: number
}

export type PluginDomainExecution = {
  plan: PluginActionPlan
  operation: PluginOperationRecord
  before: PluginManagementRecord
}

export type InstallPluginResult =
  | { success: true; message: string }
  | { success: false; error: string }

export type InstallPluginParams = {
  pluginId: string
  entry: PluginMarketplaceEntry
  marketplaceName: string
  scope?: EditablePluginScope
  trigger?: 'hint' | 'user'
}

const TERMINAL_OPERATION_STATUSES = new Set([
  'succeeded',
  'failed',
  'cancelled',
])
const SCOPE_PRIORITY: readonly EditablePluginScope[] = [
  'local',
  'project',
  'user',
]

export class PluginDomainAdapter {
  private readonly core: CcrCore
  private readonly contextFactory: () => CorePluginRequestContext
  private readonly operationTimeoutMs: number

  constructor(options: PluginDomainAdapterOptions = {}) {
    this.core = options.core ?? createCcrCore()
    this.contextFactory =
      options.contextFactory ??
      (() => {
        const workspaceRoot = getOriginalCwd()
        return createCurrentProcessPluginRequestContext({
          workspaceRoot,
          currentCwd: workspaceRoot,
          runtimeInstanceId: 'cli-ink',
        })
      })
    this.operationTimeoutMs = options.operationTimeoutMs ?? 120_000
  }

  async listCatalog(): Promise<PluginCatalogSnapshot> {
    return this.core.plugins.listCatalog(this.contextFactory())
  }

  async planAction(input: {
    action: PluginAction
    plugin: string
    scope?: EditablePluginScope
    deleteOptions?: PluginActionRequest['deleteOptions']
    enableAfterInstall?: boolean
  }): Promise<PluginActionPlan> {
    const context = this.contextFactory()
    const { record, scope } = await this.resolveTarget(
      input.plugin,
      input.scope,
      context,
    )
    return this.core.plugins.planAction(
      {
        action: input.action,
        target: {
          pluginId: record.pluginId,
          scope,
          ...((scope === 'project' || scope === 'local')
            ? { workspaceRoot: context.workspaceRoot }
            : {}),
        },
        ...(input.deleteOptions
          ? { deleteOptions: input.deleteOptions }
          : {}),
        ...(input.action === 'install'
          ? {
              installOptions: {
                enableAfterInstall: input.enableAfterInstall === true,
              },
            }
          : {}),
      },
      context,
    )
  }

  async executeAction(input: {
    action: PluginAction
    plugin: string
    scope?: EditablePluginScope
    deleteOptions?: PluginActionRequest['deleteOptions']
    enableAfterInstall?: boolean
  }): Promise<PluginDomainExecution> {
    const context = this.contextFactory()
    const { record, scope } = await this.resolveTarget(
      input.plugin,
      input.scope,
      context,
    )
    const plan = await this.core.plugins.planAction(
      {
        action: input.action,
        target: {
          pluginId: record.pluginId,
          scope,
          ...((scope === 'project' || scope === 'local')
            ? { workspaceRoot: context.workspaceRoot }
            : {}),
        },
        ...(input.deleteOptions
          ? { deleteOptions: input.deleteOptions }
          : {}),
        ...(input.action === 'install'
          ? {
              installOptions: {
                enableAfterInstall: input.enableAfterInstall === true,
              },
            }
          : {}),
      },
      context,
    )
    if (!plan.allowed) {
      throw pluginAdapterError(
        'plugin-action-not-allowed',
        plan.blockedReason ?? 'Plugin action is not allowed.',
      )
    }
    const operation = await this.core.plugins.applyAction({
      planId: plan.planId,
      ...(plan.requiresConfirmation
        ? {
            confirmed: true,
            confirmationToken: plan.confirmation?.token,
          }
        : {}),
    })
    const completed = await this.waitForOperation(operation.operationId)
    if (completed.status !== 'succeeded') {
      throw pluginAdapterError(
        completed.error?.code ?? 'plugin-operation-failed',
        completed.error?.message ??
          `Plugin operation ended with status ${completed.status}.`,
      )
    }
    clearAllCaches()
    return { plan, operation: completed, before: record }
  }

  private async resolveTarget(
    plugin: string,
    requestedScope: EditablePluginScope | undefined,
    context: CorePluginRequestContext,
  ): Promise<{ record: PluginManagementRecord; scope: EditablePluginScope }> {
    const catalog = await this.core.plugins.listCatalog(context)
    const record = resolvePluginRecord(catalog, plugin)
    if (!record) {
      throw pluginAdapterError(
        'plugin-not-found',
        `Plugin "${plugin}" was not found in the request-scoped catalog.`,
      )
    }
    return {
      record,
      scope: requestedScope ?? resolveEditableScope(record),
    }
  }

  private async waitForOperation(
    operationId: string,
  ): Promise<PluginOperationRecord> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < this.operationTimeoutMs) {
      const operation = this.core.plugins.getOperation(operationId)
      if (!operation) {
        throw pluginAdapterError(
          'plugin-operation-not-found',
          `Plugin operation was not found: ${operationId}.`,
        )
      }
      if (TERMINAL_OPERATION_STATUSES.has(operation.status)) {
        return operation
      }
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    throw pluginAdapterError(
      'plugin-operation-timeout',
      `Timed out waiting for Plugin operation: ${operationId}.`,
    )
  }
}

const currentProcessPluginAdapter = new PluginDomainAdapter()

export function getCurrentProcessPluginDomainAdapter(): PluginDomainAdapter {
  return currentProcessPluginAdapter
}

export async function installPluginFromMarketplace({
  pluginId,
  entry,
  marketplaceName,
  scope = 'user',
  trigger = 'user',
}: InstallPluginParams): Promise<InstallPluginResult> {
  try {
    const execution = await currentProcessPluginAdapter.executeAction({
      action: 'install',
      plugin: pluginId,
      scope,
      enableAfterInstall: true,
    })
    logEvent('tengu_plugin_installed', {
      _PROTO_plugin_name:
        entry.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      _PROTO_marketplace_name:
        marketplaceName as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      plugin_id: (isOfficialMarketplaceName(marketplaceName)
        ? pluginId
        : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      trigger:
        trigger as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      install_source: (trigger === 'hint'
        ? 'ui-suggestion'
        : 'ui-discover') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...buildPluginTelemetryFields(
        entry.name,
        marketplaceName,
        getManagedPluginNames(),
      ),
    })
    return {
      success: true,
      message: `Successfully installed plugin: ${execution.plan.target.pluginId} (scope: ${scope})${formatDependencySuffix(execution.plan.dependencies.required)}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function resolvePluginRecord(
  catalog: PluginCatalogSnapshot,
  plugin: string,
): PluginManagementRecord | null {
  const exact = catalog.plugins.find(record => record.pluginId === plugin)
  if (exact) return exact
  const { name } = parsePluginIdentifier(plugin)
  const matches = catalog.plugins.filter(
    record => parsePluginIdentifier(record.pluginId).name === name,
  )
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) {
    throw pluginAdapterError(
      'plugin-identifier-ambiguous',
      `Plugin name "${plugin}" matches multiple marketplaces. Use plugin@marketplace format.`,
    )
  }
  return null
}

function resolveEditableScope(
  record: PluginManagementRecord,
): EditablePluginScope {
  for (const scope of SCOPE_PRIORITY) {
    const intent = record.intents.find(
      item => item.target.scope === scope && item.intent !== 'unset',
    )
    if (intent) return scope
  }
  for (const scope of SCOPE_PRIORITY) {
    if (
      record.installations.some(
        item => item.target.scope === scope && item.applicableToRequest,
      )
    ) {
      return scope
    }
  }
  return 'user'
}

function formatDependencySuffix(dependencies: readonly string[]): string {
  if (dependencies.length === 0) return ''
  return ` with ${dependencies.length} ${dependencies.length === 1 ? 'dependency' : 'dependencies'}`
}

function pluginAdapterError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}
