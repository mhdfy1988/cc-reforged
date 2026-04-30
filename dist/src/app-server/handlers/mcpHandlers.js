import { McpListParamsSchema } from '../protocol.js';
export async function handleMcpList(context, params) {
    const parsedParams = McpListParamsSchema.parse(params ?? {});
    return context.core.mcp.listServers({
        includeDisabled: parsedParams.includeDisabled,
    });
}
//# sourceMappingURL=mcpHandlers.js.map