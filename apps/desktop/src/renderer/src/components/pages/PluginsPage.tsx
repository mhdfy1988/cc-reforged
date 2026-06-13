import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PluginAction } from '../../../../../../../src/services/plugins/pluginActionService.js'
import type {
  PluginInstallationTarget,
} from '../../../../../../../src/services/plugins/pluginDomainTypes.js'
import {
  pluginManagementClient,
  type PluginActionPlanState,
  type PluginCatalogState,
  type PluginDetailState,
  type PluginManagementItem,
  type PluginOperationState,
} from '../../domain/pluginManagementClient.js'
import { SearchGlyph } from './CapabilityCatalogParts.js'

type PluginImportKind = 'directory' | 'archive'
type PluginComponentKind =
  | 'command'
  | 'agent'
  | 'skill'
  | 'hook'
  | 'mcp'
  | 'lsp'
  | 'channel'
  | 'output-style'
type PluginComponentDetail = {
  id: string
  kind: PluginComponentKind
  kindLabel: string
  name: string
  summary: string
  source?: string
  raw: string
}
type PluginDetailTab =
  | 'overview'
  | 'capabilities'
  | 'runtime'
  | 'configuration'
  | 'dependencies'
  | 'security'
  | 'diagnostics'

const detailTabs: Array<{ id: PluginDetailTab; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'capabilities', label: '能力' },
  { id: 'runtime', label: '运行时' },
  { id: 'configuration', label: '配置' },
  { id: 'dependencies', label: '依赖与更新' },
  { id: 'security', label: '安全与来源' },
  { id: 'diagnostics', label: '诊断' },
]

