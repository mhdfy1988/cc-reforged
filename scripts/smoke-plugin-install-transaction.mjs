import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createCcrCore } from '../dist/src/core/ccrCore.js'
import {
  createPluginDomainSession,
} from '../dist/src/services/plugins/pluginDomainSession.js'
import {
  PluginInstallTransaction,
  createPluginTransactionExecutor,
} from '../dist/src/services/plugins/pluginInstallTransaction.js'
import {
  acquirePluginScopeLock,
} from '../dist/src/services/plugins/pluginPersistence.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-transaction-'))
const workspace = join(root, 'workspace')
const home = join(root, 'home')
const marketplaceRoot = join(root, 'marketplace')
await Promise.all([
  mkdir(workspace, { recursive: true }),
  mkdir(join(home, 'plugins'), { recursive: true }),
  mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
])

await writePluginPackage('dependency', '1.0.0')
await writePluginPackage('root-plugin', '2.0.0', ['dependency'])
await writePluginPackage('explicit-plugin', '1.1.0')
await writePluginPackage('fault-plugin', '1.0.0')
await writeMarketplace()
await writeMarketplaceConfig(home)

const context = {
  workspaceRoot: workspace,
  currentCwd: workspace,
  configHomeDir: home,
  runtimeInstanceId: 'smoke-runtime',
}

const core = createCcrCore()
const installPlan = await core.plugins.planAction(
  {
    action: 'install',
    target: {
      pluginId: 'root-plugin@local',
      scope: 'user',
      sourceId: 'local',
    },
  },
  context,
)
assert.equal(installPlan.allowed, true)
assert.equal(installPlan.install.enableAfterInstall, false)
assert.deepEqual(
  installPlan.install.packages.map(item => item.pluginId),
  ['dependency@local', 'root-plugin@local'],
)
assert.equal(
  installPlan.effects.some(effect => effect.kind === 'write-intent'),
  false,
)
const operation = await core.plugins.applyAction({
  planId: installPlan.planId,
  confirmed: true,
  confirmationToken: installPlan.confirmation.token,
})
const completed = await core.plugins
  .getActionServiceForTests()
  .waitForOperationForTests(operation.operationId)
assert.equal(completed.status, 'succeeded')
const registry = await readJson(join(home, 'plugins', 'installed_plugins.json'))
assert.equal(registry.version, 2)
assert.equal(registry.plugins['root-plugin@local'].length, 1)
assert.equal(registry.plugins['dependency@local'].length, 1)
await stat(registry.plugins['root-plugin@local'][0].installPath)
assert.equal(await readJsonOrNull(join(home, 'settings.json')), null)

const restartedCore = createCcrCore()
const persisted = await restartedCore.plugins.getOperation(
  operation.operationId,
  context,
)
assert.equal(persisted.status, 'succeeded')

const explicitPlan = await core.plugins.planAction(
  {
    action: 'install',
    target: {
      pluginId: 'explicit-plugin@local',
      scope: 'project',
      workspaceRoot: workspace,
    },
    installOptions: { enableAfterInstall: true },
  },
  context,
)
assert.equal(
  explicitPlan.effects.some(effect => effect.kind === 'write-intent'),
  true,
)
const explicitOperation = await core.plugins.applyAction({
  planId: explicitPlan.planId,
  confirmed: true,
  confirmationToken: explicitPlan.confirmation.token,
})
assert.equal(
  (
    await core.plugins
      .getActionServiceForTests()
      .waitForOperationForTests(explicitOperation.operationId)
  ).status,
  'succeeded',
)
const projectSettings = await readJson(
  join(workspace, '.ccr', 'settings.json'),
)
assert.equal(projectSettings.enabledPlugins['explicit-plugin@local'], true)

const failedHome = join(root, 'failed-home')
await writeMarketplaceConfig(failedHome)
const failedContext = { ...context, configHomeDir: failedHome }
const failedCore = createCcrCore({
  pluginActionExecutor: createPluginTransactionExecutor({
    materialize: async () => {
      throw Object.assign(new Error('injected stage failure'), {
        code: 'injected-stage-failure',
      })
    },
  }),
})
const failedPlan = await failedCore.plugins.planAction(
  {
    action: 'install',
    target: { pluginId: 'fault-plugin@local', scope: 'user' },
  },
  failedContext,
)
const failedOperation = await failedCore.plugins.applyAction({
  planId: failedPlan.planId,
  confirmed: true,
  confirmationToken: failedPlan.confirmation.token,
})
const failedFinal = await failedCore.plugins
  .getActionServiceForTests()
  .waitForOperationForTests(failedOperation.operationId)
