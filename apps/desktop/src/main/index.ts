import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, screen, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
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
  AuthLoginParams,
  AuthLoginResult,
  CompactStatusResult,
  ConfigGetResult,
  ContextStatusResult,
  InitializeResult,
  JsonRpcNotification,
  McpListResult,
  MemorySessionStatusResult,
  ModelAvailabilityParams,
  ModelAvailabilityResult,
  ModelCredentialUpdateParams,
  ModelCredentialUpdateResult,
  ModelProfileCopyParams,
  ModelProfileCopyResult,
  ModelProfileDeleteParams,
  ModelProfileDeleteResult,
  ModelListParams,
  ModelListResult,
  ModelProfileSaveParams,
  ModelProfileSaveResult,
  ModelSetParams,
  ModelSetResult,
  ModelTestParams,
  ModelTestResult,
  PermissionRespondParams,
  PermissionSettingsGetResult,
  PermissionSettingsUpdateParams,
  SessionHistoryListParams,
  SessionHistoryListResult,
  ThreadListResult,
  ThreadResumeParams,
  ThreadResumeResult,
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
  cwd: string
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
  context: ContextStatusResult | null
  compact: CompactStatusResult | null
  memory: MemorySessionStatusResult | null
  permissionSettings: PermissionSettingsGetResult | null
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

type DesktopWindowState = {
  width: number
  height: number
  x?: number
  y?: number
  maximized: boolean
}

type DesktopWindowBounds = {
  width: number
  height: number
  x?: number
  y?: number
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
  context: null,
  compact: null,
  memory: null,
  permissionSettings: null,
  thread: null,
  lastTurn: null,
  updates: null,
  lastError: null,
}

const SUPPORTED_APP_SERVER_PROTOCOL = '0.1'
const COMPACT_RUN_TIMEOUT_MS = 5 * 60_000
const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 820
const MIN_WINDOW_WIDTH = 980
const MIN_WINDOW_HEIGHT = 680

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
      cwd: resolve(configuredRoot),
      command: process.env.CCR_DESKTOP_NODE_COMMAND ?? 'node',
      commandArgs: ['cli.js'],
      env: process.env,
    }
  }

  if (app.isPackaged) {
    const resourcesRoot = process.resourcesPath
    const appArchiveRoot = join(resourcesRoot, 'app.asar')

    return {
      mode: 'packaged',
      root: appArchiveRoot,
      cwd: resourcesRoot,
      command: process.execPath,
      commandArgs: [join(appArchiveRoot, 'cli.js')],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
    }
  }

  return {
    mode: 'development',
    root: resolve(process.cwd()),
    cwd: resolve(process.cwd()),
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

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function readWindowState(): DesktopWindowState | null {
  try {
    const parsed = JSON.parse(readFileSync(getWindowStatePath(), 'utf8')) as unknown
    return isValidWindowState(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isValidWindowState(value: unknown): value is DesktopWindowState {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<DesktopWindowState>
  if (
    !isFiniteWindowNumber(candidate.width) ||
    !isFiniteWindowNumber(candidate.height) ||
    candidate.width < MIN_WINDOW_WIDTH ||
    candidate.height < MIN_WINDOW_HEIGHT ||
    typeof candidate.maximized !== 'boolean'
  ) {
    return false
  }

  if (candidate.x !== undefined && !isFiniteWindowNumber(candidate.x)) {
    return false
  }
  if (candidate.y !== undefined && !isFiniteWindowNumber(candidate.y)) {
    return false
  }

  return true
}

function isFiniteWindowNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function resolveWindowBounds(state: DesktopWindowState | null): DesktopWindowBounds {
  const width = Math.round(
    Math.max(MIN_WINDOW_WIDTH, state?.width ?? DEFAULT_WINDOW_WIDTH),
  )
  const height = Math.round(
    Math.max(MIN_WINDOW_HEIGHT, state?.height ?? DEFAULT_WINDOW_HEIGHT),
  )

  if (state && isFiniteWindowNumber(state.x) && isFiniteWindowNumber(state.y)) {
    const bounds = {
      x: Math.round(state.x),
      y: Math.round(state.y),
      width,
      height,
    }

    if (isWindowBoundsVisible(bounds)) {
      return bounds
    }
  }

  return { width, height }
}

function isWindowBoundsVisible(bounds: Required<DesktopWindowBounds>): boolean {
  return screen.getAllDisplays().some(display => {
    const area = display.workArea
    const overlapWidth =
      Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)
    const overlapHeight =
      Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y)
    return overlapWidth >= 80 && overlapHeight >= 80
  })
}

function saveWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return
  }

  const bounds = window.getNormalBounds()
  const nextState: DesktopWindowState = {
    x: bounds.x,
    y: bounds.y,
    width: Math.round(Math.max(MIN_WINDOW_WIDTH, bounds.width)),
    height: Math.round(Math.max(MIN_WINDOW_HEIGHT, bounds.height)),
    maximized: window.isMaximized(),
  }

  try {
    const statePath = getWindowStatePath()
    mkdirSync(dirname(statePath), { recursive: true })
    writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')
  } catch (error) {
    void appendDesktopLog('main.log', {
      event: 'window-state-save-failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function attachWindowStatePersistence(window: BrowserWindow): void {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleSave = (): void => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveWindowState(window)
    }, 500)
    if (typeof saveTimer === 'object' && 'unref' in saveTimer) {
      saveTimer.unref()
    }
  }

  window.on('resize', scheduleSave)
  window.on('move', scheduleSave)
  window.on('maximize', scheduleSave)
  window.on('unmaximize', scheduleSave)
  window.on('close', () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    saveWindowState(window)
  })
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
      cwd: runtime.cwd,
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
    status.permissionSettings = await managedClient.client.getPermissionSettings()
    status.auth = await managedClient.client.getAuthStatus()
    status.mcp = await managedClient.client.listMcp({ includeDisabled: true })
    await refreshRuntimeSnapshots()
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
        metadata: mergeTurnMetadata(
          status.lastTurn.metadata,
          getTurnMetadataFromParams(params),
        ),
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
      metadata: mergeTurnMetadata(
        status.lastTurn.metadata,
        getTurnMetadataFromParams(params),
      ),
    }
  }
  refreshRuntimeSnapshotsAfterTurn(nextStatus, threadId, turnId)
}

