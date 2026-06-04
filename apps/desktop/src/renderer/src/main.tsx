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
import {
  createPermissionCardFromPayload,
  createThreadDisplaySnapshotActions,
  routeDesktopEvent,
  shouldReplayThreadDisplaySnapshotFromStatusEvent,
} from './app/notificationRouter.js'
import { Sidebar } from './components/layout/Sidebar.js'
import { Topbar } from './components/layout/Topbar.js'
import { WindowTitlebar } from './components/layout/WindowTitlebar.js'
import { ConfirmDialog } from './components/common/ConfirmDialog.js'
import { ChatPage } from './components/pages/ChatPage.js'
import type {
  ComposerPrepareAttachmentInput,
  ComposerPreparedAttachment,
  ComposerSubmitInput,
} from './components/layout/Composer.js'
import { LogsPage } from './components/pages/LogsPage.js'
import { McpPage } from './components/pages/McpPage.js'
import { ModelsPage } from './components/pages/ModelsPage.js'
import { PluginsPage } from './components/pages/PluginsPage.js'
import { SettingsPage } from './components/pages/SettingsPage.js'
import { SkillsPage } from './components/pages/SkillsPage.js'
import {
  UsageStatisticsPage,
  type UsageStatisticsFilters,
} from './components/pages/UsageStatisticsPage.js'
import {
  createErrorDisplayEvent,
  createSystemNoticeEvent,
  createUserDisplayEvent,
  type DisplayEvent,
} from './domain/displayEvents.js'
import type {
  DesktopStatus,
  JsonObject,
  LlmModelAvailability,
  LlmModelCredentialUpdateResult,
  LlmModelListState,
  LlmModelProfileMutationResult,
  LlmModelProfileSaveInput,
  LogSnapshot,
  McpAdoptPlanState,
  McpInstallCandidate,
  McpInstallListState,
  McpInstallPlanState,
  McpInstallPlanViewState,
  McpInstallRecord,
  McpInstallSearchState,
  McpTestState,
  McpWritableScope,
  PageId,
  PendingPermissionRequest,
  PermissionCard,
  PermissionRespondPayload,
  PermissionSettingsState,
  PermissionSettingsUpdateInput,
  SkillImportPlanState,
  SkillImportPlanViewState,
  SkillInstalledInspection,
  SkillInstallCandidate,
  SkillInstallListState,
  SkillInstallPlanState,
  SkillInstallPlanViewState,
  SkillInstallSearchState,
  ThreadDisplaySnapshot,
  ThreadHistoryItem,
  ThreadHistoryState,
  TurnRuntimeMetadata,
  UsageStatisticsState,
} from './domain/displayTypes.js'
import type { UpdateActionKind } from './domain/updateDisplay.js'
import type {
  CcrDesktopEvent,
  DesktopConfirmRequest,
  DesktopConfirmTone,
} from './global.js'

type AppPageId = Exclude<PageId, 'settings'>
type ModelAvailabilityCache = Record<string, LlmModelAvailability>
type ConfirmDialogState = {
  title: string
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel?: string
  tone?: DesktopConfirmTone
  onConfirm: () => void
  onCancel?: () => void
}

const BOOT_MIN_VISIBLE_MS = 1400
const BOOT_INITIAL_STATUS_TIMEOUT_MS = 2800
const bootStartedAt = performance.now()

type AppProps = {
  initialStatus?: DesktopStatus | null
}

function getModelAvailabilityCacheKey(input: {
  provider?: string
  profileId?: string
}): string | null {
  const profileId = input.profileId?.trim()
  if (profileId) {
    return `profile:${profileId}`
  }
  const provider = input.provider?.trim()
  if (provider) {
    return `provider:${provider}`
  }
  return null
}

