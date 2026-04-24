import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { c as _c } from "react/compiler-runtime";
import React, { useEffect, useMemo } from 'react';
import { ClaudeAuthProvider } from '../../services/mcp/auth.js';
import { McpServerConfigSchema } from '../../services/mcp/types.js';
import { extractAgentMcpServers, filterToolsByServer } from '../../services/mcp/utils.js';
import { useAppState } from '../../state/AppState.js';
import { Box, Text } from '../../ink.js';
import { getSessionIngressAuthToken } from '../../utils/sessionIngressAuth.js';
import { MCPAgentServerMenu } from './MCPAgentServerMenu.js';
import { MCPListPanel } from './MCPListPanel.js';
import { MCPRemoteServerMenu } from './MCPRemoteServerMenu.js';
import { MCPStdioServerMenu } from './MCPStdioServerMenu.js';
import { MCPToolDetailView } from './MCPToolDetailView.js';
import { MCPToolListView } from './MCPToolListView.js';
function isObjectRecord(value) {
    return typeof value === 'object' && value !== null;
}
function isMcpConfigScope(value) {
    return (value === 'local' ||
        value === 'user' ||
        value === 'project' ||
        value === 'dynamic' ||
        value === 'enterprise' ||
        value === 'claudeai' ||
        value === 'managed');
}
function isMcpServerConfig(value) {
    return McpServerConfigSchema().safeParse(value).success;
}
function isMcpClientConnection(value) {
    if (!isObjectRecord(value) || typeof value.name !== 'string' || typeof value.type !== 'string' || !isObjectRecord(value.config) || !isMcpConfigScope(value.config.scope)) {
        return false;
    }
    switch (value.type) {
        case 'connected':
        case 'failed':
        case 'needs-auth':
        case 'pending':
        case 'disabled':
            break;
        default:
            return false;
    }
    if (!isMcpServerConfig(value.config)) {
        return false;
    }
    return true;
}
function isToolLike(value) {
    return (isObjectRecord(value) &&
        typeof value.name === 'string' &&
        typeof value.call === 'function' &&
        typeof value.description === 'function' &&
        isObjectRecord(value.inputSchema) &&
        typeof value.isConcurrencySafe === 'function' &&
        typeof value.isEnabled === 'function' &&
        typeof value.isReadOnly === 'function' &&
        typeof value.maxResultSizeChars === 'number' &&
        (value.isDestructive === undefined || typeof value.isDestructive === 'function') &&
        (value.isOpenWorld === undefined || typeof value.isOpenWorld === 'function') &&
        (value.userFacingName === undefined || typeof value.userFacingName === 'function'));
}
function isAgentMcpServerSpec(value) {
    if (typeof value === 'string') {
        return true;
    }
    if (!isObjectRecord(value)) {
        return false;
    }
    const keys = Object.keys(value);
    if (keys.length !== 1) {
        return false;
    }
    const serverConfig = value[keys[0]];
    return isMcpServerConfig(serverConfig);
}
function isAgentDefinitionLike(value) {
    return (isObjectRecord(value) &&
        typeof value.agentType === 'string' &&
        (value.mcpServers === undefined || (Array.isArray(value.mcpServers) && value.mcpServers.every(isAgentMcpServerSpec))));
}
function collectUnsupportedAgentTransportNotices(allAgents) {
    const notices = [];
    for (const agent of allAgents) {
        if (!agent.mcpServers?.length) {
            continue;
        }
        for (const spec of agent.mcpServers) {
            if (typeof spec === 'string') {
                continue;
            }
            const entries = Object.entries(spec);
            if (entries.length !== 1) {
                continue;
            }
            const [serverName, serverConfig] = entries[0];
            const result = McpServerConfigSchema().safeParse(serverConfig);
            if (!result.success) {
                continue;
            }
            const transport = result.data.type ?? 'stdio';
            if (transport === 'stdio' ||
                transport === 'sse' ||
                transport === 'http' ||
                transport === 'claudeai-proxy') {
                continue;
            }
            notices.push({
                source: 'agent',
                name: serverName,
                transport,
                agentType: agent.agentType,
            });
        }
    }
    return notices;
}
function renderUnsupportedTransportNotices(clientNotices, agentNotices) {
    if (clientNotices.length === 0 && agentNotices.length === 0) {
        return null;
    }
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { color: "yellow", children: "Some MCP servers are hidden because this UI does not model their transport yet." }), clientNotices.length > 0 ? (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Hidden MCP clients:" }), clientNotices.map((notice, index) => (_jsxs(Text, { dimColor: true, children: ["- ", notice.name, " (", notice.transport, ")"] }, `${notice.name}:${notice.transport}:${index}`)))] })) : null, agentNotices.length > 0 ? (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Hidden agent MCP specs:" }), agentNotices.map((notice, index) => (_jsxs(Text, { dimColor: true, children: ["- ", notice.agentType, ": ", notice.name, " (", notice.transport, ")"] }, `${notice.agentType}:${notice.name}:${notice.transport}:${index}`)))] })) : null] }));
}
function toMcpDisplayState(value) {
    if (!isObjectRecord(value)) {
        return {
            kind: 'invalid',
            message: 'MCP state is malformed; MCP settings were hidden instead of rendering an empty configuration.',
        };
    }
    const clients = value.clients;
    const tools = value.tools;
    if (!Array.isArray(clients) || !clients.every(isMcpClientConnection)) {
        return {
            kind: 'invalid',
            message: 'MCP clients are malformed; client-specific MCP settings were hidden instead of pretending there were no clients.',
        };
    }
    if (!Array.isArray(tools) || !tools.every(isToolLike)) {
        return {
            kind: 'invalid',
            message: 'MCP tools are malformed; tool-specific MCP settings were hidden instead of pretending there were no tools.',
        };
    }
    return {
        kind: 'valid',
        value: {
            clients,
            tools,
        },
    };
}
function toAgentDefinitionsDisplayState(value) {
    if (!isObjectRecord(value) || !Array.isArray(value.allAgents) || !value.allAgents.every(isAgentDefinitionLike)) {
        return {
            kind: 'invalid',
            message: 'Agent definitions are malformed; agent-driven MCP servers were hidden instead of faking an empty agent list.',
        };
    }
    return {
        kind: 'valid',
        value: {
            allAgents: value.allAgents,
        },
    };
}
function MCPSettingsStateWarning(t0) {
    const { mcpMessage, agentDefinitionsMessage } = t0;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "error", children: "MCP settings unavailable" }), mcpMessage ? _jsx(Text, { dimColor: true, children: mcpMessage }) : null, agentDefinitionsMessage ? _jsx(Text, { dimColor: true, children: agentDefinitionsMessage }) : null] }));
}
export function MCPSettings(t0) {
    const { onComplete, } = t0;
    const rawMcp = useAppState(_temp);
    const rawAgentDefinitions = useAppState(_temp2);
    const mcpState = useMemo(() => toMcpDisplayState(rawMcp), [rawMcp]);
    const agentDefinitionsState = useMemo(() => toAgentDefinitionsDisplayState(rawAgentDefinitions), [rawAgentDefinitions]);
    if (mcpState.kind !== 'valid' || agentDefinitionsState.kind !== 'valid') {
        return (_jsx(MCPSettingsStateWarning, { mcpMessage: mcpState.kind === 'invalid' ? mcpState.message : undefined, agentDefinitionsMessage: agentDefinitionsState.kind === 'invalid' ? agentDefinitionsState.message : undefined }));
    }
    return (_jsx(MCPSettingsInner, { onComplete: onComplete, mcp: mcpState.value, agentDefinitions: agentDefinitionsState.value }));
}
function MCPSettingsInner(t0) {
    const $ = _c(66);
    const { onComplete, mcp, agentDefinitions } = t0;
    const mcpClients = mcp.clients;
    let t1;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
        t1 = {
            type: "list"
        };
        $[0] = t1;
    }
    else {
        t1 = $[0];
    }
    const [viewState, setViewState] = React.useState(t1);
    let t2;
    if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
        t2 = [];
        $[1] = t2;
    }
    else {
        t2 = $[1];
    }
    const [servers, setServers] = React.useState(t2);
    const [unsupportedClientTransportNotices, setUnsupportedClientTransportNotices] = React.useState([]);
    const [isServersPrepared, setIsServersPrepared] = React.useState(false);
    let t3;
    if ($[2] !== agentDefinitions.allAgents) {
        t3 = extractAgentMcpServers(agentDefinitions.allAgents);
        $[2] = agentDefinitions.allAgents;
        $[3] = t3;
    }
    else {
        t3 = $[3];
    }
    const agentMcpServers = t3;
    let t4;
    if ($[4] !== mcpClients) {
        t4 = mcpClients.filter(_temp3).sort(_temp4);
        $[4] = mcpClients;
        $[5] = t4;
    }
    else {
        t4 = $[5];
    }
    const filteredClients = t4;
    const unsupportedAgentTransportNotices = collectUnsupportedAgentTransportNotices(agentDefinitions.allAgents);
    let t5;
    let t6;
    if ($[6] !== filteredClients || $[7] !== mcp.tools) {
        t5 = () => {
            let cancelled = false;
            const prepareServers = async function prepareServers() {
                const unsupportedClientTransportNotices_0 = [];
                setIsServersPrepared(false);
                setServers([]);
                setUnsupportedClientTransportNotices([]);
                const serverInfos = await Promise.all(filteredClients.map(async (client_0) => {
                    const parsedConfig = McpServerConfigSchema().safeParse(client_0.config);
                    if (!parsedConfig.success) {
                        return null;
                    }
                    const config = parsedConfig.data;
                    const transport = config.type ?? "stdio";
                    const scope = client_0.config.scope;
                    const baseInfo = {
                        name: client_0.name,
                        client: client_0,
                        scope
                    };
                    switch (transport) {
                        case "stdio":
                            return {
                                ...baseInfo,
                                transport: "stdio",
                                config: config
                            };
                        case "sse":
                        case "http":
                        case "claudeai-proxy": {
                            let isAuthenticated = undefined;
                            if (transport === "sse" || transport === "http") {
                                const authProvider = new ClaudeAuthProvider(client_0.name, config);
                                const tokens = await authProvider.tokens();
                                const hasSessionAuth = getSessionIngressAuthToken() !== null && client_0.type === "connected";
                                const hasToolsAndConnected = client_0.type === "connected" && filterToolsByServer(mcp.tools, client_0.name).length > 0;
                                isAuthenticated = Boolean(tokens) || hasSessionAuth || hasToolsAndConnected;
                            }
                            return {
                                ...baseInfo,
                                transport,
                                isAuthenticated: transport === "claudeai-proxy" ? false : isAuthenticated,
                                config: config
                            };
                        }
                        case "sse-ide":
                        case "ws":
                        case "ws-ide":
                        case "sdk":
                            unsupportedClientTransportNotices_0.push({
                                source: "client",
                                name: client_0.name,
                                transport
                            });
                            return null;
                        default:
                            return null;
                    }
                }));
                if (cancelled) {
                    return;
                }
                setServers(serverInfos.filter((server_0) => server_0 !== null));
                setUnsupportedClientTransportNotices(unsupportedClientTransportNotices_0);
                setIsServersPrepared(true);
            };
            prepareServers();
            return () => {
                cancelled = true;
            };
        };
        t6 = [filteredClients, mcp.tools];
        $[6] = filteredClients;
        $[7] = mcp.tools;
        $[8] = t5;
        $[9] = t6;
    }
    else {
        t5 = $[8];
        t6 = $[9];
    }
    React.useEffect(t5, t6);
    let t7;
    let t8;
    if ($[10] !== agentMcpServers.length || $[11] !== filteredClients.length || $[12] !== onComplete || $[13] !== servers.length || $[14] !== isServersPrepared || $[15] !== unsupportedAgentTransportNotices.length || $[16] !== unsupportedClientTransportNotices.length) {
        t7 = () => {
            if (!isServersPrepared) {
                return;
            }
            if (servers.length === 0 && agentMcpServers.length === 0) {
                if (unsupportedClientTransportNotices.length > 0 || unsupportedAgentTransportNotices.length > 0) {
                    return;
                }
                onComplete("No MCP servers configured. Please run /doctor if this is unexpected. Otherwise, run `claude mcp --help` or visit https://code.claude.com/docs/en/mcp to learn more.");
            }
        };
        t8 = [servers.length, filteredClients.length, agentMcpServers.length, isServersPrepared, unsupportedAgentTransportNotices.length, unsupportedClientTransportNotices.length, onComplete];
        $[10] = agentMcpServers.length;
        $[11] = filteredClients.length;
        $[12] = onComplete;
        $[13] = servers.length;
        $[14] = isServersPrepared;
        $[15] = unsupportedAgentTransportNotices.length;
        $[16] = unsupportedClientTransportNotices.length;
        $[17] = t7;
        $[18] = t8;
    }
    else {
        t7 = $[17];
        t8 = $[18];
    }
    useEffect(t7, t8);
    const unsupportedTransportNoticesNode = renderUnsupportedTransportNotices(unsupportedClientTransportNotices, unsupportedAgentTransportNotices);
    const hasRenderableServers = servers.length > 0 || agentMcpServers.length > 0;
    if (!isServersPrepared && filteredClients.length > 0) {
        return (_jsx(Box, { children: _jsx(Text, { dimColor: true, children: "Loading MCP servers\u2026" }) }));
    }
    switch (viewState.type) {
        case "list":
            {
                let t10;
                let t9;
                if ($[19] === Symbol.for("react.memo_cache_sentinel")) {
                    t9 = server => setViewState({
                        type: "server-menu",
                        server
                    });
                    t10 = agentServer => setViewState({
                        type: "agent-server-menu",
                        agentServer
                    });
                    $[19] = t10;
                    $[20] = t9;
                }
                else {
                    t10 = $[19];
                    t9 = $[20];
                }
                const t11 = _jsxs(_Fragment, { children: [unsupportedTransportNoticesNode, hasRenderableServers ? _jsx(MCPListPanel, { servers: servers, agentServers: agentMcpServers, onSelectServer: t9, onSelectAgentServer: t10, onComplete: onComplete, defaultTab: viewState.defaultTab }) : _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "No supported MCP servers can be displayed in this UI." }) })] });
                return t11;
            }
        case "server-menu":
            {
                let t9;
                if ($[23] !== mcp.tools || $[24] !== viewState.server.name) {
                    t9 = filterToolsByServer(mcp.tools, viewState.server.name);
                    $[23] = mcp.tools;
                    $[24] = viewState.server.name;
                    $[25] = t9;
                }
                else {
                    t9 = $[25];
                }
                const serverTools_0 = t9;
                const defaultTab = viewState.server.transport === "claudeai-proxy" ? "claude.ai" : "Claude Code";
                if (viewState.server.transport === "stdio") {
                    let t10;
                    if ($[26] !== viewState.server) {
                        t10 = () => setViewState({
                            type: "server-tools",
                            server: viewState.server
                        });
                        $[26] = viewState.server;
                        $[27] = t10;
                    }
                    else {
                        t10 = $[27];
                    }
                    let t11;
                    if ($[28] !== defaultTab) {
                        t11 = () => setViewState({
                            type: "list",
                            defaultTab
                        });
                        $[28] = defaultTab;
                        $[29] = t11;
                    }
                    else {
                        t11 = $[29];
                    }
                    let t12;
                    if ($[30] !== onComplete || $[31] !== serverTools_0.length || $[32] !== t10 || $[33] !== t11 || $[34] !== viewState.server) {
                        t12 = _jsx(MCPStdioServerMenu, { server: viewState.server, serverToolsCount: serverTools_0.length, onViewTools: t10, onCancel: t11, onComplete: onComplete });
                        $[30] = onComplete;
                        $[31] = serverTools_0.length;
                        $[32] = t10;
                        $[33] = t11;
                        $[34] = viewState.server;
                        $[35] = t12;
                    }
                    else {
                        t12 = $[35];
                    }
                    return t12;
                }
                else {
                    let t10;
                    if ($[36] !== viewState.server) {
                        t10 = () => setViewState({
                            type: "server-tools",
                            server: viewState.server
                        });
                        $[36] = viewState.server;
                        $[37] = t10;
                    }
                    else {
                        t10 = $[37];
                    }
                    let t11;
                    if ($[38] !== defaultTab) {
                        t11 = () => setViewState({
                            type: "list",
                            defaultTab
                        });
                        $[38] = defaultTab;
                        $[39] = t11;
                    }
                    else {
                        t11 = $[39];
                    }
                    let t12;
                    if ($[40] !== onComplete || $[41] !== serverTools_0.length || $[42] !== t10 || $[43] !== t11 || $[44] !== viewState.server) {
                        t12 = _jsx(MCPRemoteServerMenu, { server: viewState.server, serverToolsCount: serverTools_0.length, onViewTools: t10, onCancel: t11, onComplete: onComplete });
                        $[40] = onComplete;
                        $[41] = serverTools_0.length;
                        $[42] = t10;
                        $[43] = t11;
                        $[44] = viewState.server;
                        $[45] = t12;
                    }
                    else {
                        t12 = $[45];
                    }
                    return t12;
                }
            }
        case "server-tools":
            {
                let t10;
                let t9;
                if ($[46] !== viewState.server) {
                    t9 = (_, index) => setViewState({
                        type: "server-tool-detail",
                        server: viewState.server,
                        toolIndex: index
                    });
                    t10 = () => setViewState({
                        type: "server-menu",
                        server: viewState.server
                    });
                    $[46] = viewState.server;
                    $[47] = t10;
                    $[48] = t9;
                }
                else {
                    t10 = $[47];
                    t9 = $[48];
                }
                let t11;
                if ($[49] !== t10 || $[50] !== t9 || $[51] !== viewState.server) {
                    t11 = _jsx(MCPToolListView, { server: viewState.server, onSelectTool: t9, onBack: t10 });
                    $[49] = t10;
                    $[50] = t9;
                    $[51] = viewState.server;
                    $[52] = t11;
                }
                else {
                    t11 = $[52];
                }
                return t11;
            }
        case "server-tool-detail":
            {
                let t9;
                if ($[53] !== mcp.tools || $[54] !== viewState.server.name) {
                    t9 = filterToolsByServer(mcp.tools, viewState.server.name);
                    $[53] = mcp.tools;
                    $[54] = viewState.server.name;
                    $[55] = t9;
                }
                else {
                    t9 = $[55];
                }
                const serverTools = t9;
                const tool = serverTools[viewState.toolIndex];
                if (!tool) {
                    setViewState({
                        type: "server-tools",
                        server: viewState.server
                    });
                    return null;
                }
                let t10;
                if ($[56] !== viewState.server) {
                    t10 = () => setViewState({
                        type: "server-tools",
                        server: viewState.server
                    });
                    $[56] = viewState.server;
                    $[57] = t10;
                }
                else {
                    t10 = $[57];
                }
                let t11;
                if ($[58] !== t10 || $[59] !== tool || $[60] !== viewState.server) {
                    t11 = _jsx(MCPToolDetailView, { tool: tool, server: viewState.server, onBack: t10 });
                    $[58] = t10;
                    $[59] = tool;
                    $[60] = viewState.server;
                    $[61] = t11;
                }
                else {
                    t11 = $[61];
                }
                return t11;
            }
        case "agent-server-menu":
            {
                let t9;
                if ($[62] === Symbol.for("react.memo_cache_sentinel")) {
                    t9 = () => setViewState({
                        type: "list",
                        defaultTab: "Agents"
                    });
                    $[62] = t9;
                }
                else {
                    t9 = $[62];
                }
                let t10;
                if ($[63] !== onComplete || $[64] !== viewState.agentServer) {
                    t10 = _jsx(MCPAgentServerMenu, { agentServer: viewState.agentServer, onCancel: t9, onComplete: onComplete });
                    $[63] = onComplete;
                    $[64] = viewState.agentServer;
                    $[65] = t10;
                }
                else {
                    t10 = $[65];
                }
                return t10;
            }
    }
}
function _temp4(a, b) {
    return a.name.localeCompare(b.name);
}
function _temp3(client) {
    return client.name !== "ide";
}
function _temp2(s_0) {
    return s_0.agentDefinitions;
}
function _temp(s) {
    return s.mcp;
}
//# sourceMappingURL=MCPSettings.js.map