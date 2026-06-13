import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createCcrCore } from '../dist/src/core/ccrCore.js'

const generated = spawnSync(
  process.execPath,
  ['./scripts/create-plugin-productization-acceptance-fixtures.mjs'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  },
)
assert.equal(generated.status, 0, generated.stderr)
const fixture = JSON.parse(generated.stdout)
const pluginId = 'workflow-suite@local'

try {
  const installedRoot = join(
    fixture.home,
    'plugins',
    'cache',
    'local',
    'workflow-suite',
    '1.0.0',
  )
  const manifest = JSON.parse(
    await readFile(
      join(installedRoot, '.claude-plugin', 'plugin.json'),
      'utf8',
    ),
  )
  await access(join(installedRoot, 'skills', 'review-follow-up', 'SKILL.md'))
  assert.deepEqual(manifest.dependencies, ['foundation'])
  assert.ok(manifest.mcpServers['workflow-tools'])
  assert.equal(manifest.userConfig.endpoint.sensitive, undefined)
  assert.equal(manifest.userConfig.apiToken.sensitive, true)
  assert.deepEqual(
    manifest.ccr.apps.map(item => item.relation),
    ['requires', 'suggests'],
  )

  const context = {
    workspaceRoot: fixture.workspace,
    currentCwd: fixture.workspace,
    configHomeDir: fixture.home,
    runtimeInstanceId: 'app-server',
  }
  const core = createCcrCore({
    pluginRuntimeHostAdapterFactory: () => ({
      runtimeInstanceId: 'app-server',
      async prepare() {
        return {
          plugins: [
            {
              pluginId,
              version: '1.0.0',
              components: ['skill', 'mcp'],
            },
          ],
          loadedPlugins: [],
          componentResults: [
            { pluginId, component: 'skill', state: 'active' },
            { pluginId, component: 'mcp', state: 'active' },
          ],
          payload: {},
        }
      },
      async commit(preparation) {
        return preparation.componentResults
      },
    }),
  })

  let record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.derivedState.installed, true)
  assert.equal(
    record.dependencies.directDependencies.includes('foundation@local'),
    true,
  )
  assert.equal(record.appRelations.length, 2)

  let configuration = await core.plugins.inspectConfiguration(
    { pluginId, scope: 'user' },
    context,
  )
  assert.equal(configuration.effectiveOptions.reviewMode, 'strict')
  assert.equal(configuration.secretStatus.configured, true)
  assert.equal(configuration.secretStatus.keyCount, 1)

  configuration = await core.plugins.saveConfiguration(
    {
      identity: { pluginId, scope: 'user' },
      values: {
        endpoint: 'http://127.0.0.1:5318',
        apiToken: '',
      },
    },
    context,
  )
  assert.equal(configuration.effectiveOptions.endpoint, 'http://127.0.0.1:5318')
  assert.equal(configuration.secretStatus.configured, true)

  await apply(
    core,
    await core.plugins.planAction(
      { action: 'disable', target: { pluginId, scope: 'user' } },
      context,
    ),
  )
  record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.effectiveSelection.enabled, false)
  assert.equal(record.effectiveSelection.active, false)

  await apply(
    core,
    await core.plugins.planAction(
      { action: 'enable', target: { pluginId, scope: 'user' } },
      context,
    ),
  )
  record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.effectiveSelection.enabled, true)
  assert.equal(record.effectiveSelection.active, true)

  const activation = await core.plugins.activateRuntime(context)
  assert.equal(activation.state, 'active')
  assert.equal(
    activation.snapshot.activations[0].activeVersion,
    '1.0.0',
  )

  await apply(
    core,
    await core.plugins.planAction(
      {
        action: 'update',
        target: {
          pluginId,
          scope: 'user',
          sourceId: 'local',
          version: '2.0.0',
        },
      },
      context,
    ),
  )
  record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.installations[0].installedVersion, '2.0.0')
  assert.equal(record.runtimeActivations[0].activeVersion, '1.0.0')

  await apply(
    core,
    await core.plugins.planAction(
      {
        action: 'rollback',
        target: {
          pluginId,
          scope: 'user',
          version: '0.9.0',
        },
      },
      context,
    ),
  )
  record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.installations[0].installedVersion, '0.9.0')

  await apply(
    core,
    await core.plugins.planAction(
      { action: 'uninstall', target: { pluginId, scope: 'user' } },
      context,
    ),
  )
  record = await core.plugins.inspect(pluginId, context)
  assert.equal(record.derivedState.installed, false)
  assert.equal(record.candidates.length, 1)
  assert.equal(
    (
      await core.plugins.inspectConfiguration(
        { pluginId, scope: 'user' },
        context,
      )
    ).secretStatus.configured,
    true,
    'uninstall preserves secrets unless the user explicitly removes them',
  )

  console.log('plugin productization sample smoke passed')
} finally {
  await rm(fixture.root, { recursive: true, force: true })
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