function getTurnMetadataFromParams(
  params: JsonRpcNotification['params'],
): Record<string, unknown> | undefined {
  const metadata = params?.metadata
  return metadata && typeof metadata === 'object'
    ? (metadata as Record<string, unknown>)
    : undefined
}

function mergeTurnMetadata(
  current: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!current && !next) {
    return undefined
  }
  return {
    ...(current ?? {}),
    ...(next ?? {}),
    usage: {
      ...getNestedObject(current?.usage),
      ...getNestedObject(next?.usage),
    },
  }
}

function getNestedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

async function refreshRuntimeSnapshots(): Promise<void> {
  const client = managedClient
  if (!client) {
    return
  }
  const params = status.thread?.threadId
    ? { threadId: status.thread.threadId }
    : {}
  const [contextStatus, compactStatus, memoryStatus] = await Promise.all([
    client.client.getContextStatus(params),
    client.client.getCompactStatus(params),
    client.client.getMemorySessionStatus(params),
  ])
  if (client !== managedClient) {
    return
  }
  status.context = contextStatus
  status.compact = compactStatus
  status.memory = memoryStatus
}

async function refreshPermissionSettingsSnapshot(): Promise<void> {
  const client = managedClient
  if (!client) {
    return
  }
  status.permissionSettings = await client.client.getPermissionSettings()
}

async function getPermissionSettings(): Promise<PermissionSettingsGetResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  status.permissionSettings = await managedClient.client.getPermissionSettings()
  return status.permissionSettings
}

async function updatePermissionSettings(
  params: PermissionSettingsUpdateParams,
): Promise<PermissionSettingsGetResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  status.permissionSettings =
    await managedClient.client.updatePermissionSettings(params)
  broadcast('state', {
    message: 'permission settings updated',
    permissionSettings: status.permissionSettings,
  })
  return status.permissionSettings
}

