import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocketTransport } from '../../utils/mcpWebSocketTransport.js';
import { subprocessEnv } from '../../utils/subprocessEnv.js';
import { SdkControlClientTransport, } from './SdkControlTransport.js';
export function resolveStdioTransportLaunch(serverRef, options = {}) {
    const shellPrefix = options.shellPrefix ?? process.env.CLAUDE_CODE_SHELL_PREFIX;
    const serverArgs = serverRef.args ?? [];
    const finalCommand = shellPrefix || serverRef.command;
    const finalArgs = shellPrefix
        ? [[serverRef.command, ...serverArgs].join(' ')]
        : serverArgs;
    return {
        command: finalCommand,
        args: finalArgs,
        env: {
            ...(options.baseEnv ?? subprocessEnv()),
            ...serverRef.env,
        },
        stderr: 'pipe',
    };
}
export function createStdioClientTransport(serverRef) {
    return new StdioClientTransport(resolveStdioTransportLaunch(serverRef));
}
/**
 * Create a ws.WebSocket client with the MCP protocol.
 * Bun's ws shim types lack the 3-arg constructor (url, protocols, options)
 * that the real ws package supports, so we cast the constructor here.
 */
export async function createNodeWsClient(url, options) {
    const wsModule = await import('ws');
    const WS = wsModule.default;
    return new WS(url, ['mcp'], options);
}
export async function createNodeWebSocketTransport(url, options) {
    return new WebSocketTransport(await createNodeWsClient(url, options));
}
export function createSdkControlClientTransport(serverName, sendMcpMessage) {
    return new SdkControlClientTransport(serverName, sendMcpMessage);
}
//# sourceMappingURL=transportFactory.js.map