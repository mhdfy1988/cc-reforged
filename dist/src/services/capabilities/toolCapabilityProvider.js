import { getAllBaseTools } from '../../tools.js';
import { getCcrToolAvailability, } from '../tools/toolAvailability.js';
import { buildCcrToolRegistry, } from '../tools/toolRegistry.js';
export function createToolCapabilityProvider(options = {}) {
    return {
        id: 'tools',
        listCapabilities(context) {
            return listToolCapabilities({
                ...context,
                ...(options.tools ? { tools: options.tools } : {}),
            });
        },
    };
}
export function listToolCapabilities(context = {}) {
    const tools = (context.tools ?? getAllBaseTools());
    const registry = buildCcrToolRegistry(tools);
    return registry.entries.map(entry => toExtensionCapability(entry, context));
}
function toExtensionCapability(entry, context) {
    const availability = getCcrToolAvailability(entry, context);
    const status = mapAvailabilityStatus(availability.reason);
    const sourceKind = mapToolSourceKind(entry.source.kind);
    const diagnostics = availability.available
        ? []
        : [
            {
                kind: 'availability',
                severity: 'warning',
                code: availability.reason,
                message: availability.message ?? availability.reason ?? 'Tool unavailable.',
            },
        ];
    const serverName = entry.source.serverName ?? entry.source.serverId;
    return {
        schemaVersion: 1,
        id: `${entry.tool.isMcp === true ? 'mcp-tool' : 'tool'}:${entry.name}`,
        name: entry.name,
        displayName: entry.displayName,
        description: getToolDescription(entry),
        kind: entry.tool.isMcp === true ? 'mcp-tool' : 'tool',
        source: {
            kind: sourceKind,
            label: toSourceLabel(entry),
            ...(entry.source.providerId ? { ref: entry.source.providerId } : {}),
            ...(entry.source.pluginId ? { pluginId: entry.source.pluginId } : {}),
            ...(serverName ? { mcpServerName: serverName } : {}),
        },
        state: {
            installed: false,
            enabled: availability.reason !== 'mcp_disabled',
            available: availability.available,
            runtimeVisible: availability.available && entry.exposure !== 'internal',
            status,
        },
        invocation: {
            modelInvocable: availability.available && entry.exposure !== 'internal',
            userInvocable: false,
            toolInvocable: availability.available,
        },
        relations: {
            ...(entry.source.pluginId ? { parentPluginId: entry.source.pluginId } : {}),
            ...(serverName ? { parentMcpServerName: serverName } : {}),
            runtimeRef: `tool:${entry.name}`,
        },
        diagnostics,
        metadata: {
            aliases: entry.aliases,
            category: entry.category,
            exposure: entry.exposure,
            display: entry.display,
            source: entry.source,
        },
    };
}
function mapToolSourceKind(sourceKind) {
    switch (sourceKind) {
        case 'builtin':
            return 'builtin';
        case 'mcp':
            return 'mcp';
        case 'provider':
            return 'provider';
        case 'skill':
            return 'managed-skill';
        case 'plugin':
            return 'plugin';
        case 'dynamic':
            return 'dynamic';
    }
}
function mapAvailabilityStatus(reason) {
    switch (reason) {
        case undefined:
            return 'available';
        case 'mcp_needs_auth':
            return 'needs-auth';
        case 'mcp_connection_failed':
        case 'mcp_discovery_failed':
        case 'mcp_call_failed':
            return 'failed';
        case 'mcp_disabled':
            return 'disabled';
        default:
            return 'unavailable';
    }
}
function toSourceLabel(entry) {
    if (entry.source.kind === 'mcp') {
        return entry.source.serverName
            ? `MCP ${entry.source.serverName}`
            : 'MCP tool';
    }
    if (entry.source.providerId)
        return `Provider ${entry.source.providerId}`;
    if (entry.source.pluginId)
        return `Plugin ${entry.source.pluginId}`;
    return entry.source.kind;
}
function getToolDescription(entry) {
    const description = entry.tool.description;
    return typeof description === 'string' ? description : entry.displayName;
}
//# sourceMappingURL=toolCapabilityProvider.js.map