function refreshRuntimeSnapshotsAfterTurn(
  reason: NonNullable<DesktopStatus['lastTurn']>['status'],
  threadId: string,
  turnId: string,
): void {
  void (async () => {
    try {
      await refreshRuntimeSnapshots()
      await appendDesktopLog('main.log', {
        type: 'runtime-snapshots-refreshed',
        reason,
        threadId,
        turnId,
        context: summarizeContextStatus(status.context),
        compact: summarizeCompactStatus(status.compact),
        memory: summarizeMemoryStatus(status.memory),
      })
      broadcast('state', {
        message: 'runtime snapshots refreshed',
        reason,
        threadId,
        turnId,
        context: status.context,
        compact: status.compact,
        memory: status.memory,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await appendDesktopLog('client-error.log', {
        kind: 'runtime_snapshots_refresh_failed',
        message,
        threadId,
        turnId,
        reason,
      })
      broadcast('state', {
        message: 'runtime snapshots refresh failed',
        reason,
        threadId,
        turnId,
        error: message,
      })
    }
  })()
}

function summarizeContextStatus(
  context: ContextStatusResult | null,
): Record<string, unknown> | null {
  if (!context) {
    return null
  }
  return {
    threadId: context['threadId'],
    messageCount: context['messageCount'],
    estimatedTokens: context['estimatedTokens'],
    compactBoundaryCount: context['compactBoundaryCount'],
    readFileStateSize: context['readFileStateSize'],
  }
}

function summarizeCompactStatus(
  compact: CompactStatusResult | null,
): Record<string, unknown> | null {
  if (!compact) {
    return null
  }
  return {
    threadId: compact['threadId'],
    estimatedTokens: compact['estimatedTokens'],
    autoCompactThreshold: compact['autoCompactThreshold'],
    distanceToAutoCompact: compact['distanceToAutoCompact'],
    compactBoundaryCount: compact['compactBoundaryCount'],
  }
}

function summarizeMemoryStatus(
  memory: MemorySessionStatusResult | null,
): Record<string, unknown> | null {
  if (!memory) {
    return null
  }
  return {
    threadId: memory['threadId'],
    hookRegistered: memory['hookRegistered'],
    initialized: memory['initialized'],
    contentLength: memory['contentLength'],
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
  await refreshPermissionSettingsSnapshot()
  await refreshRuntimeSnapshots()
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
  status.lastTurn = null
  status.lastError = null
  await refreshRuntimeSnapshots()
  broadcast('state', { message: 'thread started', thread: result.thread })
  return result
}

async function listThreads(): Promise<ThreadListResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  return managedClient.client.listThreads()
}

async function listSessionHistory(
  params: SessionHistoryListParams = {},
): Promise<SessionHistoryListResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  if (!status.workspacePath) {
    await openWorkspace(defaultWorkspacePath)
  }

  return managedClient.client.listSessionHistory(params)
}

async function resumeThread(params: ThreadResumeParams): Promise<ThreadResumeResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  if (
    params.projectPath &&
    (!status.workspacePath || !pathsEqual(status.workspacePath, params.projectPath))
  ) {
    await openWorkspace(params.projectPath)
  } else if (!status.workspacePath) {
    await openWorkspace(defaultWorkspacePath)
  }

  const result = await managedClient.client.resumeThread({
    sessionId: params.sessionId,
    ...(params.title ? { title: params.title } : {}),
    ...(params.transcriptPath ? { transcriptPath: params.transcriptPath } : {}),
    ...(params.projectPath ? { projectPath: params.projectPath } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  })
  status.thread = result.thread
  status.lastTurn = null
  status.lastError = null
  await refreshRuntimeSnapshots()
  broadcast('state', { message: 'thread resumed', thread: result.thread })
  return result
}

async function listModels(
  params: ModelListParams = {},
): Promise<ModelListResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  return managedClient.client.listModels(params)
}

async function loginAuth(params: AuthLoginParams = {}): Promise<AuthLoginResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const result = await managedClient.client.loginAuth(
    params,
    { timeoutMs: 130_000 },
  )
  status.auth = await managedClient.client.getAuthStatus()
  status.config = await managedClient.client.getConfig()
  await refreshRuntimeSnapshots()
  broadcast('state', {
    message: 'auth login completed',
    provider: params.provider,
    result,
  })
  return result
}

async function getModelAvailability(
  params: ModelAvailabilityParams = {},
): Promise<ModelAvailabilityResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  return managedClient.client.getModelAvailability(params)
}

async function setModel(params: ModelSetParams): Promise<ModelSetResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  if (status.thread?.activeTurnId) {
    throw new Error('当前任务运行中，完成后可切换模型。')
  }

  const result = await managedClient.client.setModel(params)
  status.config = await managedClient.client.getConfig()
  status.auth = await managedClient.client.getAuthStatus()
  await refreshRuntimeSnapshots()
  broadcast('state', {
    message: 'model updated',
    model: params.model,
    config: status.config,
  })
  return result
}

async function testModelConnection(
  params: ModelTestParams = {},
): Promise<ModelTestResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const result = await managedClient.client.testModelConnection(params)
  broadcast('state', {
    message: 'model connection tested',
    provider: params.provider,
    model: params.model,
    result,
  })
  return result
}

