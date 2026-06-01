import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const discoveryService = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/discoveryService.js')).href
)

const {
  appendResourceToolsIfNeeded,
  fetchCommandsForClient,
  fetchResourcesForClient,
  getDefaultMcpResourceTools,
  listMcpToolDefinitionsForClient,
} = discoveryService

const requests = []
const connectedClient = {
  type: 'connected',
  name: 'docs',
  config: { type: 'http', url: 'https://example.invalid/mcp' },
  capabilities: {
    tools: {},
    prompts: {},
    resources: {},
  },
  client: {
    request: async request => {
      requests.push(request.method)
      if (request.method === 'tools/list') {
        return {
          tools: [
            {
              name: 'search',
              description: 'Search docs',
              inputSchema: { type: 'object' },
              _meta: { 'anthropic/searchHint': ' docs\nsearch ' },
            },
          ],
        }
      }
      if (request.method === 'resources/list') {
        return {
          resources: [{ uri: 'doc://one', name: 'One' }],
        }
      }
      if (request.method === 'prompts/list') {
        return {
          prompts: [
            {
              name: 'lookup',
              description: 'Lookup docs',
              arguments: [{ name: 'topic' }],
            },
          ],
        }
      }
      throw new Error(`unexpected request ${request.method}`)
    },
    getPrompt: async input => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${input.name}:${input.arguments.topic}`,
          },
        },
      ],
    }),
  },
}

const tools = await listMcpToolDefinitionsForClient(connectedClient)
assert.equal(tools.length, 1)
assert.equal(tools[0].name, 'search')
assert.equal(tools[0]._meta['anthropic/searchHint'], ' docs\nsearch ')

const resources = await fetchResourcesForClient(connectedClient)
assert.deepEqual(resources, [{ uri: 'doc://one', name: 'One', server: 'docs' }])

const commands = await fetchCommandsForClient({
  client: connectedClient,
  ensureConnectedClient: async client => client,
  transformResultContent: async content => [{ type: 'text', text: content.text }],
})
assert.equal(commands.length, 1)
assert.equal(commands[0].name, 'mcp__docs__lookup')
assert.deepEqual(await commands[0].getPromptForCommand('react'), [
  { type: 'text', text: 'lookup:react' },
])

const resourceTools = getDefaultMcpResourceTools()
assert.deepEqual(
  resourceTools.map(tool => tool.name),
  ['ListMcpResourcesTool', 'ReadMcpResourceTool'],
)
assert.equal(appendResourceToolsIfNeeded({ supportsResources: false, tools: [] }).length, 0)
assert.equal(appendResourceToolsIfNeeded({ supportsResources: true, tools: [] }).length, 2)
assert.deepEqual(requests, ['tools/list', 'resources/list', 'prompts/list'])

console.log('smoke-mcp-discovery-service: ok')