function App({ initialStatus = null }: AppProps) {
  const [status, setStatus] = useState<DesktopStatus | null>(initialStatus)
  const [events, setEvents] = useState<CcrDesktopEvent[]>([])
  const [session, dispatchSession] = useReducer(
    sessionReducer,
    initialSessionState,
  )
  const [workspaceInput, setWorkspaceInput] = useState(
    initialStatus?.workspacePath ?? initialStatus?.repoRoot ?? '',
  )
  const [prompt, setPrompt] = useState('')
  const [page, setPage] = useState<PageId>('chat')
  const [returnPage, setReturnPage] = useState<AppPageId>('chat')
  const [logSnapshot, setLogSnapshot] = useState<LogSnapshot | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStatisticsState | null>(null)
  const [usageStatsError, setUsageStatsError] = useState<string | null>(null)
  const [permissionSettings, setPermissionSettings] =
    useState<PermissionSettingsState | null>(
      initialStatus?.permissionSettings ?? null,
    )
  const [modelList, setModelList] = useState<LlmModelListState | null>(null)
  const [modelAvailabilityByKey, setModelAvailabilityByKey] =
    useState<ModelAvailabilityCache>({})
  const [modelTestResultByKey, setModelTestResultByKey] =
    useState<ModelAvailabilityCache>({})
  const [modelAuthLoginKey, setModelAuthLoginKey] = useState<string | null>(null)
  const [modelTestConnectionKeys, setModelTestConnectionKeys] = useState<
    Record<string, true>
  >({})
  const [modelPageError, setModelPageError] = useState<string | null>(null)
  const [mcpInstalls, setMcpInstalls] = useState<McpInstallListState | null>(
    null,
  )
  const [mcpInstallSearch, setMcpInstallSearch] =
    useState<McpInstallSearchState | null>(null)
  const [mcpInstallPlan, setMcpInstallPlan] =
    useState<McpInstallPlanViewState | null>(null)
  const [mcpTestByName, setMcpTestByName] = useState<
    Record<string, McpTestState>
  >({})
  const [mcpPageError, setMcpPageError] = useState<string | null>(null)
  const [mcpPageMessage, setMcpPageMessage] = useState<string | null>(null)
  const [skillInstalls, setSkillInstalls] =
    useState<SkillInstallListState | null>(null)
  const [skillInstallSearch, setSkillInstallSearch] =
    useState<SkillInstallSearchState | null>(null)
  const [skillInstallPlan, setSkillInstallPlan] =
    useState<SkillInstallPlanViewState | null>(null)
  const [skillImportPlan, setSkillImportPlan] =
    useState<SkillImportPlanViewState | null>(null)
  const [skillPageError, setSkillPageError] = useState<string | null>(null)
  const [skillPageMessage, setSkillPageMessage] = useState<string | null>(null)
  const [threadHistory, setThreadHistory] = useState<ThreadHistoryState>({
    status: 'closed',
    scope: 'allProjects',
    query: '',
    groups: [],
    threads: [],
  })
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const itemMetadataRef = useRef<Map<string, JsonObject>>(new Map())
  const modelAuthLoginRunRef = useRef(0)

  function applyDesktopStatusSnapshot(nextStatus: DesktopStatus): number {
    setStatus(nextStatus)
    setPermissionSettings(nextStatus.permissionSettings ?? null)
    setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')

    if (nextStatus.threadDisplaySnapshot) {
      const replayActions = createStatusReplayActions(nextStatus)
      itemMetadataRef.current.clear()
      dispatchSession({ type: 'reset-session' })
      replayActions.forEach(action => dispatchSession(action))
    }

    const pendingPermissions = createPendingPermissionCards(
      nextStatus.pendingPermissions ?? [],
    )
    dispatchSession({
      type: 'replace-pending-permissions',
      permissions: pendingPermissions,
    })
    dispatchSession({
      type: 'set-active-turn',
      turnId: getActiveTurnIdFromStatus(nextStatus),
    })
    return pendingPermissions.length
  }

  async function refreshDesktopStatusSnapshot(): Promise<number> {
    const nextStatus = (await window.ccr.getStatus()) as DesktopStatus
    return applyDesktopStatusSnapshot(nextStatus)
  }

  useEffect(() => {
    window.ccr.getStatus().then((nextStatus: DesktopStatus) => {
      applyDesktopStatusSnapshot(nextStatus)
      void refreshModelList().catch(() => undefined)
    })
    refreshLogs().catch(() => undefined)

    return window.ccr.onEvent(event => {
      setEvents(current => [event, ...current].slice(0, 80))
      const nextStatus = event.status as DesktopStatus
      if (shouldReplayThreadDisplaySnapshotFromStatusEvent(event, nextStatus)) {
        applyDesktopStatusSnapshot(nextStatus)
        return
      }
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

  useEffect(() => {
    return window.ccr.onConfirmRequest(request => {
      showConfirmDialog(createConfirmDialogFromRequest(request))
    })
  }, [])

  useEffect(() => {
    if (page !== 'mcp') {
      return
    }
    void refreshMcpManagement().catch(() => undefined)
  }, [page])

  useEffect(() => {
    if (page !== 'skills') {
      return
    }
    void refreshSkillManagement().catch(() => undefined)
  }, [page])

  useEffect(() => {
    if (page !== 'usage') {
      return
    }
    void refreshUsageStatistics().catch(() => undefined)
  }, [page])

  const model = status?.config?.llm?.model ?? '模型待加载'
  const provider = status?.config?.llm?.provider ?? 'provider 待加载'
  const modelCapabilities = status?.config?.llm?.modelCapabilities
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

  function showConfirmDialog(nextDialog: ConfirmDialogState): void {
    setConfirmDialog(current => {
      current?.onCancel?.()
      return nextDialog
    })
  }

  function handleConfirmDialogConfirm(): void {
    const dialog = confirmDialog
    if (!dialog) {
      return
    }
    setConfirmDialog(null)
    dialog.onConfirm()
  }

  function handleConfirmDialogCancel(): void {
    const dialog = confirmDialog
    if (!dialog) {
      return
    }
    setConfirmDialog(null)
    dialog.onCancel?.()
  }

  function createConfirmDialogFromRequest(
    request: DesktopConfirmRequest,
  ): ConfirmDialogState {
    return {
      title: request.title,
      message: request.message,
      detail: request.detail,
      confirmLabel: request.confirmLabel,
      cancelLabel: request.cancelLabel,
      tone: request.tone,
      onConfirm: () =>
        window.ccr.respondConfirmRequest({
          id: request.id,
          confirmed: true,
        }),
      onCancel: () =>
        window.ccr.respondConfirmRequest({
          id: request.id,
          confirmed: false,
        }),
    }
  }

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

  async function refreshModelList(providerId?: string): Promise<void> {
    const nextModelList = (await window.ccr.listModels(
      providerId ? { provider: providerId } : {},
    )) as LlmModelListState
    setModelList(nextModelList)
  }

  function rememberModelAvailability(
    availability: LlmModelAvailability,
    fallback?: { provider?: string; profileId?: string },
  ): void {
    const key = getModelAvailabilityCacheKey({
      provider: availability.provider ?? fallback?.provider,
      profileId: availability.profileId ?? fallback?.profileId,
    })
    if (!key) {
      return
    }
    setModelAvailabilityByKey(current => ({ ...current, [key]: availability }))
  }

  function rememberModelTestResult(
    availability: LlmModelAvailability,
    fallback?: { provider?: string; profileId?: string },
  ): void {
    const key = getModelAvailabilityCacheKey({
      provider: availability.provider ?? fallback?.provider,
      profileId: availability.profileId ?? fallback?.profileId,
    })
    if (!key) {
      return
    }
    setModelTestResultByKey(current => ({ ...current, [key]: availability }))
  }

  function clearModelTestResult(
    providerId?: string,
    profileId?: string,
  ): void {
    const key = getModelAvailabilityCacheKey({
      provider: providerId,
      profileId,
    })
    if (!key) {
      return
    }
    setModelTestResultByKey(current => {
      if (!current[key]) {
        return current
      }
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function clearModelProfileCaches(
    providerId?: string,
    profileId?: string,
  ): void {
    const key = getModelAvailabilityCacheKey({
      provider: providerId,
      profileId,
    })
    if (!key) {
      return
    }
    setModelAvailabilityByKey(current => {
      if (!current[key]) {
        return current
      }
      const next = { ...current }
      delete next[key]
      return next
    })
    setModelTestResultByKey(current => {
      if (!current[key]) {
        return current
      }
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function refreshModelAvailability(
    providerId?: string,
    modelId?: string,
    profileId?: string,
  ): Promise<void> {
    if (!providerId) {
      return
    }
    try {
      setModelPageError(null)
      const nextAvailability = (await window.ccr.getModelAvailability({
        ...(profileId ? { profileId } : {}),
        provider: providerId,
        ...(modelId ? { model: modelId } : {}),
      })) as LlmModelAvailability
      rememberModelAvailability(nextAvailability, {
        provider: providerId,
        profileId,
      })
    } catch (error) {
      setModelPageError(error instanceof Error ? error.message : String(error))
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

  async function prepareComposerAttachments(
    attachments: ComposerPrepareAttachmentInput[],
  ): Promise<ComposerPreparedAttachment[]> {
    const result = (await window.ccr.prepareAttachments({
      attachments,
    })) as { attachments?: ComposerPreparedAttachment[] }
    return result.attachments ?? []
  }

  async function sendPrompt(input?: ComposerSubmitInput): Promise<void> {
    const text = prompt.trim()
    const attachments = input?.attachments ?? []
    if (!text && attachments.length === 0) {
      return
    }

    appendDisplayEvent(
      createUserDisplayEvent(
        `${Date.now()}-user`,
        createOptimisticUserText(text, attachments),
        attachments,
      ),
    )
    dispatchSession({ type: 'set-active-turn', turnId: 'pending' })
    setPrompt('')

    if (attachments.length === 0 && isCompactCommand(text)) {
      dispatchSession({ type: 'set-active-turn', turnId: null })
      await runCompactFromDesktop(getCompactInstruction(text))
      return
    }

    await runAction(async () => {
      const result = (await window.ccr.startTurn({
        text,
        attachments,
      })) as {
        turn?: { turnId?: string }
      }
      if (result.turn?.turnId) {
        dispatchSession({
          type: 'set-active-turn',
          turnId: result.turn.turnId,
        })
      }
    }).catch(error => {
      void (async () => {
        if (isOperationInProgressError(error)) {
          const pendingCount = await refreshDesktopStatusSnapshot().catch(
            () => 0,
          )
          appendDisplayEvent(
            createSystemNoticeEvent(
              `${Date.now()}-operation-in-progress`,
              pendingCount > 0
                ? '当前有待确认操作，请先处理确认卡。'
                : '当前已有任务正在运行，请等待完成或先停止当前任务。',
            ),
          )
          return
        }
        dispatchSession({ type: 'set-active-turn', turnId: null })
        appendDisplayEvent(
          createErrorDisplayEvent(
            `${Date.now()}-send-error`,
            error instanceof Error ? error.message : String(error),
          ),
        )
      })()
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
      const result = await window.ccr.startThread('CCR 会话')
      const thread = result?.thread
      itemMetadataRef.current.clear()
      setPrompt('')
      setThreadHistory(createClosedThreadHistory(threadHistory))
      dispatchSession({
        type: 'reset-session',
        notice: thread?.threadId
          ? `已创建新会话：${thread.title ?? 'CCR 会话'}（${shortId(thread.threadId)}）。`
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
        includeCurrent: true,
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
        ...(selectedThread.transcriptPath
          ? { transcriptPath: selectedThread.transcriptPath }
          : {}),
        ...(selectedThread.projectPath
          ? { projectPath: selectedThread.projectPath }
          : {}),
      })
      const resumePayload = resumeResult as {
        thread?: { threadId?: string; title?: string }
        displaySnapshot?: ThreadDisplaySnapshot
      }
      const thread = resumePayload.thread
      const replayActions = createResumeReplayActions(resumePayload.displaySnapshot)
      const resumeNotice = formatHistoryResumeNotice({
        thread,
      })
      itemMetadataRef.current.clear()
      setPrompt('')
      setThreadHistory(createClosedThreadHistory(threadHistory))
      dispatchSession({
        type: 'reset-session',
        notice: resumeNotice,
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

  async function renameThreadFromHistory(
    selectedThread: ThreadHistoryItem,
    title: string,
  ): Promise<void> {
    const sessionId = getThreadSessionId(selectedThread)
    if (!sessionId) {
      throw new Error('该会话缺少 sessionId，当前版本无法重命名。')
    }
    const result = await window.ccr.renameSessionHistory({
      sessionId,
      title,
      ...(selectedThread.transcriptPath
        ? { transcriptPath: selectedThread.transcriptPath }
        : {}),
    })
    const nextTitle = result?.title ?? title
    setThreadHistory(current => renameThreadHistoryItem(current, sessionId, nextTitle))
    setStatus(current => {
      if (!current?.thread) {
        return current
      }
      const currentSessionId = getThreadSessionId(
        current.thread as ThreadHistoryItem,
      )
      if (currentSessionId !== sessionId) {
        return current
      }
      return {
        ...current,
        thread: {
          ...current.thread,
          title: nextTitle,
        },
      }
    })
  }

  async function copyHistorySessionId(thread: ThreadHistoryItem): Promise<void> {
    const sessionId = getThreadSessionId(thread)
    if (!sessionId) {
      throw new Error('该会话缺少 sessionId，无法复制。')
    }
    await window.ccr.copyText(sessionId)
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

  async function refreshMcpManagement(query = ''): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        const [, installs, search] = await Promise.all([
          window.ccr.refreshMcp(),
          window.ccr.listMcpInstalls(),
          window.ccr.searchMcpInstalls({ query }),
        ])
        setMcpInstalls(installs as McpInstallListState)
        setMcpInstallSearch(search as McpInstallSearchState)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function searchMcpInstallCandidates(query: string): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        const search = (await window.ccr.searchMcpInstalls({
          query,
        })) as McpInstallSearchState
        setMcpInstallSearch(search)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function planMcpInstallFromCandidate(
    candidate: McpInstallCandidate,
    scope: McpWritableScope,
  ): Promise<void> {
    const manifestInput = getMcpCandidateManifestInput(candidate)
    if (!manifestInput) {
      setMcpPageError('该 MCP 候选缺少完整安装清单，无法准备安装确认。')
      return
    }

    try {
      setMcpPageError(null)
      await runAction(async () => {
        const plan = (await window.ccr.planMcpInstall({
          scope,
          manifest: manifestInput,
        })) as McpInstallPlanState
        setMcpInstallPlan({ plan, manifestInput })
        setMcpPageMessage(
          plan.installable === false
            ? (plan.existing?.message ?? '该 MCP 已存在，无需重复安装。')
            : '请确认安装 MCP。',
        )
      })
    } catch (error) {
      setMcpInstallPlan(null)
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function importMcpInstallManifest(): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        const imported = await window.ccr.chooseMcpInstallManifest()
        if (imported.canceled) {
          return
        }
        const manifestInput = imported.manifest
        if (!manifestInput) {
          setMcpPageError('导入的 MCP manifest 缺少有效内容。')
          return
        }
        const plan = (await window.ccr.planMcpInstall({
          scope: 'user',
          manifest: manifestInput,
        })) as McpInstallPlanState
        setMcpInstallPlan({
          plan,
          manifestInput,
          manifestPath: imported.path,
          canSaveToCandidates: true,
          saveToCandidates: false,
        })
        const name = plan.name ?? imported.summary?.name ?? '未命名 MCP'
        setMcpPageMessage(
          plan.installable === false
            ? (plan.existing?.message ?? '该 MCP 已存在，无需重复安装。')
            : `已导入 ${name}，请确认安装计划。`,
        )
      })
    } catch (error) {
      setMcpInstallPlan(null)
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function planMcpInstallFromManifest(
    manifestInput: Record<string, unknown>,
  ): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        const plan = (await window.ccr.planMcpInstall({
          scope: 'user',
          manifest: manifestInput,
        })) as McpInstallPlanState
        setMcpInstallPlan({
          plan,
          manifestInput,
          canSaveToCandidates: true,
          saveToCandidates: false,
        })
        setMcpPageMessage(
          plan.installable === false
            ? (plan.existing?.message ?? '该 MCP 已存在，无需重复安装。')
            : `已生成 ${plan.name ?? '未命名 MCP'} 的安装计划，请确认。`,
        )
      })
    } catch (error) {
      setMcpInstallPlan(null)
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function applyMcpInstallPlan(
    planView: McpInstallPlanViewState,
  ): Promise<void> {
    if (planView.plan.installable === false || planView.plan.existing) {
      setMcpPageError(
        planView.plan.existing?.message ?? '该 MCP 已存在，无需重复安装。',
      )
      return
    }

    const token = planView.plan.confirmation?.token
    if (!token) {
      setMcpPageError('安装确认缺少 token。')
      return
    }

    try {
      setMcpPageError(null)
      await runAction(async () => {
        await window.ccr.applyMcpInstall({
          ...(planView.plan.name ? { name: planView.plan.name } : {}),
          scope: normalizeMcpScope(planView.plan.scope),
          manifest: planView.manifestInput,
          force: Boolean(planView.plan.force),
          confirmed: true,
          confirmationToken: token,
        })
        if (planView.saveToCandidates) {
          await window.ccr.saveMcpInstallManifest({
            manifest: planView.manifestInput,
            overwrite: true,
          })
        }
        const search =
          planView.saveToCandidates
            ? ((await window.ccr.searchMcpInstalls({})) as McpInstallSearchState)
            : null
        const installs =
          (await window.ccr.listMcpInstalls()) as McpInstallListState
        setMcpInstalls(installs)
        if (search) {
          setMcpInstallSearch(search)
        }
        setMcpInstallPlan(null)
        setMcpPageMessage(
          planView.saveToCandidates
            ? `已安装并保存到常用安装配置：${planView.plan.name ?? '未命名'}`
            : `已安装 MCP：${planView.plan.name ?? '未命名'}`,
        )
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function enableMcpServer(name: string): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        await window.ccr.enableMcp({ name })
        setMcpPageMessage(`已启用 MCP：${name}`)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function disableMcpServer(name: string): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        await window.ccr.disableMcp({ name })
        setMcpPageMessage(`已禁用 MCP：${name}`)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function restartMcpServer(name: string): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        await window.ccr.restartMcp({ name })
        setMcpPageMessage(`已提交 MCP 重启请求：${name}`)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function testMcpServer(name: string): Promise<void> {
    try {
      setMcpPageError(null)
      const result = (await window.ccr.testMcp({ name })) as McpTestState
      setMcpTestByName(current => ({ ...current, [name]: result }))
      setMcpPageMessage(`已检测 MCP：${name}`)
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function adoptMcpServer(name: string): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        const plan = (await window.ccr.planMcpAdopt({
          name,
        })) as McpAdoptPlanState
        if (plan.adoptable === false) {
          setMcpPageError(
            plan.existingInstalled
              ? '该 MCP 已经有 CCR 安装记录，无需接管。'
              : '该 MCP 当前不能接管。',
          )
          return
        }
        const token = plan.confirmation?.token
        if (!token) {
          setMcpPageError('接管确认缺少 token。')
          return
        }
        showConfirmDialog({
          title: '接管 MCP',
          message: `将现有手工配置接管为 CCR 安装记录：${plan.name ?? name}？`,
          detail: formatMcpAdoptPlanDetail(plan),
          confirmLabel: '接管',
          tone: 'warning',
          onConfirm: () => {
            void performMcpAdopt(plan, token)
          },
        })
        setMcpPageMessage('请确认 MCP 接管计划。')
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function performMcpAdopt(
    plan: McpAdoptPlanState,
    confirmationToken: string,
  ): Promise<void> {
    const name = plan.name
    if (!name) {
      setMcpPageError('接管计划缺少名称。')
      return
    }
    try {
      setMcpPageError(null)
      await runAction(async () => {
        await window.ccr.applyMcpAdopt({
          name,
          confirmed: true,
          confirmationToken,
        })
        const [, installs] = await Promise.all([
          window.ccr.refreshMcp(),
          window.ccr.listMcpInstalls(),
        ])
        setMcpInstalls(installs as McpInstallListState)
        setMcpPageMessage(`已接管 MCP：${name}`)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  function uninstallMcpServer(name: string): void {
    showConfirmDialog({
      title: '卸载 MCP',
      message: `卸载 CCR 安装的 MCP：${name}？`,
      detail:
        '会移除 CCR 管理的安装记录和配置；手动配置或非 CCR 归属目录不会被这里删除。',
      confirmLabel: '卸载',
      tone: 'danger',
      onConfirm: () => {
        void performMcpUninstall(name)
      },
    })
  }

  async function performMcpUninstall(name: string): Promise<void> {
    try {
      setMcpPageError(null)
      await runAction(async () => {
        await window.ccr.uninstallMcp({ name, confirmed: true })
        const installs =
          (await window.ccr.listMcpInstalls()) as McpInstallListState
        setMcpInstalls(installs)
        setMcpPageMessage(`已卸载 MCP：${name}`)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  function repairMcpServer(record: McpInstallRecord): void {
    const name = record.name
    if (!name) {
      setMcpPageError('安装记录缺少名称，无法修复。')
      return
    }
    showConfirmDialog({
      title: '修复 MCP',
      message: `修复 CCR 安装的 MCP：${name}？`,
      detail:
        '确认后会按内置 preset 重新写入 MCP 配置。不会修改其他未关联的 MCP 配置。',
      confirmLabel: '修复',
      tone: 'warning',
      onConfirm: () => {
        void performMcpRepair(record)
      },
    })
  }

  async function performMcpRepair(record: McpInstallRecord): Promise<void> {
    if (!record.name) {
      return
    }
    try {
      setMcpPageError(null)
      await runAction(async () => {
        await window.ccr.repairMcp({
          name: record.name!,
          scope: normalizeMcpScope(record.scope),
          confirmed: true,
        })
        const installs =
          (await window.ccr.listMcpInstalls()) as McpInstallListState
        setMcpInstalls(installs)
        setMcpPageMessage(`已修复 MCP：${record.name}`)
      })
    } catch (error) {
      setMcpPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function refreshSkillManagement(query = ''): Promise<void> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        const [installs, search] = await Promise.all([
          window.ccr.listSkillInstalls(),
          window.ccr.searchSkillInstalls({ query }),
        ])
        setSkillInstalls(installs as SkillInstallListState)
        setSkillInstallSearch(search as SkillInstallSearchState)
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function searchSkillInstallCandidates(query: string): Promise<void> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        const search = (await window.ccr.searchSkillInstalls({
          query,
        })) as SkillInstallSearchState
        setSkillInstallSearch(search)
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function planSkillInstallFromCandidate(
    candidate: SkillInstallCandidate,
  ): Promise<void> {
    const manifestInput = candidate.manifestInput
    if (!manifestInput) {
      setSkillPageError('该 Skill 候选缺少完整安装清单，无法准备安装确认。')
      return
    }
    await planSkillInstallFromManifest(manifestInput, {
      canSaveToCandidates: false,
    })
  }

  async function planSkillInstallFromManifest(
    manifestInput: Record<string, unknown>,
    options: { canSaveToCandidates?: boolean } = { canSaveToCandidates: true },
  ): Promise<boolean> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        const plan = (await window.ccr.planSkillInstall({
          scope: 'user',
          manifest: manifestInput,
        })) as SkillInstallPlanState
        setSkillInstallPlan({
          plan,
          manifestInput,
          canSaveToCandidates: options.canSaveToCandidates,
          saveToCandidates: false,
        })
        setSkillPageMessage(
          plan.installable === false
            ? getSkillInstallPlanBlockedMessage(plan)
            : `已生成 ${plan.name ?? '未命名 Skill'} 的安装计划，请确认。`,
        )
      })
      return true
    } catch (error) {
      setSkillInstallPlan(null)
      setSkillPageError(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  async function applySkillInstallPlan(
    planView: SkillInstallPlanViewState,
  ): Promise<void> {
    if (planView.plan.installable === false) {
      setSkillPageError(getSkillInstallPlanBlockedMessage(planView.plan))
      return
    }
    const token = planView.plan.confirmation?.token
    if (!token) {
      setSkillPageError('安装确认缺少 token。')
      return
    }
    const securityOverrideToken =
      planView.securityOverrideAccepted
        ? planView.plan.securityDecision?.overrideToken
        : undefined

    try {
      setSkillPageError(null)
      await runAction(async () => {
        await window.ccr.applySkillInstall({
          scope: normalizeSkillScope(planView.plan.scope),
          manifest: planView.manifestInput,
          force: Boolean(planView.plan.force),
          confirmed: true,
          confirmationToken: token,
          ...(securityOverrideToken ? { securityOverrideToken } : {}),
        })
        if (planView.saveToCandidates) {
          await window.ccr.saveSkillInstallManifest({
            manifest: planView.manifestInput,
            overwrite: true,
          })
        }
        const [installs, search] = await Promise.all([
          window.ccr.listSkillInstalls(),
          window.ccr.searchSkillInstalls({}),
        ])
        setSkillInstalls(installs as SkillInstallListState)
        setSkillInstallSearch(search as SkillInstallSearchState)
        setSkillInstallPlan(null)
        setSkillPageMessage(
          planView.saveToCandidates
            ? `已安装并保存到常用安装配置：${planView.plan.name ?? '未命名'}`
            : `已安装 Skill：${planView.plan.name ?? '未命名'}`,
        )
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function planSkillImport(source: Record<string, unknown>): Promise<void> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        const plan = (await window.ccr.planSkillImport({
          source,
        })) as SkillImportPlanState
        setSkillImportPlan({ plan, source })
        setSkillPageMessage(
          plan.importable === false
            ? getSkillImportPlanBlockedMessage(plan)
            : `已生成 ${plan.name ?? '未命名 Skill'} 的导入计划，请确认。`,
        )
      })
    } catch (error) {
      setSkillImportPlan(null)
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function applySkillImportPlan(
    planView: SkillImportPlanViewState,
  ): Promise<void> {
    if (planView.plan.importable === false) {
      setSkillPageError(getSkillImportPlanBlockedMessage(planView.plan))
      return
    }
    const token = planView.plan.confirmation?.token
    if (!token) {
      setSkillPageError('导入确认缺少 token。')
      return
    }
    try {
      setSkillPageError(null)
      await runAction(async () => {
        await window.ccr.applySkillImport({
          source: planView.source,
          confirmed: true,
          confirmationToken: token,
        })
        const [installs, search] = await Promise.all([
          window.ccr.listSkillInstalls(),
          window.ccr.searchSkillInstalls({}),
        ])
        setSkillInstalls(installs as SkillInstallListState)
        setSkillInstallSearch(search as SkillInstallSearchState)
        setSkillImportPlan(null)
        setSkillPageMessage(`已导入 Skill：${planView.plan.name ?? '未命名'}`)
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function setSkillEnabled(
    skillRef: string,
    enabled: boolean,
  ): Promise<void> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        await window.ccr.setSkillEnabled({ skillRef, enabled })
        const installs =
          (await window.ccr.listSkillInstalls()) as SkillInstallListState
        setSkillInstalls(installs)
        setSkillPageMessage(`${enabled ? '已启用' : '已禁用'} Skill：${skillRef}`)
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function setSkillInvocation(
    skillRef: string,
    patch: { modelInvocable?: boolean; userInvocable?: boolean },
  ): Promise<void> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        await window.ccr.setSkillInvocation({ skillRef, ...patch })
        const installs =
          (await window.ccr.listSkillInstalls()) as SkillInstallListState
        setSkillInstalls(installs)
        setSkillPageMessage(`已更新 Skill 调用开关：${skillRef}`)
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  function uninstallSkill(skill: SkillInstalledInspection): void {
    const skillRef = getInstalledSkillRef(skill)
    showConfirmDialog({
      title: '卸载 Skill',
      message: `卸载应用管理的 Skill：${getInstalledSkillTitle(skill)}？`,
      detail:
        '会移除受管理 package、installed record 和 lock record；不会删除 imported 或 manifest 候选。',
      confirmLabel: '卸载',
      tone: 'danger',
      onConfirm: () => {
        void performSkillUninstall(skillRef)
      },
    })
  }

  async function performSkillUninstall(skillRef: string): Promise<void> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        await window.ccr.uninstallSkill({ skillRef, confirmed: true })
        const [installs, search] = await Promise.all([
          window.ccr.listSkillInstalls(),
          window.ccr.searchSkillInstalls({}),
        ])
        setSkillInstalls(installs as SkillInstallListState)
        setSkillInstallSearch(search as SkillInstallSearchState)
        setSkillPageMessage(`已卸载 Skill：${skillRef}`)
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
  }

  function repairSkill(skill: SkillInstalledInspection): void {
    const skillRef = getInstalledSkillRef(skill)
    showConfirmDialog({
      title: '修复 Skill',
      message: `修复应用管理的 Skill：${getInstalledSkillTitle(skill)}？`,
      detail:
        '确认后会从安装记录的来源重新复制 package，并刷新 installed record 与 lock record。',
      confirmLabel: '修复',
      tone: 'warning',
      onConfirm: () => {
        void performSkillRepair(skillRef)
      },
    })
  }

  async function performSkillRepair(skillRef: string): Promise<void> {
    try {
      setSkillPageError(null)
      await runAction(async () => {
        await window.ccr.repairSkill({ skillRef, confirmed: true })
        const installs =
          (await window.ccr.listSkillInstalls()) as SkillInstallListState
        setSkillInstalls(installs)
        setSkillPageMessage(`已修复 Skill：${skillRef}`)
      })
    } catch (error) {
      setSkillPageError(error instanceof Error ? error.message : String(error))
    }
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

  async function switchModel(
    providerId: string,
    modelId: string,
    profileId?: string,
  ): Promise<void> {
    try {
      await runAction(async () => {
        await window.ccr.setModel({
          ...(profileId ? { profileId } : {}),
          provider: providerId,
          model: modelId,
        })
        await refreshModelList()
        await refreshModelAvailability(providerId, modelId, profileId)
      })
    } catch (error) {
      appendDisplayEvent(
        createErrorDisplayEvent(
          `${Date.now()}-model-switch-error`,
          error instanceof Error ? error.message : String(error),
        ),
      )
    }
  }

  async function testModelConnection(
    providerId: string,
    modelId?: string,
    profileId?: string,
  ): Promise<void> {
    const testKey = getModelAvailabilityCacheKey({
      provider: providerId,
      profileId,
    })
    if (testKey) {
      setModelTestConnectionKeys(current => ({ ...current, [testKey]: true }))
    }
    try {
      setModelPageError(null)
      const result = (await window.ccr.testModelConnection({
        ...(profileId ? { profileId } : {}),
        provider: providerId,
        ...(modelId ? { model: modelId } : {}),
      })) as LlmModelAvailability
      rememberModelTestResult(result, { provider: providerId, profileId })
      rememberModelAvailability(result, { provider: providerId, profileId })
    } catch (error) {
      setModelPageError(error instanceof Error ? error.message : String(error))
    } finally {
      if (testKey) {
        setModelTestConnectionKeys(current => {
          if (!current[testKey]) {
            return current
          }
          const next = { ...current }
          delete next[testKey]
          return next
        })
      }
    }
  }

  async function saveModelApiKey(
    providerId: string,
    apiKey: string | null,
    modelId?: string,
    profileId?: string,
  ): Promise<void> {
    try {
      setModelPageError(null)
      await runAction(async () => {
        const result = (await window.ccr.updateModelCredential({
          ...(profileId ? { profileId } : {}),
          provider: providerId,
          ...(modelId ? { model: modelId } : {}),
          apiKey,
        })) as LlmModelCredentialUpdateResult
        clearModelTestResult(providerId, profileId)
        if (result.availability) {
          rememberModelAvailability(result.availability, {
            provider: providerId,
            profileId,
          })
        } else {
          await refreshModelAvailability(providerId, modelId, profileId)
        }
        await refreshModelList()
      })
    } catch (error) {
      setModelPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function saveModelProfile(input: LlmModelProfileSaveInput): Promise<void> {
    try {
      setModelPageError(null)
      await runAction(async () => {
        const result = (await window.ccr.saveModelProfile(
          input,
        )) as LlmModelProfileMutationResult
        clearModelTestResult(input.providerType, result.profile?.id ?? input.profileId)
        await refreshModelList()
        const nextProfileId = result.profile?.id ?? input.profileId
        await refreshModelAvailability(
          input.providerType,
          input.defaultModel,
          nextProfileId,
        )
      })
    } catch (error) {
      setModelPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function copyModelProfile(profileId: string): Promise<void> {
    try {
      setModelPageError(null)
      await runAction(async () => {
        const result = (await window.ccr.copyModelProfile({
          profileId,
        })) as LlmModelProfileMutationResult
        clearModelTestResult(result.profile?.providerType, result.profile?.id)
        await refreshModelList()
        await refreshModelAvailability(
          result.profile?.providerType,
          result.profile?.defaultModel,
          result.profile?.id,
        )
      })
    } catch (error) {
      setModelPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function deleteModelProfile(profileId: string): Promise<void> {
    try {
      setModelPageError(null)
      await runAction(async () => {
        await window.ccr.deleteModelProfile({ profileId })
        clearModelProfileCaches(undefined, profileId)
        await refreshModelList()
      })
    } catch (error) {
      setModelPageError(error instanceof Error ? error.message : String(error))
    }
  }

  async function loginModelAuth(
    providerId: string,
    modelId?: string,
    profileId?: string,
  ): Promise<void> {
    const loginKey = getModelAvailabilityCacheKey({
      provider: providerId,
      profileId,
    })
    const runId = modelAuthLoginRunRef.current + 1
    modelAuthLoginRunRef.current = runId
    setModelAuthLoginKey(loginKey)
    try {
      setModelPageError(null)
      await window.ccr.loginAuth({
        ...(profileId ? { profileId } : {}),
        provider: providerId,
      })
      if (modelAuthLoginRunRef.current !== runId) {
        return
      }
      clearModelTestResult(providerId, profileId)
      await refreshModelList()
      await refreshModelAvailability(providerId, modelId, profileId)
      const nextStatus = (await window.ccr.getStatus()) as DesktopStatus
      setStatus(nextStatus)
      setPermissionSettings(nextStatus.permissionSettings ?? null)
      setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')
    } catch (error) {
      if (modelAuthLoginRunRef.current !== runId) {
        return
      }
      setModelPageError(error instanceof Error ? error.message : String(error))
    } finally {
      if (modelAuthLoginRunRef.current === runId) {
        setModelAuthLoginKey(null)
      }
    }
  }

  function cancelModelAuthLogin(): void {
    modelAuthLoginRunRef.current += 1
    setModelAuthLoginKey(null)
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

  function openLogsFromErrorCard(): void {
    void refreshLogs().catch(() => undefined)
    navigatePage('logs')
  }

  function openModelsFromErrorCard(): void {
    void refreshModelList().catch(() => undefined)
    navigatePage('models')
  }

  async function refreshUsageStatistics(
    filters?: UsageStatisticsFilters,
  ): Promise<void> {
    try {
      setUsageStatsError(null)
      const nextStats = (await window.ccr.getUsageStatistics({
        ...(filters ?? {}),
        limit: 500,
      })) as UsageStatisticsState
      setUsageStats(nextStats)
    } catch (error) {
      setUsageStatsError(error instanceof Error ? error.message : String(error))
    }
  }

  function navigatePage(nextPage: PageId): void {
    if (nextPage === 'settings') {
      if (page !== 'settings') {
        clearTransientPageMessage(page)
        setReturnPage(page as AppPageId)
      }
      setPage('settings')
      return
    }
    if (nextPage !== page) {
      clearTransientPageMessage(page)
    }
    setReturnPage(nextPage)
    setPage(nextPage)
  }

  function closeSettings(): void {
    setPage(returnPage)
  }

  function clearTransientPageMessage(currentPage: PageId): void {
    if (currentPage === 'mcp') {
      setMcpPageMessage(null)
      return
    }
    if (currentPage === 'skills') {
      setSkillPageMessage(null)
    }
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
              modelList={modelList}
              provider={provider}
              turnMetadata={turnMetadata}
              updateStatus={updateStatus}
              workspacePath={workspacePath}
              onChooseWorkspace={() =>
                void runAction(() => window.ccr.chooseWorkspace())
              }
              onSelectModel={(providerId, modelId, profileId) =>
                void switchModel(providerId, modelId, profileId)
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
                model={model}
                modelCapabilities={modelCapabilities}
                permissions={session.permissions}
                prompt={prompt}
                provider={provider}
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
                onOpenLogs={openLogsFromErrorCard}
                onOpenModels={openModelsFromErrorCard}
                onPrepareAttachments={prepareComposerAttachments}
                onRespondPermission={respondPermission}
                onCopyHistorySessionId={copyHistorySessionId}
                onRenameHistoryThread={renameThreadFromHistory}
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
                error={mcpPageError}
                installPlan={mcpInstallPlan}
                installSearch={mcpInstallSearch}
                installs={mcpInstalls}
                message={mcpPageMessage}
                mcp={status?.mcp ?? { servers: [], errors: [] }}
                testByName={mcpTestByName}
                onApplyInstall={planView => void applyMcpInstallPlan(planView)}
                onCancelInstall={() => setMcpInstallPlan(null)}
                onChangeInstallPlan={setMcpInstallPlan}
                onDisable={name => void disableMcpServer(name)}
                onEnable={name => void enableMcpServer(name)}
                onPlanInstall={(candidate, scope) =>
                  void planMcpInstallFromCandidate(candidate, scope)
                }
                onImportManifest={() => void importMcpInstallManifest()}
                onCreateManifest={manifest =>
                  void planMcpInstallFromManifest(manifest)
                }
                onAdopt={name => void adoptMcpServer(name)}
                onRefresh={() => void refreshMcpManagement()}
                onRepair={record => void repairMcpServer(record)}
                onRestart={name => void restartMcpServer(name)}
                onSearchInstalls={query =>
                  void searchMcpInstallCandidates(query)
                }
                onTest={name => void testMcpServer(name)}
                onUninstall={name => void uninstallMcpServer(name)}
              />
            ) : null}

            {page === 'models' ? (
              <ModelsPage
                availabilityByKey={modelAvailabilityByKey}
                authLoginKey={modelAuthLoginKey}
                busy={busy}
                error={modelPageError}
                modelList={modelList}
                status={status}
                testConnectionKeys={modelTestConnectionKeys}
                testResultByKey={modelTestResultByKey}
                onClearApiKey={(providerId, modelId, profileId) =>
                  void saveModelApiKey(providerId, null, modelId, profileId)
                }
                onRefreshAvailability={(providerId, modelId, profileId) =>
                  void refreshModelAvailability(providerId, modelId, profileId)
                }
                onRefreshModels={() =>
                  void runAction(async () => {
                    await refreshModelList()
                    const currentProvider = status?.config?.llm?.provider
                    if (currentProvider) {
                      await refreshModelAvailability(
                        currentProvider,
                        status?.config?.llm?.model,
                        status?.config?.llm?.profileId,
                      )
                    }
                  })
                }
                onLoginAuth={(providerId, modelId, profileId) =>
                  void loginModelAuth(providerId, modelId, profileId)
                }
                onCancelLogin={cancelModelAuthLogin}
                onCopyProfile={profileId => void copyModelProfile(profileId)}
                onDeleteProfile={profileId => void deleteModelProfile(profileId)}
                onSaveProfile={input => void saveModelProfile(input)}
                onSaveApiKey={(providerId, apiKey, modelId, profileId) =>
                  void saveModelApiKey(providerId, apiKey, modelId, profileId)
                }
                onSelectModel={(providerId, modelId, profileId) =>
                  void switchModel(providerId, modelId, profileId)
                }
                onTestConnection={(providerId, modelId, profileId) =>
                  void testModelConnection(providerId, modelId, profileId)
                }
              />
            ) : null}

            {page === 'usage' ? (
              <UsageStatisticsPage
                busy={busy}
                error={usageStatsError}
                stats={usageStats}
                onRefresh={refreshUsageStatistics}
              />
            ) : null}

            {page === 'skills' ? (
              <SkillsPage
                busy={busy}
                error={skillPageError}
                importPlan={skillImportPlan}
                installPlan={skillInstallPlan}
                installSearch={skillInstallSearch}
                installs={skillInstalls}
                message={skillPageMessage}
                onApplyImport={planView => void applySkillImportPlan(planView)}
                onApplyInstall={planView => void applySkillInstallPlan(planView)}
                onCancelImport={() => setSkillImportPlan(null)}
                onCancelInstall={() => setSkillInstallPlan(null)}
                onChangeInstallPlan={setSkillInstallPlan}
                onChoosePath={input => window.ccr.choosePath(input)}
                onPlanImport={source => void planSkillImport(source)}
                onPlanInstall={candidate =>
                  void planSkillInstallFromCandidate(candidate)
                }
                onRefresh={() => void refreshSkillManagement()}
                onRepair={skill => void repairSkill(skill)}
                onSearchInstalls={query =>
                  void searchSkillInstallCandidates(query)
                }
                onSetEnabled={(skillRef, enabled) =>
                  void setSkillEnabled(skillRef, enabled)
                }
                onSetInvocation={(skillRef, patch) =>
                  void setSkillInvocation(skillRef, patch)
                }
                onUninstall={skill => void uninstallSkill(skill)}
              />
            ) : null}

            {page === 'plugins' ? <PluginsPage /> : null}

            {page === 'logs' ? (
              <LogsPage
                busy={busy}
                events={events}
                logSnapshot={logSnapshot}
                onRefresh={() => runAction(() => refreshLogs())}
              />
            ) : null}
          </section>
        </main>
      )}
      {confirmDialog ? (
        <ConfirmDialog
          cancelLabel={confirmDialog.cancelLabel}
          confirmLabel={confirmDialog.confirmLabel}
          detail={confirmDialog.detail}
          message={confirmDialog.message}
          onCancel={handleConfirmDialogCancel}
          onConfirm={handleConfirmDialogConfirm}
          open
          title={confirmDialog.title}
          tone={confirmDialog.tone}
        />
      ) : null}
    </div>
  )
}

function getMcpCandidateManifestInput(
  candidate: McpInstallCandidate,
): Record<string, unknown> | null {
  if (candidate.manifestInput && typeof candidate.manifestInput === 'object') {
    return candidate.manifestInput
  }
  if (candidate.manifest && typeof candidate.manifest === 'object') {
    return candidate.manifest as Record<string, unknown>
  }
  return null
}

function normalizeMcpScope(value: unknown): McpWritableScope {
  return value === 'project' || value === 'local' ? value : 'user'
}

function normalizeSkillScope(value: unknown): 'user' | 'project' {
  return value === 'project' ? 'project' : 'user'
}

function getSkillInstallPlanBlockedMessage(plan: SkillInstallPlanState): string {
  return (
    plan.conflicts?.map(conflict => conflict.message).filter(Boolean).join('；') ||
    plan.securityDecision?.reasons?.join('；') ||
    '该 Skill 当前不可安装。'
  )
}

function getSkillImportPlanBlockedMessage(plan: SkillImportPlanState): string {
  return (
    plan.conflicts?.map(conflict => conflict.message).filter(Boolean).join('；') ||
    '该 Skill 当前不可导入。'
  )
}

function getInstalledSkillRef(skill: SkillInstalledInspection): string {
  return skill.lockKey ?? skill.installedRecord?.lockKey ?? skill.name ?? ''
}

function getInstalledSkillTitle(skill: SkillInstalledInspection): string {
  return (
    skill.package?.displayName ??
    skill.installedRecord?.manifest?.displayName ??
    skill.name ??
    '未命名 Skill'
  )
}

function formatMcpAdoptPlanDetail(plan: McpAdoptPlanState): string {
  const writes = (plan.writes ?? [])
    .map(write => `${write.kind ?? 'record'}: ${write.path ?? 'unknown'}`)
    .join('\n')
  const risks = (plan.risks ?? []).map(risk => `风险: ${risk}`).join('\n')
  const lines = [
    `范围：${normalizeMcpScope(plan.scope)}`,
    plan.manifest?.kind ? `来源类型：${plan.manifest.kind}` : null,
    writes || null,
    risks || null,
  ].filter((line): line is string => Boolean(line))
  return lines.join('\n')
}

function isCompactCommand(text: string): boolean {
  return text === '/compact' || text.startsWith('/compact ')
}

function createOptimisticUserText(
  text: string,
  attachments: ComposerSubmitInput['attachments'],
): string {
  if (text.trim()) {
    return text
  }
  return attachments.length > 0 ? '已添加附件。' : ''
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

function createStatusReplayActions(status: DesktopStatus): SessionAction[] {
  return status.threadDisplaySnapshot
    ? createThreadDisplaySnapshotActions(status.threadDisplaySnapshot)
    : []
}

function createResumeReplayActions(
  snapshot: ThreadDisplaySnapshot | null | undefined,
): SessionAction[] {
  if (!snapshot) {
    throw new Error('thread/resume 响应缺少必需的 displaySnapshot')
  }
  return createThreadDisplaySnapshotActions(snapshot)
}

function formatHistoryResumeNotice(input: {
  thread?: { threadId?: string; title?: string }
}): string {
  const prefix = input.thread?.threadId
    ? `已恢复历史会话：${input.thread.title ?? '历史会话'}（${shortId(input.thread.threadId)}）`
    : '已恢复历史会话'
  return `${prefix}。历史上下文已加载，可继续对话。`
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

function renameThreadHistoryItem(
  current: ThreadHistoryState,
  sessionId: string,
  title: string,
): ThreadHistoryState {
  const renameThread = (thread: ThreadHistoryItem): ThreadHistoryItem => {
    return getThreadSessionId(thread) === sessionId
      ? { ...thread, title, titleSource: 'customTitle' }
      : thread
  }
  return {
    ...current,
    threads: current.threads.map(renameThread),
    groups: current.groups.map(group => ({
      ...group,
      sessions: group.sessions.map(renameThread),
    })),
  }
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

function createPendingPermissionCards(
  permissions: PendingPermissionRequest[],
): PermissionCard[] {
  return permissions
    .map(permission =>
      createPermissionCardFromPayload(
        compactJsonObject({ ...permission }) as JsonObject,
      ),
    )
    .filter(
      (permission): permission is PermissionCard => permission !== null,
    )
}

function getActiveTurnIdFromStatus(status: DesktopStatus): string | null {
  const thread = status.thread as
    | (NonNullable<DesktopStatus['thread']> & { activeTurnId?: unknown })
    | null
  const threadActiveTurnId = getStringFromUnknown(thread?.activeTurnId)
  if (threadActiveTurnId) {
    return threadActiveTurnId
  }

  const lastTurnId = getStringFromUnknown(status.lastTurn?.turnId)
  if (lastTurnId && isActiveTurnStatus(status.lastTurn?.status)) {
    return lastTurnId
  }

  return status.pendingPermissions?.[0]?.turnId ?? null
}

function isActiveTurnStatus(status: unknown): boolean {
  return (
    status === 'pending' ||
    status === 'preparing' ||
    status === 'running' ||
    status === 'streaming' ||
    status === 'waiting_permission'
  )
}

function isOperationInProgressError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('operation_in_progress') ||
    message.includes('Operation is already in progress')
  )
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

async function getInitialStatusBeforeRender(): Promise<DesktopStatus | null> {
  try {
    const statusPromise = window.ccr.getStatus() as Promise<DesktopStatus>
    return await Promise.race([
      statusPromise,
      wait(BOOT_INITIAL_STATUS_TIMEOUT_MS).then(() => null),
    ])
  } catch {
    return null
  }
}

async function startRenderer(): Promise<void> {
  const elapsed = performance.now() - bootStartedAt
  const minVisibleDelay = wait(Math.max(0, BOOT_MIN_VISIBLE_MS - elapsed))
  const [initialStatus] = await Promise.all([
    getInitialStatusBeforeRender(),
    minVisibleDelay,
  ])

  createRoot(document.getElementById('root')!).render(
    <App initialStatus={initialStatus} />,
  )
}

void startRenderer()
