import {
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  type ReadResourceResult,
  type Resource,
} from '@modelcontextprotocol/sdk/types.js'
import type { Command } from '../commands.js'
import type { ConnectedMCPServer } from '../services/mcp/types.js'
import { errorMessage } from '../utils/errors.js'
import { parseFrontmatter } from '../utils/frontmatterParser.js'
import { logMCPError } from '../utils/log.js'
import { getMCPSkillBuilders } from './mcpSkillBuilders.js'

export type McpClientLike = Pick<
  ConnectedMCPServer,
  'client' | 'name' | 'type' | 'capabilities' | 'serverInfo' | 'config'
>

export type McpSkillDiscoveryDiagnostic = {
  serverName: string
  code:
    | 'mcp-skill-index-invalid'
    | 'mcp-skill-resource-read-failed'
  message: string
  uri?: string
}

type McpSkillIndexEntry = {
  name: string
  uri: string
  description?: string
  version?: string
}

class McpSkillCache {
  private readonly entries = new Map<string, Promise<Command[]>>()

  get(key: string): Promise<Command[]> | undefined {
    return this.entries.get(key)
  }

  set(key: string, value: Promise<Command[]>): void {
    this.entries.set(key, value)
  }

  delete(serverName: string): boolean {
    let deleted = false
    const prefix = `${serverName}\0`
    for (const key of this.entries.keys()) {
      if (key === serverName || key.startsWith(prefix)) {
        deleted = this.entries.delete(key) || deleted
      }
    }
    diagnosticsByServer.delete(serverName)
    return deleted
  }

  clear(): void {
    this.entries.clear()
    diagnosticsByServer.clear()
  }
}

const cache = new McpSkillCache()
const diagnosticsByServer = new Map<string, McpSkillDiscoveryDiagnostic[]>()

export class McpSkillsUnavailableError extends Error {
  constructor(message = 'MCP server does not expose the Resources capability.') {
    super(message)
    this.name = 'McpSkillsUnavailableError'
  }
}

export const fetchMcpSkillsForClient = Object.assign(
  async (client: McpClientLike): Promise<Command[]> => {
    if (client.type !== 'connected' || !client.capabilities?.resources) {
      return []
    }

    const cacheKey = getServerIdentityKey(client)
    const cached = cache.get(cacheKey)
    if (cached) return cached

    const pending = discoverMcpSkills(client).catch(error => {
      cache.delete(client.name)
      throw error
    })
    cache.set(cacheKey, pending)
    return pending
  },
  { cache },
)

export const fetchMcpSkillsForClientSafely = Object.assign(
  async (client: McpClientLike): Promise<Command[]> => {
    try {
      return await fetchMcpSkillsForClient(client)
    } catch (error) {
      logMCPError(
        client.name,
        `MCP Skill discovery unavailable: ${errorMessage(error)}`,
      )
      return []
    }
  },
  { cache },
)

export function getMcpSkillDiscoveryDiagnostics(
  serverName?: string,
): McpSkillDiscoveryDiagnostic[] {
  if (serverName) {
    return [...(diagnosticsByServer.get(serverName) ?? [])]
  }
  return [...diagnosticsByServer.values()].flat()
}

async function discoverMcpSkills(client: McpClientLike): Promise<Command[]> {
  diagnosticsByServer.set(client.name, [])
  const resources = await listAllResources(client)
  const indexResource = resources.find(
    resource => resource.uri === 'skill://index.json',
  )
  const entries = indexResource
    ? await readSkillIndex(client, indexResource.uri)
    : resources
        .filter(resource => isSkillMarkdownUri(resource.uri))
        .map(resource => ({
          name: skillNameFromUri(resource.uri),
          uri: resource.uri,
          ...(resource.description ? { description: resource.description } : {}),
        }))

  const commands = await Promise.all(
    entries.map(entry => readMcpSkillCommand(client, entry)),
  )
  return commands.filter((command): command is Command => command !== null)
}

async function listAllResources(client: McpClientLike): Promise<Resource[]> {
  const resources: Resource[] = []
  let cursor: string | undefined
  do {
    const result = await client.client.request(
      {
        method: 'resources/list',
        ...(cursor ? { params: { cursor } } : {}),
      },
      ListResourcesResultSchema,
    )
    resources.push(...(result.resources ?? []))
    cursor = result.nextCursor
  } while (cursor)
  return resources
}

