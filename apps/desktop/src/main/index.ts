import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AppServerClientError,
  startManagedStdioAppServerClient,
  type ManagedStdioAppServerClient,
} from '../../../../src/app-server/client/index.js'
import { DesktopUpdateService } from './updateService.js'
import type { DesktopUpdateState, DesktopUpdateStatus } from './updateState.js'
import type {
  AuthStatusResult,
  ConfigGetResult,
  InitializeResult,
  JsonRpcNotification,
  McpListResult,
  ThreadStartResult,
  TurnInterruptResult,
  TurnStartResult,
  WorkspaceOpenResult,
} from '../../../../src/app-server/protocol.js'

type DesktopAppServerStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'failed'
  | 'stopped'

type DesktopRuntimeMode = 'development' | 'packaged'

type DesktopRuntime = {
  mode: DesktopRuntimeMode
  root: string
  command: string
  commandArgs: string[]
  env: NodeJS.ProcessEnv
}

type DesktopStatus = {
  appServer: DesktopAppServerStatus
  platform: NodeJS.Platform
  repoRoot: string
  runtimeMode: DesktopRuntimeMode
  workspacePath: string | null
  initialized: InitializeResult | null
  protocolCompatibility: ProtocolCompatibility | null
  config: ConfigGetResult | null
  auth: AuthStatusResult | null
  mcp: McpListResult | null
  thread: ThreadStartResult['thread'] | null
  lastTurn: TurnStartResult['turn'] | null
  updates: DesktopUpdateState | null
  lastError: string | null
}

type DesktopLogSnapshot = {
  logDir: string
  files: Array<{
    name: string
    path: string
    content: string
  }>
}

type ProtocolCompatibility = {
  compatible: boolean
  supportedProtocol: string
  actualProtocol: string
  reason?: string
}

app.setName('CCR Desktop')

const __dirname = dirname(fileURLToPath(import.meta.url))
const runtime = resolveDesktopRuntime()
const repoRoot = runtime.root
const defaultWorkspacePath =
  process.env.CCR_DESKTOP_WORKSPACE ??
  (runtime.mode === 'packaged'
    ? process.env.USERPROFILE ?? process.env.HOME ?? runtime.root
    : runtime.root)

let mainWindow: BrowserWindow | null = null
let managedClient: ManagedStdioAppServerClient | null = null
let bootPromise: Promise<void> | null = null
let updateService: DesktopUpdateService | null = null
let updateInstallInProgress = false

const status: DesktopStatus = {
  appServer: 'idle',
  platform: process.platform,
  repoRoot,
  runtimeMode: runtime.mode,
  workspacePath: null,
  initialized: null,
  protocolCompatibility: null,
  config: null,
  auth: null,
  mcp: null,
  thread: null,
  lastTurn: null,
  updates: null,
  lastError: null,
}

const SUPPORTED_APP_SERVER_PROTOCOL = '0.1'

function evaluateProtocolCompatibility(protocolVersion: string): ProtocolCompatibility {
  if (protocolVersion === SUPPORTED_APP_SERVER_PROTOCOL) {
    return {
      compatible: true,
      supportedProtocol: SUPPORTED_APP_SERVER_PROTOCOL,
      actualProtocol: protocolVersion,
    }
  }

  return {
    compatible: false,
    supportedProtocol: SUPPORTED_APP_SERVER_PROTOCOL,
    actualProtocol: protocolVersion,
    reason: `Desktop only supports App Server protocol ${SUPPORTED_APP_SERVER_PROTOCOL}.`,
  }
}

