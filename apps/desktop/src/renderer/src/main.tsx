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
import type {
  ComposerPrepareAttachmentInput,
  ComposerPreparedAttachment,
  ComposerSubmitInput,
} from './components/layout/Composer.js'
import { LogsPage } from './components/pages/LogsPage.js'
import { McpPage } from './components/pages/McpPage.js'
import { ModelsPage } from './components/pages/ModelsPage.js'
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
  LlmModelAvailability,
  LlmModelCredentialUpdateResult,
  LlmModelListState,
  LlmModelProfileMutationResult,
  LlmModelProfileSaveInput,
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
type ModelAvailabilityCache = Record<string, LlmModelAvailability>

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
  const [threadHistory, setThreadHistory] = useState<ThreadHistoryState>({
    status: 'closed',
    scope: 'allProjects',
    query: '',
    groups: [],
    threads: [],
  })
  const [busy, setBusy] = useState(false)
  const itemMetadataRef = useRef<Map<string, JsonObject>>(new Map())
  const modelAuthLoginRunRef = useRef(0)

  useEffect(() => {
    window.ccr.getStatus().then((nextStatus: DesktopStatus) => {
      setStatus(nextStatus)
      setPermissionSettings(nextStatus.permissionSettings ?? null)
      setWorkspaceInput(nextStatus.workspacePath ?? nextStatus.repoRoot ?? '')
      void refreshModelList().catch(() => undefined)
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
                modelCapabilities={modelCapabilities}
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
                onOpenLogs={openLogsFromErrorCard}
                onOpenModels={openModelsFromErrorCard}
                onPrepareAttachments={prepareComposerAttachments}
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
    </div>
  )
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
  if (
    content === undefined ||
    !shouldReplayHistoryContentAsCompletedItem(message, blocks)
  ) {
    return [{ type: 'append-message', message }]
  }

  const itemId = message.id
  const kind = getHistoryCompletedItemKind(
    message.kind,
    object.sourceType,
    message.role,
    blocks,
  )
  const statusText = message.status ?? 'completed'
  const context = createCompletedItemContractContext({
    itemId,
    params: compactJsonObject({
      source: 'history',
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
  const blocks = normalizeContentBlocks(object.content)
  const text =
    (typeof object.text === 'string' ? object.text.trim() : '') ||
    getTextFromHistoryContentBlocks(blocks)
  if (!text && blocks.length === 0) {
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

function shouldReplayHistoryContentAsCompletedItem(
  message: ChatMessage,
  blocks: JsonObject[],
): boolean {
  if (message.role === 'user') {
    return blocks.some(
      block =>
        isHistoryToolLifecycleBlock(block) || isHistoryAttachmentBlock(block),
    )
  }
  return blocks.some(
    block =>
      isHistoryToolLifecycleBlock(block) || isHistoryAttachmentBlock(block),
  )
}

function getTextFromHistoryContentBlocks(blocks: JsonObject[]): string {
  return blocks
    .map(getHistoryTextBlockValue)
    .filter(Boolean)
    .join('\n\n')
}

function getHistoryTextBlockValue(block: JsonObject): string {
  const type = typeof block.type === 'string' ? block.type : ''
  if (
    (type === 'text' || type === 'input_text' || type === 'output_text') &&
    typeof block.text === 'string'
  ) {
    return block.text.trim()
  }
  if (type === 'json' && typeof block.value === 'string') {
    return block.value.trim()
  }
  return ''
}

function getHistoryCompletedItemKind(
  kind: string | undefined,
  sourceType: unknown,
  role: ChatMessage['role'],
  blocks: JsonObject[],
): string | undefined {
  if (blocks.some(isHistoryToolLifecycleBlock)) {
    return typeof sourceType === 'string' ? sourceType : kind
  }
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

function isHistoryAttachmentBlock(block: JsonObject): boolean {
  const type = typeof block.type === 'string' ? block.type : ''
  if (
    type === 'image' ||
    type === 'file' ||
    type === 'audio' ||
    type === 'attachment'
  ) {
    return true
  }
  return (
    type === 'tool_result' &&
    Array.isArray(block.content) &&
    block.content.some(
      item =>
        !!item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        isHistoryAttachmentBlock(item as JsonObject),
    )
  )
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
