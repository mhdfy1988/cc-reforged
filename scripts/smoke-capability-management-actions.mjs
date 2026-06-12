import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  canApplyCapabilityManagementAction,
  createCapabilityManagementActionPlan,
} from '../dist/src/services/capabilities/managementActionService.js'
import { createCapabilityManagementProjection } from '../dist/src/services/capabilities/managementProjectionService.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const clientModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/app-server/client/index.js')).href
)

smokePureActionPlanning()
await smokeAppServerActionApply()

console.log('smoke-capability-management-actions: ok')

function smokePureActionPlanning() {
  const projection = createCapabilityManagementProjection({
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    capabilities: [
      capability({
        id: 'skill:managed',
        kind: 'skill',
        name: 'managed',
        relations: { installedRef: 'user:managed' },
        state: { installed: true },
      }),
      capability({
        id: 'skill:runtime-only',
        kind: 'skill',
        name: 'runtime-only',
        state: { installed: false },
      }),
      capability({
        id: 'mcp-server:manual',
        kind: 'mcp-server',
        name: 'manual',
        metadata: { installKind: 'manual-config', scope: 'user' },
        state: { installed: false, configured: true },
      }),
      capability({
        id: 'mcp-server:project-manual',
        kind: 'mcp-server',
        name: 'project-manual',
        metadata: { installKind: 'manual-config', scope: 'project' },
        state: { installed: false, configured: true },
      }),
      capability({
        id: 'mcp-server:installed-manual-shape',
        kind: 'mcp-server',
        name: 'installed-manual-shape',
        relations: { installedRef: 'installed-manual-shape' },
        metadata: { installKind: 'manual-config' },
        state: { installed: true, configured: true },
      }),
      capability({
        id: 'mcp-server:installed-missing-config',
        kind: 'mcp-server',
        name: 'installed-missing-config',
        relations: { installedRef: 'installed-missing-config' },
        metadata: { installKind: 'manual-config', configured: false },
        state: { installed: true, configured: false, enabled: false },
      }),
      capability({
        id: 'mcp-server:runtime-only',
        kind: 'mcp-server',
        name: 'runtime-only',
        state: {
          installed: false,
          configured: false,
          runtimeConnected: true,
        },
      }),
      capability({
        id: 'plugin:bundle',
        kind: 'plugin',
        name: 'bundle',
        source: { kind: 'plugin', label: 'plugin', pluginId: 'bundle' },
        state: { installed: true },
      }),
      capability({
        id: 'mcp-server:plugin-owned',
        kind: 'mcp-server',
        name: 'plugin-owned',
        relations: { parentPluginId: 'bundle' },
        state: { installed: true, configured: true },
      }),
    ],
    diagnostics: [],
    summary: {
      total: 4,
      runtimeVisible: 4,
      byKind: {},
      bySourceKind: {},
      byStatus: {},
    },
  })

  const runtimeRepair = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'skill:runtime-only',
    action: 'repair',
  })
  assert.equal(runtimeRepair.allowed, false)
  assert.match(runtimeRepair.blockedReason, /not allowed/)

  const refMismatch = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'skill:managed',
    action: 'disable',
    actionRef: 'user:other',
  })
  assert.equal(refMismatch.allowed, false)
  assert.match(refMismatch.blockedReason, /reference/)

  const uninstall = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'skill:managed',
    action: 'uninstall',
    actionRef: 'user:managed',
  })
  assert.equal(uninstall.allowed, true)
  assert.equal(uninstall.requiresConfirmation, true)
  assert.ok(uninstall.confirmation?.token)

  const missingConfirmation = canApplyCapabilityManagementAction(uninstall, {
    capabilityId: 'skill:managed',
    action: 'uninstall',
    actionRef: 'user:managed',
  })
  assert.equal(missingConfirmation.ok, false)

  const manualUninstall = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'mcp-server:manual',
    action: 'uninstall',
    actionRef: 'manual',
  })
  assert.equal(manualUninstall.allowed, true)
  assert.equal(manualUninstall.requiresConfirmation, true)
  assert.ok(manualUninstall.confirmation?.token)

  const projectManualUninstall = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'mcp-server:project-manual',
    action: 'uninstall',
    actionRef: 'project-manual',
  })
  assert.equal(projectManualUninstall.allowed, false)
  assert.match(projectManualUninstall.blockedReason, /not allowed/)

  const installedManualShape = projection.mcp.find(
    item => item.name === 'installed-manual-shape',
  )
  assert.ok(installedManualShape)
  assert.equal(installedManualShape.managementOwnership, 'installer-owned')
  assert.ok(installedManualShape.allowedActions.includes('repair'))
  assert.ok(installedManualShape.allowedActions.includes('uninstall'))

  const installedMissingConfig = projection.mcp.find(
    item => item.name === 'installed-missing-config',
  )
  assert.ok(installedMissingConfig)
  assert.equal(installedMissingConfig.managementOwnership, 'installer-owned')
  assert.deepEqual(installedMissingConfig.allowedActions, [
    'inspect',
    'repair',
    'uninstall',
  ])

  const runtimeDisable = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'mcp-server:runtime-only',
    action: 'disable',
    actionRef: 'runtime-only',
  })
  assert.equal(runtimeDisable.allowed, false)

  const pluginDisable = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'mcp-server:plugin-owned',
    action: 'disable',
    actionRef: 'plugin-owned',
  })
  assert.equal(pluginDisable.allowed, false)

  const pluginInspect = createCapabilityManagementActionPlan(projection, {
    capabilityId: 'plugin:bundle',
    action: 'inspect',
  })
  assert.equal(pluginInspect.allowed, true)
  assert.equal(pluginInspect.requiresConfirmation, false)
}

