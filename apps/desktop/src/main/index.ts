import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, screen, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AppServerClientError,
  startManagedStdioAppServerClient,
  type ManagedStdioAppServerClient,
} from '../../../../src/app-server/client/index.js'
import {
  readModelUsageStats,
  type ModelUsageStatsInput,
} from '../../../../src/services/usage/modelUsageStats.js'
import {
  CcrMcpInstallManifestSchema,
  summarizeCcrMcpInstallManifest,
  type CcrMcpInstallManifestInput,
} from '../../../../src/services/mcp/installManifest.js'
import { DesktopUpdateService } from './updateService.js'
import type { DesktopUpdateState, DesktopUpdateStatus } from './updateState.js'
import { extractImageGenerationPrompt } from './imageGenerationIntent.js'
import type {
  AuthStatusResult,
  AuthLoginParams,
  AuthLoginResult,
  CapabilitiesManagementActionApplyParams,
  CapabilitiesManagementActionApplyResult,
  CapabilitiesManagementActionPlanParams,
  CapabilitiesManagementActionPlanResult,
  CapabilitiesManagementListResult,
  CompactStatusResult,
  ConfigGetResult,
  ContextStatusResult,
  InitializeResult,
  JsonRpcNotification,
  McpDisableParams,
  McpDisableResult,
  McpEnableParams,
  McpEnableResult,
  McpInstallAdoptApplyParams,
  McpInstallAdoptApplyResult,
  McpInstallAdoptPlanParams,
  McpInstallAdoptPlanResult,
  McpInstallApplyParams,
  McpInstallApplyResult,
  McpInstallListResult,
  McpInstallPlanParams,
  McpInstallPlanResult,
  McpInstallRepairParams,
  McpInstallRepairResult,
  McpInstallSaveManifestParams,
  McpInstallSaveManifestResult,
  McpInstallSearchParams,
  McpInstallSearchResult,
  McpInstallUninstallParams,
  McpInstallUninstallResult,
  McpInspectParams,
  McpInspectResult,
  McpListResult,
  McpRestartParams,
  McpRestartResult,
  McpTestParams,
  McpTestResult,
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
  PermissionPendingListResult,
  PermissionRespondParams,
  PermissionSettingsGetResult,
  PermissionSettingsUpdateParams,
  PluginsActionApplyParams,
  PluginsActionApplyResult,
  PluginsActionPlanParams,
  PluginsActionPlanResult,
  PluginsAppsListParams,
  PluginsAppsListResult,
  PluginsCatalogListResult,
  PluginsConfigGetParams,
  PluginsConfigGetResult,
  PluginsInspectParams,
  PluginsInspectResult,
  PluginsLocalImportParams,
  PluginsLocalImportResult,
  PluginsMarketplaceAddParams,
  PluginsMarketplaceAddResult,
  PluginsMarketplaceRefreshParams,
  PluginsMarketplaceRefreshResult,
  PluginsMarketplaceRemoveParams,
  PluginsMarketplaceRemoveResult,
  PluginsOperationCancelParams,
  PluginsOperationCancelResult,
  PluginsOperationGetParams,
  PluginsOperationGetResult,
  PluginsRuntimeGetResult,
  SessionHistoryListParams,
  SessionHistoryListResult,
  SkillImportApplyParams,
  SkillImportApplyResult,
  SkillImportPlanParams,
  SkillImportPlanResult,
  SkillInspectParams,
  SkillInspectResult,
  SkillInstallApplyParams,
  SkillInstallApplyResult,
  SkillInstallListResult,
  SkillInstallPlanParams,
  SkillInstallPlanResult,
  SkillInstallRepairParams,
  SkillInstallRepairResult,
  SkillInstallSaveManifestParams,
  SkillInstallSaveManifestResult,
  SkillInstallSearchParams,
  SkillInstallSearchResult,
  SkillInstallUninstallParams,
  SkillInstallUninstallResult,
  SkillSetEnabledParams,
  SkillSetEnabledResult,
  SkillSetInvocationParams,
  SkillSetInvocationResult,
  ThreadListResult,
  ThreadDisplayItem,
  ThreadDisplayPatch,
  ThreadDisplayPatchOperation,
  ThreadDisplaySnapshot,
  ThreadResumeParams,
  ThreadResumeResult,
  ThreadStartResult,
  TurnInterruptResult,
  TurnStartParams,
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

type DesktopConfirmTone = 'default' | 'warning' | 'danger'

type DesktopConfirmRequestPayload = {
  id: string
  title: string
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel?: string
  tone?: DesktopConfirmTone
}

type DesktopConfirmResponsePayload = {
  id?: string
  confirmed?: boolean
}

type ImportedMcpManifestResult = {
  canceled: boolean
  path?: string
  manifest?: Record<string, unknown>
  summary?: ReturnType<typeof summarizeCcrMcpInstallManifest>
}

type DesktopPathPickerInput = {
  mode?: 'file' | 'directory'
  title?: string
  buttonLabel?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

type DesktopPathPickerResult = {
  canceled: boolean
  path?: string
}

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
  pendingPermissions: PermissionPendingListResult['permissions']
  threadDisplaySnapshot: ThreadDisplaySnapshot | null
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

type DesktopAttachmentSource =
  | {
      kind: 'file'
      path: string
    }
  | {
      kind: 'contentRef'
      contentRef: string
    }

type DesktopAttachmentPrepareInput = {
  attachments?: Array<{
    id?: string
    name?: string
    path?: string
    data?: ArrayBuffer | Uint8Array | number[]
    mimeType?: string
    sizeBytes?: number
    modality?: 'image' | 'file' | 'audio'
  }>
}

type DesktopPreparedAttachment = {
  id: string
  attachmentId?: string
  displayName: string
  mimeType: string
  sizeBytes: number
  modality: 'image' | 'file' | 'audio'
  source?: DesktopAttachmentSource
  previewDataUrl?: string
  previewText?: string
  textContent?: string
  contentRef?: string
  sendMode?: 'image' | 'text' | 'metadata'
  safety?: 'workspace' | 'outside_workspace'
  status: 'ready' | 'rejected'
  error?: string
}

type DesktopAttachmentPrepareResult = {
  attachments: DesktopPreparedAttachment[]
}

type DesktopImagePreviewInput = {
  path?: string
  maxEdge?: number
}

type DesktopImagePreviewResult = {
  previewDataUrl?: string
}

type DesktopWindowControlState = {
  maximized: boolean
  fullscreen: boolean
}

type DesktopTurnAttachmentInput = {
  type?: 'image' | 'text'
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: DesktopAttachmentSource
  text?: string
}

type DesktopImageGenerationOption =
  NonNullable<TurnStartParams['options']>['imageGeneration']

type DesktopStartTurnInput =
  | string
  | {
      text?: string
      attachments?: DesktopTurnAttachmentInput[]
      options?: {
        imageGeneration?: DesktopImageGenerationOption
      }
    }

const DESKTOP_MAX_IMAGE_BYTES = 10 * 1024 * 1024
const DESKTOP_MAX_REMOTE_IMAGE_PREVIEW_BYTES = 20 * 1024 * 1024
const DESKTOP_MAX_TEXT_FILE_BYTES = 128 * 1024
const DESKTOP_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

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

app.setName('CCR')

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
  pendingPermissions: [],
  threadDisplaySnapshot: null,
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
const WINDOW_REVEAL_FALLBACK_MS = 10_000

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

function getDesktopWindowState(
  window: BrowserWindow | null = mainWindow,
): DesktopWindowControlState {
  return {
    maximized: Boolean(window && !window.isDestroyed() && window.isMaximized()),
    fullscreen: Boolean(window && !window.isDestroyed() && window.isFullScreen()),
  }
}

function sendDesktopWindowState(window: BrowserWindow | null = mainWindow): void {
  if (!window || window.isDestroyed()) {
    return
  }
  window.webContents.send('ccr:window-state', getDesktopWindowState(window))
}

function getIpcWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender) ?? mainWindow
  if (!window || window.isDestroyed()) {
    throw new Error('Desktop window is not available.')
  }
  return window
}

