import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAppServerContext, handleJsonRpcMessage } from '../dist/src/app-server/router.js'
import { enableConfigs } from '../dist/src/utils/config.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-capability-api-'))
const configHome = join(root, 'ccr-home')
process.env.CCR_CONFIG_DIR = configHome
process.env.CLAUDE_CONFIG_DIR = configHome

try {
  enableConfigs()
  const context = createAppServerContext()
  const initialized = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      clientInfo: { name: 'smoke-capability-api' },
    },
  })
  assert.equal(initialized.result.serverInfo.name, 'ccr-app-server')

  const response = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id: 2,
    method: 'capabilities/list',
    params: {
      cwd: root,
      configHomeDir: configHome,
      apps: [
        {
          id: 'github',
          name: 'GitHub',
          description: 'Repository connector.',
          connected: true,
          enabled: true,
          pluginId: 'github@openai',
        },
      ],
    },
  })
  assert.equal(response.error, undefined)
  assert.equal(response.result.schemaVersion, 1)
  assert.equal(response.result.summary.byKind.tool > 0, true)
  assert.equal(response.result.summary.byKind.app, 1)
  assert.equal(
    response.result.capabilities.some(
      capability =>
        capability.kind === 'app' &&
        capability.source.appId === 'github' &&
        capability.relations.parentAppId === undefined &&
        capability.relations.parentPluginId === 'github@openai',
    ),
    true,
  )

  const managementResponse = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id: 3,
    method: 'capabilities/management/list',
    params: {
      cwd: root,
      configHomeDir: configHome,
    },
  })
  assert.equal(managementResponse.error, undefined)
  assert.equal(managementResponse.result.schemaVersion, 1)
  assert.equal(Array.isArray(managementResponse.result.capabilities), true)
  assert.equal(managementResponse.result.summary.total > 0, true)
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-capability-api: ok')
