import { useEffect, useMemo, useState } from 'react'
import { InfoCard } from '../common/InfoCard.js'
import type {
  DesktopStatus,
  DesktopUpdateState,
  EditablePermissionSettingsSource,
  PermissionModeSetting,
  PermissionSettingsSource,
  PermissionSettingsState,
  PermissionSettingsUpdateInput,
} from '../../domain/displayTypes.js'
import {
  getUpdateDetailText,
  getUpdateStatusText,
  UPDATE_MOCK_ACTIONS,
} from '../../domain/updateDisplay.js'

const SETTINGS_SECTIONS = [
  {
    id: 'general',
    label: '常规',
    description: '模型、认证和工作区状态',
  },
  {
    id: 'permissions',
    label: '权限',
    description: '工具权限、默认模式和额外目录',
  },
  {
    id: 'updates',
    label: '更新',
    description: 'Desktop 自动更新和开发态模拟',
  },
  {
    id: 'diagnostics',
    label: '诊断',
    description: 'Core、协议和运行时状态',
  },
] as const

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

export function SettingsPage(props: {
  authText: string
  busy: boolean
  canUseUpdateMock: boolean
  coreVersion: string
  model: string
  protocol: string
  provider: string
  serverVersion: string
  status: DesktopStatus | null
  permissionSettings: PermissionSettingsState | null
  updateStatus: DesktopUpdateState | null | undefined
  onCheckForUpdates: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
  onMockUpdateState: (status: string) => void
  onBack: () => void
  onRefreshPermissionSettings: () => void
  onSavePermissionSettings: (input: PermissionSettingsUpdateInput) => void
}) {
  const status = props.status
  const updateStatus = props.updateStatus
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>('general')
  const activeSectionMeta =
    SETTINGS_SECTIONS.find(section => section.id === activeSection) ??
    SETTINGS_SECTIONS[0]

  return (
    <section className="settings-screen">
      <aside className="settings-rail" aria-label="设置分类">
        <button
          className="settings-back-button"
          type="button"
          onClick={props.onBack}
        >
          <span aria-hidden="true">‹</span>
          返回应用
        </button>
        <nav className="settings-section-nav">
          {SETTINGS_SECTIONS.map(section => (
            <button
              key={section.id}
              className={`settings-section-button ${
                activeSection === section.id ? 'active' : ''
              }`}
              type="button"
              onClick={() => setActiveSection(section.id)}
            >
              <strong>{section.label}</strong>
              <span>{section.description}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="settings-content-panel">
        <div className="settings-content-inner">
          <header className="settings-page-heading">
            <h2>{activeSectionMeta.label}</h2>
            <p>{activeSectionMeta.description}</p>
          </header>

          {activeSection === 'general' ? (
            <GeneralSettingsSection
              authText={props.authText}
              model={props.model}
              provider={props.provider}
              status={status}
            />
          ) : null}

          {activeSection === 'permissions' ? (
            <PermissionSettingsPanel
              busy={props.busy}
              settings={props.permissionSettings}
              onRefresh={props.onRefreshPermissionSettings}
              onSave={props.onSavePermissionSettings}
            />
          ) : null}

          {activeSection === 'updates' ? (
            <UpdateSettingsSection
              busy={props.busy}
              canUseUpdateMock={props.canUseUpdateMock}
              updateStatus={updateStatus}
              onCheckForUpdates={props.onCheckForUpdates}
              onDownloadUpdate={props.onDownloadUpdate}
              onInstallUpdate={props.onInstallUpdate}
              onMockUpdateState={props.onMockUpdateState}
            />
          ) : null}

          {activeSection === 'diagnostics' ? (
            <DiagnosticsSettingsSection
              coreVersion={props.coreVersion}
              protocol={props.protocol}
              serverVersion={props.serverVersion}
              status={status}
            />
          ) : null}
        </div>
      </main>
    </section>
  )
}

function GeneralSettingsSection(props: {
  authText: string
  model: string
  provider: string
  status: DesktopStatus | null
}) {
  return (
    <div className="settings-cards-grid">
      <InfoCard
        title="模型"
        value={props.model}
        detail={`provider: ${props.provider}`}
      />
      <InfoCard
        title="认证"
        value={props.authText}
        detail={props.status?.auth?.provider ?? 'unknown'}
      />
      <InfoCard
        title="工作区"
        value={props.status?.workspacePath ? '已打开' : '未打开'}
        detail={props.status?.workspacePath ?? props.status?.repoRoot ?? ''}
      />
      <InfoCard
        title="运行时"
        value={props.status?.runtimeMode ?? 'unknown'}
        detail={props.status?.repoRoot ?? ''}
      />
    </div>
  )
}

function DiagnosticsSettingsSection(props: {
  coreVersion: string
  protocol: string
  serverVersion: string
  status: DesktopStatus | null
}) {
  return (
    <div className="settings-cards-grid">
      <InfoCard
        title="Core"
        value={props.coreVersion}
        detail={`protocol: ${props.protocol}`}
      />
      <InfoCard
        title="App Server"
        value={props.serverVersion}
        detail={
          props.status?.protocolCompatibility?.compatible
            ? 'protocol compatible'
            : props.status?.protocolCompatibility?.reason ??
              'checking compatibility'
        }
      />
      <InfoCard
        title="进程状态"
        value={props.status?.appServer ?? 'unknown'}
        detail={props.status?.repoRoot ?? ''}
      />
      <InfoCard
        title="上下文窗口"
        value={String(
          props.status?.context?.contextWindow ??
            props.status?.config?.llm?.contextWindow ??
            'unknown',
        )}
        detail={props.status?.context?.available === false ? '未开始会话' : '已连接'}
      />
    </div>
  )
}

function UpdateSettingsSection(props: {
  busy: boolean
  canUseUpdateMock: boolean
  updateStatus: DesktopUpdateState | null | undefined
  onCheckForUpdates: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
  onMockUpdateState: (status: string) => void
}) {
  return (
    <article className="info-card update-card settings-full-card">
      <span>自动更新</span>
      <strong>{getUpdateStatusText(props.updateStatus)}</strong>
      <small>{getUpdateDetailText(props.updateStatus)}</small>
      {props.updateStatus?.progress ? (
        <div className="progress-bar">
          <span style={{ width: `${props.updateStatus.progress.percent}%` }} />
        </div>
      ) : null}
      <div className="inline-actions">
        <button
          disabled={props.busy || !props.updateStatus?.canCheck}
          onClick={props.onCheckForUpdates}
        >
          检查更新
        </button>
        <button
          disabled={props.busy || !props.updateStatus?.canDownload}
          onClick={props.onDownloadUpdate}
        >
          下载
        </button>
        <button
          disabled={props.busy || !props.updateStatus?.canInstall}
          onClick={props.onInstallUpdate}
        >
          重启安装
        </button>
      </div>
      {props.canUseUpdateMock ? (
        <div className="dev-mock-actions">
          <span>开发态模拟</span>
          <div>
            {UPDATE_MOCK_ACTIONS.map(action => (
              <button
                key={action.status}
                disabled={props.busy}
                onClick={() => props.onMockUpdateState(action.status)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function PermissionSettingsPanel(props: {
  busy: boolean
  settings: PermissionSettingsState | null
  onRefresh: () => void
  onSave: (input: PermissionSettingsUpdateInput) => void
}) {
  const editableSources = useMemo(
    () =>
      props.settings?.sources.filter(
        (
          source,
        ): source is PermissionSettingsSource & {
          source: EditablePermissionSettingsSource
        } =>
          source.editable &&
          Boolean(
            props.settings?.editableSources.includes(
              source.source as EditablePermissionSettingsSource,
            ),
          ),
      ) ?? [],
    [props.settings],
  )
  const defaultSource = props.settings?.defaultSource ?? 'localSettings'
  const [source, setSource] =
    useState<EditablePermissionSettingsSource>(defaultSource)
  const [mode, setMode] = useState<PermissionModeSetting | ''>('')
  const [disableBypass, setDisableBypass] = useState(false)
  const [allowRules, setAllowRules] = useState('')
  const [askRules, setAskRules] = useState('')
  const [denyRules, setDenyRules] = useState('')
  const [directories, setDirectories] = useState('')

  const selectedSource =
    editableSources?.find(item => item.source === source) ?? editableSources?.[0]

  useEffect(() => {
    if (!props.settings) {
      return
    }
    if (!editableSources?.some(item => item.source === source)) {
      setSource(defaultSource)
    }
  }, [defaultSource, editableSources, props.settings, source])

  useEffect(() => {
    if (!selectedSource) {
      return
    }
    setMode((selectedSource.permissions.defaultMode as PermissionModeSetting) ?? '')
    setDisableBypass(selectedSource.permissions.disableBypassPermissionsMode)
    setAllowRules(linesFromArray(selectedSource.permissions.allow))
    setAskRules(linesFromArray(selectedSource.permissions.ask))
    setDenyRules(linesFromArray(selectedSource.permissions.deny))
    setDirectories(
      linesFromArray(selectedSource.permissions.additionalDirectories),
    )
  }, [selectedSource])

  function save(): void {
    if (!selectedSource) {
      return
    }
    props.onSave({
      source: selectedSource.source,
      permissions: {
        defaultMode: mode ? mode : null,
        disableBypassPermissionsMode: disableBypass,
        allow: linesToArray(allowRules),
        ask: linesToArray(askRules),
        deny: linesToArray(denyRules),
        additionalDirectories: linesToArray(directories),
      },
    })
  }

  const effective = props.settings?.effective

  return (
    <section className="permission-settings-panel">
      <div className="permission-settings-header">
        <div>
          <h2>权限</h2>
          <span>
            当前模式：{getModeDisplayText(effective?.defaultMode, props.settings)}
            · allow {effective?.allow.length ?? 0} / ask{' '}
            {effective?.ask.length ?? 0} / deny {effective?.deny.length ?? 0}
          </span>
        </div>
        <div className="inline-actions">
          <button disabled={props.busy} onClick={props.onRefresh}>
            刷新
          </button>
          <button disabled={props.busy || !selectedSource} onClick={save}>
            保存
          </button>
        </div>
      </div>

      {!props.settings ? (
        <p className="settings-muted">权限设置待加载。</p>
      ) : (
        <div className="permission-settings-form">
          <label>
            <span>写入位置</span>
            <select
              value={selectedSource?.source ?? source}
              onChange={event =>
                setSource(
                  event.target.value as EditablePermissionSettingsSource,
                )
              }
            >
              {editableSources?.map(item => (
                <option key={item.source} value={item.source}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>默认模式</span>
            <select
              value={mode}
              onChange={event =>
                setMode(event.target.value as PermissionModeSetting | '')
              }
            >
              <option value="">继承</option>
              {props.settings.modes.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="permission-settings-toggle">
            <input
              checked={disableBypass}
              type="checkbox"
              onChange={event => setDisableBypass(event.target.checked)}
            />
            <span>禁用绕过权限模式</span>
          </label>
          <PermissionRulesTextarea
            label="允许规则"
            value={allowRules}
            onChange={setAllowRules}
          />
          <PermissionRulesTextarea
            label="询问规则"
            value={askRules}
            onChange={setAskRules}
          />
          <PermissionRulesTextarea
            label="拒绝规则"
            value={denyRules}
            onChange={setDenyRules}
          />
          <PermissionRulesTextarea
            label="额外目录"
            value={directories}
            onChange={setDirectories}
          />
          <div className="permission-settings-paths">
            <PathRow
              label="写入"
              value={selectedSource?.path ?? '未找到写入路径'}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function PathRow(props: { label: string; value: string }) {
  return (
    <div className="permission-settings-path-row">
      <span>{props.label}</span>
      <code>{props.value}</code>
    </div>
  )
}

function PermissionRulesTextarea(props: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="permission-settings-textarea">
      <span>{props.label}</span>
      <textarea
        spellCheck={false}
        value={props.value}
        onChange={event => props.onChange(event.target.value)}
      />
    </label>
  )
}

function linesFromArray(value: string[]): string {
  return value.join('\n')
}

function linesToArray(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
}

function getModeDisplayText(
  mode: string | null | undefined,
  settings: PermissionSettingsState | null,
): string {
  if (!mode) {
    return '默认询问'
  }
  return settings?.modes.find(item => item.value === mode)?.label ?? mode
}
