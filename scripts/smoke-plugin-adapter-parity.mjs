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
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-adapter-'))
const home = join(root, 'home')
const workspace = join(root, 'workspace')
const marketplaceRoot = join(root, 'marketplace')
const pluginId = 'adapter-demo@local'
const previousCwd = process.cwd()
process.env.CCR_CONFIG_DIR = home

try {
  await Promise.all([
    mkdir(workspace, { recursive: true }),
    mkdir(join(home, 'plugins'), { recursive: true }),
    mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
  ])
  await writeFixture()
  process.chdir(workspace)

  const { createCcrCore } = await importDist('src/core/ccrCore.js')
  const { PluginDomainAdapter } = await importDist(
    'src/services/plugins/pluginDomainAdapter.js',
  )
  const operations = await importDist(
    'src/services/plugins/pluginOperations.js',
  )

  const context = {
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'adapter-parity',
  }
  const core = createCcrCore()
  const adapter = new PluginDomainAdapter({
    core,
    contextFactory: () => context,
  })
  const corePlan = await core.plugins.planAction(
    {
      action: 'install',
      target: { pluginId, scope: 'user' },
      installOptions: { enableAfterInstall: true },
    },
    context,
  )
  const adapterPlan = await adapter.planAction({
    action: 'install',
    plugin: pluginId,
    scope: 'user',
    enableAfterInstall: true,
  })
  assert.deepEqual(planContract(adapterPlan), planContract(corePlan))

  const installed = await operations.installPluginOp(pluginId, 'user')
  assert.equal(installed.success, true, installed.message)
  assert.equal(
    (await readJson(join(home, 'settings.json'))).enabledPlugins[pluginId],
    true,
  )
  let registry = await readJson(
    join(home, 'plugins', 'installed_plugins.json'),
  )
  assert.equal(registry.version, 2)
  assert.equal(registry.plugins[pluginId][0].scope, 'user')

  const disabled = await operations.disablePluginOp(pluginId, 'user')
  assert.equal(disabled.success, true, disabled.message)
  assert.equal(
    (await readJson(join(home, 'settings.json'))).enabledPlugins[pluginId],
    false,
  )
  const enabled = await operations.enablePluginOp(pluginId, 'user')
  assert.equal(enabled.success, true, enabled.message)

  const update = await operations.updatePluginOp(pluginId, 'user')
  assert.equal(update.success, true, update.message)
  assert.equal(update.alreadyUpToDate, true)
  const managedUpdate = await operations.updatePluginOp(
    pluginId,
    'managed',
  )
  assert.equal(managedUpdate.success, false)
  assert.match(managedUpdate.message, /read-only/)

  const uninstalled = await operations.uninstallPluginOp(
    pluginId,
    'user',
    false,
  )
  assert.equal(uninstalled.success, true, uninstalled.message)
  registry = await readJson(join(home, 'plugins', 'installed_plugins.json'))
  assert.equal(Object.hasOwn(registry.plugins, pluginId), false)
} finally {
  process.chdir(previousCwd)
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-plugin-adapter-parity: ok')

function planContract(plan) {
  return {
    allowed: plan.allowed,
    action: plan.action,
    target: plan.target,
    dependencies: plan.dependencies,
    install: plan.install,
    effects: plan.effects,
    risks: plan.risks,
    deleteOptions: plan.deleteOptions,
    requiresConfirmation: plan.requiresConfirmation,
  }
}

async function writeFixture() {
  const packageRoot = join(
    marketplaceRoot,
    'packages',
    'adapter-demo',
  )
  await mkdir(join(packageRoot, '.claude-plugin'), { recursive: true })
  await writeJson(join(packageRoot, '.claude-plugin', 'plugin.json'), {
    name: 'adapter-demo',
    version: '1.0.0',
    description: 'Plugin adapter parity fixture.',
  })
  await writeJson(
    join(marketplaceRoot, '.claude-plugin', 'marketplace.json'),
    {
      name: 'local',
      owner: { name: 'CCR smoke' },
      plugins: [
        {
          name: 'adapter-demo',
          version: '1.0.0',
          source: './packages/adapter-demo',
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
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}
