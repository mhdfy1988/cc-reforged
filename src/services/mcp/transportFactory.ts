import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { WebSocketTransport } from '../../utils/mcpWebSocketTransport.js'
import { subprocessEnv } from '../../utils/subprocessEnv.js'
import {
  SdkControlClientTransport,
  type SendMcpMessageCallback,
} from './SdkControlTransport.js'
import type { McpStdioServerConfig } from './types.js'

export type WsClientLike = {
  readonly readyState: number
  close(): void
  send(data: string): void
}

export type StdioTransportLaunchConfig = {
  command: string
  args: string[]
  env: Record<string, string>
  stderr: 'pipe'
}

export type ResolveStdioTransportLaunchOptions = {
  shellPrefix?: string
  baseEnv?: Record<string, string | undefined>
}

export function resolveStdioTransportLaunch(
  serverRef: McpStdioServerConfig,
  options: ResolveStdioTransportLaunchOptions = {},
): StdioTransportLaunchConfig {
  const shellPrefix = options.shellPrefix ?? process.env.CLAUDE_CODE_SHELL_PREFIX
  const serverArgs = serverRef.args ?? []
  const finalCommand = shellPrefix || serverRef.command
  const finalArgs = shellPrefix
    ? [[serverRef.command, ...serverArgs].join(' ')]
    : serverArgs
  return {
    command: finalCommand,
    args: finalArgs,
    env: {
      ...(options.baseEnv ?? subprocessEnv()),
      ...serverRef.env,
    } as Record<string, string>,
    stderr: 'pipe',
  }
}

export function createStdioClientTransport(
  serverRef: McpStdioServerConfig,
): StdioClientTransport {
  return new StdioClientTransport(resolveStdioTransportLaunch(serverRef))
}

/**
 * Create a ws.WebSocket client with the MCP protocol.
 * Bun's ws shim types lack the 3-arg constructor (url, protocols, options)
 * that the real ws package supports, so we cast the constructor here.
 */
export async function createNodeWsClient(
  url: string,
  options: Record<string, unknown>,
): Promise<WsClientLike> {
  const wsModule = await import('ws')
  const WS = wsModule.default as unknown as new (
    url: string,
    protocols: string[],
    options: Record<string, unknown>,
  ) => WsClientLike
  return new WS(url, ['mcp'], options)
}

export async function createNodeWebSocketTransport(
  url: string,
  options: Record<string, unknown>,
): Promise<WebSocketTransport> {
  return new WebSocketTransport(await createNodeWsClient(url, options))
}

export function createSdkControlClientTransport(
  serverName: string,
  sendMcpMessage: SendMcpMessageCallback,
): SdkControlClientTransport {
  return new SdkControlClientTransport(serverName, sendMcpMessage)
}

export type { JSONRPCMessage }
