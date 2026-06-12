import { clearAllCaches } from '../../utils/plugins/cacheUtils.js'
import { parsePluginIdentifier } from '../../utils/plugins/pluginIdentifier.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'
import type { PluginOperationResult } from './pluginOperations.js'

/**
 * Built-in Plugins have no package installation record, so they cannot enter
 * the package lifecycle transaction. Keep this one compatibility write
 * explicit and isolated until built-ins have a first-class domain provider.
 */
export function setBuiltinPluginIntent(
  pluginId: string,
  enabled: boolean,
): PluginOperationResult {
  const operation = enabled ? 'enable' : 'disable'
  const { error } = updateSettingsForSource('userSettings', {
    enabledPlugins: {
      ...getSettingsForSource('userSettings')?.enabledPlugins,
      [pluginId]: enabled,
    },
  })
  if (error) {
    return {
      success: false,
      message: `Failed to ${operation} built-in plugin: ${error.message}`,
    }
  }
  clearAllCaches()
  const { name } = parsePluginIdentifier(pluginId)
  return {
    success: true,
    message: `Successfully ${operation}d built-in plugin: ${name}`,
    pluginId,
    pluginName: name,
    scope: 'user',
  }
}
