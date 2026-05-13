import electronUpdater from 'electron-updater'
import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import {
  createInitialDesktopUpdateState,
  reduceDesktopUpdateState,
  type DesktopUpdateInfo,
  type DesktopUpdateState,
  type DesktopUpdateStatus,
} from './updateState.js'

const { autoUpdater } = electronUpdater

type UpdaterLike = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: 'checking-for-update', listener: () => void): UpdaterLike
  on(event: 'update-available', listener: (info: UpdateInfo) => void): UpdaterLike
  on(event: 'update-not-available', listener: (info: UpdateInfo) => void): UpdaterLike
  on(event: 'download-progress', listener: (info: ProgressInfo) => void): UpdaterLike
  on(event: 'update-downloaded', listener: (info: UpdateInfo) => void): UpdaterLike
  on(event: 'error', listener: (error: Error) => void): UpdaterLike
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<Array<string>>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

type DesktopUpdateServiceOptions = {
  isPackaged: boolean
  currentVersion: string
  updater?: UpdaterLike
  onStateChange?: (state: DesktopUpdateState) => void
  beforeInstall?: () => Promise<void>
  now?: () => string
}

export class DesktopUpdateService {
  private readonly updater: UpdaterLike
  private readonly beforeInstall: () => Promise<void>
  private readonly onStateChange?: (state: DesktopUpdateState) => void
  private readonly now: () => string
  private readonly currentVersion: string
  private readonly developmentMockEnabled: boolean
  private state: DesktopUpdateState
  private mockMode = false

  constructor(options: DesktopUpdateServiceOptions) {
    const updatesDisabled = process.env.CCR_DESKTOP_DISABLE_UPDATES === '1'
    const enabled = options.isPackaged && !updatesDisabled
    const disabledReason = !options.isPackaged
      ? 'auto update is disabled in development mode'
      : updatesDisabled
        ? 'auto update is disabled by CCR_DESKTOP_DISABLE_UPDATES=1'
        : null

    this.updater = options.updater ?? autoUpdater
    this.beforeInstall = options.beforeInstall ?? (async () => undefined)
    this.onStateChange = options.onStateChange
    this.now = options.now ?? (() => new Date().toISOString())
    this.currentVersion = options.currentVersion
    this.developmentMockEnabled = !options.isPackaged
    this.state = createInitialDesktopUpdateState({
      enabled,
      currentVersion: options.currentVersion,
      disabledReason,
    })

    if (!enabled && disabledReason) {
      this.emitState()
      return
    }

    this.updater.autoDownload = false
    this.updater.autoInstallOnAppQuit = false
    this.bindUpdaterEvents()
    this.emitState()
  }

  getState(): DesktopUpdateState {
    return { ...this.state }
  }

  applyDevelopmentMock(status: DesktopUpdateStatus): DesktopUpdateState {
    if (!this.developmentMockEnabled) {
      throw new Error('Desktop update mock is only available in development mode.')
    }
    if (!MOCKABLE_UPDATE_STATUSES.has(status)) {
      throw new Error(`Unsupported desktop update mock status: ${status}`)
    }

    this.mockMode = status !== 'disabled'
    this.state = this.createMockState(status)
    this.emitState()
    return this.getState()
  }

  async checkForUpdates(): Promise<DesktopUpdateState> {
    if (!this.state.enabled) {
      return this.getState()
    }

    if (this.mockMode) {
      this.dispatch({ type: 'checking', at: this.now() })
      this.dispatch({ type: 'available', info: this.createMockUpdateInfo() })
      return this.getState()
    }

    this.dispatch({ type: 'checking', at: this.now() })
    await this.updater.checkForUpdates()
    return this.getState()
  }

  async downloadUpdate(): Promise<DesktopUpdateState> {
    if (!this.state.canDownload) {
      return this.getState()
    }

    if (this.mockMode) {
      this.dispatch({
        type: 'download-progress',
        progress: {
          percent: 58,
          transferred: 5_800_000,
          total: 10_000_000,
          bytesPerSecond: 1_200_000,
        },
      })
      this.dispatch({ type: 'downloaded', info: this.createMockUpdateInfo() })
      return this.getState()
    }

    await this.updater.downloadUpdate()
    return this.getState()
  }