async function smokeAppServerActionApply() {
  const { startManagedStdioAppServerClient } = clientModule
  const root = await mkdtemp(join(tmpdir(), 'ccr-capability-actions-'))
  const configHome = join(root, 'ccr-home')
  const sourceSkill = join(root, 'action-source-skill')

  try {
    await mkdir(sourceSkill, { recursive: true })
    await writeFile(
      join(sourceSkill, 'SKILL.md'),
      `---\nname: action-demo\ndescription: Capability action demo.\n---\n\nUse this skill for capability action smoke.\n`,
      'utf8',
    )

    const managed = startManagedStdioAppServerClient({
      defaultTimeoutMs: 20_000,
      process: {
        command: process.execPath,
        args: ['cli.js', 'app-server', '--listen', 'stdio'],
        cwd: repoRoot,
        env: {
          ...process.env,
          CCR_CONFIG_DIR: configHome,
          CLAUDE_CONFIG_DIR: configHome,
          DISABLE_TELEMETRY: '1',
          DISABLE_ERROR_REPORTING: '1',
          NODE_ENV: 'test',
          NO_COLOR: '1',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? 'test-api-key',
        },
      },
    })

    try {
      await managed.client.initialize({
        clientInfo: {
          name: 'smoke-capability-management-actions',
          title: 'CCR Capability Management Action Smoke',
        },
        capabilities: {
          mcpManagement: true,
        },
      })

      const importPlan = await managed.client.planSkillImport({
        source: {
          kind: 'local-skill-dir',
          path: sourceSkill,
        },
      })
      assert.equal(importPlan.importable, true)
      await managed.client.applySkillImport({
        source: importPlan.source,
        confirmed: true,
        confirmationToken: importPlan.confirmation.token,
      })

      const search = await managed.client.searchSkillInstalls({
        query: 'action-demo',
      })
      const candidate = search.candidates.find(
        item => item.manifestInput?.name === 'action-demo',
      )
      assert.ok(candidate)
      const installPlan = await managed.client.planSkillInstall({
        manifest: candidate.manifestInput,
      })
      assert.equal(installPlan.installable, true)
      await managed.client.applySkillInstall({
        manifest: candidate.manifestInput,
        confirmed: true,
        confirmationToken: installPlan.confirmation.token,
      })

      const before = await managed.client.listCapabilityManagement({
        cwd: repoRoot,
      })
      const skill = before.skills.find(item => item.name === 'action-demo')
      assert.ok(skill)
      assert.ok(skill.actionRef)

      const disabled = await managed.client.applyCapabilityManagementAction({
        cwd: repoRoot,
        capabilityId: skill.capabilityId,
        action: 'disable',
        actionRef: skill.actionRef,
      })
      assert.equal(disabled.applied, true)
      assert.equal(
        disabled.management.skills.find(item => item.name === 'action-demo')
          ?.state.enabled,
        false,
      )

      const invocation = await managed.client.applyCapabilityManagementAction({
        cwd: repoRoot,
        capabilityId: skill.capabilityId,
        action: 'set-model-invocation',
        actionRef: skill.actionRef,
        params: { modelInvocable: false },
      })
      assert.equal(
        invocation.management.skills.find(item => item.name === 'action-demo')
          ?.invocation.modelInvocable,
        false,
      )

      const uninstallPlan = await managed.client.planCapabilityManagementAction({
        cwd: repoRoot,
        capabilityId: skill.capabilityId,
        action: 'uninstall',
        actionRef: skill.actionRef,
      })
      assert.equal(uninstallPlan.allowed, true)
      assert.equal(uninstallPlan.requiresConfirmation, true)
      await assert.rejects(
        () =>
          managed.client.applyCapabilityManagementAction({
            cwd: repoRoot,
            capabilityId: skill.capabilityId,
            action: 'uninstall',
            actionRef: skill.actionRef,
          }),
        /requires explicit confirmation/,
      )

      await managed.client.addMcp({
        name: 'action_mcp',
        scope: 'user',
        config: {
          type: 'stdio',
          command: 'manual-action-mcp',
          args: ['--stdio'],
        },
      })
      const withMcp = await managed.client.listCapabilityManagement({
        cwd: repoRoot,
      })
      const mcp = withMcp.mcp.find(
        item => item.kind === 'mcp-server' && item.name === 'action_mcp',
      )
      assert.ok(mcp)
      assert.equal(mcp.managementOwnership, 'manual-config')

      const restarted = await managed.client.applyCapabilityManagementAction({
        cwd: repoRoot,
        capabilityId: mcp.capabilityId,
        action: 'restart',
        actionRef: mcp.actionRef,
      })
      assert.equal(restarted.applied, true)
      assert.equal(restarted.result.state, 'restart_pending_runtime')

      const mcpDisabled = await managed.client.applyCapabilityManagementAction({
        cwd: repoRoot,
        capabilityId: mcp.capabilityId,
        action: 'disable',
        actionRef: mcp.actionRef,
      })
      assert.equal(
        mcpDisabled.management.mcp.find(item => item.name === 'action_mcp')
          ?.state.enabled,
        false,
      )
      const disabledMcpActionView = mcpDisabled.management.mcp.find(
        item => item.name === 'action_mcp',
      )
      assert.ok(disabledMcpActionView)
      assert.ok(disabledMcpActionView.allowedActions.includes('enable'))
      assert.ok(disabledMcpActionView.allowedActions.includes('uninstall'))
      assert.equal(disabledMcpActionView.allowedActions.includes('disable'), false)

      const manualUninstallPlan =
        await managed.client.planCapabilityManagementAction({
          cwd: repoRoot,
          capabilityId: disabledMcpActionView.capabilityId,
          action: 'uninstall',
          actionRef: disabledMcpActionView.actionRef,
        })
      assert.equal(manualUninstallPlan.allowed, true)
      assert.equal(manualUninstallPlan.requiresConfirmation, true)
      const manualRemoved = await managed.client.applyCapabilityManagementAction({
        cwd: repoRoot,
        capabilityId: disabledMcpActionView.capabilityId,
        action: 'uninstall',
        actionRef: disabledMcpActionView.actionRef,
        confirmed: true,
        confirmationToken: manualUninstallPlan.confirmation.token,
      })
      assert.equal(manualRemoved.result.removed, true)
      assert.equal(
        manualRemoved.management.mcp.some(
          item => item.kind === 'mcp-server' && item.name === 'action_mcp',
        ),
        false,
      )
    } finally {
      await managed.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function capability(input) {
  const state = input.state ?? {}
  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    displayName: input.name,
    description: `${input.name} fixture`,
    kind: input.kind,
    source: input.source ?? { kind: 'mcp', label: 'fixture' },
    state: {
      installed: false,
      enabled: true,
      available: true,
      runtimeVisible: true,
      status: 'available',
      ...state,
    },
    invocation: {
      modelInvocable: input.kind === 'skill',
      userInvocable: input.kind === 'skill',
      toolInvocable: input.kind === 'mcp-tool',
    },
    relations: input.relations ?? {},
    diagnostics: [],
    ...(input.metadata ? { metadata: input.metadata } : {}),
  }
}
