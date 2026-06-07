import { normalizePluginId } from './pluginIdentityResolver.js';
import { createExtensionCapabilityId } from './capabilityIdentity.js';
export function createMcpCapabilityProvider() {
    return {
        id: 'mcp',
        async listCapabilities(context) {
            return listMcpCapabilities(context);
        },
    };
}
export async function listMcpCapabilities(context = {}) {
    const providerContext = context;
    const result = providerContext.capabilityEnvironment?.mcpConfig ??
        providerContext.mcpConfig ?? {
        servers: [],
        errors: [],
    };
    const servers = [...result.servers];
    const runtimeClients = getMcpClients(providerContext);
    const runtimeClientByName = new Map(runtimeClients.map(client => [client.name, client]));
    const configuredServerNames = new Set(servers.map(server => server.name));
    const capabilities = [
        ...servers.map(server => toExtensionCapability(server, runtimeClientByName.get(server.name))),
        ...runtimeClients
            .filter(client => !configuredServerNames.has(client.name))
            .map(toRuntimeServerCapability),
        ...listMcpRuntimeSurfaceCapabilities(providerContext),
    ];
    const errors = [...result.errors];
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
                message: formatMcpCatalogError(error),
            })),
        },
    ];
}
function formatMcpCatalogError(error) {
    if (typeof error === 'string')
        return error;
    if (error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string') {
        return error.message;
    }
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
export function listMcpRuntimeSurfaceCapabilities(context = {}) {
    return [
        ...listMcpResourceCapabilities(getMcpResources(context)),
        ...listMcpPromptCapabilities(getMcpCommands(context)),
    ].sort((a, b) => a.id.localeCompare(b.id));
}
function toExtensionCapability(server, runtimeClient, options = { configured: true }) {
    const configured = options.configured !== false;
    const availability = getMcpServerAvailability(server, runtimeClient);
    const sourceKind = server.source === 'plugin' ? 'plugin' : 'mcp';
    const pluginId = normalizePluginId(server.pluginSource);
    const diagnostics = createMcpServerDiagnostics(server.name, availability);
    const installed = configured && server.installKind !== 'manual-config';
    return {
        schemaVersion: 1,
        id: createExtensionCapabilityId({
            kind: 'mcp-server',
            sourceKind,
            name: server.name,
            sourceRef: server.scope,
            pluginId,
            mcpServerName: server.name,
        }),
        name: server.name,
        displayName: server.name,
        description: server.command ?? server.url ?? server.transport ?? server.name,
        kind: 'mcp-server',
        source: {
            kind: sourceKind,
            label: server.source ?? 'mcp',
            ref: server.scope,
            ...(pluginId ? { pluginId } : {}),
            mcpServerName: server.name,
        },
        state: {
            installed,
            configured,
            enabled: availability.enabled,
            available: availability.available,
            runtimeConnected: runtimeClient?.type === 'connected',
            runtimeVisible: false,
            status: availability.status,
        },
        invocation: {
            modelInvocable: false,
            userInvocable: false,
            toolInvocable: false,
        },
        relations: {
            ...(pluginId ? { parentPluginId: pluginId } : {}),
            runtimeRef: `mcp:${server.name}`,
        },
        diagnostics,
        metadata: {
            scope: server.scope,
            type: server.type,
            transport: server.transport,
            installKind: server.installKind,
            configured,
            pluginSource: server.pluginSource,
            command: server.command,
            url: server.url,
            args: server.args,
            runtimeType: runtimeClient?.type,
            runtimeError: runtimeClient?.type === 'failed' ? runtimeClient.error : undefined,
        },
    };
}
function toRuntimeServerCapability(runtimeClient) {
    return toExtensionCapability({
        name: runtimeClient.name,
        enabled: runtimeClient.type !== 'disabled',
        scope: runtimeClient.config.scope,
        type: runtimeClient.config.type,
        transport: runtimeClient.config.type,
        source: runtimeClient.config.pluginSource ? 'plugin' : 'mcp',
        pluginSource: runtimeClient.config.pluginSource,
        command: 'command' in runtimeClient.config ? runtimeClient.config.command : undefined,
        url: 'url' in runtimeClient.config ? runtimeClient.config.url : undefined,
        args: 'args' in runtimeClient.config ? runtimeClient.config.args : undefined,
    }, runtimeClient, { configured: false });
}
function getMcpServerAvailability(server, runtimeClient) {
    if (server.enabled === false || runtimeClient?.type === 'disabled') {
        return {
            enabled: false,
            available: false,
            status: 'disabled',
            code: 'mcp-disabled',
            message: `MCP server ${server.name} is disabled.`,
            severity: 'info',
        };
    }
    if (!runtimeClient) {
        return {
            enabled: true,
            available: false,
            status: 'unavailable',
            code: 'mcp-runtime-unavailable',
            message: `MCP server ${server.name} is configured but not connected in the current runtime snapshot.`,
            severity: 'warning',
        };
    }
    switch (runtimeClient.type) {
        case 'connected':
            return {
                enabled: true,
                available: true,
                status: 'enabled',
            };
        case 'needs-auth':
            return {
                enabled: true,
                available: false,
                status: 'needs-auth',
                code: 'mcp-needs-auth',
                message: `MCP server ${server.name} needs authentication.`,
            };
        case 'failed':
            return {
                enabled: true,
                available: false,
                status: 'failed',
                code: 'mcp-failed',
                message: runtimeClient.error ?? `MCP server ${server.name} failed to connect.`,
            };
        case 'pending':
            return {
                enabled: true,
                available: false,
                status: 'unavailable',
                code: 'mcp-pending',
                message: `MCP server ${server.name} is pending connection.`,
            };
    }
}
function createMcpServerDiagnostics(serverName, availability) {
    if (!availability.code || !availability.message) {
        return [];
    }
    return [
        {
            kind: 'availability',
            severity: availability.severity ??
                (availability.status === 'failed' ? 'error' : 'warning'),
            code: availability.code,
            message: availability.message,
        },
    ];
}
function listMcpResourceCapabilities(resourcesByServer) {
    const capabilities = [];
    for (const [serverName, resources] of Object.entries(resourcesByServer)) {
        for (const resource of resources) {
            const name = resource.name ?? resource.uri;
            capabilities.push({
                schemaVersion: 1,
                id: createExtensionCapabilityId({
                    kind: 'mcp-resource',
                    sourceKind: 'mcp',
                    name,
                    sourceRef: resource.uri,
                    mcpServerName: serverName,
                }),
                name,
                displayName: name,
                description: resource.description ?? resource.mimeType ?? `MCP resource ${resource.uri}`,
                kind: 'mcp-resource',
                source: {
                    kind: 'mcp',
                    label: `MCP ${serverName}`,
                    mcpServerName: serverName,
                },
                state: {
                    installed: false,
                    enabled: true,
                    available: true,
                    runtimeVisible: false,
                    status: 'available',
                },
                invocation: {
                    modelInvocable: false,
                    userInvocable: false,
                    toolInvocable: false,
                },
                relations: {
                    parentMcpServerName: serverName,
                    runtimeRef: `mcp-resource:${serverName}:${resource.uri}`,
                },
                diagnostics: [],
                metadata: {
                    uri: resource.uri,
                    mimeType: resource.mimeType,
                    server: resource.server ?? serverName,
                },
            });
        }
    }
    return capabilities;
}
function listMcpPromptCapabilities(commands) {
    return commands
        .filter(isMcpPromptCommand)
        .map(command => {
        const serverName = getMcpPromptServerName(command);
        const enabled = isCommandEnabled(command);
        return {
            schemaVersion: 1,
            id: createExtensionCapabilityId({
                kind: 'mcp-prompt',
                sourceKind: 'mcp',
                name: command.name,
                sourceRef: command.loadedFrom,
                pluginId: command.pluginId,
                mcpServerName: serverName,
            }),
            name: command.name,
            displayName: command.userFacingName?.() ?? command.name,
            description: command.description,
            kind: 'mcp-prompt',
            source: {
                kind: 'mcp',
                label: serverName ? `MCP ${serverName}` : 'MCP prompt',
                ...(serverName ? { mcpServerName: serverName } : {}),
                ...(command.pluginId ? { pluginId: command.pluginId } : {}),
            },
            state: {
                installed: false,
                enabled,
                available: enabled,
                runtimeVisible: false,
                status: enabled ? 'available' : 'disabled',
            },
            invocation: {
                modelInvocable: false,
                userInvocable: command.userInvocable !== false,
                toolInvocable: false,
            },
            relations: {
                ...(command.pluginId ? { parentPluginId: command.pluginId } : {}),
                ...(serverName ? { parentMcpServerName: serverName } : {}),
                runtimeRef: `mcp-prompt:${command.name}`,
            },
            diagnostics: [],
            metadata: {
                argNames: command.argNames,
                loadedFrom: command.loadedFrom,
                isMcp: command.isMcp === true,
            },
        };
    });
}
function isMcpPromptCommand(command) {
    return (command.type === 'prompt' &&
        command.isMcp === true &&
        command.loadedFrom !== 'mcp');
}
function getMcpPromptServerName(command) {
    const displayName = command.userFacingName?.();
    const displayMatch = displayName?.match(/^([^:]+):/);
    if (displayMatch?.[1])
        return displayMatch[1];
    const parts = command.name.split('__');
    if (parts.length >= 3 && parts[0] === 'mcp') {
        return parts[1];
    }
    return undefined;
}
function isCommandEnabled(command) {
    if (!command.isEnabled)
        return true;
    try {
        return command.isEnabled();
    }
    catch {
        return false;
    }
}
function getMcpResources(context) {
    return (context.capabilityEnvironment?.mcpRuntime.resources ??
        context.mcpResources ??
        context.mcp?.resources ??
        {});
}
function getMcpClients(context) {
    return (context.capabilityEnvironment?.mcpRuntime.clients ??
        context.mcpClients ??
        context.mcp?.clients ??
        []);
}
function getMcpCommands(context) {
    return (context.capabilityEnvironment?.mcpRuntime.commands ??
        context.mcpCommands ??
        context.mcp?.commands ??
        []);
}
//# sourceMappingURL=mcpCapabilityProvider.js.map