import type {
  ExtensionCapability,
  ExtensionCapabilityCatalog,
} from './capabilityTypes.js'

export function toExtensionCapabilityDto(
  capability: ExtensionCapability,
): Record<string, unknown> {
  return capability as unknown as Record<string, unknown>
}

export function toExtensionCapabilityCatalogDto(
  catalog: ExtensionCapabilityCatalog,
): Record<string, unknown> {
  return catalog as unknown as Record<string, unknown>
}
