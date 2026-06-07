import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Prompt } from '@modelcontextprotocol/sdk/types.js'
import zipObject from 'lodash-es/zipObject.js'
import type { Command } from '../../commands.js'
import type { ScopedMcpServerConfig, ServerResource } from './types.js'
import { normalizeNameForMCP } from './normalization.js'

export const MAX_MCP_DESCRIPTION_LENGTH = 2048

export function shouldSkipMcpToolPrefix(params: {
  config: ScopedMcpServerConfig
  noPrefixEnvValue: string | undefined
}): boolean {
  return params.config.type === 'sdk' && isTruthyEnvValue(params.noPrefixEnvValue)
}

export function getMcpToolSearchHint(meta: Record<string, unknown> | undefined): string | undefined {
  return typeof meta?.['anthropic/searchHint'] === 'string'
    ? meta['anthropic/searchHint'].replace(/\s+/g, ' ').trim() || undefined
    : undefined
}

export function getMcpToolPromptText(description: string | undefined): string {
  const desc = description ?? ''
  return desc.length > MAX_MCP_DESCRIPTION_LENGTH
    ? `${desc.slice(0, MAX_MCP_DESCRIPTION_LENGTH)}… [truncated]`
    : desc
}

export function toServerResources(params: {
  resources: Array<Record<string, unknown>>
  serverName: string
}): ServerResource[] {
  return params.resources.map(resource => ({
    ...resource,
    server: params.serverName,
  })) as ServerResource[]
}

export function toMcpPromptCommands(params: {
  clientName: string
  pluginId?: string
  prompts: Prompt[]
  runPrompt: (
    promptName: string,
    args: Record<string, string>,
  ) => Promise<Array<ContentBlockParam>>
  onPromptError: (promptName: string, error: unknown) => void
}): Command[] {
  return params.prompts.map(prompt => {
    const argNames = Object.values(prompt.arguments ?? {}).map(k => k.name)
    return {
      type: 'prompt' as const,
      name: getMcpPromptCommandName(params.clientName, prompt.name),
      description: prompt.description ?? '',
      hasUserSpecifiedDescription: !!prompt.description,
      contentLength: 0,
      isEnabled: () => true,
      isHidden: false,
      isMcp: true,
      progressMessage: 'running',
      userFacingName() {
        return `${params.clientName}:${prompt.name} (MCP)`
      },
      argNames,
      source: 'mcp',
      ...(params.pluginId ? { pluginId: params.pluginId } : {}),
      mcpServerName: params.clientName,
      async getPromptForCommand(args: string) {
        try {
          return await params.runPrompt(
            prompt.name,
            zipObject(argNames, args.split(' ')),
          )
        } catch (error) {
          params.onPromptError(prompt.name, error)
          throw error
        }
      },
    }
  })
}

export function getMcpPromptCommandName(
  clientName: string,
  promptName: string,
): string {
  return `mcp__${normalizeNameForMCP(clientName)}__${promptName}`
}

function isTruthyEnvValue(value: string | undefined): boolean {
  return value === '1' || value === 'true'
}
