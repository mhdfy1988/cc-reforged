import { errorMessage } from '../../utils/errors.js';
import { logMCPError } from '../../utils/log.js';
import { getMcpToolsCommandsAndResources } from './client.js';
export async function loadCcrMcpRuntimeSnapshot(logSource = 'mcp-runtime-snapshot') {
    const clients = [];
    const tools = [];
    const commands = [];
    const resources = {};
    try {
        await getMcpToolsCommandsAndResources(result => {
            clients.push(result.client);
            tools.push(...result.tools);
            commands.push(...result.commands);
            if (result.resources?.length) {
                resources[result.client.name] = result.resources;
            }
        });
    }
    catch (error) {
        logMCPError(logSource, `Failed to load MCP runtime tools: ${errorMessage(error)}`);
    }
    return {
        clients,
        tools,
        commands,
        resources,
    };
}
//# sourceMappingURL=runtimeSnapshot.js.map