import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ccrConfigDir = await mkdtemp(join(tmpdir(), 'ccr-mcp-adopt-'))
process.env.CCR_CONFIG_DIR = ccrConfigDir

try {
  const configModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/utils/config.js')).href
  )
  configModule.enableConfigs()

  const mcpConfigModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/services/mcp/config.js')).href
  )
  const installManagerModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManager.js')).href
  )
  const routerModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/app-server/router.js')).href
  )

  const { addMcpConfig } = mcpConfigModule
  const {
    applyCcrMcpAdoptPlan,
    createCcrMcpAdoptPlan,
    listCcrMcpInstalledServers,
    uninstallCcrMcpInstalledServer,
  } = installManagerModule
  const { createAppServerContext, handleJsonRpcMessage } = routerModule

  await addMcpConfig(
    'adopt_http',
    {
      type: 'http',
      url: 'http://127.0.0.1:3001/mcp',
      headers: {
        'X-Test': 'yes',
      },
    },
    'user',
  )

  const httpPlan = await createCcrMcpAdoptPlan({ name: 'adopt_http' })
  assert.equal(httpPlan.adoptable, true)
  assert.equal(httpPlan.existingInstalled, false)
  assert.equal(httpPlan.manifest.kind, 'remote-url')
  assert.equal(httpPlan.manifest.dataBoundary, 'local-only')
  assert.equal(httpPlan.serverConfigPreview.type, 'http')
  assert.ok(httpPlan.confirmation.token)

  const adoptResult = await applyCcrMcpAdoptPlan({
    name: 'adopt_http',
    confirmed: true,
    confirmationToken: httpPlan.confirmation.token,
  })
  assert.equal(adoptResult.adopted, true)

  const afterAdopt = await listCcrMcpInstalledServers()
  const installedHttp = afterAdopt.installed.find(
    record => record.name === 'adopt_http',
  )
  assert.ok(installedHttp)
  assert.equal(installedHttp.configStatus.state, 'configured')

  const blockedPlan = await createCcrMcpAdoptPlan({ name: 'adopt_http' })
  assert.equal(blockedPlan.adoptable, false)
  assert.equal(blockedPlan.existingInstalled, true)
  assert.equal(blockedPlan.confirmation.token, '')

  await uninstallCcrMcpInstalledServer({
    name: 'adopt_http',
    confirmed: true,
  })

  await addMcpConfig(
    'adopt_stdio',
    {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: {
        MY_API_KEY: 'secret',
      },
    },
    'user',
  )

  const stdioPlan = await createCcrMcpAdoptPlan({ name: 'adopt_stdio' })
  assert.equal(stdioPlan.adoptable, true)
  assert.equal(stdioPlan.manifest.kind, 'manual-config')
  assert.equal(stdioPlan.manifest.transport, 'stdio')
  assert.equal(stdioPlan.serverConfigPreview.command, 'node')
  assert.equal(stdioPlan.manifest.envNames.includes('MY_API_KEY'), true)

  const context = createAppServerContext()
  await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {},
  })
  const rpcPlanResponse = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id: 2,
    method: 'mcp/install/adopt/plan',
    params: { name: 'adopt_stdio' },
  })
  assert.equal(rpcPlanResponse.jsonrpc, '2.0')
  assert.equal(rpcPlanResponse.id, 2)
  assert.equal(rpcPlanResponse.result.adoptable, true)

  const rpcApplyResponse = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id: 3,
    method: 'mcp/install/adopt/apply',
    params: {
      name: 'adopt_stdio',
      confirmed: true,
      confirmationToken: rpcPlanResponse.result.confirmation.token,
    },
  })
  assert.equal(rpcApplyResponse.result.adopted, true)

  console.log('smoke-mcp-adopt: ok')
} finally {
  await rm(ccrConfigDir, { recursive: true, force: true })
}
