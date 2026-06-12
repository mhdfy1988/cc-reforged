import type { AppServerContext } from '../router.js'
import { AppServerError } from '../errors.js'
import type { AppConnectorCapabilityInput } from '../../services/capabilities/appCapabilityProvider.js'
import { MarketplaceSourceSchema } from '../../utils/plugins/schemas.js'
import {
  PluginsActionApplyParamsSchema,
  PluginsActionPlanParamsSchema,
  PluginsAppsListParamsSchema,
  PluginsAppsRegisterParamsSchema,
  PluginsAppsUnregisterParamsSchema,
  PluginsCatalogListParamsSchema,
  PluginsConfigDeleteParamsSchema,
  PluginsConfigGetParamsSchema,
  PluginsConfigSaveParamsSchema,
  PluginsInspectParamsSchema,
  PluginsLocalImportParamsSchema,
  PluginsMarketplaceAddParamsSchema,
  PluginsMarketplaceRefreshParamsSchema,
  PluginsMarketplaceRemoveParamsSchema,
  PluginsMarketplacesListParamsSchema,
  PluginsOperationCancelParamsSchema,
  PluginsOperationGetParamsSchema,
  PluginsRuntimeActivateParamsSchema,
  PluginsRuntimeGetParamsSchema,
} from '../protocol.js'

export async function handlePluginsCatalogList(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsCatalogListParamsSchema.parse(params ?? {})
  return context.core.plugins.listCatalog(toCoreContext(context, parsed))
}

export async function handlePluginsMarketplacesList(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsMarketplacesListParamsSchema.parse(params ?? {})
  return context.core.plugins.listMarketplaces(toCoreContext(context, parsed))
}

export async function handlePluginsMarketplaceAdd(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsMarketplaceAddParamsSchema.parse(params)
  try {
    return await context.core.plugins.addMarketplace(
      {
        source: MarketplaceSourceSchema().parse(parsed.source),
        scope: parsed.scope,
      },
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsLocalImport(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsLocalImportParamsSchema.parse(params)
  try {
    return await context.core.plugins.importLocal(
      {
        path: parsed.path,
        kind: parsed.kind,
        enableAfterInstall: parsed.enableAfterInstall,
      },
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsMarketplaceRemove(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsMarketplaceRemoveParamsSchema.parse(params)
  try {
    return await context.core.plugins.removeMarketplace(
      { name: parsed.name, confirmed: parsed.confirmed },
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsMarketplaceRefresh(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsMarketplaceRefreshParamsSchema.parse(params)
  try {
    return await context.core.plugins.refreshMarketplace(
      parsed.name,
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsInspect(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsInspectParamsSchema.parse(params)
  return context.core.plugins.inspect(
    parsed.pluginId,
    toCoreContext(context, parsed),
  )
}

export async function handlePluginsActionPlan(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsActionPlanParamsSchema.parse(params)
  return context.core.plugins.planAction(
    {
      action: parsed.action,
      target: parsed.target,
      ...(parsed.deleteOptions
        ? { deleteOptions: parsed.deleteOptions }
        : {}),
      ...(parsed.installOptions
        ? { installOptions: parsed.installOptions }
        : {}),
    },
    toCoreContext(context, parsed),
  )
}

export async function handlePluginsActionApply(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsActionApplyParamsSchema.parse(params)
  try {
    return await context.core.plugins.applyAction(parsed)
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsOperationGet(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsOperationGetParamsSchema.parse(params)
  return context.core.plugins.getOperation(
    parsed.operationId,
    toCoreContext(context, parsed),
  )
}

export function handlePluginsOperationCancel(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsOperationCancelParamsSchema.parse(params)
  try {
    return context.core.plugins.cancelOperation(parsed.operationId)
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsRuntimeActivate(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsRuntimeActivateParamsSchema.parse(params ?? {})
  try {
    return await context.core.plugins.activateRuntime(
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsRuntimeGet(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsRuntimeGetParamsSchema.parse(params ?? {})
  return context.core.plugins.getRuntimeSnapshot(
    toCoreContext(context, parsed),
  )
}

export async function handlePluginsConfigGet(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsConfigGetParamsSchema.parse(params)
  return context.core.plugins.inspectConfiguration(
    parsed.identity,
    toCoreContext(context, parsed),
  )
}

export async function handlePluginsConfigSave(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsConfigSaveParamsSchema.parse(params)
  try {
    return await context.core.plugins.saveConfiguration(
      {
        identity: parsed.identity,
        values: parsed.values,
      },
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsConfigDelete(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsConfigDeleteParamsSchema.parse(params)
  try {
    return await context.core.plugins.deleteConfiguration(
      {
        identity: parsed.identity,
        removeOptions: parsed.removeOptions,
        removeSecrets: parsed.removeSecrets,
        removeData: parsed.removeData,
      },
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsAppsRegister(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsAppsRegisterParamsSchema.parse(params)
  try {
    return await context.core.plugins.registerProvidedApps(
      parsed.pluginId,
      parsed.apps as AppConnectorCapabilityInput[],
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export function handlePluginsAppsUnregister(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsAppsUnregisterParamsSchema.parse(params)
  try {
    return context.core.plugins.unregisterProvidedApps(parsed.pluginId)
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

export async function handlePluginsAppsList(
  context: AppServerContext,
  params: unknown,
) {
  const parsed = PluginsAppsListParamsSchema.parse(params)
  try {
    return await context.core.plugins.listAppRelations(
      parsed.pluginId,
      toCoreContext(context, parsed),
    )
  } catch (error) {
    throw toPluginAppServerError(error)
  }
}

function toCoreContext(
  context: AppServerContext,
  params: {
    cwd?: string
    workspaceRoot?: string
    configHomeDir?: string
    runtimeInstanceId?: string
  },
) {
  const currentCwd = params.cwd ?? process.cwd()
  return {
    workspaceRoot: params.workspaceRoot ?? currentCwd,
    currentCwd,
    configHomeDir: params.configHomeDir ?? context.ccrHome,
    runtimeInstanceId: params.runtimeInstanceId ?? 'app-server',
  }
}

function toPluginAppServerError(error: unknown): AppServerError {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : 'plugin-action-error'
  return new AppServerError(
    'invalid_params',
    error instanceof Error ? error.message : String(error),
    { code },
  )
}
