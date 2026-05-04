import { InfoCard } from '../common/InfoCard.js'
import type { DesktopStatus, DesktopUpdateState } from '../../domain/displayTypes.js'
import {
  getUpdateDetailText,
  getUpdateStatusText,
  UPDATE_MOCK_ACTIONS,
} from '../../domain/updateDisplay.js'

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
  updateStatus: DesktopUpdateState | null | undefined
  onCheckForUpdates: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
  onMockUpdateState: (status: string) => void
}) {
  const status = props.status
  const updateStatus = props.updateStatus

  return (
    <section className="page-panel cards-grid workbench-main">
      <InfoCard title="模型" value={props.model} detail={`provider: ${props.provider}`} />
      <InfoCard
        title="认证"
        value={props.authText}
        detail={status?.auth?.provider ?? 'unknown'}
      />
      <InfoCard title="Core" value={props.coreVersion} detail={`protocol: ${props.protocol}`} />
      <InfoCard
        title="App Server"
        value={props.serverVersion}
        detail={
          status?.protocolCompatibility?.compatible
            ? 'protocol compatible'
            : status?.protocolCompatibility?.reason ?? 'checking compatibility'
        }
      />
      <InfoCard
        title="运行时"
        value={status?.runtimeMode ?? 'unknown'}
        detail={status?.repoRoot ?? ''}
      />
      <InfoCard
        title="工作区"
        value={status?.workspacePath ? '已打开' : '未打开'}
        detail={status?.workspacePath ?? status?.repoRoot ?? ''}
      />
      <article className="info-card update-card">
        <span>自动更新</span>
        <strong>{getUpdateStatusText(updateStatus)}</strong>
        <small>{getUpdateDetailText(updateStatus)}</small>
        {updateStatus?.progress ? (
          <div className="progress-bar">
            <span style={{ width: `${updateStatus.progress.percent}%` }} />
          </div>
        ) : null}
        <div className="inline-actions">
          <button
            disabled={props.busy || !updateStatus?.canCheck}
            onClick={props.onCheckForUpdates}
          >
            检查更新
          </button>
          <button
            disabled={props.busy || !updateStatus?.canDownload}
            onClick={props.onDownloadUpdate}
          >
            下载
          </button>
          <button
            disabled={props.busy || !updateStatus?.canInstall}
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
    </section>
  )
}
