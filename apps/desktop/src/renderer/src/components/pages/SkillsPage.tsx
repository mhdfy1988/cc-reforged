import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { DetailTabs, type DetailTabOption } from '../common/DetailTabs.js'
import { IconActionButton } from '../common/IconActionButton.js'
import { PageStatusNotice } from '../common/PageStatusNotice.js'
import { RawDataBlock } from '../common/RawDataBlock.js'
import type {
  SkillImportPlanViewState,
  SkillInstallCandidate,
  SkillInstalledInspection,
  SkillInstallRecord,
  SkillInstallListState,
  SkillInstallPlanViewState,
  SkillInstallSearchState,
  SkillPackageSummary,
  SkillSecurityDigest,
} from '../../domain/displayTypes.js'

type SkillImportDraft = {
  kind:
    | 'local-skill-dir'
    | 'local-archive'
    | 'codex-skill-dir'
    | 'openclaw-skill-dir'
    | 'claude-command'
  path: string
  openaiYamlPath: string
}

type SkillPathPickerInput = {
  mode: 'file' | 'directory'
  title?: string
  buttonLabel?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

type SkillPathPickerResult = {
  canceled: boolean
  path?: string
}

type SkillImportPathField = 'path' | 'openaiYamlPath'

type SkillDetailTab = 'overview' | 'security' | 'resources' | 'body'

const SKILL_DETAIL_TABS: Array<DetailTabOption<SkillDetailTab>> = [
  { id: 'overview', label: '概览' },
  { id: 'security', label: '安全' },
  { id: 'resources', label: '资源' },
  { id: 'body', label: '正文' },
]

const DEFAULT_IMPORT_DRAFT: SkillImportDraft = {
  kind: 'local-skill-dir',
  path: '',
  openaiYamlPath: '',
}

export function SkillsPage(props: {
  busy: boolean
  error: string | null
  importPlan: SkillImportPlanViewState | null
  installPlan: SkillInstallPlanViewState | null
  installSearch: SkillInstallSearchState | null
  installs: SkillInstallListState | null
  message: string | null
  onApplyImport: (planView: SkillImportPlanViewState) => void
  onApplyInstall: (planView: SkillInstallPlanViewState) => void
  onCancelImport: () => void
  onCancelInstall: () => void
  onChangeInstallPlan: (planView: SkillInstallPlanViewState) => void
  onChoosePath: (input: SkillPathPickerInput) => Promise<SkillPathPickerResult>
  onPlanImport: (source: Record<string, unknown>) => void
  onPlanInstall: (candidate: SkillInstallCandidate) => void
  onRefresh: () => void
  onRepair: (skill: SkillInstalledInspection) => void
  onSearchInstalls: (query: string) => void
  onSetEnabled: (skillRef: string, enabled: boolean) => void
  onSetInvocation: (
    skillRef: string,
    patch: { modelInvocable?: boolean; userInvocable?: boolean },
  ) => void
  onUninstall: (skill: SkillInstalledInspection) => void
}) {
  const [selectedRef, setSelectedRef] = useState('')
  const [installQuery, setInstallQuery] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importDraft, setImportDraft] = useState(DEFAULT_IMPORT_DRAFT)
  const [formError, setFormError] = useState<string | null>(null)
  const installed = useMemo(
    () => sortInstalledSkills(props.installs?.installed ?? []),
    [props.installs?.installed],
  )
  const candidates = useMemo(
    () => sortSkillInstallCandidates(props.installSearch?.candidates ?? []),
    [props.installSearch?.candidates],
  )
  const selectedSkill =
    installed.find(skill => getSkillRef(skill) === selectedRef) ?? installed[0]
  const enabledCount = installed.filter(
    skill => skill.installedRecord?.enabled !== false,
  ).length
  const needsAttentionCount = installed.filter(skill =>
    isProblemStatus(skill.status),
  ).length

  useEffect(() => {
    if (installed.length === 0) {
      setSelectedRef('')
      return
    }
    if (!installed.some(skill => getSkillRef(skill) === selectedRef)) {
      setSelectedRef(getSkillRef(installed[0]!))
    }
  }, [installed, selectedRef])

  async function chooseImportPath(field: SkillImportPathField): Promise<void> {
    try {
      const picker = getSkillImportPathPicker(importDraft, field)
      const result = await props.onChoosePath(picker)
      if (result.canceled || !result.path) {
        return
      }
      setImportDraft(current => ({ ...current, [field]: result.path }))
      setFormError(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="skills-page mcp-page page-panel workbench-main">
      <div className="mcp-page-title models-page-title">
        <div>
          <h2>Skill 管理</h2>
          <span>
            {installed.length} 个已安装 · {enabledCount} 个启用 · {candidates.length} 个候选
            {needsAttentionCount > 0 ? ` · ${needsAttentionCount} 个需处理` : ''}
          </span>
        </div>
        <div className="models-title-actions">
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={() => {
              setImportOpen(true)
              setFormError(null)
            }}
          >
            导入 Skill
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
        <aside className="mcp-server-column" aria-label="已安装 Skill">
          <div className="models-column-head">
            <strong>已安装</strong>
            <span>{installed.length}</span>
          </div>
          <div className="mcp-server-list">
            {installed.length > 0 ? (
              installed.map(skill => {
                const ref = getSkillRef(skill)
                const skillEnabled = skill.installedRecord?.enabled !== false
                return (
                  <div
                    className={
                      ref === getSkillRef(selectedSkill)
                        ? 'mcp-server-item active'
                        : 'mcp-server-item'
                    }
                    key={ref}
                  >
                    <button
                      className="mcp-server-main"
                      type="button"
                      onClick={() => setSelectedRef(ref)}
                    >
                      <span>
                        <strong>{getSkillTitle(skill)}</strong>
                        <em>{formatInstalledSkillSubtitle(skill)}</em>
                      </span>
                    </button>
                    <div className="mcp-server-item-foot">
                      <div className="mcp-tags">
                        <small className={getSeverityTone(skill.securityDigest)}>
                          {formatSeverity(skill.securityDigest)}
                        </small>
                      </div>
                      <label className="skill-list-toggle">
                        <input
                          checked={skillEnabled}
                          disabled={props.busy}
                          type="checkbox"
                          onChange={event =>
                            props.onSetEnabled(ref, event.target.checked)
                          }
                        />
                        <i aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="models-empty">暂无已安装 Skill。</div>
            )}
          </div>
        </aside>

        <div className="mcp-detail">
          {selectedSkill ? (
            <SkillDetail
              busy={props.busy}
              skill={selectedSkill}
              onRepair={props.onRepair}
              onSetEnabled={props.onSetEnabled}
              onSetInvocation={props.onSetInvocation}
              onUninstall={props.onUninstall}
            />
          ) : (
            <div className="models-empty">选择一个 Skill 查看详情。</div>
          )}
        </div>

        <aside className="mcp-install-column" aria-label="Skill 安装">
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
                placeholder="搜索 Skill"
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
                    const state = getCandidateInstallState(candidate)
                    return (
                      <div
                        className={
                          state.blocked
                            ? 'mcp-candidate-item blocked'
                            : 'mcp-candidate-item'
                        }
                        key={getCandidateKey(candidate)}
                      >
                        <div className="mcp-candidate-main">
                          <span>
                            <strong>{candidate.displayName ?? candidate.manifest?.name ?? '未命名 Skill'}</strong>
                            <em>{formatCandidateDisplaySummary(candidate, state)}</em>
                          </span>
                          <div className="mcp-tags">
                            <small>{candidate.sourceLabel ?? candidate.sourceType ?? 'candidate'}</small>
                            <small className={getSeverityTone(candidate.securityDigest)}>
                              {formatSeverity(candidate.securityDigest)}
                            </small>
                          </div>
                        </div>
                        <button
                          className="ghost-action"
                          disabled={
                            props.busy ||
                            !candidate.manifestInput ||
                            state.blocked
                          }
                          title={state.message || undefined}
                          type="button"
                          onClick={() => props.onPlanInstall(candidate)}
                        >
                          {state.label}
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

      {importOpen ? (
        <SkillImportDialog
          busy={props.busy}
          draft={importDraft}
          error={formError}
          onCancel={() => setImportOpen(false)}
          onChange={patch => {
            setImportDraft(current => ({ ...current, ...patch }))
            setFormError(null)
          }}
          onChoosePath={field => {
            void chooseImportPath(field)
          }}
          onPlan={() => {
            try {
              props.onPlanImport(buildImportSource(importDraft))
              setImportOpen(false)
            } catch (error) {
              setFormError(error instanceof Error ? error.message : String(error))
            }
          }}
        />
      ) : null}

      {props.installPlan ? (
        <SkillInstallConfirmDialog
          busy={props.busy}
          planView={props.installPlan}
          onApply={props.onApplyInstall}
          onCancel={props.onCancelInstall}
          onChange={props.onChangeInstallPlan}
        />
      ) : null}

      {props.importPlan ? (
        <SkillImportConfirmDialog
          busy={props.busy}
          planView={props.importPlan}
          onApply={props.onApplyImport}
          onCancel={props.onCancelImport}
        />
      ) : null}
    </section>
  )
}

function SkillDetail(props: {
  busy: boolean
  skill: SkillInstalledInspection
  onRepair: (skill: SkillInstalledInspection) => void
  onSetEnabled: (skillRef: string, enabled: boolean) => void
  onSetInvocation: (
    skillRef: string,
    patch: { modelInvocable?: boolean; userInvocable?: boolean },
  ) => void
  onUninstall: (skill: SkillInstalledInspection) => void
}) {
  const record = props.skill.installedRecord
  const skillRef = getSkillRef(props.skill)
  const enabled = record?.enabled !== false
  const modelInvocable = record?.modelInvocable !== false
  const userInvocable = record?.userInvocable !== false
  const skillPackage = props.skill.package
  const resources = skillPackage?.resources ?? {}
  const [activeTab, setActiveTab] = useState<SkillDetailTab>('overview')

  useEffect(() => {
    setActiveTab('overview')
  }, [skillRef])

  return (
    <>
      <div className="detail-fixed">
        <div className="models-detail-head">
          <div>
            <h3>{getSkillTitle(props.skill)}</h3>
            <span>{skillPackage?.description ?? record?.manifest?.description ?? props.skill.statusMessage ?? '无说明'}</span>
          </div>
          <div className="models-actions">
            <IconActionButton
              disabled={props.busy}
              icon="wrench"
              label="修复"
              onClick={() => props.onRepair(props.skill)}
            />
            <IconActionButton
              danger
              disabled={props.busy}
              icon="trash"
              label="卸载"
              onClick={() => props.onUninstall(props.skill)}
            />
          </div>
        </div>

        <DetailTabs<SkillDetailTab>
          activeTab={activeTab}
          ariaLabel="Skill 详情"
          tabs={SKILL_DETAIL_TABS}
          onChange={setActiveTab}
        />
      </div>

      <div className="models-detail-body">
        {activeTab === 'overview' ? (
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>概览</h3>
              </div>
            </div>
            <dl className="models-facts compact">
              <SkillFact label="范围" value={formatSkillScope(record?.scope)} />
              <SkillFact label="安装状态" value={props.skill.statusMessage ?? formatSkillStatus(props.skill.status)} />
              <SkillFact label="来源" value={formatSkillOrigin(record, skillPackage)} />
              <SkillFact label="调用" value={formatSkillInvocation(modelInvocable, userInvocable)} />
              <SkillFact label="风险" value={formatSeverity(props.skill.securityDigest)} />
              <SkillFact label="校验" value={props.skill.checksum?.drifted ? '已漂移' : '一致'} />
            </dl>
            <div className="skill-toggle-panel">
              <div className="skill-toggle-panel-head">
                <strong>调用设置</strong>
                <span>{enabled ? formatSkillInvocation(modelInvocable, userInvocable) : '已禁用'}</span>
              </div>
              <div className="skill-toggle-row">
                <label>
                  <input
                    checked={modelInvocable}
                    disabled={props.busy}
                    type="checkbox"
                    onChange={event =>
                      props.onSetInvocation(skillRef, {
                        modelInvocable: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>模型调用</strong>
                    <em>{modelInvocable ? '已允许' : '已关闭'}</em>
                  </span>
                  <i aria-hidden="true" />
                </label>
                <label>
                  <input
                    checked={userInvocable}
                    disabled={props.busy}
                    type="checkbox"
                    onChange={event =>
                      props.onSetInvocation(skillRef, {
                        userInvocable: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>用户调用</strong>
                    <em>{userInvocable ? '已允许' : '已关闭'}</em>
                  </span>
                  <i aria-hidden="true" />
                </label>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'security' ? (
          <SkillSecuritySection digest={props.skill.securityDigest} />
        ) : null}

        {activeTab === 'resources' ? (
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>资源</h3>
                <span>{formatResourceCounts(resources)}</span>
              </div>
            </div>
            <dl className="models-facts compact">
              <SkillFact label="安装目录" value={record?.packageDir ?? '无'} />
              <SkillFact label="SKILL.md" value={record?.skillFilePath ?? '无'} />
            </dl>
            <div className="mcp-tool-list">
              {formatResourceItems(resources).length > 0 ? (
                formatResourceItems(resources).map(item => (
                  <div className="mcp-tool-item" key={item}>
                    <strong>{item}</strong>
                  </div>
                ))
              ) : (
                <div className="models-empty">暂无资源文件。</div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'body' ? (
          <section className="models-section">
            <div className="models-section-head">
              <div>
                <h3>正文</h3>
                <span>{skillPackage?.bodyPath ?? 'SKILL.md'}</span>
              </div>
            </div>
            <RawDataBlock
              preClassName="skill-body-preview"
              text={skillPackage?.body?.trim() || '暂无正文。'}
            />
          </section>
        ) : null}
      </div>
    </>
  )
}


function SkillSecuritySection(props: { digest?: SkillSecurityDigest | null }) {
  const digest = props.digest
  return (
    <section className="skill-install-security">
      <div className="install-confirm-row">
        <strong>安全</strong>
        <span>{digest?.headline ?? '暂无安全扫描结果'}</span>
      </div>
      <div className="skill-install-security-tags">
        <small className={getSeverityTone(digest)}>{formatSeverity(digest)}</small>
        <small>{digest?.totalFindings ?? 0} 项发现</small>
        <small>{digest?.requiresOverride ? '需要 override' : '无需 override'}</small>
      </div>
      {digest?.primaryFindings?.length ? (
        <div className="skill-install-findings">
          {digest.primaryFindings.map((finding, index) => (
            <div key={`${finding.title ?? 'finding'}-${index}`}>
              <strong>{finding.title ?? finding.severity ?? '风险'}</strong>
              <span>{finding.message ?? finding.recommendation ?? '无详情'}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function SkillImportDialog(props: {
  busy: boolean
  draft: SkillImportDraft
  error: string | null
  onCancel: () => void
  onChange: (patch: Partial<SkillImportDraft>) => void
  onChoosePath: (field: SkillImportPathField) => void
  onPlan: () => void
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
            <strong id={titleId}>导入 Skill</strong>
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
          <SkillImportPanel
            busy={props.busy}
            draft={props.draft}
            error={props.error}
            onChange={props.onChange}
            onChoosePath={props.onChoosePath}
            onPlan={props.onPlan}
          />
        </div>
      </section>
    </div>
  )
}

function SkillImportPanel(props: {
  busy: boolean
  draft: SkillImportDraft
  error: string | null
  onChange: (patch: Partial<SkillImportDraft>) => void
  onChoosePath: (field: SkillImportPathField) => void
  onPlan: () => void
}) {
  return (
    <div className="mcp-create-panel">
      {props.error ? <div className="models-alert">{props.error}</div> : null}
      <div className="mcp-create-grid">
        <label>
          <span>类型</span>
          <select
            disabled={props.busy}
            value={props.draft.kind}
            onChange={event =>
              props.onChange({ kind: event.target.value as SkillImportDraft['kind'] })
            }
          >
            <option value="local-skill-dir">本地 Skill 目录</option>
            <option value="local-archive">本地 Skill 压缩包</option>
            <option value="codex-skill-dir">Codex Skill 目录</option>
            <option value="openclaw-skill-dir">OpenClaw Skill 目录</option>
            <option value="claude-command">Claude command 文件</option>
          </select>
        </label>
        <label>
          <span>路径</span>
          <div className="mcp-path-picker-control">
            <input
              disabled={props.busy}
              placeholder={getSkillImportPathPlaceholder(props.draft.kind)}
              value={props.draft.path}
              onChange={event => props.onChange({ path: event.target.value })}
            />
            <button
              className="ghost-action"
              disabled={props.busy}
              type="button"
              onClick={() => props.onChoosePath('path')}
            >
              选择
            </button>
          </div>
        </label>
        {props.draft.kind === 'codex-skill-dir' ? (
          <label className="mcp-create-wide">
            <span>openai.yaml</span>
            <div className="mcp-path-picker-control">
              <input
                disabled={props.busy}
                placeholder="可选"
                value={props.draft.openaiYamlPath}
                onChange={event =>
                  props.onChange({ openaiYamlPath: event.target.value })
                }
              />
              <button
                className="ghost-action"
                disabled={props.busy}
                type="button"
                onClick={() => props.onChoosePath('openaiYamlPath')}
              >
                选择
              </button>
            </div>
          </label>
        ) : null}
      </div>
      <div className="mcp-create-actions">
        <button
          className="primary-action"
          disabled={props.busy}
          type="button"
          onClick={props.onPlan}
        >
          生成导入计划
        </button>
      </div>
    </div>
  )
}

function SkillInstallConfirmDialog(props: {
  busy: boolean
  planView: SkillInstallPlanViewState
  onApply: (planView: SkillInstallPlanViewState) => void
  onCancel: () => void
  onChange: (planView: SkillInstallPlanViewState) => void
}) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const plan = props.planView.plan
  const blocked = plan.installable === false
  const requiresOverride =
    Boolean(plan.overrideRequired || plan.securityDecision?.requiresOverride)
  const overrideAccepted = Boolean(props.planView.securityOverrideAccepted)
  const title = getSkillInstallPlanTitle(plan)
  const description = getSkillInstallPlanDescription(plan)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

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
            <strong id={titleId}>安装 Skill</strong>
          </header>
          <div className="mcp-install-dialog-title">
            <strong>{title}</strong>
            <span>{blocked ? getSkillPlanBlockedMessage(plan) : formatSkillInstallTarget(plan)}</span>
          </div>
          {description ? (
            <p className="install-description-card">{description}</p>
          ) : null}
          <div className="install-confirm-flow">
            <SkillSecuritySection digest={plan.securityDigest} />
            <div className="install-confirm-section">
              <strong>确认后会做这些事</strong>
              <ul>
                {formatSkillInstallActionItems(plan).map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          {requiresOverride ? (
            <label className="mcp-install-save-option">
              <input
                checked={overrideAccepted}
                disabled={props.busy || blocked}
                type="checkbox"
                onChange={event =>
                  props.onChange({
                    ...props.planView,
                    securityOverrideAccepted: event.target.checked,
                  })
                }
              />
              <span>
                <strong>确认高风险 override</strong>
                <em>确认后会使用本次计划生成的 override token。</em>
              </span>
            </label>
          ) : null}
          {props.planView.canSaveToCandidates ? (
            <label className="mcp-install-save-option">
              <input
                checked={Boolean(props.planView.saveToCandidates)}
                disabled={props.busy || blocked}
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
              <SkillFact label="范围" value={formatSkillScope(plan.scope)} />
              <SkillFact label="来源类型" value={plan.manifest?.kind ?? 'unknown'} />
              <SkillFact label="风险动作" value={plan.securityDigest?.action ?? 'scan-only'} />
              <SkillFact label="写入项" value={formatSkillPlanWrites(plan).join('；')} />
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
              disabled={
                props.busy ||
                blocked ||
                !plan.confirmation?.token ||
                (requiresOverride && !overrideAccepted)
              }
              type="button"
              onClick={() => props.onApply(props.planView)}
            >
              {props.busy ? '安装中' : blocked ? '不可安装' : '确认安装'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}

function SkillImportConfirmDialog(props: {
  busy: boolean
  planView: SkillImportPlanViewState
  onApply: (planView: SkillImportPlanViewState) => void
  onCancel: () => void
}) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const plan = props.planView.plan
  const blocked = plan.importable === false

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

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
            <strong id={titleId}>导入 Skill</strong>
          </header>
          <div className="mcp-install-dialog-title">
            <strong>{plan.name ?? '未命名 Skill'}</strong>
            <span>{blocked ? getSkillImportBlockedMessage(plan) : plan.confirmation?.message ?? '确认导入计划'}</span>
          </div>
          <div className="mcp-install-dialog-summary">
            <strong>确认后会做这些事</strong>
            <ul>
              {(plan.writes ?? []).map(write => (
                <li key={`${write.kind}-${write.toPath}`}>
                  {write.kind ?? 'write'}：{write.toPath ?? 'unknown'}
                </li>
              ))}
            </ul>
          </div>
          {plan.conversion?.required ? (
            <div className="mcp-install-dialog-note">
              <strong>转换</strong>
              <span>{plan.conversion.kind ?? '需要转换'}</span>
            </div>
          ) : null}
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
              disabled={props.busy || blocked || !plan.confirmation?.token}
              type="button"
              onClick={() => props.onApply(props.planView)}
            >
              {props.busy ? '导入中' : blocked ? '不可导入' : '确认导入'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}

function SkillFact(props: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value === undefined || props.value === null || props.value === '' ? '无' : props.value}</dd>
    </div>
  )
}

function buildImportSource(draft: SkillImportDraft): Record<string, unknown> {
  const path = draft.path.trim()
  if (!path) {
    throw new Error('请输入 Skill 来源路径。')
  }
  return {
    kind: draft.kind,
    path,
    ...(draft.kind === 'codex-skill-dir' && draft.openaiYamlPath.trim()
      ? { openaiYamlPath: draft.openaiYamlPath.trim() }
      : {}),
  }
}

function getSkillImportPathPicker(
  draft: SkillImportDraft,
  field: SkillImportPathField,
): SkillPathPickerInput {
  if (field === 'openaiYamlPath') {
    return {
      mode: 'file',
      title: '选择 openai.yaml',
      buttonLabel: '选择文件',
      filters: [
        { name: 'YAML', extensions: ['yaml', 'yml'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    }
  }

  switch (draft.kind) {
    case 'local-archive':
      return {
        mode: 'file',
        title: '选择 Skill 压缩包',
        buttonLabel: '选择文件',
        filters: [
          { name: 'Skill 压缩包', extensions: ['zip', 'tar', 'tgz', 'gz'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      }
    case 'claude-command':
      return {
        mode: 'file',
        title: '选择 Claude command 文件',
        buttonLabel: '选择文件',
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      }
    case 'codex-skill-dir':
      return {
        mode: 'directory',
        title: '选择 Codex Skill 目录',
        buttonLabel: '选择文件夹',
      }
    case 'openclaw-skill-dir':
      return {
        mode: 'directory',
        title: '选择 OpenClaw Skill 目录',
        buttonLabel: '选择文件夹',
      }
    case 'local-skill-dir':
    default:
      return {
        mode: 'directory',
        title: '选择本地 Skill 目录',
        buttonLabel: '选择文件夹',
      }
  }
}

function getSkillImportPathPlaceholder(kind: SkillImportDraft['kind']): string {
  switch (kind) {
    case 'local-archive':
      return 'D:\\path\\to\\skill.zip'
    case 'claude-command':
      return 'D:\\path\\to\\command.md'
    default:
      return 'D:\\path\\to\\skill'
  }
}

function sortInstalledSkills(
  skills: SkillInstalledInspection[],
): SkillInstalledInspection[] {
  return skills.slice().sort((a, b) => {
    const statusDiff = getStatusRank(a.status) - getStatusRank(b.status)
    if (statusDiff !== 0) return statusDiff
    return getSkillTitle(a).localeCompare(getSkillTitle(b))
  })
}

function sortSkillInstallCandidates(
  candidates: SkillInstallCandidate[],
): SkillInstallCandidate[] {
  return candidates.slice().sort((a, b) => {
    const stateDiff = getCandidateStateRank(a.state) - getCandidateStateRank(b.state)
    if (stateDiff !== 0) return stateDiff
    return (a.displayName ?? a.manifest?.name ?? '').localeCompare(
      b.displayName ?? b.manifest?.name ?? '',
    )
  })
}

function getSkillRef(skill?: SkillInstalledInspection): string {
  return skill?.lockKey ?? skill?.installedRecord?.lockKey ?? skill?.name ?? ''
}

function getSkillTitle(skill?: SkillInstalledInspection): string {
  return (
    skill?.package?.displayName ??
    skill?.installedRecord?.manifest?.displayName ??
    skill?.name ??
    '未命名 Skill'
  )
}

function formatInstalledSkillSubtitle(skill: SkillInstalledInspection): string {
  const record = skill.installedRecord
  return [
    formatSkillScope(record?.scope),
    record?.modelInvocable === false ? '模型不可调用' : '模型可调用',
    record?.userInvocable === false ? '用户不可调用' : '用户可调用',
  ].join(' · ')
}

function formatCandidateSummary(candidate: SkillInstallCandidate): string {
  return candidate.description ?? candidate.packagePreview?.description ?? '无说明'
}

function formatCandidateDisplaySummary(
  candidate: SkillInstallCandidate,
  state: { blocked: boolean; message: string },
): string {
  if (state.blocked && candidate.state !== 'installed') {
    return state.message
  }
  return formatCandidateSummary(candidate)
}

function getSkillInstallPlanTitle(plan: SkillInstallPlanViewState['plan']): string {
  return (
    plan.manifest?.displayName?.trim() ||
    plan.packagePreview?.name?.trim() ||
    plan.name?.trim() ||
    '未命名 Skill'
  )
}

function getSkillInstallPlanDescription(plan: SkillInstallPlanViewState['plan']): string {
  return (
    plan.manifest?.description?.trim() ||
    plan.packagePreview?.description?.trim() ||
    ''
  )
}

function formatSkillInstallTarget(plan: SkillInstallPlanViewState['plan']): string {
  const scope = formatSkillScope(plan.scope)
  if (plan.manifest?.kind === 'builtin-preset') {
    return `安装到${scope}的 Skill 包目录。`
  }
  return plan.confirmation?.message ?? `安装到${scope}的 Skill 包目录。`
}

function getCandidateInstallState(candidate: SkillInstallCandidate): {
  blocked: boolean
  label: string
  message: string
} {
  if (candidate.state === 'installed') {
    return { blocked: true, label: '已安装', message: '该 Skill 已安装。' }
  }
  if (candidate.state === 'duplicate-name') {
    return { blocked: true, label: '重名', message: candidate.stateMessage ?? '存在重名候选。' }
  }
  if (candidate.state === 'invalid') {
    return { blocked: true, label: '无效', message: candidate.stateMessage ?? '候选无效。' }
  }
  return { blocked: false, label: '安装', message: '' }
}

function getCandidateKey(candidate: SkillInstallCandidate): string {
  return candidate.candidateId ?? candidate.originPath ?? candidate.manifest?.name ?? 'candidate'
}

function formatSkillStatus(status?: string): string {
  switch (status) {
    case 'installed':
      return '已安装'
    case 'disabled':
      return '已禁用'
    case 'missing-package':
      return '缺少目录'
    case 'missing-skill-md':
      return '缺少 SKILL.md'
    case 'missing-owner-marker':
      return '缺少归属'
    case 'missing-lock':
      return '缺少锁定'
    case 'drifted':
      return '已漂移'
    case 'invalid':
      return '无效'
    default:
      return status ?? '未知'
  }
}

function formatSkillScope(scope?: string): string {
  if (scope === 'user') return '用户全局'
  if (scope === 'project') return '项目'
  return scope ?? '未知'
}

function formatSkillOrigin(
  record?: SkillInstallRecord,
  skillPackage?: SkillPackageSummary | null,
): string {
  const compatibility = record?.manifest?.compatibility
  const compatibilityVendor =
    compatibility && typeof compatibility.vendor === 'string'
      ? compatibility.vendor
      : null
  return (
    compatibilityVendor ??
    record?.manifest?.originVendor ??
    skillPackage?.origin?.vendor ??
    'unknown'
  )
}

function getSkillStatusTone(status?: string): string {
  if (status === 'installed') return 'success'
  if (status === 'disabled' || status === 'missing-lock' || status === 'drifted') return 'warning'
  if (isProblemStatus(status)) return 'danger'
  return ''
}

function isProblemStatus(status?: string): boolean {
  return [
    'missing-package',
    'missing-skill-md',
    'missing-owner-marker',
    'missing-lock',
    'drifted',
    'invalid',
  ].includes(status ?? '')
}

function getStatusRank(status?: string): number {
  if (status === 'installed') return 0
  if (status === 'disabled') return 1
  if (status === 'drifted') return 2
  if (status === 'missing-lock') return 3
  if (status === 'missing-owner-marker') return 4
  if (status === 'missing-skill-md') return 5
  if (status === 'missing-package') return 6
  return 7
}

function getCandidateStateRank(state?: string): number {
  if (state === 'available') return 0
  if (state === 'installed') return 1
  if (state === 'duplicate-name') return 2
  if (state === 'invalid') return 3
  return 4
}

function getSeverityTone(digest?: SkillSecurityDigest | null): string {
  switch (digest?.highestSeverity) {
    case 'critical':
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
    case 'info':
      return 'success'
    default:
      return ''
  }
}

function formatSeverity(digest?: SkillSecurityDigest | null): string {
  return digest?.highestSeverity
    ? `风险：${formatSeverityLevel(digest.highestSeverity)}`
    : '未扫描'
}

function formatSeverityLevel(severity: string): string {
  switch (severity) {
    case 'critical':
      return '严重'
    case 'high':
      return '高'
    case 'medium':
      return '中'
    case 'low':
      return '低'
    case 'info':
      return '低'
    default:
      return severity
  }
}

function formatResourceCounts(resources: {
  scripts?: string[]
  references?: string[]
  assets?: string[]
}): string {
  return `${resources.scripts?.length ?? 0} 脚本 · ${resources.references?.length ?? 0} 参考 · ${resources.assets?.length ?? 0} 资产`
}

function formatResourceItems(resources: {
  scripts?: string[]
  references?: string[]
  assets?: string[]
}): string[] {
  return [
    ...(resources.scripts ?? []),
    ...(resources.references ?? []),
    ...(resources.assets ?? []),
  ]
}

function formatSkillInvocation(
  modelInvocable: boolean,
  userInvocable: boolean,
): string {
  const parts = [
    modelInvocable ? '模型可调用' : null,
    userInvocable ? '用户可调用' : null,
  ].filter(Boolean)
  return parts.join(' · ') || '不可调用'
}

function formatSkillPlanWrites(plan: SkillInstallPlanViewState['plan']): string[] {
  const writes = plan.writes ?? []
  if (writes.length === 0) {
    return ['写入 Skill 安装记录']
  }
  return writes.map(write => `${write.kind ?? 'write'}：${write.path ?? 'unknown'}`)
}

function formatSkillInstallActionItems(plan: SkillInstallPlanViewState['plan']): string[] {
  const writes = plan.writes ?? []
  const items = [
    `安装到${formatSkillScope(plan.scope)}，之后可在 Skill 页面管理。`,
    writes.some(write => write.kind === 'package')
      ? '复制 Skill 包内容。'
      : null,
    writes.some(write => write.kind === 'installed-index')
      ? '写入安装记录。'
      : null,
    writes.some(write => write.kind === 'lockfile')
      ? '记录锁定信息，方便后续检查和修复。'
      : null,
  ].filter((item): item is string => Boolean(item))

  return Array.from(new Set(items.length ? items : ['写入 Skill 安装记录。']))
}

function getSkillPlanBlockedMessage(plan: SkillInstallPlanViewState['plan']): string {
  return (
    plan.conflicts?.map(conflict => conflict.message).filter(Boolean).join('；') ||
    plan.securityDecision?.reasons?.join('；') ||
    '该 Skill 当前不可安装。'
  )
}

function getSkillImportBlockedMessage(plan: SkillImportPlanViewState['plan']): string {
  return (
    plan.conflicts?.map(conflict => conflict.message).filter(Boolean).join('；') ||
    '该 Skill 当前不可导入。'
  )
}
