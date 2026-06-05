import assert from 'node:assert/strict'
import { getAllBaseTools } from '../dist/src/tools.js'
import { listToolCapabilities } from '../dist/src/services/capabilities/toolCapabilityProvider.js'

const readTool = getAllBaseTools().find(tool => tool.name === 'Read')
assert.ok(readTool)

const capabilities = listToolCapabilities({
  runtime: 'app-server',
  platform: 'win32',
  tools: [
    readTool,
    {
      ...readTool,
      name: 'mcp__demo__search',
      aliases: [],
      isMcp: true,
      mcpInfo: { serverName: 'demo', toolName: 'search' },
    },
  ],
  mcpServerStatuses: {
    demo: 'needs-auth',
  },
})

const read = capabilities.find(capability => capability.name === 'Read')
assert.equal(read.kind, 'tool')
assert.equal(read.source.kind, 'builtin')
assert.equal(read.state.status, 'available')

const mcpTool = capabilities.find(capability => capability.name === 'mcp__demo__search')
assert.equal(mcpTool.kind, 'mcp-tool')
assert.equal(mcpTool.source.kind, 'mcp')
assert.equal(mcpTool.relations.parentMcpServerName, 'demo')
assert.equal(mcpTool.state.status, 'needs-auth')
assert.equal(mcpTool.state.runtimeVisible, false)

console.log('smoke-capability-catalog-mcp-tool-provider: ok')
