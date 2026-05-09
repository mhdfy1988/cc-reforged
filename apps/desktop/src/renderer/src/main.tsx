import { useEffect, useReducer, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import {
  initialSessionState,
  selectTimelineEvents,
  selectTodoOverlay,
  sessionReducer,
  type SessionAction,
} from './app/sessionState.js'
import { routeDesktopEvent } from './app/notificationRouter.js'
import { Sidebar } from './components/layout/Sidebar.js'
import { Topbar } from './components/layout/Topbar.js'
import { WindowTitlebar } from './components/layout/WindowTitlebar.js'
import { ChatPage } from './components/pages/ChatPage.js'
import { LogsPage } from './components/pages/LogsPage.js'
import { McpPage } from './components/pages/McpPage.js'
import { SettingsPage } from './components/pages/SettingsPage.js'
import {
  createErrorDisplayEvent,
  createSystemNoticeEvent,
  createUserDisplayEvent,
  type DisplayEvent,
} from './domain/displayEvents.js'
import { normalizeContentBlocks } from './domain/contentBlocks.js'
import {
  createCompletedItemContractContext,
  withContentBlock,
} from './domain/eventContract.js'
import type {
  ChatMessage,
  DesktopStatus,
  JsonObject,
  LogSnapshot,
  PageId,
  PermissionRespondPayload,
  PermissionSettingsState,
  PermissionSettingsUpdateInput,
  ThreadHistoryItem,
  ThreadHistoryState,
  TurnRuntimeMetadata,
} from './domain/displayTypes.js'
import type { UpdateActionKind } from './domain/updateDisplay.js'
import type { CcrDesktopEvent } from './global.js'

type AppPageId = Exclude<PageId, 'settings'>

function App() {
  const [status, setStatus] = useState<DesktopStatus | null>(null)
  const [events, setEvents] = useState<CcrDesktopEvent[]>([])
  const [session, dispatchSession] = useReducer(
    sessionReducer,
    initialSessionState,
  )
  const [workspaceInput, setWorkspaceInput] = useState('')
  const [prompt, setPrompt] = useState('')
  const [page, setPage] = useState<PageId>('chat')
  const [returnPage, setReturnPage] = useState<AppPageId>('chat')
  const [logSnapshot, setLogSnapshot] = useState<LogSnapshot | null>(null)
  const [permissionSettings, setPermissionSettings] =
    useState<PermissionSettingsState | null>(null)
  const [threadHistory, setThreadHistory] = useState<ThreadHistoryState>({
    status: 'closed',
    scope: 'allProjects',
    query: '',
    groups: [],
    threads: [],
  })
  const [busy, setBusy] = useState(false)
  const itemMetadataRef = useRef<Map<string, JsonObject>>(new Map())

  useEffect(() => {
    window.ccr.getStatus().then((nextStatus: DesktopStatus) => {
      setStatus(nextStatus)
      setPermissionSettings(nextStatus.permissionSettings ?? null)
      setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')
    })
    refreshLogs().catch(() => undefined)

    return window.ccr.onEvent(event => {
      setEvents(current => [event, ...current].slice(0, 80))
      const nextStatus = event.status as DesktopStatus
      setStatus(nextStatus)
      setPermissionSettings(nextStatus.permissionSettings ?? null)
      const routedEvent = routeDesktopEvent(event, itemMetadataRef.current)
      if (routedEvent.itemMetadata) {
        itemMetadataRef.current.set(
          routedEvent.itemMetadata.itemId,
          routedEvent.itemMetadata.item,
        )
      }
      routedEvent.sessionActions.forEach(action => dispatchSession(action))
    })
  }, [])

  const model = status?.config?.llm?.model ?? '模型待加载'
  const provider = status?.config?.llm?.provider ?? 'provider 待加载'
  const contextWindow = status?.config?.llm?.contextWindow
  const authText = status?.auth?.available ? '已连接' : '需要登录'
  const coreVersion = status?.initialized?.serverInfo.coreVersion ?? 'unknown'
  const serverVersion =
    status?.initialized?.serverVersion ??
    status?.initialized?.serverInfo.serverVersion ??
    status?.initialized?.serverInfo.version ??
    'unknown'
  const protocol = status?.initialized?.protocolVersion ?? 'unknown'
  const workspacePath = status?.workspacePath ?? workspaceInput
  const updateStatus = status?.updates
  const canUseUpdateMock = status?.runtimeMode === 'development'
  const activeTurnId = session.activeTurnId
  const timelineEvents = selectTimelineEvents(session)
  const todoOverlay = selectTodoOverlay(session)
  const canInterruptTurn = Boolean(activeTurnId && activeTurnId !== 'pending')
  const turnMetadata = mergeStatusTurnMetadata(
    session.turnMetadata,
    status?.lastTurn?.metadata,
  )
  const hasCustomTitleBar =
    status?.platform === 'win32' || navigator.userAgent.includes('Windows')

  async function runAction(action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    try {
      await action()
      const nextStatus = (await window.ccr.getStatus()) as DesktopStatus
      setStatus(nextStatus)
      setPermissionSettings(nextStatus.permissionSettings ?? null)
      setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')
    } finally {
      setBusy(false)
    }
  }

  function appendDisplayEvent(event: DisplayEvent): void {
    dispatchSession({ type: 'append-display-event', event })
  }

  function hasCompressibleMessages(): boolean {
    const contextMessageCount = status?.context?.messageCount
    if (typeof contextMessageCount === 'number') {
      return contextMessageCount > 0
    }

    return timelineEvents.some(
      event =>
        event.type === 'user_message' || event.type === 'assistant_message',
    )
  }

  async function sendPrompt(): Promise<void> {
    const text = prompt.trim()
    if (!text) {
      return
    }

    appendDisplayEvent(createUserDisplayEvent(`${Date.now()}-user`, text))
    dispatchSession({ type: 'set-active-turn', turnId: 'pending' })
    setPrompt('')

    if (isCompactCommand(text)) {
      dispatchSession({ type: 'set-active-turn', turnId: null })
      await runCompactFromDesktop(getCompactInstruction(text))
      return
    }

    await runAction(async () => {
      const result = (await window.ccr.startTurn(text)) as {
        turn?: { turnId?: string }
      }
      if (result.turn?.turnId) {
        dispatchSession({
          type: 'set-active-turn',
          turnId: result.turn.turnId,
        })
      }
    }).catch(error => {
      dispatchSession({ type: 'set-active-turn', turnId: null })
      appendDisplayEvent(
        createErrorDisplayEvent(
          `${Date.now()}-send-error`,
          error instanceof Error ? error.message : String(error),
        ),
      )
    })
  }

  async function runCompactFromDesktop(instruction?: string): Promise<void> {
    if (!hasCompressibleMessages()) {
      appendDisplayEvent(
        createSystemNoticeEvent(
          `${Date.now()}-compact-empty`,
          '当前会话暂无可压缩内容。',
        ),
      )
      return
    }

    await runAction(async () => {
      await window.ccr.runCompact(instruction)
    }).catch(error => {
      if (isNoMessagesToCompactError(error)) {
        appendDisplayEvent(
          createSystemNoticeEvent(
            `${Date.now()}-compact-empty`,
            '当前会话暂无可压缩内容。',
          ),
        )
        return
      }

      appendDisplayEvent(
        createErrorDisplayEvent(
          `${Date.now()}-compact-error`,
          error instanceof Error ? error.message : String(error),
        ),
      )
    })
  }

  async function startNewThread(): Promise<void> {
    await runAction(async () => {
      const result = await window.ccr.startThread('CCR Desktop 会话')
      const thread = result?.thread
      itemMetadataRef.current.clear()
      setPrompt('')
      setThreadHistory(createClosedThreadHistory(threadHistory))
      dispatchSession({
        type: 'reset-session',
        notice: thread?.threadId
          ? `已创建新会话：${thread.title ?? 'CCR Desktop 会话'}（${shortId(thread.threadId)}）。`
          : '已创建新会话。',
        noticeId: thread?.threadId
          ? `thread-started-${thread.threadId}`
          : `${Date.now()}-thread-started`,
      })
    }).catch(error => {
      appendDisplayEvent(
        createErrorDisplayEvent(
          `${Date.now()}-thread-start-error`,
          error instanceof Error ? error.message : String(error),
        ),
      )
    })
  }

  async function showThreadHistory(): Promise<void> {
    if (threadHistory.status !== 'closed') {
      setThreadHistory(createClosedThreadHistory(threadHistory))
      return
    }

    await loadThreadHistory()
  }

  async function loadThreadHistory(input: { query?: string } = {}): Promise<void> {
    const scope = 'allProjects'
    const query = input.query ?? threadHistory.query
    setThreadHistory({
      status: 'loading',
      scope,
      query,
      groups: [],
      threads: [],
    })
    await runAction(async () => {
      const result = await window.ccr.listSessionHistory({
        scope,
        query: query.trim() || undefined,
        limit: 80,
        includeCurrent: false,
      })
      const groups = Array.isArray(result?.groups) ? result.groups : []
      const threads = groups.flatMap(group =>
        Array.isArray(group.sessions) ? group.sessions : [],
      )
      if (threads.length === 0) {
        setThreadHistory({
          status: 'empty',
          scope,
          query,
          groups: [],
          threads: [],
          nextCursor: result?.nextCursor,
        })
        return
      }

      setThreadHistory({
        status: 'ready',
        scope,
        query,
        groups,
        threads,
        nextCursor: result?.nextCursor,
      })
    }).catch(error => {
      setThreadHistory({
        status: 'error',
        scope,
        query,
        groups: [],
        threads: [],
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  async function resumeThreadFromHistory(selectedThread: ThreadHistoryItem): Promise<void> {
    const sessionId = getThreadSessionId(selectedThread)
    if (!sessionId) {
      setThreadHistory({
        status: 'error',
        scope: threadHistory.scope,
        query: threadHistory.query,
        groups: threadHistory.groups,
        threads: threadHistory.threads,
        error: '该会话缺少 sessionId，当前版本无法恢复。',
      })
      return
    }
    const currentSessionId = getThreadSessionId(
      status?.thread as ThreadHistoryItem | undefined,
    )
    if (sessionId === currentSessionId) {
      setThreadHistory(createClosedThreadHistory(threadHistory))
      appendDisplayEvent(
        createSystemNoticeEvent(
          `${Date.now()}-thread-already-active`,
          '该历史会话已经是当前会话。',
        ),
      )
      return
    }

    await runAction(async () => {
      const resumeResult = await window.ccr.resumeThread({
        sessionId,
        ...(selectedThread.title ? { title: selectedThread.title } : {}),
        ...(selectedThread.transcriptPath
          ? { transcriptPath: selectedThread.transcriptPath }
          : {}),
        ...(selectedThread.projectPath
          ? { projectPath: selectedThread.projectPath }
          : {}),
      })
      const thread = resumeResult?.thread
      const replayActions = createHistoryReplayActions(resumeResult?.messages)
      itemMetadataRef.current.clear()
      setPrompt('')
      setThreadHistory(createClosedThreadHistory(threadHistory))
      dispatchSession({
        type: 'reset-session',
        notice: thread?.threadId
          ? `已恢复历史会话：${thread.title ?? '历史会话'}（${shortId(thread.threadId)}）。已回放 ${replayActions.length} 条历史事件。`
          : `已恢复历史会话。已回放 ${replayActions.length} 条历史事件。`,
        noticeId: thread?.threadId
          ? `thread-resumed-${thread.threadId}`
          : `${Date.now()}-thread-resumed`,
      })
      replayActions.forEach(action => dispatchSession(action))
    }).catch(error => {
      setThreadHistory({
        status: 'error',
        scope: threadHistory.scope,
        query: threadHistory.query,
        groups: threadHistory.groups,
        threads: threadHistory.threads,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  async function interruptCurrentTurn(): Promise<void> {
    if (!canInterruptTurn) {
      return
    }

    await runAction(async () => {
      await window.ccr.interruptTurn()
      dispatchSession({ type: 'set-active-turn', turnId: null })
    }).catch(error => {
      if (isTurnNotActiveError(error)) {
        dispatchSession({ type: 'set-active-turn', turnId: null })
        return
      }

      appendDisplayEvent(
        createErrorDisplayEvent(
          `${Date.now()}-interrupt-error`,
          error instanceof Error ? error.message : String(error),
        ),
      )
    })
  }

  async function respondPermission(
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload: PermissionRespondPayload = {},
  ): Promise<void> {
    const nextStatus = behavior === 'allow' ? 'allowed' : 'denied'
    dispatchSession({
      type: 'set-permission-status',
      permissionRequestId,
      status: nextStatus,
    })

    try {
      await runAction(() =>
        window.ccr.respondPermission({
          permissionRequestId,
          behavior,
          ...payload,
          message:
            payload.message ??
            (behavior === 'allow'
              ? 'Desktop user allowed once.'
              : 'Desktop user denied.'),
        }),
      )
      dispatchSession({ type: 'remove-permission', permissionRequestId })
    } catch (error) {
      dispatchSession({
        type: 'set-permission-status',
        permissionRequestId,
        status: 'pending',
      })
      appendDisplayEvent(
        createErrorDisplayEvent(
          `${Date.now()}-permission-error`,
          error instanceof Error ? error.message : String(error),
        ),
      )
    }
  }

  async function refreshLogs(): Promise<void> {
    const logs = (await window.ccr.getLogs()) as LogSnapshot
    setLogSnapshot(logs)
  }

  async function refreshPermissionSettings(): Promise<void> {
    const settings =
      (await window.ccr.getPermissionSettings()) as PermissionSettingsState
    setPermissionSettings(settings)
    setStatus(current =>
      current ? { ...current, permissionSettings: settings } : current,
    )
  }

  async function savePermissionSettings(
    input: PermissionSettingsUpdateInput,
  ): Promise<void> {
    await runAction(async () => {
      const settings =
        (await window.ccr.updatePermissionSettings(
          input,
        )) as PermissionSettingsState
      setPermissionSettings(settings)
    })
  }

  function runUpdateAction(kind: UpdateActionKind): void {
    if (kind === 'download') {
      void runAction(() => window.ccr.downloadUpdate())
      return
    }
    if (kind === 'install') {
      void runAction(() => window.ccr.installUpdate())
      return
    }
    void runAction(() => window.ccr.checkForUpdates())
  }

  function navigatePage(nextPage: PageId): void {
    if (nextPage === 'settings') {
      if (page !== 'settings') {
        setReturnPage(page as AppPageId)
      }
      setPage('settings')
      return
    }
    setReturnPage(nextPage)
    setPage(nextPage)
  }

  function closeSettings(): void {
    setPage(returnPage)
  }

  return (
    <div className={`app-frame ${hasCustomTitleBar ? 'has-titlebar' : ''}`}>
      {hasCustomTitleBar ? <WindowTitlebar /> : null}
      {page === 'settings' ? (
        <SettingsPage
          authText={authText}
          busy={busy}
          canUseUpdateMock={canUseUpdateMock}
          coreVersion={coreVersion}
          model={model}
          permissionSettings={permissionSettings}
          protocol={protocol}
          provider={provider}
          serverVersion={serverVersion}
          status={status}
          updateStatus={updateStatus}
          onBack={closeSettings}
          onCheckForUpdates={() =>
            void runAction(() => window.ccr.checkForUpdates())
          }
          onDownloadUpdate={() =>
            void runAction(() => window.ccr.downloadUpdate())
          }
          onInstallUpdate={() =>
            void runAction(() => window.ccr.installUpdate())
          }
          onMockUpdateState={mockStatus =>
            void runAction(() => window.ccr.mockUpdateState(mockStatus))
          }
          onRefreshPermissionSettings={() =>
            void runAction(() => refreshPermissionSettings())
          }
          onSavePermissionSettings={input => void savePermissionSettings(input)}
        />
      ) : (
        <main className="shell">
          <Sidebar page={page} onChangePage={navigatePage} />

          <section className="workspace">
            <Topbar
              appServerStatus={status?.appServer}
              authText={authText}
              busy={busy}
              compactStatus={status?.compact}
              contextStatus={status?.context}
              contextWindow={contextWindow}
              memoryStatus={status?.memory}
              model={model}
              provider={provider}
              turnMetadata={turnMetadata}
              updateStatus={updateStatus}
              workspacePath={workspacePath}
              onChooseWorkspace={() =>
                void runAction(() => window.ccr.chooseWorkspace())
              }
              onUpdateAction={runUpdateAction}
            />

            {page === 'chat' ? (
              <ChatPage
                activeTurnId={activeTurnId}
                busy={busy}
                canInterruptTurn={canInterruptTurn}
                compactStatus={status?.compact}
                contextStatus={status?.context}
                events={timelineEvents}
                memoryStatus={status?.memory}
                permissions={session.permissions}
                prompt={prompt}
                threadHistory={threadHistory}
                threadTitle={status?.thread?.title}
                todoOverlay={todoOverlay}
                turnMetadata={turnMetadata}
                onChangePrompt={setPrompt}
                onCloseHistory={() =>
                  setThreadHistory(createClosedThreadHistory(threadHistory))
                }
                onHistoryQueryChange={query =>
                  setThreadHistory(current => ({ ...current, query }))
                }
                onHistoryReload={() => void loadThreadHistory()}
                onInterrupt={interruptCurrentTurn}
                onRespondPermission={respondPermission}
                onResumeHistoryThread={resumeThreadFromHistory}
                onRunCompact={() => void runCompactFromDesktop()}
                onSend={sendPrompt}
                onShowHistory={() => void showThreadHistory()}
                onStartThread={() => void startNewThread()}
              />
            ) : null}

            {page === 'mcp' ? (
              <McpPage
                busy={busy}
                mcp={status?.mcp ?? { servers: [], errors: [] }}
                onRefresh={() => void runAction(() => window.ccr.refreshMcp())}
              />
            ) : null}

            {page === 'logs' ? (
              <LogsPage
                busy={busy}
                events={events}
                logSnapshot={logSnapshot}
                onRefresh={() => void runAction(() => refreshLogs())}
              />
            ) : null}
          </section>
        </main>
      )}
    </div>
  )
}

function isCompactCommand(text: string): boolean {
  return text === '/compact' || text.startsWith('/compact ')
}

function getCompactInstruction(text: string): string | undefined {
  const instruction = text.slice('/compact'.length).trim()
  return instruction || undefined
}

function isTurnNotActiveError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Turn is not active')
}

function isNoMessagesToCompactError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('no messages to compact')
  )
}

function getThreadSessionId(thread: ThreadHistoryItem | undefined): string | null {
  if (typeof thread?.sessionId === 'string' && thread.sessionId.trim()) {
    return thread.sessionId
  }
  const sessionId = thread?.metadata?.sessionId
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId : null
}

function createHistoryReplayActions(value: unknown): SessionAction[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((message, index) =>
    createHistoryReplayActionsForMessage(message, index),
  )
}

function createHistoryReplayActionsForMessage(
  value: unknown,
  index: number,
): SessionAction[] {
  const message = normalizeHistoryThreadMessage(value, index)
  if (!message) {
    return []
  }

  const object = value as Record<string, unknown>
  const content = 'content' in object ? object.content : undefined
  const blocks = normalizeContentBlocks(content)
  if (content === undefined || !blocks.some(isHistoryToolLifecycleBlock)) {
    return [{ type: 'append-message', message }]
  }

  const itemId = message.id
  const kind = getHistoryCompletedItemKind(message.kind, object.sourceType, message.role)
  const statusText = message.status ?? 'completed'
  const context = createCompletedItemContractContext({
    itemId,
    params: compactJsonObject({
      sourceType: object.sourceType,
      createdAt: object.createdAt,
    }),
  })
  if (shouldSplitHistoryBlocks(blocks)) {
    return blocks.map((block, contentIndex) => ({
      type: 'upsert-completed-item-message',
      itemId: createHistorySplitItemId(itemId, block, contentIndex),
      kind,
      content: [block],
      statusText,
      context: withContentBlock(context, block, contentIndex),
    }))
  }

  return [
    {
      type: 'upsert-completed-item-message',
      itemId,
      kind,
      content,
      statusText,
      context,
    },
  ]
}

function normalizeHistoryThreadMessage(
  value: unknown,
  index: number,
): ChatMessage | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const object = value as Record<string, unknown>
  const text = typeof object.text === 'string' ? object.text.trim() : ''
  if (!text) {
    return null
  }

  return {
    id:
      typeof object.id === 'string' && object.id.trim()
        ? object.id
        : `history-message-${index}`,
    role: normalizeChatRole(object.role),
    text,
    ...(typeof object.status === 'string' ? { status: object.status } : {}),
    ...(typeof object.kind === 'string' ? { kind: object.kind } : {}),
  }
}

function getHistoryCompletedItemKind(
  kind: string | undefined,
  sourceType: unknown,
  role: ChatMessage['role'],
): string | undefined {
  if (role === 'assistant' || sourceType === 'assistant') {
    return 'assistant_message'
  }
  if (role === 'user' || sourceType === 'user') {
    return 'user_message'
  }
  if (sourceType === 'progress') {
    return 'tool_progress'
  }
  return typeof sourceType === 'string' ? sourceType : kind
}

function normalizeChatRole(value: unknown): ChatMessage['role'] {
  if (
    value === 'user' ||
    value === 'assistant' ||
    value === 'system' ||
    value === 'error'
  ) {
    return value
  }
  return 'system'
}

function shouldSplitHistoryBlocks(blocks: JsonObject[]): boolean {
  return blocks.length > 1 && blocks.some(isHistoryToolLifecycleBlock)
}

function isHistoryToolLifecycleBlock(block: JsonObject): boolean {
  const type = typeof block.type === 'string' ? block.type : ''
  return type === 'tool_use' || type === 'tool_result' || type === 'progress'
}

function createHistorySplitItemId(
  itemId: string,
  block: JsonObject,
  contentIndex: number,
): string {
  const lifecycleId = getStringFromUnknown(
    block.id ??
      block.toolUseId ??
      block.toolUseID ??
      block.tool_use_id ??
      block.parentToolUseId ??
      block.parentToolUseID ??
      block.parent_tool_use_id,
  )
  const suffix = lifecycleId
    ? sanitizeHistoryItemIdPart(lifecycleId)
    : String(contentIndex)
  return `${itemId}:${contentIndex}:${suffix}`
}

function sanitizeHistoryItemIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80)
}

function getStringFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function compactJsonObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, unknown] => {
      const [, entryValue] = entry
      return entryValue !== undefined
    }),
  )
}

function shortId(value: unknown): string {
  return typeof value === 'string' && value.length > 10
    ? value.slice(0, 10)
    : String(value ?? 'unknown')
}

function createClosedThreadHistory(
  current: ThreadHistoryState,
): ThreadHistoryState {
  return {
    status: 'closed',
    scope: 'allProjects',
    query: current.query,
    groups: [],
    threads: [],
  }
}

function mergeStatusTurnMetadata(
  sessionMetadata: TurnRuntimeMetadata | null,
  statusMetadata: TurnRuntimeMetadata | undefined,
): TurnRuntimeMetadata | null {
  if (!sessionMetadata && !statusMetadata) {
    return null
  }

  return {
    ...(statusMetadata ?? {}),
    ...(sessionMetadata ?? {}),
    usage: {
      ...(statusMetadata?.usage ?? {}),
      ...(sessionMetadata?.usage ?? {}),
    },
  }
}

createRoot(document.getElementById('root')!).render(<App />)
