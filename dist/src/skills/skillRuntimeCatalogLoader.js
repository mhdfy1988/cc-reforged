import { getMcpSkillCommands, getSkillToolCommands } from '../commands.js';
import { createSkillRuntimeCatalog, } from './skillRuntimeCatalog.js';
import { getSkillRuntimeRequestContext, } from './skillRuntimeRequestContext.js';
export function createModelInvocableSkillRuntimeCatalog(input) {
    return createSkillRuntimeCatalog([
        ...input.localCommands,
        ...(input.mcpCommands ?? []),
    ]);
}
export async function loadModelInvocableSkillRuntimeCatalog(toolUseContext) {
    const requestContext = getSkillRuntimeRequestContext(toolUseContext);
    const localCommands = await getSkillToolCommands(requestContext.cwd, {
        configHomeDir: requestContext.configHomeDir,
    });
    const mcpCommands = getMcpSkillCommands(requestContext.mcpCommands);
    return {
        requestContext,
        localCommands,
        mcpCommands,
        catalog: createModelInvocableSkillRuntimeCatalog({
            localCommands,
            mcpCommands,
        }),
    };
}
//# sourceMappingURL=skillRuntimeCatalogLoader.js.map