function resolveDesktopRuntime(): DesktopRuntime {
  const configuredRoot = process.env.CCR_DESKTOP_REPO_ROOT
  if (configuredRoot) {
    return {
      mode: 'development',
      root: resolve(configuredRoot),
      command: process.env.CCR_DESKTOP_NODE_COMMAND ?? 'node',
      commandArgs: ['cli.js'],
      env: process.env,
    }
  }

  if (app.isPackaged) {
    return {
      mode: 'packaged',
      root: join(process.resourcesPath, 'app.asar.unpacked'),
      command: process.execPath,
      commandArgs: ['cli.js'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
    }
  }

  return {
    mode: 'development',
    root: resolve(process.cwd()),
    command: process.env.CCR_DESKTOP_NODE_COMMAND ?? 'node',
    commandArgs: ['cli.js'],
    env: process.env,
  }
}

function broadcast(type: string, payload: unknown): void {
  void appendDesktopLog('main.log', {
    type,
    summary: summarizeLogPayload(type, payload),
  })
  mainWindow?.webContents.send('ccr:event', {
    type,
    payload,
    status: getSafeStatus(),
    at: new Date().toISOString(),
  })
}

function getSafeStatus(): DesktopStatus {
  return { ...status }
}

function getLogDir(): string {
  return join(app.getPath('userData'), 'logs')
}

async function appendDesktopLog(
  fileName: 'main.log' | 'app-server.stderr.log' | 'client-error.log' | 'renderer.log',
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const logDir = getLogDir()
    await mkdir(logDir, { recursive: true })
    const line = `${redactLogText(
      JSON.stringify({
        at: new Date().toISOString(),
        ...payload,
      }),
    )}\n`
    await appendFile(join(logDir, fileName), line, 'utf8')
  } catch {
    // 日志不能反向影响主流程。
  }
}

async function readDesktopLogs(): Promise<DesktopLogSnapshot> {
  const logDir = getLogDir()
  const files = await Promise.all(
    ['main.log', 'app-server.stderr.log', 'client-error.log', 'renderer.log'].map(
      async name => ({
        name,
        path: join(logDir, name),
        content: await readRecentLogFile(join(logDir, name)),
      }),
    ),
  )

  return {
    logDir,
    files,
  }
}

async function readRecentLogFile(path: string): Promise<string> {
  try {
    const content = await readFile(path, 'utf8')
    return content.slice(-64_000)
  } catch {
    return ''
  }
}

function summarizeLogPayload(type: string, payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return { value: String(payload ?? '') }
  }

  const object = payload as Record<string, unknown>
  if (type === 'notification') {
    return {
      method: object.method,
      turnId: getNestedValue(object, 'params', 'turnId'),
      itemId: getNestedValue(object, 'params', 'itemId'),
      permissionRequestId: getNestedValue(object, 'params', 'permissionRequestId'),
    }
  }

  if (type === 'client-error') {
    return {
      kind: object.kind,
      message: object.message,
    }
  }

  return {
    message: object.message,
    error: object.error,
  }
}

function getNestedValue(
  object: Record<string, unknown>,
  key: string,
  childKey: string,
): unknown {
  const child = object[key]
  if (!child || typeof child !== 'object') {
    return undefined
  }
  return (child as Record<string, unknown>)[childKey]
}

function redactLogText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(
      /"(accessToken|refreshToken|apiKey|token|authorization)"\s*:\s*"[^"]*"/gi,
      '"$1":"[REDACTED]"',
    )
    .replace(
      /(CLAUDE_CODE_CODEX_OAUTH_[A-Z0-9_]+|CCR_CODEX_OAUTH_[A-Z0-9_]+)=\S+/g,
      '$1=[REDACTED]',
    )
}

async function ensureAppServer(): Promise<void> {
  if (status.appServer === 'ready' && managedClient) {
    return
  }

  if (bootPromise) {
    return bootPromise
  }

  bootPromise = bootstrapAppServer().finally(() => {
    bootPromise = null
  })

  return bootPromise
}

