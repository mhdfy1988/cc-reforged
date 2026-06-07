import type {
  ExtensionCapability,
  ExtensionCapabilityKind,
} from './capabilityTypes.js'
import { normalizePluginId } from './pluginIdentityResolver.js'

export type PluginImpactProjection = {
  pluginId: string
  childCapabilityIds: string[]
  affectedRuntimeSurfaces: ExtensionCapabilityKind[]
}

export function projectPluginImpact(
  capabilities: readonly ExtensionCapability[],
  rawPluginId: string,
): PluginImpactProjection {
  const pluginId = normalizePluginId(rawPluginId) ?? rawPluginId
  const children = capabilities.filter(
    capability =>
      capability.kind !== 'plugin' &&
      capability.relations.parentPluginId === pluginId,
  )
  return {
    pluginId,
    childCapabilityIds: children.map(capability => capability.id).sort(),
    affectedRuntimeSurfaces: [
      ...new Set(children.map(capability => capability.kind)),
    ].sort(),
  }
}
