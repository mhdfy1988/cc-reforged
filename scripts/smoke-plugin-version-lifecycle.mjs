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
  PluginPersistentOperationStore,
  atomicWriteJson,
  journalPath,
} from '../dist/src/services/plugins/pluginPersistence.js'
import {
  collectPluginCacheGarbage,
} from '../dist/src/services/plugins/pluginVersionLifecycle.js'
import {
  getVersionedCachePathIn,
} from '../dist/src/utils/plugins/pluginLoader.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-version-'))
const workspace = join(root, 'workspace')
const home = join(root, 'home')
const marketplaceRoot = join(root, 'marketplace')
await Promise.all([
  mkdir(workspace, { recursive: true }),
  mkdir(join(home, 'plugins'), { recursive: true }),
  mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
])

await writePluginPackage('dependency', '1.0.0')
await writePluginPackage('root-plugin', '1.0.0', ['dependency'])
await writeMarketplace('1.0.0')
await writeMarketplaceConfig()

const context = {
  workspaceRoot: workspace,
  currentCwd: workspace,
  configHomeDir: home,
  runtimeInstanceId: 'version-smoke',
}
const core = createCcrCore()

await applyPlan(
  await core.plugins.planAction(
    {
      action: 'install',
      target: { pluginId: 'root-plugin@local', scope: 'user' },
    },
    context,
  ),
)

const dependencyImpact = await core.plugins.planAction(
  {
    action: 'uninstall',
    target: { pluginId: 'dependency@local', scope: 'user' },
  },
  context,
)
assert.deepEqual(
  dependencyImpact.dependencies.reverseDependents,
  ['root-plugin@local'],
)
assert.equal(
  dependencyImpact.dependencies.semverSupport,
  'exact-version-only',
)

const v1Path = getVersionedCachePathIn(
  join(home, 'plugins'),
  'root-plugin@local',
  '1.0.0',
)
await atomicWriteJson(
  createSession('runtime-seed').paths.runtimeSnapshotPath,
  {
    activations: [
      {
        runtimeInstanceId: 'version-smoke',
        pluginId: 'root-plugin@local',
        activeVersion: '1.0.0',
        activationRevision: 'runtime-v1',
        state: 'active',
        components: [],
      },
    ],
    loadedPlugins: [],
  },
)

await writePluginPackage('root-plugin', '2.0.0', ['dependency'])
await writeMarketplace('2.0.0')
const updatePlan = await core.plugins.planAction(
  {
    action: 'update',
    target: {
      pluginId: 'root-plugin@local',
      scope: 'user',
      version: '2.0.0',
    },
  },
  context,
)
assert.equal(updatePlan.allowed, true)
assert.equal(updatePlan.install.mode, 'update')
assert.deepEqual(updatePlan.dependencies.direct, ['dependency@local'])
await applyPlan(updatePlan)

let registry = await readJson(
  join(home, 'plugins', 'installed_plugins.json'),
)
assert.equal(
  registry.plugins['root-plugin@local'][0].version,
  '2.0.0',
)
await stat(v1Path)
const afterUpdate = await core.plugins.inspect(
  'root-plugin@local',
  context,
)
assert.equal(
  afterUpdate.runtimeActivations[0].activeVersion,
  '1.0.0',
)

const retentionAfterUpdate = await readJson(
  join(home, 'plugins', 'retention.json'),
)
assert.equal(
  retentionAfterUpdate.records.some(
    record =>
      record.pluginId === 'root-plugin@local' &&
      record.version === '1.0.0',
  ),
  true,
)

const rollbackPlan = await core.plugins.planAction(
  {
    action: 'rollback',
    target: {
      pluginId: 'root-plugin@local',
      scope: 'user',
      version: '1.0.0',
    },
  },
  context,
)
assert.equal(rollbackPlan.allowed, true)
assert.equal(rollbackPlan.install.mode, 'rollback')
assert.equal(rollbackPlan.install.packages[0].cachedPath, v1Path)
await applyPlan(rollbackPlan)
registry = await readJson(join(home, 'plugins', 'installed_plugins.json'))
assert.equal(
  registry.plugins['root-plugin@local'][0].version,
  '1.0.0',
)

