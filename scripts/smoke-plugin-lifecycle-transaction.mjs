import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
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
  collectPluginCacheGarbage,
} from '../dist/src/services/plugins/pluginVersionLifecycle.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-lifecycle-'))
const workspace = join(root, 'workspace')
const home = join(root, 'home')
const marketplaceRoot = join(root, 'marketplace')
const pluginId = 'workflow-suite@local'

try {
  await Promise.all([
    mkdir(workspace, { recursive: true }),
    mkdir(join(home, 'plugins'), { recursive: true }),
    mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
  ])
  await writePluginPackage()
  await writeMarketplace()
  await writeJson(join(home, 'plugins', 'known_marketplaces.json'), {
    local: {
      source: { source: 'directory', path: marketplaceRoot },
      installLocation: marketplaceRoot,
      lastUpdated: '2026-06-08T00:00:00.000Z',
    },
  })

  const context = {
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'lifecycle-smoke',
  }
  const core = createCcrCore()

  await apply(
    core,
    await core.plugins.planAction(
      {
        action: 'install',
        target: { pluginId, scope: 'user' },
      },
      context,
    ),
  )
  let record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.derivedState.status, 'installed-disabled')

  const enableUser = await core.plugins.planAction(
    { action: 'enable', target: { pluginId, scope: 'user' } },
    context,
  )
  assert.equal(enableUser.allowed, true, enableUser.blockedReason)
  assert.equal((await apply(core, enableUser)).result.pendingActivation, true)
  assert.equal(
    (await readJson(join(home, 'settings.json'))).enabledPlugins[pluginId],
    true,
  )

  const disableUser = await core.plugins.planAction(
    { action: 'disable', target: { pluginId, scope: 'user' } },
    context,
  )
  assert.equal(disableUser.allowed, true, disableUser.blockedReason)
  await apply(core, disableUser)
  assert.equal(
    (await readJson(join(home, 'settings.json'))).enabledPlugins[pluginId],
    false,
  )

  await apply(
    core,
    await core.plugins.planAction(
      {
        action: 'install',
        target: { pluginId, scope: 'project' },
        installOptions: { enableAfterInstall: true },
      },
      context,
    ),
  )
  await apply(
    core,
    await core.plugins.planAction(
      {
        action: 'install',
        target: { pluginId, scope: 'local' },
      },
      context,
    ),
  )

  const localDisable = await core.plugins.planAction(
    { action: 'disable', target: { pluginId, scope: 'local' } },
    context,
  )
  assert.equal(
    localDisable.allowed,
    true,
    'target-scope intent must be validated independently from inherited effective state',
  )
  await apply(core, localDisable)
  const localSettingsPath = join(workspace, '.ccr', 'settings.local.json')
  assert.equal(
    (await readJson(localSettingsPath)).enabledPlugins[pluginId],
    false,
  )

  await core.plugins.saveConfiguration(
    {
      identity: { pluginId, scope: 'local', workspaceRoot: workspace },
      values: { endpoint: 'http://127.0.0.1:4318', apiToken: 'local-secret' },
    },
    context,
  )
  const localConfiguration = await core.plugins.inspectConfiguration(
    { pluginId, scope: 'local', workspaceRoot: workspace },
    context,
  )
  await mkdir(localConfiguration.data.path, { recursive: true })
  await writeFile(
    join(localConfiguration.data.path, 'state.json'),
    '{}\n',
    'utf8',
  )

  const unsafeDataDelete = await core.plugins.planAction(
    {
      action: 'uninstall',
      target: { pluginId, scope: 'local' },
      deleteOptions: { removeData: true },
    },
    context,
  )
  assert.equal(unsafeDataDelete.allowed, false)
  assert.match(unsafeDataDelete.blockedReason, /final installation/)

  const uninstallLocal = await core.plugins.planAction(
    {
      action: 'uninstall',
      target: { pluginId, scope: 'local' },
      deleteOptions: { removeOptions: true, removeSecrets: true },
    },
    context,
  )
  await apply(core, uninstallLocal)
  let registry = await readJson(
    join(home, 'plugins', 'installed_plugins.json'),
  )
  assert.equal(
    registry.plugins[pluginId].some(item => item.scope === 'local'),
    false,
  )
  assert.equal(
    Object.hasOwn(
      (await readJson(localSettingsPath)).enabledPlugins ?? {},
      pluginId,
    ),
    false,
  )
  assert.equal(
    (
      await core.plugins.inspectConfiguration(
        { pluginId, scope: 'local', workspaceRoot: workspace },
        context,
      )
    ).secretStatus.configured,
    false,
  )

  await apply(
    core,
    await core.plugins.planAction(
      { action: 'uninstall', target: { pluginId, scope: 'project' } },
      context,
    ),
  )
  registry = await readJson(join(home, 'plugins', 'installed_plugins.json'))
  assert.deepEqual(
    registry.plugins[pluginId].map(item => item.scope),
    ['user'],
  )

  const installedPath = registry.plugins[pluginId][0].installPath
  const runtimeSession = createPluginDomainSession({
    ...context,
    requestId: 'seed-runtime',
    environment: process.env,
  })
  await writeJson(runtimeSession.paths.runtimeSnapshotPath, {
    activations: [
      {
        runtimeInstanceId: context.runtimeInstanceId,
        pluginId,
        activeVersion: '1.0.0',
        activationRevision: 'runtime-holds-package',
        state: 'active',
        components: [],
      },
    ],
    loadedPlugins: [],
  })

  const uninstallUser = await core.plugins.planAction(
    {
      action: 'uninstall',
      target: { pluginId, scope: 'user' },
      deleteOptions: {
        removeData: true,
        removeOptions: true,
        removeSecrets: true,
      },
    },
    context,
  )
  const uninstallResult = await apply(core, uninstallUser)
  assert.equal(uninstallResult.result.uninstalled, true)
  assert.equal(
    uninstallResult.result.garbageCollection.retained.some(
      item =>
        item.path === installedPath && item.reasons.includes('runtime'),
    ),
    true,
  )
  registry = await readJson(join(home, 'plugins', 'installed_plugins.json'))
  assert.equal(Object.hasOwn(registry.plugins, pluginId), false)
  await assert.rejects(stat(localConfiguration.data.path), {
    code: 'ENOENT',
  })
  await stat(installedPath)

  await writeJson(runtimeSession.paths.runtimeSnapshotPath, {
    activations: [],
    loadedPlugins: [],
  })
  const gcSession = createPluginDomainSession({
    ...context,
    requestId: 'final-gc',
    environment: process.env,
  })
  const finalGc = await collectPluginCacheGarbage(gcSession, {
    delete: true,
  })
  assert.equal(finalGc.deleted.includes(installedPath), true)
  await assert.rejects(stat(installedPath), { code: 'ENOENT' })

  record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.derivedState.installed, false)
  assert.equal(record.candidates.length, 1)

  console.log('plugin lifecycle transaction smoke passed')
} finally {
  await rm(root, { recursive: true, force: true })
}

async function apply(core, plan) {
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

async function writePluginPackage() {
  const packageRoot = join(marketplaceRoot, 'packages', 'workflow-suite')
  await mkdir(join(packageRoot, '.claude-plugin'), { recursive: true })
  await writeJson(join(packageRoot, '.claude-plugin', 'plugin.json'), {
    name: 'workflow-suite',
    version: '1.0.0',
    userConfig: {
      endpoint: {
        type: 'string',
        title: 'Endpoint',
        description: 'Workflow service endpoint.',
        required: true,
      },
      apiToken: {
        type: 'string',
        title: 'API token',
        description: 'Workflow service access token.',
        required: true,
        sensitive: true,
      },
    },
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
          name: 'workflow-suite',
          version: '1.0.0',
          source: './packages/workflow-suite',
        },
      ],
    },
  )
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}
