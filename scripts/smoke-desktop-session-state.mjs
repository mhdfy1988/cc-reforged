import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = join(repoRoot, '.tmp', 'smoke-desktop-session-state')
const entryPath = join(tempDir, 'entry.ts')
const outputPath = join(tempDir, 'entry.mjs')

await rm(tempDir, { recursive: true, force: true })
await mkdir(tempDir, { recursive: true })

await writeFile(
  entryPath,
  `
    import assert from 'node:assert/strict'
    import { routeDesktopEvent } from '../../apps/desktop/src/renderer/src/app/notificationRouter.ts'
    import { sessionReducer } from '../../apps/desktop/src/renderer/src/app/sessionState.ts'
    import { createDisplayEventFromCompletedItem } from '../../apps/desktop/src/renderer/src/domain/displayEvents.ts'

    const identity = {
      itemId: 'tool-running',
      threadId: 'thread-1',
      turnId: 'turn-1',
      contentIndex: 0,
      toolUseId: 'toolu-running',
      missingFields: [],
      raw: {},
    }

    const runningTool = {
      id: 'tool-running',
      type: 'tool_call',
      text: '运行命令：Start-Sleep 30',
      status: 'running',
      identity,
      toolSnapshot: {
        id: 'tool-running',
        kind: 'call',
        name: 'PowerShell',
        displayName: 'PowerShell',
        category: 'shell',
        status: 'running',
        statusLabel: '执行中',
        summary: '运行命令：Start-Sleep 30',
        identity,
        command: 'Start-Sleep 30',
        shell: 'powershell',
        input: { command: 'Start-Sleep 30' },
        raw: {
          type: 'tool_use',
          id: 'toolu-running',
          name: 'PowerShell',
          input: { command: 'Start-Sleep 30' },
        },
      },
    }

    const otherTurnIdentity = {
      ...identity,
      itemId: 'tool-other-turn',
      turnId: 'turn-2',
      toolUseId: 'toolu-other-turn',
    }
    const otherTurnRunningTool = {
      ...runningTool,
      id: 'tool-other-turn',
      identity: otherTurnIdentity,
      toolSnapshot: {
        ...runningTool.toolSnapshot,
        id: 'tool-other-turn',
        identity: otherTurnIdentity,
      },
    }

    const completedTool = {
      ...runningTool,
      id: 'tool-completed',
      status: 'completed',
      identity: { ...identity, itemId: 'tool-completed', toolUseId: 'toolu-completed' },
      toolSnapshot: {
        ...runningTool.toolSnapshot,
        id: 'tool-completed',
        status: 'completed',
        statusLabel: '成功',
        identity: { ...identity, itemId: 'tool-completed', toolUseId: 'toolu-completed' },
      },
    }

    const cancelled = sessionReducer(
      {
        displayEvents: [runningTool, otherTurnRunningTool, completedTool],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'merge-turn-metadata',
        metadata: { threadId: 'thread-1', turnId: 'turn-1', status: 'cancelled' },
      },
    )

    const interruptedTool = cancelled.displayEvents.find(event => event.id === 'tool-running')
    assert.equal(interruptedTool.status, 'interrupted')
    assert.equal(interruptedTool.toolSnapshot.status, 'interrupted')
    assert.equal(interruptedTool.toolSnapshot.statusLabel, '已中断')
    assert.equal(
      cancelled.displayEvents.find(event => event.id === 'tool-other-turn').toolSnapshot.status,
      'running',
    )
    assert.equal(
      cancelled.displayEvents.find(event => event.id === 'tool-completed').toolSnapshot.status,
      'completed',
    )

    const failed = sessionReducer(
      {
        displayEvents: [runningTool],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'merge-turn-metadata',
        metadata: { threadId: 'thread-1', turnId: 'turn-1', status: 'failed' },
      },
    )

    const failedTool = failed.displayEvents[0]
    assert.equal(failedTool.status, 'failed')
    assert.equal(failedTool.toolSnapshot.status, 'failed')
    assert.equal(failedTool.toolSnapshot.statusLabel, '失败')
    assert.equal(failedTool.toolSnapshot.errorClass, 'unknown_failure')

    const historyTool = createDisplayEventFromCompletedItem(
      'history-tool',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'toolu-history',
          name: 'PowerShell',
          input: { command: 'Start-Sleep -Seconds 30' },
          status: 'interrupted',
          historyStatus: 'interrupted',
        },
      ],
      'completed',
      {
        itemId: 'history-tool',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-1' },
      },
    )
    assert.equal(historyTool.toolSnapshot.status, 'interrupted')
    assert.equal(historyTool.toolSnapshot.statusLabel, '已中断')

    const planMessage = createDisplayEventFromCompletedItem(
      'plan-message',
      'assistant_message',
      [{ type: 'text', text: '计划已生成。' }],
      'completed',
      {
        itemId: 'plan-message',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-1' },
      },
    )
    const exitPlanCall = createDisplayEventFromCompletedItem(
      'plan-exit-call',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'call_00_exit_plan_anchor',
          name: 'ExitPlanMode',
          input: { plan: '实施计划' },
        },
      ],
      'completed',
      {
        itemId: 'plan-exit-call',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-1' },
      },
    )
    const anchoredPermissionState = sessionReducer(
      {
        displayEvents: [planMessage, exitPlanCall],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'add-permission',
        permission: {
          permissionRequestId: 'perm-exit-plan',
          threadId: 'thread-1',
          turnId: 'turn-1',
          toolName: 'ExitPlanMode',
          interactionKind: 'plan_approval',
          input: { plan: '实施计划' },
          status: 'pending',
        },
      },
    )
    assert.equal(
      anchoredPermissionState.permissions[0].toolUseId,
      'call_00_exit_plan_anchor',
      'plan approval permission should recover toolUseId from latest matching tool_call',
    )
    const waitingExitCall = anchoredPermissionState.displayEvents.find(
      event => event.id === 'plan-exit-call',
    )
    assert.equal(waitingExitCall?.status, 'waiting_permission')
    assert.equal(
      waitingExitCall?.toolSnapshot?.permissionRequestId,
      'perm-exit-plan',
    )

    const planDraftWriteCall = createDisplayEventFromCompletedItem(
      'plan-draft-write-call',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'toolu-plan-draft-write',
          name: 'Write',
          input: {
            file_path: 'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\delegated-prancing-rivest.md',
            content: '计划内容',
          },
        },
      ],
      'completed',
      {
        itemId: 'plan-draft-write-call',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-1' },
      },
    )
    assert.equal(
      planDraftWriteCall?.timelineHidden,
      true,
      'internal .ccr/plans draft write should be hidden from the main timeline',
    )

    const planDraftWriteCompleted = sessionReducer(
      {
        displayEvents: [planDraftWriteCall],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'upsert-completed-item-message',
        itemId: 'plan-draft-write-result',
        kind: 'user_message',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-plan-draft-write',
            content: '已写入',
          },
        ],
        statusText: 'completed',
      },
    )
    assert.equal(
      planDraftWriteCompleted.displayEvents[0]?.timelineHidden,
      true,
      'successful internal plan draft write should stay hidden after result merge',
    )

    const planDraftPermissionState = sessionReducer(
      {
        displayEvents: [planDraftWriteCall],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'add-permission',
        permission: {
          permissionRequestId: 'perm-exit-plan-draft',
          threadId: 'thread-1',
          turnId: 'turn-1',
          toolName: 'ExitPlanMode',
          interactionKind: 'plan_approval',
          input: { plan: '实施计划' },
          status: 'pending',
        },
      },
    )
    assert.equal(
      planDraftPermissionState.permissions[0].input.internalPlanDraftPath,
      'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\delegated-prancing-rivest.md',
      'plan approval permission should expose hidden internal plan draft path',
    )
    assert.equal(
      planDraftPermissionState.permissions[0].input.internalPlanDraftStatus,
      'completed',
      'plan approval permission should expose hidden internal plan draft status',
    )
    assert.equal(
      planDraftPermissionState.permissions[0].input.internalPlanSeriesId,
      'delegated-prancing-rivest',
      'plan approval permission should expose the plan series id derived from the internal draft path',
    )

    const firstPlanDraftWriteCall = createDisplayEventFromCompletedItem(
      'plan-draft-write-call-one',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'toolu-plan-draft-write-one',
          name: 'Write',
          input: {
            file_path: 'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\plan-one.md',
            content: '计划一',
          },
        },
      ],
      'completed',
      {
        itemId: 'plan-draft-write-call-one',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-2' },
      },
    )
    const firstExitPlanCall = createDisplayEventFromCompletedItem(
      'plan-exit-call-one',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'toolu-exit-plan-one',
          name: 'ExitPlanMode',
          input: { plan: '计划一' },
        },
      ],
      'completed',
      {
        itemId: 'plan-exit-call-one',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-2' },
      },
    )
    const secondPlanDraftWriteCall = createDisplayEventFromCompletedItem(
      'plan-draft-write-call-two',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'toolu-plan-draft-write-two',
          name: 'Write',
          input: {
            file_path: 'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\plan-two.md',
            content: '计划二',
          },
        },
      ],
      'completed',
      {
        itemId: 'plan-draft-write-call-two',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-2' },
      },
    )
    const secondExitPlanCall = createDisplayEventFromCompletedItem(
      'plan-exit-call-two',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'toolu-exit-plan-two',
          name: 'ExitPlanMode',
          input: { plan: '计划二' },
        },
      ],
      'completed',
      {
        itemId: 'plan-exit-call-two',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-2' },
      },
    )
    const twoPlanPermissionState = sessionReducer(
      {
        displayEvents: [
          firstPlanDraftWriteCall,
          firstExitPlanCall,
          secondPlanDraftWriteCall,
          secondExitPlanCall,
        ],
        permissions: [
          {
            permissionRequestId: 'perm-plan-one',
            threadId: 'thread-1',
            turnId: 'turn-2',
            toolUseId: 'toolu-exit-plan-one',
            toolName: 'ExitPlanMode',
            interactionKind: 'plan_approval',
            input: { plan: '计划一' },
            status: 'pending',
          },
        ],
        activeTurnId: 'turn-2',
        turnMetadata: null,
      },
      {
        type: 'add-permission',
        permission: {
          permissionRequestId: 'perm-plan-two',
          threadId: 'thread-1',
          turnId: 'turn-2',
          toolName: 'ExitPlanMode',
          interactionKind: 'plan_approval',
          input: { plan: '计划二' },
          status: 'pending',
        },
      },
    )
    const firstPlanPermission = twoPlanPermissionState.permissions.find(
      permission => permission.permissionRequestId === 'perm-plan-one',
    )
    const secondPlanPermission = twoPlanPermissionState.permissions.find(
      permission => permission.permissionRequestId === 'perm-plan-two',
    )
    assert.equal(
      firstPlanPermission?.input.internalPlanDraftPath,
      'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\plan-one.md',
      'first plan approval permission should use the nearest unconsumed draft before its own ExitPlanMode call',
    )
    assert.equal(
      secondPlanPermission?.toolUseId,
      'toolu-exit-plan-two',
      'fallback plan permission anchor should skip tool_use ids already used by existing permissions',
    )
    assert.equal(
      secondPlanPermission?.input.internalPlanDraftPath,
      'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\plan-two.md',
      'second plan approval permission should use a distinct draft from the same turn',
    )

    const unorderedPlanSeriesState = sessionReducer(
      {
        displayEvents: [
          secondExitPlanCall,
          firstExitPlanCall,
          secondPlanDraftWriteCall,
          firstPlanDraftWriteCall,
        ],
        permissions: [
          {
            permissionRequestId: 'perm-series-one',
            threadId: 'thread-1',
            turnId: 'turn-2',
            toolUseId: 'toolu-exit-plan-one',
            toolName: 'ExitPlanMode',
            interactionKind: 'plan_approval',
            input: { plan: '计划一', planSeriesId: 'plan-one' },
            status: 'pending',
          },
        ],
        activeTurnId: 'turn-2',
        turnMetadata: null,
      },
      {
        type: 'add-permission',
        permission: {
          permissionRequestId: 'perm-series-two',
          threadId: 'thread-1',
          turnId: 'turn-2',
          toolUseId: 'toolu-exit-plan-two',
          toolName: 'ExitPlanMode',
          interactionKind: 'plan_approval',
          input: { plan: '计划二', planSeriesId: 'plan-two' },
          status: 'pending',
        },
      },
    )
    assert.equal(
      unorderedPlanSeriesState.permissions.find(
        permission => permission.permissionRequestId === 'perm-series-one',
      )?.input.internalPlanDraftPath,
      'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\plan-one.md',
      'explicit planSeriesId should match the right draft even when event order is not chronological',
    )
    assert.equal(
      unorderedPlanSeriesState.permissions.find(
        permission => permission.permissionRequestId === 'perm-series-two',
      )?.input.internalPlanDraftPath,
      'C:\\\\Users\\\\luoji\\\\.ccr\\\\plans\\\\plan-two.md',
      'explicit planSeriesId should keep different plan series separated without relying on order',
    )

    const hiddenSyntheticMessage = createDisplayEventFromCompletedItem(
      'synthetic-no-response',
      'assistant_message',
      [{ type: 'text', text: 'No response requested.' }],
      'completed',
      {
        itemId: 'synthetic-no-response',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-1' },
      },
    )
    assert.equal(hiddenSyntheticMessage, null)

    const emptyDeltaRoute = routeDesktopEvent(
      {
        type: 'notification',
        at: 'fixture-empty-delta',
        payload: {
          method: 'item/delta',
          params: {
            itemId: 'assistant-empty-delta',
            delta: { type: 'text', text: '' },
          },
        },
      },
      new Map(),
    )
    assert.equal(
      emptyDeltaRoute.sessionActions.length,
      0,
      'empty assistant text delta should not create a visible message bubble',
    )

    const emptyAssistantCompleted = sessionReducer(
      {
        displayEvents: [
          {
            id: 'assistant-empty-delta',
            type: 'assistant_message',
            text: '',
            status: 'streaming',
          },
        ],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'upsert-completed-item-message',
        itemId: 'assistant-empty-delta',
        kind: 'assistant_message',
        content: [{ type: 'text', text: '' }],
        statusText: 'completed',
      },
    )
    assert.equal(
      emptyAssistantCompleted.displayEvents.length,
      0,
      'completed empty assistant item should remove an existing empty placeholder',
    )

    console.log('smoke-desktop-session-state: ok')
  `,
  'utf8',
)

await build({
  entryPoints: [entryPath],
  outfile: outputPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  logLevel: 'silent',
})

try {
  await import(pathToFileURL(outputPath).href)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
