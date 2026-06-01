import { getPlatform } from '../../../../utils/platform.js'
import type { McpStdioServerConfig } from '../../types.js'

export const CONTEXT7_MCP_SERVER_NAME = 'context7'
export const CONTEXT7_MCP_PACKAGE_NAME = '@upstash/context7-mcp'

function normalizeContext7Version(version: string | undefined): string {
  const normalized = version?.trim()
  return normalized || 'latest'
}

export function getContext7PackageRef(version: string | undefined): string {
  return `${CONTEXT7_MCP_PACKAGE_NAME}@${normalizeContext7Version(version)}`
}

export function createContext7NpxMcpServerConfig(options: {
  version?: string
} = {}): McpStdioServerConfig {
  const args = ['-y', getContext7PackageRef(options.version)]

  if (getPlatform() === 'windows') {
    return {
      type: 'stdio',
      command: 'npx.cmd',
      args,
    }
  }

  return {
    type: 'stdio',
    command: 'npx',
    args,
  }
}
