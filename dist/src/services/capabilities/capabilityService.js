import { createExtensionCapabilityCatalog, } from './capabilityCatalog.js';
import { toExtensionCapabilityCatalogDto } from './capabilityDtos.js';
import { createMcpCapabilityProvider } from './mcpCapabilityProvider.js';
import { createPluginCapabilityProvider } from './pluginCapabilityProvider.js';
import { createSkillCapabilityProvider } from './skillCapabilityProvider.js';
import { createToolCapabilityProvider } from './toolCapabilityProvider.js';
import { createAppCapabilityProvider } from './appCapabilityProvider.js';
import { createCapabilityManagementProjection, } from './managementProjectionService.js';
export async function listExtensionCapabilities(options = {}) {
    const catalog = await createExtensionCapabilityCatalog({
        providers: [
            createSkillCapabilityProvider(),
            createMcpCapabilityProvider(),
            createToolCapabilityProvider(),
            createPluginCapabilityProvider(),
            createAppCapabilityProvider(),
        ],
        context: options,
    });
    return toExtensionCapabilityCatalogDto(catalog);
}
export async function listCapabilityManagementProjection(options = {}) {
    const catalog = await createExtensionCapabilityCatalog({
        providers: [
            createSkillCapabilityProvider(),
            createMcpCapabilityProvider(),
            createToolCapabilityProvider(),
            createPluginCapabilityProvider(),
            createAppCapabilityProvider(),
        ],
        context: options,
    });
    return createCapabilityManagementProjection(catalog);
}
//# sourceMappingURL=capabilityService.js.map