function attachDesktopWindowStateEvents(window: BrowserWindow): void {
  const emit = (): void => sendDesktopWindowState(window)
  window.on('maximize', emit)
  window.on('unmaximize', emit)
  window.on('enter-full-screen', emit)
  window.on('leave-full-screen', emit)
  window.on('restore', emit)
  window.webContents.once('did-finish-load', emit)
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
    const params = getObjectValue(object, 'params')
    return {
      method: object.method,
      turnId: params?.turnId,
      itemId: params?.itemId,
      permissionRequestId: params?.permissionRequestId,
      toolName: getNotificationToolName(params),
      contentTypes: getNotificationContentTypes(params),
      toolUseIds: getNotificationToolUseIds(params),
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

function getObjectValue(
  object: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = object[key]
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined
}

function getNotificationToolName(
  params: Record<string, unknown> | undefined,
): string | undefined {
  if (!params) {
    return undefined
  }

  const tool = getObjectValue(params, 'tool')
  if (typeof tool?.name === 'string') {
    return tool.name
  }
  if (typeof params.toolName === 'string') {
    return params.toolName
  }
  if (typeof params.tool_name === 'string') {
    return params.tool_name
  }

  const content = Array.isArray(params.content) ? params.content : []
  for (const block of content) {
    if (
      block &&
      typeof block === 'object' &&
      typeof (block as Record<string, unknown>).name === 'string'
    ) {
      return (block as Record<string, unknown>).name as string
    }
  }
  return undefined
}

function getNotificationContentTypes(
  params: Record<string, unknown> | undefined,
): string[] | undefined {
  const content = params && Array.isArray(params.content) ? params.content : []
  const types = content.flatMap(block => {
    if (!block || typeof block !== 'object') {
      return []
    }
    const type = (block as Record<string, unknown>).type
    return typeof type === 'string' ? [type] : []
  })
  return types.length > 0 ? Array.from(new Set(types)) : undefined
}

function getNotificationToolUseIds(
  params: Record<string, unknown> | undefined,
): string[] | undefined {
  const content = params && Array.isArray(params.content) ? params.content : []
  const ids = content.flatMap(block => {
    if (!block || typeof block !== 'object') {
      return []
    }
    const object = block as Record<string, unknown>
    const id =
      object.id ??
      object.toolUseId ??
      object.toolUseID ??
      object.tool_use_id ??
      object.parentToolUseId ??
      object.parentToolUseID ??
      object.parent_tool_use_id
    return typeof id === 'string' ? [id] : []
  })
  return ids.length > 0 ? Array.from(new Set(ids)) : undefined
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

  const launchedClient = startManagedStdioAppServerClient({
    defaultTimeoutMs: 30_000,
    process: {
      command: runtime.command,
      args: [...runtime.commandArgs, 'app-server', '--listen', 'stdio'],
      cwd: runtime.cwd,
      env: runtime.env,
    },
  })
  managedClient = launchedClient

  launchedClient.process.onStderr(chunk => {
    void appendDesktopLog('app-server.stderr.log', {
      pid: launchedClient.process.pid,
      chunk,
    })
  })

  launchedClient.process.onClose(event => {
    void appendDesktopLog('app-server.stderr.log', {
      pid: launchedClient.process.pid,
      event: {
        code: event.code,
        signal: event.signal,
        stderr: event.stderr,
        error: event.error instanceof Error ? event.error.message : event.error,
        failed: event.failed,
        isMaxBuffer: event.isMaxBuffer,
      },
    })
    handleUnexpectedAppServerClose(launchedClient, event)
  })

  launchedClient.client.onNotification(notification => {
    handleNotification(notification)
    broadcast('notification', notification)
  })

  launchedClient.client.onError(error => {
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
    status.initialized = await launchedClient.client.initialize({
      clientInfo: {
        name: 'ccr',
        title: 'CCR',
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
    status.config = await launchedClient.client.getConfig()
    status.permissionSettings = await launchedClient.client.getPermissionSettings()
    await refreshPendingPermissionsSnapshot()
    status.auth = await launchedClient.client.getAuthStatus()
    status.mcp = await launchedClient.client.listMcp({ includeDisabled: true })
    await refreshRuntimeSnapshots()
    await activatePluginRuntimeSnapshot('app-server-bootstrap')
    if (managedClient !== launchedClient) {
      throw new Error('App Server process exited during initialization.')
    }
    status.appServer = 'ready'
    broadcast('state', { message: 'app server ready' })
  } catch (error) {
    status.appServer = 'failed'
    status.lastError = error instanceof Error ? error.message : String(error)
    broadcast('state', { message: 'app server failed', error: status.lastError })
    throw error
  }
}

function handleUnexpectedAppServerClose(
  closedClient: ManagedStdioAppServerClient,
  event: {
    code: number | null
    signal: NodeJS.Signals | null
    error?: unknown
    isMaxBuffer?: boolean
  },
): void {
  if (managedClient !== closedClient) {
    return
  }

  managedClient = null
  status.appServer = 'failed'
  const message = event.isMaxBuffer
    ? 'App Server output exceeded the process buffer limit.'
    : `App Server process exited unexpectedly (code ${String(event.code)}).`
  status.lastError = message

  const threadId = status.thread?.threadId
  const turnId = status.thread?.activeTurnId
  if (threadId && turnId) {
    const error = {
      kind: 'app_server_exited',
      message,
      code: event.code,
      signal: event.signal,
      isMaxBuffer: event.isMaxBuffer === true,
    }
    updateTurnFinishedState({ threadId, turnId, error }, 'failed', error)
  }

  broadcast('state', {
    message: 'app server exited',
    error: message,
    code: event.code,
    signal: event.signal,
    isMaxBuffer: event.isMaxBuffer === true,
  })
}

function handleNotification(notification: JsonRpcNotification): void {
  const params = notification.params

  if (notification.method === 'thread/display/patch') {
    handleThreadDisplayPatchNotification(params)
  }

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
}

function handleThreadDisplayPatchNotification(
  params: JsonRpcNotification['params'],
): void {
  const patch = toThreadDisplayPatch(params)
  if (!patch) {
    return
  }

  for (const operation of patch.operations) {
    handleThreadDisplayPatchOperation(patch, operation)
  }
}

function handleThreadDisplayPatchOperation(
  patch: ThreadDisplayPatch,
  operation: ThreadDisplayPatchOperation,
): void {
  if (operation.op === 'append_item') {
    handleThreadDisplayPatchAppendItem(patch, operation.item)
    return
  }

  if (operation.op === 'complete_item' && operation.item) {
    handleThreadDisplayPatchAppendItem(patch, operation.item)
    return
  }

  if (operation.op !== 'update_item') {
    return
  }

  const metadata = getNestedObject(operation.item.metadata)
  if (
    operation.item.status === 'cancelled' &&
    metadata.coreEventType === 'permission_cancelled'
  ) {
    status.pendingPermissions = status.pendingPermissions.filter(
      request => request.permissionRequestId !== operation.itemId,
    )
  }
}

function handleThreadDisplayPatchAppendItem(
  patch: ThreadDisplayPatch,
  item: ThreadDisplayItem,
): void {
  if (item.type === 'permission_request') {
    const request = toPendingPermissionRequest(item.content)
    if (request) {
      status.pendingPermissions = upsertPendingPermission(
        status.pendingPermissions,
        request,
      )
    }
    return
  }

  const metadata = getNestedObject(item.metadata)
  if (metadata.coreEventType !== 'turn_failed') {
    return
  }

  const threadId = item.identity?.threadId ?? patch.threadId
  const turnId = item.identity?.turnId
  updateTurnFinishedState(
    {
      threadId,
      ...(turnId ? { turnId } : {}),
      metadata: item.metadata,
      error: item.content ?? item.text,
    },
    'failed',
    item.content ?? item.text,
  )
  status.lastError = 'Turn failed. Open event details for more information.'
}

function toThreadDisplayPatch(
  value: JsonRpcNotification['params'],
): ThreadDisplayPatch | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const patch = value as Partial<ThreadDisplayPatch>
  if (typeof patch.threadId !== 'string' || !Array.isArray(patch.operations)) {
    return null
  }
  return patch as ThreadDisplayPatch
}

type PendingPermissionRequest = PermissionPendingListResult['permissions'][number]

function toPendingPermissionRequest(
  value: unknown,
): PendingPermissionRequest | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const request = value as Partial<PendingPermissionRequest>
  if (
    typeof request.permissionRequestId !== 'string' ||
    typeof request.threadId !== 'string' ||
    typeof request.turnId !== 'string' ||
    typeof request.toolUseId !== 'string' ||
    typeof request.createdAt !== 'string' ||
    !request.tool ||
    typeof request.tool !== 'object' ||
    typeof request.tool.name !== 'string' ||
    !request.input ||
    typeof request.input !== 'object'
  ) {
    return null
  }
  return request as PendingPermissionRequest
}

function upsertPendingPermission(
  current: PendingPermissionRequest[],
  request: PendingPermissionRequest,
): PendingPermissionRequest[] {
  return [
    request,
    ...current.filter(
      item => item.permissionRequestId !== request.permissionRequestId,
    ),
  ]
}

function clearThreadDisplayState(): void {
  status.threadDisplaySnapshot = null
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

async function activatePluginRuntimeSnapshot(reason: string): Promise<void> {
  const client = managedClient
  if (!client) {
    return
  }
  const cwd = status.workspacePath ?? defaultWorkspacePath
  try {
    const result = await client.client.activatePluginRuntime({ cwd })
    await appendDesktopLog('main.log', {
      type: 'plugin-runtime-activated',
      reason,
      state: result.state,
      diagnostics: result.diagnostics,
    })
    broadcast('state', {
      message: 'plugin runtime activated',
      reason,
      state: result.state,
      diagnostics: result.diagnostics,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await appendDesktopLog('client-error.log', {
      kind: 'plugin_runtime_activation_failed',
      reason,
      message,
    })
    broadcast('state', {
      message: 'plugin runtime activation failed',
      reason,
      error: message,
    })
  }
}

async function refreshPermissionSettingsSnapshot(): Promise<void> {
  const client = managedClient
  if (!client) {
    return
  }
  status.permissionSettings = await client.client.getPermissionSettings()
}

async function refreshPendingPermissionsSnapshot(): Promise<void> {
  const client = managedClient
  if (!client) {
    return
  }
  status.pendingPermissions = (
    await client.client.listPendingPermissions()
  ).permissions
}

async function refreshThreadDisplaySnapshot(): Promise<void> {
  const client = managedClient
  const threadId = status.thread?.threadId
  if (!client || !threadId) {
    status.threadDisplaySnapshot = null
    return
  }
  const result = await client.client.listThreadMessages({ threadId })
  status.threadDisplaySnapshot = result.displaySnapshot ?? null
}

async function getAppServerClient() {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  return managedClient.client
}

async function refreshMcpSnapshot(): Promise<McpListResult> {
  const client = await getAppServerClient()
  status.mcp = await client.listMcp({ includeDisabled: true })
  return status.mcp
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
      await refreshPendingPermissionsSnapshot()
      await refreshThreadDisplaySnapshot()
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

  const previousWorkspacePath = status.workspacePath
  const result = await managedClient.client.openWorkspace({
    path,
    trust: 'trusted',
  })
  const workspaceChanged =
    !previousWorkspacePath ||
    !pathsEqual(previousWorkspacePath, result.workspace.path)
  status.workspacePath = result.workspace.path
  if (workspaceChanged) {
    status.thread = null
    status.lastTurn = null
    clearThreadDisplayState()
  }
  await refreshPermissionSettingsSnapshot()
  await refreshRuntimeSnapshots()
  await refreshThreadDisplaySnapshot()
  broadcast('state', { message: 'workspace opened', workspace: result.workspace })
  return result
}

async function startThread(title = 'CCR 会话'): Promise<ThreadStartResult> {
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
  clearThreadDisplayState()
  await refreshRuntimeSnapshots()
  await refreshThreadDisplaySnapshot()
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
  status.threadDisplaySnapshot = result.displaySnapshot ?? null
  broadcast('state', { message: 'thread resumed', thread: result.thread })
  return result
}

async function renameSessionHistory(params: {
  sessionId: string
  title: string
  transcriptPath?: string
}): Promise<{ sessionId: string; title: string }> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }
  const result = await managedClient.client.renameSessionHistory(params)
  const threadMetadata = getNestedObject(status.thread?.metadata)
  const currentSessionId =
    typeof threadMetadata.sessionId === 'string'
      ? threadMetadata.sessionId
      : undefined
  if (currentSessionId === result.sessionId && status.thread) {
    status.thread = {
      ...status.thread,
      title: result.title,
      updatedAt: new Date().toISOString(),
    }
  }
  broadcast('state', {
    message: 'session history renamed',
    sessionId: result.sessionId,
    title: result.title,
    thread: status.thread,
  })
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

async function inspectMcpServer(
  params: McpInspectParams,
): Promise<McpInspectResult> {
  const client = await getAppServerClient()
  return client.inspectMcp(params)
}

async function enableMcpServer(
  params: McpEnableParams,
): Promise<McpEnableResult> {
  const client = await getAppServerClient()
  const result = await client.enableMcp(params)
  await refreshMcpSnapshot()
  broadcast('state', { message: 'mcp enabled', name: params.name, mcp: status.mcp })
  return result
}

async function disableMcpServer(
  params: McpDisableParams,
): Promise<McpDisableResult> {
  const client = await getAppServerClient()
  const result = await client.disableMcp(params)
  await refreshMcpSnapshot()
  broadcast('state', { message: 'mcp disabled', name: params.name, mcp: status.mcp })
  return result
}

async function restartMcpServer(
  params: McpRestartParams,
): Promise<McpRestartResult> {
  const client = await getAppServerClient()
  const result = await client.restartMcp(params)
  await refreshMcpSnapshot()
  broadcast('state', {
    message: 'mcp restart requested',
    name: params.name,
    result,
    mcp: status.mcp,
  })
  return result
}

async function testMcpServer(params: McpTestParams): Promise<McpTestResult> {
  const client = await getAppServerClient()
  const result = await client.testMcp(params)
  broadcast('state', {
    message: 'mcp tested',
    name: params.name,
    result,
  })
  return result
}

async function searchMcpInstalls(
  params: McpInstallSearchParams = {},
): Promise<McpInstallSearchResult> {
  const client = await getAppServerClient()
  return client.searchMcpInstalls(params)
}

async function planMcpInstall(
  params: McpInstallPlanParams,
): Promise<McpInstallPlanResult> {
  const client = await getAppServerClient()
  return client.planMcpInstall(params)
}

async function planMcpAdopt(
  params: McpInstallAdoptPlanParams,
): Promise<McpInstallAdoptPlanResult> {
  const client = await getAppServerClient()
  return client.planMcpAdopt(params)
}

async function chooseMcpInstallManifest(): Promise<ImportedMcpManifestResult> {
  const result = await dialog.showOpenDialog({
    title: '导入 MCP 安装配置',
    buttonLabel: '导入配置',
    properties: ['openFile'],
    filters: [
      { name: 'MCP 安装配置', extensions: ['json'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const filePath = result.filePaths[0]!
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法读取 MCP manifest：${message}`)
  }

  const manifest = CcrMcpInstallManifestSchema().parse(parsed)
  return {
    canceled: false,
    path: filePath,
    manifest: manifest as Record<string, unknown>,
    summary: summarizeCcrMcpInstallManifest(manifest),
  }
}

async function chooseDesktopPath(
  event: Electron.IpcMainInvokeEvent,
  params: DesktopPathPickerInput = {},
): Promise<DesktopPathPickerResult> {
  const result = await dialog.showOpenDialog(getIpcWindow(event), {
    title: params.title,
    buttonLabel: params.buttonLabel,
    properties: [params.mode === 'file' ? 'openFile' : 'openDirectory'],
    ...(params.mode === 'file' && params.filters?.length
      ? { filters: params.filters }
      : {}),
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  return {
    canceled: false,
    path: result.filePaths[0]!,
  }
}

async function applyMcpInstall(
  params: McpInstallApplyParams,
): Promise<McpInstallApplyResult> {
  const client = await getAppServerClient()
  const result = await client.applyMcpInstall(params)
  await refreshMcpSnapshot()
  broadcast('state', {
    message: 'mcp install applied',
    name: params.name,
    result,
    mcp: status.mcp,
  })
  return result
}

async function saveMcpInstallManifest(
  params: McpInstallSaveManifestParams,
): Promise<McpInstallSaveManifestResult> {
  const client = await getAppServerClient()
  const result = await client.saveMcpInstallManifest(params)
  broadcast('state', {
    message: 'mcp install manifest saved',
    result,
  })
  return result
}

async function applyMcpAdopt(
  params: McpInstallAdoptApplyParams,
): Promise<McpInstallAdoptApplyResult> {
  const client = await getAppServerClient()
  const result = await client.applyMcpAdopt(params)
  await refreshMcpSnapshot()
  broadcast('state', {
    message: 'mcp adopted',
    name: params.name,
    result,
    mcp: status.mcp,
  })
  return result
}

async function listMcpInstalls(): Promise<McpInstallListResult> {
  const client = await getAppServerClient()
  return client.listMcpInstalls()
}

async function listCapabilityManagement(): Promise<CapabilitiesManagementListResult> {
  const client = await getAppServerClient()
  return client.listCapabilityManagement({
    cwd: status.workspacePath ?? defaultWorkspacePath,
  })
}

async function listPlugins(): Promise<PluginsCatalogListResult> {
  const client = await getAppServerClient()
  return client.listPlugins({
    cwd: status.workspacePath ?? defaultWorkspacePath,
  })
}

async function inspectPlugin(
  params: PluginsInspectParams,
): Promise<PluginsInspectResult> {
  const client = await getAppServerClient()
  return client.inspectPlugin({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function addPluginMarketplace(
  params: PluginsMarketplaceAddParams,
): Promise<PluginsMarketplaceAddResult> {
  const client = await getAppServerClient()
  return client.addPluginMarketplace({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function importLocalPlugin(
  params: PluginsLocalImportParams,
): Promise<PluginsLocalImportResult> {
  const client = await getAppServerClient()
  const result = await client.importLocalPlugin({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
    enableAfterInstall: params.enableAfterInstall ?? true,
  })
  await activatePluginRuntimeSnapshot('plugin-local-import')
  return result
}

async function removePluginMarketplace(
  params: PluginsMarketplaceRemoveParams,
): Promise<PluginsMarketplaceRemoveResult> {
  const client = await getAppServerClient()
  return client.removePluginMarketplace({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function refreshPluginMarketplace(
  params: PluginsMarketplaceRefreshParams,
): Promise<PluginsMarketplaceRefreshResult> {
  const client = await getAppServerClient()
  return client.refreshPluginMarketplace({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function planPluginAction(
  params: PluginsActionPlanParams,
): Promise<PluginsActionPlanResult> {
  const client = await getAppServerClient()
  return client.planPluginAction({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function applyPluginAction(
  params: PluginsActionApplyParams,
): Promise<PluginsActionApplyResult> {
  const client = await getAppServerClient()
  const operation = await client.applyPluginAction(params)
  if (operation.status === 'succeeded') {
    await activatePluginRuntimeSnapshot(`plugin-action:${operation.action}`)
  }
  broadcast('state', {
    message: 'plugin action applied',
    operation,
  })
  return operation
}

async function getPluginOperation(
  params: PluginsOperationGetParams,
): Promise<PluginsOperationGetResult> {
  const client = await getAppServerClient()
  return client.getPluginOperation({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function cancelPluginOperation(
  params: PluginsOperationCancelParams,
): Promise<PluginsOperationCancelResult> {
  const client = await getAppServerClient()
  return client.cancelPluginOperation({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function getPluginRuntime(): Promise<PluginsRuntimeGetResult> {
  const client = await getAppServerClient()
  return client.getPluginRuntime({
    cwd: status.workspacePath ?? defaultWorkspacePath,
  })
}

async function getPluginConfiguration(
  params: PluginsConfigGetParams,
): Promise<PluginsConfigGetResult> {
  const client = await getAppServerClient()
  return client.getPluginConfiguration({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function listPluginApps(
  params: PluginsAppsListParams,
): Promise<PluginsAppsListResult> {
  const client = await getAppServerClient()
  return client.listPluginApps({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function planCapabilityManagementAction(
  params: CapabilitiesManagementActionPlanParams,
): Promise<CapabilitiesManagementActionPlanResult> {
  const client = await getAppServerClient()
  return client.planCapabilityManagementAction({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
}

async function applyCapabilityManagementAction(
  params: CapabilitiesManagementActionApplyParams,
): Promise<CapabilitiesManagementActionApplyResult> {
  const client = await getAppServerClient()
  const result = await client.applyCapabilityManagementAction({
    ...params,
    cwd: params.cwd ?? status.workspacePath ?? defaultWorkspacePath,
  })
  if (result.plan.target?.kind === 'mcp-server') {
    await refreshMcpSnapshot()
  }
  broadcast('state', {
    message: 'capability management action applied',
    capabilityId: params.capabilityId,
    action: params.action,
    result,
    mcp: status.mcp,
  })
  return result
}

async function uninstallMcp(
  params: McpInstallUninstallParams,
): Promise<McpInstallUninstallResult> {
  const client = await getAppServerClient()
  const result = await client.uninstallMcp(params)
  await refreshMcpSnapshot()
  broadcast('state', {
    message: 'mcp uninstalled',
    name: params.name,
    result,
    mcp: status.mcp,
  })
  return result
}

async function repairMcp(
  params: McpInstallRepairParams,
): Promise<McpInstallRepairResult> {
  const client = await getAppServerClient()
  const result = await client.repairMcp(params)
  await refreshMcpSnapshot()
  broadcast('state', {
    message: 'mcp repaired',
    name: params.name,
    result,
    mcp: status.mcp,
  })
  return result
}

async function listSkillInstalls(): Promise<SkillInstallListResult> {
  const client = await getAppServerClient()
  return client.listSkillInstalls()
}

async function inspectSkill(
  params: SkillInspectParams,
): Promise<SkillInspectResult> {
  const client = await getAppServerClient()
  return client.inspectSkill(params)
}

async function searchSkillInstalls(
  params: SkillInstallSearchParams = {},
): Promise<SkillInstallSearchResult> {
  const client = await getAppServerClient()
  return client.searchSkillInstalls(params)
}

async function planSkillInstall(
  params: SkillInstallPlanParams,
): Promise<SkillInstallPlanResult> {
  const client = await getAppServerClient()
  return client.planSkillInstall(params)
}

async function applySkillInstall(
  params: SkillInstallApplyParams,
): Promise<SkillInstallApplyResult> {
  const client = await getAppServerClient()
  const result = await client.applySkillInstall(params)
  broadcast('state', {
    message: 'skill install applied',
    name: params.manifest['name'],
    result,
  })
  return result
}

async function planSkillImport(
  params: SkillImportPlanParams,
): Promise<SkillImportPlanResult> {
  const client = await getAppServerClient()
  return client.planSkillImport(params)
}

async function applySkillImport(
  params: SkillImportApplyParams,
): Promise<SkillImportApplyResult> {
  const client = await getAppServerClient()
  const result = await client.applySkillImport(params)
  broadcast('state', {
    message: 'skill import applied',
    source: params.source,
    result,
  })
  return result
}

async function setSkillEnabled(
  params: SkillSetEnabledParams,
): Promise<SkillSetEnabledResult> {
  const client = await getAppServerClient()
  const result = await client.setSkillEnabled(params)
  broadcast('state', {
    message: params.enabled ? 'skill enabled' : 'skill disabled',
    skillRef: params.skillRef,
    result,
  })
  return result
}

async function setSkillInvocation(
  params: SkillSetInvocationParams,
): Promise<SkillSetInvocationResult> {
  const client = await getAppServerClient()
  const result = await client.setSkillInvocation(params)
  broadcast('state', {
    message: 'skill invocation updated',
    skillRef: params.skillRef,
    result,
  })
  return result
}

async function uninstallSkill(
  params: SkillInstallUninstallParams,
): Promise<SkillInstallUninstallResult> {
  const client = await getAppServerClient()
  const result = await client.uninstallSkill(params)
  broadcast('state', {
    message: 'skill uninstalled',
    skillRef: params.skillRef,
    result,
  })
  return result
}

async function repairSkill(
  params: SkillInstallRepairParams,
): Promise<SkillInstallRepairResult> {
  const client = await getAppServerClient()
  const result = await client.repairSkill(params)
  broadcast('state', {
    message: 'skill repaired',
    skillRef: params.skillRef,
    result,
  })
  return result
}

async function saveSkillInstallManifest(
  params: SkillInstallSaveManifestParams,
): Promise<SkillInstallSaveManifestResult> {
  const client = await getAppServerClient()
  const result = await client.saveSkillInstallManifest(params)
  broadcast('state', {
    message: 'skill install manifest saved',
    result,
  })
  return result
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

async function startTurn(input: DesktopStartTurnInput): Promise<TurnStartResult> {
  await ensureAppServer()
  if (!managedClient) {
    throw new Error('App Server client is not available.')
  }

  const turnInput = normalizeDesktopStartTurnInput(input)
  const imageGeneration = resolveDesktopImageGenerationOption(input)
  const thread = status.thread ?? (await startThread()).thread
  const result = await managedClient.client.startTurn({
    threadId: thread.threadId,
    input: turnInput,
    options: {
      stream: true,
      ...(imageGeneration ? { imageGeneration } : {}),
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
  await refreshPendingPermissionsSnapshot()
  await refreshThreadDisplaySnapshot()
  broadcast('state', { message: 'turn queued', turn: result.turn })
  return result
}

function resolveDesktopImageGenerationOption(
  input: DesktopStartTurnInput,
): DesktopImageGenerationOption | undefined {
  if (typeof input !== 'string' && input.options?.imageGeneration !== undefined) {
    return input.options.imageGeneration
  }
  const attachments = typeof input === 'string' ? [] : (input.attachments ?? [])
  if (attachments.length > 0) {
    return undefined
  }
  const prompt = extractImageGenerationPrompt(
    typeof input === 'string' ? input : (input.text ?? ''),
  )
  return prompt ? { enabled: true, prompt } : undefined
}

function normalizeDesktopStartTurnInput(
  input: DesktopStartTurnInput,
): TurnStartParams['input'] {
  if (typeof input === 'string') {
    return {
      type: 'text',
      text: input,
    }
  }

  const text = String(input.text ?? '').trim()
  const attachmentBlocks = (input.attachments ?? [])
    .map(toTurnContentBlock)
    .filter((block): block is NonNullable<ReturnType<typeof toTurnContentBlock>> =>
      block !== null,
    )

  if (attachmentBlocks.length === 0) {
    return {
      type: 'text',
      text,
    }
  }

  return {
    type: 'content',
    content: [
      ...(text ? [{ type: 'text' as const, text }] : []),
      ...attachmentBlocks,
    ],
  }
}

function toTurnContentBlock(
  attachment: DesktopTurnAttachmentInput,
): Extract<TurnStartParams['input'], { type: 'content' }>['content'][number] | null {
  if (attachment.type === 'text') {
    const text = typeof attachment.text === 'string' ? attachment.text : ''
    if (!text) {
      return null
    }
    return {
      type: 'text',
      text: formatTextAttachmentContent(attachment, text),
    }
  }

  if (attachment.type !== 'image' || !attachment.source) {
    return null
  }

  const displayName = normalizeOptionalString(attachment.displayName)
  const attachmentId = normalizeOptionalString(attachment.attachmentId)
  const mimeType = normalizeImageMimeType(attachment.mimeType ?? '', displayName ?? '')
  const sizeBytes =
    typeof attachment.sizeBytes === 'number' && Number.isFinite(attachment.sizeBytes)
      ? Math.max(0, Math.trunc(attachment.sizeBytes))
      : undefined

  return {
    type: 'image',
    ...(attachmentId ? { attachmentId } : {}),
    ...(displayName ? { displayName } : {}),
    mimeType,
    ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    source: attachment.source,
  }
}

function formatTextAttachmentContent(
  attachment: DesktopTurnAttachmentInput,
  text: string,
): string {
  const displayName = normalizeOptionalString(attachment.displayName) ?? '未命名文本文件'
  const mimeType = normalizeOptionalString(attachment.mimeType) ?? 'text/plain'
  const sizeBytes =
    typeof attachment.sizeBytes === 'number' && Number.isFinite(attachment.sizeBytes)
      ? `${Math.max(0, Math.trunc(attachment.sizeBytes))} bytes`
      : '未知大小'
  return [
    `[文本文件：${displayName}]`,
    `类型：${mimeType}`,
    `大小：${sizeBytes}`,
    '',
    text,
  ].join('\n')
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
  action: 'open' | 'reveal' | 'save',
  targetPath: string,
): Promise<boolean> {
  if (isInsideWorkspace(targetPath)) {
    return true
  }

  const confirmLabel = getOutsideWorkspaceConfirmLabel(action)
  const rendererConfirmed = await requestRendererConfirm({
    title: '路径位于工作区外',
    message: '该路径不在当前 CCR 工作区内。',
    detail: targetPath,
    confirmLabel,
    tone: 'warning',
  })
  if (rendererConfirmed !== null) {
    return rendererConfirmed
  }

  const result = await dialog.showMessageBox(mainWindow ?? undefined, {
    type: 'warning',
    buttons: ['取消', confirmLabel],
    defaultId: 0,
    cancelId: 0,
    title: '路径位于工作区外',
    message: '该路径不在当前 CCR 工作区内。',
    detail: targetPath,
  })
  return result.response === 1
}

function requestRendererConfirm(
  input: Omit<DesktopConfirmRequestPayload, 'id'>,
): Promise<boolean | null> {
  const targetWindow = mainWindow
  if (
    !targetWindow ||
    targetWindow.isDestroyed() ||
    targetWindow.webContents.isDestroyed()
  ) {
    return Promise.resolve(null)
  }

  const targetWebContents = targetWindow.webContents
  const id = randomUUID()
  const payload: DesktopConfirmRequestPayload = { id, ...input }

  return new Promise(resolve => {
    let settled = false
    let timeout: NodeJS.Timeout

    const finish = (confirmed: boolean) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      targetWebContents.removeListener('destroyed', handleDestroyed)
      ipcMain.removeListener('ccr:confirm-response', handleResponse)
      resolve(confirmed)
    }

    const handleDestroyed = () => finish(false)

    const handleResponse = (
      event: Electron.IpcMainEvent,
      response: DesktopConfirmResponsePayload,
    ) => {
      if (event.sender !== targetWebContents || response?.id !== id) {
        return
      }
      finish(Boolean(response.confirmed))
    }

    timeout = setTimeout(() => finish(false), 5 * 60 * 1000)
    targetWebContents.once('destroyed', handleDestroyed)
    ipcMain.on('ccr:confirm-response', handleResponse)

    try {
      targetWebContents.send('ccr:confirm-request', payload)
    } catch {
      finish(false)
    }
  })
}

function getOutsideWorkspaceConfirmLabel(
  action: 'open' | 'reveal' | 'save',
): string {
  switch (action) {
    case 'open':
      return '仍然打开'
    case 'reveal':
      return '仍然定位'
    case 'save':
      return '仍然另存'
  }
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

async function saveLocalPathAs(
  targetPath: string,
): Promise<{ saved: boolean; path?: string }> {
  const resolvedPath = resolveWorkspacePath(targetPath)
  if (!(await confirmOutsideWorkspaceAccess('save', resolvedPath))) {
    return { saved: false }
  }

  const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
    title: '另存生成物',
    defaultPath: basename(resolvedPath),
  })
  if (result.canceled || !result.filePath) {
    return { saved: false }
  }

  await copyFile(resolvedPath, result.filePath)
  return { saved: true, path: result.filePath }
}

async function prepareDesktopAttachments(
  input: DesktopAttachmentPrepareInput,
): Promise<DesktopAttachmentPrepareResult> {
  const attachments = await Promise.all(
    (input.attachments ?? []).map(prepareDesktopAttachment),
  )
  return { attachments }
}

async function prepareDesktopAttachment(
  attachment: NonNullable<DesktopAttachmentPrepareInput['attachments']>[number],
): Promise<DesktopPreparedAttachment> {
  const id = normalizeOptionalString(attachment.id) ?? randomUUID()
  const displayName = normalizeOptionalString(attachment.name) ?? '未命名附件'
  const modality = attachment.modality ?? 'file'
  const rawMimeType = normalizeOptionalString(attachment.mimeType) ?? ''
  if (modality === 'image') {
    return prepareDesktopImageAttachment({
      id,
      displayName,
      rawMimeType,
      attachment,
    })
  }

  if (modality === 'file') {
    return prepareDesktopFileAttachment({
      id,
      displayName,
      rawMimeType,
      attachment,
    })
  }

  return prepareMetadataOnlyAttachment({
    id,
    displayName,
    mimeType: rawMimeType || 'application/octet-stream',
    sizeBytes: normalizeSizeBytes(attachment.sizeBytes),
    modality,
    path: normalizeOptionalString(attachment.path),
  })
}

async function prepareDesktopImageAttachment(input: {
  id: string
  displayName: string
  rawMimeType: string
  attachment: NonNullable<DesktopAttachmentPrepareInput['attachments']>[number]
}): Promise<DesktopPreparedAttachment> {
  const path = normalizeOptionalString(input.attachment.path)
  const mimeType = normalizeImageMimeType(input.rawMimeType, path ?? input.displayName)
  const inlineContent = readInlineAttachmentBuffer(input.attachment.data)
  if (inlineContent) {
    return prepareDesktopInlineImageAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType,
      content: inlineContent,
    })
  }

  if (!path) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType,
      sizeBytes: normalizeSizeBytes(input.attachment.sizeBytes),
      modality: 'image',
      error: '无法从系统文件选择器读取图片路径。',
    })
  }

  const resolvedPath = resolveWorkspacePath(path)
  const resolvedMimeType = normalizeImageMimeType(mimeType, resolvedPath)
  if (!DESKTOP_IMAGE_MIME_TYPES.has(resolvedMimeType)) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType: resolvedMimeType,
      sizeBytes: normalizeSizeBytes(input.attachment.sizeBytes),
      modality: 'image',
      error: '暂不支持该图片格式。',
    })
  }

  try {
    const content = await readFile(resolvedPath)
    if (content.byteLength > DESKTOP_MAX_IMAGE_BYTES) {
      return rejectPreparedAttachment({
        id: input.id,
        displayName: input.displayName,
        mimeType: resolvedMimeType,
        sizeBytes: content.byteLength,
        modality: 'image',
        error: `图片超过 ${formatBytes(DESKTOP_MAX_IMAGE_BYTES)} 上限。`,
      })
    }

    return createPreparedImageAttachment({
      id: input.id,
      displayName: input.displayName,
      resolvedMimeType,
      sizeBytes: content.byteLength,
      sourcePath: resolvedPath,
      safety: isInsideWorkspace(resolvedPath) ? 'workspace' : 'outside_workspace',
    })
  } catch (error) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType: resolvedMimeType,
      sizeBytes: normalizeSizeBytes(input.attachment.sizeBytes),
      modality: 'image',
      error: error instanceof Error ? error.message : '图片读取失败。',
    })
  }
}

async function prepareDesktopInlineImageAttachment(input: {
  id: string
  displayName: string
  mimeType: string
  content: Buffer
}): Promise<DesktopPreparedAttachment> {
  const resolvedMimeType = normalizeImageMimeType(
    input.mimeType,
    input.displayName,
  )
  if (!DESKTOP_IMAGE_MIME_TYPES.has(resolvedMimeType)) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType: resolvedMimeType,
      sizeBytes: input.content.byteLength,
      modality: 'image',
      error: '暂不支持该图片格式。',
    })
  }

  if (input.content.byteLength > DESKTOP_MAX_IMAGE_BYTES) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType: resolvedMimeType,
      sizeBytes: input.content.byteLength,
      modality: 'image',
      error: `图片超过 ${formatBytes(DESKTOP_MAX_IMAGE_BYTES)} 上限。`,
    })
  }

  try {
    const cacheDir = getClipboardAttachmentCacheDir()
    await mkdir(cacheDir, { recursive: true })
    const cachePath = join(
      cacheDir,
      `clipboard-${Date.now()}-${randomUUID()}${getImageExtension(resolvedMimeType)}`,
    )
    await writeFile(cachePath, input.content)
    return createPreparedImageAttachment({
      id: input.id,
      displayName: input.displayName,
      resolvedMimeType,
      sizeBytes: input.content.byteLength,
      sourcePath: cachePath,
      safety: 'outside_workspace',
    })
  } catch (error) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType: resolvedMimeType,
      sizeBytes: input.content.byteLength,
      modality: 'image',
      error: error instanceof Error ? error.message : '剪贴板图片读取失败。',
    })
  }
}

function createPreparedImageAttachment(input: {
  id: string
  displayName: string
  resolvedMimeType: string
  sizeBytes: number
  sourcePath: string
  safety: 'workspace' | 'outside_workspace'
}): DesktopPreparedAttachment {
  const contentRef = `desktop-image:${randomUUID()}`
  return {
    id: input.id,
    attachmentId: contentRef,
    displayName: input.displayName,
    mimeType: input.resolvedMimeType,
    sizeBytes: input.sizeBytes,
    modality: 'image',
    source: {
      kind: 'file',
      path: input.sourcePath,
    },
    contentRef,
    sendMode: 'image',
    safety: input.safety,
    previewDataUrl: createImagePreviewDataUrl(input.sourcePath),
    status: 'ready',
  }
}

function readInlineAttachmentBuffer(value: unknown): Buffer | null {
  if (!value) {
    return null
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value)
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }
  if (Array.isArray(value) && value.every(item => Number.isInteger(item))) {
    return Buffer.from(value)
  }
  return null
}

function getClipboardAttachmentCacheDir(): string {
  return join(app.getPath('userData'), 'attachments', 'clipboard')
}

function getImageExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return '.jpg'
  }
  if (mimeType === 'image/webp') {
    return '.webp'
  }
  if (mimeType === 'image/gif') {
    return '.gif'
  }
  return '.png'
}

async function prepareDesktopFileAttachment(input: {
  id: string
  displayName: string
  rawMimeType: string
  attachment: NonNullable<DesktopAttachmentPrepareInput['attachments']>[number]
}): Promise<DesktopPreparedAttachment> {
  const path = normalizeOptionalString(input.attachment.path)
  const mimeType = normalizeTextMimeType(input.rawMimeType, path ?? input.displayName)
  const sizeBytes = normalizeSizeBytes(input.attachment.sizeBytes)
  if (!path) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType,
      sizeBytes,
      modality: 'file',
      error: '无法从系统文件选择器读取文件路径。',
    })
  }

  const resolvedPath = resolveWorkspacePath(path)
  if (!isTextLikeMimeOrName(mimeType, resolvedPath)) {
    return prepareMetadataOnlyAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType,
      sizeBytes,
      modality: 'file',
      path: resolvedPath,
    })
  }

  try {
    const content = await readFile(resolvedPath)
    if (content.byteLength > DESKTOP_MAX_TEXT_FILE_BYTES) {
      return {
        id: input.id,
        displayName: input.displayName,
        mimeType,
        sizeBytes: content.byteLength,
        modality: 'file',
        source: {
          kind: 'file',
          path: resolvedPath,
        },
        sendMode: 'metadata',
        safety: isInsideWorkspace(resolvedPath) ? 'workspace' : 'outside_workspace',
        status: 'ready',
        error: `文本文件超过 ${formatBytes(DESKTOP_MAX_TEXT_FILE_BYTES)}，当前仅保留元信息。`,
      }
    }

    const textContent = content.toString('utf8')
    const contentRef = `desktop-text:${randomUUID()}`
    return {
      id: input.id,
      attachmentId: contentRef,
      displayName: input.displayName,
      mimeType,
      sizeBytes: content.byteLength,
      modality: 'file',
      source: {
        kind: 'file',
        path: resolvedPath,
      },
      contentRef,
      sendMode: 'text',
      safety: isInsideWorkspace(resolvedPath) ? 'workspace' : 'outside_workspace',
      previewText: createTextPreview(textContent),
      textContent,
      status: 'ready',
    }
  } catch (error) {
    return rejectPreparedAttachment({
      id: input.id,
      displayName: input.displayName,
      mimeType,
      sizeBytes,
      modality: 'file',
      error: error instanceof Error ? error.message : '文本文件读取失败。',
    })
  }
}

function prepareMetadataOnlyAttachment(input: {
  id: string
  displayName: string
  mimeType: string
  sizeBytes: number
  modality: 'image' | 'file' | 'audio'
  path?: string
}): DesktopPreparedAttachment {
  const resolvedPath = input.path ? resolveWorkspacePath(input.path) : undefined
  return {
    id: input.id,
    displayName: input.displayName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    modality: input.modality,
    ...(resolvedPath
      ? {
          source: {
            kind: 'file' as const,
            path: resolvedPath,
          },
          safety: isInsideWorkspace(resolvedPath)
            ? ('workspace' as const)
            : ('outside_workspace' as const),
        }
      : {}),
    sendMode: 'metadata',
    status: 'ready',
  }
}

function rejectPreparedAttachment(input: {
  id: string
  displayName: string
  mimeType: string
  sizeBytes: number
  modality: 'image' | 'file' | 'audio'
  error: string
}): DesktopPreparedAttachment {
  return {
    id: input.id,
    displayName: input.displayName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    modality: input.modality,
    status: 'rejected',
    error: input.error,
  }
}

function createImagePreviewDataUrl(
  path: string,
  maxEdge = 96,
): string | undefined {
  const image = nativeImage.createFromPath(path)
  return createImagePreviewDataUrlFromNativeImage(image, maxEdge)
}

function createImagePreviewDataUrlFromBuffer(
  buffer: Buffer,
  maxEdge = 96,
): string | undefined {
  const image = nativeImage.createFromBuffer(buffer)
  return createImagePreviewDataUrlFromNativeImage(image, maxEdge)
}

function createImagePreviewDataUrlFromNativeImage(
  image: Electron.NativeImage,
  maxEdge = 96,
): string | undefined {
  if (image.isEmpty()) {
    return undefined
  }

  const size = image.getSize()
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height, 1))
  const preview =
    scale < 1
      ? image.resize({
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale)),
        })
      : image
  return preview.toDataURL()
}

function normalizeImagePreviewMaxEdge(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 96
  }
  return Math.max(64, Math.min(1600, Math.round(value)))
}

async function createRemoteImagePreviewDataUrl(
  url: string,
  maxEdge: number,
): Promise<string | undefined> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return undefined
    }

    const contentLength = Number.parseInt(
      response.headers.get('content-length') ?? '',
      10,
    )
    if (
      Number.isFinite(contentLength) &&
      contentLength > DESKTOP_MAX_REMOTE_IMAGE_PREVIEW_BYTES
    ) {
      return undefined
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > DESKTOP_MAX_REMOTE_IMAGE_PREVIEW_BYTES) {
      return undefined
    }

    return createImagePreviewDataUrlFromBuffer(Buffer.from(arrayBuffer), maxEdge)
  } catch {
    return undefined
  }
}

function isRemoteImagePreviewPath(path: string): boolean {
  return /^https?:\/\//i.test(path)
}

async function createDesktopImagePreview(
  input: DesktopImagePreviewInput,
): Promise<DesktopImagePreviewResult> {
  const path = normalizeOptionalString(input.path)
  if (!path) {
    return {}
  }
  const maxEdge = normalizeImagePreviewMaxEdge(input.maxEdge)
  if (isRemoteImagePreviewPath(path)) {
    return {
      previewDataUrl: await createRemoteImagePreviewDataUrl(path, maxEdge),
    }
  }
  const resolvedPath = resolveWorkspacePath(path)
  return {
    previewDataUrl: createImagePreviewDataUrl(resolvedPath, maxEdge),
  }
}

function normalizeImageMimeType(mimeType: string, pathOrName: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (DESKTOP_IMAGE_MIME_TYPES.has(normalized)) {
    return normalized
  }

  const extension = extname(pathOrName).toLowerCase()
  if (extension === '.png') {
    return 'image/png'
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }
  if (extension === '.webp') {
    return 'image/webp'
  }
  if (extension === '.gif') {
    return 'image/gif'
  }
  return normalized || 'application/octet-stream'
}

function normalizeTextMimeType(mimeType: string, pathOrName: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized) {
    return normalized
  }
  const extension = extname(pathOrName).toLowerCase()
  if (extension === '.json' || extension === '.jsonl') {
    return 'application/json'
  }
  if (extension === '.xml') {
    return 'application/xml'
  }
  if (extension === '.yaml' || extension === '.yml') {
    return 'application/yaml'
  }
  if (
    /\.(txt|md|markdown|csv|ts|tsx|js|jsx|py|java|go|rs|cs|cpp|c|h|hpp|sql|toml|ini|env|log)$/i.test(
      pathOrName,
    )
  ) {
    return 'text/plain'
  }
  return 'application/octet-stream'
}

function isTextLikeMimeOrName(mimeType: string, pathOrName: string): boolean {
  if (
    mimeType.startsWith('text/') ||
    [
      'application/json',
      'application/x-ndjson',
      'application/xml',
      'application/yaml',
      'application/javascript',
      'application/typescript',
    ].includes(mimeType)
  ) {
    return true
  }

  return /\.(txt|md|markdown|json|jsonl|yaml|yml|xml|csv|ts|tsx|js|jsx|py|java|go|rs|cs|cpp|c|h|hpp|sql|toml|ini|env|log)$/i.test(
    pathOrName,
  )
}

function createTextPreview(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  return normalized.length > 400 ? `${normalized.slice(0, 400).trim()}\n...` : normalized
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeSizeBytes(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
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
    title: 'CCR',
    icon: windowIcon,
    backgroundColor: '#fbf4e9',
    autoHideMenuBar: true,
    show: false,
    ...(useCustomTitleBar
      ? {
          titleBarStyle: 'hidden',
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
  attachDesktopWindowStateEvents(mainWindow)
  if (shouldStartMaximized) {
    mainWindow.maximize()
  }
  attachRendererDiagnostics(mainWindow)
  revealWindowWhenReady(mainWindow)

  const rendererLoadPromise = process.env.ELECTRON_RENDERER_URL
    ? mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    : mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  rendererLoadPromise.catch(error => {
    void appendDesktopLog('renderer.log', {
      event: 'load-error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    if (!mainWindow?.isDestroyed()) {
      mainWindow.show()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function revealWindowWhenReady(window: BrowserWindow): void {
  let revealed = false
  let loadFinished = false
  let readyToShow = false

  const reveal = (reason: string): void => {
    if (revealed || window.isDestroyed()) {
      return
    }
    revealed = true
    void appendDesktopLog('renderer.log', {
      event: 'window-revealed',
      reason,
      url: window.webContents.getURL(),
      loadFinished,
      readyToShow,
    })
    window.show()
  }

  window.once('ready-to-show', () => {
    readyToShow = true
    void appendDesktopLog('renderer.log', {
      event: 'ready-to-show',
      url: window.webContents.getURL(),
      loadFinished,
    })
  })
  window.webContents.once('did-finish-load', () => {
    loadFinished = true
    setTimeout(() => reveal('did-finish-load'), 50)
  })
  window.webContents.once('did-fail-load', () => reveal('did-fail-load'))
  const fallbackTimer = setTimeout(() => reveal('fallback-timeout'), WINDOW_REVEAL_FALLBACK_MS)
  if (typeof fallbackTimer === 'object' && 'unref' in fallbackTimer) {
    fallbackTimer.unref()
  }
}

function attachRendererDiagnostics(window: BrowserWindow): void {
  const verboseDiagnostics =
    runtime.mode === 'development' || process.env.CCR_DESKTOP_RENDERER_DIAGNOSTICS === '1'

  const preloadPath = join(__dirname, '../preload/index.mjs')
  void appendDesktopLog('renderer.log', {
    event: 'window-created',
    rendererUrl: process.env.ELECTRON_RENDERER_URL ?? null,
    preloadPath,
    preloadExists: existsSync(preloadPath),
  })

  if (verboseDiagnostics) {
    window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      void appendDesktopLog('renderer.log', {
        event: 'console-message',
        level,
        message,
        line,
        sourceId,
      })
    })
  }

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
    if (!verboseDiagnostics) {
      return
    }
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
  await refreshRuntimeSnapshots().catch(() => undefined)
  await refreshPendingPermissionsSnapshot().catch(() => undefined)
  await refreshThreadDisplaySnapshot().catch(() => undefined)
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

ipcMain.handle(
  'ccr:choose-path',
  async (event, params?: DesktopPathPickerInput) => {
    return chooseDesktopPath(event, params ?? {})
  },
)

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

ipcMain.handle(
  'ccr:rename-session-history',
  async (
    _event,
    input: { sessionId: string; title: string; transcriptPath?: string },
  ) => {
    return renameSessionHistory(input)
  },
)

ipcMain.handle('ccr:refresh-mcp', async () => {
  await refreshMcpSnapshot()
  broadcast('state', { message: 'mcp refreshed', mcp: status.mcp })
  return status.mcp
})

ipcMain.handle('ccr:mcp-inspect', async (_event, params: McpInspectParams) => {
  return inspectMcpServer(params)
})

ipcMain.handle('ccr:mcp-enable', async (_event, params: McpEnableParams) => {
  return enableMcpServer(params)
})

ipcMain.handle('ccr:mcp-disable', async (_event, params: McpDisableParams) => {
  return disableMcpServer(params)
})

ipcMain.handle('ccr:mcp-restart', async (_event, params: McpRestartParams) => {
  return restartMcpServer(params)
})

ipcMain.handle('ccr:mcp-test', async (_event, params: McpTestParams) => {
  return testMcpServer(params)
})

ipcMain.handle(
  'ccr:mcp-install-search',
  async (_event, params?: McpInstallSearchParams) => {
    return searchMcpInstalls(params ?? {})
  },
)

ipcMain.handle(
  'ccr:mcp-install-plan',
  async (_event, params: McpInstallPlanParams) => {
    return planMcpInstall(params)
  },
)

ipcMain.handle('ccr:mcp-install-choose-manifest', async () => {
  return chooseMcpInstallManifest()
})

ipcMain.handle(
  'ccr:mcp-install-apply',
  async (_event, params: McpInstallApplyParams) => {
    return applyMcpInstall(params)
  },
)

ipcMain.handle(
  'ccr:mcp-install-save-manifest',
  async (_event, params: McpInstallSaveManifestParams) => {
    return saveMcpInstallManifest(params)
  },
)

ipcMain.handle(
  'ccr:mcp-install-adopt-plan',
  async (_event, params: McpInstallAdoptPlanParams) => {
    return planMcpAdopt(params)
  },
)

ipcMain.handle(
  'ccr:mcp-install-adopt-apply',
  async (_event, params: McpInstallAdoptApplyParams) => {
    return applyMcpAdopt(params)
  },
)

ipcMain.handle('ccr:mcp-install-list', async () => {
  return listMcpInstalls()
})

ipcMain.handle('ccr:capabilities-management-list', async () => {
  return listCapabilityManagement()
})

ipcMain.handle('ccr:plugins-list', async () => {
  return listPlugins()
})

ipcMain.handle(
  'ccr:plugin-inspect',
  async (_event, params: PluginsInspectParams) => {
    return inspectPlugin(params)
  },
)

ipcMain.handle(
  'ccr:plugin-marketplace-add',
  async (_event, params: PluginsMarketplaceAddParams) => {
    return addPluginMarketplace(params)
  },
)

ipcMain.handle(
  'ccr:plugin-local-import',
  async (_event, params: PluginsLocalImportParams) => {
    return importLocalPlugin(params)
  },
)

ipcMain.handle(
  'ccr:plugin-marketplace-remove',
  async (_event, params: PluginsMarketplaceRemoveParams) => {
    return removePluginMarketplace(params)
  },
)

ipcMain.handle(
  'ccr:plugin-marketplace-refresh',
  async (_event, params: PluginsMarketplaceRefreshParams) => {
    return refreshPluginMarketplace(params)
  },
)

ipcMain.handle(
  'ccr:plugin-action-plan',
  async (_event, params: PluginsActionPlanParams) => {
    return planPluginAction(params)
  },
)

ipcMain.handle(
  'ccr:plugin-action-apply',
  async (_event, params: PluginsActionApplyParams) => {
    return applyPluginAction(params)
  },
)

ipcMain.handle(
  'ccr:plugin-operation-get',
  async (_event, params: PluginsOperationGetParams) => {
    return getPluginOperation(params)
  },
)

ipcMain.handle(
  'ccr:plugin-operation-cancel',
  async (_event, params: PluginsOperationCancelParams) => {
    return cancelPluginOperation(params)
  },
)

ipcMain.handle('ccr:plugin-runtime-get', async () => {
  return getPluginRuntime()
})

ipcMain.handle(
  'ccr:plugin-config-get',
  async (_event, params: PluginsConfigGetParams) => {
    return getPluginConfiguration(params)
  },
)

ipcMain.handle(
  'ccr:plugin-apps-list',
  async (_event, params: PluginsAppsListParams) => {
    return listPluginApps(params)
  },
)

ipcMain.handle(
  'ccr:capabilities-management-action-plan',
  async (_event, params: CapabilitiesManagementActionPlanParams) => {
    return planCapabilityManagementAction(params)
  },
)

ipcMain.handle(
  'ccr:capabilities-management-action-apply',
  async (_event, params: CapabilitiesManagementActionApplyParams) => {
    return applyCapabilityManagementAction(params)
  },
)

ipcMain.handle(
  'ccr:mcp-install-uninstall',
  async (_event, params: McpInstallUninstallParams) => {
    return uninstallMcp(params)
  },
)

ipcMain.handle(
  'ccr:mcp-install-repair',
  async (_event, params: McpInstallRepairParams) => {
    return repairMcp(params)
  },
)

ipcMain.handle('ccr:skill-install-list', async () => {
  return listSkillInstalls()
})

ipcMain.handle(
  'ccr:skill-inspect',
  async (_event, params: SkillInspectParams) => {
    return inspectSkill(params)
  },
)

ipcMain.handle(
  'ccr:skill-install-search',
  async (_event, params?: SkillInstallSearchParams) => {
    return searchSkillInstalls(params ?? {})
  },
)

ipcMain.handle(
  'ccr:skill-install-plan',
  async (_event, params: SkillInstallPlanParams) => {
    return planSkillInstall(params)
  },
)

ipcMain.handle(
  'ccr:skill-install-apply',
  async (_event, params: SkillInstallApplyParams) => {
    return applySkillInstall(params)
  },
)

ipcMain.handle(
  'ccr:skill-import-plan',
  async (_event, params: SkillImportPlanParams) => {
    return planSkillImport(params)
  },
)

ipcMain.handle(
  'ccr:skill-import-apply',
  async (_event, params: SkillImportApplyParams) => {
    return applySkillImport(params)
  },
)

ipcMain.handle(
  'ccr:skill-state-enabled',
  async (_event, params: SkillSetEnabledParams) => {
    return setSkillEnabled(params)
  },
)

ipcMain.handle(
  'ccr:skill-state-invocation',
  async (_event, params: SkillSetInvocationParams) => {
    return setSkillInvocation(params)
  },
)

ipcMain.handle(
  'ccr:skill-install-uninstall',
  async (_event, params: SkillInstallUninstallParams) => {
    return uninstallSkill(params)
  },
)

ipcMain.handle(
  'ccr:skill-install-repair',
  async (_event, params: SkillInstallRepairParams) => {
    return repairSkill(params)
  },
)

ipcMain.handle(
  'ccr:skill-install-save-manifest',
  async (_event, params: SkillInstallSaveManifestParams) => {
    return saveSkillInstallManifest(params)
  },
)

ipcMain.handle('ccr:refresh-runtime', async () => {
  await ensureAppServer()
  await activatePluginRuntimeSnapshot('manual-refresh-runtime')
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
  broadcast('state', {
    message: 'compact completed',
    compact: result,
    context: status.context,
    compactStatus: status.compact,
    memory: status.memory,
  })
  return result
})

ipcMain.handle('ccr:get-logs', async () => {
  return readDesktopLogs()
})

ipcMain.handle(
  'ccr:get-usage-statistics',
  async (_event, input?: ModelUsageStatsInput) => {
    return readModelUsageStats(input ?? {})
  },
)

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

ipcMain.handle(
  'ccr:prepare-attachments',
  async (_event, input: DesktopAttachmentPrepareInput) => {
    return prepareDesktopAttachments(input ?? {})
  },
)

ipcMain.handle(
  'ccr:image-preview',
  async (_event, input: DesktopImagePreviewInput) => {
    return createDesktopImagePreview(input ?? {})
  },
)

ipcMain.handle('ccr:window-state', async event => {
  return getDesktopWindowState(getIpcWindow(event))
})

ipcMain.handle('ccr:window-minimize', async event => {
  const window = getIpcWindow(event)
  window.minimize()
  return getDesktopWindowState(window)
})

ipcMain.handle('ccr:window-toggle-maximize', async event => {
  const window = getIpcWindow(event)
  if (window.isMaximized()) {
    window.unmaximize()
  } else {
    window.maximize()
  }
  return getDesktopWindowState(window)
})

ipcMain.handle('ccr:window-close', async event => {
  const window = getIpcWindow(event)
  window.close()
  return getDesktopWindowState(window)
})

ipcMain.handle('ccr:start-turn', async (_event, input: DesktopStartTurnInput) => {
  return startTurn(input)
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

ipcMain.handle('ccr:save-path-as', async (_event, path: string) => {
  return saveLocalPathAs(path)
})

ipcMain.handle('ccr:copy-text', async (_event, text: string) => {
  clipboard.writeText(String(text ?? ''))
  return { copied: true }
})

ipcMain.handle('ccr:read-clipboard-text', async () => {
  return clipboard.readText()
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
    const result = await managedClient.client.respondPermission(input)
    await refreshPendingPermissionsSnapshot().catch(() => undefined)
    await refreshThreadDisplaySnapshot().catch(() => undefined)
    broadcast('state', {
      message: 'permission responded',
      permissionRequestId: input.permissionRequestId,
      behavior: input.behavior,
      pendingPermissions: status.pendingPermissions,
    })
    return result
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