assert.equal(failedFinal.status, 'failed')
assert.equal(
  await readJsonOrNull(join(failedHome, 'plugins', 'installed_plugins.json')),
  null,
)
assert.equal(await readJsonOrNull(join(failedHome, 'settings.json')), null)

const session = createPluginDomainSession({
  ...context,
  requestId: 'lock-smoke',
  environment: process.env,
})
const heldLock = await acquirePluginScopeLock(session, {
  operationId: 'held-lock',
  scope: 'local',
  workspaceRoot: workspace,
})
await assert.rejects(
  acquirePluginScopeLock(session, {
    operationId: 'conflicting-lock',
    scope: 'local',
    workspaceRoot: workspace,
  }),
  error => error.code === 'plugin-operation-conflict',
)
await heldLock.release()

const recoveryHome = join(root, 'recovery-home')
await writeMarketplaceConfig(recoveryHome)
const recoveryContext = { ...context, configHomeDir: recoveryHome }
let faultInjected = false
const recoveryTransaction = new PluginInstallTransaction({
  injectFault(fault) {
    if (!faultInjected && fault === 'after-registry-commit') {
      faultInjected = true
      throw Object.assign(new Error('injected commit fault'), {
        code: 'injected-commit-fault',
      })
    }
  },
})
const recoveryCore = createCcrCore({
  pluginActionExecutor: input => recoveryTransaction.execute(input),
})
const recoveryPlan = await recoveryCore.plugins.planAction(
  {
    action: 'install',
    target: { pluginId: 'fault-plugin@local', scope: 'user' },
    installOptions: { enableAfterInstall: true },
  },
  recoveryContext,
)
const recoveryOperation = await recoveryCore.plugins.applyAction({
  planId: recoveryPlan.planId,
  confirmed: true,
  confirmationToken: recoveryPlan.confirmation.token,
})
const recoveryFailed = await recoveryCore.plugins
  .getActionServiceForTests()
  .waitForOperationForTests(recoveryOperation.operationId)
assert.equal(recoveryFailed.status, 'failed')
assert.equal(
  (await readJson(join(recoveryHome, 'plugins', 'installed_plugins.json')))
    .plugins['fault-plugin@local'].length,
  1,
)
assert.equal(await readJsonOrNull(join(recoveryHome, 'settings.json')), null)

const recoverySession = createPluginDomainSession({
  ...recoveryContext,
  requestId: 'recovery-smoke',
  environment: process.env,
})
const recoveryExecutionContext = {
  plan: recoveryPlan,
  session: recoverySession,
  operation: recoveryFailed,
  update() {},
  isCancellationRequested() {
    return false
  },
}
const recovered = await recoveryTransaction.reconcile(
  recoveryOperation.operationId,
  recoveryExecutionContext,
)
assert.equal(recovered.enabled, true)
const recoveredAgain = await recoveryTransaction.reconcile(
  recoveryOperation.operationId,
  recoveryExecutionContext,
)
assert.deepEqual(recoveredAgain, recovered)
const recoveredRegistry = await readJson(
  join(recoveryHome, 'plugins', 'installed_plugins.json'),
)
assert.equal(recoveredRegistry.plugins['fault-plugin@local'].length, 1)
assert.equal(
  (await readJson(join(recoveryHome, 'settings.json'))).enabledPlugins[
    'fault-plugin@local'
  ],
  true,
)

console.log('plugin install transaction smoke passed')

async function writePluginPackage(name, version, dependencies = []) {
  const packageRoot = join(marketplaceRoot, 'packages', name)
  await mkdir(join(packageRoot, '.claude-plugin'), { recursive: true })
  await writeJson(join(packageRoot, '.claude-plugin', 'plugin.json'), {
    name,
    version,
    ...(dependencies.length > 0 ? { dependencies } : {}),
  })
}

async function writeMarketplace() {
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
          version: '2.0.0',
          dependencies: ['dependency'],
          source: './packages/root-plugin',
        },
        {
          name: 'explicit-plugin',
          version: '1.1.0',
          source: './packages/explicit-plugin',
        },
        {
          name: 'fault-plugin',
          version: '1.0.0',
          source: './packages/fault-plugin',
        },
      ],
    },
  )
}

async function writeMarketplaceConfig(targetHome) {
  await mkdir(join(targetHome, 'plugins'), { recursive: true })
  await writeJson(join(targetHome, 'plugins', 'known_marketplaces.json'), {
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

async function readJsonOrNull(path) {
  try {
    return await readJson(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
