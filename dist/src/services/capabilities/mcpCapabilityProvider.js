import { listCoreMcpServers } from '../../core/mcpCore.js';
export function createMcpCapabilityProvider() {
    return {
        id: 'mcp',
        async listCapabilities(context) {
            return listMcpCapabilities(context);
        },
    };
}
export async function listMcpCapabilities(_context = {}) {
    const result = await listCoreMcpServers({ includeDisabled: true });
    const servers = Object.values(result.servers ?? {});
    const capabilities = servers.map(toExtensionCapability);
    const errors = Array.isArray(result.errors) ? result.errors : [];
    if (errors.length === 0) {
        return capabilities;
    }
    return [
        ...capabilities,
        {
            schemaVersion: 1,
            id: 'mcp:catalog-errors',
            name: 'mcp:catalog-errors',
            displayName: 'MCP catalog errors',
            description: 'MCP 配置读取存在错误。',
            kind: 'mcp-server',
            source: {
                kind: 'mcp',
                label: 'MCP config',
            },
            state: {
                installed: false,
                enabled: false,
                available: false,
                runtimeVisible: false,
                status: 'failed',
            },
            invocation: {
                modelInvocable: false,
                userInvocable: false,
                toolInvocable: false,
            },
            relations: {},
            diagnostics: errors.map(error => ({
                kind: 'source',
                severity: 'error',
                message: String(error),
            })),
        },
    ];
}
function toExtensionCapability(server) {
    const enabled = server.enabled !== false;
    const status = enabled ? 'enabled' : 'disabled';
    const sourceKind = server.source === 'plugin' ? 'plugin' : 'mcp';
    const diagnostics = enabled
        ? []
        : [
            {
                kind: 'availability',
                severity: 'info',
                code: 'mcp-disabled',
                message: `MCP server ${server.name} is disabled.`,
            },
        ];
    return {
        schemaVersion: 1,
        id: `mcp-server:${server.name}`,
        name: server.name,
        displayName: server.name,
        description: server.command ?? server.url ?? server.transport ?? server.name,
        kind: 'mcp-server',
        source: {
            kind: sourceKind,
            label: server.source ?? 'mcp',
            ref: server.scope,
            ...(sourceKind === 'plugin' ? { pluginId: server.installKind } : {}),
            mcpServerName: server.name,
        },
        state: {
            installed: true,
            enabled,
            available: enabled,
            runtimeVisible: false,
            status,
        },
        invocation: {
            modelInvocable: false,
            userInvocable: false,
            toolInvocable: false,
        },
        relations: {
            ...(sourceKind === 'plugin' && server.installKind
                ? { parentPluginId: server.installKind }
                : {}),
            runtimeRef: `mcp:${server.name}`,
        },
        diagnostics,
        metadata: {
            scope: server.scope,
            type: server.type,
            transport: server.transport,
            installKind: server.installKind,
            command: server.command,
            url: server.url,
            args: server.args,
        },
    };
}
//# sourceMappingURL=mcpCapabilityProvider.js.map