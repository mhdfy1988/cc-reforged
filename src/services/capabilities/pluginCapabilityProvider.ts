import type { ExtensionCapability } from './capabilityTypes.js'
import type {
  ExtensionCapabilityProvider,
  ExtensionCapabilityProviderContext,
} from './capabilityCatalog.js'

export type PluginCapabilityProviderInput = {
  plugins?: readonly ExtensionCapability[]
}

export type PluginCapabilityProviderContext =
  ExtensionCapabilityProviderContext &
    PluginCapabilityProviderInput

export function createPluginCapabilityProvider(
  input: PluginCapabilityProviderInput = {},
): ExtensionCapabilityProvider {
  return {
    id: 'plugins',
    listCapabilities(context) {
      const runtimePlugins = (context as PluginCapabilityProviderContext).plugins
      return [...(runtimePlugins ?? input.plugins ?? [])]
    },
  }
}
