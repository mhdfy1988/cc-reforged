import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { DetailTabs, type DetailTabOption } from '../common/DetailTabs.js'
import { IconActionButton } from '../common/IconActionButton.js'
import { PageStatusNotice } from '../common/PageStatusNotice.js'
import {
  buildCcrMcpInstallManifestInput,
  type CcrMcpManifestTemplate,
} from '../../../../../../../src/services/mcp/installManifestBuilder.js'
import type {
  McpInstallCandidate,
  McpInstallListState,
  McpInstallPlanViewState,
  McpInstallRecord,
  McpInstallSearchState,
  McpInventoryServerSummary,
  McpListState,
  McpRuntimeToolSummary,
  McpServerSummary,
  McpTestState,
  McpWritableScope,
} from '../../domain/displayTypes.js'

export type McpServerView = McpServerSummary & {
  inventory?: McpInventoryServerSummary
  installed?: McpInstallRecord
}

const DEFAULT_MCP_INSTALL_SCOPE: McpWritableScope = 'user'

type McpDetailTab = 'overview' | 'tools' | 'diagnostics'

const MCP_DETAIL_TABS: Array<DetailTabOption<McpDetailTab>> = [
  { id: 'overview', label: '概览' },
  { id: 'tools', label: '工具' },
  { id: 'diagnostics', label: '诊断' },
]

type McpCreateDraft = {
  template: CcrMcpManifestTemplate
  name: string
  displayName: string
  description: string
  command: string
  argsText: string
  directory: string
  url: string
  packageName: string
  version: string
  envText: string
  headersText: string
}

const DEFAULT_MCP_CREATE_DRAFT: McpCreateDraft = {
  template: 'local-stdio',
  name: '',
  displayName: '',
  description: '',
  command: 'node',
  argsText: '',
  directory: '',
  url: 'http://127.0.0.1:3001/mcp',
  packageName: '',
  version: 'latest',
  envText: '',
  headersText: '',
}

