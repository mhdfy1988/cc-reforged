import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import type { CcrDesktopEvent } from './global.js'

type DesktopStatus = {
  appServer: string
  repoRoot: string
  runtimeMode: string
  workspacePath: string | null
  initialized: {
    serverVersion?: string
    protocolVersion: string
    schemaVersions?: {
      config?: string
    }
    serverInfo: {
      version?: string
      serverVersion?: string
      coreVersion: string
    }
  } | null
  protocolCompatibility: {
    compatible: boolean
    supportedProtocol: string
    actualProtocol: string
    reason?: string
  } | null
  config: {
    llm?: {
      provider?: string
      model?: string
      contextWindow?: number
    }
  } | null
  auth: {
    available?: boolean
    provider?: string
  } | null
  mcp: {
    servers?: unknown[]
    errors?: unknown[]
  } | null
  thread: {
    threadId: string
    title: string
  } | null
  lastTurn: {
    turnId: string
    status: string
  } | null
  updates: DesktopUpdateState | null
  lastError: string | null
}

type DesktopUpdateState = {
  status: string
  enabled: boolean
  currentVersion: string
  source: string
  availableUpdate: {
    version?: string
    releaseName?: string
    releaseDate?: string
  } | null
  progress: {
    percent: number
    transferred?: number
    total?: number
    bytesPerSecond?: number
  } | null
  lastCheckedAt: string | null
  lastError: string | null
  disabledReason: string | null
  canCheck: boolean
  canDownload: boolean
  canInstall: boolean
}

type JsonObject = Record<string, unknown>

type NotificationPayload = {
  method: string
  params?: JsonObject
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'error'
  text: string
  status?: string
}

type PermissionCard = {
  permissionRequestId: string
  toolName: string
  input: JsonObject
  status: 'pending' | 'allowed' | 'denied' | 'cancelled'
}

type PageId = 'chat' | 'mcp' | 'settings' | 'logs'

type LogSnapshot = {
  logDir: string
  files: Array<{
    name: string
    path: string
    content: string
  }>
}

