import type {
  ConfigScope,
  MCPServerConnection,
  McpClaudeAIProxyServerConfig,
  McpHTTPServerConfig,
  McpSSEServerConfig,
  McpStdioServerConfig,
  ScopedMcpServerConfig,
} from '../../services/mcp/types.js'

type BaseServerInfo = {
  name: string
  client: MCPServerConnection
  scope: ConfigScope
}

export type StdioServerInfo = BaseServerInfo & {
  transport: 'stdio'
  config: McpStdioServerConfig
}

export type SSEServerInfo = BaseServerInfo & {
  transport: 'sse'
  isAuthenticated?: boolean
  config: McpSSEServerConfig
}

export type HTTPServerInfo = BaseServerInfo & {
  transport: 'http'
  isAuthenticated?: boolean
  config: McpHTTPServerConfig
}

export type ClaudeAIServerInfo = BaseServerInfo & {
  transport: 'claudeai-proxy'
  isAuthenticated?: boolean
  config: McpClaudeAIProxyServerConfig
}

export type ServerInfo =
  | StdioServerInfo
  | SSEServerInfo
  | HTTPServerInfo
  | ClaudeAIServerInfo

export type AgentMcpServerInfo = {
  name: string
  transport: 'http' | 'sse' | 'stdio' | 'ws'
  url?: string
  command?: string
  sourceAgents: string[]
  needsAuth?: boolean
  isAuthenticated?: boolean
  config?: ScopedMcpServerConfig
}

export type MCPViewState =
  | {
      type: 'list'
      defaultTab?: string
    }
  | {
      type: 'server-menu'
      server: ServerInfo
    }
  | {
      type: 'server-tools'
      server: ServerInfo
    }
  | {
      type: 'agent-server-menu'
      agentServer: AgentMcpServerInfo
    }
