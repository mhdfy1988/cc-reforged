import {
  createExtensionCapabilityCatalog,
  type ExtensionCapabilityProviderContext,
} from './capabilityCatalog.js'
import { toExtensionCapabilityCatalogDto } from './capabilityDtos.js'
import { createMcpCapabilityProvider } from './mcpCapabilityProvider.js'
import { createPluginCapabilityProvider } from './pluginCapabilityProvider.js'
import { createSkillCapabilityProvider } from './skillCapabilityProvider.js'
import { createToolCapabilityProvider } from './toolCapabilityProvider.js'

export type ListExtensionCapabilitiesOptions =
  ExtensionCapabilityProviderContext & {
    cwd?: string
    configHomeDir?: string
  }

export async function listExtensionCapabilities(
  options: ListExtensionCapabilitiesOptions = {},
): Promise<Record<string, unknown>> {
  const catalog = await createExtensionCapabilityCatalog({
    providers: [
      createSkillCapabilityProvider(),
      createMcpCapabilityProvider(),
      createToolCapabilityProvider(),
      createPluginCapabilityProvider(),
    ],
    context: options,
  })
  return toExtensionCapabilityCatalogDto(catalog)
}