async function updateModelCredential(
  params: ModelCredentialUpdateParams,
): Promise<ModelCredentialUpdateResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const result = await managedClient.client.updateModelCredential(params)
  status.auth = await managedClient.client.getAuthStatus()
  await refreshRuntimeSnapshots()
  broadcast('state', {
    message: 'model credential updated',
    provider: params.provider,
    model: params.model,
    result,
  })
  return result
}

async function saveModelProfile(
  params: ModelProfileSaveParams,
): Promise<ModelProfileSaveResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const result = await managedClient.client.saveModelProfile(params)
  status.config = await managedClient.client.getConfig()
  status.auth = await managedClient.client.getAuthStatus()
  await refreshRuntimeSnapshots()
  broadcast('state', {
    message: 'model profile saved',
    provider: params.providerType,
    profileId: params.profileId,
    result,
  })
  return result
}

async function copyModelProfile(
  params: ModelProfileCopyParams,
): Promise<ModelProfileCopyResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const result = await managedClient.client.copyModelProfile(params)
  status.config = await managedClient.client.getConfig()
  status.auth = await managedClient.client.getAuthStatus()
  await refreshRuntimeSnapshots()
  broadcast('state', {
    message: 'model profile copied',
    profileId: params.profileId,
    result,
  })
  return result
}

async function deleteModelProfile(
  params: ModelProfileDeleteParams,
): Promise<ModelProfileDeleteResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const result = await managedClient.client.deleteModelProfile(params)
  status.config = await managedClient.client.getConfig()
  status.auth = await managedClient.client.getAuthStatus()
  await refreshRuntimeSnapshots()
  broadcast('state', {
    message: 'model profile deleted',
    profileId: params.profileId,
    result,
  })
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
  await refreshRuntimeSnapshots()
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

function resolveWorkspacePath(targetPath: string): string {
  const trimmedPath = targetPath.trim()
  if (!trimmedPath) {
    throw new Error('Path is required.')
  }
  if (/^https?:\/\//i.test(trimmedPath)) {
    throw new Error('Remote URL cannot be opened as a local file path.')
  }

  const workspacePath = status.workspacePath ?? defaultWorkspacePath
  return isAbsolute(trimmedPath)
    ? resolve(trimmedPath)
    : resolve(workspacePath, trimmedPath)
}

function isInsideWorkspace(targetPath: string): boolean {
  const workspacePath = resolve(status.workspacePath ?? defaultWorkspacePath)
  const nestedRelativePath = relative(workspacePath, targetPath)
  return (
    nestedRelativePath === '' ||
    (!nestedRelativePath.startsWith('..') && !isAbsolute(nestedRelativePath))
  )
}

function pathsEqual(left: string, right: string): boolean {
  const resolvedLeft = resolve(left)
  const resolvedRight = resolve(right)
  return process.platform === 'win32'
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight
}

async function confirmOutsideWorkspaceAccess(
  action: 'open' | 'reveal',
  targetPath: string,
): Promise<boolean> {
  if (isInsideWorkspace(targetPath)) {
    return true
  }

  const result = await dialog.showMessageBox(mainWindow ?? undefined, {
    type: 'warning',
    buttons: ['取消', action === 'open' ? '仍然打开' : '仍然定位'],
    defaultId: 0,
    cancelId: 0,
    title: '路径位于工作区外',
    message: '该路径不在当前 CCR 工作区内。',
    detail: targetPath,
  })
  return result.response === 1
}

async function openLocalPath(targetPath: string): Promise<{ opened: boolean }> {
  const resolvedPath = resolveWorkspacePath(targetPath)
  if (!(await confirmOutsideWorkspaceAccess('open', resolvedPath))) {
    return { opened: false }
  }

  const errorMessage = await shell.openPath(resolvedPath)
  if (errorMessage) {
    throw new Error(errorMessage)
  }
  return { opened: true }
}

async function showLocalPathInFolder(
  targetPath: string,
): Promise<{ revealed: boolean }> {
  const resolvedPath = resolveWorkspacePath(targetPath)
  if (!(await confirmOutsideWorkspaceAccess('reveal', resolvedPath))) {
    return { revealed: false }
  }

  shell.showItemInFolder(resolvedPath)
  return { revealed: true }
}