  async installUpdate(): Promise<DesktopUpdateState> {
    if (!this.state.canInstall) {
      return this.getState()
    }

    this.dispatch({ type: 'installing' })
    if (this.mockMode) {
      return this.getState()
    }

    await this.beforeInstall()
    this.updater.quitAndInstall(false, true)
    return this.getState()
  }

  private bindUpdaterEvents(): void {
    this.updater.on('checking-for-update', () => {
      this.dispatch({ type: 'checking', at: this.now() })
    })
    this.updater.on('update-available', info => {
      this.dispatch({ type: 'available', info: toDesktopUpdateInfo(info) })
    })
    this.updater.on('update-not-available', info => {
      this.dispatch({ type: 'not-available', info: toDesktopUpdateInfo(info) })
    })
    this.updater.on('download-progress', progress => {
      this.dispatch({
        type: 'download-progress',
        progress: {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
      })
    })
    this.updater.on('update-downloaded', info => {
      this.dispatch({ type: 'downloaded', info: toDesktopUpdateInfo(info) })
    })
    this.updater.on('error', error => {
      this.dispatch({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    })
  }

  private dispatch(event: Parameters<typeof reduceDesktopUpdateState>[1]): void {
    this.state = reduceDesktopUpdateState(this.state, event)
    this.emitState()
  }

  private emitState(): void {
    this.onStateChange?.(this.getState())
  }

  private createMockState(status: DesktopUpdateStatus): DesktopUpdateState {
    if (status === 'disabled') {
      return createInitialDesktopUpdateState({
        enabled: false,
        currentVersion: this.currentVersion,
        disabledReason: 'auto update is disabled in development mode',
      })
    }

    let state = createInitialDesktopUpdateState({
      enabled: true,
      currentVersion: this.currentVersion,
      disabledReason: null,
    })
    const info = this.createMockUpdateInfo()

    if (status === 'idle') {
      return state
    }
    if (status === 'checking') {
      return reduceDesktopUpdateState(state, { type: 'checking', at: this.now() })
    }
    if (status === 'not-available') {
      return reduceDesktopUpdateState(state, { type: 'not-available' })
    }
    if (status === 'available') {
      return reduceDesktopUpdateState(state, { type: 'available', info })
    }

    state = reduceDesktopUpdateState(state, { type: 'available', info })

    if (status === 'downloading') {
      return reduceDesktopUpdateState(state, {
        type: 'download-progress',
        progress: {
          percent: 58,
          transferred: 5_800_000,
          total: 10_000_000,
          bytesPerSecond: 1_200_000,
        },
      })
    }

    state = reduceDesktopUpdateState(state, {
      type: 'download-progress',
      progress: {
        percent: 100,
        transferred: 10_000_000,
        total: 10_000_000,
        bytesPerSecond: 0,
      },
    })
    state = reduceDesktopUpdateState(state, { type: 'downloaded', info })

    if (status === 'downloaded') {
      return state
    }
    if (status === 'installing') {
      return reduceDesktopUpdateState(state, { type: 'installing' })
    }

    return reduceDesktopUpdateState(
      createInitialDesktopUpdateState({
        enabled: true,
        currentVersion: this.currentVersion,
        disabledReason: null,
      }),
      {
        type: 'error',
        message: '模拟更新失败：无法连接到 GitHub Release。',
      },
    )
  }

  private createMockUpdateInfo(): DesktopUpdateInfo {
    return {
      version: '0.3.1-dev',
      releaseName: 'CCR dev update mock',
      releaseDate: this.now(),
    }
  }
}

function toDesktopUpdateInfo(info: UpdateInfo): DesktopUpdateInfo {
  return {
    version: info.version,
    releaseName: info.releaseName,
    releaseDate: info.releaseDate,
  }
}

const MOCKABLE_UPDATE_STATUSES = new Set<DesktopUpdateStatus>([
  'idle',
  'disabled',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'installing',
  'error',
])
