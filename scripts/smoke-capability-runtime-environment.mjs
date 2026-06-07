import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'ccr-capability-environment-'))
const processHome = join(root, 'process-home')
const configHomeA = join(root, 'home-a')
const configHomeB = join(root, 'home-b')
const workspaceA = join(root, 'workspace-a')
const workspaceB = join(root, 'workspace-b')
process.env.CCR_CONFIG_DIR = processHome

try {
  await Promise.all([
    mkdir(processHome, { recursive: true }),
    mkdir(configHomeA, { recursive: true }),
    mkdir(configHomeB, { recursive: true }),
    mkdir(workspaceA, { recursive: true }),
    mkdir(workspaceB, { recursive: true }),
  ])
  await Promise.all([
    writeMcpConfig(configHomeA, 'home-a-server'),
    writeMcpConfig(configHomeB, 'home-b-server'),
    writeMcpConfigFile(join(workspaceA, '.mcp.json'), 'workspace-a-server'),
    writeMcpConfigFile(join(workspaceB, '.mcp.json'), 'workspace-b-server'),
  ])

  const { enableConfigs } = await importDist('src/utils/config.js')
  const { listCoreCapabilities } = await importDist(
    'src/core/capabilityCore.js',
  )
  enableConfigs()

  const sharedInputs = {
    mcpRuntime: {
      clients: [],
      tools: [],
      commands: [],
      resources: {},
    },
    pluginSnapshot: {
      plugins: [],
      errors: [],
    },
  }
  const catalogA = await listCoreCapabilities({
    ...sharedInputs,
    cwd: workspaceA,
    configHomeDir: configHomeA,
  })
  const catalogB = await listCoreCapabilities({
    ...sharedInputs,
    cwd: workspaceB,
    configHomeDir: configHomeB,
  })

  assertMcpIsolation(catalogA, 'home-a-server', 'home-b-server')
  assertMcpIsolation(catalogB, 'home-b-server', 'home-a-server')
  assertMcpIsolation(catalogA, 'workspace-a-server', 'workspace-b-server')
  assertMcpIsolation(catalogB, 'workspace-b-server', 'workspace-a-server')

  if (process.platform === 'win32') {
    const caseVariantCatalog = await listCoreCapabilities({
      cwd: workspaceA,
      configHomeDir: processHome.toUpperCase(),
      mcpRuntime: sharedInputs.mcpRuntime,
      mcpConfig: {
        servers: [],
        errors: [],
      },
    })
    assert.equal(
      caseVariantCatalog.capabilities.some(capability =>
        capability.diagnostics?.some(diagnostic =>
          diagnostic.message?.includes(
            'Plugin snapshot for non-active config home is unavailable',
          ),
        ),
      ),
      false,
      'Windows path casing must not turn the active config home into a foreign home',
    )
  }
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-capability-runtime-environment: ok')

async function writeMcpConfig(configHome, serverName) {
  return writeMcpConfigFile(join(configHome, 'mcp.json'), serverName)
}

async function writeMcpConfigFile(filePath, serverName) {
  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        mcpServers: {
          [serverName]: {
            type: 'stdio',
            command: 'node',
            args: ['server.mjs'],
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

function assertMcpIsolation(catalog, included, excluded) {
  const names = new Set(
    catalog.capabilities
      .filter(capability => capability.kind === 'mcp-server')
      .map(capability => capability.name),
  )
  assert.equal(names.has(included), true, `expected ${included}`)
  assert.equal(names.has(excluded), false, `did not expect ${excluded}`)
}
