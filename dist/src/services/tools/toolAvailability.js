import { buildCcrToolRegistry, } from './toolRegistry.js';
export function getCcrToolAvailability(entry, context = {}) {
    const runtime = context.runtime ?? 'general';
    const platform = context.platform ?? process.platform;
    if (runtime === 'app-server' && entry.name === 'Bash' && platform === 'win32') {
        return unavailable('platform_unsupported', 'Windows App Server 没有可用的 POSIX shell 运行环境，命令执行应使用 PowerShell 或高层文件工具。');
    }
    if (entry.name === 'PowerShell' && platform !== 'win32') {
        return unavailable('platform_unsupported', 'PowerShell 工具只在 Windows 平台默认可用。');
    }
    if (runtime === 'app-server' && entry.name === 'Agent') {
        const activeAgentCount = context.activeAgentCount ?? 0;
        if (activeAgentCount === 0) {
            return unavailable('agent_definitions_missing', '当前没有已加载的 agent definitions，暴露 Agent 工具只会让模型调用失败。');
        }
    }
    if (entry.name === 'GenerateImage' &&
        context.providerCapabilityTools?.imageGeneration.available === false) {
        return unavailable('provider_unsupported', context.providerCapabilityTools.imageGeneration.message);
    }
    if (entry.name === 'GenerateImage' &&
        context.providerCapabilityTools === undefined &&
        context.providerSupportsImageGeneration === false) {
        return unavailable('provider_unsupported', '当前供应商不支持生图；请切换到 GLM API、OpenAI 或 Codex OAuth。');
    }
    if (entry.tool.isMcp === true) {
        const mcpAvailability = getMcpToolAvailability(entry, context);
        if (mcpAvailability) {
            return mcpAvailability;
        }
    }
    return { available: true };
}
export function filterCcrToolsByAvailability(tools, context = {}) {
    const registry = buildCcrToolRegistry(tools);
    return registry.entries
        .filter(entry => getCcrToolAvailability(entry, context).available)
        .map(entry => entry.tool);
}
export function summarizeCcrToolAvailability(tools, context = {}) {
    const registry = buildCcrToolRegistry(tools);
    const available = [];
    const unavailable = [];
    for (const entry of registry.entries) {
        const availability = getCcrToolAvailability(entry, context);
        if (availability.available) {
            available.push({
                name: entry.name,
                ...(availability.mcpState ? { mcpState: availability.mcpState } : {}),
            });
        }
        else {
            unavailable.push({
                name: entry.name,
                displayName: entry.displayName,
                reason: availability.reason,
                message: availability.message ?? availability.reason,
                ...(availability.mcpState ? { mcpState: availability.mcpState } : {}),
            });
        }
    }
    return { available, unavailable };
}
function unavailable(reason, message, mcpState) {
    return {
        available: false,
        reason,
        message,
        ...(mcpState ? { mcpState } : {}),
    };
}
function getMcpToolAvailability(entry, context) {
    const serverName = entry.source.serverName ?? entry.source.serverId ?? entry.tool.mcpInfo?.serverName;
    if (!serverName) {
        return unavailable('mcp_not_connected', 'MCP 工具缺少 server 信息，无法确认连接状态。', 'pending');
    }
    const status = normalizeMcpServerStatus(context.mcpServerStatuses?.[serverName]);
    if (status) {
        return mapMcpServerStatusToAvailability(serverName, status);
    }
    if (context.connectedMcpServerNames) {
        if (context.connectedMcpServerNames.includes(serverName)) {
            return { available: true, mcpState: 'connected' };
        }
        return unavailable('mcp_not_connected', `MCP server ${serverName} 当前未连接。`, 'pending');
    }
    return undefined;
}
function normalizeMcpServerStatus(status) {
    if (!status) {
        return undefined;
    }
    if (typeof status === 'string') {
        return { state: status };
    }
    return status;
}
function mapMcpServerStatusToAvailability(serverName, status) {
    const detail = status.message ?? status.error;
    switch (status.state) {
        case 'connected':
            return { available: true, mcpState: 'connected' };
        case 'needs-auth':
            return unavailable('mcp_needs_auth', detail ?? `MCP server ${serverName} 需要认证后才能使用。`, status.state);
        case 'failed':
            return unavailable('mcp_connection_failed', detail ?? `MCP server ${serverName} 连接失败。`, status.state);
        case 'disabled':
            return unavailable('mcp_disabled', detail ?? `MCP server ${serverName} 已禁用。`, status.state);
        case 'discovery-failed':
            return unavailable('mcp_discovery_failed', detail ?? `MCP server ${serverName} 已连接，但工具发现失败。`, status.state);
        case 'call-failed':
            return unavailable('mcp_call_failed', detail ?? `MCP server ${serverName} 最近一次工具调用失败。`, status.state);
        case 'pending':
            return unavailable('mcp_not_connected', detail ?? `MCP server ${serverName} 正在连接或等待重连。`, status.state);
    }
}
//# sourceMappingURL=toolAvailability.js.map