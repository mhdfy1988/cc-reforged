import type { LoadedPlugin } from '../../types/plugin.js'
import {
  buildPluginId,
  parsePluginIdentifier,
} from '../../utils/plugins/pluginIdentifier.js'

export function normalizePluginId(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const parsed = parsePluginIdentifier(trimmed)
  return buildPluginId(parsed.name, parsed.marketplace)
}

export function resolveLoadedPluginId(plugin: LoadedPlugin): string {
  const source = normalizePluginId(plugin.source)
  const repository = normalizePluginId(plugin.repository)
  if (source?.includes('@')) return source
  if (repository?.includes('@')) return repository
  return source ?? repository ?? plugin.name
}

export function resolveCommandPluginId(
  command: {
    pluginId?: string
    pluginInfo?: {
      repository?: string
      pluginManifest?: { name?: string }
    }
  },
): string | undefined {
  return (
    normalizePluginId(command.pluginId) ??
    normalizePluginId(command.pluginInfo?.repository) ??
    normalizePluginId(command.pluginInfo?.pluginManifest.name)
  )
}
