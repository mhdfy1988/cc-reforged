import { useMemo, useState } from 'react'
import type {
  LlmModelProfile,
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

type ModelMenuGroup = {
  id: string
  profileId?: string
  provider: LlmModelProviderCatalog
  title: string
  subtitle: string
  defaultModel?: string
  models: LlmModelCatalogEntry[]
}

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
  onSelectModel: (provider: string, model: string, profileId?: string) => void
  onUpdateAction: (kind: UpdateActionKind) => void
}) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const configuredModel = props.model
  const runningModel = props.contextStatus?.model ?? props.turnMetadata?.model
  const currentProfileId = props.modelList?.current?.profileId
  const hasCurrentProfile = Boolean(currentProfileId && configuredModel && props.provider)
  const modelMenuGroups = useMemo(
    () => getModelMenuGroups(props.modelList, props.provider),
    [props.modelList, props.provider],
  )
  const currentModelGroup =
    modelMenuGroups.find(group =>
      isCurrentProfileGroup(group, currentProfileId, props.provider),
    ) ?? modelMenuGroups[0]
  const modelMenuDisplayGroups = currentModelGroup ? [currentModelGroup] : []
  const currentProfileName =
    hasCurrentProfile
      ? currentModelGroup?.title ?? props.provider
      : '未配置模型'
  const modelSwitchDisabled = props.busy || Boolean(props.contextStatus?.activeTurnId)
  const contextWindow =
    props.contextStatus?.contextBudget?.totalContextWindow ??
    props.contextStatus?.contextWindow ??
    props.turnMetadata?.contextBudget?.totalContextWindow ??
    props.turnMetadata?.contextWindow ??
    props.compactStatus?.contextBudget?.totalContextWindow ??
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
        {hasCurrentProfile ? (
          <div className="model-switcher">
            <button
              aria-expanded={modelMenuOpen}
              aria-label={`当前模型：${configuredModel}`}
              className="model-chip"
              disabled={props.busy}
              title="切换当前模型"
              type="button"
              onClick={() => {
                setModelMenuOpen(open => !open)
                setProfileMenuOpen(false)
              }}
            >
              <ModelIcon />
              <span>{configuredModel}</span>
              <ChevronDownIcon />
            </button>
            {modelMenuOpen ? (
                <div className="model-menu" role="menu">
                  <div className="model-menu-head">
                    <strong>选择模型</strong>
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
                  {modelMenuDisplayGroups.length > 0 ? (
                    modelMenuDisplayGroups.map(group => (
                        <div
                          className="model-menu-provider"
                          key={group.id}
                          role="group"
                          aria-label={group.title}
                        >
                        {group.models.map(model => {
                          const selected =
                            isCurrentProfileGroup(group, currentProfileId, props.provider) &&
                            model.model === configuredModel
                          const displayName = getModelDisplayName(model)
                          return (
                            <button
                              key={`${group.id}:${model.model}`}
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
                                props.onSelectModel(
                                  group.provider.id,
                                  model.model,
                                  group.profileId,
                                )
                              }}
                            >
                              <span>
                                <strong>{displayName}</strong>
                                {shouldShowModelIdentifier(model) ? (
                                  <em>{model.model}</em>
                                ) : null}
                              </span>
                              <span className="model-menu-context">
                                {formatTokenCount(model.contextWindow ?? 0)}
                              </span>
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
        ) : null}
        <div className="profile-switcher">
          <button
            aria-expanded={profileMenuOpen}
            aria-label={`当前连接配置：${currentProfileName}`}
            className="health-chip profile-chip"
            disabled={props.busy}
            title={
              hasCurrentProfile
                ? '切换连接配置'
                : '到左侧模型页新增连接配置'
            }
            type="button"
            onClick={() => {
              if (modelMenuGroups.length > 0) {
                setProfileMenuOpen(open => !open)
              }
              setModelMenuOpen(false)
            }}
          >
            <span
              className={
                props.appServerStatus === 'ready' && hasCurrentProfile
                  ? 'dot ok'
                  : 'dot warn'
              }
            />
            <span>
              {hasCurrentProfile
                ? `${currentProfileName} · ${props.authText}`
                : '未配置模型 · 到模型页新增'}
            </span>
            {modelMenuGroups.length > 0 ? <ChevronDownIcon /> : null}
          </button>
          {profileMenuOpen ? (
            <div className="model-menu profile-menu" role="menu">
              <div className="model-menu-head">
                <strong>选择连接配置</strong>
              </div>
              {modelSwitchDisabled ? (
                <div className="model-menu-note">
                  当前任务运行中，完成后可切换连接配置。
                </div>
              ) : null}
              <div className="model-menu-list">
                {modelMenuGroups.length > 0 ? (
                  modelMenuGroups.map(group => {
                    const selected = isCurrentProfileGroup(
                      group,
                      currentProfileId,
                      props.provider,
                    )
                    const defaultModel = getGroupDefaultModel(group, configuredModel)
                    return (
                      <button
                        className={
                          selected ? 'model-menu-item selected' : 'model-menu-item'
                        }
                        disabled={modelSwitchDisabled || selected || !defaultModel}
                        key={group.id}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          if (!defaultModel) {
                            return
                          }
                          setProfileMenuOpen(false)
                          props.onSelectModel(
                            group.provider.id,
                            defaultModel,
                            group.profileId,
                          )
                        }}
                      >
                        <span>
                          <strong>{group.title}</strong>
                          <em>{group.subtitle}</em>
                        </span>
                        <span className="model-menu-context">
                          {defaultModel ?? '无模型'}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div className="model-menu-empty">暂无连接配置，请到模型页新增。</div>
                )}
              </div>
            </div>
          ) : null}
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

function getModelMenuGroups(
  modelList: LlmModelListState | null,
  provider: string,
): ModelMenuGroup[] {
  const providers = modelList?.providers ?? []
  const providerById = new Map(providers.map(item => [item.id, item]))
  const profiles = modelList?.profiles ?? []
  const currentProfileId = modelList?.current?.profileId

  return profiles
    .map((profile): ModelMenuGroup | null => {
      const profileProvider = providerById.get(profile.providerType)
      if (!profileProvider) {
        return null
      }
      const models = getProfileModelEntries(profile, profileProvider)
      if (models.length === 0) {
        return null
      }
      return {
        id: `profile:${profile.id}`,
        profileId: profile.id,
        provider: profileProvider,
        title: profile.name?.trim() || getProviderDisplayName(profileProvider),
        subtitle: `${getProviderDisplayName(profileProvider)} · ${models.length} 个模型`,
        defaultModel: profile.defaultModel,
        models,
      } satisfies ModelMenuGroup
    })
    .filter((group): group is ModelMenuGroup => Boolean(group))
    .sort((left, right) => {
      const leftCurrent = left.profileId === currentProfileId ? 0 : 1
      const rightCurrent = right.profileId === currentProfileId ? 0 : 1
      if (leftCurrent !== rightCurrent) {
        return leftCurrent - rightCurrent
      }
      const leftProvider = left.provider.id === provider ? 0 : 1
      const rightProvider = right.provider.id === provider ? 0 : 1
      if (leftProvider !== rightProvider) {
        return leftProvider - rightProvider
      }
      return left.title.localeCompare(right.title)
    })
}

function getProfileModelEntries(
  profile: LlmModelProfile,
  provider: LlmModelProviderCatalog,
): LlmModelCatalogEntry[] {
  const providerModels = provider.models ?? []
  if (!profile.models?.length) {
    return providerModels
  }

  const providerModelById = new Map(
    providerModels.map(model => [model.model, model]),
  )
  return profile.models.map(modelId => {
    const knownModel = providerModelById.get(modelId)
    if (knownModel) {
      return knownModel
    }
    return {
      provider: provider.id,
      model: modelId,
      displayName: modelId,
    }
  })
}

function isCurrentProfileGroup(
  group: ModelMenuGroup,
  currentProfileId: string | undefined,
  currentProvider: string,
): boolean {
  if (currentProfileId) {
    return group.profileId === currentProfileId
  }
  return group.provider.id === currentProvider
}

function getGroupDefaultModel(
  group: ModelMenuGroup,
  configuredModel: string,
): string | undefined {
  if (group.models.some(model => model.model === configuredModel)) {
    return configuredModel
  }
  if (
    group.defaultModel &&
    group.models.some(model => model.model === group.defaultModel)
  ) {
    return group.defaultModel
  }
  return group.models[0]?.model
}

function getModelDisplayName(model: LlmModelCatalogEntry): string {
  return model.displayName?.trim() || model.model
}

function shouldShowModelIdentifier(model: LlmModelCatalogEntry): boolean {
  const displayName = model.displayName?.trim()
  if (!displayName) {
    return false
  }
  return normalizeModelLabel(displayName) !== normalizeModelLabel(model.model)
}

function normalizeModelLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
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
  const effectiveInputWindow =
    contextStatus?.contextBudget?.effectiveInputWindow ??
    compactStatus?.contextBudget?.effectiveInputWindow
  const autoCompactThreshold =
    contextStatus?.contextBudget?.autoCompactThreshold ??
    compactStatus?.contextBudget?.autoCompactThreshold
  const parts = [
    contextStatus?.available === false ? '上下文状态：尚未开始会话' : null,
    metadata?.profileName ?? contextStatus?.profileName
      ? `连接配置：${metadata?.profileName ?? contextStatus?.profileName}`
      : null,
    metadata?.providerDisplayName ?? contextStatus?.providerDisplayName
      ? `供应商：${metadata?.providerDisplayName ?? contextStatus?.providerDisplayName}`
      : null,
    metadata?.apiMode ?? contextStatus?.apiMode
      ? `协议：${metadata?.apiMode ?? contextStatus?.apiMode}`
      : null,
    metadata?.authStrategy ?? contextStatus?.authStrategy
      ? `认证：${metadata?.authStrategy ?? contextStatus?.authStrategy}`
      : null,
    metadata?.requestedModel &&
    metadata.model &&
    metadata.requestedModel !== metadata.model
      ? `请求模型：${metadata.requestedModel}`
      : null,
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
    effectiveInputWindow
      ? `有效输入窗口：${formatTokenCount(
          effectiveInputWindow,
        )}`
      : null,
    autoCompactThreshold
      ? `自动压缩阈值：${formatTokenCount(
          autoCompactThreshold,
        )}`
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
