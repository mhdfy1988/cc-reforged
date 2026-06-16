import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join, normalize } from 'node:path'
import {
  resolvePluginMcpEnvironment,
} from '../dist/src/utils/plugins/mcpPluginIntegration.js'

const pluginRoot = join(tmpdir(), 'ccr-plugin-mcp-relative-path')
const plugin = {
  path: pluginRoot,
  source: 'web-reader-toolkit@local-import',
}

const resolved = resolvePluginMcpEnvironment(
  {
    type: 'stdio',
    command: 'node',
    args: [
      './mcp/web-reader-mcp-server.mjs',
      '--config',
      '../shared/config.json',
      'literal',
    ],
  },
  plugin,
)

assert.equal(resolved.command, 'node')
assert.deepEqual(resolved.args, [
  join(pluginRoot, './mcp/web-reader-mcp-server.mjs'),
  '--config',
  join(pluginRoot, '../shared/config.json'),
  'literal',
])
assert.equal(resolved.env.CLAUDE_PLUGIN_ROOT, pluginRoot)

const commandPath = resolvePluginMcpEnvironment(
  {
    type: 'stdio',
    command: './bin/server.cmd',
    args: ['${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs'],
  },
  plugin,
)

assert.equal(commandPath.command, join(pluginRoot, './bin/server.cmd'))
assert.equal(normalize(commandPath.args?.[0]), join(pluginRoot, 'mcp/server.mjs'))

console.log('plugin MCP relative path smoke passed')