async function bootstrapAppServer(): Promise<void> {
  status.appServer = 'starting'
  status.lastError = null
  broadcast('state', { message: 'starting app server' })

  if (managedClient) {
    await closeManagedClient()
  }

  managedClient = startManagedStdioAppServerClient({
    defaultTimeoutMs: 30_000,
    process: {
      command: runtime.command,
      args: [...runtime.commandArgs, 'app-server', '--listen', 'stdio'],
      cwd: runtime.root,
      env: runtime.env,
    },
  })

  managedClient.process.onStderr(chunk => {
    void appendDesktopLog('app-server.stderr.log', {
      pid: managedClient?.process.pid,
      chunk,
    })
  })

  managedClient.process.onClose(event => {
    void appendDesktopLog('app-server.stderr.log', {
      pid: managedClient?.process.pid,
      event: {
        code: event.code,
        signal: event.signal,
        stderr: event.stderr,
        error: event.error instanceof Error ? event.error.message : event.error,
      },
    })
  })

  managedClient.client.onNotification(notification => {
    handleNotification(notification)
    broadcast('notification', notification)
  })

  managedClient.client.onError(error => {
    status.lastError = `${error.kind}: ${error.message}`
    void appendDesktopLog('client-error.log', {
      kind: error.kind,
      message: error.message,
      details: error.details,
    })
    broadcast('client-error', {
      kind: error.kind,
      message: error.message,
      details: error.details,
    })
  })

  try {
    status.initialized = await managedClient.client.initialize({
      clientInfo: {
        name: 'ccr-desktop',
        title: 'CCR Desktop',
        version: '0.1.0',
      },
      capabilities: {
        streaming: true,
        permissionPrompts: true,
        workspaceTrust: true,
        mcpManagement: true,
      },
    })
    status.protocolCompatibility = evaluateProtocolCompatibility(
      status.initialized.protocolVersion,
    )
    if (!status.protocolCompatibility.compatible) {
      throw new Error(status.protocolCompatibility.reason)
    }
    status.config = await managedClient.client.getConfig()
    status.auth = await managedClient.client.getAuthStatus()
    status.mcp = await managedClient.client.listMcp({ includeDisabled: true })
    status.appServer = 'ready'
    broadcast('state', { message: 'app server ready' })
  } catch (error) {
    status.appServer = 'failed'
    status.lastError = error instanceof Error ? error.message : String(error)
    broadcast('state', { message: 'app server failed', error: status.lastError })
    throw error
  }
}

function handleNotification(notification: JsonRpcNotification): void {
  const params = notification.params

  if (notification.method === 'thread/started') {
    const thread = params?.thread
    if (thread && typeof thread === 'object') {
      status.thread = thread as DesktopStatus['thread']
    }
  }

  if (notification.method === 'turn/started') {
    const threadId = String(params?.threadId ?? '')
    const turnId = String(params?.turnId ?? '')
    if (status.thread?.threadId === threadId) {
      status.thread = {
        ...status.thread,
        activeTurnId: turnId,
        status: 'running',
        updatedAt: new Date().toISOString(),
      }
    }
    if (status.lastTurn?.turnId === turnId) {
      status.lastTurn = {
        ...status.lastTurn,
        status: 'running',
        startedAt: new Date().toISOString(),
      }
    }
  }

  if (notification.method === 'turn/completed') {
    updateTurnFinishedState(params, 'completed')
  }

  if (notification.method === 'turn/cancelled') {
    updateTurnFinishedState(params, 'cancelled')
  }

  if (notification.method === 'turn/failed') {
    updateTurnFinishedState(params, 'failed', params?.error)
    status.lastError = 'Turn failed. Open event details for more information.'
  }
}

function updateTurnFinishedState(
  params: JsonRpcNotification['params'],
  nextStatus: NonNullable<DesktopStatus['lastTurn']>['status'],
  error?: unknown,
): void {
  const threadId = String(params?.threadId ?? '')
  const turnId = String(params?.turnId ?? '')
  const completedAt = new Date().toISOString()

  if (status.thread?.threadId === threadId) {
    status.thread = {
      ...status.thread,
      activeTurnId: null,
      status: nextStatus,
      updatedAt: completedAt,
    }
  }

  if (status.lastTurn?.turnId === turnId) {
    status.lastTurn = {
      ...status.lastTurn,
      status: nextStatus,
      completedAt,
      error:
        error && typeof error === 'object'
          ? (error as Record<string, unknown>)
          : status.lastTurn.error,
    }
  }
}

async function closeManagedClient(): Promise<void> {
  const current = managedClient
  managedClient = null
  if (!current) {
    return
  }

  try {
    await current.close()
  } finally {
    status.appServer = 'stopped'
    broadcast('state', { message: 'app server stopped' })
  }
}

