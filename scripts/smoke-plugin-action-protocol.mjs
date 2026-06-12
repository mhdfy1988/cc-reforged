import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-action-'))
const home = join(root, 'home')
const workspace = join(root, 'workspace')
const packagePath = join(home, 'plugins', 'cache', 'market', 'demo', '1.0.0')
process.env.CCR_CONFIG_DIR = home

try {
  await mkdir(join(packagePath, '.claude-plugin'), { recursive: true })
  await mkdir(join(workspace, '.ccr'), { recursive: true })
  await writeJson(join(packagePath, '.claude-plugin', 'plugin.json'), {
    name: 'demo',
    version: '1.0.0',
    description: 'Plugin protocol smoke fixture',
  })
  await writeSettings(true)
  await writeRegistry()

  const { enableConfigs } = await importDist('src/utils/config.js')
  enableConfigs()
  const { createCcrCore } = await importDist('src/core/ccrCore.js')
  const { createPluginDomainSession } = await importDist(
    'src/services/plugins/pluginDomainSession.js',
  )
  const { PluginActionService } = await importDist(
    'src/services/plugins/pluginActionService.js',
  )
  const { createAppServerContext, handleJsonRpcMessage } = await importDist(
    'src/app-server/router.js',
  )

  const executed = []
  const core = createCcrCore({
    pluginActionExecutor: async execution => {
      executed.push({
        target: execution.plan.target,
        configHomeDir: execution.session.context.configHomeDir,
        workspaceRoot: execution.session.context.workspaceRoot,
      })
      execution.update({
        phase: 'committing',
        commitBoundaryReached: true,
      })
      return { applied: true, pluginId: execution.plan.target.pluginId }
    },
  })
  const context = {
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'protocol-smoke',
    requestId: 'plan-request',
  }

  const catalog = await core.plugins.listCatalog(context)
  assert.equal(catalog.plugins.length, 1)
  assert.equal(catalog.plugins[0].pluginId, 'demo@market')
  const inspection = await core.plugins.inspect('demo@market', context)
  assert.equal(inspection.pluginId, 'demo@market')

  const managedPlan = await core.plugins.planAction(
    {
      action: 'uninstall',
      target: { pluginId: 'demo@market', scope: 'managed' },
    },
    context,
  )
  assert.equal(managedPlan.allowed, false)
  assert.match(managedPlan.blockedReason, /read-only/)

  const uninstallPlan = await core.plugins.planAction(
    {
      action: 'uninstall',
      target: { pluginId: 'demo@market', scope: 'user' },
      deleteOptions: { removeData: true, removeOptions: false },
    },
    context,
  )
  assert.equal(uninstallPlan.allowed, true)
  assert.equal(uninstallPlan.requiresConfirmation, true)
  assert.equal(
    uninstallPlan.effects.some(effect => effect.kind === 'remove-data'),
    true,
  )
  const originalPlanId = uninstallPlan.planId
  uninstallPlan.target.pluginId = 'tampered@market'

  await assert.rejects(
    core.plugins.applyAction({
      planId: originalPlanId,
      confirmed: true,
      confirmationToken: 'wrong-token',
    }),
    error => error.code === 'plugin-confirmation-invalid',
  )
  const operation = await core.plugins.applyAction({
    planId: originalPlanId,
    confirmed: true,
    confirmationToken: uninstallPlan.confirmation.token,
  })
  const completed = await core.plugins
    .getActionServiceForTests()
    .waitForOperationForTests(operation.operationId)
  assert.equal(completed.status, 'succeeded')
  assert.equal(completed.target.pluginId, 'demo@market')
  assert.equal(executed[0].target.pluginId, 'demo@market')
  assert.equal(executed[0].configHomeDir, home)
  assert.equal(executed[0].workspaceRoot, workspace)
  await assert.rejects(
    core.plugins.applyAction({
      planId: originalPlanId,
      confirmed: true,
      confirmationToken: uninstallPlan.confirmation.token,
    }),
    error => error.code === 'plugin-plan-consumed',
  )

  const stalePlan = await core.plugins.planAction(
    {
      action: 'disable',
      target: { pluginId: 'demo@market', scope: 'user' },
    },
    context,
  )
  assert.equal(stalePlan.allowed, true)
  await writeSettings(false)
  await assert.rejects(
    core.plugins.applyAction({ planId: stalePlan.planId }),
    error => error.code === 'plugin-plan-stale',
  )
  await writeSettings(true)

  let now = new Date('2026-06-08T00:00:00.000Z')
  const createSession = sessionContext =>
    createPluginDomainSession({
      ...sessionContext,
      environment: process.env,
    })
  const expiringService = new PluginActionService({
    createSession,
    now: () => now,
    planTtlMs: 1_000,
    executor: async () => ({ applied: true }),
  })
  const expiringSession = createSession(context)
  const expiringPlan = await expiringService.plan(
    {
      action: 'uninstall',
      target: { pluginId: 'demo@market', scope: 'user' },
    },
    expiringSession,
  )
  now = new Date('2026-06-08T00:00:02.000Z')
  await assert.rejects(
    expiringService.apply({
      planId: expiringPlan.planId,
      confirmed: true,
      confirmationToken: expiringPlan.confirmation.token,
    }),
    error => error.code === 'plugin-plan-expired',
  )

  const cancellableCore = createCcrCore({
    pluginActionExecutor: async execution => {
      await new Promise(resolve => setTimeout(resolve, 25))
      if (execution.isCancellationRequested()) return { cancelled: true }
      return { applied: true }
    },
  })
  const disablePlan = await cancellableCore.plugins.planAction(
    {
      action: 'disable',
      target: { pluginId: 'demo@market', scope: 'user' },
    },
    context,
  )
  const cancellableOperation = await cancellableCore.plugins.applyAction({
    planId: disablePlan.planId,
  })
  const cancelled = cancellableCore.plugins.cancelOperation(
    cancellableOperation.operationId,
  )
  assert.equal(cancelled.cancellationRequested, true)
  const cancelledFinal = await cancellableCore.plugins
    .getActionServiceForTests()
    .waitForOperationForTests(cancellableOperation.operationId)
  assert.equal(
    cancelledFinal.status,
    'cancelled',
  )

  const management = await core.capabilities.listManagement({
    cwd: workspace,
    workspaceRoot: workspace,
    configHomeDir: home,
    mcpRuntime: { clients: [], tools: [], commands: [], resources: {} },
    mcpConfig: { servers: [], errors: [] },
  })
  const pluginItem = management.plugins.find(
    item => item.source.pluginId === 'demo@market',
  )
  assert.equal(pluginItem.domainActionLink.planMethod, 'plugins/action/plan')
  assert.deepEqual(pluginItem.allowedActions, ['inspect'])

  const appContext = createAppServerContext()
  await rpc(appContext, handleJsonRpcMessage, 1, 'initialize', {})
  const appCatalog = await rpc(
    appContext,
    handleJsonRpcMessage,
    2,
    'plugins/catalog/list',
    {
      cwd: workspace,
      workspaceRoot: workspace,
      configHomeDir: home,
      runtimeInstanceId: 'app-server-smoke',
    },
  )
  assert.equal(appCatalog.plugins[0].pluginId, 'demo@market')
  const appInspection = await rpc(
    appContext,
    handleJsonRpcMessage,
    3,
    'plugins/inspect',
    {
      pluginId: 'demo@market',
      cwd: workspace,
      workspaceRoot: workspace,
      configHomeDir: home,
    },
  )
  assert.equal(appInspection.pluginId, 'demo@market')
  const appOperation = await rpc(
    appContext,
    handleJsonRpcMessage,
    4,
    'plugins/operation/get',
    {
      operationId: completed.operationId,
      cwd: workspace,
      workspaceRoot: workspace,
      configHomeDir: home,
    },
  )
  assert.equal(appOperation.operationId, completed.operationId)
  assert.equal(appOperation.status, 'succeeded')
  const invalidOperationGet = await handleJsonRpcMessage(appContext, {
    jsonrpc: '2.0',
    id: 5,
    method: 'plugins/operation/get',
    params: {
      cwd: workspace,
      workspaceRoot: workspace,
      configHomeDir: home,
    },
  })
  assert.equal(invalidOperationGet.error.data.kind, 'invalid_params')
  const invalidApply = await handleJsonRpcMessage(appContext, {
    jsonrpc: '2.0',
    id: 6,
    method: 'plugins/action/apply',
    params: {
      planId: 'plugin-plan:fake',
      target: { pluginId: 'tampered@market', scope: 'user' },
    },
  })
  assert.equal(invalidApply.error.data.kind, 'invalid_params')
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-plugin-action-protocol: ok')

async function writeSettings(enabled) {
  await writeJson(join(home, 'settings.json'), {
    enabledPlugins: { 'demo@market': enabled },
  })
}

async function writeRegistry() {
  await writeJson(join(home, 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'demo@market': [
        {
          scope: 'user',
          installPath: packagePath,
          version: '1.0.0',
          installedAt: '2026-06-08T00:00:00.000Z',
        },
      ],
    },
  })
}

async function writeJson(filePath, value) {
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function rpc(context, handle, id, method, params) {
  const response = await handle(context, {
    jsonrpc: '2.0',
    id,
    method,
    params,
  })
  assert.equal(response.error, undefined, JSON.stringify(response.error))
  return response.result
}
