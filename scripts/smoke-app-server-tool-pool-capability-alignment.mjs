import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const { enableConfigs } = await importDist('src/utils/config.js')
enableConfigs()

const { getEmptyToolPermissionContext } = await importDist('src/Tool.js')
const { getAllBaseTools } = await importDist('src/tools.js')
const { buildAppServerToolPool } = await importDist(
  'src/services/tools/appServerToolPool.js',
)
const { listCoreCapabilities } = await importDist('src/core/capabilityCore.js')

const readTool = getAllBaseTools().find(tool => tool.name === 'Read')
assert.ok(readTool)

const demoMcpTool = {
  ...readTool,
  name: 'mcp__demo__search',
  aliases: [],
  isMcp: true,
  mcpInfo: { serverName: 'demo', toolName: 'search' },
}
const blockedMcpTool = {
  ...readTool,
  name: 'mcp__blocked__lookup',
  aliases: [],
  isMcp: true,
  mcpInfo: { serverName: 'blocked', toolName: 'lookup' },
}

const mcpRuntime = {
  clients: [
    {
      name: 'demo',
      type: 'connected',
      config: {
        type: 'stdio',
        command: 'node',
        args: ['demo.js'],
        scope: 'user',
      },
    },
    {
      name: 'blocked',
      type: 'needs-auth',
      config: {
        type: 'stdio',
        command: 'node',
        args: ['blocked.js'],
        scope: 'user',
      },
    },
  ],
  tools: [demoMcpTool, blockedMcpTool],
  commands: [],
  resources: {},
}
const toolPermissionContext = getEmptyToolPermissionContext()
const mcpServerStatuses = {
  demo: 'connected',
  blocked: 'needs-auth',
}
const expectedToolPool = buildAppServerToolPool({
  permissionContext: toolPermissionContext,
  mcpTools: mcpRuntime.tools,
  activeAgentCount: 0,
  connectedMcpServerNames: ['demo'],
  mcpServerStatuses,
})

const catalog = await listCoreCapabilities({
  mcpRuntime,
  toolPermissionContext,
  activeAgentCount: 0,
})
const toolCapabilities = catalog.capabilities.filter(
  capability => capability.kind === 'tool' || capability.kind === 'mcp-tool',
)

assert.deepEqual(
  toolCapabilities.map(capability => capability.name).sort(),
  expectedToolPool.map(tool => tool.name).sort(),
)
assert.equal(
  toolCapabilities.some(capability => capability.name === 'mcp__demo__search'),
  true,
)
assert.equal(
  toolCapabilities.some(capability => capability.name === 'mcp__blocked__lookup'),
  false,
)
if (process.platform === 'win32') {
  assert.equal(
    toolCapabilities.some(capability => capability.name === 'Bash'),
    false,
  )
  assert.equal(
    toolCapabilities.some(capability => capability.name === 'PowerShell'),
    true,
  )
}

console.log('smoke-app-server-tool-pool-capability-alignment: ok')
