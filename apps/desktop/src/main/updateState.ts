export type DesktopUpdateStatus =
  | 'idle'
  | 'disabled'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

export type DesktopUpdateProgress = {
  percent: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
}

export type DesktopUpdateInfo = {
  version?: string
  releaseName?: string
  releaseDate?: string
}

export type DesktopUpdateState = {
  status: DesktopUpdateStatus
  enabled: boolean
  currentVersion: string
  source: 'github'
  availableUpdate: DesktopUpdateInfo | null
  progress: DesktopUpdateProgress | null
  lastCheckedAt: string | null
  lastError: string | null
  disabledReason: string | null
  canCheck: boolean
  canDownload: boolean
  canInstall: boolean
}

export type DesktopUpdateEvent =
  | {
      type: 'disabled'
      reason: string
    }
  | {
      type: 'checking'
      at: string
    }
  | {
      type: 'available'
      info: DesktopUpdateInfo
    }
  | {
      type: 'not-available'
      info?: DesktopUpdateInfo
    }
  | {
      type: 'download-progress'
      progress: DesktopUpdateProgress
    }
  | {
      type: 'downloaded'
      info: DesktopUpdateInfo
    }
  | {
      type: 'installing'
    }
  | {
      type: 'error'
      message: string
    }
  | {
      type: 'reset-error'
    }

export function createInitialDesktopUpdateState(input: {
  enabled: boolean
  currentVersion: string
  disabledReason?: string | null
}): DesktopUpdateState {
  return withCapabilities({
    status: input.enabled ? 'idle' : 'disabled',
    enabled: input.enabled,
    currentVersion: input.currentVersion,
    source: 'github',
    availableUpdate: null,
    progress: null,
    lastCheckedAt: null,
    lastError: null,
    disabledReason: input.disabledReason ?? null,
    canCheck: false,
    canDownload: false,
    canInstall: false,
  })
}

export function reduceDesktopUpdateState(
  state: DesktopUpdateState,
  event: DesktopUpdateEvent,
): DesktopUpdateState {
  if (state.status === 'disabled' && event.type !== 'disabled') {
    return state
  }

  switch (event.type) {
    case 'disabled':
      return withCapabilities({
        ...state,
        status: 'disabled',
        enabled: false,
        progress: null,
        lastError: null,
        disabledReason: event.reason,
      })
    case 'checking':
      return withCapabilities({
        ...state,
        status: 'checking',
        progress: null,
        lastError: null,
        lastCheckedAt: event.at,
      })
    case 'available':
      return withCapabilities({
        ...state,
        status: 'available',
        availableUpdate: event.info,
        progress: null,
        lastError: null,
      })
    case 'not-available':
      return withCapabilities({
        ...state,
        status: 'not-available',
        availableUpdate: event.info ?? null,
        progress: null,
        lastError: null,
      })
    case 'download-progress':
      return withCapabilities({
        ...state,
        status: 'downloading',
        progress: normalizeProgress(event.progress),
        lastError: null,
      })
    case 'downloaded':
      return withCapabilities({
        ...state,
        status: 'downloaded',
        availableUpdate: event.info,
        progress: {
          percent: 100,
          transferred: state.progress?.transferred,
          total: state.progress?.total,
          bytesPerSecond: state.progress?.bytesPerSecond,
        },
        lastError: null,
      })
    case 'installing':
      return withCapabilities({
        ...state,
        status: 'installing',
        lastError: null,
      })
    case 'error':
      return withCapabilities({
        ...state,
        status: 'error',
        progress: null,
        lastError: event.message,
      })
    case 'reset-error':
      return withCapabilities({
        ...state,
        status: 'idle',
        progress: null,
        lastError: null,
      })
  }
}

function normalizeProgress(progress: DesktopUpdateProgress): DesktopUpdateProgress {
  return {
    ...progress,
    percent: Math.max(0, Math.min(100, Number(progress.percent.toFixed(2)))),
  }
}

function withCapabilities(state: DesktopUpdateState): DesktopUpdateState {
  const enabledIdle =
    state.enabled &&
    (state.status === 'idle' || state.status === 'not-available' || state.status === 'error')

  return {
    ...state,
    canCheck: enabledIdle,
    canDownload: state.enabled && state.status === 'available',
    canInstall: state.enabled && state.status === 'downloaded',
  }
}