async function openWorkspace(path: string): Promise<WorkspaceOpenResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  const result = await managedClient.client.openWorkspace({
    path,
    trust: 'trusted',
  })
  status.workspacePath = result.workspace.path
  broadcast('state', { message: 'workspace opened', workspace: result.workspace })
  return result
}

async function startThread(title = 'CCR Desktop 会话'): Promise<ThreadStartResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  if (!status.workspacePath) {
    await openWorkspace(defaultWorkspacePath)
  }

  const result = await managedClient.client.startThread({ title })
  status.thread = result.thread
  broadcast('state', { message: 'thread started', thread: result.thread })
  return result
}

async function startTurn(text: string): Promise<TurnStartResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  const thread = status.thread ?? (await startThread()).thread
  const result = await managedClient.client.startTurn({
    threadId: thread.threadId,
    input: {
      type: 'text',
      text,
    },
    options: {
      stream: true,
    },
  })
  status.lastTurn = result.turn
  if (status.thread?.threadId === result.turn.threadId) {
    status.thread = {
      ...status.thread,
      activeTurnId: result.turn.turnId,
      status: result.turn.status,
      updatedAt: new Date().toISOString(),
    }
  }
  broadcast('state', { message: 'turn queued', turn: result.turn })
  return result
}

async function interruptTurn(): Promise<TurnInterruptResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  const threadId = status.thread?.threadId ?? status.lastTurn?.threadId
  const turnId = status.thread?.activeTurnId
  if (!threadId || !turnId) {
    return { accepted: false }
  }

  try {
    const result = await managedClient.client.interruptTurn({
      threadId,
      turnId,
      reason: 'Desktop user requested stop.',
    })
    broadcast('state', { message: 'turn interrupt requested', threadId, turnId })
    return result
  } catch (error) {
    if (isTurnNotActiveError(error)) {
      updateTurnFinishedState({ threadId, turnId }, 'completed')
      broadcast('state', { message: 'turn already inactive', threadId, turnId })
      return { accepted: false }
    }
    throw error
  }
}

function isTurnNotActiveError(error: unknown): boolean {
  if (error instanceof AppServerClientError) {
    const details = error.details
    return (
      typeof details === 'object' &&
      details !== null &&
      'kind' in details &&
      details.kind === 'turn_not_active'
    )
  }
  return error instanceof Error && error.message.includes('Turn is not active')
}

function createWindow(): void {
  const windowIcon = resolveDesktopWindowIcon()
  const useCustomTitleBar = process.platform === 'win32'

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'CCR Desktop',
    icon: windowIcon,
    backgroundColor: '#f7efe3',
    autoHideMenuBar: true,
    ...(useCustomTitleBar
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#fbf4e9',
            symbolColor: '#211b16',
            height: 34,
          },
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setMenuBarVisibility(false)
  attachRendererDiagnostics(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function attachRendererDiagnostics(window: BrowserWindow): void {
  const diagnosticsEnabled =
    runtime.mode === 'development' || process.env.CCR_DESKTOP_RENDERER_DIAGNOSTICS === '1'
  if (!diagnosticsEnabled) {
    return
  }

  const preloadPath = join(__dirname, '../preload/index.mjs')
  void appendDesktopLog('renderer.log', {
    event: 'window-created',
    rendererUrl: process.env.ELECTRON_RENDERER_URL ?? null,
    preloadPath,
    preloadExists: existsSync(preloadPath),
  })

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    void appendDesktopLog('renderer.log', {
      event: 'console-message',
      level,
      message,
      line,
      sourceId,
    })
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    void appendDesktopLog('renderer.log', {
      event: 'did-fail-load',
      errorCode,
      errorDescription,
      validatedURL,
    })
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    void appendDesktopLog('renderer.log', {
      event: 'preload-error',
      preloadPath,
      message: error.message,
      stack: error.stack,
    })
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    void appendDesktopLog('renderer.log', {
      event: 'render-process-gone',
      details,
    })
  })

  window.webContents.on('did-finish-load', () => {
    void appendDesktopLog('renderer.log', {
      event: 'did-finish-load',
      url: window.webContents.getURL(),
    })
    void window.webContents
      .executeJavaScript(
        `({
          href: window.location.href,
          hasCcr: Boolean(window.ccr),
          hasRoot: Boolean(document.getElementById('root')),
          rootChildren: document.getElementById('root')?.childElementCount ?? null,
          bodyText: document.body.innerText.slice(0, 300),
          scripts: Array.from(document.scripts).map(script => script.src),
        })`,
        true,
      )
      .then(snapshot => {
        void appendDesktopLog('renderer.log', {
          event: 'renderer-snapshot',
          snapshot,
        })
      })
      .catch(error => {
        void appendDesktopLog('renderer.log', {
          event: 'renderer-snapshot-error',
          message: error instanceof Error ? error.message : String(error),
        })
      })
  })

  if (process.env.CCR_DESKTOP_OPEN_DEVTOOLS === '1') {
    window.webContents.openDevTools({ mode: 'detach' })
  }
}

