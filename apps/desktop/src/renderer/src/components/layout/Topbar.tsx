import { useMemo, useState } from 'react'
import type {
  LlmModelCatalogEntry,
  LlmModelListState,
  LlmModelProviderCatalog,
  DesktopUpdateState,
  RuntimeCompactStatus,
  RuntimeContextStatus,
  RuntimeMemoryStatus,
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
  compactStatus: RuntimeCompactStatus | null | undefined
  contextStatus: RuntimeContextStatus | null | undefined
  contextWindow: number | undefined
  memoryStatus: RuntimeMemoryStatus | null | undefined
  model: string
  modelList: LlmModelListState | null
  provider: string
  turnMetadata: TurnRuntimeMetadata | null
  updateStatus: DesktopUpdateState | null | undefined
  workspacePath: string
  onChooseWorkspace: () => void
  onSelectModel: (provider: string, model: string) => void
  onUpdateAction: (kind: UpdateActionKind) => void
}) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const configuredModel = props.model
  const runningModel = props.contextStatus?.model ?? props.turnMetadata?.model
  const modelProviders = useMemo(
    () => getModelProviders(props.modelList, props.provider),
    [props.modelList, props.provider],
  )
  const modelSwitchDisabled = props.busy || Boolean(props.contextStatus?.activeTurnId)
  const contextWindow =
    props.contextStatus?.contextWindow ??
    props.compactStatus?.effectiveContextWindow ??
    props.turnMetadata?.contextWindow ??
    props.contextWindow ??
    200_000
  const usedTokens =
    props.contextStatus?.estimatedTokens ??
    props.contextStatus?.usage?.totalTokens ??
    props.turnMetadata?.estimatedTokens ??
    props.turnMetadata?.usage?.totalTokens ??
    0
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
      <div className="provider-cluster" aria-label="模型和认证状态">
        <div className="model-switcher">
          <button
            aria-expanded={modelMenuOpen}
            aria-label={`当前模型：${configuredModel}`}
            className="model-chip"
            disabled={props.busy}
            title="切换当前模型，下一轮消息生效"
            type="button"
            onClick={() => setModelMenuOpen(open => !open)}
          >
            <ModelIcon />
            <span>{configuredModel}</span>
            <ChevronDownIcon />
          </button>
          {modelMenuOpen ? (
            <div className="model-menu" role="menu">
              <div className="model-menu-head">
                <strong>选择模型</strong>
                <span>{props.provider} · 下一轮消息生效</span>
              </div>
              {runningModel && runningModel !== configuredModel ? (
                <div className="model-menu-note">
                  当前会话最近一轮使用：{runningModel}
                </div>
              ) : null}
              {modelSwitchDisabled ? (
                <div className="model-menu-note">
                  当前任务运行中，完成后可切换模型。
                </div>
              ) : null}
              <div className="model-menu-list">
                {modelProviders.length > 0 ? (
                  modelProviders.map(provider => (
                    <div
                      className="model-menu-provider"
                      key={provider.id}
                      role="group"
                      aria-label={getProviderDisplayName(provider)}
                    >
                      <div className="model-menu-provider-title">
                        {getProviderDisplayName(provider)}
                      </div>
                      {(provider.models ?? []).map(model => {
                        const selected =
                          provider.id === props.provider &&
                          model.model === configuredModel
                        return (
                          <button
                            key={`${provider.id}:${model.model}`}
                            className={
                              selected
                                ? 'model-menu-item selected'
                                : 'model-menu-item'
                            }
                            disabled={modelSwitchDisabled || selected}
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setModelMenuOpen(false)
                              props.onSelectModel(provider.id, model.model)
                            }}
                          >
                            <span>
                              <strong>{getModelDisplayName(model)}</strong>
                              <em>{model.model}</em>
                            </span>
                            {selected ? (
                              <CheckIcon />
                            ) : (
                              <span className="model-menu-context">
                                {formatTokenCount(model.contextWindow ?? 0)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))
                ) : (
                  <div className="model-menu-empty">模型列表加载中</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="health-chip">
          <span className={props.appServerStatus === 'ready' ? 'dot ok' : 'dot warn'} />
          {props.provider} · {props.authText}
        </div>
      </div>
      <div
        className="context-chip"
        title={getContextTitle(
          props.turnMetadata,
          props.contextStatus,
          props.compactStatus,
          props.memoryStatus,
        )}
      >
        上下文 {formatTokenCount(usedTokens)} / {formatTokenCount(contextWindow)}
      </div>
      <TopbarUpdateNotice
        busy={props.busy}
        updateStatus={props.updateStatus}
        onAction={props.onUpdateAction}
      />
    </header>
  )
}

function getModelProviders(
  modelList: LlmModelListState | null,
  provider: string,
): LlmModelProviderCatalog[] {
  const providers = modelList?.providers ?? []
  const currentIndex = providers.findIndex(item => item.id === provider)
  if (currentIndex <= 0) {
    return providers
  }
  return [
    providers[currentIndex],
    ...providers.slice(0, currentIndex),
    ...providers.slice(currentIndex + 1),
  ]
}

function getModelDisplayName(model: LlmModelCatalogEntry): string {
  return model.displayName?.trim() || model.model
}

function getProviderDisplayName(provider: LlmModelProviderCatalog): string {
  return provider.displayName?.trim() || provider.id
}

function ModelIcon() {
  return (
    <svg
      className="model-chip-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 4.8 7.1v8.2L12 19.5l7.2-4.2V7.1Z" />
      <path d="M12 11.3 4.9 7.2" />
      <path d="m12 11.3 7.1-4.1" />
      <path d="M12 11.3v8" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      className="model-chip-chevron"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="model-menu-check"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
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

function getContextTitle(
  metadata: TurnRuntimeMetadata | null,
  contextStatus: RuntimeContextStatus | null | undefined,
  compactStatus: RuntimeCompactStatus | null | undefined,
  memoryStatus: RuntimeMemoryStatus | null | undefined,
): string {
  const parts = [
    contextStatus?.available === false ? '上下文状态：尚未开始会话' : null,
    contextStatus?.messageCount !== undefined
      ? `消息数：${contextStatus.messageCount}`
      : null,
    contextStatus?.readFileStateSize !== undefined
      ? `已读文件状态：${contextStatus.readFileStateSize}`
      : null,
    contextStatus?.compactBoundaryCount !== undefined
      ? `压缩边界：${contextStatus.compactBoundaryCount}`
      : null,
    compactStatus?.autoCompactEnabled !== undefined
      ? `自动压缩：${compactStatus.autoCompactEnabled ? '开启' : '关闭'}`
      : null,
    compactStatus?.distanceToAutoCompact !== undefined
      ? `距离自动压缩：${formatTokenCount(compactStatus.distanceToAutoCompact)}`
      : null,
    memoryStatus?.hookRegistered !== undefined
      ? `SessionMemory Hook：${memoryStatus.hookRegistered ? '已注册' : '未注册'}`
      : null,
    metadata?.stopReason ? `停止原因：${metadata.stopReason}` : null,
    metadata?.latencyMs ? `耗时：${metadata.latencyMs}ms` : null,
    metadata?.requestId ? `请求 ID：${metadata.requestId}` : null,
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
