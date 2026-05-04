import { useEffect, useReducer, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import {
  initialSessionState,
  selectTimelineEvents,
  selectTodoOverlay,
  sessionReducer,
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
  createUserDisplayEvent,
  type DisplayEvent,
} from './domain/displayEvents.js'
import type {
  DesktopStatus,
  JsonObject,
  LogSnapshot,
  PageId,
  TurnRuntimeMetadata,
} from './domain/displayTypes.js'
import type { UpdateActionKind } from './domain/updateDisplay.js'
import type { CcrDesktopEvent } from './global.js'

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
  const [logSnapshot, setLogSnapshot] = useState<LogSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const itemMetadataRef = useRef<Map<string, JsonObject>>(new Map())

  useEffect(() => {
    window.ccr.getStatus().then((nextStatus: DesktopStatus) => {
      setStatus(nextStatus)
      setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')
    })
    refreshLogs().catch(() => undefined)

    return window.ccr.onEvent(event => {
      setEvents(current => [event, ...current].slice(0, 80))
      setStatus(event.status as DesktopStatus)
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
      setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')
    } finally {
      setBusy(false)
    }
  }

  function appendDisplayEvent(event: DisplayEvent): void {
    dispatchSession({ type: 'append-display-event', event })
  }

  async function sendPrompt(): Promise<void> {
    const text = prompt.trim()
    if (!text) {
      return
    }

    appendDisplayEvent(createUserDisplayEvent(`${Date.now()}-user`, text))
    dispatchSession({ type: 'set-active-turn', turnId: 'pending' })
    setPrompt('')

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
          message:
            behavior === 'allow'
              ? 'Desktop user allowed once.'
              : 'Desktop user denied.',
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

  return (
    <div className={`app-frame ${hasCustomTitleBar ? 'has-titlebar' : ''}`}>
      {hasCustomTitleBar ? <WindowTitlebar /> : null}
      <main className="shell">
        <Sidebar
          appServerStatus={status?.appServer}
          page={page}
          onChangePage={setPage}
        />

        <section className="workspace">
          <Topbar
            appServerStatus={status?.appServer}
            authText={authText}
            busy={busy}
            model={model}
            provider={provider}
            contextWindow={contextWindow}
            turnMetadata={turnMetadata}
            updateStatus={updateStatus}
            workspacePath={workspacePath}
            onChooseWorkspace={() => void runAction(() => window.ccr.chooseWorkspace())}
            onUpdateAction={runUpdateAction}
          />

          {page === 'chat' ? (
            <ChatPage
              activeTurnId={activeTurnId}
              busy={busy}
              canInterruptTurn={canInterruptTurn}
              events={timelineEvents}
              permissions={session.permissions}
              prompt={prompt}
              threadTitle={status?.thread?.title}
              turnMetadata={turnMetadata}
              todoOverlay={todoOverlay}
              onChangePrompt={setPrompt}
              onInterrupt={interruptCurrentTurn}
              onRespondPermission={respondPermission}
              onSend={sendPrompt}
              onStartThread={() =>
                void runAction(() => window.ccr.startThread('CCR Desktop 会话'))
              }
            />
          ) : null}

          {page === 'mcp' ? (
            <McpPage
              busy={busy}
              mcp={status?.mcp ?? { servers: [], errors: [] }}
              onRefresh={() => void runAction(() => window.ccr.refreshMcp())}
            />
          ) : null}

          {page === 'settings' ? (
            <SettingsPage
              authText={authText}
              busy={busy}
              canUseUpdateMock={canUseUpdateMock}
              coreVersion={coreVersion}
              model={model}
              protocol={protocol}
              provider={provider}
              serverVersion={serverVersion}
              status={status}
              updateStatus={updateStatus}
              onCheckForUpdates={() => void runAction(() => window.ccr.checkForUpdates())}
              onDownloadUpdate={() => void runAction(() => window.ccr.downloadUpdate())}
              onInstallUpdate={() => void runAction(() => window.ccr.installUpdate())}
              onMockUpdateState={mockStatus =>
                void runAction(() => window.ccr.mockUpdateState(mockStatus))
              }
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
    </div>
  )
}

function isTurnNotActiveError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Turn is not active')
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
