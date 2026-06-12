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
import { CorePluginService } from '../dist/src/core/pluginCore.js'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-marketplace-'))
const workspace = join(root, 'workspace')
const home = join(root, 'home')
const marketplaceRoot = join(root, 'marketplace')
const managedSettingsPath = join(root, 'managed-settings.json')

await Promise.all([
  mkdir(workspace, { recursive: true }),
  mkdir(join(home, 'plugins'), { recursive: true }),
  mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
])

await writePluginPackage('foundation', {
  name: 'foundation',
  version: '1.0.0',
  description: 'Marketplace smoke dependency.',
})
await writePluginPackage('workflow-suite', {
  name: 'workflow-suite',
  version: '2.0.0',
  description: 'Plugin with Skill, MCP, configuration and App relations.',
  dependencies: ['foundation'],
  skills: './skills',
  mcpServers: {
    workflow: {
      type: 'stdio',
      command: process.execPath,
      args: ['--version'],
    },
  },
  userConfig: {
    endpoint: {
      type: 'string',
      title: '服务地址',
      description: '工作流服务入口。',
      required: true,
    },
    token: {
      type: 'string',
      title: '访问令牌',
      description: '访问工作流服务所需的令牌。',
      required: true,
      sensitive: true,
    },
  },
  ccr: {
    apps: [
      {
        id: 'github',
        displayName: 'GitHub',
        relation: 'requires',
        skillIds: ['review-follow-up'],
        mcpServerNames: ['workflow'],
      },
    ],
  },
})
await writeJson(join(marketplaceRoot, '.claude-plugin', 'marketplace.json'), {
  name: 'smoke-market',
  owner: { name: 'CCR smoke' },
  plugins: [
    marketplaceEntry('foundation', '1.0.0'),
    {
      ...marketplaceEntry('workflow-suite', '2.0.0', ['foundation']),
      skills: './skills',
      mcpServers: {
        workflow: {
          type: 'stdio',
          command: process.execPath,
          args: ['--version'],
        },
      },
      userConfig: {
        endpoint: {
          type: 'string',
          title: '服务地址',
          description: '工作流服务入口。',
          required: true,
        },
        token: {
          type: 'string',
          title: '访问令牌',
          description: '访问工作流服务所需的令牌。',
          required: true,
          sensitive: true,
        },
      },
      ccr: {
        apps: [
          {
            id: 'github',
            displayName: 'GitHub',
            relation: 'requires',
            skillIds: ['review-follow-up'],
            mcpServerNames: ['workflow'],
          },
        ],
      },
    },
  ],
})

const previousManagedSettings =
  process.env.CLAUDE_CODE_MANAGED_SETTINGS_FILE
process.env.CLAUDE_CODE_MANAGED_SETTINGS_FILE = managedSettingsPath

