export const SENTRY_MCP_SERVER_NAME = 'sentry';
export const SENTRY_MCP_REMOTE_URL = 'https://mcp.sentry.dev/mcp';
export function createSentryRemoteMcpServerConfig() {
    return {
        type: 'http',
        url: SENTRY_MCP_REMOTE_URL,
    };
}
//# sourceMappingURL=install.js.map