import type { Command } from '../../types/command.js'
import type { Tool } from '../../Tool.js'
import { errorMessage } from '../../utils/errors.js'
import { logMCPError } from '../../utils/log.js'
import { getMcpToolsCommandsAndResources } from './client.js'
import type { MCPServerConnection, ServerResource } from './types.js'

export type CcrMcpRuntimeSnapshot = {
  clients: MCPServerConnection[]
  tools: Tool[]
  commands: Command[]
  resources: Record<string, ServerResource[]>
}

export async function loadCcrMcpRuntimeSnapshot(
  logSource = 'mcp-runtime-snapshot',
): Promise<CcrMcpRuntimeSnapshot> {
  const clients: MCPServerConnection[] = []
  const tools: Tool[] = []
  const commands: Command[] = []
  const resources: Record<string, ServerResource[]> = {}

  try {
    await getMcpToolsCommandsAndResources(result => {
      clients.push(result.client)
      tools.push(...result.tools)
      commands.push(...result.commands)
      if (result.resources?.length) {
        resources[result.client.name] = result.resources
      }
    })
  } catch (error) {
    logMCPError(
      logSource,
      `Failed to load MCP runtime tools: ${errorMessage(error)}`,
    )
  }

  return {
    clients,
    tools,
    commands,
    resources,
  }
}
