import zipObject from 'lodash-es/zipObject.js';
import { normalizeNameForMCP } from './normalization.js';
export const MAX_MCP_DESCRIPTION_LENGTH = 2048;
export function shouldSkipMcpToolPrefix(params) {
    return params.config.type === 'sdk' && isTruthyEnvValue(params.noPrefixEnvValue);
}
export function getMcpToolSearchHint(meta) {
    return typeof meta?.['anthropic/searchHint'] === 'string'
        ? meta['anthropic/searchHint'].replace(/\s+/g, ' ').trim() || undefined
        : undefined;
}
export function getMcpToolPromptText(description) {
    const desc = description ?? '';
    return desc.length > MAX_MCP_DESCRIPTION_LENGTH
        ? `${desc.slice(0, MAX_MCP_DESCRIPTION_LENGTH)}… [truncated]`
        : desc;
}
export function toServerResources(params) {
    return params.resources.map(resource => ({
        ...resource,
        server: params.serverName,
    }));
}
export function toMcpPromptCommands(params) {
    return params.prompts.map(prompt => {
        const argNames = Object.values(prompt.arguments ?? {}).map(k => k.name);
        return {
            type: 'prompt',
            name: getMcpPromptCommandName(params.clientName, prompt.name),
            description: prompt.description ?? '',
            hasUserSpecifiedDescription: !!prompt.description,
            contentLength: 0,
            isEnabled: () => true,
            isHidden: false,
            isMcp: true,
            progressMessage: 'running',
            userFacingName() {
                return `${params.clientName}:${prompt.name} (MCP)`;
            },
            argNames,
            source: 'mcp',
            async getPromptForCommand(args) {
                try {
                    return await params.runPrompt(prompt.name, zipObject(argNames, args.split(' ')));
                }
                catch (error) {
                    params.onPromptError(prompt.name, error);
                    throw error;
                }
            },
        };
    });
}
export function getMcpPromptCommandName(clientName, promptName) {
    return `mcp__${normalizeNameForMCP(clientName)}__${promptName}`;
}
function isTruthyEnvValue(value) {
    return value === '1' || value === 'true';
}
//# sourceMappingURL=discoveryAdapters.js.map