function createWindow(): void {
  const windowIcon = resolveDesktopWindowIcon()
  const useCustomTitleBar = process.platform === 'win32'
  const savedWindowState = readWindowState()
  const windowBounds = resolveWindowBounds(savedWindowState)
  const shouldStartMaximized = savedWindowState?.maximized ?? true

  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: 'CCR Desktop',
    icon: windowIcon,
    backgroundColor: '#fbf4e9',
    autoHideMenuBar: true,
    show: false,
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
  attachWindowStatePersistence(mainWindow)
  if (shouldStartMaximized) {
    mainWindow.maximize()
  }
  attachRendererDiagnostics(mainWindow)
  revealWindowWhenReady(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function revealWindowWhenReady(window: BrowserWindow): void {
  let revealed = false

  const reveal = (): void => {
    if (revealed || window.isDestroyed()) {
      return
    }
    revealed = true
    window.show()
  }

  window.once('ready-to-show', reveal)
  const fallbackTimer = setTimeout(reveal, 1500)
  if (typeof fallbackTimer === 'object' && 'unref' in fallbackTimer) {
    fallbackTimer.unref()
  }
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

ipcMain.handle('ccr:list-threads', async () => {
  return listThreads()
})

ipcMain.handle('ccr:list-models', async (_event, params?: ModelListParams) => {
  return listModels(params ?? {})
})

ipcMain.handle('ccr:auth-login', async (_event, params?: AuthLoginParams) => {
  return loginAuth(params ?? {})
})

ipcMain.handle(
  'ccr:model-availability',
  async (_event, params?: ModelAvailabilityParams) => {
    return getModelAvailability(params ?? {})
  },
)

ipcMain.handle('ccr:set-model', async (_event, params: ModelSetParams) => {
  return setModel(params)
})

ipcMain.handle('ccr:model-test', async (_event, params?: ModelTestParams) => {
  return testModelConnection(params ?? {})
})

ipcMain.handle(
  'ccr:model-profile-save',
  async (_event, params: ModelProfileSaveParams) => {
    return saveModelProfile(params)
  },
)

ipcMain.handle(
  'ccr:model-profile-copy',
  async (_event, params: ModelProfileCopyParams) => {
    return copyModelProfile(params)
  },
)

ipcMain.handle(
  'ccr:model-profile-delete',
  async (_event, params: ModelProfileDeleteParams) => {
    return deleteModelProfile(params)
  },
)

ipcMain.handle(
  'ccr:model-credential-update',
  async (_event, params: ModelCredentialUpdateParams) => {
    return updateModelCredential(params)
  },
)

ipcMain.handle(
  'ccr:list-session-history',
  async (_event, params?: SessionHistoryListParams) => {
    return listSessionHistory(params ?? {})
  },
)

ipcMain.handle(
  'ccr:resume-thread',
  async (_event, params: ThreadResumeParams | string, title?: string) => {
    if (typeof params === 'string') {
      return resumeThread({
        sessionId: params,
        ...(title ? { title } : {}),
      })
    }
    return resumeThread(params)
  },
)

ipcMain.handle('ccr:refresh-mcp', async () => {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  status.mcp = await managedClient.client.listMcp({ includeDisabled: true })
  broadcast('state', { message: 'mcp refreshed', mcp: status.mcp })
  return status.mcp
})

ipcMain.handle('ccr:refresh-runtime', async () => {
  await ensureAppServer()
  await refreshRuntimeSnapshots()
  broadcast('state', {
    message: 'runtime snapshots refreshed',
    context: status.context,
    compact: status.compact,
    memory: status.memory,
  })
  return {
    context: status.context,
    compact: status.compact,
    memory: status.memory,
  }
})

ipcMain.handle('ccr:get-permission-settings', async () => {
  return getPermissionSettings()
})

ipcMain.handle(
  'ccr:update-permission-settings',
  async (_event, params: PermissionSettingsUpdateParams) => {
    return updatePermissionSettings(params)
  },
)

ipcMain.handle('ccr:compact-run', async (_event, instruction?: string) => {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const threadId = status.thread?.threadId
  if (!threadId) {
    throw new Error('No active thread to compact.')
  }
  const result = await managedClient.client.runCompact(
    {
      threadId,
      ...(instruction ? { instruction } : {}),
    },
    { timeoutMs: COMPACT_RUN_TIMEOUT_MS },
  )
  await refreshRuntimeSnapshots()
  broadcast('state', { message: 'compact completed', compact: result })
  return result
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

ipcMain.handle('ccr:open-path', async (_event, path: string) => {
  return openLocalPath(path)
})

ipcMain.handle('ccr:show-item-in-folder', async (_event, path: string) => {
  return showLocalPathInFolder(path)
})

ipcMain.handle('ccr:copy-text', async (_event, text: string) => {
  clipboard.writeText(String(text ?? ''))
  return { copied: true }
})

ipcMain.handle(
  'ccr:permission-respond',
  async (
    _event,
    input: PermissionRespondParams,
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