export function McpPage(props: {
  busy: boolean
  error: string | null
  installPlan: McpInstallPlanViewState | null
  installSearch: McpInstallSearchState | null
  installs: McpInstallListState | null
  mcp: McpListState | null
  message: string | null
  testByName: Record<string, McpTestState>
  onApplyInstall: (planView: McpInstallPlanViewState) => void
  onCancelInstall: () => void
  onChangeInstallPlan: (planView: McpInstallPlanViewState) => void
  onAdopt: (name: string) => void
  onDisable: (name: string) => void
  onEnable: (name: string) => void
  onImportManifest: () => void
  onCreateManifest: (manifest: Record<string, unknown>) => boolean | void
  onPlanInstall: (candidate: McpInstallCandidate, scope: McpWritableScope) => void
  onRefresh: () => void
  onRepair: (record: McpInstallRecord) => void
  onRestart: (name: string) => void
  onSearchInstalls: (query: string) => void
  onTest: (name: string) => void
  onUninstall: (name: string) => void
}) {
  const [selectedName, setSelectedName] = useState('')
  const [installQuery, setInstallQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<McpCreateDraft>(
    DEFAULT_MCP_CREATE_DRAFT,
  )
  const [createError, setCreateError] = useState<string | null>(null)
  const mcp = normalizeMcpState(props.mcp)
  const servers = useMemo(
    () => mergeMcpServers(mcp, props.installs),
    [mcp, props.installs],
  )
  const selectedServer =
    servers.find(server => server.name === selectedName) ?? servers[0]
  const selectedTest = selectedServer ? props.testByName[selectedServer.name] : null
  const installedCount = props.installs?.installed?.length ?? 0
  const needsRepairCount = (props.installs?.installed ?? []).filter(
    record => record.configStatus?.needsRepair,
  ).length
  const enabledCount = servers.filter(server => server.enabled !== false).length
  const candidates = useMemo(
    () =>
      sortMcpInstallCandidates(
        props.installSearch?.candidates ?? [],
        servers,
        props.installs,
      ),
    [props.installSearch?.candidates, props.installs, servers],
  )

  useEffect(() => {
    if (servers.length === 0) {
      setSelectedName('')
      return
    }
    if (!servers.some(server => server.name === selectedName)) {
      setSelectedName(servers[0]!.name)
    }
  }, [selectedName, servers])

  return (
    <section className="mcp-page page-panel workbench-main">
      <div className="mcp-page-title models-page-title">
        <div>
          <h2>MCP 管理</h2>
          <span>
            {servers.length} 个 server · {enabledCount} 个启用 · {installedCount} 个安装记录
            {needsRepairCount > 0 ? ` · ${needsRepairCount} 个需修复` : ''}
          </span>
        </div>
        <div className="models-title-actions">
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={props.onImportManifest}
          >
            导入 MCP 配置
          </button>
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={() => {
              setCreateOpen(true)
              setCreateError(null)
            }}
          >
            新建 MCP 配置
          </button>
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={props.onRefresh}
          >
            刷新
          </button>
        </div>
      </div>

      <PageStatusNotice
        autoDismiss={!props.error}
        message={props.error ?? props.message}
        tone={props.error ? 'error' : 'success'}
      />

      <div className="mcp-workspace">
        <aside className="mcp-server-column" aria-label="MCP servers">
          <div className="models-column-head">
            <strong>Server</strong>
            <span>{servers.length}</span>
          </div>
          <div className="mcp-server-list">
            {servers.length > 0 ? (
              servers.map(server => {
                const serverEnabled = server.enabled !== false
                return (
                  <div
                    className={
                      server.name === selectedServer?.name
                        ? 'mcp-server-item active'
                        : 'mcp-server-item'
                    }
                    key={server.name}
                  >
                    <button
                      className="mcp-server-main"
                      type="button"
                      onClick={() => setSelectedName(server.name)}
                    >
                      <span>
                        <strong>{server.name}</strong>
                        <em>{formatServerSubtitle(server)}</em>
                      </span>
                    </button>
                    <div className="mcp-server-item-foot">
                      <div className="mcp-tags">
                        <small>
                          {server.installKind ??
                            server.inventory?.installKind ??
                            'manual'}
                        </small>
                      </div>
                      <label className="mcp-list-toggle">
                        <input
                          checked={serverEnabled}
                          disabled={props.busy}
                          type="checkbox"
                          onChange={event =>
                            event.target.checked
                              ? props.onEnable(server.name)
                              : props.onDisable(server.name)
                          }
                        />
                        <i aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="models-empty">暂无 MCP server。</div>
            )}
          </div>
        </aside>

        <div className="mcp-detail">
          {selectedServer ? (
            <McpServerDetail
              busy={props.busy}
              server={selectedServer}
              test={selectedTest ?? null}
              onAdopt={props.onAdopt}
              onRepair={props.onRepair}
              onRestart={props.onRestart}
              onTest={props.onTest}
              onUninstall={props.onUninstall}
            />
          ) : (
            <div className="models-empty">选择一个 MCP server 查看详情。</div>
          )}
        </div>

        <aside className="mcp-install-column" aria-label="MCP install">
          <section className="mcp-install-section">
            <div className="models-section-head">
              <div>
                <h3>安装</h3>
                <span>{candidates.length} 个候选</span>
              </div>
            </div>
            <div className="mcp-install-search">
              <input
                disabled={props.busy}
                placeholder="搜索 MCP"
                value={installQuery}
                onChange={event => setInstallQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    props.onSearchInstalls(installQuery)
                  }
                }}
              />
              <IconActionButton
                disabled={props.busy}
                icon="search"
                label="搜索"
                onClick={() => props.onSearchInstalls(installQuery)}
              />
            </div>
            <div className="mcp-install-scroll">
              <div className="mcp-candidate-list">
                {candidates.length > 0 ? (
                  candidates.map(candidate => {
                    const installState = getCandidateInstallState(
                      candidate,
                      servers,
                      props.installs,
                    )
                    return (
                      <div
                        className={
                          installState.blocked
                            ? 'mcp-candidate-item blocked'
                            : 'mcp-candidate-item'
                        }
                        key={getCandidateKey(candidate)}
                      >
                        <div className="mcp-candidate-main">
                          <span>
                            <strong>
                              {candidate.displayName ??
                                candidate.manifest?.name ??
                                '未命名 MCP'}
                            </strong>
                            <em>
                              {installState.blocked
                                ? installState.message
                                : formatCandidateSummary(candidate)}
                            </em>
                          </span>
                        </div>
                        <button
                          className="ghost-action"
                          disabled={
                            props.busy ||
                            !candidate.manifestInput ||
                            installState.blocked
                          }
                          title={installState.message || undefined}
                          type="button"
                          onClick={() =>
                            props.onPlanInstall(
                              candidate,
                              DEFAULT_MCP_INSTALL_SCOPE,
                            )
                          }
                        >
                          {installState.label}
                        </button>
                      </div>
                    )
                  })
                ) : (
                  <div className="models-empty">暂无可安装候选。</div>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {createOpen ? (
        <McpCreateManifestDialog
          busy={props.busy}
          draft={createDraft}
          error={createError}
          onCancel={() => setCreateOpen(false)}
          onChange={patch => {
            setCreateDraft(current => ({ ...current, ...patch }))
            setCreateError(null)
          }}
          onCreate={() => {
            try {
              const manifest = buildCcrMcpInstallManifestInput(createDraft)
              setCreateError(null)
              const accepted = props.onCreateManifest(
                manifest as Record<string, unknown>,
              )
              if (accepted !== false) {
                setCreateOpen(false)
              }
            } catch (error) {
              setCreateError(
                error instanceof Error ? error.message : String(error),
              )
            }
          }}
        />
      ) : null}

      {props.installPlan ? (
        <McpInstallConfirmDialog
          busy={props.busy}
          planView={props.installPlan}
          onApply={props.onApplyInstall}
          onChange={props.onChangeInstallPlan}
          onCancel={props.onCancelInstall}
        />
      ) : null}
    </section>
  )
}

function McpServerDetail(props: {
  busy: boolean
  server: McpServerView
  test: McpTestState | null
  onAdopt: (name: string) => void
  onRepair: (record: McpInstallRecord) => void
  onRestart: (name: string) => void
  onTest: (name: string) => void
  onUninstall: (name: string) => void
}) {
  const server = props.server
  const tools = props.test?.tools ?? server.tools ?? []
  const canAdopt = isMcpServerAdoptable(server)
  const [activeTab, setActiveTab] = useState<McpDetailTab>('overview')

  useEffect(() => {
    setActiveTab('overview')
  }, [server.name])

  return (
    <>
      <div className="detail-fixed">
        <div className="models-detail-head">
          <div>
            <h3>{server.name}</h3>
            <span>{formatServerSubtitle(server)}</span>
            <div className="mcp-tags detail-status-tags">
              <small className={getMcpTestTone(props.test)}>
                检测：{formatMcpTestStatusLabel(props.test)}
              </small>
            </div>
          </div>
          <div className="models-actions">
            <IconActionButton
              disabled={props.busy}
              icon="activity"
              label="检测"
              onClick={() => props.onTest(server.name)}
            />
            <IconActionButton
              disabled={props.busy}
              icon="rotate"
              label="重启"
              onClick={() => props.onRestart(server.name)}
            />
            {canAdopt ? (
              <button
                className="ghost-action"
                disabled={props.busy}
                type="button"
                onClick={() => props.onAdopt(server.name)}
              >
                接管
              </button>
            ) : null}
            {server.installed?.configStatus?.needsRepair ? (
              <IconActionButton
                disabled={props.busy}
                icon="wrench"
                label="修复"
                onClick={() => props.onRepair(server.installed!)}
              />
            ) : null}
            {server.installed?.name ? (
              <IconActionButton
                danger
                disabled={props.busy}
                icon="trash"
                label="卸载"
                onClick={() => props.onUninstall(server.installed!.name!)}
              />
            ) : null}
          </div>
        </div>

        <DetailTabs<McpDetailTab>
          activeTab={activeTab}
          ariaLabel="MCP 详情"
          tabs={MCP_DETAIL_TABS}
          onChange={setActiveTab}
        />
      </div>

      <div className="models-detail-body">
        {activeTab === 'overview' ? (
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>概览</h3>
                <span>{getServerStatusLabel(server)}</span>
              </div>
            </div>
            <dl className="models-facts">
              <McpFactItem label="范围" value={formatMcpScopeLabel(server.scope ?? server.inventory?.scope)} />
              <McpFactItem label="transport" value={server.transport ?? server.type ?? 'stdio'} />
              <McpFactItem label="来源" value={server.source ?? server.inventory?.sourceId ?? 'config'} />
              <McpFactItem label="安装类型" value={server.installKind ?? server.inventory?.installKind ?? 'manual-config'} />
              <McpFactItem label="安装状态" value={formatInstallRecordStatus(server.installed)} />
              <McpFactItem label="检测状态" value={formatMcpTestStatusLabel(props.test)} />
              <McpFactItem label="配置文件" value={server.inventory?.configPath ?? server.installed?.configPath ?? '无'} />
              <McpFactItem label="写入目标" value={server.inventory?.writePath ?? server.installed?.configPath ?? '只读'} />
              <McpFactItem label="命令" value={formatCommand(server)} />
              <McpFactItem label="URL" value={server.url ?? '无'} />
            </dl>
          </section>
        ) : null}

        {activeTab === 'tools' ? (
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>工具与资源</h3>
                <span>{tools.length} 个工具</span>
              </div>
            </div>
            {tools.length > 0 ? (
              <div className="mcp-tool-list">
                {tools.map(tool => (
                  <div className="mcp-tool-item" key={tool.name ?? JSON.stringify(tool)}>
                    <strong>{tool.name ?? '未命名工具'}</strong>
                    <span>{formatToolAnnotations(tool)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="models-empty">当前运行时未返回工具清单。</div>
            )}
          </section>
        ) : null}

        {activeTab === 'diagnostics' ? (
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>诊断</h3>
                <span>{props.test?.state ?? '未检测'}</span>
              </div>
            </div>
            {props.test ? (
              <dl className="models-facts compact">
                <McpFactItem label="结果" value={props.test.ok ? '可用' : '不可用'} />
                <McpFactItem label="状态" value={props.test.state ?? '未知'} />
                <McpFactItem label="检测" value={props.test.networkChecked ? '联网检测' : '本地判断'} />
                <McpFactItem label="说明" value={props.test.message ?? '无'} />
              </dl>
            ) : (
              <div className="models-empty">点击检测后展示诊断结果。</div>
            )}
          </section>
        ) : null}
      </div>
    </>
  )
}

function McpCreateManifestDialog(props: {
  busy: boolean
  draft: McpCreateDraft
  error: string | null
  onCancel: () => void
  onChange: (patch: Partial<McpCreateDraft>) => void
  onCreate: () => void
}) {
  const titleId = useId()

  return (
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={props.onCancel}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirm-dialog mcp-config-dialog"
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
      >
        <span className="confirm-dialog-marker" aria-hidden="true" />
        <div className="confirm-dialog-body">
          <header className="confirm-dialog-header">
            <strong id={titleId}>新建 MCP 配置</strong>
            <button
              aria-label="关闭"
              className="dialog-close-button"
              disabled={props.busy}
              title="关闭"
              type="button"
              onClick={props.onCancel}
            >
              ×
            </button>
          </header>
          <McpCreateManifestPanel
            busy={props.busy}
            draft={props.draft}
            error={props.error}
            onChange={props.onChange}
            onCreate={props.onCreate}
          />
        </div>
      </section>
    </div>
  )
}

function McpCreateManifestPanel(props: {
  busy: boolean
  draft: McpCreateDraft
  error: string | null
  onChange: (patch: Partial<McpCreateDraft>) => void
  onCreate: () => void
}) {
  const draft = props.draft
  const isHttp =
    draft.template === 'local-http' || draft.template === 'remote-http'
  const isStdio = draft.template === 'local-stdio'
  const isPackage = draft.template === 'stdio-npm-package'

  return (
    <div className="mcp-create-panel">
      <div className="mcp-create-grid">
        <label>
          类型
          <select
            disabled={props.busy}
            value={draft.template}
            onChange={event =>
              props.onChange({
                template: event.target.value as CcrMcpManifestTemplate,
              })
            }
          >
            <option value="local-stdio">本地 stdio</option>
            <option value="local-http">本地 HTTP</option>
            <option value="stdio-npm-package">npm 包</option>
            <option value="remote-http">远端 HTTP</option>
          </select>
        </label>
        <label>
          名称
          <input
            disabled={props.busy}
            placeholder="my-mcp"
            value={draft.name}
            onChange={event => props.onChange({ name: event.target.value })}
          />
        </label>
        <label>
          显示名
          <input
            disabled={props.busy}
            placeholder="我的 MCP"
            value={draft.displayName}
            onChange={event =>
              props.onChange({ displayName: event.target.value })
            }
          />
        </label>
        <label>
          说明
          <input
            disabled={props.busy}
            placeholder="用于..."
            value={draft.description}
            onChange={event =>
              props.onChange({ description: event.target.value })
            }
          />
        </label>
        {isStdio ? (
          <>
            <label>
              启动命令
              <input
                disabled={props.busy}
                placeholder="node"
                value={draft.command}
                onChange={event =>
                  props.onChange({ command: event.target.value })
                }
              />
            </label>
            <label>
              本地目录
              <input
                disabled={props.busy}
                placeholder="./my-mcp-server"
                value={draft.directory}
                onChange={event =>
                  props.onChange({ directory: event.target.value })
                }
              />
            </label>
          </>
        ) : null}
        {isPackage ? (
          <>
            <label>
              npm 包名
              <input
                disabled={props.busy}
                placeholder="@scope/package"
                value={draft.packageName}
                onChange={event =>
                  props.onChange({ packageName: event.target.value })
                }
              />
            </label>
            <label>
              版本
              <input
                disabled={props.busy}
                placeholder="latest"
                value={draft.version}
                onChange={event => props.onChange({ version: event.target.value })}
              />
            </label>
          </>
        ) : null}
        {isHttp ? (
          <label className="mcp-create-wide">
            URL
            <input
              disabled={props.busy}
              placeholder="http://127.0.0.1:3001/mcp"
              value={draft.url}
              onChange={event => props.onChange({ url: event.target.value })}
            />
          </label>
        ) : null}
        {(isStdio || isPackage) ? (
          <label className="mcp-create-wide">
            参数
            <textarea
              disabled={props.busy}
              placeholder="每行一个参数"
              value={draft.argsText}
              onChange={event =>
                props.onChange({ argsText: event.target.value })
              }
            />
          </label>
        ) : null}
        {isStdio ? (
          <label className="mcp-create-wide">
            环境变量
            <textarea
              disabled={props.busy}
              placeholder="KEY=value，每行一个"
              value={draft.envText}
              onChange={event => props.onChange({ envText: event.target.value })}
            />
          </label>
        ) : null}
        {isHttp ? (
          <label className="mcp-create-wide">
            Headers
            <textarea
              disabled={props.busy}
              placeholder="Authorization=Bearer ..."
              value={draft.headersText}
              onChange={event =>
                props.onChange({ headersText: event.target.value })
              }
            />
          </label>
        ) : null}
      </div>
      {props.error ? <div className="models-alert">{props.error}</div> : null}
      <div className="mcp-create-actions">
        <button
          className="primary-action"
          disabled={props.busy}
          type="button"
          onClick={props.onCreate}
        >
          生成安装计划
        </button>
      </div>
    </div>
  )
}

function McpInstallConfirmDialog(props: {
  busy: boolean
  planView: McpInstallPlanViewState
  onApply: (planView: McpInstallPlanViewState) => void
  onChange: (planView: McpInstallPlanViewState) => void
  onCancel: () => void
}) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const plan = props.planView.plan
  const installBlocked =
    plan.installable === false ||
    Boolean(plan.existing?.configured || plan.existing?.installed)
  const writes = plan.writes ?? []
  const actionItems = getMcpInstallActionItems(plan, writes)
  const scopeLabel = formatMcpScopeLabel(plan.scope ?? 'user')
  const description = getMcpInstallPlanDescription(props.planView)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        props.onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [props.onCancel])

  return (
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={props.onCancel}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirm-dialog mcp-install-dialog"
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
      >
        <span className="confirm-dialog-marker" aria-hidden="true" />
        <div className="confirm-dialog-body">
          <header className="confirm-dialog-header">
            <strong id={titleId}>安装 MCP</strong>
          </header>
          <div className="mcp-install-dialog-title">
            <strong>{plan.name ?? '未命名 MCP'}</strong>
            <span>
              {installBlocked
                ? (plan.existing?.message ?? '该 MCP 已存在')
                : `安装到${scopeLabel}，确认后可在 MCP 页面管理`}
            </span>
          </div>
          {description ? (
            <p className="install-description-card">{description}</p>
          ) : null}
          <div className="install-confirm-flow">
            {props.planView.manifestPath ? (
              <div className="install-confirm-row">
                <strong>来源</strong>
                <span>{props.planView.manifestPath}</span>
              </div>
            ) : null}
            <div className="install-confirm-section">
              <strong>确认后会做这些事</strong>
              <ul>
                {actionItems.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="install-confirm-row">
              <strong>注意</strong>
              <span>{getMcpInstallCaution(plan.risks ?? [])}</span>
            </div>
          </div>
          {props.planView.canSaveToCandidates ? (
            <label className="mcp-install-save-option">
              <input
                checked={Boolean(props.planView.saveToCandidates)}
                disabled={props.busy || installBlocked}
                type="checkbox"
                onChange={event =>
                  props.onChange({
                    ...props.planView,
                    saveToCandidates: event.target.checked,
                  })
                }
              />
              <span>
                <strong>保存到常用安装配置</strong>
                <em>保存后会出现在安装候选列表中。</em>
              </span>
            </label>
          ) : null}
          <details className="mcp-install-dialog-technical">
            <summary>技术细节</summary>
            <dl>
              <McpFactItem label="安装位置" value={scopeLabel} />
              <McpFactItem label="启动方式" value={formatMcpTransportLabel(plan.manifest?.transport)} />
              <McpFactItem label="来源类型" value={formatMcpInstallKindLabel(plan.manifest?.kind)} />
              <McpFactItem
                label="数据边界"
                value={formatMcpDataBoundaryLabel(plan.security?.dataBoundary)}
              />
              <McpFactItem label="配置变更" value={formatMcpWritesSummary(writes)} />
            </dl>
          </details>
          <footer className="confirm-dialog-actions">
            <button
              className="ghost-action"
              disabled={props.busy}
              onClick={props.onCancel}
              ref={cancelRef}
              type="button"
            >
              取消
            </button>
            <button
              className="primary-action"
              disabled={props.busy || installBlocked || !plan.confirmation?.token}
              type="button"
              onClick={() => props.onApply(props.planView)}
            >
              {props.busy ? '安装中' : installBlocked ? '已存在' : '确认安装'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}

function McpFactItem(props: { label: string; value: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  )
}

export function normalizeMcpState(value: McpListState | null): McpListState {
  return value ?? { servers: [], errors: [] }
}

export function mergeMcpServers(
  mcp: McpListState,
  installs: McpInstallListState | null,
): McpServerView[] {
  const byName = new Map<string, McpServerView>()
  const installedByName = new Map(
    (installs?.installed ?? [])
      .filter(record => Boolean(record.name))
      .map(record => [record.name!, record]),
  )

  for (const server of mcp.servers ?? []) {
    byName.set(server.name, {
      ...server,
      installed: installedByName.get(server.name),
    })
  }

  for (const inventoryServer of mcp.inventory?.servers ?? []) {
    const current = byName.get(inventoryServer.name)
    byName.set(inventoryServer.name, {
      ...(current ?? { name: inventoryServer.name }),
      inventory: inventoryServer,
      scope: current?.scope ?? inventoryServer.scope,
      transport: current?.transport ?? inventoryServer.transport,
      installKind: current?.installKind ?? inventoryServer.installKind,
      enabled: current?.enabled ?? inventoryServer.enabled,
      installed: installedByName.get(inventoryServer.name),
    })
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function formatServerSubtitle(server: McpServerView): string {
  return [
    formatMcpScopeLabel(server.scope ?? server.inventory?.scope),
    server.transport ?? server.type ?? 'stdio',
    server.source ?? server.inventory?.sourceId ?? 'config',
  ].join(' · ')
}

export function formatMcpScopeLabel(scope: string | null | undefined): string {
  switch (scope) {
    case 'user':
      return '用户全局'
    case 'project':
      return '项目共享'
    case 'local':
      return '本地项目'
    case 'enterprise':
      return '企业托管'
    case 'managed':
      return '托管'
    case 'dynamic':
      return '动态'
    case 'claudeai':
      return 'Claude.ai'
    default:
      return scope || '未知'
  }
}

function getMcpInstallActionItems(
  plan: McpInstallPlanViewState['plan'],
  writes: Array<{ kind?: string; path?: string; mode?: string }>,
): string[] {
  const items = [
    `安装到${formatMcpScopeLabel(plan.scope ?? 'user')}，以后在 CCR 中可以直接使用。`,
    writes.some(write => write.kind === 'config')
      ? '写入用户全局 MCP 配置。'
      : null,
    isPackageInstallKind(plan.manifest?.kind)
      ? '记录 npm 包来源，首次启动时由 npx 获取。'
      : null,
    (plan.risks ?? []).includes('starts_local_process')
      ? '使用时会启动本地 MCP 进程。'
      : null,
    (plan.risks ?? []).includes('may_access_network') ||
    (plan.risks ?? []).includes('remote_service_data_boundary')
      ? '运行时可能访问网络。'
      : null,
  ].filter((item): item is string => Boolean(item))

  return Array.from(new Set(items))
}

function getMcpInstallCaution(risks: string[]): string {
  if (
    risks.includes('unpinned_package_version') ||
    risks.includes('checksum_missing_for_download')
  ) {
    return '确认安装不会立刻下载；首次检测或启动时会通过 npx 从 npm 获取，需要本机已有 npm/npx 和网络。'
  }
  if (risks.includes('may_access_network')) {
    return '这个 MCP 运行时可能访问网络；只安装你信任的来源。'
  }
  return '安装后可以在 MCP 页面随时卸载。'
}

function getMcpInstallPlanDescription(
  planView: McpInstallPlanViewState,
): string {
  const value = planView.manifestInput.description
  return typeof value === 'string' ? value.trim() : ''
}

function formatMcpTransportLabel(transport: string | null | undefined): string {
  switch (transport) {
    case 'stdio':
      return '本地进程'
    case 'http':
      return 'HTTP 服务'
    case 'sse':
      return 'SSE 服务'
    case 'ws':
      return 'WebSocket 服务'
    case 'sdk':
      return 'SDK'
    default:
      return transport || '未知'
  }
}

function formatMcpInstallKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case 'stdio-npm-package':
      return 'npm 包'
    case 'remote-url':
      return '远端服务'
    case 'builtin-preset':
      return '内置预设'
    case 'plugin-provided':
      return '插件提供'
    case 'manual-config':
      return '手动配置'
    default:
      return kind || '未知'
  }
}

function formatMcpDataBoundaryLabel(value: string | null | undefined): string {
  switch (value) {
    case 'remote-service':
      return '可能连接外部服务'
    case 'local-only':
      return '本地'
    case 'plugin-defined':
      return '插件定义'
    case 'unknown':
      return '未知边界'
    default:
      return value || '未知'
  }
}

function isPackageInstallKind(kind: string | null | undefined): boolean {
  return Boolean(kind?.includes('package'))
}

function formatMcpWritesSummary(
  writes: Array<{ kind?: string; path?: string; mode?: string }>,
): string {
  if (writes.length === 0) {
    return '无'
  }
  return `${writes.length} 项`
}

export function getServerStatusLabel(server: McpServerView): string {
  if (server.enabled === false) {
    return '已禁用'
  }
  if (server.inventory?.suppressed) {
    return '被覆盖'
  }
  if (server.inventory?.active === false) {
    return '未激活'
  }
  if (server.inventory?.active === true) {
    return 'active'
  }
  return '已配置'
}

export function isMcpServerAdoptable(server: McpServerView): boolean {
  const scope = server.scope ?? server.inventory?.scope
  const writableScope = scope === 'user' || scope === 'project' || scope === 'local'
  return Boolean(server.name && !server.installed && writableScope)
}

export function getServerTone(server: McpServerView): string {
  if (server.enabled === false || server.inventory?.suppressed) {
    return 'warning'
  }
  if (server.inventory?.active === false) {
    return 'danger'
  }
  return 'success'
}

function getMcpTestTone(test: McpTestState | null): string {
  if (!test) {
    return ''
  }
  if (test.ok === true || test.state === 'connected') {
    return 'success'
  }
  if (test.ok === false || test.state === 'failed') {
    return 'danger'
  }
  return 'warning'
}

function formatMcpTestStatusLabel(test: McpTestState | null): string {
  if (!test) {
    return '未检测'
  }
  if (test.ok === true) {
    return '可用'
  }
  if (test.ok === false) {
    return '不可用'
  }
  switch (test.state) {
    case 'connected':
      return '可用'
    case 'failed':
      return '不可用'
    default:
      return test.state ?? '未知'
  }
}

export function formatCommand(server: McpServerView): string {
  if (!server.command) {
    return '无'
  }
  return [server.command, ...(server.args ?? [])].join(' ')
}

export function formatToolAnnotations(tool: McpRuntimeToolSummary): string {
  const tags = [
    tool.annotations?.readOnly ? '只读' : null,
    tool.annotations?.destructive ? '破坏性' : null,
    tool.annotations?.openWorld ? '开放网络' : null,
  ].filter((tag): tag is string => Boolean(tag))
  return tags.length > 0 ? tags.join('、') : tool.description ?? '无额外标记'
}

export function formatManifest(manifest: McpInstallCandidate['manifest']): string {
  if (!manifest) {
    return '未知 manifest'
  }
  return [manifest.kind, manifest.transport, manifest.version]
    .filter(Boolean)
    .join(' · ')
}

export function formatCandidateSummary(candidate: McpInstallCandidate): string {
  return [
    candidate.sourceLabel ?? formatCandidateSourceType(candidate.sourceType),
    candidate.description ?? formatManifest(candidate.manifest),
  ]
    .filter(Boolean)
    .join(' · ')
}

function formatCandidateSourceType(sourceType: unknown): string {
  switch (sourceType) {
    case 'builtin-preset':
      return '内置 preset'
    case 'local-manifest':
      return '本地 manifest'
    case 'remote-registry':
      return '远端 registry'
    default:
      return '未知来源'
  }
}

export function sortMcpInstallCandidates(
  candidates: McpInstallCandidate[],
  servers: McpServerView[],
  installs: McpInstallListState | null,
): McpInstallCandidate[] {
  return [...candidates].sort((a, b) => {
    const aState = getCandidateInstallState(a, servers, installs)
    const bState = getCandidateInstallState(b, servers, installs)
    if (aState.blocked !== bState.blocked) {
      return aState.blocked ? 1 : -1
    }
    const stateCompare =
      getCandidateStateWeight(a.state) - getCandidateStateWeight(b.state)
    if (stateCompare !== 0) {
      return stateCompare
    }
    return getCandidateDisplayName(a).localeCompare(getCandidateDisplayName(b))
  })
}

function getCandidateStateWeight(state: unknown): number {
  switch (state) {
    case 'available':
      return 0
    case 'duplicate-name':
      return 1
    case 'configured':
      return 2
    case 'installed':
      return 3
    default:
      return 4
  }
}

function getCandidateDisplayName(candidate: McpInstallCandidate): string {
  return candidate.displayName ?? candidate.manifest?.name ?? '未命名 MCP'
}

export function getCandidateKey(candidate: McpInstallCandidate): string {
  if (candidate.candidateId) {
    return candidate.candidateId
  }
  return [
    candidate.sourceType,
    candidate.originPath,
    candidate.manifest?.name,
    candidate.manifest?.kind,
    candidate.manifest?.version,
    candidate.displayName,
  ]
    .filter(Boolean)
    .join(':')
}

export function getCandidateInstallState(
  candidate: McpInstallCandidate,
  servers: McpServerView[],
  installs: McpInstallListState | null,
): {
  blocked: boolean
  label: string
  message: string
  name: string | null
} {
  const name = getCandidateInstallName(candidate)
  if (!name) {
    return {
      blocked: false,
      label: '安装',
      message: '',
      name: null,
    }
  }

  if (candidate.state === 'invalid') {
    return {
      blocked: true,
      label: '不可用',
      message: candidate.stateMessage ?? '候选无效。',
      name,
    }
  }

  if (candidate.state === 'duplicate-name') {
    return {
      blocked: true,
      label: '冲突',
      message:
        candidate.stateMessage ??
        `存在 ${candidate.duplicateGroupCount ?? 2} 个同名候选，请确认来源。`,
      name,
    }
  }

  const installed = (installs?.installed ?? []).find(record => record.name === name)
  if (installed) {
    return {
      blocked: true,
      label: '已安装',
      message: `已由 CCR 安装在 ${formatMcpScopeLabel(installed.scope)}。`,
      name,
    }
  }

  const configured = servers.find(server => server.name === name)
  if (configured) {
    return {
      blocked: true,
      label: '已配置',
      message: `已在 ${formatMcpScopeLabel(configured.scope ?? configured.inventory?.scope)} 配置。`,
      name,
    }
  }

  return {
    blocked: false,
    label: '安装',
    message: '',
    name,
  }
}

function getCandidateInstallName(candidate: McpInstallCandidate): string | null {
  if (candidate.manifest?.name) {
    return candidate.manifest.name
  }
  const inputName = candidate.manifestInput?.name
  return typeof inputName === 'string' && inputName.trim()
    ? inputName.trim()
    : null
}

export function formatInstalledRecord(record: McpInstallRecord): string {
  return [
    formatMcpScopeLabel(record.scope),
    record.manifest?.kind,
    record.manifest?.transport,
    record.installedAt ?? record.updatedAt,
  ]
    .filter(value => typeof value === 'string' && value.trim())
    .join(' · ')
}

function formatInstallRecordStatus(
  record: McpInstallRecord | undefined,
): string {
  switch (record?.configStatus?.state) {
    case 'configured':
      return '配置一致'
    case 'drifted':
      return '配置漂移'
    case 'missing-config':
      return '配置缺失'
    default:
      return record ? '状态未知' : '未由 CCR 安装'
  }
}
