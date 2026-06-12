import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createCcrCore } from '../dist/src/core/ccrCore.js'
import {
  createPluginDomainSession,
} from '../dist/src/services/plugins/pluginDomainSession.js'
import {
  PluginConfigurationService,
} from '../dist/src/services/plugins/pluginConfigurationService.js'
import {
  createAppServerContext,
  handleJsonRpcMessage,
} from '../dist/src/app-server/router.js'
import { enableConfigs } from '../dist/src/utils/config.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-config-'))
const workspace = join(root, 'workspace')
const homeA = join(root, 'home-a')
const homeB = join(root, 'home-b')
const marketplaceRoot = join(root, 'marketplace')
await Promise.all([
  mkdir(workspace, { recursive: true }),
  mkdir(join(homeA, 'plugins'), { recursive: true }),
  mkdir(join(homeB, 'plugins'), { recursive: true }),
  mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
])
await writeJson(
  join(marketplaceRoot, '.claude-plugin', 'marketplace.json'),
  {
    name: 'local',
    owner: { name: 'CCR smoke' },
    plugins: [
      {
        name: 'configurable',
        version: '1.0.0',
        source: './configurable',
        userConfig: {
          endpoint: {
            type: 'string',
            title: 'Endpoint',
            description: 'Service endpoint',
          },
          token: {
            type: 'string',
            title: 'Token',
            description: 'Service token',
            sensitive: true,
          },
        },
      },
    ],
  },
)
await Promise.all([
  writeMarketplaceConfig(homeA),
  writeMarketplaceConfig(homeB),
])

const core = createCcrCore()
const contextA = context(homeA)
const contextB = context(homeB)
const userIdentity = {
  pluginId: 'configurable@local',
  scope: 'user',
}
let snapshot = await core.plugins.saveConfiguration(
  {
    identity: userIdentity,
    values: {
      endpoint: 'https://user.example',
      token: 'user-secret',
    },
  },
  contextA,
)
assert.equal(snapshot.effectiveOptions.endpoint, 'https://user.example')
assert.equal(snapshot.secretStatus.configured, true)
assert.equal('token' in snapshot.effectiveOptions, false)
const userSettings = await readJson(join(homeA, 'settings.json'))
assert.equal(
  userSettings.pluginConfigs['configurable@local'].options.endpoint,
  'https://user.example',
)
assert.equal(
  'token' in userSettings.pluginConfigs['configurable@local'].options,
  false,
)
let credentials = await readJson(join(homeA, '.credentials.json'))
assert.equal(
  credentials.pluginSecrets['configurable@local'].token,
  'user-secret',
)

const projectIdentity = {
  pluginId: 'configurable@local',
  scope: 'project',
  workspaceRoot: workspace,
}
snapshot = await core.plugins.saveConfiguration(
  {
    identity: projectIdentity,
    values: {
      endpoint: 'https://project.example',
      token: 'project-secret',
    },
  },
  contextA,
)
assert.equal(snapshot.effectiveOptions.endpoint, 'https://project.example')
const projectSettings = await readJson(
  join(workspace, '.ccr', 'settings.json'),
)
assert.equal(
  projectSettings.pluginConfigs['configurable@local'].options.endpoint,
  'https://project.example',
)
assert.equal(
  'token' in projectSettings.pluginConfigs['configurable@local'].options,
  false,
)
credentials = await readJson(join(homeA, '.credentials.json'))
const projectSecretKey = Object.keys(credentials.pluginSecrets).find(
  key => key.startsWith('configurable@local/project/'),
)
assert.ok(projectSecretKey)
assert.equal(
  credentials.pluginSecrets[projectSecretKey].token,
  'project-secret',
)

await core.plugins.saveConfiguration(
  {
    identity: projectIdentity,
    values: { token: '' },
  },
  contextA,
)
credentials = await readJson(join(homeA, '.credentials.json'))
assert.equal(
  credentials.pluginSecrets[projectSecretKey].token,
  'project-secret',
)

