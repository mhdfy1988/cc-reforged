import type { CorePluginRequestContext, PluginRuntimeHostAdapterFactory } from '../core/pluginCore.js'
import type { LoadedPlugin, PluginError } from '../types/plugin.js'
import { errorMessage } from '../utils/errors.js'
import { logError } from '../utils/log.js'
import { clearAllCaches } from '../utils/plugins/cacheUtils.js'
import {
  createComponentResults,
  getPluginRuntimeComponents,
  pluginComponentErrors,
} from '../utils/plugins/refresh.js'
import { getPluginCommands, getPluginSkills } from '../utils/plugins/loadPluginCommands.js'
import { loadPluginHooks } from '../utils/plugins/loadPluginHooks.js'
import { loadPluginLspServers } from '../utils/plugins/lspPluginIntegration.js'
import { loadPluginMcpServers } from '../utils/plugins/mcpPluginIntegration.js'
import { clearPluginCacheExclusions } from '../utils/plugins/orphanedPluginFilter.js'
import { loadAllPlugins } from '../utils/plugins/pluginLoader.js'
import { clearInstalledPluginsCache } from '../utils/plugins/installedPluginsManager.js'
import { resetSettingsCache } from '../utils/settings/settingsCache.js'
import type {
  PluginRuntimeComponentResult,
  PluginRuntimePreparedPlugin,
} from '../services/plugins/pluginRuntimeActivator.js'

export const createAppServerPluginRuntimeHostAdapter: PluginRuntimeHostAdapterFactory =
  (context: CorePluginRequestContext) => ({
    runtimeInstanceId: context.runtimeInstanceId,
    async prepare() {
      resetSettingsCache()
      clearInstalledPluginsCache()
      clearAllCaches()
      clearPluginCacheExclusions()

      const pluginResult = await loadAllPlugins()
      const { enabled, disabled, errors } = pluginResult

      const [pluginCommands, pluginSkills, mcpCounts, lspCounts, hookResult] =
        await Promise.all([
          getPluginCommands(),
          getPluginSkills(),
          loadMcpServers(enabled, errors),
          loadLspServers(enabled, errors),
          loadHooks(),
        ])

      const hookFailures = hookResult.error
        ? hookComponentFailures(enabled, hookResult.error)
        : []
      const componentErrors = [
        ...enabled.flatMap(plugin => pluginComponentErrors(plugin, errors)),
        ...hookFailures,
      ]

      return {
        plugins: enabled.map(toPreparedPlugin),
        loadedPlugins: [...enabled, ...disabled],
        componentResults: createComponentResults(enabled, componentErrors),
        payload: {
          enabledCount: enabled.length,
          disabledCount: disabled.length,
          commandCount: pluginCommands.length,
          skillCount: pluginSkills.length,
          mcpCount: sum(mcpCounts),
          lspCount: sum(lspCounts),
          hookFailed: hookResult.error !== undefined,
        },
      }
    },
    async commit() {
      return []
    },
  })

function toPreparedPlugin(plugin: LoadedPlugin): PluginRuntimePreparedPlugin {
  return {
    pluginId: plugin.source,
    ...(plugin.manifest.version ? { version: plugin.manifest.version } : {}),
    components: getPluginRuntimeComponents(plugin),
  }
}

async function loadMcpServers(
  plugins: readonly LoadedPlugin[],
  errors: PluginError[],
): Promise<number[]> {
  return Promise.all(
    plugins.map(async plugin => {
      if (plugin.mcpServers) return Object.keys(plugin.mcpServers).length
      const servers = await loadPluginMcpServers(plugin, errors)
      if (servers) plugin.mcpServers = servers
      return servers ? Object.keys(servers).length : 0
    }),
  )
}

async function loadLspServers(
  plugins: readonly LoadedPlugin[],
  errors: PluginError[],
): Promise<number[]> {
  return Promise.all(
    plugins.map(async plugin => {
      if (plugin.lspServers) return Object.keys(plugin.lspServers).length
      const servers = await loadPluginLspServers(plugin, errors)
      if (servers) plugin.lspServers = servers
      return servers ? Object.keys(servers).length : 0
    }),
  )
}

async function loadHooks(): Promise<{ error?: unknown }> {
  try {
    await loadPluginHooks()
    return {}
  } catch (error) {
    logError(error)
    return { error }
  }
}

function hookComponentFailures(
  plugins: readonly LoadedPlugin[],
  error: unknown,
): PluginRuntimeComponentResult[] {
  return plugins
    .filter(plugin => getPluginRuntimeComponents(plugin).includes('hook'))
    .map(plugin => ({
      pluginId: plugin.source,
      component: 'hook',
      state: 'failed',
      diagnostic: `Plugin hook refresh failed: ${errorMessage(error)}`,
    }))
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
