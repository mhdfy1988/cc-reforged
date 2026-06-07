import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import {
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListToolsResultSchema,
  type ListPromptsResult,
  type ListToolsResult,
  type PromptMessage,
} from '@modelcontextprotocol/sdk/types.js'
import type { Command } from '../../commands.js'
import { toolMatchesName, type Tool } from '../../Tool.js'
import { errorMessage } from '../../utils/errors.js'
import { logMCPError } from '../../utils/log.js'
import { recursivelySanitizeUnicode } from '../../utils/sanitization.js'
import {
  ListMcpResourcesTool,
} from '../../tools/ListMcpResourcesTool/ListMcpResourcesTool.js'
import {
  ReadMcpResourceTool,
} from '../../tools/ReadMcpResourceTool/ReadMcpResourceTool.js'
import {
  toMcpPromptCommands,
  toServerResources,
} from './discoveryAdapters.js'
import type {
  ConnectedMCPServer,
  MCPServerConnection,
  ServerResource,
} from './types.js'

export async function listMcpToolDefinitionsForClient(
  client: MCPServerConnection,
): Promise<ListToolsResult['tools']> {
  if (client.type !== 'connected') return []

  try {
    if (!client.capabilities?.tools) {
      return []
    }

    const result = (await client.client.request(
      { method: 'tools/list' },
      ListToolsResultSchema,
    )) as ListToolsResult

    return recursivelySanitizeUnicode(result.tools)
  } catch (error) {
    logMCPError(client.name, `Failed to fetch tools: ${errorMessage(error)}`)
    return []
  }
}

export async function fetchResourcesForClient(
  client: MCPServerConnection,
): Promise<ServerResource[]> {
  if (client.type !== 'connected') return []

  try {
    if (!client.capabilities?.resources) {
      return []
    }

    const result = await client.client.request(
      { method: 'resources/list' },
      ListResourcesResultSchema,
    )

    if (!result.resources) return []

    return toServerResources({
      resources: result.resources,
      serverName: client.name,
    })
  } catch (error) {
    logMCPError(
      client.name,
      `Failed to fetch resources: ${errorMessage(error)}`,
    )
    return []
  }
}

export async function fetchCommandsForClient(params: {
  client: MCPServerConnection
  ensureConnectedClient: (
    client: MCPServerConnection,
  ) => Promise<ConnectedMCPServer>
  transformResultContent: (
    resultContent: PromptMessage['content'],
    serverName: string,
  ) => Promise<Array<ContentBlockParam>>
}): Promise<Command[]> {
  const { client } = params
  if (client.type !== 'connected') return []

  try {
    if (!client.capabilities?.prompts) {
      return []
    }

    const result = (await client.client.request(
      { method: 'prompts/list' },
      ListPromptsResultSchema,
    )) as ListPromptsResult

    if (!result.prompts) return []

    const promptsToProcess = recursivelySanitizeUnicode(result.prompts)

    return toMcpPromptCommands({
      clientName: client.name,
      pluginId: client.config.pluginSource,
      prompts: promptsToProcess,
      runPrompt: async (promptName, args) => {
        const connectedClient = await params.ensureConnectedClient(client)
        const result = await connectedClient.client.getPrompt({
          name: promptName,
          arguments: args,
        })
        const transformed = await Promise.all(
          result.messages.map(message =>
            params.transformResultContent(
              message.content,
              connectedClient.name,
            ),
          ),
        )
        return transformed.flat()
      },
      onPromptError: (promptName, error) => {
        logMCPError(
          client.name,
          `Error running command '${promptName}': ${errorMessage(error)}`,
        )
      },
    })
  } catch (error) {
    logMCPError(
      client.name,
      `Failed to fetch commands: ${errorMessage(error)}`,
    )
    return []
  }
}

export function appendResourceToolsIfNeeded(params: {
  supportsResources: boolean
  tools: Tool[]
}): Tool[] {
  if (!params.supportsResources) {
    return params.tools
  }
  const hasResourceTools = [ListMcpResourcesTool, ReadMcpResourceTool].some(
    tool => params.tools.some(t => toolMatchesName(t, tool.name)),
  )
  if (hasResourceTools) {
    return params.tools
  }
  return [...params.tools, ListMcpResourcesTool, ReadMcpResourceTool]
}

export function getDefaultMcpResourceTools(): Tool[] {
  return [ListMcpResourcesTool, ReadMcpResourceTool]
}
