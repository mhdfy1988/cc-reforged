import {
  createExtensionCapabilityCatalog,
  type ExtensionCapabilityProviderContext,
} from './capabilityCatalog.js'
import { toExtensionCapabilityCatalogDto } from './capabilityDtos.js'
import { createMcpCapabilityProvider } from './mcpCapabilityProvider.js'
import { createPluginCapabilityProvider } from './pluginCapabilityProvider.js'
import { createSkillCapabilityProvider } from './skillCapabilityProvider.js'
import { createToolCapabilityProvider } from './toolCapabilityProvider.js'
import { createAppCapabilityProvider } from './appCapabilityProvider.js'
import {
  createCapabilityManagementProjection,
  type CapabilityManagementProjection,
} from './managementProjectionService.js'

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
      createAppCapabilityProvider(),
    ],
    context: options,
  })
  return toExtensionCapabilityCatalogDto(catalog)
}

export async function listCapabilityManagementProjection(
  options: ListExtensionCapabilitiesOptions = {},
): Promise<CapabilityManagementProjection> {
  const catalog = await createExtensionCapabilityCatalog({
    providers: [
      createSkillCapabilityProvider(),
      createMcpCapabilityProvider(),
      createToolCapabilityProvider(),
      createPluginCapabilityProvider(),
      createAppCapabilityProvider(),
    ],
    context: options,
  })
  return createCapabilityManagementProjection(catalog)
}