function resolveDesktopWindowIcon(): string | undefined {
  const iconPath = join(app.getAppPath(), 'apps', 'desktop', 'assets', 'generated', 'icon.png')
  return existsSync(iconPath) ? iconPath : undefined
}

function ensureUpdateService(): DesktopUpdateService {
  if (updateService) {
    return updateService
  }

  updateService = new DesktopUpdateService({
    isPackaged: app.isPackaged,
    currentVersion: app.getVersion(),
    beforeInstall: async () => {
      updateInstallInProgress = true
      await closeManagedClient()
    },
    onStateChange: updateState => {
      status.updates = updateState
      broadcast('update', updateState)
    },
  })
  status.updates = updateService.getState()
  return updateService
}

ipcMain.handle('ccr:get-status', async () => {
  ensureUpdateService()
  await ensureAppServer().catch(() => undefined)
  return getSafeStatus()
})

ipcMain.handle('ccr:restart-app-server', async () => {
  await closeManagedClient()
  await ensureAppServer()
  return getSafeStatus()
})

ipcMain.handle('ccr:choose-workspace', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择 CCR 工作区',
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return openWorkspace(result.filePaths[0]!)
})

ipcMain.handle('ccr:open-workspace', async (_event, path: string) => {
  return openWorkspace(path)
})

ipcMain.handle('ccr:start-thread', async (_event, title?: string) => {
  return startThread(title)
})

ipcMain.handle('ccr:refresh-mcp', async () => {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  status.mcp = await managedClient.client.listMcp({ includeDisabled: true })
  broadcast('state', { message: 'mcp refreshed', mcp: status.mcp })
  return status.mcp
})

ipcMain.handle('ccr:get-logs', async () => {
  return readDesktopLogs()
})

ipcMain.handle('ccr:update-status', async () => {
  return ensureUpdateService().getState()
})

ipcMain.handle('ccr:update-check', async () => {
  return ensureUpdateService().checkForUpdates()
})

ipcMain.handle('ccr:update-download', async () => {
  return ensureUpdateService().downloadUpdate()
})

ipcMain.handle('ccr:update-install', async () => {
  return ensureUpdateService().installUpdate()
})

ipcMain.handle('ccr:update-dev-mock', async (_event, nextStatus: DesktopUpdateStatus) => {
  return ensureUpdateService().applyDevelopmentMock(nextStatus)
})

ipcMain.handle('ccr:start-turn', async (_event, text: string) => {
  return startTurn(text)
})

ipcMain.handle('ccr:turn-interrupt', async () => {
  return interruptTurn()
})

ipcMain.handle(
  'ccr:permission-respond',
  async (
    _event,
    input: {
      permissionRequestId: string
      behavior: 'allow' | 'deny'
      message?: string
    },
  ) => {
    await ensureAppServer()
    if (!managedClient) {
      throw new Error('App Server client is not available.')
    }
    return managedClient.client.respondPermission(input)
  },
)

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  ensureUpdateService()
  ensureAppServer().catch(() => undefined)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', event => {
  if (updateInstallInProgress) {
    return
  }

  if (!managedClient) {
    return
  }

  event.preventDefault()
  closeManagedClient().finally(() => {
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
