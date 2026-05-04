import type {
  DesktopUpdateState,
  TurnRuntimeMetadata,
} from '../../domain/displayTypes.js'
import {
  getTopbarUpdateAction,
  getTopbarUpdateSubtitle,
  getTopbarUpdateTitle,
  shouldShowTopbarUpdateNotice,
  type UpdateActionKind,
} from '../../domain/updateDisplay.js'

export function Topbar(props: {
  appServerStatus: string | undefined
  authText: string
  busy: boolean
  contextWindow: number | undefined
  model: string
  provider: string
  turnMetadata: TurnRuntimeMetadata | null
  updateStatus: DesktopUpdateState | null | undefined
  workspacePath: string
  onChooseWorkspace: () => void
  onUpdateAction: (kind: UpdateActionKind) => void
}) {
  const runtimeModel = props.turnMetadata?.model ?? props.model
  const contextWindow =
    props.turnMetadata?.contextWindow ?? props.contextWindow ?? 200_000
  const usedTokens = props.turnMetadata?.usage?.totalTokens ?? 0
  return (
    <header className="topbar">
      <button
        aria-label="选择工作区"
        className="workspace-card workspace-card-button"
        disabled={props.busy}
        title="点击选择并打开工作区"
        type="button"
        onClick={props.onChooseWorkspace}
      >
        <span className="workspace-icon" aria-hidden="true" />
        <div>
          <strong>{props.workspacePath || '未选择工作区'}</strong>
          <span>{props.workspacePath ? '当前工作区 · 点击切换' : '点击选择工作区'}</span>
        </div>
      </button>
      <button className="model-chip">{runtimeModel}</button>
      <div
        className="context-chip"
        title={getContextTitle(props.turnMetadata)}
      >
        上下文 {formatTokenCount(usedTokens)} / {formatTokenCount(contextWindow)}
      </div>
      <div className="health-chip">
        <span className={props.appServerStatus === 'ready' ? 'dot ok' : 'dot warn'} />
        {props.provider} · {props.authText}
      </div>
      <TopbarUpdateNotice
        busy={props.busy}
        updateStatus={props.updateStatus}
        onAction={props.onUpdateAction}
      />
    </header>
  )
}

function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return '0K'
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`
  }
  return String(tokens)
}

function getContextTitle(metadata: TurnRuntimeMetadata | null): string {
  if (!metadata) {
    return '当前模型上下文窗口'
  }
  const parts = [
    metadata.stopReason ? `停止原因：${metadata.stopReason}` : null,
    metadata.latencyMs ? `耗时：${metadata.latencyMs}ms` : null,
    metadata.requestId ? `请求 ID：${metadata.requestId}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('\n') : '当前模型上下文窗口'
}

function TopbarUpdateNotice(props: {
  busy: boolean
  updateStatus: DesktopUpdateState | null | undefined
  onAction: (kind: UpdateActionKind) => void
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
          onClick={() => props.onAction(action.kind)}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
