import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createAppServerContext,
  handleJsonRpcMessage,
} from '../dist/src/app-server/router.js'
import { enableConfigs } from '../dist/src/utils/config.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-app-registry-'))
const configHome = join(root, 'ccr-home')
process.env.CCR_CONFIG_DIR = configHome
process.env.CLAUDE_CONFIG_DIR = configHome

try {
  enableConfigs()
  const contextA = createAppServerContext()
  await initialize(contextA, 1, 'registry-session-a')

  const baseline = await request(contextA, 2, 'capabilities/list', {
    cwd: root,
    configHomeDir: configHome,
  })
  const readTool = baseline.capabilities.find(
    capability => capability.kind === 'tool' && capability.name === 'Read',
  )
  assert.ok(readTool)

  const registered = await request(
    contextA,
    3,
    'capabilities/apps/register',
    {
      apps: [
        appSnapshot({
          connected: true,
          authStatus: 'connected',
          providedToolIds: [readTool.id],
        }),
      ],
    },
  )
  assert.equal(registered.revision, 1)
  assert.equal(registered.apps.length, 1)

  const listed = await request(contextA, 4, 'capabilities/list', {
    cwd: root,
    configHomeDir: configHome,
  })
  const app = listed.capabilities.find(
    capability =>
      capability.kind === 'app' && capability.source.appId === 'github',
  )
  const relatedRead = listed.capabilities.find(
    capability => capability.id === readTool.id,
  )
  assert.ok(app)
  assert.equal(relatedRead.relations.parentAppId, 'github')
  assert.equal(relatedRead.state.runtimeVisible, true)

  const management = await request(
    contextA,
    5,
    'capabilities/management/list',
    {
      cwd: root,
      configHomeDir: configHome,
    },
  )
  assert.equal(
    management.capabilities.some(
      capability => capability.capabilityId === app.id,
    ),
    true,
  )

  const plan = await request(
    contextA,
    6,
    'capabilities/management/action/plan',
    {
      cwd: root,
      configHomeDir: configHome,
      capabilityId: app.id,
      action: 'inspect',
    },
  )
  assert.equal(plan.allowed, true)

  const applied = await request(
    contextA,
    7,
    'capabilities/management/action/apply',
    {
      cwd: root,
      configHomeDir: configHome,
      capabilityId: app.id,
      action: 'inspect',
    },
  )
  assert.equal(applied.applied, true)
  assert.equal(applied.result.capabilityId, app.id)
  assert.equal(
    applied.management.capabilities.some(
      capability => capability.capabilityId === app.id,
    ),
    true,
  )

  const updated = await request(
    contextA,
    8,
    'capabilities/apps/register',
    {
      mode: 'upsert',
      apps: [
        appSnapshot({
          connected: false,
          authStatus: 'needs-auth',
          providedToolIds: [readTool.id],
        }),
      ],
    },
  )
  assert.equal(updated.revision, 2)

  const authBlocked = await request(contextA, 9, 'capabilities/list', {
    cwd: root,
    configHomeDir: configHome,
  })
  const blockedRead = authBlocked.capabilities.find(
    capability => capability.id === readTool.id,
  )
  assert.equal(blockedRead.state.runtimeVisible, false)
  assert.equal(
    blockedRead.state.hiddenReasons.includes('app-needs-auth'),
    true,
  )

  const contextB = createAppServerContext()
  await initialize(contextB, 10, 'registry-session-b')
  const isolated = await request(contextB, 11, 'capabilities/list', {
    cwd: root,
    configHomeDir: configHome,
  })
  assert.equal(
    isolated.capabilities.some(capability => capability.kind === 'app'),
    false,
  )

  await request(contextA, 12, 'shutdown', {})
  assert.equal(contextA.core.capabilities.apps.getSnapshot().apps.length, 0)
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-app-capability-registry-lifecycle: ok')

function appSnapshot(overrides = {}) {
  return {
    id: 'github',
    name: 'GitHub',
    description: 'Repository connector.',
    enabled: true,
    ...overrides,
  }
}

async function initialize(context, id, name) {
  const response = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      clientInfo: { name },
    },
  })
  assert.equal(response.error, undefined)
  assert.equal(response.result.capabilities.capabilityApps, true)
}

async function request(context, id, method, params) {
  const response = await handleJsonRpcMessage(context, {
    jsonrpc: '2.0',
    id,
    method,
    params,
  })
  assert.equal(response.error, undefined, JSON.stringify(response.error))
  return response.result
}
