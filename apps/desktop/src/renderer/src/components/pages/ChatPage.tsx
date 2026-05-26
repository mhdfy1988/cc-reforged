import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatTimeline } from '../chat/ChatTimeline.js'
import { Composer } from '../layout/Composer.js'
import type {
  ComposerPrepareAttachmentInput,
  ComposerPreparedAttachment,
  ComposerSubmitInput,
} from '../layout/Composer.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  PermissionCard,
  PermissionRespondPayload,
  LlmModelCapabilities,
  RuntimeCompactStatus,
  RuntimeContextStatus,
  RuntimeMemoryStatus,
  ThreadHistoryItem,
  ThreadHistoryGroup,
  ThreadHistoryState,
  TurnRuntimeMetadata,
} from '../../domain/displayTypes.js'
import type { TodoOverlaySnapshot } from '../../domain/todoEvents.js'

type HeadActionIconName = 'details' | 'compact' | 'history' | 'newThread'

export function ChatPage(props: {
  activeTurnId: string | null
  busy: boolean
  canInterruptTurn: boolean
  compactStatus: RuntimeCompactStatus | null | undefined
  contextStatus: RuntimeContextStatus | null | undefined
  events: DisplayEvent[]
  memoryStatus: RuntimeMemoryStatus | null | undefined
  model: string | undefined
  modelCapabilities: LlmModelCapabilities | null | undefined
  permissions: PermissionCard[]
  prompt: string
  provider: string | undefined
  threadHistory: ThreadHistoryState
  threadTitle: string | undefined
  turnMetadata: TurnRuntimeMetadata | null
  todoOverlay: TodoOverlaySnapshot | null
  onChangePrompt: (prompt: string) => void
  onCloseHistory: () => void
  onHistoryQueryChange: (query: string) => void
  onHistoryReload: () => void
  onInterrupt: () => void
  onOpenLogs?: () => void
  onOpenModels?: () => void
  onPrepareAttachments: (
    attachments: ComposerPrepareAttachmentInput[],
  ) => Promise<ComposerPreparedAttachment[]>
  onRunCompact: () => void
  onCopyHistorySessionId: (thread: ThreadHistoryItem) => Promise<void> | void
  onRenameHistoryThread: (
    thread: ThreadHistoryItem,
    title: string,
  ) => Promise<void> | void
  onShowHistory: () => void
  onResumeHistoryThread: (thread: ThreadHistoryItem) => void
  onRespondPermission: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
  onSend: (input?: ComposerSubmitInput) => Promise<void> | void
  onStartThread: () => void
}) {
  const compactDisabledReason = getCompactDisabledReason({
    activeTurnId: props.activeTurnId,
    busy: props.busy,
    contextStatus: props.contextStatus,
    events: props.events,
  })

  return (
    <>
      <section className="workbench-main">
        <div className="workbench-top">
          <div className="workbench-head">
            <div className="session-meta">{props.threadTitle ?? '当前会话'}</div>
            <div className="head-actions">
              <TurnRuntimeDetails
                compactStatus={props.compactStatus}
                contextStatus={props.contextStatus}
                memoryStatus={props.memoryStatus}
                metadata={props.turnMetadata}
              />
              <button
                aria-label="压缩会话"
                className="head-btn head-icon-btn"
                disabled={Boolean(compactDisabledReason)}
                title={
                  compactDisabledReason ??
                  '复用 App Server compact/run 压缩当前会话。'
                }
                onClick={props.onRunCompact}
              >
                <HeadActionIcon name="compact" />
              </button>
              <button
                aria-label="历史会话"
                className="head-btn head-icon-btn"
                disabled={props.busy}
                title={
                  props.activeTurnId
                    ? '当前 turn 运行中，可查看历史会话，完成后才能切换。'
                    : '查看当前 App Server 已知会话，并选择一个会话恢复。'
                }
                onClick={props.onShowHistory}
              >
                <HeadActionIcon name="history" />
              </button>
              <button
                aria-label="新建会话"
                className="head-btn head-icon-btn"
                disabled={props.busy}
                title="新建一个空会话。"
                onClick={props.onStartThread}
              >
                <HeadActionIcon name="newThread" />
              </button>
            </div>
          </div>

        </div>

        <ChatTimeline
          activeTurnId={props.activeTurnId}
          canInterruptTurn={props.canInterruptTurn}
          events={props.events}
          avatarRuntime={{ model: props.model, provider: props.provider }}
          permissions={props.permissions}
          todoOverlay={props.todoOverlay}
          onOpenLogs={props.onOpenLogs}
          onOpenModels={props.onOpenModels}
          onRespondPermission={props.onRespondPermission}
        />
      </section>

      <ThreadHistoryModal
        busy={props.busy}
        history={props.threadHistory}
        activeTurnId={props.activeTurnId}
        onClose={props.onCloseHistory}
        onQueryChange={props.onHistoryQueryChange}
        onReload={props.onHistoryReload}
        onCopySessionId={props.onCopyHistorySessionId}
        onRenameThread={props.onRenameHistoryThread}
        onResumeThread={props.onResumeHistoryThread}
      />

      <Composer
        activeTurnId={props.activeTurnId}
        busy={props.busy}
        canInterruptTurn={props.canInterruptTurn}
        modelCapabilities={props.modelCapabilities}
        prompt={props.prompt}
        onChangePrompt={props.onChangePrompt}
        onInterrupt={props.onInterrupt}
        onPrepareAttachments={props.onPrepareAttachments}
        onSend={props.onSend}
      />
    </>
  )
}

