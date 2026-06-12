import assert from 'node:assert/strict'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createPluginDomainSession,
} from '../dist/src/services/plugins/pluginDomainSession.js'
import {
  PluginRuntimeActivator,
} from '../dist/src/services/plugins/pluginRuntimeActivator.js'
import { createCcrCore } from '../dist/src/core/ccrCore.js'
import {
  createAppServerContext,
  handleJsonRpcMessage,
} from '../dist/src/app-server/router.js'
import { enableConfigs } from '../dist/src/utils/config.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-runtime-'))
const home = join(root, 'home')
const workspace = join(root, 'workspace')
await Promise.all([
  mkdir(home, { recursive: true }),
  mkdir(workspace, { recursive: true }),
])
process.env.CCR_CONFIG_DIR = home
enableConfigs()

const activator = new PluginRuntimeActivator()
const runtimeA = createSession('runtime-a')
const first = await activator.activate(runtimeA, {
  runtimeInstanceId: 'runtime-a',
  async prepare() {
    return {
      plugins: [
        {
          pluginId: 'demo@local',
          version: '1.0.0',
          components: ['command', 'mcp', 'output-style'],
        },
      ],
      loadedPlugins: [loadedPlugin('demo@local', '1.0.0')],
      componentResults: [
        {
          pluginId: 'demo@local',
          component: 'command',
          state: 'active',
        },
        {
          pluginId: 'demo@local',
          component: 'mcp',
          state: 'failed',
          diagnostic: 'MCP connection failed',
        },
        {
          pluginId: 'demo@local',
          component: 'output-style',
          state: 'restart-required',
        },
      ],
      payload: null,
    }
  },
  async commit() {
    return []
  },
})
assert.equal(first.state, 'partial')
assert.equal(first.previousSnapshotRetained, false)
assert.equal(first.snapshot.activations[0].state, 'partial')
assert.equal(
  first.snapshot.activations[0].components.find(
    component => component.component === 'mcp',
  ).state,
  'failed',
)

const failedPrepare = await activator.activate(runtimeA, {
  runtimeInstanceId: 'runtime-a',
  async prepare() {
    throw new Error('snapshot build failed')
  },
  async commit() {
    throw new Error('unreachable')
  },
})
assert.equal(failedPrepare.state, 'failed')
assert.equal(failedPrepare.previousSnapshotRetained, true)
assert.equal(
  failedPrepare.snapshot.activations[0].activeVersion,
  '1.0.0',
)

const runtimeB = createSession('runtime-b')
const second = await activator.activate(runtimeB, {
  runtimeInstanceId: 'runtime-b',
  async prepare() {
    return {
      plugins: [
        {
          pluginId: 'demo@local',
          version: '2.0.0',
          components: ['command'],
        },
      ],
      loadedPlugins: [loadedPlugin('demo@local', '2.0.0')],
      componentResults: [],
      payload: null,
    }
  },
  async commit() {
    return []
  },
})
assert.equal(second.state, 'active')
assert.equal(second.snapshot.activations[0].activeVersion, '2.0.0')

const reloadedA = await createSession('runtime-a').runtime.read()
const reloadedB = await createSession('runtime-b').runtime.read()
assert.equal(reloadedA.activations[0].activeVersion, '1.0.0')
assert.equal(reloadedB.activations[0].activeVersion, '2.0.0')
assert.notEqual(
  reloadedA.activations[0].activationRevision,
  reloadedB.activations[0].activationRevision,
)

await assert.rejects(
  activator.activate(runtimeA, {
    runtimeInstanceId: 'runtime-b',
    async prepare() {
      throw new Error('unreachable')
    },
    async commit() {
      return []
    },
  }),
  error => error.code === 'plugin-runtime-instance-mismatch',
)

const core = createCcrCore({
  pluginRuntimeHostAdapterFactory: context =>
    createHostAdapter(context.runtimeInstanceId, '3.0.0'),
})
const coreResult = await core.plugins.activateRuntime({
  workspaceRoot: workspace,
  currentCwd: workspace,
  configHomeDir: home,
  runtimeInstanceId: 'core-runtime',
})
assert.equal(coreResult.state, 'active')
assert.equal(
  coreResult.snapshot.activations[0].activeVersion,
  '3.0.0',
)

const unavailableAppServer = createAppServerContext()
await rpc(unavailableAppServer, 1, 'initialize', {})
const unavailable = await rpcError(
  unavailableAppServer,
  2,
  'plugins/runtime/activate',
  {
    cwd: workspace,
    workspaceRoot: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'app-runtime-unavailable',
  },
)
assert.equal(
  unavailable.error.data.details.code,
  'plugin-runtime-host-unavailable',
)

const appServer = createAppServerContext({
  pluginRuntimeHostAdapterFactory: context =>
    createHostAdapter(context.runtimeInstanceId, '4.0.0'),
})
await rpc(appServer, 3, 'initialize', {})
const appActivated = await rpc(
  appServer,
  4,
  'plugins/runtime/activate',
  {
    cwd: workspace,
    workspaceRoot: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'app-runtime',
  },
)
assert.equal(appActivated.state, 'active')
const appSnapshot = await rpc(
  appServer,
  5,
  'plugins/runtime/get',
  {
    cwd: workspace,
    workspaceRoot: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'app-runtime',
  },
)
assert.equal(appSnapshot.activations[0].activeVersion, '4.0.0')

console.log('plugin runtime activator smoke passed')

function createSession(runtimeInstanceId) {
  return createPluginDomainSession({
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir: home,
    runtimeInstanceId,
    requestId: `smoke:${runtimeInstanceId}:${Date.now()}`,
    environment: process.env,
  })
}

function loadedPlugin(pluginId, version) {
  return {
    name: 'demo',
    manifest: {
      name: 'demo',
      version,
    },
    path: join(root, pluginId, version),
    source: pluginId,
    repository: pluginId,
    enabled: true,
  }
}

function createHostAdapter(runtimeInstanceId, version) {
  return {
    runtimeInstanceId,
    async prepare() {
      return {
        plugins: [
          {
            pluginId: 'demo@local',
            version,
            components: ['skill'],
          },
        ],
        loadedPlugins: [loadedPlugin('demo@local', version)],
        componentResults: [],
        payload: null,
      }
    },
    async commit() {
      return []
    },
  }
}

async function rpc(context, id, method, params) {
  const response = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id,
    method,
    params,
  })
  assert.equal('result' in response, true, JSON.stringify(response))
  return response.result
}

async function rpcError(context, id, method, params) {
  const response = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id,
    method,
    params,
  })
  assert.equal('error' in response, true, JSON.stringify(response))
  return response
}
