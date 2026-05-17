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