const isolated = await core.plugins.inspectConfiguration(
  userIdentity,
  contextB,
)
assert.deepEqual(
  isolated.layers.find(layer => layer.scope === 'user').values,
  {},
)
assert.equal(
  isolated.effectiveOptions.endpoint,
  'https://project.example',
)
assert.equal(isolated.secretStatus.configured, false)

await writeFile(join(homeB, '.credentials.json'), '{invalid', 'utf8')
const corrupt = await core.plugins.inspectConfiguration(
  userIdentity,
  contextB,
)
assert.equal(corrupt.secretStatus.configured, false)
assert.equal(
  corrupt.diagnostics.some(
    diagnostic =>
      diagnostic.code === 'plugin-secret-storage-unavailable',
  ),
  true,
)

const dataPath = join(
  homeA,
  'plugins',
  'data',
  'configurable-local',
)
await mkdir(dataPath, { recursive: true })
await writeFile(join(dataPath, 'state.json'), '{}', 'utf8')
snapshot = await core.plugins.deleteConfiguration(
  {
    identity: projectIdentity,
    removeOptions: true,
  },
  contextA,
)
assert.equal(snapshot.data.exists, true)
assert.equal(snapshot.secretStatus.configured, true)
await stat(join(dataPath, 'state.json'))

snapshot = await core.plugins.deleteConfiguration(
  {
    identity: projectIdentity,
    removeSecrets: true,
    removeData: true,
  },
  contextA,
)
assert.equal(snapshot.data.exists, false)
assert.equal(snapshot.secretStatus.configured, false)

const failedSecretSession = createPluginDomainSession({
  ...contextA,
  requestId: 'secret-failure',
  environment: process.env,
  repositories: {
    secrets: {
      async hasSecrets() {
        return false
      },
      async inspect(identity) {
        return {
          configured: false,
          keyCount: 0,
          storageKey: identity.pluginId,
          storagePath: join(homeA, '.credentials.json'),
          error: 'injected secure storage failure',
        }
      },
      async write() {
        throw new Error('injected secure storage failure')
      },
      async delete() {},
    },
  },
})
const failedSecretSnapshot = await new PluginConfigurationService().inspect(
  failedSecretSession,
  userIdentity,
)
assert.equal(failedSecretSnapshot.secretStatus.configured, false)
assert.equal(
  failedSecretSnapshot.diagnostics.some(
    diagnostic =>
      diagnostic.code === 'plugin-secret-storage-unavailable',
  ),
  true,
)

process.env.CCR_CONFIG_DIR = homeA
enableConfigs()
const appServer = createAppServerContext()
await rpc(appServer, 1, 'initialize', {})
const appSnapshot = await rpc(
  appServer,
  2,
  'plugins/config/get',
  {
    ...requestContext(homeA),
    identity: userIdentity,
  },
)
assert.equal(appSnapshot.effectiveOptions.endpoint, 'https://user.example')
assert.equal('values' in appSnapshot.secretStatus, false)

console.log('plugin configuration governance smoke passed')

function context(configHomeDir) {
  return {
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir,
    runtimeInstanceId: 'config-smoke',
  }
}

function requestContext(configHomeDir) {
  return {
    cwd: workspace,
    workspaceRoot: workspace,
    configHomeDir,
    runtimeInstanceId: 'config-smoke',
  }
}

async function rpc(contextValue, id, method, params) {
  const response = await handleJsonRpcMessage(contextValue, {
    jsonrpc: '2.0',
    id,
    method,
    params,
  })
  assert.equal('result' in response, true, JSON.stringify(response))
  return response.result
}

async function writeMarketplaceConfig(home) {
  await writeJson(join(home, 'plugins', 'known_marketplaces.json'), {
    local: {
      source: { source: 'directory', path: marketplaceRoot },
      installLocation: marketplaceRoot,
      lastUpdated: '2026-06-08T00:00:00.000Z',
    },
  })
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}