export function PluginsPage() {
  const [catalog, setCatalog] = useState<PluginCatalogState | null>(null)
  const [detail, setDetail] = useState<PluginDetailState | null>(null)
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sourceManagerOpen, setSourceManagerOpen] = useState(false)
  const [sourceType, setSourceType] =
    useState<PluginImportKind>('directory')
  const [sourceValue, setSourceValue] = useState('')
  const [sourceBusy, setSourceBusy] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PluginDetailTab>('overview')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRevision, setDetailRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<PluginActionPlanState | null>(null)
  const [operation, setOperation] = useState<PluginOperationState | null>(null)

  const installedPlugins = useMemo(
    () => catalog?.plugins.filter(isLocallyManagedPlugin) ?? [],
    [catalog],
  )
  const builtInPluginCount = useMemo(
    () => installedPlugins.filter(isBuiltInPlugin).length,
    [installedPlugins],
  )
  const enabledPluginCount = useMemo(
    () => installedPlugins.filter(plugin => plugin.derivedState.enabled).length,
    [installedPlugins],
  )
  const filteredPlugins = useMemo(
    () =>
      installedPlugins.filter(plugin => {
        const normalizedQuery = query.trim().toLocaleLowerCase()
        return matchesPluginQuery(plugin, normalizedQuery)
      }),
    [installedPlugins, query],
  )
  const visiblePlugins = filteredPlugins

  const selectedPlugin =
    visiblePlugins.find(plugin => plugin.pluginId === selectedPluginId) ??
    visiblePlugins[0] ??
    null

  async function refreshCatalog(options: { preserveError?: boolean } = {}) {
    setLoading(true)
    if (!options.preserveError) setError(null)
    try {
      const nextCatalog = await pluginManagementClient.list()
      setCatalog(nextCatalog)
      setDetailRevision(current => current + 1)
      setSelectedPluginId(current => {
        if (
          current &&
          nextCatalog.plugins.some(plugin => plugin.pluginId === current)
        ) {
          return current
        }
        return (
          nextCatalog.plugins.find(isLocallyManagedPlugin)?.pluginId ?? null
        )
      })
    } catch (refreshError) {
      setError(toErrorMessage(refreshError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshCatalog()
  }, [])

  useEffect(() => {
    if (!selectedPlugin) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setError(null)
    void pluginManagementClient
      .inspect(selectedPlugin.pluginId)
      .then(nextDetail => {
        if (!cancelled) setDetail(nextDetail)
      })
      .catch(inspectError => {
        if (!cancelled) setError(toErrorMessage(inspectError))
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailRevision, selectedPlugin?.pluginId])

  useEffect(() => {
    if (
      !operation ||
      operation.status === 'succeeded' ||
      operation.status === 'failed' ||
      operation.status === 'cancelled'
    ) {
      return
    }
    let cancelled = false
    const timer = window.setInterval(() => {
      void pluginManagementClient
        .getOperation(operation.operationId)
        .then(nextOperation => {
          if (!cancelled && nextOperation) {
            if (
              nextOperation.status === 'succeeded' ||
              nextOperation.status === 'failed' ||
              nextOperation.status === 'cancelled'
            ) {
              const feedback = getTerminalOperationFeedback(nextOperation)
              if (feedback) setError(feedback)
              setOperation(null)
              void refreshCatalog({ preserveError: true })
            } else {
              setOperation(nextOperation)
            }
          }
        })
        .catch(operationError => {
          if (!cancelled) setError(toErrorMessage(operationError))
        })
    }, 500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [operation?.operationId, operation?.status])

  async function requestAction(
    action: PluginAction,
    options: { version?: string; sourceId?: string } = {},
  ) {
    if (!selectedPlugin) return
    await requestPluginAction(selectedPlugin, action, options)
  }

  async function requestPluginAction(
    plugin: PluginManagementItem,
    action: PluginAction,
    options: { version?: string; sourceId?: string } = {},
  ) {
    const target = getActionTarget(plugin)
    if (!target) {
      setError('当前 Plugin 没有可操作的安装作用域。')
      return
    }
    setSelectedPluginId(plugin.pluginId)
    setError(null)
    setPlan(null)
    try {
      const nextPlan = await pluginManagementClient.plan({
        action,
        target: {
          pluginId: plugin.pluginId,
          scope: target.scope,
          ...(target.workspaceRoot
            ? { workspaceRoot: target.workspaceRoot }
            : {}),
          ...(options.version ? { version: options.version } : {}),
          ...(options.sourceId ? { sourceId: options.sourceId } : {}),
        },
      })
      if (!nextPlan.allowed) {
        setError(nextPlan.blockedReason ?? '当前操作不允许执行。')
        setPlan(nextPlan)
        return
      }
      if (nextPlan.requiresConfirmation) {
        setPlan(nextPlan)
        return
      }
      await applyPlan(nextPlan)
    } catch (actionError) {
      setError(toErrorMessage(actionError))
    }
  }

  async function applyPlan(nextPlan: PluginActionPlanState) {
    setError(null)
    try {
      const nextOperation = await pluginManagementClient.apply({
        planId: nextPlan.planId,
        ...(nextPlan.requiresConfirmation
          ? {
              confirmed: true,
              ...(nextPlan.confirmation?.token
                ? { confirmationToken: nextPlan.confirmation.token }
                : {}),
            }
          : {}),
      })
      setPlan(null)
      if (isTerminalOperation(nextOperation)) {
        const feedback = getTerminalOperationFeedback(nextOperation)
        if (feedback) setError(feedback)
        setOperation(null)
        void refreshCatalog({ preserveError: true })
      } else {
        setOperation(nextOperation)
      }
    } catch (applyError) {
      setError(toErrorMessage(applyError))
    }
  }

  async function importLocalPlugin() {
    const value = sourceValue.trim()
    if (!value) {
      setError(
        sourceType === 'directory'
          ? '请选择 Plugin 文件夹。'
          : '请选择 Plugin 压缩包。',
      )
      return
    }
    setSourceBusy('import')
    setError(null)
    try {
      await pluginManagementClient.importLocal({
        path: value,
        kind: sourceType,
        enableAfterInstall: true,
      })
      setSourceValue('')
      await refreshCatalog()
      setSourceManagerOpen(false)
    } catch (sourceError) {
      setError(toErrorMessage(sourceError))
    } finally {
      setSourceBusy(null)
    }
  }

  async function chooseSourcePath(): Promise<void> {
    const picker = getPluginSourcePathPicker(sourceType)
    if (!picker) return
    setError(null)
    try {
      const result = await window.ccr.choosePath(picker)
      if (result.canceled || !result.path) return
      setSourceValue(result.path)
    } catch (chooseError) {
      setError(toErrorMessage(chooseError))
    }
  }

  return (
    <section className="page-panel plugins-page plugin-workbench workbench-main">
      <header className="plugin-market-topbar">
        <div className="plugin-market-heading">
          <h2>插件</h2>
          <span>
            {installedPlugins.length} 个 Plugin · {builtInPluginCount} 个内置 ·{' '}
            {enabledPluginCount} 个启用
            {catalog?.diagnostics.length
              ? ` · ${catalog.diagnostics.length} 条目录诊断`
              : ''}
          </span>
        </div>
        <div className="plugin-topbar-actions">
          <button
            className="ghost-action"
            type="button"
            onClick={() => setSourceManagerOpen(true)}
          >
            导入 Plugin
          </button>
          <button
            className="ghost-action"
            disabled={loading}
            type="button"
            onClick={() => void refreshCatalog()}
          >
            刷新
          </button>
        </div>
      </header>

      {error ? <div className="plugin-inline-error">{error}</div> : null}
      {catalog?.marketplaces.diagnostics.length ? (
        <div className="plugin-inline-warning">
          部分 Plugin 候选信息当前不可用，已安装 Plugin 仍可继续管理。
        </div>
      ) : null}

      <div className="plugin-market-layout">
        <section className="plugin-directory-panel">
          <div className="plugin-directory-head">
            <h3>Plugin</h3>
            <span>
              {visiblePlugins.length} / {installedPlugins.length}
            </span>
          </div>
          <div className="plugin-directory-controls">
            <label className="plugin-market-search">
              <SearchGlyph />
              <input
                placeholder="搜索插件"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="plugin-directory-list">
            {loading && !catalog ? (
              <div className="models-empty compact">正在读取 Plugin 目录。</div>
            ) : visiblePlugins.length > 0 ? (
              visiblePlugins.map(plugin => (
                <PluginDirectoryCard
                  key={plugin.pluginId}
                  operation={operation}
                  plugin={plugin}
                  selected={selectedPlugin?.pluginId === plugin.pluginId}
                  onSelect={() => {
                    setSelectedPluginId(plugin.pluginId)
                    setActiveTab('overview')
                    setPlan(null)
                    setOperation(null)
                  }}
                  onAction={(nextPlugin, action) =>
                    void requestPluginAction(nextPlugin, action)
                  }
                />
              ))
            ) : (
              <div className="models-empty compact">
                没有匹配的 Plugin。
              </div>
            )}
          </div>
        </section>

        <article className="plugin-detail-panel plugin-management-detail">
          {selectedPlugin ? (
            <>
              <PluginDetailHeader
                operation={operation}
                plugin={detail?.record ?? selectedPlugin}
                onAction={requestAction}
              />
              <nav className="plugin-detail-tabs" aria-label="Plugin 详情">
                {detailTabs.map(tab => (
                  <button
                    className={activeTab === tab.id ? 'active' : ''}
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <div className="plugin-detail-scroll">
                {detailLoading && !detail ? (
                  <div className="models-empty compact">正在读取详情。</div>
                ) : detail ? (
                  <PluginDetailContent
                    activeTab={activeTab}
                    detail={detail}
                    onAction={requestAction}
                  />
                ) : (
                  <div className="models-empty compact">Plugin 详情不可用。</div>
                )}
              </div>
            </>
          ) : (
            <div className="plugin-empty-state">
              <strong>暂无 Plugin</strong>
              <span>当前没有已安装或内置 Plugin。</span>
            </div>
          )}
        </article>
      </div>
      {sourceManagerOpen ? (
        <PluginImportManager
          busy={sourceBusy}
          error={error}
          sourceType={sourceType}
          value={sourceValue}
          onAdd={() => void importLocalPlugin()}
          onChoosePath={() => void chooseSourcePath()}
          onClose={() => {
            setSourceManagerOpen(false)
          }}
          onSourceTypeChange={setSourceType}
          onValueChange={setSourceValue}
        />
      ) : null}
      {plan ? (
        <PluginPlanDialog
          plan={plan}
          onCancel={() => setPlan(null)}
          onConfirm={() => void applyPlan(plan)}
        />
      ) : null}
    </section>
  )
}

function PluginImportManager(props: {
  sourceType: PluginImportKind
  value: string
  busy: string | null
  error: string | null
  onSourceTypeChange: (value: PluginImportKind) => void
  onValueChange: (value: string) => void
  onAdd: () => void
  onChoosePath: () => void
  onClose: () => void
}) {
  return (
    <div className="plugin-modal-backdrop" role="presentation">
      <section
        aria-label="Plugin 导入"
        aria-modal="true"
        className="plugin-source-dialog"
        role="dialog"
      >
        <header>
          <div>
            <h3>导入 Plugin</h3>
            <span>{props.busy ? '正在导入' : '用户全局'}</span>
          </div>
          <IconAction icon={<CloseGlyph />} label="关闭" onClick={props.onClose} />
        </header>
        {props.error ? (
          <div className="plugin-inline-error">{props.error}</div>
        ) : null}
        <div className="plugin-source-form">
          <select
            aria-label="Plugin 包类型"
            value={props.sourceType}
            onChange={event =>
              props.onSourceTypeChange(
                event.target.value as PluginImportKind,
              )
            }
          >
            <option value="directory">文件夹</option>
            <option value="archive">压缩包</option>
          </select>
          <div className="plugin-source-path-control wide">
            <input
              aria-label="Plugin 包路径"
              placeholder={pluginImportPlaceholder(props.sourceType)}
              value={props.value}
              onChange={event => props.onValueChange(event.target.value)}
            />
            <button
              className="ghost-action"
              disabled={props.busy !== null}
              type="button"
              onClick={props.onChoosePath}
            >
              选择
            </button>
          </div>
          <button
            className="primary-action"
            disabled={props.busy !== null}
            type="button"
            onClick={props.onAdd}
          >
            导入
          </button>
        </div>
      </section>
    </div>
  )
}

function PluginDirectoryCard(props: {
  operation: PluginOperationState | null
  plugin: PluginManagementItem
  selected: boolean
  onSelect: () => void
  onAction: (plugin: PluginManagementItem, action: PluginAction) => void
}) {
  const scope = getActionTarget(props.plugin)?.scope
  const canToggle = scope !== 'managed' && props.plugin.derivedState.installed
  const enabled = props.plugin.derivedState.enabled
  return (
    <div
      className={`plugin-directory-card ${props.selected ? 'selected' : ''}`}
      onClick={props.onSelect}
    >
      <button className="plugin-directory-main" type="button">
        <PluginAvatar plugin={props.plugin} />
        <span>
          <strong>{props.plugin.displayName}</strong>
          <em>
            {scope ? formatScope(scope) : '运行时'} ·{' '}
            {getInstalledVersion(props.plugin) ?? '版本未知'}
          </em>
        </span>
      </button>
      <div className="plugin-directory-foot">
        {canToggle ? (
          <label
            className="plugin-list-toggle"
            title={enabled ? '停用插件' : '启用插件'}
            onClick={event => event.stopPropagation()}
          >
            <input
              aria-label={enabled ? '停用插件' : '启用插件'}
              checked={enabled}
              disabled={isPluginOperationBusy(props.operation)}
              type="checkbox"
              onChange={event =>
                props.onAction(
                  props.plugin,
                  event.target.checked ? 'enable' : 'disable',
                )
              }
            />
            <i aria-hidden="true" />
          </label>
        ) : null}
      </div>
    </div>
  )
}

function PluginDetailHeader(props: {
  plugin: PluginManagementItem
  operation: PluginOperationState | null
  onAction: (
    action: PluginAction,
    options?: { version?: string; sourceId?: string },
  ) => void
}) {
  const plugin = props.plugin
  const target = getActionTarget(plugin)
  const candidate = getUpdateCandidate(plugin)
  const disabled =
    target?.scope === 'managed' ||
    isPluginOperationBusy(props.operation)

  return (
    <div className="plugin-detail-fixed-head">
      <nav className="plugin-breadcrumb" aria-label="插件位置">
        <span>插件</span>
        <i />
        <strong>{plugin.displayName}</strong>
      </nav>
      <header className="plugin-detail-heading plugin-management-heading">
        <PluginAvatar large plugin={plugin} />
        <div>
          <h2>{plugin.displayName}</h2>
          <span>{plugin.description || plugin.pluginId}</span>
        </div>
        <div className="plugin-detail-actions">
          {candidate ? (
            <IconAction
              disabled={disabled}
              icon={<UpdateGlyph />}
              label={`更新到 ${candidate.version ?? '候选版本'}`}
              onClick={() =>
                props.onAction('update', {
                  sourceId: candidate.sourceId,
                  version: candidate.version,
                })
              }
            />
          ) : null}
          {target?.scope !== 'managed' && plugin.derivedState.installed ? (
            <>
              <IconAction
                disabled={disabled}
                icon={<RepairGlyph />}
                label="修复插件"
                onClick={() => props.onAction('repair')}
              />
              <IconAction
                danger
                disabled={disabled}
                icon={<TrashGlyph />}
                label="卸载插件"
                onClick={() => props.onAction('uninstall')}
              />
            </>
          ) : null}
        </div>
      </header>
    </div>
  )
}

function PluginDetailContent(props: {
  activeTab: PluginDetailTab
  detail: PluginDetailState
  onAction: (
    action: PluginAction,
    options?: { version?: string; sourceId?: string },
  ) => void
}) {
  const { detail } = props
  switch (props.activeTab) {
    case 'overview':
      return <PluginOverview detail={detail} />
    case 'capabilities':
      return <PluginCapabilities detail={detail} />
    case 'runtime':
      return <PluginRuntime detail={detail} />
    case 'configuration':
      return <PluginConfiguration detail={detail} />
    case 'dependencies':
      return (
        <PluginDependencies
          detail={detail}
          onRollback={version => props.onAction('rollback', { version })}
        />
      )
    case 'security':
      return <PluginSecurity detail={detail} />
    case 'diagnostics':
      return <PluginDiagnostics detail={detail} />
  }
}

function PluginOverview(props: { detail: PluginDetailState }) {
  const { detail } = props
  const plugin = detail.record
  const installedVersion = getInstalledVersion(plugin)
  const activeVersion = getActiveVersion(plugin)
  const candidate = getUpdateCandidate(plugin)
  const target = getActionTarget(plugin)
  return (
    <div className="plugin-tab-content">
      <div className="plugin-fact-grid">
        <PluginFact label="Plugin ID" value={plugin.pluginId} />
        <PluginFact
          label="作用域"
          value={target ? formatScope(target.scope) : '无有效安装实例'}
        />
        <PluginFact label="安装版本" value={installedVersion ?? '未知'} />
        <PluginFact label="运行版本" value={activeVersion ?? '未激活'} />
        <PluginFact
          label="候选版本"
          value={candidate?.version ?? installedVersion ?? '无'}
        />
      </div>
      {installedVersion && activeVersion && installedVersion !== activeVersion ? (
        <div className="plugin-callout warning">
          新版本已安装，当前会话仍运行 {activeVersion}。刷新插件或重启后生效。
        </div>
      ) : null}
      <section className="plugin-detail-section">
        <div className="plugin-section-head">
          <h3>安装实例</h3>
          <span>{plugin.installations.length}</span>
        </div>
        {plugin.installations.length ? (
          <div className="plugin-installation-list">
            {plugin.installations.map(installation => (
              <div className="plugin-installation-card" key={installation.key}>
                <span className="plugin-installation-main">
                  <strong>
                    {formatScope(installation.target.scope)} ·{' '}
                    {installation.installedVersion ?? '版本未知'}
                  </strong>
                  <em>{installation.packagePath}</em>
                </span>
                <small
                  className={
                    installation.materialization === 'present'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {formatMaterialization(installation.materialization)}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className="models-empty compact">没有安装实例。</div>
        )}
      </section>
    </div>
  )
}

function PluginCapabilities({ detail }: { detail: PluginDetailState }) {
  const manifest = getSelectedManifest(detail.record)
  const components = listManifestComponents(manifest)
  return (
    <div className="plugin-tab-content">
      <section className="plugin-detail-section">
        <div className="plugin-directory-head">
          <h3>组件明细</h3>
          <span>{components.length}</span>
        </div>
        {components.length ? (
          <div className="plugin-component-list">
            {components.map(component => (
              <details className="plugin-component-row" key={component.id}>
                <summary>
                  <span className="plugin-component-avatar">
                    <ComponentGlyph kind={component.kind} />
                  </span>
                  <span className="plugin-component-body">
                    <strong>{component.name}</strong>
                    <em>
                      {component.kindLabel}
                      {component.summary ? ` · ${component.summary}` : ''}
                    </em>
                  </span>
                  <small>{component.kindLabel}</small>
                </summary>
                <div className="plugin-component-detail">
                  <dl>
                    <div>
                      <dt>类型</dt>
                      <dd>{component.kindLabel}</dd>
                    </div>
                    <div>
                      <dt>名称</dt>
                      <dd>{component.name}</dd>
                    </div>
                    {component.source ? (
                      <div>
                        <dt>入口</dt>
                        <dd>{component.source}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <pre className="plugin-code-block">{component.raw}</pre>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="models-empty compact">manifest 未声明可展示组件。</div>
        )}
      </section>
      <section className="plugin-detail-section">
        <div className="plugin-directory-head">
          <h3>App 关系</h3>
          <span>{detail.apps.length}</span>
        </div>
        {detail.apps.length ? (
          <div className="plugin-record-list">
            {detail.apps.map(app => (
              <div
                className="plugin-record-row"
                key={`${app.appId}:${app.relation}`}
              >
                <span>
                  <strong>{app.displayName ?? app.appId}</strong>
                  <em>
                    {formatAppRelation(app.relation)} · {app.appId}
                  </em>
                </span>
                <small className={app.state === 'connected' ? 'success' : ''}>
                  {formatAppState(app.state)}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className="models-empty compact">没有声明 App 关系。</div>
        )}
      </section>
    </div>
  )
}

function PluginRuntime({ detail }: { detail: PluginDetailState }) {
  const runtimeActive = detail.record.effectiveSelection?.active === true
  const activations = runtimeActive ? detail.record.runtimeActivations : []
  const activeVersion = getActiveVersion(detail.record) ?? '未激活'
  const pendingActivation = detail.record.effectiveSelection?.pendingActivation
  const manifestComponents = listManifestComponents(
    getSelectedManifest(detail.record),
  )
  return (
    <div className="plugin-tab-content plugin-runtime-content">
      {activations.length ? (
        activations.map(activation => (
          <section
            className="plugin-runtime-card"
            key={`${activation.runtimeInstanceId}:${activation.activationRevision}`}
          >
            <div className="plugin-runtime-card-head">
              <span className="plugin-runtime-title">
                <strong>{activation.runtimeInstanceId}</strong>
                <em>
                  运行时实例 · {activeVersion} · {activation.components.length} 项组件
                </em>
              </span>
              <span className="plugin-runtime-status-group">
                <small
                  className={
                    activation.state === 'active' ? 'success' : 'warning'
                  }
                >
                  {formatRuntimeActivationState(activation.state)}
                </small>
                {pendingActivation ? (
                  <small className="warning">待刷新</small>
                ) : null}
              </span>
            </div>
            <div className="plugin-runtime-component-list">
              {activation.components.length ? (
                activation.components.map(component => {
                  const componentKind = runtimeComponentKind(component.component)
                  const details = manifestComponents.filter(
                    item => item.kind === componentKind,
                  )
                  const componentTitle = formatRuntimeComponentTitle(
                    component.component,
                    details,
                  )
                  const componentSummary =
                    component.diagnostic ?? formatRuntimeComponentSummary(details)
                  return (
                    <div
                      className="plugin-runtime-component-row"
                      key={`${activation.activationRevision}:${component.component}`}
                    >
                      <span className="plugin-component-avatar">
                        <ComponentGlyph kind={componentKind} />
                      </span>
                      <span className="plugin-runtime-component-body">
                        <strong>{componentTitle}</strong>
                        {componentSummary ? <em>{componentSummary}</em> : null}
                      </span>
                      <small
                        className={
                          component.state === 'active' ? 'success' : 'warning'
                        }
                      >
                        {formatComponentState(component.state)}
                      </small>
                    </div>
                  )
                })
              ) : (
                <div className="models-empty compact">没有组件级运行快照。</div>
              )}
            </div>
          </section>
        ))
      ) : (
        <div className="models-empty compact">
          {detail.record.effectiveSelection?.enabled
            ? '当前运行时尚未激活此 Plugin。'
            : 'Plugin 已停用，子组件不会进入运行时。'}
        </div>
      )}
    </div>
  )
}

function PluginConfiguration({ detail }: { detail: PluginDetailState }) {
  const configuration = detail.configuration
  if (!configuration) {
    return (
      <div className="models-empty compact">
        受管理或纯运行时 Plugin 没有可编辑配置作用域。
      </div>
    )
  }
  return (
    <div className="plugin-tab-content plugin-configuration-content">
      <div className="plugin-fact-grid plugin-configuration-grid">
        <PluginFact
          label="配置作用域"
          value={formatScope(configuration.identity.scope)}
        />
        <PluginFact
          label="配置层数"
          value={String(configuration.layers.length)}
        />
        <PluginFact
          label="敏感配置"
          value={configuration.secretStatus.configured ? '已配置' : '未配置'}
        />
        <PluginFact
          label="数据目录"
          value={configuration.data.exists ? '已创建' : '未创建'}
        />
      </div>
      <section className="plugin-detail-section">
        <div className="plugin-section-head">
          <h3>有效配置</h3>
          <span>{Object.keys(configuration.effectiveOptions).length} 项</span>
        </div>
        {Object.keys(configuration.effectiveOptions).length ? (
          <pre className="plugin-code-block">
            {JSON.stringify(configuration.effectiveOptions, null, 2)}
          </pre>
        ) : (
          <div className="models-empty compact">没有有效配置。</div>
        )}
      </section>
      <section className="plugin-detail-section">
        <div className="plugin-section-head">
          <h3>配置来源</h3>
          <span>{configuration.layers.length}</span>
        </div>
        <div className="plugin-config-layer-list">
          {configuration.layers.map(layer => (
            <div className="plugin-config-layer-row" key={layer.path}>
              <span>
                <strong>{formatScope(layer.scope)}</strong>
                <em>{layer.path}</em>
              </span>
              <small>{Object.keys(layer.values).length} 项</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function PluginDependencies(props: {
  detail: PluginDetailState
  onRollback: (version: string) => void
}) {
  const { detail } = props
  const plugin = detail.record
  const candidate = getUpdateCandidate(plugin)
  return (
    <div className="plugin-tab-content">
      <div className="plugin-fact-grid">
        <PluginFact
          label="直接依赖"
          value={String(plugin.dependencies.directDependencies.length)}
        />
        <PluginFact
          label="传递依赖"
          value={String(plugin.dependencies.transitiveDependencies.length)}
        />
        <PluginFact
          label="反向依赖"
          value={String(plugin.dependencies.reverseDependents.length)}
        />
        <PluginFact
          label="版本规则"
          value={
            plugin.dependencies.semverSupport === 'exact-version-only'
              ? '仅精确版本'
              : plugin.dependencies.semverSupport
          }
        />
      </div>
      <PluginStringList
        empty="没有直接依赖。"
        items={plugin.dependencies.directDependencies}
        title="直接依赖"
      />
      <PluginStringList
        empty="没有其他 Plugin 依赖它。"
        items={plugin.dependencies.reverseDependents}
        title="反向依赖"
      />
      <section className="plugin-detail-section">
        <div className="plugin-directory-head">
          <h3>版本</h3>
          <span>{plugin.rollbackVersions.length} 个回滚候选</span>
        </div>
        <div className="plugin-version-strip">
          <VersionBadge
            label="已安装"
            value={getInstalledVersion(plugin) ?? '未知'}
          />
          <VersionBadge
            label="运行中"
            value={getActiveVersion(plugin) ?? '未激活'}
          />
          <VersionBadge
            label="候选"
            value={candidate?.version ?? '无更新'}
          />
        </div>
        {plugin.rollbackVersions.length ? (
          <div className="plugin-record-list">
            {plugin.rollbackVersions.map(version => (
              <div className="plugin-record-row" key={version.retentionId}>
                <span>
                  <strong>{version.version}</strong>
                  <em>保留至 {formatDateTime(version.expiresAt)}</em>
                </span>
                <button
                  className="ghost-action compact"
                  type="button"
                  onClick={() => props.onRollback(version.version)}
                >
                  回滚
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="models-empty compact">当前没有有效回滚候选。</div>
        )}
      </section>
    </div>
  )
}

function PluginSecurity({ detail }: { detail: PluginDetailState }) {
  const plugin = detail.record
  const manifest = getSelectedManifest(plugin)
  const candidate = plugin.candidates[0]
  return (
    <div className="plugin-tab-content">
      <div className="plugin-fact-grid">
        <PluginFact
          label="来源类型"
          value={candidate ? formatSourceKind(candidate.sourceKind) : '本地安装'}
        />
        <PluginFact label="来源标识" value={candidate?.sourceId ?? '无'} />
        <PluginFact
          label="来源路径"
          value={candidate?.marketplacePath ?? '未关联'}
        />
        <PluginFact
          label="严格校验"
          value={candidate?.strict === false ? '否' : '是'}
        />
        <PluginFact
          label="作者"
          value={formatAuthor(manifest?.author) ?? '未声明'}
        />
        <PluginFact label="License" value={manifest?.license ?? '未声明'} />
      </div>
      {plugin.dependencies.crossMarketplaceEdges.length ? (
        <section className="plugin-detail-section">
          <div className="plugin-directory-head">
            <h3>跨来源边界</h3>
            <span>{plugin.dependencies.crossMarketplaceEdges.length}</span>
          </div>
          <div className="plugin-record-list">
            {plugin.dependencies.crossMarketplaceEdges.map(edge => (
              <div
                className="plugin-record-row"
                key={`${edge.from}:${edge.to}`}
              >
                <span>
                  <strong>{edge.from}</strong>
                  <em>{edge.to}</em>
                </span>
                <small className={edge.trusted ? 'success' : 'warning'}>
                  {edge.trusted ? '已信任' : '未信任'}
                </small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function PluginDiagnostics({ detail }: { detail: PluginDetailState }) {
  const diagnostics = [
    ...detail.record.diagnostics,
    ...(detail.configuration?.diagnostics ?? []),
  ]
  return diagnostics.length ? (
    <div className="plugin-tab-content">
      <div className="plugin-diagnostic-list">
        {diagnostics.map((diagnostic, index) => (
          <div
            className={`plugin-diagnostic-row ${diagnostic.severity}`}
            key={`${diagnostic.code}:${diagnostic.path ?? ''}:${index}`}
          >
            <strong>{diagnostic.code}</strong>
            <span>{diagnostic.message}</span>
            <em>
              {diagnostic.layer}
              {diagnostic.path ? ` · ${diagnostic.path}` : ''}
            </em>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="models-empty compact">没有 Plugin 诊断。</div>
  )
}

function PluginPlanDialog(props: {
  plan: PluginActionPlanState
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="plugin-modal-backdrop" role="presentation">
      <div
        aria-label="Plugin 操作确认"
        aria-modal="true"
        className="plugin-action-dialog"
        role="dialog"
      >
        <PluginPlanPanel
          plan={props.plan}
          onCancel={props.onCancel}
          onConfirm={props.onConfirm}
        />
      </div>
    </div>
  )
}

function PluginPlanPanel(props: {
  plan: PluginActionPlanState
  onConfirm: () => void
  onCancel: () => void
}) {
  const rootPackage = props.plan.install?.packages.find(
    item => item.pluginId === props.plan.target.pluginId,
  )
  const configuration = Object.entries(rootPackage?.manifest?.userConfig ?? {})
  const apps = rootPackage?.manifest?.ccr?.apps ?? []
  return (
    <section className="plugin-operation-card warning">
      <div className="plugin-operation-head">
        <span>
          <strong>{formatAction(props.plan.action)}计划</strong>
          <em>{props.plan.target.pluginId}</em>
        </span>
        <small>{props.plan.allowed ? '待确认' : '已阻止'}</small>
      </div>
      {props.plan.blockedReason ? (
        <p>{props.plan.blockedReason}</p>
      ) : (
        <>
          <div className="plugin-plan-columns">
            <PluginStringList
              empty="没有附加影响。"
              items={props.plan.effects.map(effect =>
                formatPlanEffect(effect.kind, effect.description),
              )}
              title="将执行"
            />
            <PluginStringList
              empty="没有额外风险。"
              items={props.plan.risks.map(formatPlanRisk)}
              title="风险"
            />
          </div>
          {props.plan.install ? (
            <>
              <div className="plugin-fact-grid compact">
                <PluginFact
                  label="来源"
                  value={rootPackage?.sourceId ?? props.plan.target.sourceId ?? '未知'}
                />
                <PluginFact
                  label="作用域"
                  value={formatScope(props.plan.target.scope)}
                />
                <PluginFact
                  label="依赖闭包"
                  value={`${props.plan.install.packages.length} 个包`}
                />
                <PluginFact
                  label="安装后启用"
                  value={props.plan.install.enableAfterInstall ? '是' : '否'}
                />
                <PluginFact label="当前会话激活" value="否" />
                <PluginFact
                  label="目标版本"
                  value={rootPackage?.version ?? '未声明'}
                />
              </div>
              <div className="plugin-plan-columns">
                <PluginStringList
                  empty="没有附加配置。"
                  items={configuration.map(([key, option]) =>
                    `${option.title} (${key}) · ${
                      option.sensitive
                        ? '敏感'
                        : option.required
                          ? '必填'
                          : '可选'
                    }`,
                  )}
                  title="配置"
                />
                <PluginStringList
                  empty="没有 App 关系。"
                  items={apps.map(
                    app =>
                      `${app.displayName ?? app.id} · ${formatAppRelation(app.relation)}`,
                  )}
                  title="App"
                />
              </div>
            </>
          ) : null}
          {props.plan.dependencies.reverseDependents.length ? (
            <div className="plugin-callout warning">
              反向依赖：
              {props.plan.dependencies.reverseDependents.join('、')}
            </div>
          ) : null}
        </>
      )}
      <div className="plugin-operation-actions">
        <button className="ghost-action" type="button" onClick={props.onCancel}>
          取消
        </button>
        {props.plan.allowed ? (
          <button
            className="primary-action"
            type="button"
            onClick={props.onConfirm}
          >
            确认{formatAction(props.plan.action)}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function PluginStringList(props: {
  title: string
  items: string[]
  empty: string
}) {
  return (
    <section className="plugin-detail-section">
      <div className="plugin-directory-head">
        <h3>{props.title}</h3>
        <span>{props.items.length}</span>
      </div>
      {props.items.length ? (
        <ul className="plugin-simple-list">
          {props.items.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="models-empty compact">{props.empty}</div>
      )}
    </section>
  )
}

function PluginFact(props: { label: string; value: string }) {
  return (
    <div className="plugin-fact">
      <span>{props.label}</span>
      <strong title={props.value}>{props.value}</strong>
    </div>
  )
}

function VersionBadge(props: { label: string; value: string }) {
  return (
    <div className="plugin-version-badge">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function PluginAvatar(props: {
  plugin: PluginManagementItem
  large?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`plugin-avatar ${props.large ? 'large' : ''}`}
    >
      <PluginGlyph />
    </span>
  )
}

function IconAction(props: {
  label: string
  icon: ReactNode
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-label={props.label}
      className={`icon-action ${props.danger ? 'danger' : ''}`}
      disabled={props.disabled}
      title={props.label}
      type="button"
      onClick={props.onClick}
    >
      {props.icon}
    </button>
  )
}

function isLocallyManagedPlugin(plugin: PluginManagementItem): boolean {
  return (
    plugin.installations.length > 0 ||
    plugin.runtimeActivations.length > 0 ||
    plugin.derivedState.installed ||
    plugin.derivedState.enabled ||
    plugin.intents.some(intent => intent.intent !== 'unset')
  )
}

function isBuiltInPlugin(plugin: PluginManagementItem): boolean {
  return (
    plugin.installations.some(
      installation => installation.target.scope === 'managed',
    ) ||
    plugin.candidates.some(
      candidate =>
        candidate.sourceKind === 'builtin' || candidate.sourceKind === 'managed',
    )
  )
}

function matchesPluginQuery(
  plugin: PluginManagementItem,
  query: string,
): boolean {
  if (!query) return true
  return [
    plugin.pluginId,
    plugin.displayName,
    plugin.description,
    ...plugin.installations.map(item => item.packagePath),
  ].some(value => value.toLocaleLowerCase().includes(query))
}

function getActionTarget(
  plugin: PluginManagementItem,
): PluginInstallationTarget | null {
  return (
    plugin.effectiveSelection?.target ??
    plugin.installations.find(installation => installation.applicableToRequest)
      ?.target ??
    plugin.installations[0]?.target ??
    null
  )
}

function getInstalledVersion(plugin: PluginManagementItem): string | undefined {
  const key = plugin.effectiveSelection?.installationKey
  return (
    plugin.installations.find(installation => installation.key === key)
      ?.installedVersion ??
    plugin.installations.find(installation => installation.applicableToRequest)
      ?.installedVersion ??
    plugin.installations[0]?.installedVersion
  )
}

function getActiveVersion(plugin: PluginManagementItem): string | undefined {
  if (plugin.effectiveSelection?.active !== true) return undefined
  return plugin.runtimeActivations.find(
    activation =>
      activation.state === 'active' || activation.state === 'partial',
  )?.activeVersion
}

function getUpdateCandidate(plugin: PluginManagementItem) {
  const installedVersion = getInstalledVersion(plugin)
  if (!plugin.derivedState.updateAvailable) return undefined
  return plugin.candidates.find(
    candidate =>
      candidate.version && candidate.version !== installedVersion,
  )
}

function isPluginOperationBusy(operation: PluginOperationState | null): boolean {
  return (
    operation !== null &&
    operation.status !== 'succeeded' &&
    operation.status !== 'failed' &&
    operation.status !== 'cancelled'
  )
}

function pluginImportPlaceholder(type: PluginImportKind): string {
  return type === 'directory'
    ? 'D:\\plugins\\my-plugin'
    : 'D:\\plugins\\my-plugin.zip'
}

function getPluginSourcePathPicker(type: PluginImportKind) {
  switch (type) {
    case 'directory':
      return {
        mode: 'directory' as const,
        title: '选择 Plugin 文件夹',
        buttonLabel: '选择文件夹',
      }
    case 'archive':
      return {
        mode: 'file' as const,
        title: '选择 Plugin 压缩包',
        buttonLabel: '选择压缩包',
        filters: [
          { name: 'Plugin 压缩包', extensions: ['zip'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      }
  }
}

function getSelectedManifest(plugin: PluginManagementItem) {
  const key = plugin.effectiveSelection?.installationKey
  return (
    plugin.installations.find(installation => installation.key === key)
      ?.manifest ??
    plugin.installations.find(installation => installation.applicableToRequest)
      ?.manifest ??
    plugin.candidates[0]?.manifest
  )
}

function listManifestComponents(
  manifest: ReturnType<typeof getSelectedManifest>,
): PluginComponentDetail[] {
  if (!manifest) return []
  return [
    ...componentDetails('command', 'Command', manifest.commands),
    ...componentDetails('agent', 'Agent', manifest.agents),
    ...componentDetails('skill', 'Skill', manifest.skills),
    ...componentDetails('hook', 'Hook', manifest.hooks),
    ...componentDetails('mcp', 'MCP Server', manifest.mcpServers),
    ...componentDetails('lsp', 'LSP Server', manifest.lspServers),
    ...componentDetails('channel', 'Channel', manifest.channels),
    ...componentDetails('output-style', '输出样式', manifest.outputStyles),
  ]
}

function componentDetails(
  kind: PluginComponentKind,
  kindLabel: string,
  value: unknown,
): PluginComponentDetail[] {
  if (value === undefined || value === null) return []
  if (typeof value === 'string') {
    return [createComponentDetail(kind, kindLabel, value, value, 0)]
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      createComponentDetail(kind, kindLabel, item, undefined, index),
    )
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, item], index) =>
      createComponentDetail(kind, kindLabel, item, key, index),
    )
  }
  return [createComponentDetail(kind, kindLabel, value, undefined, 0)]
}

function createComponentDetail(
  kind: PluginComponentKind,
  kindLabel: string,
  value: unknown,
  source: string | undefined,
  index: number,
): PluginComponentDetail {
  const explicitName =
    typeof value === 'string' ? undefined : getComponentExplicitName(value)
  const fallbackSource =
    source ?? (typeof value === 'string' ? value : undefined)
  const sourceName = deriveComponentName(fallbackSource)
  const derivedName =
    typeof value === 'string' ? undefined : getComponentDisplayName(value)
  const preferSourceName =
    kind === 'mcp' || kind === 'lsp' ? sourceName : undefined
  const name =
    explicitName ??
    preferSourceName ??
    derivedName ??
    sourceName ??
    `${kindLabel} ${index + 1}`
  const summary = fallbackSource ?? getComponentSummary(value) ?? 'manifest 已声明'
  return {
    id: `${kind}:${source ?? name}:${index}`,
    kind,
    kindLabel,
    name,
    summary,
    source: fallbackSource,
    raw: formatComponentRaw(value),
  }
}

function getComponentSummary(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return undefined
  for (const key of ['description', 'path', 'command', 'entry', 'source']) {
    if (key in value) {
      const nextValue = (value as Record<string, unknown>)[key]
      if (typeof nextValue === 'string' && nextValue.trim()) {
        return nextValue.trim()
      }
    }
  }
  return undefined
}

function deriveComponentName(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const normalized = trimmed.replace(/\\/g, '/').replace(/\/+$/, '')
  const lastSegment = normalized.split('/').filter(Boolean).pop()
  if (lastSegment) {
    return lastSegment.replace(/\.(md|json|js|mjs|ts|tsx)$/i, '')
  }
  return trimmed
}

function formatComponentRaw(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? ''
  } catch {
    return String(value)
  }
}

function getComponentExplicitName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  for (const key of ['name', 'id', 'title']) {
    if (key in value) {
      const nextValue = (value as Record<string, unknown>)[key]
      if (typeof nextValue === 'string' && nextValue.trim()) {
        return nextValue.trim()
      }
    }
  }
  return undefined
}

function getComponentDisplayName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const explicitName = getComponentExplicitName(value)
  if (explicitName) return explicitName
  for (const key of ['path', 'source', 'entry']) {
    if (key in value) {
      const nextValue = (value as Record<string, unknown>)[key]
      if (typeof nextValue === 'string' && nextValue.trim()) {
        return deriveComponentName(nextValue.trim())
      }
    }
  }
  if ('command' in value) {
    const command = (value as Record<string, unknown>).command
    if (typeof command === 'string' && command.trim()) {
      return command.trim()
    }
  }
  return undefined
}

function formatPluginStatus(
  status: PluginManagementItem['derivedState']['status'],
): string {
  const labels: Record<typeof status, string> = {
    available: '可安装',
    'installed-disabled': '已停用',
    'enabled-pending-activation': '待刷新',
    active: '运行中',
    'active-partial': '部分运行',
    'restart-required': '需重启',
    missing: '缺包',
    invalid: '无效',
    failed: '失败',
  }
  return labels[status]
}

function formatScope(scope: string): string {
  const labels: Record<string, string> = {
    managed: '受管理',
    user: '用户',
    project: '项目',
    local: '本地',
  }
  return labels[scope] ?? scope
}

function formatMaterialization(value: string): string {
  const labels: Record<string, string> = {
    present: '完整',
    missing: '缺失',
    drifted: '已漂移',
    invalid: '无效',
  }
  return labels[value] ?? value
}

function formatAction(action: PluginAction): string {
  const labels: Record<PluginAction, string> = {
    install: '安装',
    enable: '启用',
    disable: '停用',
    uninstall: '卸载',
    update: '更新',
    rollback: '回滚',
    repair: '修复',
  }
  return labels[action]
}

function formatPlanRisk(value: string): string {
  const labels: Record<string, string> = {
    'downloads-or-copies-code': '下载或复制可执行代码',
    'changes-installation-registry': '修改安装记录',
    'changes-settings-intent': '修改作用域启用意图',
    'changes-runtime-capabilities': '改变当前运行时能力',
    'removes-runtime-capabilities': '移除当前运行时能力',
    'removes-installation': '删除安装实例',
    'may-remove-user-data': '可能删除用户数据',
    'changes-installed-version': '切换已安装版本',
    'replaces-installed-package': '替换现有包内容',
  }
  return labels[value] ?? value
}

function formatPlanEffect(kind: string, fallback: string): string {
  const labels: Record<string, string> = {
    'materialize-package': '物化并校验 Plugin 包',
    'write-installation': '写入目标作用域安装记录',
    'write-intent': '写入目标作用域启用意图',
    'remove-installation': '删除目标作用域安装记录',
    'remove-package-reference': '释放包版本引用',
    'remove-options': '删除 Plugin 普通配置',
    'remove-secrets': '删除 Plugin 敏感配置',
    'remove-data': '删除 Plugin 持久化数据',
    'request-runtime-activation': '请求运行时激活',
    'request-runtime-deactivation': '请求运行时停用',
  }
  return labels[kind] ?? fallback
}

function isTerminalOperation(operation: PluginOperationState): boolean {
  return (
    operation.status === 'succeeded' ||
    operation.status === 'failed' ||
    operation.status === 'cancelled'
  )
}

function getTerminalOperationFeedback(
  operation: PluginOperationState,
): string | null {
  if (operation.status === 'failed') {
    return `${formatAction(operation.action)}失败：${
      operation.error?.message ?? operation.phase
    }`
  }
  if (operation.status === 'cancelled') {
    return `${formatAction(operation.action)}已取消。`
  }
  return null
}

function formatSourceKind(value: string): string {
  const labels: Record<string, string> = {
    marketplace: '候选来源',
    builtin: '内置',
    inline: '会话内联',
    managed: '受管理',
    runtime: '运行时',
  }
  return labels[value] ?? value
}

function formatAppRelation(value: string): string {
  const labels: Record<string, string> = {
    provides: '提供',
    requires: '依赖',
    suggests: '建议',
    configures: '配置',
  }
  return labels[value] ?? value
}

function formatAppState(value: string): string {
  const labels: Record<string, string> = {
    unregistered: '未注册',
    connected: '已连接',
    'needs-auth': '需授权',
    disabled: '已停用',
    disconnected: '未连接',
  }
  return labels[value] ?? value
}

function formatComponentName(value: string): string {
  const labels: Record<string, string> = {
    command: 'Command',
    agent: 'Agent',
    skill: 'Skill',
    hook: 'Hook',
    mcp: 'MCP',
    lsp: 'LSP',
    channel: 'Channel',
    'output-style': 'Output Style',
  }
  return labels[value] ?? value
}

function formatRuntimeComponentTitle(
  component: string,
  details: PluginComponentDetail[],
): string {
  if (details.length === 1) {
    return details[0].name
  }
  return formatComponentName(component)
}

function formatRuntimeComponentSummary(
  details: PluginComponentDetail[],
): string | undefined {
  if (details.length === 0) return undefined
  if (details.length === 1) {
    const detail = details[0]
    return detail.summary && detail.summary !== detail.name
      ? `${detail.kindLabel} · ${detail.summary}`
      : detail.kindLabel
  }
  return `${details[0].kindLabel} · ${details.length} 项`
}

function runtimeComponentKind(value: string): PluginComponentKind {
  const kinds: PluginComponentKind[] = [
    'command',
    'agent',
    'skill',
    'hook',
    'mcp',
    'lsp',
    'channel',
    'output-style',
  ]
  return kinds.includes(value as PluginComponentKind)
    ? (value as PluginComponentKind)
    : 'command'
}

function formatComponentState(value: string): string {
  const labels: Record<string, string> = {
    inactive: '未激活',
    active: '已激活',
    failed: '失败',
    'restart-required': '需重启',
  }
  return labels[value] ?? value
}

function formatRuntimeActivationState(value: string): string {
  const labels: Record<string, string> = {
    inactive: '未激活',
    activating: '激活中',
    active: '运行中',
    partial: '部分运行',
    failed: '失败',
  }
  return labels[value] ?? value
}

function formatAuthor(author: unknown): string | undefined {
  if (typeof author === 'string') return author
  if (author && typeof author === 'object' && 'name' in author) {
    return typeof author.name === 'string' ? author.name : undefined
  }
  return undefined
}

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(timestamp)
    : value
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return cleanupPluginErrorMessage(message)
}

function cleanupPluginErrorMessage(message: string): string {
  let cleaned = message.trim()
  cleaned = cleaned.replace(
    /^Error invoking remote method '[^']+':\s*/,
    '',
  )
  cleaned = cleaned.replace(/^AppServerClientError:\s*/, '')
  return cleaned || '操作失败。'
}

function PluginGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 8.5 12 5l5 3.5v7L12 19l-5-3.5v-7Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m7.5 9 4.5 3 4.5-3M12 12v6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ComponentGlyph({ kind }: { kind: PluginComponentKind }) {
  if (kind === 'skill') {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="m12 4 1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    )
  }
  if (kind === 'mcp' || kind === 'lsp') {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M8 8h8M8 16h8M8 8v8m8-8v8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="8" cy="16" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="16" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }
  if (kind === 'command') {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="m6 8 4 4-4 4M12 16h6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 10h6M9 14h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function RefreshGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M20 7v5h-5M4 17v-5h5m9.1-3A7 7 0 0 0 6.4 6.4L4 9m16 6-2.4 2.6A7 7 0 0 1 5.9 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function RepairGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.6 2.6-3-3 2.6-2.6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function TrashGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 13H7L6 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function UpdateGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}
