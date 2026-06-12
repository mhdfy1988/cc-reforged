import type {
  PluginsActionApplyParams,
  PluginsActionApplyResult,
  PluginsActionPlanParams,
  PluginsActionPlanResult,
  PluginsAppsListResult,
  PluginsCatalogListResult,
  PluginsConfigGetResult,
  PluginsMarketplaceAddParams,
  PluginsMarketplaceAddResult,
  PluginsLocalImportParams,
  PluginsLocalImportResult,
  PluginsMarketplaceRefreshParams,
  PluginsMarketplaceRefreshResult,
  PluginsMarketplaceRemoveParams,
  PluginsMarketplaceRemoveResult,
  PluginsOperationGetResult,
  PluginsRuntimeGetResult,
} from '../../../../../../src/app-server/protocol.js'
import type {
  PluginConfigurationScope,
  PluginManagementRecord,
} from '../../../../../../src/services/plugins/pluginDomainTypes.js'

export type PluginCatalogState = PluginsCatalogListResult
export type PluginManagementItem = PluginManagementRecord
export type PluginActionPlanState = PluginsActionPlanResult
export type PluginOperationState = PluginsActionApplyResult
export type PluginRuntimeState = PluginsRuntimeGetResult
export type PluginConfigurationState = PluginsConfigGetResult
export type PluginAppRelationsState = PluginsAppsListResult

export type PluginDetailState = {
  record: PluginManagementItem
  runtime: PluginRuntimeState
  configuration: PluginConfigurationState | null
  apps: PluginAppRelationsState
}

export const pluginManagementClient = {
  list(): Promise<PluginCatalogState> {
    return window.ccr.listPlugins()
  },

  async inspect(
    pluginId: string,
    configurationScope?: PluginConfigurationScope,
  ): Promise<PluginDetailState | null> {
    const record = await window.ccr.inspectPlugin({ pluginId })
    if (!record) return null
    const scope =
      configurationScope ??
      toConfigurationScope(record.effectiveSelection?.target?.scope)
    const configurationWorkspaceRoot =
      scope === 'project' || scope === 'local'
        ? record.effectiveSelection?.target?.workspaceRoot
        : undefined
    const [runtime, configuration, apps] = await Promise.all([
      window.ccr.getPluginRuntime(),
      scope
        ? window.ccr.getPluginConfiguration({
            identity: {
              pluginId,
              scope,
              ...(configurationWorkspaceRoot
                ? { workspaceRoot: configurationWorkspaceRoot }
                : {}),
            },
          })
        : Promise.resolve(null),
      window.ccr.listPluginApps({ pluginId }),
    ])
    return { record, runtime, configuration, apps }
  },

  plan(input: PluginsActionPlanParams): Promise<PluginActionPlanState> {
    return window.ccr.planPluginAction(input)
  },

  apply(input: PluginsActionApplyParams): Promise<PluginOperationState> {
    return window.ccr.applyPluginAction(input)
  },

  getOperation(operationId: string): Promise<PluginsOperationGetResult> {
    return window.ccr.getPluginOperation({ operationId })
  },

  cancelOperation(operationId: string): Promise<PluginOperationState> {
    return window.ccr.cancelPluginOperation({ operationId })
  },

  addMarketplace(
    input: PluginsMarketplaceAddParams,
  ): Promise<PluginsMarketplaceAddResult> {
    return window.ccr.addPluginMarketplace(input)
  },

  importLocal(
    input: PluginsLocalImportParams,
  ): Promise<PluginsLocalImportResult> {
    return window.ccr.importLocalPlugin(input)
  },

  removeMarketplace(
    input: PluginsMarketplaceRemoveParams,
  ): Promise<PluginsMarketplaceRemoveResult> {
    return window.ccr.removePluginMarketplace(input)
  },

  refreshMarketplace(
    input: PluginsMarketplaceRefreshParams,
  ): Promise<PluginsMarketplaceRefreshResult> {
    return window.ccr.refreshPluginMarketplace(input)
  },
}

function toConfigurationScope(
  scope: 'managed' | 'user' | 'project' | 'local' | undefined,
): PluginConfigurationScope | undefined {
  return scope === 'user' || scope === 'project' || scope === 'local'
    ? scope
    : undefined
}