const missingRollback = await core.plugins.planAction(
  {
    action: 'rollback',
    target: {
      pluginId: 'root-plugin@local',
      scope: 'user',
      version: '0.9.0',
    },
  },
  context,
)
assert.equal(missingRollback.allowed, false)
assert.match(missingRollback.blockedReason, /does not exist/)

const session = createSession('gc')
const operationPath = getVersionedCachePathIn(
  join(home, 'plugins'),
  'operation-held@local',
  '1.0.0',
)
const journalHeldPath = getVersionedCachePathIn(
  join(home, 'plugins'),
  'journal-held@local',
  '1.0.0',
)
const orphanPath = getVersionedCachePathIn(
  join(home, 'plugins'),
  'orphan@local',
  '1.0.0',
)
await Promise.all([
  mkdir(operationPath, { recursive: true }),
  mkdir(journalHeldPath, { recursive: true }),
  mkdir(orphanPath, { recursive: true }),
])
await new PluginPersistentOperationStore(session).writeOperation({
  schemaVersion: 1,
  operationId: 'gc-operation',
  planId: 'gc-plan',
  action: 'update',
  target: {
    pluginId: 'operation-held@local',
    scope: 'user',
    version: '1.0.0',
  },
  status: 'running',
  phase: 'staging',
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T00:00:00.000Z',
  cancellationRequested: false,
  commitBoundaryReached: false,
  result: { packagePath: operationPath },
})
await atomicWriteJson(journalPath(session, 'gc-journal'), {
  schemaVersion: 1,
  operationId: 'gc-journal',
  completed: false,
  packages: [{ finalPath: journalHeldPath }],
})
const gc = await collectPluginCacheGarbage(session, {
  delete: true,
  now: new Date('2026-06-08T01:00:00.000Z'),
})
assert.equal(gc.deleted.includes(orphanPath), true)
assert.equal(
  gc.retained.some(
    item =>
      item.path === operationPath &&
      item.reasons.includes('operation'),
  ),
  true,
)
assert.equal(
  gc.retained.some(
    item =>
      item.path === journalHeldPath &&
      item.reasons.includes('journal'),
  ),
  true,
)
assert.equal(
  gc.retained.some(
    item =>
      item.path === v1Path &&
      item.reasons.includes('installation') &&
      item.reasons.includes('runtime'),
  ),
  true,
)

console.log('plugin version lifecycle smoke passed')

async function applyPlan(plan) {
  assert.equal(plan.allowed, true, plan.blockedReason)
  const operation = await core.plugins.applyAction({
    planId: plan.planId,
    confirmed: plan.requiresConfirmation,
    ...(plan.confirmation
      ? { confirmationToken: plan.confirmation.token }
      : {}),
  })
  const completed = await core.plugins
    .getActionServiceForTests()
    .waitForOperationForTests(operation.operationId)
  assert.equal(completed.status, 'succeeded', JSON.stringify(completed))
  return completed
}

function createSession(requestId) {
  return createPluginDomainSession({
    ...context,
    requestId,
    environment: process.env,
  })
}

async function writePluginPackage(name, version, dependencies = []) {
  const packageRoot = join(marketplaceRoot, 'packages', name)
  await mkdir(join(packageRoot, '.claude-plugin'), { recursive: true })
  await writeJson(join(packageRoot, '.claude-plugin', 'plugin.json'), {
    name,
    version,
    ...(dependencies.length > 0 ? { dependencies } : {}),
  })
}

async function writeMarketplace(rootVersion) {
  await writeJson(
    join(marketplaceRoot, '.claude-plugin', 'marketplace.json'),
    {
      name: 'local',
      owner: { name: 'CCR smoke' },
      plugins: [
        {
          name: 'dependency',
          version: '1.0.0',
          source: './packages/dependency',
        },
        {
          name: 'root-plugin',
          version: rootVersion,
          dependencies: ['dependency'],
          source: './packages/root-plugin',
        },
      ],
    },
  )
}

async function writeMarketplaceConfig() {
  await writeJson(join(home, 'plugins', 'known_marketplaces.json'), {
    local: {
      source: {
        source: 'directory',
        path: marketplaceRoot,
      },
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
