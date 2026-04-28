import type { MCPServerConnection } from '../services/mcp/types.js'
import type { PermissionMode } from '../types/permissions.js'

export function usePromptsFromClaudeInChrome(
  _mcpClients: MCPServerConnection[],
  _toolPermissionMode: PermissionMode,
): void {
  // CCR 已退休旧 Chrome 扩展 prompt 回流；后续浏览器 prompt 统一由 MCP server 自己暴露。
}