async function readSkillIndex(
  client: McpClientLike,
  uri: string,
): Promise<McpSkillIndexEntry[]> {
  try {
    const text = await readTextResource(client, uri)
    const parsed = JSON.parse(text) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as { skills?: unknown }).skills)
    ) {
      throw new Error('index must contain a skills array')
    }
    return (parsed as { skills: unknown[] }).skills
      .map(parseSkillIndexEntry)
      .filter((entry): entry is McpSkillIndexEntry => entry !== null)
  } catch (error) {
    recordDiagnostic(client.name, {
      serverName: client.name,
      code: 'mcp-skill-index-invalid',
      message: `Failed to read ${uri}: ${errorMessage(error)}`,
      uri,
    })
    throw new McpSkillsUnavailableError(
      `MCP Skill index from ${client.name} is invalid: ${errorMessage(error)}`,
    )
  }
}

function parseSkillIndexEntry(value: unknown): McpSkillIndexEntry | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.name !== 'string' || typeof record.uri !== 'string') {
    return null
  }
  if (!isSkillMarkdownUri(record.uri)) return null
  return {
    name: record.name,
    uri: record.uri,
    ...(typeof record.description === 'string'
      ? { description: record.description }
      : {}),
    ...(typeof record.version === 'string' ? { version: record.version } : {}),
  }
}

async function readMcpSkillCommand(
  client: McpClientLike,
  entry: McpSkillIndexEntry,
): Promise<Command | null> {
  try {
    const markdown = await readTextResource(client, entry.uri)
    const { frontmatter, content } = parseFrontmatter(markdown, entry.uri)
    const builders = getMCPSkillBuilders()
    const parsed = builders.parseSkillFrontmatterFields(
      frontmatter,
      content,
      entry.name,
    )
    const command = builders.createSkillCommand({
      skillName: entry.name,
      displayName: parsed.displayName,
      description: entry.description ?? parsed.description,
      hasUserSpecifiedDescription:
        entry.description !== undefined || parsed.hasUserSpecifiedDescription,
      markdownContent: content,
      allowedTools: parsed.allowedTools,
      argumentHint: parsed.argumentHint,
      argumentNames: parsed.argumentNames,
      whenToUse: parsed.whenToUse,
      version: entry.version ?? parsed.version,
      model: parsed.model,
      disableModelInvocation: parsed.disableModelInvocation,
      userInvocable: parsed.userInvocable,
      source: 'mcp',
      baseDir: undefined,
      loadedFrom: 'mcp',
      // Remote resources cannot register local hooks or shell behavior.
      hooks: undefined,
      executionContext: parsed.executionContext,
      agent: parsed.agent,
      paths: undefined,
      effort: parsed.effort,
      shell: undefined,
    })
    command.isMcp = true
    command.mcpServerName = client.name
    command.pluginId = client.config.pluginSource
    command.mcpSkillUri = entry.uri
    command.mcpSkillVersion = entry.version ?? parsed.version
    return command
  } catch (error) {
    recordDiagnostic(client.name, {
      serverName: client.name,
      code: 'mcp-skill-resource-read-failed',
      message: `Failed to load MCP Skill ${entry.name}: ${errorMessage(error)}`,
      uri: entry.uri,
    })
    logMCPError(
      client.name,
      `Failed to load MCP Skill ${entry.name}: ${errorMessage(error)}`,
    )
    return null
  }
}

async function readTextResource(
  client: McpClientLike,
  uri: string,
): Promise<string> {
  const result = (await client.client.request(
    { method: 'resources/read', params: { uri } },
    ReadResourceResultSchema,
  )) as ReadResourceResult
  const text = result.contents
    .map(content => ('text' in content ? content.text : ''))
    .filter(Boolean)
    .join('\n')
  if (!text) {
    throw new Error('resource did not return text content')
  }
  return text
}

function isSkillMarkdownUri(uri: string): boolean {
  return uri.startsWith('skill://') && /\/SKILL\.md$/i.test(uri)
}

function skillNameFromUri(uri: string): string {
  const path = uri.replace(/^skill:\/\//, '').replace(/\/SKILL\.md$/i, '')
  const parts = path.split('/').filter(Boolean)
  return decodeURIComponent(parts.at(-1) ?? 'mcp-skill')
}

function getServerIdentityKey(client: McpClientLike): string {
  const serverIdentity = client.serverInfo
    ? `${client.serverInfo.name}@${client.serverInfo.version}`
    : 'unknown-version'
  return `${client.name}\0${serverIdentity}`
}

function recordDiagnostic(
  serverName: string,
  diagnostic: McpSkillDiscoveryDiagnostic,
): void {
  const diagnostics = diagnosticsByServer.get(serverName) ?? []
  diagnostics.push(diagnostic)
  diagnosticsByServer.set(serverName, diagnostics)
}
