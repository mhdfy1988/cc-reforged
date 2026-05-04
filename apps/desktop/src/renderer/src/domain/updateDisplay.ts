import type { DesktopUpdateState } from './displayTypes.js'

export const UPDATE_MOCK_ACTIONS = [
  { status: 'available', label: '发现更新' },
  { status: 'downloading', label: '下载中' },
  { status: 'downloaded', label: '已下载' },
  { status: 'error', label: '失败' },
  { status: 'disabled', label: '关闭模拟' },
] as const

export type UpdateActionKind = 'download' | 'install' | 'check'

export type TopbarUpdateAction = {
  label: string
  disabled: boolean
  kind: UpdateActionKind
}

export function getUpdateStatusText(
  updateStatus: DesktopUpdateState | null | undefined,
): string {
  if (!updateStatus) {
    return '初始化中'
  }
  if (!updateStatus.enabled) {
    return '开发态已禁用'
  }
  if (updateStatus.status === 'available') {
    return `发现 ${updateStatus.availableUpdate?.version ?? '新版本'}`
  }
  if (updateStatus.status === 'downloaded') {
    return '更新已下载'
  }
  if (updateStatus.status === 'downloading') {
    return `下载中 ${updateStatus.progress?.percent ?? 0}%`
  }
  return updateStatus.status
}

export function getUpdateDetailText(
  updateStatus: DesktopUpdateState | null | undefined,
): string {
  if (!updateStatus) {
    return '等待主进程返回更新状态'
  }
  if (updateStatus.disabledReason) {
    return updateStatus.disabledReason
  }
  if (updateStatus.lastError) {
    return updateStatus.lastError
  }
  if (updateStatus.availableUpdate?.version) {
    return `当前 ${updateStatus.currentVersion}，可用 ${updateStatus.availableUpdate.version}`
  }
  return `当前 ${updateStatus.currentVersion} · ${updateStatus.source}`
}

export function shouldShowTopbarUpdateNotice(
  updateStatus: DesktopUpdateState | null | undefined,
): boolean {
  return Boolean(
    updateStatus?.enabled &&
      ['available', 'downloading', 'downloaded', 'installing', 'error'].includes(
        updateStatus.status,
      ),
  )
}

export function getTopbarUpdateTitle(
  updateStatus: DesktopUpdateState | null | undefined,
): string {
  if (updateStatus?.status === 'downloaded') {
    return '更新已就绪'
  }
  if (updateStatus?.status === 'downloading') {
    return '正在下载更新'
  }
  if (updateStatus?.status === 'installing') {
    return '正在安装更新'
  }
  if (updateStatus?.status === 'error') {
    return '更新检查失败'
  }
  return `发现 ${updateStatus?.availableUpdate?.version ?? '新版本'}`
}

export function getTopbarUpdateSubtitle(
  updateStatus: DesktopUpdateState | null | undefined,
): string {
  if (!updateStatus) {
    return ''
  }
  if (updateStatus.lastError) {
    return updateStatus.lastError
  }
  if (updateStatus.availableUpdate?.version) {
    return `当前 ${updateStatus.currentVersion} -> ${updateStatus.availableUpdate.version}`
  }
  return `当前 ${updateStatus.currentVersion}`
}

export function getTopbarUpdateAction(
  updateStatus: DesktopUpdateState | null | undefined,
): TopbarUpdateAction | null {
  if (!updateStatus) {
    return null
  }
  if (updateStatus.canDownload) {
    return {
      label: '下载更新',
      disabled: false,
      kind: 'download',
    }
  }
  if (updateStatus.canInstall) {
    return {
      label: '重启安装',
      disabled: false,
      kind: 'install',
    }
  }
  if (updateStatus.status === 'error' && updateStatus.canCheck) {
    return {
      label: '重试',
      disabled: false,
      kind: 'check',
    }
  }
  return null
}
