import { createExtensionCapabilityCatalog, } from './capabilityCatalog.js';
import { toExtensionCapabilityCatalogDto } from './capabilityDtos.js';
import { createMcpCapabilityProvider } from './mcpCapabilityProvider.js';
import { createPluginCapabilityProvider } from './pluginCapabilityProvider.js';
import { createSkillCapabilityProvider } from './skillCapabilityProvider.js';
import { createToolCapabilityProvider } from './toolCapabilityProvider.js';
export async function listExtensionCapabilities(options = {}) {
    const catalog = await createExtensionCapabilityCatalog({
        providers: [
            createSkillCapabilityProvider(),
            createMcpCapabilityProvider(),
            createToolCapabilityProvider(),
            createPluginCapabilityProvider(),
        ],
        context: options,
    });
    return toExtensionCapabilityCatalogDto(catalog);
}
//# sourceMappingURL=capabilityService.js.map