import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  onDisable: (name: string) => void
  onEnable: (name: string) => void
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
  const [installScope, setInstallScope] = useState<McpWritableScope>(
    DEFAULT_MCP_INSTALL_SCOPE,
  )
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
            onClick={props.onRefresh}
          >
            刷新
          </button>
        </div>
      </div>

      {props.error ? <div className="models-alert">{props.error}</div> : null}
      {props.message ? (
        <div className="mcp-inline-message">{props.message}</div>
      ) : null}

      <div className="mcp-workspace">
        <aside className="mcp-server-column" aria-label="MCP servers">
          <div className="models-column-head">
            <strong>Server</strong>
            <span>{servers.length}</span>
          </div>
          <div className="mcp-server-list">
            {servers.length > 0 ? (
              servers.map(server => (
                <button
                  className={
                    server.name === selectedServer?.name
                      ? 'mcp-server-item active'
                      : 'mcp-server-item'
                  }
                  key={server.name}
                  type="button"
                  onClick={() => setSelectedName(server.name)}
                >
                  <span>
                    <strong>{server.name}</strong>
                    <em>{formatServerSubtitle(server)}</em>
                  </span>
                  <div className="mcp-tags">
                    <small className={getServerTone(server)}>
                      {getServerStatusLabel(server)}
                    </small>
                    <small>{server.installKind ?? server.inventory?.installKind ?? 'manual'}</small>
                  </div>
                </button>
              ))
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
              onDisable={props.onDisable}
              onEnable={props.onEnable}
              onRestart={props.onRestart}
              onTest={props.onTest}
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
              <button
                className="ghost-action"
                disabled={props.busy}
                type="button"
                onClick={() => props.onSearchInstalls(installQuery)}
              >
                搜索
              </button>
            </div>
            <div className="mcp-install-scope">
              <label>
                安装范围
                <select
                  disabled={props.busy}
                  value={installScope}
                  onChange={event =>
                    setInstallScope(event.target.value as McpWritableScope)
                  }
                >
                  <option value="user">用户全局</option>
                  <option value="project">项目共享</option>
                  <option value="local">本地项目</option>
                </select>
              </label>
            </div>
            <div className="mcp-candidate-list">
              {candidates.length > 0 ? (
                candidates.map(candidate => {
                  const installState = getCandidateInstallState(
                    candidate,
                    servers,
                    props.installs,
                  )
                  const metadata = getCandidateMetadata(candidate, installState)
                  const permissionLabels = getCandidatePermissionLabels(candidate)
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
                              : (candidate.description ??
                                formatManifest(candidate.manifest))}
                          </em>
                        </span>
                        <div className="mcp-candidate-meta">
                          {metadata.map(item => (
                            <small className={item.tone} key={item.label}>
                              {item.label}
                            </small>
                          ))}
                        </div>
                        {permissionLabels.length > 0 ? (
                          <div className="mcp-candidate-permissions">
                            {permissionLabels.map(label => (
                              <small key={label}>{label}</small>
                            ))}
                          </div>
                        ) : null}
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
                          props.onPlanInstall(candidate, installScope)
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
          </section>

          <section className="mcp-install-section">
            <div className="models-section-head">
              <div>
                <h3>已安装</h3>
                <span>{installedCount} 个 CCR 记录</span>
              </div>
            </div>
            <div className="mcp-installed-list">
              {installedCount > 0 ? (
                props.installs?.installed?.map(record => (
                  <div className="mcp-installed-item" key={record.name ?? record.lockKey}>
                    <span>
                      <strong>{record.name ?? '未命名'}</strong>
                      <em>{formatInstalledRecord(record)}</em>
                    </span>
                    <small className={getInstallRecordStatusTone(record)}>
                      {formatInstallRecordStatus(record)}
                    </small>
                    {record.name ? (
                      <div className="mcp-installed-actions">
                        {record.configStatus?.needsRepair ? (
                          <button
                            className="ghost-action"
                            disabled={props.busy}
                            type="button"
                            onClick={() => props.onRepair(record)}
                          >
                            修复
                          </button>
                        ) : null}
                        <button
                          className="ghost-action danger"
                          disabled={props.busy}
                          type="button"
                          onClick={() => props.onUninstall(record.name!)}
                        >
                          卸载
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="models-empty">暂无 CCR 安装记录。</div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {props.installPlan ? (
        <McpInstallConfirmDialog
          busy={props.busy}
          planView={props.installPlan}
          onApply={props.onApplyInstall}
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
  onDisable: (name: string) => void
  onEnable: (name: string) => void
  onRestart: (name: string) => void
  onTest: (name: string) => void
}) {
  const server = props.server
  const enabled = server.enabled !== false
  const tools = props.test?.tools ?? server.tools ?? []

  return (
    <>
      <div className="models-detail-head">
        <div>
          <h3>{server.name}</h3>
          <span>{formatServerSubtitle(server)}</span>
        </div>
        <div className="models-actions">
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={() =>
              enabled ? props.onDisable(server.name) : props.onEnable(server.name)
            }
          >
            {enabled ? '禁用' : '启用'}
          </button>
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={() => props.onTest(server.name)}
          >
            检测
          </button>
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={() => props.onRestart(server.name)}
          >
            重启
          </button>
        </div>
      </div>

      <div className="models-detail-body">
        <section className="models-section">
          <div className="models-section-head">
            <div>
              <h3>配置</h3>
              <span>{getServerStatusLabel(server)}</span>
            </div>
          </div>
          <dl className="models-facts">
            <McpFactItem label="范围" value={formatMcpScopeLabel(server.scope ?? server.inventory?.scope)} />
            <McpFactItem label="transport" value={server.transport ?? server.type ?? 'stdio'} />
            <McpFactItem label="来源" value={server.source ?? server.inventory?.sourceId ?? 'config'} />
            <McpFactItem label="安装类型" value={server.installKind ?? server.inventory?.installKind ?? 'manual-config'} />
            <McpFactItem label="安装状态" value={formatInstallRecordStatus(server.installed)} />
            <McpFactItem label="配置文件" value={server.inventory?.configPath ?? server.installed?.configPath ?? '无'} />
            <McpFactItem label="写入目标" value={server.inventory?.writePath ?? server.installed?.configPath ?? '只读'} />
            <McpFactItem label="命令" value={formatCommand(server)} />
            <McpFactItem label="URL" value={server.url ?? '无'} />
          </dl>
        </section>

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

        {props.test ? (
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>诊断</h3>
                <span>{props.test.state ?? 'unknown'}</span>
              </div>
            </div>
            <dl className="models-facts compact">
              <McpFactItem label="结果" value={props.test.ok ? '可用' : '不可用'} />
              <McpFactItem label="状态" value={props.test.state ?? '未知'} />
              <McpFactItem label="检测" value={props.test.networkChecked ? '联网检测' : '本地判断'} />
              <McpFactItem label="说明" value={props.test.message ?? '无'} />
            </dl>
          </section>
        ) : null}
      </div>
    </>
  )
}

function McpInstallConfirmDialog(props: {
  busy: boolean
  planView: McpInstallPlanViewState
  onApply: (planView: McpInstallPlanViewState) => void
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
          <div className="mcp-install-dialog-summary">
            <strong>确认后会做这些事</strong>
            <ul>
              {actionItems.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="mcp-install-dialog-note">
            <strong>需要注意</strong>
            <span>{getMcpInstallCaution(plan.risks ?? [])}</span>
          </div>
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

export function getServerTone(server: McpServerView): string {
  if (server.enabled === false || server.inventory?.suppressed) {
    return 'warning'
  }
  if (server.inventory?.active === false) {
    return 'danger'
  }
  return 'success'
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
    return getCandidateDisplayName(a).localeCompare(getCandidateDisplayName(b))
  })
}

function getCandidateDisplayName(candidate: McpInstallCandidate): string {
  return candidate.displayName ?? candidate.manifest?.name ?? '未命名 MCP'
}

function getCandidateMetadata(
  candidate: McpInstallCandidate,
  installState: ReturnType<typeof getCandidateInstallState>,
): Array<{ label: string; tone: string }> {
  const manifest = candidate.manifest
  return [
    {
      label: installState.blocked ? installState.label : '可安装',
      tone: installState.blocked ? 'warning' : 'success',
    },
    {
      label: formatMcpInstallKindLabel(manifest?.kind),
      tone: 'neutral',
    },
    {
      label: formatMcpTransportLabel(manifest?.transport),
      tone: 'neutral',
    },
    {
      label: getCandidateSourceLabel(candidate),
      tone: 'neutral',
    },
    {
      label: formatMcpDataBoundaryLabel(manifest?.dataBoundary),
      tone: manifest?.dataBoundary === 'remote-service' ? 'warning' : 'neutral',
    },
    candidate.trusted === true
      ? {
          label: '可信来源',
          tone: 'success',
        }
      : null,
  ].filter((item): item is { label: string; tone: string } => Boolean(item))
}

function getCandidatePermissionLabels(candidate: McpInstallCandidate): string[] {
  return (candidate.manifest?.permissionKinds ?? []).map(formatMcpPermissionLabel)
}

function formatMcpPermissionLabel(kind: string): string {
  switch (kind) {
    case 'network':
      return '网络'
    case 'process':
      return '本地进程'
    case 'filesystem':
      return '文件'
    case 'oauth':
      return 'OAuth'
    case 'secret':
      return '密钥'
    case 'environment':
      return '环境变量'
    default:
      return kind
  }
}

function getCandidateSourceLabel(candidate: McpInstallCandidate): string {
  const source = getCandidateManifestSource(candidate)
  if (!source) {
    return '未知来源'
  }
  if (source.kind === 'stdio-npm-package') {
    return typeof source.packageName === 'string' ? source.packageName : 'npm 包'
  }
  if (source.kind === 'remote-url') {
    return typeof source.url === 'string' ? source.url : '远端服务'
  }
  if (source.kind === 'builtin-preset') {
    return typeof source.presetId === 'string' ? source.presetId : '内置预设'
  }
  if (source.kind === 'plugin-provided') {
    return typeof source.pluginSource === 'string'
      ? source.pluginSource
      : '插件提供'
  }
  return typeof source.kind === 'string' ? source.kind : '未知来源'
}

function getCandidateManifestSource(
  candidate: McpInstallCandidate,
): Record<string, unknown> | null {
  const source = candidate.manifestInput?.source
  return isRecord(source) ? source : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getCandidateKey(candidate: McpInstallCandidate): string {
  return [
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
    record.updatedAt,
  ]
    .filter(Boolean)
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

function getInstallRecordStatusTone(record: McpInstallRecord): string {
  switch (record.configStatus?.state) {
    case 'configured':
      return 'success'
    case 'drifted':
    case 'missing-config':
      return 'warning'
    default:
      return 'neutral'
  }
}