try {
  const context = {
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'marketplace-smoke',
  }
  const core = new CorePluginService()
  const source = { source: 'directory', path: marketplaceRoot }

  const added = await core.addMarketplace(
    { source, scope: 'user' },
    context,
  )
  assert.equal(added.name, 'smoke-market')
  assert.equal(added.alreadyPresent, false)
  assert.equal(added.installLocation, marketplaceRoot)

  const userSettings = await readJson(join(home, 'settings.json'))
  assert.deepEqual(
    userSettings.extraKnownMarketplaces['smoke-market'].source,
    source,
  )

  const addedAgain = await core.addMarketplace(
    { source, scope: 'project' },
    context,
  )
  assert.equal(addedAgain.alreadyPresent, true)
  const projectSettings = await readJson(
    join(workspace, '.ccr', 'settings.json'),
  )
  assert.equal(
    projectSettings.extraKnownMarketplaces['smoke-market']
      .installLocation,
    marketplaceRoot,
  )

  let marketplace = await core.listMarketplaces(context)
  assert.equal(marketplace.sources.length, 1)
  assert.equal(marketplace.sources[0].state, 'available')
  assert.deepEqual(
    marketplace.sources[0].declaredScopes.sort(),
    ['project', 'user'],
  )
  assert.equal(marketplace.candidates.length, 2)

  const catalog = await core.listCatalog(context)
  const candidate = catalog.plugins.find(
    plugin => plugin.pluginId === 'workflow-suite@smoke-market',
  )
  assert.ok(candidate)
  assert.equal(candidate.appRelations[0].appId, 'github')
  assert.equal(
    candidate.dependencies.directDependencies[0],
    'foundation@smoke-market',
  )

  const plan = await core.plan(
    {
      action: 'install',
      target: {
        pluginId: 'workflow-suite@smoke-market',
        scope: 'user',
        sourceId: 'smoke-market',
        version: '2.0.0',
      },
      installOptions: { enableAfterInstall: false },
    },
    context,
  )
  assert.equal(plan.allowed, true)
  assert.equal(plan.install.enableAfterInstall, false)
  assert.deepEqual(
    plan.install.packages.map(item => item.pluginId),
    ['foundation@smoke-market', 'workflow-suite@smoke-market'],
  )
  assert.equal(plan.dependencies.required.length, 1)
  assert.equal(
    plan.effects.some(effect => effect.kind === 'write-intent'),
    false,
  )
  assert.equal(
    plan.install.packages.at(-1).manifest.userConfig.token.sensitive,
    true,
  )
  assert.equal(
    plan.install.packages.at(-1).manifest.ccr.apps[0].id,
    'github',
  )

  const operation = await core.apply({
    planId: plan.planId,
    confirmed: true,
    confirmationToken: plan.confirmation.token,
  })
  const completed = await core
    .getActionServiceForTests()
    .waitForOperationForTests(operation.operationId)
  assert.equal(completed.status, 'succeeded')
  assert.equal(completed.phase, 'completed')

  const registry = await readJson(
    join(home, 'plugins', 'installed_plugins.json'),
  )
  const installed =
    registry.plugins['workflow-suite@smoke-market'][0]
  await stat(installed.installPath)
  assert.equal(
    (await readJson(join(home, 'settings.json'))).enabledPlugins,
    undefined,
  )

  await assert.rejects(
    core.removeMarketplace(
      { name: 'smoke-market', confirmed: false },
      context,
    ),
    error => error.code === 'plugin-marketplace-confirmation-required',
  )
  assert.equal(
    Object.hasOwn(
      await readJson(join(home, 'plugins', 'known_marketplaces.json')),
      'smoke-market',
    ),
    true,
  )

  await core.refreshMarketplace('smoke-market', context)
  marketplace = await core.listMarketplaces(context)
  assert.equal(marketplace.sources[0].candidateCount, 2)

  await core.removeMarketplace(
    { name: 'smoke-market', confirmed: true },
    context,
  )
  assert.deepEqual(
    await readJson(join(home, 'plugins', 'known_marketplaces.json')),
    {},
  )
  assert.equal(
    (await readJson(join(home, 'settings.json'))).extraKnownMarketplaces,
    undefined,
  )
  assert.equal(
    (await readJson(join(workspace, '.ccr', 'settings.json')))
      .extraKnownMarketplaces,
    undefined,
  )
  await stat(installed.installPath)

  const offlineCatalog = await core.listCatalog(context)
  const offlineInstalled = offlineCatalog.plugins.find(
    plugin => plugin.pluginId === 'workflow-suite@smoke-market',
  )
  assert.ok(offlineInstalled)
  assert.equal(offlineInstalled.derivedState.installed, true)
  assert.equal(
    offlineInstalled.candidates.some(item => item.sourceKind === 'marketplace'),
    false,
  )

  const isolatedHome = join(root, 'isolated-home')
  const isolatedCatalog = await core.listCatalog({
    ...context,
    configHomeDir: isolatedHome,
    runtimeInstanceId: 'marketplace-isolated',
  })
  assert.equal(isolatedCatalog.plugins.length, 0)

  await writeJson(managedSettingsPath, {
    blockedMarketplaces: [source],
  })
  await assert.rejects(
    core.addMarketplace({ source, scope: 'user' }, context),
    error => error.code === 'plugin-marketplace-policy-blocked',
  )
  assert.deepEqual(
    await readJson(join(home, 'plugins', 'known_marketplaces.json')),
    {},
  )

  const corruptHome = join(root, 'corrupt-home')
  await writeJson(
    join(corruptHome, 'plugins', 'known_marketplaces.json'),
    {
      remote: {
        source: { source: 'url', url: 'https://example.test/marketplace.json' },
        installLocation: join(root, 'outside-cache'),
        lastUpdated: '2026-06-08T00:00:00.000Z',
      },
    },
  )
  await assert.rejects(
    core.removeMarketplace(
      { name: 'remote', confirmed: true },
      { ...context, configHomeDir: corruptHome },
    ),
    error => error.code === 'plugin-marketplace-cache-outside-root',
  )
  assert.equal(
    Object.hasOwn(
      await readJson(
        join(corruptHome, 'plugins', 'known_marketplaces.json'),
      ),
      'remote',
    ),
    true,
  )

  console.log('plugin marketplace service smoke passed')
} finally {
  if (previousManagedSettings === undefined) {
    delete process.env.CLAUDE_CODE_MANAGED_SETTINGS_FILE
  } else {
    process.env.CLAUDE_CODE_MANAGED_SETTINGS_FILE =
      previousManagedSettings
  }
}

function marketplaceEntry(name, version, dependencies = []) {
  return {
    name,
    version,
    source: `./packages/${name}`,
    ...(dependencies.length > 0 ? { dependencies } : {}),
  }
}

async function writePluginPackage(name, manifest) {
  const packageRoot = join(marketplaceRoot, 'packages', name)
  await Promise.all([
    mkdir(join(packageRoot, '.claude-plugin'), { recursive: true }),
    mkdir(join(packageRoot, 'skills', 'review-follow-up'), {
      recursive: true,
    }),
  ])
  await writeJson(
    join(packageRoot, '.claude-plugin', 'plugin.json'),
    manifest,
  )
  await writeFile(
    join(packageRoot, 'skills', 'review-follow-up', 'SKILL.md'),
    '# Review follow-up\n',
    'utf8',
  )
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}
