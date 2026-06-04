import { useEffect, useMemo, useState } from 'react'
import { PageStatusNotice } from '../common/PageStatusNotice.js'
import type {
  DesktopStatus,
  LlmAuthStrategy,
  LlmModelAvailability,
  LlmModelCatalogEntry,
  LlmModelListState,
  LlmModelProfile,
  LlmModelProfileSaveInput,
  LlmModelProviderCatalog,
} from '../../domain/displayTypes.js'
import {
  getProviderLockState,
  isProviderLocked,
} from '../../domain/providerLockPolicy.js'

type ConnectionProfile = {
  id: string
  displayName: string
  subtitle: string
  defaultModel?: LlmModelCatalogEntry
  isCurrentProvider: boolean
  modelCount: number
  statusLabel: string
  statusTone: 'default' | 'success' | 'warning' | 'danger'
  source: 'file'
}

type ProfileEditorMode = 'create' | 'edit' | null

type ProfileEditorState = {
  mode: ProfileEditorMode
  profileId?: string
  name: string
  baseUrl: string
  defaultModel: string
  modelsText: string
}

type ModelAvailabilityCache = Record<string, LlmModelAvailability>

export function ModelsPage(props: {
  availabilityByKey: ModelAvailabilityCache
  authLoginKey: string | null
  busy: boolean
  error: string | null
  modelList: LlmModelListState | null
  status: DesktopStatus | null
  testConnectionKeys: Record<string, true>
  testResultByKey: ModelAvailabilityCache
  onClearApiKey: (provider: string, model?: string, profileId?: string) => void
  onRefreshAvailability: (provider: string, model?: string, profileId?: string) => void
  onRefreshModels: () => void
  onLoginAuth: (provider: string, model?: string, profileId?: string) => void
  onCancelLogin: () => void
  onCopyProfile: (profileId: string) => void
  onDeleteProfile: (profileId: string) => void
  onSaveProfile: (input: LlmModelProfileSaveInput) => void
  onSaveApiKey: (
    provider: string,
    apiKey: string,
    model?: string,
    profileId?: string,
  ) => void
  onSelectModel: (provider: string, model: string, profileId?: string) => void
  onTestConnection: (provider: string, model?: string, profileId?: string) => void
}) {
  const providers = props.modelList?.providers ?? []
  const currentProviderId =
    props.modelList?.current?.provider ?? props.status?.config?.llm?.provider
  const currentProfileId =
    props.modelList?.current?.profileId ?? props.status?.config?.llm?.profileId
  const currentModel =
    props.modelList?.current?.model ?? props.status?.config?.llm?.model
  const profiles = props.modelList?.profiles ?? []
  const currentProfile = profiles.find(profile => profile.id === currentProfileId)
  const [selectedProviderId, setSelectedProviderId] = useState(
    currentProviderId ?? providers[0]?.id ?? '',
  )
  const [selectedProfileId, setSelectedProfileId] = useState(
    currentProfileId ?? '',
  )
  const [selectedModelId, setSelectedModelId] = useState(currentModel ?? '')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [profileEditor, setProfileEditor] =
    useState<ProfileEditorState | null>(null)

  useEffect(() => {
    if (providers.length === 0) {
      return
    }
    const currentProviderUnlocked =
      currentProviderId &&
      providers.some(
        provider =>
          provider.id === currentProviderId &&
          !isProviderLocked(provider),
      )
    const fallbackProviderId =
      (currentProviderUnlocked ? currentProviderId : undefined) ??
      providers.find(provider => !isProviderLocked(provider))?.id ??
      providers[0]!.id
    const selectedProviderUnlocked = providers.some(
      provider =>
        provider.id === selectedProviderId && !isProviderLocked(provider),
    )
    if (!selectedProviderUnlocked) {
      setSelectedProviderId(fallbackProviderId)
    }
  }, [currentProviderId, providers, selectedProviderId])

  const selectedProvider = useMemo(
    () => providers.find(provider => provider.id === selectedProviderId),
    [providers, selectedProviderId],
  )
  const selectedProviderProfiles = useMemo(
    () =>
      profiles.filter(profile => profile.providerType === selectedProviderId),
    [profiles, selectedProviderId],
  )
  const rawSelectedProfile = useMemo(
    () =>
      selectedProviderProfiles.find(profile => profile.id === selectedProfileId) ??
      selectedProviderProfiles.find(profile => profile.id === currentProfileId) ??
      selectedProviderProfiles[0],
    [currentProfileId, selectedProfileId, selectedProviderProfiles],
  )
  const selectedModels = useMemo(
    () => getProfileModelEntries(rawSelectedProfile, selectedProvider),
    [rawSelectedProfile, selectedProvider],
  )
  const selectedModel = useMemo(
    () =>
      selectedModels.find(model => model.model === selectedModelId) ??
      selectedModels.find(
        model =>
          selectedProvider?.id === currentProviderId &&
          model.model === currentModel,
      ) ??
      selectedModels[0],
    [
      currentModel,
      currentProviderId,
      selectedModelId,
      selectedModels,
      selectedProvider?.id,
    ],
  )

  const selectedAvailability = getCachedModelAvailability(
    props.availabilityByKey,
    selectedProvider?.id,
    rawSelectedProfile?.id,
  )
  const selectedTestResult = getCachedModelAvailability(
    props.testResultByKey,
    selectedProvider?.id,
    rawSelectedProfile?.id,
  )
  const effectiveAvailability = selectedTestResult ?? selectedAvailability

  const selectedProfile = useMemo(
    () =>
      selectedProvider
        ? createConnectionProfile({
            availability: effectiveAvailability,
            currentModel,
            currentProviderId,
            currentProfileId,
            profile: rawSelectedProfile,
            provider: selectedProvider,
          })
        : null,
    [
      currentModel,
      currentProfileId,
      currentProviderId,
      effectiveAvailability,
      rawSelectedProfile,
      selectedProvider,
    ],
  )

  useEffect(() => {
    if (!selectedProvider) {
      return
    }
    const profileModel = rawSelectedProfile?.defaultModel
    const nextModel =
      selectedProvider.id === currentProviderId
        ? currentModel
        : profileModel ?? selectedModels[0]?.model
    if (
      nextModel &&
      !selectedModels.some(model => model.model === selectedModelId)
    ) {
      setSelectedModelId(nextModel)
    }
  }, [
    currentModel,
    currentProviderId,
    rawSelectedProfile,
    selectedModelId,
    selectedModels,
    selectedProvider,
  ])

  useEffect(() => {
    if (
      !selectedProvider?.id ||
      !rawSelectedProfile?.id ||
      isProviderLocked(selectedProvider)
    ) {
      return
    }
    props.onRefreshAvailability(
      selectedProvider.id,
      selectedModel?.model,
      rawSelectedProfile.id,
    )
  }, [rawSelectedProfile?.id, selectedModel?.model, selectedProvider?.id])

  const hasSelectedConnection = Boolean(rawSelectedProfile?.id)
  const isCurrentSelection =
    Boolean(rawSelectedProfile?.id) &&
    rawSelectedProfile?.id === currentProfileId &&
    selectedModel?.model === currentModel
  const canEditApiKey = selectedProvider?.authStrategy === 'api_key'
  const canSaveApiKey = canEditApiKey && apiKeyInput.trim().length > 0
  const selectedProfileCacheKey = getModelAvailabilityCacheKey({
    provider: selectedProvider?.id,
    profileId: rawSelectedProfile?.id,
  })
  const isSelectedAuthLoginPending =
    Boolean(selectedProfileCacheKey) &&
    props.authLoginKey === selectedProfileCacheKey
  const isSelectedTestConnectionPending =
    Boolean(selectedProfileCacheKey) &&
    Boolean(props.testConnectionKeys[selectedProfileCacheKey!])
  const canEditProfile = rawSelectedProfile?.source === 'file'
  const canDeleteProfile =
    rawSelectedProfile?.source === 'file' &&
    rawSelectedProfile.id !== currentProfileId
  const selectedProviderLockState = getProviderLockState(selectedProvider)
  const isSelectedProviderLocked = selectedProviderLockState.locked
  const isProviderActionBlocked = props.busy || isSelectedProviderLocked
  const providerDisplayName = getProviderDisplayName(selectedProvider)
  const currentProfileLabel =
    currentProfile?.name ?? (currentProviderId && currentModel ? currentProviderId : '未配置模型')
  const currentSummary =
    currentProfile || currentModel
      ? `当前：${currentProfileLabel} · ${currentModel ?? '未选择模型'}`
      : '当前：未配置模型'
  const detailTitle = profileEditor
    ? profileEditor.mode === 'edit'
      ? '编辑连接配置'
      : `新增 ${providerDisplayName} 连接`
    : hasSelectedConnection
      ? selectedProfile?.displayName ?? providerDisplayName
      : providerDisplayName
  const selectedProviderLockLabel = isSelectedProviderLocked
    ? ` · 已锁定${selectedProviderLockState.reason ? `（${selectedProviderLockState.reason}）` : ''}`
    : ''
  const detailSubtitle = profileEditor
    ? `${providerDisplayName} · ${getApiModeLabel(selectedProvider?.apiMode)} · ${getAuthStrategyLabel(
        selectedProvider?.authStrategy,
      )}${selectedProviderLockLabel}`
    : hasSelectedConnection
      ? `${providerDisplayName} · ${getApiModeLabel(selectedProvider?.apiMode)} · ${getAvailabilityLabel(
          effectiveAvailability,
        )}${selectedProviderLockLabel}`
      : '无连接配置'
  const canSaveProfileEditor =
    Boolean(selectedProvider?.id) &&
    Boolean(profileEditor?.name.trim()) &&
    Boolean(
      profileEditor?.defaultModel.trim() ||
        parseModelsText(profileEditor?.modelsText ?? '').length > 0,
    )
  const showTitleCreateAction = Boolean(selectedProvider) && !profileEditor

  function shouldBlockSelectedProviderAction(): boolean {
    return isSelectedProviderLocked
  }

  function chooseProvider(provider: LlmModelProviderCatalog): void {
    if (isProviderLocked(provider)) {
      return
    }
    setProfileEditor(null)
    setSelectedProviderId(provider.id)
    const nextProfile =
      profiles.find(
        profile =>
          profile.providerType === provider.id && profile.id === currentProfileId,
      ) ?? profiles.find(profile => profile.providerType === provider.id)
    const nextModels = getProfileModelEntries(nextProfile, provider)
    setSelectedProfileId(nextProfile?.id ?? '')
    setSelectedModelId(
      provider.id === currentProviderId
        ? currentModel ?? nextModels[0]?.model ?? ''
        : nextProfile?.defaultModel ?? nextModels[0]?.model ?? '',
    )
    setApiKeyInput('')
  }

  function chooseProfile(profile: LlmModelProfile): void {
    if (shouldBlockSelectedProviderAction()) {
      return
    }
    setProfileEditor(null)
    const nextModels = getProfileModelEntries(profile, selectedProvider)
    setSelectedProfileId(profile.id)
    setSelectedModelId(profile.defaultModel ?? nextModels[0]?.model ?? '')
    setApiKeyInput('')
  }

  function openCreateProfile(): void {
    if (!selectedProvider || shouldBlockSelectedProviderAction()) {
      return
    }
    const providerModels = getProfileModelEntries(undefined, selectedProvider)
    const modelIds = providerModels.map(model => model.model)
    setProfileEditor({
      mode: 'create',
      name: `${getProviderDisplayName(selectedProvider)} 连接配置`,
      baseUrl: effectiveAvailability?.baseUrl ?? '',
      defaultModel: modelIds[0] ?? selectedModel?.model ?? '',
      modelsText: modelIds.join('\n'),
    })
  }

  function openEditProfile(): void {
    if (
      !rawSelectedProfile ||
      !selectedProvider ||
      !canEditProfile ||
      shouldBlockSelectedProviderAction()
    ) {
      return
    }
    const modelIds = getProfileModelEntries(rawSelectedProfile, selectedProvider).map(
      model => model.model,
    )
    setProfileEditor({
      mode: 'edit',
      profileId: rawSelectedProfile.id,
      name: rawSelectedProfile.name,
      baseUrl: rawSelectedProfile.baseUrl ?? '',
      defaultModel: rawSelectedProfile.defaultModel ?? selectedModel?.model ?? '',
      modelsText: modelIds.join('\n'),
    })
  }

  function saveProfileEditor(): void {
    if (!profileEditor || !selectedProvider || shouldBlockSelectedProviderAction()) {
      return
    }
    const models = parseModelsText(profileEditor.modelsText)
    const defaultModel =
      profileEditor.defaultModel.trim() || models[0] || selectedModel?.model
    props.onSaveProfile({
      ...(profileEditor.mode === 'edit' && profileEditor.profileId
        ? { profileId: profileEditor.profileId }
        : {}),
      name: profileEditor.name.trim(),
      providerType: selectedProvider.id,
      ...(selectedProvider.apiMode ? { apiMode: selectedProvider.apiMode } : {}),
      ...(selectedProvider.authStrategy
        ? { authStrategy: selectedProvider.authStrategy }
        : {}),
      ...(profileEditor.baseUrl.trim()
        ? { baseUrl: profileEditor.baseUrl.trim() }
        : {}),
      ...(defaultModel ? { defaultModel } : {}),
      ...(models.length > 0 ? { models } : {}),
    })
    setProfileEditor(null)
  }

  return (
    <section className="models-page page-panel workbench-main">
      <div className="models-page-title">
        <div>
          <h2>模型与供应商</h2>
          <span>{currentSummary}</span>
        </div>
        <div className="models-title-actions">
          <button
            className="ghost-action"
            disabled={props.busy}
            title="重新从 App Server 读取供应商、连接配置和当前模型状态；不会测试连接。"
            type="button"
            onClick={props.onRefreshModels}
          >
            刷新配置
          </button>
          {showTitleCreateAction ? (
            <button
              className="primary-action"
              disabled={props.busy || !selectedProvider || isSelectedProviderLocked}
              type="button"
              onClick={openCreateProfile}
            >
              新增连接配置
            </button>
          ) : null}
        </div>
      </div>

      <PageStatusNotice
        autoDismiss={false}
        message={props.error}
        tone="error"
      />

      <div className="models-workspace">
        <aside className="models-provider-column" aria-label="供应商类型">
          <div className="models-column-head">
            <strong>供应商类型</strong>
          </div>
          <div className="models-provider-list">
            {providers.length > 0 ? (
              providers.map(provider => {
                const lockState = getProviderLockState(provider)
                const isLocked = lockState.locked
                return (
                  <button
                    key={provider.id}
                    className={`${provider.id === selectedProviderId ? 'models-provider-item active' : 'models-provider-item'}${isLocked ? ' locked' : ''}`}
                    disabled={isLocked}
                    title={isLocked ? lockState.reason ?? '该供应商已锁定' : undefined}
                    type="button"
                    onClick={() => chooseProvider(provider)}
                  >
                    <span>
                      <strong>{getProviderDisplayName(provider)}</strong>
                      <em>
                        {getApiModeLabel(provider.apiMode)} ·{' '}
                        {getAuthStrategyLabel(provider.authStrategy)}
                      </em>
                    </span>
                    <small>{isLocked ? '已锁定' : getProviderProfileCount(provider, profiles)}</small>
                  </button>
                )
              })
            ) : (
              <div className="models-empty">模型列表加载中</div>
            )}
          </div>
        </aside>

        <aside className="models-profile-column" aria-label="连接配置">
          <div className="models-column-head">
            <strong>连接配置</strong>
          </div>
          <div className="models-profile-list">
            {selectedProviderProfiles.length > 0 && selectedProvider ? (
              selectedProviderProfiles.map(profile => {
                const profileKey = getModelAvailabilityCacheKey({
                  provider: selectedProvider.id,
                  profileId: profile.id,
                })
                const isProfileTestPending =
                  Boolean(profileKey) && Boolean(props.testConnectionKeys[profileKey!])
                const profileAvailability =
                  getCachedModelAvailability(
                    props.testResultByKey,
                    selectedProvider.id,
                    profile.id,
                  ) ??
                  getCachedModelAvailability(
                    props.availabilityByKey,
                    selectedProvider.id,
                    profile.id,
                  )
                const connectionProfile = createConnectionProfile({
                  availability: profileAvailability,
                  currentModel,
                  currentProfileId,
                  currentProviderId,
                  profile,
                  provider: selectedProvider,
                })
                return (
                  <button
                    className={
                      profile.id === rawSelectedProfile?.id
                        ? 'models-profile-item active'
                        : 'models-profile-item'
                    }
                    key={profile.id}
                    type="button"
                    onClick={() => chooseProfile(profile)}
                  >
                    <span>
                      <strong>{connectionProfile.displayName}</strong>
                      <em>{connectionProfile.subtitle}</em>
                    </span>
                    <div className="models-profile-tags">
                      <small
                        className={
                          isProfileTestPending
                            ? 'warning'
                            : getToneClass(connectionProfile.statusTone)
                        }
                      >
                        {isProfileTestPending ? '检测中' : connectionProfile.statusLabel}
                      </small>
                      <small>{connectionProfile.modelCount} 个模型</small>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="models-empty">
                {selectedProvider
                  ? '还没有连接配置，点右上角新增。'
                  : '先选择一个供应商类型。'}
              </div>
            )}
          </div>
        </aside>

        <div className="models-detail">
          <div className="models-detail-head">
            <div>
              <h3>{detailTitle}</h3>
              <span>{detailSubtitle}</span>
            </div>
            {!profileEditor && hasSelectedConnection ? (
              <div className="models-actions">
                <button
                  className="ghost-action"
                  disabled={isProviderActionBlocked || !canEditProfile}
                  type="button"
                  onClick={openEditProfile}
                >
                  编辑
                </button>
                <button
                  className="ghost-action"
                  disabled={isProviderActionBlocked || !rawSelectedProfile?.id}
                  type="button"
                  onClick={() => {
                    if (shouldBlockSelectedProviderAction()) {
                      return
                    }
                    if (rawSelectedProfile?.id) {
                      props.onCopyProfile(rawSelectedProfile.id)
                    }
                  }}
                >
                  复制
                </button>
                <button
                  className="ghost-action danger"
                  disabled={
                    isProviderActionBlocked ||
                    !canDeleteProfile ||
                    !rawSelectedProfile?.id
                  }
                  type="button"
                  onClick={() => {
                    if (shouldBlockSelectedProviderAction()) {
                      return
                    }
                    if (rawSelectedProfile?.id) {
                      props.onDeleteProfile(rawSelectedProfile.id)
                    }
                  }}
                >
                  删除
                </button>
                <button
                  className="ghost-action"
                  disabled={
                    isProviderActionBlocked ||
                    isSelectedTestConnectionPending ||
                    !hasSelectedConnection ||
                    !selectedProvider?.id ||
                    !selectedModel?.model
                  }
                  type="button"
                  onClick={() => {
                    if (shouldBlockSelectedProviderAction()) {
                      return
                    }
                    if (selectedProvider?.id && rawSelectedProfile?.id) {
                      props.onTestConnection(
                        selectedProvider.id,
                        selectedModel?.model,
                        rawSelectedProfile.id,
                      )
                    }
                  }}
                >
                  {isSelectedTestConnectionPending ? '测试中...' : '测试连接'}
                </button>
                <button
                  className="primary-action"
                  disabled={
                    isProviderActionBlocked ||
                    !hasSelectedConnection ||
                    !selectedProvider?.id ||
                    !selectedModel?.model ||
                    isCurrentSelection
                  }
                  type="button"
                  onClick={() => {
                    if (shouldBlockSelectedProviderAction()) {
                      return
                    }
                    if (
                      selectedProvider?.id &&
                      selectedModel?.model &&
                      rawSelectedProfile?.id
                    ) {
                      props.onSelectModel(
                        selectedProvider.id,
                        selectedModel.model,
                        rawSelectedProfile.id,
                      )
                    }
                  }}
                >
                  {isCurrentSelection ? '当前模型' : '设为当前'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="models-detail-body">
            {profileEditor ? (
            <section className="models-section profile-editor-section">
              <div className="models-section-head">
                <div>
                  <h3>
                    {profileEditor.mode === 'edit' ? '连接信息' : '填写连接信息'}
                  </h3>
                </div>
              </div>
              <div className="profile-editor-grid">
                <label>
                  <span>名称</span>
                  <input
                    disabled={isProviderActionBlocked}
                    value={profileEditor.name}
                    onChange={event =>
                      setProfileEditor(current =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label>
                  <span>Base URL</span>
                  <input
                    disabled={isProviderActionBlocked}
                    placeholder="留空使用供应商默认地址"
                    value={profileEditor.baseUrl}
                    onChange={event =>
                      setProfileEditor(current =>
                        current
                          ? { ...current, baseUrl: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
                <label>
                  <span>默认模型</span>
                  <input
                    disabled={isProviderActionBlocked}
                    value={profileEditor.defaultModel}
                    onChange={event =>
                      setProfileEditor(current =>
                        current
                          ? { ...current, defaultModel: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
                <label className="profile-editor-models">
                  <span>模型列表</span>
                  <textarea
                    disabled={isProviderActionBlocked}
                    placeholder="每行一个模型 id"
                    value={profileEditor.modelsText}
                    onChange={event =>
                      setProfileEditor(current =>
                        current
                          ? { ...current, modelsText: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
              </div>
              <div className="models-actions">
                <button
                  className="primary-action"
                  disabled={isProviderActionBlocked || !canSaveProfileEditor}
                  type="button"
                  onClick={saveProfileEditor}
                >
                  保存配置
                </button>
                <button
                  className="ghost-action"
                  disabled={isProviderActionBlocked}
                  type="button"
                  onClick={() => setProfileEditor(null)}
                >
                  取消
                </button>
              </div>
            </section>
          ) : null}

          {!profileEditor && !hasSelectedConnection ? (
            <section className="models-section">
              <div className="models-section-head">
                <div>
                  <h3>还没有连接配置</h3>
                </div>
              </div>
                <div className="models-empty">
                  {selectedProvider
                  ? `${providerDisplayName} 暂无连接配置。`
                  : '先选择一个供应商类型。'}
                </div>
            </section>
          ) : null}

          {!profileEditor && hasSelectedConnection ? (
          <>
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>模型</h3>
                <span>{selectedModels.length} 个可选模型</span>
              </div>
            </div>
            <div className="models-list">
              {selectedModels.length > 0 ? (
                selectedModels.map(model => {
                  const selected = model.model === selectedModel?.model
                  const displayName = getModelDisplayName(model)
                  return (
                    <button
                      className={selected ? 'models-model-item active' : 'models-model-item'}
                      key={`${selectedProvider?.id}:${model.model}`}
                      disabled={isProviderActionBlocked}
                      type="button"
                      onClick={() => {
                        if (shouldBlockSelectedProviderAction()) {
                          return
                        }
                        setSelectedModelId(model.model)
                      }}
                    >
                      <span>
                        <strong>{displayName}</strong>
                        {shouldShowModelIdentifier(model) ? (
                          <em>{model.model}</em>
                        ) : null}
                      </span>
                      <small>{formatTokenCount(model.contextWindow)}</small>
                    </button>
                  )
                })
              ) : (
                <div className="models-empty">该连接配置暂无模型目录。</div>
              )}
            </div>
          </section>

          <section className="models-section">
            <div className="models-section-head">
                <div>
                  <h3>凭据与 endpoint</h3>
                </div>
              </div>
            <dl className="models-facts compact">
              <div>
                <dt>Base URL</dt>
                <dd>{effectiveAvailability?.baseUrl ?? props.status?.config?.llm?.baseUrl ?? '默认'}</dd>
              </div>
              <div>
                <dt>凭据来源</dt>
                <dd>{formatCredentialSource(effectiveAvailability)}</dd>
              </div>
            </dl>
            {canEditApiKey ? (
              <div className="models-secret-form">
                <input
                  autoComplete="off"
                  disabled={isProviderActionBlocked}
                  placeholder={
                    effectiveAvailability?.auth?.configured
                      ? '已配置，留空不会改变'
                      : '输入 API Key'
                  }
                  type="password"
                  value={apiKeyInput}
                  onChange={event => setApiKeyInput(event.target.value)}
                />
                <button
                  className="primary-action"
                  disabled={
                    isProviderActionBlocked || !canSaveApiKey || !selectedProvider?.id
                  }
                  type="button"
                  onClick={() => {
                    if (shouldBlockSelectedProviderAction()) {
                      return
                    }
                    if (selectedProvider?.id) {
                      props.onSaveApiKey(
                        selectedProvider.id,
                        apiKeyInput,
                        selectedModel?.model,
                        rawSelectedProfile?.id,
                      )
                      setApiKeyInput('')
                    }
                  }}
                >
                  保存
                </button>
                <button
                  className="ghost-action"
                  disabled={isProviderActionBlocked || !selectedProvider?.id}
                  type="button"
                  onClick={() => {
                    if (shouldBlockSelectedProviderAction()) {
                      return
                    }
                    if (selectedProvider?.id) {
                      props.onClearApiKey(
                        selectedProvider.id,
                        selectedModel?.model,
                        rawSelectedProfile?.id,
                      )
                      setApiKeyInput('')
                    }
                  }}
                >
                  清空
                </button>
              </div>
            ) : selectedProvider?.authStrategy === 'oauth_refreshable' ? (
              <div className="models-oauth-actions">
                <button
                  className="primary-action"
                  disabled={
                    isProviderActionBlocked ||
                    isSelectedAuthLoginPending ||
                    !selectedProvider?.id
                  }
                  type="button"
                  onClick={() => {
                    if (shouldBlockSelectedProviderAction()) {
                      return
                    }
                    if (selectedProvider?.id && rawSelectedProfile?.id) {
                      props.onLoginAuth(
                        selectedProvider.id,
                        selectedModel?.model,
                        rawSelectedProfile.id,
                      )
                    }
                  }}
                >
                  {isSelectedAuthLoginPending
                    ? '登录中...'
                    : effectiveAvailability?.auth?.configured
                    ? '重新登录'
                    : '浏览器登录'}
                </button>
                {isSelectedAuthLoginPending ? (
                  <button
                    className="ghost-action"
                    disabled={isProviderActionBlocked}
                    type="button"
                    onClick={props.onCancelLogin}
                  >
                    取消等待
                  </button>
                ) : null}
                {isSelectedAuthLoginPending ? (
                  <span>等待浏览器回调</span>
                ) : null}
              </div>
            ) : (
              <div className="models-empty">
                {getAuthStrategyLabel(selectedProvider?.authStrategy)} 不在这里保存 API Key。
              </div>
            )}
          </section>

          <section className="models-section">
            <div className="models-section-head">
                <div>
                  <h3>可用性</h3>
                  <span>{getAvailabilityLabel(effectiveAvailability)}</span>
                </div>
              </div>
            <dl className="models-facts">
              <div>
                <dt>状态</dt>
                <dd>{getAvailabilityLabel(effectiveAvailability)}</dd>
              </div>
              <div>
                <dt>检测</dt>
                <dd>{effectiveAvailability?.networkChecked ? '已联网检测' : '本地判断'}</dd>
              </div>
              <div>
                <dt>Provider 声明</dt>
                <dd>{formatProviderCapabilities(selectedProvider)}</dd>
              </div>
              <div>
                <dt>能力工具</dt>
                <dd>
                  {formatProviderCapabilityTools(
                    effectiveAvailability?.capabilityTools ??
                      selectedProvider?.capabilityTools,
                  )}
                </dd>
              </div>
              <div>
                <dt>当前模型能力</dt>
                <dd>
                  {formatModelCapabilities(
                    effectiveAvailability?.modelCapabilities ??
                      selectedModel?.modelCapabilities,
                    selectedModel,
                  )}
                </dd>
              </div>
              <div>
                <dt>能力来源</dt>
                <dd>
                  {formatCapabilitySource(
                    effectiveAvailability?.modelCapabilities ??
                      selectedModel?.modelCapabilities,
                    effectiveAvailability,
                  )}
                </dd>
              </div>
              <div>
                <dt>当前模型</dt>
                <dd>{selectedModel?.model ?? '未选择'}</dd>
              </div>
            </dl>
            {effectiveAvailability?.error?.message ? (
              <div className="models-alert">{effectiveAvailability.error.message}</div>
            ) : null}
            {effectiveAvailability?.response?.text ? (
              <div className="models-test-response">
                <strong>测试响应</strong>
                <span>{effectiveAvailability.response.text}</span>
              </div>
            ) : null}
          </section>
          </>
          ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function getCachedModelAvailability(
  cache: ModelAvailabilityCache,
  providerId: string | undefined,
  profileId: string | undefined,
): LlmModelAvailability | null {
  const key = getModelAvailabilityCacheKey({ provider: providerId, profileId })
  const availability = key ? cache[key] : null
  if (!availability) {
    return null
  }
  if (profileId && availability.profileId && availability.profileId !== profileId) {
    return null
  }
  if (providerId && availability.provider && availability.provider !== providerId) {
    return null
  }
  return availability
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

function createConnectionProfile(input: {
  availability: LlmModelAvailability | null
  currentModel: string | undefined
  currentProfileId: string | undefined
  currentProviderId: string | undefined
  profile: LlmModelProfile | undefined
  provider: LlmModelProviderCatalog
}): ConnectionProfile {
  const isCurrentProvider = input.provider.id === input.currentProviderId
  const isCurrentProfile = input.profile?.id === input.currentProfileId
  const profileModels = getProfileModelEntries(input.profile, input.provider)
  const defaultModel =
    profileModels.find(
      model => model.model === input.profile?.defaultModel,
    ) ??
    profileModels.find(model => model.model === input.currentModel) ??
    profileModels[0]
  const displayName = input.profile?.name ?? getDefaultProfileName(input.provider)
  return {
    id: input.profile?.id ?? `${input.provider.id}:default`,
    displayName,
    subtitle: `${getEndpointLabel(input.availability)} · 默认 ${getModelDisplayName(defaultModel)}`,
    defaultModel,
    isCurrentProvider: isCurrentProvider || isCurrentProfile,
    modelCount: profileModels.length,
    statusLabel: getAvailabilityLabel(input.availability),
    statusTone: getAvailabilityTone(input.availability),
    source: input.profile?.source ?? 'file',
  }
}

function getProviderProfileCount(
  provider: LlmModelProviderCatalog,
  profiles: LlmModelProfile[],
): number {
  const listedProfileCount = provider.profiles?.length ?? 0
  const resolvedProfileCount = profiles.filter(
    profile => profile.providerType === provider.id,
  ).length
  return Math.max(listedProfileCount, resolvedProfileCount)
}

function getProfileModelEntries(
  profile: LlmModelProfile | undefined,
  provider: LlmModelProviderCatalog | undefined,
): LlmModelCatalogEntry[] {
  const providerModels = provider?.models ?? []
  if (!profile?.models?.length) {
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
      provider: provider?.id ?? profile.providerType,
      model: modelId,
      displayName: modelId,
    }
  })
}

function getDefaultProfileName(provider: LlmModelProviderCatalog): string {
  const providerName = getProviderDisplayName(provider)
  if (provider.authStrategy === 'oauth_refreshable') {
    return `${providerName} 登录配置`
  }
  if (provider.authStrategy === 'api_key') {
    return `${providerName} API Key`
  }
  return `${providerName} 默认连接`
}

function getProviderDisplayName(
  provider: LlmModelProviderCatalog | undefined,
): string {
  return provider?.displayName?.trim() || provider?.id || '未选择'
}

function getModelDisplayName(model: LlmModelCatalogEntry | undefined): string {
  return model?.displayName?.trim() || model?.model || '未选择模型'
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

function parseModelsText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map(item => item.trim())
        .filter(Boolean),
    ),
  )
}

function getApiModeLabel(value: string | undefined): string {
  const labels: Record<string, string> = {
    'anthropic-messages': 'Anthropic Messages',
    'openai-responses': 'OpenAI Responses',
    'openai-chat': 'Chat Completions',
    custom: '自定义',
  }
  return value ? labels[value] ?? value : '未知'
}

function getAuthStrategyLabel(value: LlmAuthStrategy | undefined): string {
  const labels: Record<LlmAuthStrategy, string> = {
    api_key: 'API Key',
    oauth_refreshable: 'OAuth',
    oauth_external: '外部 OAuth',
    external_process: '外部进程',
    hybrid: '混合认证',
    unknown: '未知',
  }
  return value ? labels[value] : '未知'
}

function getAvailabilityLabel(value: LlmModelAvailability | null): string {
  const state = value?.state
  if (state === 'verified') {
    return '已验证'
  }
  if (state === 'failed') {
    return '检测失败'
  }
  if (state === 'auth_ready') {
    return '认证可用'
  }
  if (state === 'configured') {
    return '已配置'
  }
  if (state === 'needs_auth') {
    return '需要凭据'
  }
  if (state === 'not_configured') {
    return '未配置'
  }
  return '待读取'
}

function getAvailabilityTone(
  value: LlmModelAvailability | null,
): ConnectionProfile['statusTone'] {
  const state = value?.state
  if (state === 'verified' || state === 'auth_ready' || state === 'configured') {
    return 'success'
  }
  if (state === 'failed') {
    return 'danger'
  }
  if (state === 'needs_auth' || state === 'not_configured') {
    return 'warning'
  }
  return 'default'
}

function getToneClass(tone: ConnectionProfile['statusTone']): string {
  if (tone === 'success') {
    return 'success'
  }
  if (tone === 'warning') {
    return 'warning'
  }
  if (tone === 'danger') {
    return 'danger'
  }
  return ''
}

function getEndpointLabel(availability: LlmModelAvailability | null): string {
  const baseUrl = availability?.baseUrl ?? availability?.auth?.baseUrl
  if (!baseUrl) {
    return '默认 endpoint'
  }
  return baseUrl.replace(/^https?:\/\//, '')
}

function formatCredentialSource(availability: LlmModelAvailability | null): string {
  const auth = availability?.auth
  const source = auth?.source?.trim()
  if (!source || source === 'none') {
    return auth?.configured ? '已配置' : '未配置'
  }
  if (isEnvironmentCredentialSource(source)) {
    return '环境变量凭据'
  }
  if (isLocalCredentialFileSource(source)) {
    return '用户全局凭据'
  }
  if (source === '/login managed key') {
    return '登录托管凭据'
  }
  if (source === 'claude.ai') {
    return 'Claude.ai 凭据'
  }
  if (source === 'apiKeyHelper') {
    return 'API Key Helper'
  }
  return source
}

function isEnvironmentCredentialSource(source: string): boolean {
  return source === 'env' || /^[A-Z][A-Z0-9_]*$/u.test(source)
}

function isLocalCredentialFileSource(source: string): boolean {
  const normalized = source.replace(/\\/g, '/').toLowerCase()
  return (
    normalized.includes('/.ccr/data/llm.credentials.local.json') ||
    normalized.endsWith('/llm.credentials.local.json')
  )
}

function getCapabilityBadges(provider: LlmModelProviderCatalog | undefined) {
  const capabilities = provider?.capabilities ?? {}
  const capabilityTools = provider?.capabilityTools
  return [
    { label: '流式', enabled: Boolean(capabilities.streaming) },
    { label: '工具', enabled: Boolean(capabilities.tools) },
    { label: '推理', enabled: Boolean(capabilities.reasoning) },
    { label: '用量', enabled: Boolean(capabilities.usage) },
    {
      label: '生图',
      enabled: Boolean(capabilityTools?.imageGeneration?.available),
    },
  ]
}

function formatProviderCapabilities(provider: LlmModelProviderCatalog | undefined): string {
  const enabled = getCapabilityBadges(provider)
    .filter(item => item.enabled)
    .map(item => item.label)
  return enabled.length > 0 ? enabled.join('、') : '暂无声明'
}

function formatProviderCapabilityTools(
  capabilityTools: LlmModelProviderCatalog['capabilityTools'] | undefined,
): string {
  const imageGeneration = capabilityTools?.imageGeneration
  if (!imageGeneration) {
    return '暂无声明'
  }
  const provider =
    imageGeneration.providerDisplayName?.trim() ||
    imageGeneration.provider?.trim() ||
    '当前 provider'
  const model = imageGeneration.model?.trim() || '默认模型'
  if (imageGeneration.available) {
    return `生图：${provider} / ${model}`
  }
  return `生图不可用：${imageGeneration.reason || 'provider 不支持'}`
}

function formatModelCapabilities(
  capabilities: LlmModelCatalogEntry['modelCapabilities'] | undefined,
  model: LlmModelCatalogEntry | undefined,
): string {
  const input = capabilities?.inputModalities?.length
    ? capabilities.inputModalities.join('+')
    : model?.inputModalities?.length
      ? model.inputModalities.join('+')
      : '未知'
  const output = capabilities?.outputModalities?.length
    ? capabilities.outputModalities.join('+')
    : 'text'
  const flags = [
    (capabilities?.tools ?? model?.supportsTools) ? '工具' : null,
    model?.supportsReasoning ? '推理' : null,
    capabilities?.structuredOutput ? '结构化输出' : null,
  ].filter((item): item is string => Boolean(item))
  return [
    `输入 ${input}`,
    `输出 ${output}`,
    ...(flags.length > 0 ? flags : ['暂无额外声明']),
  ].join('、')
}

function formatCapabilitySource(
  capabilities: LlmModelCatalogEntry['modelCapabilities'] | undefined,
  availability: LlmModelAvailability | null,
): string {
  const checked = availability?.networkChecked ? '已联网检测' : '本地判断'
  if (!capabilities) {
    return `${checked} / 默认推断`
  }
  return `${checked} / ${getCapabilitySourceText(capabilities.source)}`
}

function getCapabilitySourceText(
  source: NonNullable<LlmModelCatalogEntry['modelCapabilities']>['source'],
): string {
  if (source === 'builtin') {
    return '内置模型目录'
  }
  if (source === 'profile_override') {
    return 'Profile 覆盖'
  }
  return '默认纯文本推断'
}

function formatTokenCount(tokens: number | undefined): string {
  if (!Number.isFinite(tokens) || !tokens || tokens <= 0) {
    return '未知'
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`
  }
  return String(tokens)
}