function App() {
  const [status, setStatus] = useState<DesktopStatus | null>(null)
  const [events, setEvents] = useState<CcrDesktopEvent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Desktop 原型已启动。你可以先打开工作区，再发送一条任务测试 App Server 事件流。',
    },
  ])
  const [permissions, setPermissions] = useState<PermissionCard[]>([])
  const [workspaceInput, setWorkspaceInput] = useState('')
  const [prompt, setPrompt] = useState('')
  const [page, setPage] = useState<PageId>('chat')
  const [logSnapshot, setLogSnapshot] = useState<LogSnapshot | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.ccr.getStatus().then((nextStatus: DesktopStatus) => {
      setStatus(nextStatus)
      setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')
    })
    refreshLogs().catch(() => undefined)

    return window.ccr.onEvent(event => {
      setEvents(current => [event, ...current].slice(0, 80))
      setStatus(event.status as DesktopStatus)
      applyDesktopEvent(event)
    })
  }, [])

  const model = status?.config?.llm?.model ?? '模型待加载'
  const provider = status?.config?.llm?.provider ?? 'provider 待加载'
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

  function appendMessage(message: ChatMessage): void {
    setMessages(current => [...current, message])
  }

  function upsertAssistantDelta(itemId: string, text: string): void {
    setMessages(current => {
      const index = current.findIndex(message => message.id === itemId)
      if (index === -1) {
        return [
          ...current,
          {
            id: itemId,
            role: 'assistant',
            text,
            status: 'streaming',
          },
        ]
      }

      return current.map((message, messageIndex) =>
        messageIndex === index
          ? { ...message, text: `${message.text}${text}`, status: 'streaming' }
          : message,
      )
    })
  }

  function markAssistantCompleted(itemId: string, statusText: string): void {
    setMessages(current =>
      current.map(message =>
        message.id === itemId ? { ...message, status: statusText } : message,
      ),
    )
  }

  function applyDesktopEvent(event: CcrDesktopEvent): void {
    if (event.type !== 'notification') {
      if (event.type === 'client-error') {
        appendMessage({
          id: `${event.at}-client-error`,
          role: 'error',
          text: stringifyErrorPayload(event.payload),
        })
      }
      return
    }

    const notification = event.payload as NotificationPayload
    const params = notification.params ?? {}

    if (notification.method === 'turn/started') {
      appendMessage({
        id: `${event.at}-turn-started`,
        role: 'system',
        text: `Turn 已开始：${String(params.turnId ?? 'unknown')}`,
      })
      return
    }

    if (notification.method === 'item/delta') {
      const itemId = String(params.itemId ?? `${event.at}-assistant`)
      const delta = (params.delta ?? {}) as JsonObject
      if (delta.type === 'text' && typeof delta.text === 'string') {
        upsertAssistantDelta(itemId, delta.text)
      }
      return
    }

    if (notification.method === 'item/completed') {
      const itemId = String(params.itemId ?? '')
      if (itemId) {
        markAssistantCompleted(itemId, String(params.status ?? 'completed'))
      }
      return
    }

    if (notification.method === 'turn/completed') {
      appendMessage({
        id: `${event.at}-turn-completed`,
        role: 'system',
        text: 'Turn 已完成。',
      })
      return
    }

    if (notification.method === 'turn/failed') {
      appendMessage({
        id: `${event.at}-turn-failed`,
        role: 'error',
        text: stringifyErrorPayload(params.error ?? params),
      })
      return
    }

    if (notification.method === 'permission/requested') {
      setPermissions(current => [
        {
          permissionRequestId: String(params.permissionRequestId),
          toolName: getToolName(params),
          input: (params.input ?? {}) as JsonObject,
          status: 'pending',
        },
        ...current,
      ])
      return
    }

    if (notification.method === 'permission/cancelled') {
      const permissionRequestId = String(params.permissionRequestId ?? '')
      setPermissions(current =>
        current.map(permission =>
          permission.permissionRequestId === permissionRequestId
            ? { ...permission, status: 'cancelled' }
            : permission,
        ),
      )
    }
  }

  async function sendPrompt(): Promise<void> {
    const text = prompt.trim()
    if (!text) {
      return
    }

    appendMessage({
      id: `${Date.now()}-user`,
      role: 'user',
      text,
    })
    setPrompt('')

    await runAction(async () => {
      await window.ccr.startTurn(text)
    }).catch(error => {
      appendMessage({
        id: `${Date.now()}-send-error`,
        role: 'error',
        text: error instanceof Error ? error.message : String(error),
      })
    })
  }

  async function respondPermission(
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
  ): Promise<void> {
    setPermissions(current =>
      current.map(permission =>
        permission.permissionRequestId === permissionRequestId
          ? {
              ...permission,
              status: behavior === 'allow' ? 'allowed' : 'denied',
            }
          : permission,
      ),
    )

    await runAction(() =>
      window.ccr.respondPermission({
        permissionRequestId,
        behavior,
        message: behavior === 'allow' ? 'Desktop user allowed once.' : 'Desktop user denied.',
      }),
    )
  }

  async function refreshLogs(): Promise<void> {
    const logs = (await window.ccr.getLogs()) as LogSnapshot
    setLogSnapshot(logs)
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>CCR Desktop</strong>
            <span>v0.1 prototype</span>
          </div>
        </div>
        <nav className="nav">
          <button
            className={`nav-item ${page === 'chat' ? 'active' : ''}`}
            onClick={() => setPage('chat')}
          >
            聊天
          </button>
          <button
            className={`nav-item ${page === 'mcp' ? 'active' : ''}`}
            onClick={() => setPage('mcp')}
          >
            MCP
          </button>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => setPage('settings')}
          >
            设置
          </button>
          <button
            className={`nav-item ${page === 'logs' ? 'active' : ''}`}
            onClick={() => setPage('logs')}
          >
            日志
          </button>
        </nav>
        <div className="core-pill">
          <span className={status?.appServer === 'ready' ? 'dot ok' : 'dot warn'} />
          {status?.appServer ?? 'starting'}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="workspace-card">
            <span className="folder">□</span>
            <div>
              <strong>{workspacePath || '未选择工作区'}</strong>
              <span>Core {coreVersion} · Protocol {protocol}</span>
            </div>
          </div>
          <button className="model-chip">{model}</button>
          <div className="context-chip">上下文 0K / 200K</div>
          <div className="health-chip">
            <span className={status?.appServer === 'ready' ? 'dot ok' : 'dot warn'} />
            {provider} · {authText}
          </div>
          <TopbarUpdateNotice
            busy={busy}
            updateStatus={updateStatus}
            onAction={runAction}
          />
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow">当前任务现场</p>
            <h1>Desktop 已接入 App Server Client SDK</h1>
            <p>
              这个原型已经不是静态壳：main process 会启动本地 App Server，
              renderer 只能通过 preload 白名单 API 访问。
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => runAction(() => window.ccr.restartAppServer())}
          >
            重启 App Server
          </button>
        </section>

        <section className="panel controls">
          <label>
            工作区
            <input
              value={workspaceInput}
              onChange={event => setWorkspaceInput(event.target.value)}
              placeholder="D:\\agent_project\\claude-code-reforged"
            />
          </label>
          <button
            disabled={busy}
            onClick={() => runAction(() => window.ccr.chooseWorkspace())}
          >
            选择
          </button>
          <button
            disabled={busy || !workspaceInput}
            onClick={() => runAction(() => window.ccr.openWorkspace(workspaceInput))}
          >
            信任并打开
          </button>
          <button
            disabled={busy}
            onClick={() => runAction(() => window.ccr.startThread('CCR Desktop 会话'))}
          >
            新建会话
          </button>
        </section>

        {page === 'chat' ? (
          <>
            <section className="chat">
              {messages.map(message => (
                <div className={`message ${message.role}`} key={message.id}>
                  <b>{getRoleLabel(message.role)}</b>
                  <span>
                    {message.text}
                    {message.status ? <small> · {message.status}</small> : null}
                  </span>
                </div>
              ))}

              {permissions.map(permission => (
                <div className="permission-card" key={permission.permissionRequestId}>
                  <div>
                    <b>权限请求</b>
                    <strong>{permission.toolName}</strong>
                    <span>{permission.status}</span>
                  </div>
                  <pre>{JSON.stringify(permission.input, null, 2)}</pre>
                  <div className="permission-actions">
                    <button
                      disabled={permission.status !== 'pending'}
                      onClick={() =>
                        respondPermission(permission.permissionRequestId, 'allow')
                      }
                    >
                      允许一次
                    </button>
                    <button
                      className="danger"
                      disabled={permission.status !== 'pending'}
                      onClick={() =>
                        respondPermission(permission.permissionRequestId, 'deny')
                      }
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <footer className="composer">
              <button className="plus">+</button>
              <input
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && prompt.trim()) {
                    sendPrompt()
                  }
                }}
                placeholder="输入任务，按 Enter 发送..."
              />
              <button
                className="send"
                disabled={busy || !prompt.trim()}
                onClick={() => sendPrompt()}
              >
                发送
              </button>
            </footer>
          </>
        ) : null}

        {page === 'mcp' ? (
          <section className="page-panel">
            <div className="page-title">
              <div>
                <p className="eyebrow">MCP 管理</p>
                <h2>当前 MCP 配置</h2>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => runAction(() => window.ccr.refreshMcp())}
              >
                刷新 MCP
              </button>
            </div>
            <pre>{JSON.stringify(status?.mcp ?? { servers: [], errors: [] }, null, 2)}</pre>
          </section>
        ) : null}

        {page === 'settings' ? (
          <section className="page-panel cards-grid">
            <InfoCard title="模型" value={model} detail={`provider: ${provider}`} />
            <InfoCard title="认证" value={authText} detail={status?.auth?.provider ?? 'unknown'} />
            <InfoCard title="Core" value={coreVersion} detail={`protocol: ${protocol}`} />
            <InfoCard
              title="App Server"
              value={serverVersion}
              detail={
                status?.protocolCompatibility?.compatible
                  ? 'protocol compatible'
                  : status?.protocolCompatibility?.reason ?? 'checking compatibility'
              }
            />
            <InfoCard
              title="运行时"
              value={status?.runtimeMode ?? 'unknown'}
              detail={status?.repoRoot ?? ''}
            />
            <InfoCard
              title="工作区"
              value={status?.workspacePath ? '已打开' : '未打开'}
              detail={status?.workspacePath ?? status?.repoRoot ?? ''}
            />
            <article className="info-card update-card">
              <span>自动更新</span>
              <strong>{getUpdateStatusText(updateStatus)}</strong>
              <small>{getUpdateDetailText(updateStatus)}</small>
              {updateStatus?.progress ? (
                <div className="progress-bar">
                  <span style={{ width: `${updateStatus.progress.percent}%` }} />
                </div>
              ) : null}
              <div className="inline-actions">
                <button
                  disabled={busy || !updateStatus?.canCheck}
                  onClick={() => runAction(() => window.ccr.checkForUpdates())}
                >
                  检查更新
                </button>
                <button
                  disabled={busy || !updateStatus?.canDownload}
                  onClick={() => runAction(() => window.ccr.downloadUpdate())}
                >
                  下载
                </button>
                <button
                  disabled={busy || !updateStatus?.canInstall}
                  onClick={() => runAction(() => window.ccr.installUpdate())}
                >
                  重启安装
                </button>
              </div>
            </article>
          </section>
        ) : null}

        {page === 'logs' ? (
          <section className="page-panel logs">
            <div className="page-title">
              <div>
                <p className="eyebrow">运行日志</p>
                <h2>最近事件</h2>
                <span>{logSnapshot?.logDir ?? '日志目录待加载'}</span>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => runAction(() => refreshLogs())}
              >
                刷新日志
              </button>
            </div>
            <div className="log-files">
              {(logSnapshot?.files ?? []).map(file => (
                <details className="event-card" key={file.name} open={Boolean(file.content)}>
                  <summary>
                    <span>{file.name}</span>
                    <small>{file.content ? `${file.content.length} chars` : 'empty'}</small>
                  </summary>
                  <pre>{file.content || '暂无日志内容'}</pre>
                </details>
              ))}
            </div>
            <div className="page-title compact">
              <div>
                <p className="eyebrow">内存事件</p>
                <h2>最近 notification</h2>
              </div>
              <span>{events.length} events</span>
            </div>
            {events.map(event => (
              <details className="event-card" key={`${event.at}-${event.type}`}>
                <summary>
                  <span>{event.type}</span>
                  <small>{event.at}</small>
                </summary>
                <pre>{JSON.stringify(event.payload, null, 2)}</pre>
              </details>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  )
}

function InfoCard(props: { title: string; value: string; detail: string }) {
  return (
    <article className="info-card">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  )
}

function TopbarUpdateNotice(props: {
  busy: boolean
  updateStatus: DesktopUpdateState | null | undefined
  onAction: (action: () => Promise<unknown>) => Promise<void>
}) {
  const updateStatus = props.updateStatus
  if (!shouldShowTopbarUpdateNotice(updateStatus)) {
    return null
  }

  const action = getTopbarUpdateAction(updateStatus)
  const progress =
    updateStatus?.status === 'downloading'
      ? `${Math.round(updateStatus.progress?.percent ?? 0)}%`
      : null

  return (
    <div className={`topbar-update ${updateStatus?.status ?? 'idle'}`}>
      <div>
        <strong>{getTopbarUpdateTitle(updateStatus)}</strong>
        <span>{getTopbarUpdateSubtitle(updateStatus)}</span>
      </div>
      {progress ? <em>{progress}</em> : null}
      {action ? (
        <button
          disabled={props.busy || action.disabled}
          onClick={() => props.onAction(action.run)}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

function getRoleLabel(role: ChatMessage['role']): string {
  if (role === 'user') {
    return '我'
  }
  if (role === 'assistant') {
    return 'C'
  }
  if (role === 'error') {
    return '!'
  }
  return 'i'
}

function getToolName(params: JsonObject): string {
  const tool = params.tool
  if (tool && typeof tool === 'object' && 'name' in tool) {
    return String((tool as JsonObject).name)
  }
  return '未知工具'
}

function stringifyErrorPayload(payload: unknown): string {
  if (!payload) {
    return '未知错误'
  }
  if (typeof payload === 'string') {
    return payload
  }
  if (payload instanceof Error) {
    return payload.message
  }
  if (typeof payload === 'object') {
    const object = payload as JsonObject
    if (typeof object.message === 'string') {
      return object.message
    }
    if (typeof object.kind === 'string') {
      return object.kind
    }
  }
  return JSON.stringify(payload)
}

function getUpdateStatusText(updateStatus: DesktopUpdateState | null | undefined): string {
  if (!updateStatus) {
    return '初始化中'
  }
  if (!updateStatus.enabled) {
    return '开发态已禁用'
  }
  if (updateStatus.status === 'available') {
    return `发现 ${updateStatus.availableUpdate?.version ?? '新版本'}`
  }
  if (updateStatus.status === 'downloaded') {
    return '更新已下载'
  }
  if (updateStatus.status === 'downloading') {
    return `下载中 ${updateStatus.progress?.percent ?? 0}%`
  }
  return updateStatus.status
}

function shouldShowTopbarUpdateNotice(
  updateStatus: DesktopUpdateState | null | undefined,
): boolean {
  return Boolean(
    updateStatus?.enabled &&
      ['available', 'downloading', 'downloaded', 'installing', 'error'].includes(
        updateStatus.status,
      ),
  )
}

function getTopbarUpdateTitle(
  updateStatus: DesktopUpdateState | null | undefined,
): string {
  if (updateStatus?.status === 'downloaded') {
    return '更新已就绪'
  }
  if (updateStatus?.status === 'downloading') {
    return '正在下载更新'
  }
  if (updateStatus?.status === 'installing') {
    return '正在安装更新'
  }
  if (updateStatus?.status === 'error') {
    return '更新检查失败'
  }
  return `发现 ${updateStatus?.availableUpdate?.version ?? '新版本'}`
}

function getTopbarUpdateSubtitle(
  updateStatus: DesktopUpdateState | null | undefined,
): string {
  if (!updateStatus) {
    return ''
  }
  if (updateStatus.lastError) {
    return updateStatus.lastError
  }
  if (updateStatus.availableUpdate?.version) {
    return `当前 ${updateStatus.currentVersion} -> ${updateStatus.availableUpdate.version}`
  }
  return `当前 ${updateStatus.currentVersion}`
}

function getTopbarUpdateAction(
  updateStatus: DesktopUpdateState | null | undefined,
):
  | {
      label: string
      disabled: boolean
      run: () => Promise<unknown>
    }
  | null {
  if (!updateStatus) {
    return null
  }
  if (updateStatus.canDownload) {
    return {
      label: '下载更新',
      disabled: false,
      run: () => window.ccr.downloadUpdate(),
    }
  }
  if (updateStatus.canInstall) {
    return {
      label: '重启安装',
      disabled: false,
      run: () => window.ccr.installUpdate(),
    }
  }
  if (updateStatus.status === 'error' && updateStatus.canCheck) {
    return {
      label: '重试',
      disabled: false,
      run: () => window.ccr.checkForUpdates(),
    }
  }
  return null
}

function getUpdateDetailText(updateStatus: DesktopUpdateState | null | undefined): string {
  if (!updateStatus) {
    return '等待主进程返回更新状态'
  }
  if (updateStatus.disabledReason) {
    return updateStatus.disabledReason
  }
  if (updateStatus.lastError) {
    return updateStatus.lastError
  }
  if (updateStatus.availableUpdate?.version) {
    return `当前 ${updateStatus.currentVersion}，可用 ${updateStatus.availableUpdate.version}`
  }
  return `当前 ${updateStatus.currentVersion} · ${updateStatus.source}`
}

createRoot(document.getElementById('root')!).render(<App />)
