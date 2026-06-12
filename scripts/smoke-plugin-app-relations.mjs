import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  createAppServerContext,
  handleJsonRpcMessage,
} from '../dist/src/app-server/router.js'
import { enableConfigs } from '../dist/src/utils/config.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-apps-'))
const workspace = join(root, 'workspace')
const home = join(root, 'home')
const marketplaceRoot = join(root, 'marketplace')
await Promise.all([
  mkdir(workspace, { recursive: true }),
  mkdir(join(home, 'plugins'), { recursive: true }),
  mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
])
await writeJson(
  join(marketplaceRoot, '.claude-plugin', 'marketplace.json'),
  {
    name: 'local',
    owner: { name: 'CCR smoke' },
    plugins: [
      {
        name: 'collaboration',
        version: '1.0.0',
        source: './collaboration',
        ccr: {
          apps: [
            {
              id: 'github',
              displayName: 'GitHub',
              relation: 'provides',
              skillIds: ['review-follow-up'],
            },
            {
              id: 'slack',
              displayName: 'Slack',
              relation: 'requires',
            },
            {
              id: 'notion',
              displayName: 'Notion',
              relation: 'suggests',
            },
            {
              id: 'chrome',
              displayName: 'Chrome',
              relation: 'configures',
            },
          ],
        },
      },
    ],
  },
)
await writeJson(join(home, 'plugins', 'known_marketplaces.json'), {
  local: {
    source: { source: 'directory', path: marketplaceRoot },
    installLocation: marketplaceRoot,
    lastUpdated: '2026-06-08T00:00:00.000Z',
  },
})

process.env.CCR_CONFIG_DIR = home
enableConfigs()
const context = createAppServerContext()
await rpc(context, 1, 'initialize', {})
const requestContext = {
  cwd: workspace,
  workspaceRoot: workspace,
  configHomeDir: home,
  runtimeInstanceId: 'plugin-app-smoke',
}

let relations = await rpc(context, 2, 'plugins/apps/list', {
  ...requestContext,
  pluginId: 'collaboration@local',
})
assert.equal(relations.length, 4)
assert.equal(
  relations.every(relation => relation.state === 'unregistered'),
  true,
)
assert.equal(relations.some(relation => relation.ownedByPlugin), false)

const nonProvides = await rpcError(
  context,
  3,
  'plugins/apps/register',
  {
    ...requestContext,
    pluginId: 'collaboration@local',
    apps: [
      {
        id: 'slack',
        name: 'Slack',
        authStatus: 'connected',
      },
    ],
  },
)
assert.equal(
  nonProvides.error.data.details.code,
  'plugin-app-relation-not-provides',
)

await rpc(context, 4, 'plugins/apps/register', {
  ...requestContext,
  pluginId: 'collaboration@local',
  apps: [
    {
      id: 'github',
      name: 'GitHub',
      authStatus: 'connected',
      connected: true,
      providedSkillIds: ['review-follow-up'],
    },
  ],
})
await rpc(context, 5, 'capabilities/apps/register', {
  mode: 'upsert',
  apps: [
    {
      id: 'slack',
      name: 'Slack',
      authStatus: 'needs-auth',
    },
    {
      id: 'notion',
      name: 'Notion',
      authStatus: 'disconnected',
    },
    {
      id: 'chrome',
      name: 'Chrome',
      authStatus: 'disabled',
      enabled: false,
    },
  ],
})

relations = await rpc(context, 6, 'plugins/apps/list', {
  ...requestContext,
  pluginId: 'collaboration@local',
})
assert.deepEqual(
  Object.fromEntries(
    relations.map(relation => [
      relation.appId,
      {
        state: relation.state,
        owned: relation.ownedByPlugin,
      },
    ]),
  ),
  {
    github: { state: 'connected', owned: true },
    slack: { state: 'needs-auth', owned: false },
    notion: { state: 'disconnected', owned: false },
    chrome: { state: 'disabled', owned: false },
  },
)

const catalog = await rpc(context, 7, 'capabilities/list', {
  cwd: workspace,
  configHomeDir: home,
})
const githubApp = catalog.capabilities.find(
  capability =>
    capability.kind === 'app' && capability.source.appId === 'github',
)
const slackApp = catalog.capabilities.find(
  capability =>
    capability.kind === 'app' && capability.source.appId === 'slack',
)
const notionApp = catalog.capabilities.find(
  capability =>
    capability.kind === 'app' && capability.source.appId === 'notion',
)
assert.equal(githubApp.metadata.connected, true)
assert.equal(
  githubApp.state.hiddenReasons.includes('plugin-missing'),
  true,
)
assert.equal(
  githubApp.diagnostics.some(
    diagnostic => diagnostic.code === 'parent-plugin-missing',
  ),
  true,
)
assert.equal(slackApp.state.status, 'needs-auth')
assert.equal(
  slackApp.diagnostics.some(
    diagnostic => diagnostic.code === 'app-needs-auth',
  ),
  true,
)
assert.equal(notionApp.state.status, 'unavailable')
assert.equal(
  notionApp.diagnostics.some(
    diagnostic => diagnostic.code === 'app-disconnected',
  ),
  true,
)

const ownerConflict = await rpcError(
  context,
  8,
  'capabilities/apps/register',
  {
    mode: 'upsert',
    apps: [
      {
        id: 'github',
        name: 'Different GitHub',
        authStatus: 'connected',
      },
    ],
  },
)
assert.equal(ownerConflict.error.data.kind, 'internal_error')

const afterUnregister = await rpc(
  context,
  9,
  'plugins/apps/unregister',
  { pluginId: 'collaboration@local' },
)
assert.equal(
  afterUnregister.apps.some(app => app.id === 'github'),
  false,
)
assert.equal(
  afterUnregister.apps.some(app => app.id === 'slack'),
  true,
)

console.log('plugin app relations smoke passed')

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

async function rpcError(contextValue, id, method, params) {
  const response = await handleJsonRpcMessage(contextValue, {
    jsonrpc: '2.0',
    id,
    method,
    params,
  })
  assert.equal('error' in response, true, JSON.stringify(response))
  return response
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
