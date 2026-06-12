import { resolve } from 'node:path'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import {
  createPluginDomainSession,
  type PluginDomainSession,
} from '../services/plugins/pluginDomainSession.js'
import { PluginInspector } from '../services/plugins/pluginInspector.js'
import {
  PluginActionService,
  type PluginActionApplyRequest,
  type PluginActionExecutor,
  type PluginActionRequest,
} from '../services/plugins/pluginActionService.js'
import { createPluginTransactionExecutor } from '../services/plugins/pluginInstallTransaction.js'
import { PluginConfigurationService } from '../services/plugins/pluginConfigurationService.js'
import type {
  PluginConfigurationIdentity,
} from '../services/plugins/pluginDomainTypes.js'
import {
  PluginRuntimeActivator,
  type PluginRuntimeHostAdapter,
} from '../services/plugins/pluginRuntimeActivator.js'
import {
  PluginMarketplaceService,
  type PluginMarketplaceMutationResult,
} from '../services/plugins/pluginMarketplaceService.js'
import {
  PluginLocalImportService,
  type PluginLocalImportRequest,
  type PluginLocalImportResult,
} from '../services/plugins/pluginLocalImportService.js'
import type { MarketplaceSource } from '../utils/plugins/schemas.js'

export type CorePluginRequestContext = {
  workspaceRoot: string
  currentCwd: string
  configHomeDir: string
  runtimeInstanceId: string
  requestId?: string
}

export type PluginRuntimeHostAdapterFactory = (
  context: CorePluginRequestContext,
) =>
  | PluginRuntimeHostAdapter
  | Promise<PluginRuntimeHostAdapter>

export class CorePluginService {
  private readonly inspector = new PluginInspector()
  private readonly actions: PluginActionService
  private readonly runtimeActivator = new PluginRuntimeActivator()
  private readonly configuration = new PluginConfigurationService()
  private readonly marketplaces = new PluginMarketplaceService()
  private readonly localImports = new PluginLocalImportService()
  private readonly runtimeHostAdapterFactory?: PluginRuntimeHostAdapterFactory

  constructor(options: {
    executor?: PluginActionExecutor
    runtimeHostAdapterFactory?: PluginRuntimeHostAdapterFactory
  } = {}) {
    this.actions = new PluginActionService({
      createSession: context => this.createSession(context),
      executor: options.executor ?? createPluginTransactionExecutor(),
    })
    this.runtimeHostAdapterFactory = options.runtimeHostAdapterFactory
  }

  async listCatalog(context: CorePluginRequestContext) {
    return this.inspector.listCatalog(this.createSession(context))
  }

  async inspect(pluginId: string, context: CorePluginRequestContext) {
    return this.inspector.inspect(pluginId, this.createSession(context))
  }

  async listMarketplaces(context: CorePluginRequestContext) {
    return this.marketplaces.list(this.createSession(context))
  }

  async addMarketplace(
    input: {
      source: MarketplaceSource
      scope: PluginConfigurationIdentity['scope']
    },
    context: CorePluginRequestContext,
  ): Promise<PluginMarketplaceMutationResult> {
    return this.marketplaces.add(this.createSession(context), input)
  }

  async removeMarketplace(
    input: { name: string; confirmed: boolean },
    context: CorePluginRequestContext,
  ): Promise<PluginMarketplaceMutationResult> {
    return this.marketplaces.remove(this.createSession(context), input)
  }

  async refreshMarketplace(
    name: string,
    context: CorePluginRequestContext,
  ): Promise<PluginMarketplaceMutationResult> {
    return this.marketplaces.refresh(this.createSession(context), name)
  }

  async importLocal(
    input: PluginLocalImportRequest,
    context: CorePluginRequestContext,
  ): Promise<PluginLocalImportResult> {
    return this.localImports.importLocal(this.createSession(context), input)
  }

  async plan(
    request: PluginActionRequest,
    context: CorePluginRequestContext,
  ) {
    return this.actions.plan(request, this.createSession(context))
  }

  async apply(request: PluginActionApplyRequest) {
    return this.actions.apply(request)
  }

  getOperation(
    operationId: string,
    context?: CorePluginRequestContext,
  ) {
    if (!context) return this.actions.getOperation(operationId)
    return this.actions.getPersistedOperation(
      operationId,
      this.createSession(context),
    )
  }

  cancelOperation(operationId: string) {
    return this.actions.cancelOperation(operationId)
  }

  async activateRuntime(context: CorePluginRequestContext) {
    if (!this.runtimeHostAdapterFactory) {
      throw Object.assign(
        new Error(
          'This Plugin API host has not registered a runtime activation adapter.',
        ),
        { code: 'plugin-runtime-host-unavailable' },
      )
    }
    const host = await this.runtimeHostAdapterFactory(context)
    return this.runtimeActivator.activate(this.createSession(context), host)
  }

  async getRuntimeSnapshot(context: CorePluginRequestContext) {
    return this.createSession(context).runtime.read()
  }

  async inspectConfiguration(
    identity: PluginConfigurationIdentity,
    context: CorePluginRequestContext,
  ) {
    return this.configuration.inspect(this.createSession(context), identity)
  }

  async saveConfiguration(
    request: {
      identity: PluginConfigurationIdentity
      values: Readonly<Record<string, unknown>>
    },
    context: CorePluginRequestContext,
  ) {
    return this.configuration.save(this.createSession(context), request)
  }

  async deleteConfiguration(
    request: {
      identity: PluginConfigurationIdentity
      removeOptions?: boolean
      removeSecrets?: boolean
      removeData?: boolean
    },
    context: CorePluginRequestContext,
  ) {
    return this.configuration.delete(this.createSession(context), request)
  }

  getActionServiceForTests(): PluginActionService {
    return this.actions
  }

  private createSession(context: CorePluginRequestContext): PluginDomainSession {
    return createPluginDomainSession({
      workspaceRoot: resolve(context.workspaceRoot),
      currentCwd: resolve(context.currentCwd),
      configHomeDir: resolve(context.configHomeDir),
      runtimeInstanceId: context.runtimeInstanceId,
      ...(context.requestId ? { requestId: context.requestId } : {}),
      environment: process.env,
    })
  }
}

export function createCurrentProcessPluginRequestContext(options: {
  workspaceRoot?: string
  currentCwd?: string
  configHomeDir?: string
  runtimeInstanceId?: string
  requestId?: string
} = {}): CorePluginRequestContext {
  const currentCwd = resolve(options.currentCwd ?? process.cwd())
  return {
    workspaceRoot: resolve(options.workspaceRoot ?? currentCwd),
    currentCwd,
    configHomeDir: resolve(
      options.configHomeDir ?? getClaudeConfigHomeDir(),
    ),
    runtimeInstanceId: options.runtimeInstanceId ?? 'current-process',
    ...(options.requestId ? { requestId: options.requestId } : {}),
  }
}
