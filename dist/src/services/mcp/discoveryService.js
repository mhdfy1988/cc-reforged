import { ListPromptsResultSchema, ListResourcesResultSchema, ListToolsResultSchema, } from '@modelcontextprotocol/sdk/types.js';
import { toolMatchesName } from '../../Tool.js';
import { errorMessage } from '../../utils/errors.js';
import { logMCPError } from '../../utils/log.js';
import { recursivelySanitizeUnicode } from '../../utils/sanitization.js';
import { ListMcpResourcesTool, } from '../../tools/ListMcpResourcesTool/ListMcpResourcesTool.js';
import { ReadMcpResourceTool, } from '../../tools/ReadMcpResourceTool/ReadMcpResourceTool.js';
import { toMcpPromptCommands, toServerResources, } from './discoveryAdapters.js';
export async function listMcpToolDefinitionsForClient(client) {
    if (client.type !== 'connected')
        return [];
    try {
        if (!client.capabilities?.tools) {
            return [];
        }
        const result = (await client.client.request({ method: 'tools/list' }, ListToolsResultSchema));
        return recursivelySanitizeUnicode(result.tools);
    }
    catch (error) {
        logMCPError(client.name, `Failed to fetch tools: ${errorMessage(error)}`);
        return [];
    }
}
export async function fetchResourcesForClient(client) {
    if (client.type !== 'connected')
        return [];
    try {
        if (!client.capabilities?.resources) {
            return [];
        }
        const result = await client.client.request({ method: 'resources/list' }, ListResourcesResultSchema);
        if (!result.resources)
            return [];
        return toServerResources({
            resources: result.resources,
            serverName: client.name,
        });
    }
    catch (error) {
        logMCPError(client.name, `Failed to fetch resources: ${errorMessage(error)}`);
        return [];
    }
}
export async function fetchCommandsForClient(params) {
    const { client } = params;
    if (client.type !== 'connected')
        return [];
    try {
        if (!client.capabilities?.prompts) {
            return [];
        }
        const result = (await client.client.request({ method: 'prompts/list' }, ListPromptsResultSchema));
        if (!result.prompts)
            return [];
        const promptsToProcess = recursivelySanitizeUnicode(result.prompts);
        return toMcpPromptCommands({
            clientName: client.name,
            prompts: promptsToProcess,
            runPrompt: async (promptName, args) => {
                const connectedClient = await params.ensureConnectedClient(client);
                const result = await connectedClient.client.getPrompt({
                    name: promptName,
                    arguments: args,
                });
                const transformed = await Promise.all(result.messages.map(message => params.transformResultContent(message.content, connectedClient.name)));
                return transformed.flat();
            },
            onPromptError: (promptName, error) => {
                logMCPError(client.name, `Error running command '${promptName}': ${errorMessage(error)}`);
            },
        });
    }
    catch (error) {
        logMCPError(client.name, `Failed to fetch commands: ${errorMessage(error)}`);
        return [];
    }
}
export function appendResourceToolsIfNeeded(params) {
    if (!params.supportsResources) {
        return params.tools;
    }
    const hasResourceTools = [ListMcpResourcesTool, ReadMcpResourceTool].some(tool => params.tools.some(t => toolMatchesName(t, tool.name)));
    if (hasResourceTools) {
        return params.tools;
    }
    return [...params.tools, ListMcpResourcesTool, ReadMcpResourceTool];
}
export function getDefaultMcpResourceTools() {
    return [ListMcpResourcesTool, ReadMcpResourceTool];
}
//# sourceMappingURL=discoveryService.js.map