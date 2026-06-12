import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createCcrCore } from '../dist/src/core/ccrCore.js'
import {
  createPluginDomainSession,
} from '../dist/src/services/plugins/pluginDomainSession.js'
import {
  PluginInstallTransaction,
} from '../dist/src/services/plugins/pluginInstallTransaction.js'
import {
  PluginLifecycleTransaction,
} from '../dist/src/services/plugins/pluginLifecycleTransaction.js'

const installFaults = [
  'after-stage',
  'after-packages-commit',
  'after-registry-commit',
  'after-intent-commit',
]
const lifecycleFaults = [
  'after-intent-commit',
  'after-registry-commit',
  'after-configuration-commit',
  'after-gc',
]

for (const fault of installFaults) {
  await verifyInstallFault(fault)
}
for (const fault of lifecycleFaults) {
  await verifyLifecycleFault(fault)
}

console.log(
  `plugin transaction fault matrix passed (${installFaults.length + lifecycleFaults.length} boundaries)`,
)

async function verifyInstallFault(fault) {
  const fixture = await createFixture(`install-${fault}`)
  try {
    let injected = false
    const transaction = new PluginInstallTransaction({
      injectFault(current) {
        if (!injected && current === fault) {
          injected = true
          throw faultError(fault)
        }
      },
    })
    const core = createCcrCore({
      pluginActionExecutor: context => transaction.execute(context),
    })
    const plan = await core.plugins.planAction(
      {
        action: 'install',
        target: { pluginId: fixture.pluginId, scope: 'user' },
        installOptions: { enableAfterInstall: true },
      },
      fixture.context,
    )
    const operation = await apply(core, plan, 'failed')
    assert.equal(operation.error.code, `injected-${fault}`)

    const registryPath = join(
      fixture.home,
      'plugins',
      'installed_plugins.json',
    )
    if (fault === 'after-stage') {
      assert.equal(await readJsonOrNull(registryPath), null)
      assert.equal(
        await readJsonOrNull(join(fixture.home, 'settings.json')),
        null,
      )
      return
    }

    const recovered = await transaction.reconcile(
      operation.operationId,
      executionContext(plan, operation, fixture),
    )
    const recoveredAgain = await transaction.reconcile(
      operation.operationId,
      executionContext(plan, operation, fixture),
    )
    assert.deepEqual(recoveredAgain, recovered)
    assert.equal(
      (await readJson(registryPath)).plugins[fixture.pluginId].length,
      1,
    )
    assert.equal(
      (await readJson(join(fixture.home, 'settings.json'))).enabledPlugins[
        fixture.pluginId
      ],
      true,
    )
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
}

async function verifyLifecycleFault(fault) {
  const fixture = await createFixture(`lifecycle-${fault}`)
  try {
    const bootstrapCore = createCcrCore()
    const installPlan = await bootstrapCore.plugins.planAction(
      {
        action: 'install',
        target: { pluginId: fixture.pluginId, scope: 'user' },
        installOptions: { enableAfterInstall: true },
      },
      fixture.context,
    )
    await apply(bootstrapCore, installPlan, 'succeeded')

    let injected = false
    const transaction = new PluginLifecycleTransaction({
      injectFault(current) {
        if (!injected && current === fault) {
          injected = true
          throw faultError(fault)
        }
      },
    })
    const core = createCcrCore({
      pluginActionExecutor: context => transaction.execute(context),
    })
    const plan = await core.plugins.planAction(
      {
        action: 'uninstall',
        target: { pluginId: fixture.pluginId, scope: 'user' },
      },
      fixture.context,
    )
    const operation = await apply(core, plan, 'failed')
    assert.equal(operation.error.code, `injected-${fault}`)

    const recovered = await transaction.reconcile(
      operation.operationId,
      executionContext(plan, operation, fixture),
    )
    const recoveredAgain = await transaction.reconcile(
      operation.operationId,
      executionContext(plan, operation, fixture),
    )
    assert.deepEqual(recoveredAgain, recovered)
    const registry = await readJson(
      join(fixture.home, 'plugins', 'installed_plugins.json'),
    )
    assert.equal(Object.hasOwn(registry.plugins, fixture.pluginId), false)
    assert.equal(
      Object.hasOwn(
        (await readJson(join(fixture.home, 'settings.json')))
          .enabledPlugins ?? {},
        fixture.pluginId,
      ),
      false,
    )
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
}

async function createFixture(label) {
  const root = await mkdtemp(join(tmpdir(), `ccr-plugin-fault-${label}-`))
  const workspace = join(root, 'workspace')
  const home = join(root, 'home')
  const marketplaceRoot = join(root, 'marketplace')
  const pluginId = 'fault-plugin@local'
  await Promise.all([
    mkdir(workspace, { recursive: true }),
    mkdir(join(home, 'plugins'), { recursive: true }),
    mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
  ])
  const packageRoot = join(marketplaceRoot, 'packages', 'fault-plugin')
  await mkdir(join(packageRoot, '.claude-plugin'), { recursive: true })
  await writeJson(join(packageRoot, '.claude-plugin', 'plugin.json'), {
    name: 'fault-plugin',
    version: '1.0.0',
  })
  await writeJson(
    join(marketplaceRoot, '.claude-plugin', 'marketplace.json'),
    {
      name: 'local',
      owner: { name: 'CCR smoke' },
      plugins: [
        {
          name: 'fault-plugin',
          version: '1.0.0',
          source: './packages/fault-plugin',
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
  return {
    root,
    workspace,
    home,
    pluginId,
    context: {
      workspaceRoot: workspace,
      currentCwd: workspace,
      configHomeDir: home,
      runtimeInstanceId: `fault-${label}`,
    },
  }
}

async function apply(core, plan, expectedStatus) {
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
  assert.equal(completed.status, expectedStatus, JSON.stringify(completed))
  return completed
}

function executionContext(plan, operation, fixture) {
  return {
    plan,
    operation,
    session: createPluginDomainSession({
      ...fixture.context,
      requestId: `reconcile-${operation.operationId}`,
      environment: process.env,
    }),
    update() {},
    isCancellationRequested() {
      return false
    },
  }
}

function faultError(fault) {
  return Object.assign(new Error(`injected ${fault}`), {
    code: `injected-${fault}`,
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
