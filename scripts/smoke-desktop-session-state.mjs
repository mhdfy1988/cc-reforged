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
    import { readFileSync } from 'node:fs'
    import {
      createThreadDisplaySnapshotActions,
      routeDesktopEvent,
      shouldReplayThreadDisplaySnapshotFromStatusEvent,
    } from '../../apps/desktop/src/renderer/src/app/notificationRouter.ts'
    import { sessionReducer } from '../../apps/desktop/src/renderer/src/app/sessionState.ts'
    import { renderMessageBlocks } from '../../apps/desktop/src/renderer/src/domain/contentBlocks.tsx'
    import {
      createDisplayEventFromCompletedItem,
      createUserDisplayEvent,
    } from '../../apps/desktop/src/renderer/src/domain/displayEvents.ts'
    import {
      buildThreadDisplaySnapshot,
      coreEventToThreadDisplayPatch,
      createThreadDisplayReducer,
    } from '../../src/app-server/threadDisplay.ts'
    import {
      coreTurnEventToDisplayReducerInputEvent,
      createUnsupportedDisplayReducerInputEvent,
    } from '../../src/app-server/threadDisplayInputEvent.ts'

    const identity = {
      itemId: 'tool-running',
      threadId: 'thread-1',
      turnId: 'turn-1',
      contentIndex: 0,
      toolUseId: 'toolu-running',
      missingFields: [],
      raw: {},
    }

    function createProjectedWriteFileEvent(itemId, toolUseId) {
      const projectedIdentity = {
        itemId,
        threadId: 'thread-1',
        turnId: 'turn-1',
        contentIndex: 0,
        toolUseId,
        missingFields: [],
        raw: {},
      }
      return {
        version: 1,
        event: {
          type: 'tool_call',
          text: '写入文件：README.md',
          status: 'completed',
          sourceKind: 'assistant',
          identity: projectedIdentity,
          toolSnapshot: {
            id: itemId,
            kind: 'call',
            name: 'Write',
            displayName: '写入文件',
            category: 'file',
            status: 'completed',
            statusLabel: '成功',
            summary: '写入文件：README.md',
            identity: projectedIdentity,
            input: { file_path: 'README.md', content: 'hello' },
            target: 'README.md',
            raw: {
              type: 'tool_use',
              id: toolUseId,
              name: 'Write',
              input: { file_path: 'README.md', content: 'hello' },
            },
          },
          fileToolSnapshot: {
            id: itemId + ':file-tool',
            source: 'Write',
            operation: 'write',
            status: 'completed',
            summary: '写入文件：README.md',
            path: 'README.md',
            workspaceRelativePath: 'README.md',
            safety: 'workspace',
            actions: ['open', 'copyPath', 'reveal'],
            toolUseId,
            identity: projectedIdentity,
            raw: {
              input: { file_path: 'README.md', content: 'hello' },
            },
          },
          contentBlocks: [
            {
              type: 'tool_call',
              id: toolUseId,
              name: 'Write',
              input: { file_path: 'README.md', content: 'hello' },
            },
          ],
        },
      }
    }

    function createProjectedToolResultEvent(itemId, toolUseId) {
      const projectedIdentity = {
        itemId,
        threadId: 'thread-1',
        turnId: 'turn-1',
        contentIndex: 0,
        toolUseId,
        parentToolUseId: toolUseId,
        missingFields: [],
        raw: {},
      }
      return {
        version: 1,
        event: {
          type: 'tool_result',
          text: '工具执行成功',
          status: 'completed',
          sourceKind: 'tool',
          identity: projectedIdentity,
          toolSnapshot: {
            id: itemId,
            kind: 'result',
            name: 'Write',
            displayName: '写入文件',
            category: 'file',
            status: 'completed',
            statusLabel: '成功',
            summary: '工具执行成功',
            identity: projectedIdentity,
            result: 'ok',
            raw: {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: 'ok',
            },
          },
          contentBlocks: [
            {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: 'ok',
            },
          ],
        },
      }
    }

    function createProjectedTextEvent(itemId, type, text, status = 'completed') {
      return {
        version: 1,
        event: {
          type,
          text,
          status,
          identity: {
            itemId,
            threadId: 'thread-1',
            turnId: 'turn-1',
            missingFields: [],
            raw: {},
          },
          contentBlocks: text ? [{ type: 'text', text }] : [],
        },
      }
    }

    function createEmptySessionState(activeTurnId = 'turn-1') {
      return {
        displayEvents: [],
        permissions: [],
        activeTurnId,
        turnMetadata: null,
      }
    }

    function applySessionActions(actions, initialState = createEmptySessionState()) {
      return actions.reduce(sessionReducer, initialState)
    }

    function normalizeDisplayEventsForGolden(events) {
      return events.map(event => ({
        id: event.id,
        type: event.type,
        text: event.text,
        status: event.status,
        sourceKind: event.sourceKind,
        timelineHidden: event.timelineHidden === true,
        toolKind: event.toolSnapshot?.kind,
        toolName: event.toolSnapshot?.name,
        toolStatus: event.toolSnapshot?.status,
        toolResult: event.toolSnapshot?.result,
        toolUseId: event.toolSnapshot?.identity?.toolUseId,
        toolProgressPercent:
          event.contentBlocks?.[0]?.raw?.progress?.data?.percent ??
          event.contentBlocks?.[0]?.progress?.data?.percent,
        fileOperation: event.fileToolSnapshot?.operation,
        filePath: event.fileToolSnapshot?.path,
        todoCount: event.todoSnapshot?.items?.length,
        compactStatus: event.compactSnapshot?.status,
        compactTrigger: event.compactSnapshot?.trigger,
        errorCategory: event.errorSnapshot?.category,
        errorMessage: event.errorSnapshot?.message,
        attachmentSources: event.attachmentSnapshots?.map(attachment => attachment.source),
        attachmentPreviewKinds: event.attachmentSnapshots?.map(attachment => attachment.previewKind),
        attachmentSavedPaths: event.attachmentSnapshots?.map(attachment => attachment.savedPath ?? attachment.path),
      }))
    }

    function routeThreadDisplayPatchActions(patch, at) {
      if (!patch) {
        return []
      }
      const routed = routeDesktopEvent(
        {
          type: 'notification',
          at,
          payload: {
            method: 'thread/display/patch',
            params: patch,
          },
        },
        new Map(),
      )
      return routed.sessionActions
    }

    function createReducerPatch(threadId, inputEvent, operations, index) {
      if (operations.length === 0) {
        return null
      }
      return {
        threadId,
        ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
        generatedAt: '2026-05-30T00:30:' + String(index).padStart(2, '0') + '.000Z',
        operations,
      }
    }

    assert.equal(
      coreEventToThreadDisplayPatch({
        type: 'item_started',
        item: {
          itemId: 'empty-assistant-started',
          threadId: 'thread-1',
          turnId: 'turn-1',
          kind: 'assistant_message',
          status: 'streaming',
          content: [],
        },
      }),
      null,
      'empty assistant item_started must not produce a projection-less display patch',
    )
    assert.equal(
      coreEventToThreadDisplayPatch({
        type: 'item_completed',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'empty-completed',
        status: 'completed',
      }),
      null,
      'empty item_completed must not produce a projection-less display patch',
    )
    assert.equal(
      coreEventToThreadDisplayPatch({
        type: 'item_completed',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'ambiguous-text-completed',
        status: 'completed',
        content: [{ type: 'text', text: '测试下' }],
      }),
      null,
      'text-only item_completed without kind must not be guessed as an assistant message',
    )
    const liveUserCompletedPatch = coreEventToThreadDisplayPatch({
      type: 'item_completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'live-user-completed',
      kind: 'user_message',
      status: 'completed',
      content: [{ type: 'text', text: '测试下' }],
    })
    assert.equal(
      liveUserCompletedPatch?.operations[0]?.item?.type,
      'user_message',
      'completed user item must preserve user_message kind',
    )
    const liveUserCompletedRoute = routeDesktopEvent(
      {
        type: 'notification',
        at: 'fixture-live-user-completed',
        payload: {
          method: 'thread/display/patch',
          params: liveUserCompletedPatch,
        },
      },
      new Map(),
    )
    assert.equal(
      liveUserCompletedRoute.sessionActions.length,
      0,
      'live completed user item must be filtered instead of rendering a duplicate C card',
    )
    const liveAssistantCompletedPatch = coreEventToThreadDisplayPatch({
      type: 'item_completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'live-assistant-completed',
      kind: 'assistant_message',
      status: 'completed',
      content: [{ type: 'text', text: '助手回复' }],
    })
    assert.equal(
      liveAssistantCompletedPatch?.operations[0]?.item?.type,
      'assistant_message',
      'completed assistant item must still render as assistant_message when kind is present',
    )
    const markdownDeltaText =
      '\\n\\n## 大盘指数\\n| 指数 | 点位 |\\n| --- | --- |\\n| 上证 | 4112.90 |\\n'
    const markdownDeltaPatch = coreEventToThreadDisplayPatch({
      type: 'item_delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'markdown-delta',
      delta: { type: 'text', text: markdownDeltaText },
    })
    assert.equal(
      markdownDeltaPatch?.operations[0]?.item?.text,
      markdownDeltaText,
      'thread display text deltas must preserve leading newlines and markdown spacing',
    )
    const markdownTableBlocks = renderMessageBlocks(
      '| 指数 | 点位 |\\n| --- | --- |\\n| 上证 | 4112.90 |',
    )
    assert.equal(
      markdownTableBlocks[0]?.props?.headers?.[0],
      '指数',
      'message markdown renderer should recognize basic pipe tables',
    )
    const desktopRendererMainSource = readFileSync(
      new URL('../../apps/desktop/src/renderer/src/main.tsx', import.meta.url),
      'utf8',
    )
    assert.equal(
      desktopRendererMainSource.includes('if (replayActions.length > 0)'),
      false,
      'status snapshot replay must reset the session even when an empty displaySnapshot produces no actions',
    )
    assert.ok(
      desktopRendererMainSource.includes('if (nextStatus.threadDisplaySnapshot)'),
      'status snapshot replay should be keyed on displaySnapshot presence instead of action count',
    )
    assert.ok(
      desktopRendererMainSource.includes('shouldReplayThreadDisplaySnapshotFromStatusEvent'),
      'state events that carry canonical thread display snapshots should be able to rematerialize the timeline',
    )
    assert.equal(
      shouldReplayThreadDisplaySnapshotFromStatusEvent(
        {
          type: 'state',
          at: 'fixture-permission-response',
          payload: { message: 'permission responded' },
          status: {},
        },
        {
          threadDisplaySnapshot: {
            threadId: 'thread-1',
            source: 'live',
            generatedAt: '2026-05-24T00:00:00.000Z',
            items: [],
            counts: {
              rawTranscriptEvents: 0,
              coreContextMessages: 0,
              projectedDisplayItems: 0,
              visibleTimelineItems: 0,
              hiddenDisplayItems: 0,
              filteredTranscriptEvents: 0,
              hiddenTimelineItems: 0,
            },
          },
        },
      ),
      true,
      'permission response state refresh should replay the canonical display snapshot',
    )
    assert.equal(
      shouldReplayThreadDisplaySnapshotFromStatusEvent(
        {
          type: 'state',
          at: 'fixture-settings-update',
          payload: { message: 'permission settings updated' },
          status: {},
        },
        {
          threadDisplaySnapshot: {
            threadId: 'thread-1',
            source: 'live',
            generatedAt: '2026-05-24T00:00:00.000Z',
            items: [],
            counts: {
              rawTranscriptEvents: 0,
              coreContextMessages: 0,
              projectedDisplayItems: 0,
              visibleTimelineItems: 0,
              hiddenDisplayItems: 0,
              filteredTranscriptEvents: 0,
              hiddenTimelineItems: 0,
            },
          },
        },
      ),
      false,
      'unrelated state events must not reset the timeline from an incidental status snapshot',
    )
    const desktopMainSource = readFileSync(
      new URL('../../apps/desktop/src/main/index.ts', import.meta.url),
      'utf8',
    )
    assert.ok(
      desktopMainSource.includes('function clearThreadDisplayState()'),
      'Desktop main should keep an explicit thread display reset helper',
    )
    assert.equal(
      desktopMainSource.includes('threadMessages'),
      false,
      'Desktop status must not keep the old threadMessages replay bridge',
    )
    assert.ok(
      desktopMainSource.includes('const result = await client.client.listThreadMessages({ threadId })'),
      'Desktop refresh should call thread/messages/list only as a snapshot refresh compatibility endpoint',
    )
    assert.ok(
      desktopMainSource.includes('result.displaySnapshot ?? null'),
      'Desktop refresh must consume displaySnapshot from thread/messages/list',
    )
    assert.equal(
      desktopMainSource.includes('mergeThreadDisplaySnapshot'),
      false,
      'Desktop main must not merge ThreadDisplay snapshots as a second display reducer',
    )
    assert.equal(
      desktopMainSource.includes('threadDisplaySnapshotMerge'),
      false,
      'Desktop main must not import the old snapshot merge helper',
    )
    assert.equal(
      desktopMainSource.includes('result.messages'),
      false,
      'Desktop refresh must not replay thread/messages/list messages as UI history',
    )
    assert.ok(
      desktopMainSource.includes('clearThreadDisplayState()'),
      'new thread or workspace switch should clear previous thread display state before snapshot refresh',
    )
    assert.ok(
      desktopMainSource.includes('const workspaceChanged =') &&
        desktopMainSource.includes('if (workspaceChanged)'),
      'opening the same workspace should not unconditionally clear the active thread display',
    )
    assert.ok(
      desktopMainSource.includes('handleUnexpectedAppServerClose(launchedClient, event)') &&
        desktopMainSource.includes("message: 'app server exited'") &&
        desktopMainSource.includes("updateTurnFinishedState({ threadId, turnId, error }, 'failed', error)"),
      'Desktop main must fail the active turn when the current App Server process exits unexpectedly',
    )

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

    const restoredPermissionState = sessionReducer(
      {
        displayEvents: [planMessage, exitPlanCall],
        permissions: [
          {
            permissionRequestId: 'perm-stale',
            threadId: 'thread-1',
            turnId: 'turn-1',
            toolName: 'PowerShell',
            input: { command: 'Start-Sleep 30' },
            status: 'pending',
          },
        ],
        activeTurnId: null,
        turnMetadata: null,
      },
      {
        type: 'replace-pending-permissions',
        permissions: [
          {
            permissionRequestId: 'perm-restored-exit-plan',
            threadId: 'thread-1',
            turnId: 'turn-1',
            toolName: 'ExitPlanMode',
            interactionKind: 'plan_approval',
            input: { plan: '实施计划' },
            status: 'pending',
          },
        ],
      },
    )
    assert.equal(restoredPermissionState.permissions.length, 1)
    assert.equal(
      restoredPermissionState.permissions[0].toolUseId,
      'call_00_exit_plan_anchor',
      'restored pending permission should recover the same tool anchor after renderer reload',
    )
    assert.equal(
      restoredPermissionState.displayEvents.find(
        event => event.id === 'plan-exit-call',
      )?.toolSnapshot?.permissionRequestId,
      'perm-restored-exit-plan',
      'restored pending permission should mark the matching tool card as waiting for permission',
    )

    const failedExitPlanMergeCall = createDisplayEventFromCompletedItem(
      'plan-exit-call-failed-merge',
      'assistant',
      [
        {
          type: 'tool_use',
          id: 'toolu-exit-plan-failed-merge',
          name: 'ExitPlanMode',
          input: { plan: '实施计划' },
        },
      ],
      'completed',
      {
        itemId: 'plan-exit-call-failed-merge',
        params: { source: 'history', threadId: 'thread-1', turnId: 'turn-1' },
      },
    )
    const failedExitPlanMergeState = sessionReducer(
      {
        displayEvents: [failedExitPlanMergeCall],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'upsert-completed-item-message',
        itemId: 'plan-exit-result-failed-merge',
        kind: 'assistant',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-exit-plan-failed-merge',
            isError: true,
            content: '<tool_use_error>You are not in plan mode. This tool is only for exiting plan mode after writing a plan.</tool_use_error>',
          },
        ],
        statusText: 'failed',
        context: {
          itemId: 'plan-exit-result-failed-merge',
          params: { source: 'history', threadId: 'thread-1', turnId: 'turn-1' },
        },
      },
    )
    assert.equal(
      failedExitPlanMergeState.displayEvents[0]?.timelineHidden,
      false,
      'failed control tool cards restored from history should stay visible as standalone timeline cards',
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

    const patchDeltaRoute = routeDesktopEvent(
      {
        type: 'notification',
        at: 'fixture-display-patch-delta',
        payload: {
          method: 'thread/display/patch',
          params: {
            threadId: 'thread-1',
            generatedAt: '2026-05-23T00:00:00.000Z',
            operations: [
              {
                op: 'update_item',
                itemId: 'assistant-patch-delta',
                item: {
                  type: 'assistant_message',
                  text: 'patch hello',
                  status: 'streaming',
                  metadata: { deltaMode: 'append_text' },
                },
              },
            ],
          },
        },
      },
      new Map(),
    )
    assert.equal(patchDeltaRoute.sessionActions[0]?.type, 'upsert-assistant-delta')
    const patchDeltaState = patchDeltaRoute.sessionActions.reduce(sessionReducer, {
      displayEvents: [],
      permissions: [],
      activeTurnId: 'turn-1',
      turnMetadata: null,
    })
    assert.equal(
      patchDeltaState.displayEvents.find(event => event.id === 'assistant-patch-delta')?.text,
      'patch hello',
      'thread/display/patch text delta should update the same assistant stream reducer path',
    )
    const markdownPatchDeltaRoute = routeDesktopEvent(
      {
        type: 'notification',
        at: 'fixture-display-patch-markdown-delta',
        payload: {
          method: 'thread/display/patch',
          params: markdownDeltaPatch,
        },
      },
      new Map(),
    )
    const markdownPatchDeltaState = markdownPatchDeltaRoute.sessionActions.reduce(
      sessionReducer,
      {
        displayEvents: [],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
    )
    assert.equal(
      markdownPatchDeltaState.displayEvents.find(event => event.id === 'markdown-delta')?.text,
      markdownDeltaText,
      'renderer state should keep markdown delta newlines intact',
    )
    const completedMarkdownState = sessionReducer(
      {
        displayEvents: [
          {
            id: 'assistant-complete-markdown',
            type: 'assistant_message',
            text: '---## 大盘指数| 指数 | 点位 |',
            status: 'streaming',
          },
        ],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'upsert-completed-item-message',
        itemId: 'assistant-complete-markdown',
        kind: 'assistant_message',
        content: [
          {
            type: 'text',
            text: '---\\n\\n## 大盘指数\\n| 指数 | 点位 |\\n| --- | --- |\\n| 上证 | 4112.90 |',
          },
        ],
        statusText: 'completed',
      },
    )
    assert.equal(
      completedMarkdownState.displayEvents.find(event => event.id === 'assistant-complete-markdown')?.text,
      '---\\n\\n## 大盘指数\\n| 指数 | 点位 |\\n| --- | --- |\\n| 上证 | 4112.90 |',
      'completed assistant text should replace malformed streaming text when complete content is present',
    )

    const patchThinkingRoute = routeDesktopEvent(
      {
        type: 'notification',
        at: 'fixture-display-patch-thinking',
        payload: {
          method: 'thread/display/patch',
          params: {
            threadId: 'thread-1',
            generatedAt: '2026-05-23T00:00:00.000Z',
            operations: [
              {
                op: 'update_item',
                itemId: 'thinking-patch-delta',
                item: {
                  type: 'thinking_summary',
                  text: '先检查源码',
                  status: 'streaming',
                  metadata: {
                    deltaMode: 'append_text',
                    delta: { type: 'thinking', thinking: '先检查源码' },
                  },
                },
              },
            ],
          },
        },
      },
      new Map(),
    )
    assert.equal(patchThinkingRoute.sessionActions[0]?.type, 'upsert-thinking-delta')

    const patchPermissionRoute = routeDesktopEvent(
      {
        type: 'notification',
        at: 'fixture-display-patch-permission',
        payload: {
          method: 'thread/display/patch',
          params: {
            threadId: 'thread-1',
            generatedAt: '2026-05-23T00:00:00.000Z',
            operations: [
              {
                op: 'append_item',
                item: {
                  id: 'perm-patch',
                  type: 'permission_request',
                  text: '权限请求：PowerShell',
                  status: 'pending',
                  identity: {
                    threadId: 'thread-1',
                    turnId: 'turn-1',
                    itemId: 'perm-patch',
                    toolUseId: 'toolu-patch-shell',
                  },
                  projection: createProjectedTextEvent(
                    'perm-patch',
                    'permission_request',
                    '权限请求：PowerShell',
                    'pending',
                  ),
                  content: {
                    permissionRequestId: 'perm-patch',
                    threadId: 'thread-1',
                    turnId: 'turn-1',
                    toolUseId: 'toolu-patch-shell',
                    tool: { name: 'PowerShell', displayName: 'PowerShell' },
                    input: { command: 'npm.cmd run typecheck' },
                    createdAt: '2026-05-23T00:00:00.000Z',
                  },
                },
              },
            ],
          },
        },
      },
      new Map(),
    )
    assert.equal(patchPermissionRoute.sessionActions[0]?.type, 'add-permission')
    assert.equal(patchPermissionRoute.sessionActions[0]?.permission.toolName, 'PowerShell')

    const patchFileRoute = routeDesktopEvent(
      {
        type: 'notification',
        at: 'fixture-display-patch-file',
        payload: {
          method: 'thread/display/patch',
          params: {
            threadId: 'thread-1',
            generatedAt: '2026-05-23T00:00:00.000Z',
            operations: [
              {
                op: 'complete_item',
                itemId: 'patch-file-write',
                status: 'completed',
                item: {
                  id: 'patch-file-write',
                  type: 'file_change',
                  text: '写入文件：README.md',
                  status: 'completed',
                  sourceKind: 'assistant',
                  identity: {
                    threadId: 'thread-1',
                    turnId: 'turn-1',
                    itemId: 'patch-file-write',
                    toolUseId: 'toolu-patch-write',
                  },
                  projection: createProjectedWriteFileEvent(
                    'patch-file-write',
                    'toolu-patch-write',
                  ),
                  content: [
                    {
                      type: 'text',
                      text: 'raw text should not split projected file card',
                    },
                    {
                      type: 'tool_use',
                      id: 'toolu-patch-write',
                      name: 'Read',
                      input: { file_path: 'SHOULD_NOT_BE_USED.md' },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
      new Map(),
    )
    const patchFileState = patchFileRoute.sessionActions.reduce(sessionReducer, {
      displayEvents: [],
      permissions: [],
      activeTurnId: 'turn-1',
      turnMetadata: null,
    })
    const patchFileEvent = patchFileState.displayEvents.find(event => event.id === 'patch-file-write')
    assert.equal(patchFileEvent?.type, 'tool_call')
    assert.equal(patchFileEvent?.toolSnapshot?.name, 'Write')
    assert.equal(patchFileEvent?.fileToolSnapshot?.operation, 'write')

    const snapshotActions = createThreadDisplaySnapshotActions({
      threadId: 'thread-1',
      source: 'history',
      generatedAt: '2026-05-23T00:00:00.000Z',
      items: [
        {
          id: 'history-user-from-snapshot',
          type: 'user_message',
          text: '历史用户消息',
          status: 'completed',
          content: [{ type: 'text', text: '历史用户消息' }],
          identity: {
            threadId: 'thread-1',
            itemId: 'history-user-from-snapshot',
          },
          projection: createProjectedTextEvent(
            'history-user-from-snapshot',
            'user_message',
            '历史用户消息',
          ),
        },
        {
          id: 'history-file-write',
          type: 'file_change',
          text: '写入文件：README.md',
          status: 'completed',
          sourceKind: 'assistant',
          content: [
            {
              type: 'text',
              text: 'raw text should not split projected history file card',
            },
            {
              type: 'tool_use',
              id: 'toolu-history-write',
              name: 'Read',
              input: { file_path: 'SHOULD_NOT_BE_USED.md' },
            },
          ],
          identity: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            itemId: 'history-file-write',
            toolUseId: 'toolu-history-write',
          },
          projection: createProjectedWriteFileEvent(
            'history-file-write',
            'toolu-history-write',
          ),
        },
      ],
      counts: {
        rawTranscriptEvents: 2,
        coreContextMessages: 2,
        projectedDisplayItems: 2,
        visibleTimelineItems: 2,
        hiddenDisplayItems: 0,
        filteredTranscriptEvents: 0,
        hiddenTimelineItems: 0,
      },
    })
    const snapshotState = snapshotActions.reduce(sessionReducer, {
      displayEvents: [],
      permissions: [],
      activeTurnId: null,
      turnMetadata: null,
    })
    assert.equal(
      snapshotState.displayEvents.find(event => event.id === 'history-user-from-snapshot')?.type,
      'user_message',
      'history display snapshot should rebuild user messages through the same display reducer contract',
    )
    assert.equal(
      snapshotState.displayEvents.find(event => event.id === 'history-file-write')?.fileToolSnapshot?.operation,
      'write',
      'history display snapshot should rebuild file tool cards through the same display reducer contract',
    )

    const goldenThreadId = 'thread-desktop-golden'
    const goldenSessionId = 'session-desktop-golden'
    const goldenTurnId = 'turn-desktop-golden'
    const goldenToolUseId = 'toolu-desktop-golden-read'
    const goldenHistorySnapshot = buildThreadDisplaySnapshot({
      threadId: goldenThreadId,
      sessionId: goldenSessionId,
      source: 'history',
      messages: [
        {
          id: 'golden-assistant-text',
          role: 'assistant',
          kind: 'assistant_message',
          text: '我会读取 package.json。',
          status: 'completed',
          createdAt: '2026-05-30T00:00:00.000Z',
          content: [{ type: 'text', text: '我会读取 package.json。' }],
        },
        {
          id: 'golden-tool-lifecycle',
          role: 'assistant',
          text: '',
          status: 'completed',
          createdAt: '2026-05-30T00:00:01.000Z',
          content: [
            {
              type: 'tool_use',
              id: goldenToolUseId,
              name: 'Read',
              input: { file_path: 'package.json' },
            },
            {
              type: 'tool_result',
              tool_use_id: goldenToolUseId,
              content: '{"name":"claude-code-reforged"}',
            },
          ],
        },
      ],
    })
    const goldenHistoryState = applySessionActions(
      createThreadDisplaySnapshotActions(goldenHistorySnapshot),
      createEmptySessionState(null),
    )
    const goldenRealtimeEvents = [
      {
        type: 'item_completed',
        threadId: goldenThreadId,
        sessionId: goldenSessionId,
        turnId: goldenTurnId,
        itemId: 'golden-assistant-text',
        kind: 'assistant_message',
        status: 'completed',
        content: [{ type: 'text', text: '我会读取 package.json。' }],
        completedAt: '2026-05-30T00:00:00.000Z',
      },
      {
        type: 'item_started',
        item: {
          itemId: 'golden-tool-lifecycle',
          threadId: goldenThreadId,
          sessionId: goldenSessionId,
          turnId: goldenTurnId,
          kind: 'assistant_message',
          status: 'running',
          startedAt: '2026-05-30T00:00:01.000Z',
          content: [
            {
              type: 'tool_use',
              id: goldenToolUseId,
              name: 'Read',
              input: { file_path: 'package.json' },
            },
          ],
        },
      },
      {
        type: 'item_completed',
        threadId: goldenThreadId,
        sessionId: goldenSessionId,
        turnId: goldenTurnId,
        itemId: 'golden-tool-lifecycle',
        kind: 'assistant_message',
        status: 'completed',
        content: [
          {
            type: 'tool_result',
            tool_use_id: goldenToolUseId,
            content: '{"name":"claude-code-reforged"}',
          },
        ],
        completedAt: '2026-05-30T00:00:02.000Z',
      },
    ]
    const goldenRealtimeActions = goldenRealtimeEvents.flatMap((event, eventIndex) => {
      const patch = coreEventToThreadDisplayPatch(event)
      assert(patch, 'golden realtime event should produce a ThreadDisplay patch')
      const routed = routeDesktopEvent(
        {
          type: 'notification',
          at: 'fixture-desktop-golden-' + eventIndex,
          payload: {
            method: 'thread/display/patch',
            params: patch,
          },
        },
        new Map(),
      )
      return routed.sessionActions
    })
    const goldenRealtimeState = applySessionActions(
      goldenRealtimeActions,
      createEmptySessionState(goldenTurnId),
    )
    assert.deepEqual(
      normalizeDisplayEventsForGolden(goldenRealtimeState.displayEvents),
      normalizeDisplayEventsForGolden(goldenHistoryState.displayEvents),
      'Desktop history snapshot consumption and realtime patch consumption should converge to the same display events',
    )

    const fullGoldenThreadId = 'thread-desktop-full-golden'
    const fullGoldenSessionId = 'session-desktop-full-golden'
    const fullGoldenTurnId = 'turn-desktop-full-golden'
    const fullGoldenGeneratedPath =
      'C:\\\\Users\\\\luoji\\\\.ccr\\\\generated_outputs\\\\full-golden\\\\out_full_golden.png'
    const fullGoldenUserAttachment = {
      type: 'image',
      attachmentId: 'full-golden-user-image',
      displayName: 'image.png',
      mimeType: 'image/png',
      path: 'C:\\\\Users\\\\luoji\\\\AppData\\\\Roaming\\\\CCR\\\\attachments\\\\clipboard\\\\full-golden-user.png',
      sizeBytes: 12345,
    }
    const fullGoldenUserSnapshot = buildThreadDisplaySnapshot({
      threadId: fullGoldenThreadId,
      sessionId: fullGoldenSessionId,
      source: 'history',
      messages: [
        {
          id: 'full-golden-user-image',
          role: 'user',
          kind: 'user_message',
          text: '[图片]',
          status: 'completed',
          createdAt: '2026-05-30T00:20:00.000Z',
          content: [{ type: 'text', text: '[图片]' }, fullGoldenUserAttachment],
        },
      ],
    })
    const fullGoldenCoreEvents = [
      {
        type: 'item_delta',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-stream',
        delta: { type: 'text', text: '正在整理结果...' },
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-stream',
        kind: 'assistant_message',
        status: 'completed',
        content: [{ type: 'text', text: '整理完成。' }],
        completedAt: '2026-05-30T00:20:01.000Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-thinking-only',
        kind: 'assistant_message',
        status: 'completed',
        content: [{ type: 'thinking', thinking: 'hidden chain of thought' }],
        completedAt: '2026-05-30T00:20:02.000Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'context_compaction_started',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        startedAt: '2026-05-30T00:20:03.000Z',
        trigger: 'auto',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'context_compacted',
        threadId: fullGoldenThreadId,
        compactedAt: '2026-05-30T00:20:04.000Z',
        result: {
          trigger: 'auto',
          preCompactTokenCount: 120000,
          truePostCompactTokenCount: 42000,
          summaryMessageCount: 12,
          attachmentCount: 2,
        },
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_started',
        item: {
          itemId: 'full-golden-todo',
          threadId: fullGoldenThreadId,
          sessionId: fullGoldenSessionId,
          turnId: fullGoldenTurnId,
          kind: 'assistant_message',
          status: 'running',
          startedAt: '2026-05-30T00:20:05.000Z',
          content: [
            {
              type: 'tool_use',
              id: 'toolu-full-golden-todo',
              name: 'TodoWrite',
              input: {
                todos: [
                  { content: '补齐黄金回归', status: 'completed' },
                  { content: '运行 smoke', status: 'in_progress' },
                ],
              },
            },
          ],
        },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-generated-image',
        kind: 'assistant_message',
        status: 'completed',
        content: [
          { type: 'text', text: '已生成图片：\\n' + fullGoldenGeneratedPath },
          {
            type: 'image',
            attachmentId: 'full-golden-generated-image',
            displayName: 'out_full_golden.png',
            mimeType: 'image/png',
            origin: 'model_output',
            lifecycle: 'persisted',
            safety: 'needs_review',
            savedPath: fullGoldenGeneratedPath,
          },
        ],
        completedAt: '2026-05-30T00:20:06.000Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_started',
        item: {
          itemId: 'full-golden-tool-a',
          threadId: fullGoldenThreadId,
          sessionId: fullGoldenSessionId,
          turnId: fullGoldenTurnId,
          kind: 'assistant_message',
          status: 'running',
          startedAt: '2026-05-30T00:20:07.000Z',
          content: [
            {
              type: 'tool_use',
              id: 'toolu-full-golden-a',
              name: 'Read',
              input: { file_path: 'package.json' },
            },
          ],
        },
      },
      {
        type: 'item_started',
        item: {
          itemId: 'full-golden-tool-b',
          threadId: fullGoldenThreadId,
          sessionId: fullGoldenSessionId,
          turnId: fullGoldenTurnId,
          kind: 'assistant_message',
          status: 'running',
          startedAt: '2026-05-30T00:20:08.000Z',
          content: [
            {
              type: 'tool_use',
              id: 'toolu-full-golden-b',
              name: 'Write',
              input: { file_path: 'README.md', content: 'hello' },
            },
          ],
        },
      },
      {
        type: 'item_delta',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-tool-a',
        delta: {
          type: 'progress',
          tool_use_id: 'toolu-full-golden-a',
          data: { message: '读取中', percent: 25 },
          timestamp: '2026-05-30T00:20:08.250Z',
        },
        timestamp: '2026-05-30T00:20:08.250Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_delta',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-tool-a',
        delta: {
          type: 'progress',
          tool_use_id: 'toolu-full-golden-a',
          data: { message: '读取中', percent: 80 },
          timestamp: '2026-05-30T00:20:08.750Z',
        },
        timestamp: '2026-05-30T00:20:08.750Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-tool-b',
        kind: 'tool_result',
        status: 'completed',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-full-golden-b',
            content: 'write ok',
          },
        ],
        completedAt: '2026-05-30T00:20:09.000Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-tool-a',
        kind: 'tool_result',
        status: 'completed',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-full-golden-a',
            content: '{"name":"claude-code-reforged"}',
          },
        ],
        completedAt: '2026-05-30T00:20:10.000Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_started',
        item: {
          itemId: 'full-golden-tool-failed',
          threadId: fullGoldenThreadId,
          sessionId: fullGoldenSessionId,
          turnId: fullGoldenTurnId,
          kind: 'assistant_message',
          status: 'running',
          startedAt: '2026-05-30T00:20:10.250Z',
          content: [
            {
              type: 'tool_use',
              id: 'toolu-full-golden-failed',
              name: 'Bash',
              input: { command: 'exit 1' },
            },
          ],
        },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-tool-failed',
        kind: 'tool_result',
        status: 'failed',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-full-golden-failed',
            is_error: true,
            content: 'command failed',
          },
        ],
        completedAt: '2026-05-30T00:20:10.500Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_started',
        item: {
          itemId: 'full-golden-tool-interrupted',
          threadId: fullGoldenThreadId,
          sessionId: fullGoldenSessionId,
          turnId: fullGoldenTurnId,
          kind: 'assistant_message',
          status: 'running',
          startedAt: '2026-05-30T00:20:10.650Z',
          content: [
            {
              type: 'tool_use',
              id: 'toolu-full-golden-interrupted',
              name: 'Bash',
              input: { command: 'Start-Sleep -Seconds 30' },
            },
          ],
        },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-tool-interrupted',
        kind: 'tool_result',
        status: 'cancelled',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-full-golden-interrupted',
            status: 'cancelled',
            content: 'cancelled by user',
          },
        ],
        completedAt: '2026-05-30T00:20:10.900Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'item_completed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        itemId: 'full-golden-orphan-tool-result',
        kind: 'tool_result',
        status: 'completed',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-full-golden-missing',
            content: 'orphan result',
          },
        ],
        completedAt: '2026-05-30T00:20:11.000Z',
        metadata: { sessionId: fullGoldenSessionId },
      },
      {
        type: 'turn_failed',
        threadId: fullGoldenThreadId,
        turnId: fullGoldenTurnId,
        error: {
          type: 'error',
          message: 'provider failure',
          category: 'unknown_error',
          source: 'app_server',
        },
        metadata: { sessionId: fullGoldenSessionId },
      },
    ]
    const fullGoldenInputEvents = [
      ...fullGoldenCoreEvents.map((event, index) =>
        coreTurnEventToDisplayReducerInputEvent(event, { sourceIndex: index + 1 }),
      ),
      createUnsupportedDisplayReducerInputEvent({
        source: 'realtime',
        threadId: fullGoldenThreadId,
        sessionId: fullGoldenSessionId,
        rawType: 'full_golden_unknown_event',
        reason: 'full golden unsupported event',
        ordinal: fullGoldenCoreEvents.length + 1,
        raw: {
          type: 'full_golden_unknown_event',
          threadId: fullGoldenThreadId,
          turnId: fullGoldenTurnId,
        },
      }),
    ]
    const fullGoldenSnapshotReducer = createThreadDisplayReducer({
      threadId: fullGoldenThreadId,
      sessionId: fullGoldenSessionId,
    })
    for (const inputEvent of fullGoldenInputEvents) {
      fullGoldenSnapshotReducer.acceptOne(inputEvent)
      fullGoldenSnapshotReducer.consumePatchOperations()
    }
    const fullGoldenLiveSnapshot = fullGoldenSnapshotReducer.toSnapshot({
      source: 'live',
      rawTranscriptEvents: fullGoldenInputEvents.length,
      coreContextMessages: fullGoldenInputEvents.length,
    })
    const fullGoldenSnapshot = {
      ...fullGoldenLiveSnapshot,
      items: [...fullGoldenUserSnapshot.items, ...fullGoldenLiveSnapshot.items],
      counts: {
        ...fullGoldenLiveSnapshot.counts,
        rawTranscriptEvents: fullGoldenLiveSnapshot.counts.rawTranscriptEvents + 1,
        coreContextMessages: fullGoldenLiveSnapshot.counts.coreContextMessages + 1,
        projectedDisplayItems: fullGoldenLiveSnapshot.counts.projectedDisplayItems + 1,
        visibleTimelineItems: fullGoldenLiveSnapshot.counts.visibleTimelineItems + 1,
      },
    }
    const fullGoldenSnapshotState = applySessionActions(
      createThreadDisplaySnapshotActions(fullGoldenSnapshot),
      createEmptySessionState(null),
    )
    const fullGoldenPatchReducer = createThreadDisplayReducer({
      threadId: fullGoldenThreadId,
      sessionId: fullGoldenSessionId,
    })
    const fullGoldenPatchActions = fullGoldenInputEvents.flatMap((inputEvent, index) => {
      const operations = fullGoldenPatchReducer
        .acceptOne(inputEvent)
        .consumePatchOperations()
      return routeThreadDisplayPatchActions(
        createReducerPatch(fullGoldenThreadId, inputEvent, operations, index),
        'fixture-desktop-full-golden-' + index,
      )
    })
    const fullGoldenRealtimeState = applySessionActions(
      fullGoldenPatchActions,
      sessionReducer(createEmptySessionState(fullGoldenTurnId), {
        type: 'append-display-event',
        event: {
          ...createUserDisplayEvent(
            'full-golden-user-image',
            '[图片]',
            [fullGoldenUserAttachment],
          ),
          status: 'completed',
          sourceKind: 'user_message',
        },
      }),
    )
    assert.deepEqual(
      normalizeDisplayEventsForGolden(fullGoldenRealtimeState.displayEvents),
      normalizeDisplayEventsForGolden(fullGoldenSnapshotState.displayEvents),
      'Desktop full golden fixture should converge across snapshot consumption and realtime patch consumption',
    )
    const fullGoldenNormalized = normalizeDisplayEventsForGolden(
      fullGoldenSnapshotState.displayEvents,
    )
    for (const expectedType of [
      'user_message',
      'assistant_message',
      'system_notice',
      'todo_list',
      'tool_call',
      'error',
    ]) {
      assert.ok(
        fullGoldenNormalized.some(event => event.type === expectedType),
        'full golden fixture should cover ' + expectedType,
      )
    }
    assert.ok(
      fullGoldenNormalized.some(event => event.fileOperation === 'read'),
      'full golden fixture should cover read file operation',
    )
    assert.ok(
      fullGoldenNormalized.some(event => event.fileOperation === 'write'),
      'full golden fixture should cover write file operation',
    )
    assert.ok(
      fullGoldenNormalized.some(event => event.toolProgressPercent === 80),
      'full golden fixture should cover tool progress updates',
    )
    assert.ok(
      fullGoldenNormalized.some(event => event.toolStatus === 'failed'),
      'full golden fixture should cover failed tool lifecycle',
    )
    assert.ok(
      fullGoldenNormalized.some(event => event.toolStatus === 'interrupted'),
      'full golden fixture should cover interrupted tool lifecycle',
    )
    assert.ok(
      fullGoldenNormalized.some(event => event.compactStatus === 'completed'),
      'full golden fixture should cover compact completion',
    )
    assert.ok(
      fullGoldenNormalized.some(event =>
        event.attachmentSources?.includes('UserUpload'),
      ),
      'full golden fixture should cover user image attachment',
    )
    assert.ok(
      fullGoldenNormalized.some(event =>
        event.attachmentSources?.includes('ModelOutput'),
      ),
      'full golden fixture should cover generated model image attachment',
    )
    assert.ok(
      fullGoldenNormalized.some(event =>
        event.errorMessage?.includes('full golden unsupported event'),
      ),
      'full golden fixture should cover unsupported input diagnostic',
    )

    const protocolErrorActions = createThreadDisplaySnapshotActions({
      threadId: 'thread-1',
      source: 'history',
      generatedAt: '2026-05-23T00:00:00.000Z',
      items: [
        {
          id: 'history-missing-projection',
          type: 'file_change',
          text: 'raw fallback must be rejected',
          status: 'completed',
          content: [
            {
              type: 'tool_use',
              id: 'toolu-missing-projection',
              name: 'Write',
              input: { file_path: 'SHOULD_NOT_BE_USED.md' },
            },
          ],
          identity: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            itemId: 'history-missing-projection',
          },
        },
        {
          id: 'history-invalid-projection',
          type: 'assistant_message',
          text: 'invalid projection must be rejected',
          status: 'completed',
          content: [{ type: 'text', text: 'raw text must not render' }],
          projection: { version: 2 },
          identity: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            itemId: 'history-invalid-projection',
          },
        },
        {
          id: 'history-thinking-missing-projection',
          type: 'thinking_summary',
          text: 'thinking fallback must be rejected',
          status: 'completed',
          content: [{ type: 'thinking', thinking: 'raw thinking must not render' }],
          identity: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            itemId: 'history-thinking-missing-projection',
          },
        },
      ],
      counts: {
        rawTranscriptEvents: 3,
        coreContextMessages: 3,
        projectedDisplayItems: 3,
        visibleTimelineItems: 3,
        hiddenDisplayItems: 0,
        filteredTranscriptEvents: 0,
        hiddenTimelineItems: 0,
      },
    })
    const protocolErrorState = protocolErrorActions.reduce(sessionReducer, {
      displayEvents: [],
      permissions: [],
      activeTurnId: null,
      turnMetadata: null,
    })
    assert.equal(
      protocolErrorState.displayEvents.filter(
        event => event.type === 'error' && event.id.endsWith(':projection-protocol-error'),
      ).length,
      3,
      'missing or invalid ThreadDisplayItem projection should render protocol error cards',
    )
    assert.equal(
      protocolErrorState.displayEvents.some(event => event.fileToolSnapshot?.path === 'SHOULD_NOT_BE_USED.md'),
      false,
      'missing projection must not fall back to raw content parsing',
    )
    assert.equal(
      protocolErrorState.displayEvents.some(event => event.type === 'thinking_summary'),
      false,
      'missing thinking projection must not use a special raw fallback',
    )

    const displayEventsSource = readFileSync(
      new URL('../../apps/desktop/src/renderer/src/domain/displayEvents.ts', import.meta.url),
      'utf8',
    )
    const sessionStateSource = readFileSync(
      new URL('../../apps/desktop/src/renderer/src/app/sessionState.ts', import.meta.url),
      'utf8',
    )
    assert.equal(
      displayEventsSource.includes('canFallbackMissingThreadDisplayProjection'),
      false,
      'Desktop displayEvents must not keep a missing-projection fallback helper',
    )
    assert.equal(
      sessionStateSource.includes('findMatchingToolLifecycleEventIndex'),
      false,
      'Renderer old tool lifecycle merge helper must be explicitly named legacy',
    )
    assert.ok(
      sessionStateSource.includes('findLegacyToolLifecycleEventIndex'),
      'Renderer compatibility-only tool lifecycle merge helper should be explicit',
    )

    const rendererOwnedMergeState = sessionReducer(
      {
        displayEvents: [
          createProjectedWriteFileEvent(
            'thread-display-tool-call',
            'toolu-thread-display-owned',
          ).event,
        ],
        permissions: [],
        activeTurnId: 'turn-1',
        turnMetadata: null,
      },
      {
        type: 'upsert-completed-item-message',
        itemId: 'thread-display-tool-result-wrong-id',
        kind: 'tool_result',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-thread-display-owned',
            content: 'raw result must not drive renderer merge',
          },
        ],
        statusText: 'completed',
        context: {
          itemId: 'thread-display-tool-result-wrong-id',
          params: {
            source: 'live',
            threadId: 'thread-1',
            turnId: 'turn-1',
            toolUseId: 'toolu-thread-display-owned',
          },
          item: {
            id: 'thread-display-tool-result-wrong-id',
            type: 'tool_result',
            text: '工具执行成功',
            status: 'completed',
            projection: createProjectedToolResultEvent(
              'thread-display-tool-result-wrong-id',
              'toolu-thread-display-owned',
            ),
          },
        },
      },
    )
    assert.equal(
      rendererOwnedMergeState.displayEvents.length,
      2,
      'ThreadDisplay protocol path must not merge tool results by raw toolUseId in the Renderer',
    )
    assert.equal(
      rendererOwnedMergeState.displayEvents[0]?.toolSnapshot?.result,
      undefined,
      'Renderer must leave lifecycle result binding to the App Server snapshot/patch',
    )
    assert.equal(
      rendererOwnedMergeState.displayEvents[1]?.type,
      'tool_result',
      'a protocol item with a different itemId should remain its own projected item',
    )

    const resetClearsSessionState = sessionReducer(
      {
        displayEvents: [
          createProjectedWriteFileEvent(
            'stale-running-tool',
            'toolu-stale-running',
          ).event,
        ],
        permissions: [
          {
            permissionRequestId: 'perm-stale-running',
            threadId: 'thread-1',
            turnId: 'turn-1',
            toolUseId: 'toolu-stale-running',
            toolName: 'Write',
            interactionKind: 'shell_permission',
            input: {},
            status: 'pending',
          },
        ],
        activeTurnId: 'turn-1',
        turnMetadata: { threadId: 'thread-1', turnId: 'turn-1', status: 'running' },
      },
      { type: 'reset-session' },
    )
    assert.equal(resetClearsSessionState.displayEvents.length, 0)
    assert.equal(resetClearsSessionState.permissions.length, 0)
    assert.equal(resetClearsSessionState.activeTurnId, null)

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
