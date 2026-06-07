import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = await mkdtemp(join(tmpdir(), 'ccr-capability-mcp-runtime-'))
const configHome = join(root, 'ccr-home')
process.env.CCR_CONFIG_DIR = configHome
process.env.CLAUDE_CONFIG_DIR = configHome

try {
  const { enableConfigs } = await import('../dist/src/utils/config.js')
  const { listCoreCapabilityManagement } = await import(
    '../dist/src/core/capabilityCore.js'
  )
  const { getAllBaseTools } = await import('../dist/src/tools.js')
  enableConfigs()

  const readTool = getAllBaseTools().find(tool => tool.name === 'Read')
  assert.ok(readTool)

  const projection = await listCoreCapabilityManagement({
    cwd: root,
    configHomeDir: configHome,
    mcpRuntime: {
      clients: [
        connectedClient('demo'),
        {
          name: 'off',
          type: 'disabled',
          config: {
            scope: 'user',
            type: 'stdio',
            command: 'node',
            args: ['off-server.mjs'],
          },
        },
      ],
      tools: [
        {
          ...readTool,
          name: 'mcp__demo__search',
          aliases: [],
          description: 'Search via demo MCP.',
          isMcp: true,
          mcpInfo: { serverName: 'demo', toolName: 'search' },
        },
        {
          ...readTool,
          name: 'mcp__off__blocked',
          aliases: [],
          description: 'Disabled MCP tool fixture.',
          isMcp: true,
          mcpInfo: { serverName: 'off', toolName: 'blocked' },
        },
      ],
      commands: [mcpPromptCommand(), mcpSkillCommand()],
      resources: {
        demo: [
          {
            server: 'demo',
            uri: 'file:///demo-resource.txt',
            name: 'demo-resource',
            description: 'Demo MCP resource.',
            mimeType: 'text/plain',
          },
        ],
      },
    },
  })

  const mcpTool = projection.mcp.find(
    item => item.kind === 'mcp-tool' && item.name === 'mcp__demo__search',
  )
  assert.ok(mcpTool)
  assert.equal(mcpTool.source.kind, 'mcp')
  assert.equal(mcpTool.relations.parentMcpServerName, 'demo')
  assert.equal(mcpTool.state.status, 'available')

  const runtimeServer = projection.mcp.find(
    item => item.kind === 'mcp-server' && item.name === 'demo',
  )
  assert.ok(runtimeServer)
  assert.equal(runtimeServer.state.installed, false)
  assert.equal(runtimeServer.state.configured, false)
  assert.equal(runtimeServer.state.runtimeConnected, true)
  assert.equal(runtimeServer.managementOwnership, 'runtime-only')
  assert.deepEqual(runtimeServer.allowedActions, ['inspect'])

  const resource = projection.mcp.find(
    item => item.kind === 'mcp-resource' && item.name === 'demo-resource',
  )
  assert.ok(resource)
  assert.equal(resource.relations.parentMcpServerName, 'demo')

  const prompt = projection.mcp.find(
    item => item.kind === 'mcp-prompt' && item.name === 'mcp__demo__prompt',
  )
  assert.ok(prompt)
  assert.equal(prompt.relations.parentMcpServerName, 'demo')

  const mcpSkill = projection.skills.find(item => item.name === 'mcp-demo-skill')
  assert.ok(mcpSkill)
  assert.equal(mcpSkill.source.kind, 'mcp')
  assert.equal(mcpSkill.relations.parentMcpServerName, 'demo')

  assert.equal(
    projection.skills.some(item => item.name === 'mcp__demo__prompt'),
    false,
  )

  const disabledTool = projection.mcp.find(
    item => item.kind === 'mcp-tool' && item.name === 'mcp__off__blocked',
  )
  assert.equal(
    disabledTool,
    undefined,
    'disabled MCP tools are filtered out of the app-server tool pool',
  )

  const disabledRuntimeServer = projection.mcp.find(
    item => item.kind === 'mcp-server' && item.name === 'off',
  )
  assert.ok(disabledRuntimeServer)
  assert.equal(disabledRuntimeServer.state.installed, false)
  assert.equal(disabledRuntimeServer.state.configured, false)
  assert.deepEqual(disabledRuntimeServer.allowedActions, ['inspect'])
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-capability-management-mcp-runtime: ok')

function connectedClient(name) {
  return {
    name,
    type: 'connected',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    serverInfo: {
      name,
      version: '0.0.0',
    },
    instructions: '',
    config: {
      scope: 'user',
      type: 'stdio',
      command: 'node',
      args: [`${name}-server.mjs`],
    },
    cleanup: async () => {},
  }
}

function mcpPromptCommand() {
  return {
    type: 'prompt',
    name: 'mcp__demo__prompt',
    description: 'Demo MCP prompt.',
    progressMessage: 'Loading demo prompt',
    contentLength: 0,
    source: 'mcp',
    isMcp: true,
    userFacingName: () => 'demo: prompt',
    getPromptForCommand: async () => [],
  }
}

function mcpSkillCommand() {
  return {
    type: 'prompt',
    name: 'mcp-demo-skill',
    description: 'Demo MCP Skill.',
    progressMessage: 'Loading demo skill',
    contentLength: 0,
    source: 'mcp',
    loadedFrom: 'mcp',
    isMcp: true,
    mcpServerName: 'demo',
    mcpSkillUri: 'skill://demo/mcp-demo-skill',
    userFacingName: () => 'mcp-demo-skill',
    getPromptForCommand: async () => [],
  }
}
