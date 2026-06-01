import { createCcrMcpInstallManifest } from '../installManifest.js';
import { createSentryRemoteMcpServerConfig, SENTRY_MCP_REMOTE_URL, SENTRY_MCP_SERVER_NAME, } from '../providers/sentry/install.js';
export const SENTRY_INSTALL_PRESET = {
    id: SENTRY_MCP_SERVER_NAME,
    displayName: 'Sentry MCP',
    description: '远程查询 Sentry issue、事件和调试上下文。',
    trusted: true,
    manifest: createCcrMcpInstallManifest({
        name: SENTRY_MCP_SERVER_NAME,
        displayName: 'Sentry MCP',
        description: 'Sentry hosted remote MCP，适合查询 Sentry issue、事件、stacktrace 和调试上下文。首次连接由远端服务触发 OAuth 认证。',
        source: {
            kind: 'remote-url',
            url: SENTRY_MCP_REMOTE_URL,
            headersRequired: false,
        },
        transport: 'http',
        serverConfig: createSentryRemoteMcpServerConfig(),
        permissions: [
            {
                kind: 'network',
                required: true,
                description: 'Connects to the hosted Sentry MCP service.',
            },
            {
                kind: 'oauth',
                required: true,
                description: 'Requires user OAuth authorization before Sentry data can be accessed.',
            },
        ],
        dataBoundary: 'remote-service',
        homepage: 'https://mcp.sentry.dev',
    }),
    createServerConfig: () => createSentryRemoteMcpServerConfig(),
};
//# sourceMappingURL=sentry.js.map