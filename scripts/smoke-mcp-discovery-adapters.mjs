import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const adapters = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/discoveryAdapters.js')).href
)

const {
  getMcpPromptCommandName,
  getMcpToolPromptText,
  getMcpToolSearchHint,
  shouldSkipMcpToolPrefix,
  toMcpPromptCommands,
  toServerResources,
} = adapters

assert.equal(
  shouldSkipMcpToolPrefix({
    config: { type: 'sdk' },
    noPrefixEnvValue: 'true',
  }),
  true,
)
assert.equal(
  shouldSkipMcpToolPrefix({
    config: { type: 'stdio' },
    noPrefixEnvValue: 'true',
  }),
  false,
)
assert.equal(
  getMcpToolSearchHint({ 'anthropic/searchHint': '  hello\nworld  ' }),
  'hello world',
)
assert.equal(getMcpToolSearchHint({ 'anthropic/searchHint': '\n\t' }), undefined)
assert.equal(getMcpToolPromptText('short'), 'short')
assert.equal(
  getMcpToolPromptText('x'.repeat(2050)),
  `${'x'.repeat(2048)}… [truncated]`,
)

assert.deepEqual(
  toServerResources({
    serverName: 'docs',
    resources: [{ uri: 'doc://1', name: 'One' }],
  }),
  [{ uri: 'doc://1', name: 'One', server: 'docs' }],
)

assert.equal(getMcpPromptCommandName('docs-server', 'lookup'), 'mcp__docs-server__lookup')

const commands = toMcpPromptCommands({
  clientName: 'docs-server',
  prompts: [
    {
      name: 'lookup',
      description: 'Lookup docs',
      arguments: [{ name: 'topic' }, { name: 'version' }],
    },
  ],
  runPrompt: async (promptName, args) => [
    {
      type: 'text',
      text: `${promptName}:${args.topic}:${args.version}`,
    },
  ],
  onPromptError: () => {},
})

assert.equal(commands.length, 1)
assert.equal(commands[0].name, 'mcp__docs-server__lookup')
assert.deepEqual(commands[0].argNames, ['topic', 'version'])
assert.equal(commands[0].userFacingName(), 'docs-server:lookup (MCP)')
assert.deepEqual(await commands[0].getPromptForCommand('react 19'), [
  { type: 'text', text: 'lookup:react:19' },
])

console.log('smoke-mcp-discovery-adapters: ok')