function ThreadHistoryModal(props: {
  activeTurnId: string | null
  busy: boolean
  history: ThreadHistoryState
  onClose: () => void
  onCopySessionId: (thread: ThreadHistoryItem) => Promise<void> | void
  onQueryChange: (query: string) => void
  onReload: () => void
  onRenameThread: (
    thread: ThreadHistoryItem,
    title: string,
  ) => Promise<void> | void
  onResumeThread: (thread: ThreadHistoryItem) => void
}) {
  const history = props.history
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(
    null,
  )
  const [contextMenu, setContextMenu] = useState<ThreadHistoryContextMenu | null>(
    null,
  )
  const [renameTarget, setRenameTarget] = useState<ThreadHistoryItem | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameSaving, setRenameSaving] = useState(false)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const activeGroup = useMemo(
    () => selectActiveHistoryGroup(history.groups, selectedWorkspacePath),
    [history.groups, selectedWorkspacePath],
  )
  const sessionCount = history.groups.reduce(
    (total, group) => total + group.sessionCount,
    0,
  )
  useEffect(() => {
    if (renameTarget) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renameTarget])

  if (history.status === 'closed') {
    return null
  }

  const closeContextMenu = () => setContextMenu(null)
  const openRenameDialog = (thread: ThreadHistoryItem) => {
    setRenameTarget(thread)
    setRenameTitle(formatThreadHistoryTitle(thread))
    setRenameError(null)
    closeContextMenu()
  }
  const closeRenameDialog = () => {
    if (renameSaving) {
      return
    }
    setRenameTarget(null)
    setRenameTitle('')
    setRenameError(null)
  }
  const submitRename = () => {
    if (!renameTarget || renameSaving) {
      return
    }
    const title = normalizeRenameTitle(renameTitle)
    if (!title) {
      setRenameError('标题不能为空。')
      return
    }
    setRenameSaving(true)
    Promise.resolve(props.onRenameThread(renameTarget, title))
      .then(() => {
        setRenameTarget(null)
        setRenameTitle('')
        setRenameError(null)
      })
      .catch(error => {
        setRenameError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => setRenameSaving(false))
  }

  return (
    <div
      className="thread-history-backdrop"
      onClick={() => {
        closeContextMenu()
        props.onClose()
      }}
    >
      <section
        aria-modal="true"
        className={`thread-history-dialog is-${history.status}`}
        onClick={event => {
          event.stopPropagation()
          closeContextMenu()
        }}
        onContextMenu={event => {
          if (!contextMenu) {
            return
          }
          event.preventDefault()
        }}
        role="dialog"
      >
        <div className="thread-history-head">
          <span>
            <strong>历史会话</strong>
            <small>{sessionCount > 0 ? `所有项目 · ${sessionCount} 个会话` : '所有项目'}</small>
          </span>
          <button
            aria-label="关闭历史会话"
            className="thread-history-icon-btn"
            onClick={props.onClose}
            title="关闭"
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="thread-history-tools">
          <form
            className="thread-history-search"
            onSubmit={event => {
              event.preventDefault()
              props.onReload()
            }}
          >
            <input
              placeholder="搜索标题、问题、sessionId 或 workspace"
              value={history.query}
              onChange={event => props.onQueryChange(event.currentTarget.value)}
            />
            <button
              aria-label="搜索历史会话"
              className="thread-history-search-submit"
              disabled={history.status === 'loading'}
              title="搜索"
              type="submit"
            >
              <SearchIcon />
            </button>
          </form>
        </div>

        {history.status === 'loading' ? (
          <p>正在加载历史会话...</p>
        ) : null}

        {history.status === 'empty' ? (
          <p>所有项目里暂时没有匹配的历史会话。</p>
        ) : null}

        {history.status === 'error' ? (
          <p className="thread-history-error">{history.error ?? '历史会话加载失败。'}</p>
        ) : null}

        {history.status === 'ready' ? (
          <div className="thread-history-content">
            <aside className="thread-history-projects" aria-label="项目">
              {history.groups.map(group => (
                <button
                  className={
                    group.workspacePath === activeGroup?.workspacePath
                      ? 'is-active'
                      : ''
                  }
                  key={group.workspacePath}
                  onClick={() => setSelectedWorkspacePath(group.workspacePath)}
                  type="button"
                >
                  <span>
                    <strong>{group.workspaceName}</strong>
                    <small>{group.workspacePath}</small>
                  </span>
                  <em>{group.sessionCount}</em>
                </button>
              ))}
            </aside>

            <div className="thread-history-list">
              {activeGroup ? (
                <>
                  <div className="thread-history-group-items">
                    {activeGroup.sessions.map((thread, index) => {
                      const disabledReason = getThreadHistoryDisabledReason(
                        thread,
                        props,
                      )
                      return (
                        <button
                          aria-disabled={Boolean(disabledReason)}
                          className={disabledReason ? 'is-disabled' : undefined}
                          key={getThreadHistoryKey(thread, index)}
                          onClick={() => {
                            if (!disabledReason) {
                              props.onResumeThread(thread)
                            }
                          }}
                          onContextMenu={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            setContextMenu({
                              thread,
                              x: event.clientX,
                              y: event.clientY,
                            })
                          }}
                          title={disabledReason ?? '恢复这个历史会话'}
                          type="button"
                        >
                          <span>
                            <strong>{formatThreadHistoryTitle(thread)}</strong>
                            <small>
                              {[
                                shortThreadId(thread.sessionId ?? thread.threadId),
                                formatMessageCount(thread.messageCount),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
                          </span>
                          <em>
                            {[
                              formatThreadHistoryStatus(thread, props.activeTurnId),
                              formatHistoryTime(thread.updatedAt),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </em>
                        </button>
                      )
                    })}
                  </div>
                  {history.nextCursor ? (
                    <p className="thread-history-more">
                      还有更多历史，继续缩小搜索查看。
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {contextMenu ? (
        <div
          className="thread-history-context-menu"
          onClick={event => event.stopPropagation()}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button type="button" onClick={() => openRenameDialog(contextMenu.thread)}>
            重命名对话
          </button>
          <button
            type="button"
            onClick={() => {
              void Promise.resolve(props.onCopySessionId(contextMenu.thread))
              closeContextMenu()
            }}
          >
            复制会话 ID
          </button>
        </div>
      ) : null}

      {renameTarget ? (
        <div
          className="thread-title-dialog-backdrop"
          onClick={event => {
            event.stopPropagation()
            closeRenameDialog()
          }}
        >
          <form
            aria-modal="true"
            className="thread-title-dialog"
            onClick={event => event.stopPropagation()}
            onSubmit={event => {
              event.preventDefault()
              submitRename()
            }}
            role="dialog"
          >
            <div className="thread-title-dialog-head">
              <span>
                <strong>重命名对话</strong>
                <small>保持简短且易于识别</small>
              </span>
              <button
                aria-label="关闭"
                disabled={renameSaving}
                onClick={closeRenameDialog}
                title="关闭"
                type="button"
              >
                <CloseIcon />
              </button>
            </div>
            <input
              maxLength={80}
              ref={renameInputRef}
              value={renameTitle}
              onChange={event => {
                setRenameTitle(event.currentTarget.value)
                setRenameError(null)
              }}
            />
            {renameError ? (
              <p className="thread-title-dialog-error">{renameError}</p>
            ) : null}
            <div className="thread-title-dialog-actions">
              <button
                disabled={renameSaving}
                onClick={closeRenameDialog}
                type="button"
              >
                取消
              </button>
              <button disabled={renameSaving} type="submit">
                保存
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

type ThreadHistoryContextMenu = {
  thread: ThreadHistoryItem
  x: number
  y: number
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="thread-history-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="thread-history-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  )
}

function selectActiveHistoryGroup(
  groups: ThreadHistoryGroup[],
  selectedWorkspacePath: string | null,
): ThreadHistoryGroup | null {
  if (groups.length === 0) {
    return null
  }
  if (selectedWorkspacePath) {
    const selected = groups.find(
      group => group.workspacePath === selectedWorkspacePath,
    )
    if (selected) {
      return selected
    }
  }
  return groups[0] ?? null
}

function getCompactDisabledReason(input: {
  activeTurnId: string | null
  busy: boolean
  contextStatus: RuntimeContextStatus | null | undefined
  events: DisplayEvent[]
}): string | null {
  if (input.busy) {
    return '当前正在处理其他操作，完成后才能压缩。'
  }
  if (input.activeTurnId) {
    return '当前 turn 运行中，完成后才能压缩。'
  }

  const messageCount = input.contextStatus?.messageCount
  if (typeof messageCount === 'number') {
    return messageCount > 0 ? null : '当前会话暂无可压缩内容。'
  }

  const hasUserOrAssistantMessage = input.events.some(
    event => event.type === 'user_message' || event.type === 'assistant_message',
  )
  return hasUserOrAssistantMessage ? null : '当前会话暂无可压缩内容。'
}

function getThreadHistoryKey(
  thread: ThreadHistoryItem,
  index: number,
): string {
  return thread.threadId ?? `${thread.title ?? 'thread'}-${index}`
}

function getThreadHistoryDisabledReason(
  thread: ThreadHistoryItem,
  input: { activeTurnId: string | null; busy: boolean },
): string | null {
  if (input.busy) {
    return '当前正在处理其他操作，稍后才能恢复历史会话。'
  }
  if (thread.isCurrentSession) {
    return thread.activeTurnId || thread.status === 'running'
      ? '该会话正在运行中。'
      : '该会话已经是当前会话。'
  }
  if (input.activeTurnId) {
    return '当前 turn 运行中，完成后才能切换历史会话。'
  }
  return null
}

function formatThreadHistoryStatus(
  thread: ThreadHistoryItem,
  activeTurnId: string | null,
): string {
  if (thread.activeTurnId || thread.status === 'running') {
    return '运行中'
  }
  if (thread.isCurrentSession) {
    return '当前'
  }
  return activeTurnId ? '需等待' : '可恢复'
}

function formatMessageCount(value: unknown): string | null {
  return typeof value === 'number' && value > 0 ? `${value} 条消息` : null
}

function shortThreadId(value: unknown): string {
  return typeof value === 'string' && value.length > 10
    ? value.slice(0, 10)
    : String(value ?? 'unknown')
}

function formatThreadHistoryTitle(thread: ThreadHistoryItem): string {
  const title = normalizeDisplayTitle(thread.title)
  const derivedTitle = normalizeDisplayTitle(thread.metadata?.derivedTitle)
  if (title && !isGenericThreadTitle(title)) {
    return title
  }
  if (derivedTitle) {
    return derivedTitle
  }
  const preview = normalizeDisplayTitle(thread.metadata?.firstUserMessagePreview)
  if (preview) {
    return preview
  }
  const fallbackId = shortThreadId(thread.threadId)
  return fallbackId === 'unknown' ? '未命名会话' : `未命名会话 ${fallbackId}`
}

function normalizeDisplayTitle(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const title = value.replace(/\s+/g, ' ').trim()
  return title || null
}

function normalizeRenameTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isGenericThreadTitle(title: string): boolean {
  return (
    title === 'CCR Desktop 会话' ||
    title === 'CCR 会话' ||
    title === 'New thread' ||
    title === 'Resumed thread' ||
    title.startsWith('CCR Desktop 会话 ') ||
    title.startsWith('CCR 会话 ')
  )
}

function formatHistoryTime(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TurnRuntimeDetails(props: {
  compactStatus: RuntimeCompactStatus | null | undefined
  contextStatus: RuntimeContextStatus | null | undefined
  memoryStatus: RuntimeMemoryStatus | null | undefined
  metadata: TurnRuntimeMetadata | null
}) {
  const metadata = props.metadata
  const contextStatus = props.contextStatus
  const compactStatus = props.compactStatus
  const memoryStatus = props.memoryStatus
  if (!metadata && !contextStatus && !compactStatus && !memoryStatus) {
    return null
  }

  return (
    <details className="turn-runtime-details">
      <summary
        aria-label="运行详情"
        className="head-icon-btn"
        title="运行详情"
      >
        <HeadActionIcon name="details" />
      </summary>
      <div className="turn-runtime-popover">
        <dl>
          <div>
            <dt>状态</dt>
            <dd>{metadata?.status ?? '未知'}</dd>
          </div>
          <div>
            <dt>模型</dt>
            <dd>{contextStatus?.model ?? metadata?.model ?? '未知'}</dd>
          </div>
          <div>
            <dt>Token</dt>
            <dd>
              {formatNumber(
                contextStatus?.estimatedTokens ??
                  contextStatus?.usage?.totalTokens ??
                  metadata?.estimatedTokens ??
                  metadata?.usage?.totalTokens,
              )}{' '}
              /{' '}
              {formatNumber(
                contextStatus?.contextBudget?.totalContextWindow ??
                  contextStatus?.contextWindow ??
                  compactStatus?.contextBudget?.totalContextWindow ??
                  metadata?.contextWindow,
              )}
            </dd>
          </div>
          <div>
            <dt>消息</dt>
            <dd>
              {formatNumber(contextStatus?.messageCount ?? metadata?.messageCount)}
            </dd>
          </div>
          <div>
            <dt>压缩</dt>
            <dd>
              {compactStatus?.autoCompactEnabled === false
                ? '自动压缩关闭'
                : compactStatus?.distanceToAutoCompact !== undefined
                  ? `剩余 ${formatNumber(compactStatus.distanceToAutoCompact)} token`
                  : '未知'}
            </dd>
          </div>
          <div>
            <dt>记忆</dt>
            <dd>
              {memoryStatus?.hookRegistered === undefined
                ? '未知'
                : memoryStatus.hookRegistered
                  ? 'SessionMemory 已注册'
                  : 'SessionMemory 未注册'}
            </dd>
          </div>
          <div>
            <dt>耗时</dt>
            <dd>{formatDuration(metadata?.latencyMs)}</dd>
          </div>
          <div>
            <dt>停止原因</dt>
            <dd>{metadata?.stopReason ?? '未知'}</dd>
          </div>
          <div>
            <dt>请求 ID</dt>
            <dd>{metadata?.requestId ?? '未返回'}</dd>
          </div>
        </dl>
      </div>
    </details>
  )
}

function HeadActionIcon(props: { name: HeadActionIconName }) {
  return (
    <svg
      className="head-action-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.name === 'details' ? (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5Z" />
          <path d="M8 8h8" />
          <path d="M8 12h3" />
          <path d="M14 12h2" />
          <path d="M8 16h5" />
        </>
      ) : null}
      {props.name === 'compact' ? (
        <>
          <path d="M8 4v5H3" />
          <path d="M16 20v-5h5" />
          <path d="M3 9l5-5" />
          <path d="m21 15-5 5" />
          <path d="M16 4v5h5" />
          <path d="M8 20v-5H3" />
          <path d="m21 9-5-5" />
          <path d="m3 15 5 5" />
        </>
      ) : null}
      {props.name === 'history' ? (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4.5V9h4.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      ) : null}
      {props.name === 'newThread' ? (
        <>
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.9 8.9 0 0 1-3.9-.9L3 21l1.9-5.1a8.4 8.4 0 0 1-.9-3.9A8.5 8.5 0 0 1 12.5 3" />
          <path d="M18 3v6" />
          <path d="M15 6h6" />
        </>
      ) : null}
    </svg>
  )
}

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('zh-CN')
    : '未知'
}

function formatDuration(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '未知'
  }
  if (value < 1000) {
    return `${value}ms`
  }
  return `${(value / 1000).toFixed(1)}s`
}
