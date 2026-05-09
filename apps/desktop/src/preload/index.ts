import { contextBridge, ipcRenderer } from 'electron'

type CcrDesktopEvent = {
  type: string
  payload: unknown
  status: unknown
  at: string
}

type PermissionRespondInput = {
  permissionRequestId: string
  behavior: 'allow' | 'deny'
  updatedInput?: Record<string, unknown>
  updatedPermissions?: unknown[]
  message?: string
  acceptFeedback?: string
  interrupt?: boolean
  toolUseID?: string
  decisionClassification?: 'user_temporary' | 'user_permanent' | 'user_reject'
}

type SessionHistoryListInput = {
  scope?: 'sameRepo' | 'allProjects'
  query?: string
  limit?: number
  cursor?: string
  includeCurrent?: boolean
}

type ResumeThreadInput = {
  sessionId: string
  title?: string
  transcriptPath?: string
  projectPath?: string
  metadata?: Record<string, unknown>
}

type PermissionSettingsUpdateInput = {
  source: 'localSettings' | 'projectSettings' | 'userSettings'
  permissions: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
    defaultMode?:
      | 'acceptEdits'
      | 'bypassPermissions'
      | 'default'
      | 'dontAsk'
      | 'plan'
      | null
    disableBypassPermissionsMode?: boolean | null
    additionalDirectories?: string[]
  }
}

const api = {
  getStatus: () => ipcRenderer.invoke('ccr:get-status'),
  restartAppServer: () => ipcRenderer.invoke('ccr:restart-app-server'),
  chooseWorkspace: () => ipcRenderer.invoke('ccr:choose-workspace'),
  openWorkspace: (path: string) => ipcRenderer.invoke('ccr:open-workspace', path),
  startThread: (title?: string) => ipcRenderer.invoke('ccr:start-thread', title),
  listThreads: () => ipcRenderer.invoke('ccr:list-threads'),
  listSessionHistory: (input?: SessionHistoryListInput) =>
    ipcRenderer.invoke('ccr:list-session-history', input ?? {}),
  resumeThread: (input: ResumeThreadInput | string, title?: string) =>
    ipcRenderer.invoke('ccr:resume-thread', input, title),
  refreshMcp: () => ipcRenderer.invoke('ccr:refresh-mcp'),
  refreshRuntime: () => ipcRenderer.invoke('ccr:refresh-runtime'),
  runCompact: (instruction?: string) =>
    ipcRenderer.invoke('ccr:compact-run', instruction),
  getLogs: () => ipcRenderer.invoke('ccr:get-logs'),
  getUpdateStatus: () => ipcRenderer.invoke('ccr:update-status'),
  checkForUpdates: () => ipcRenderer.invoke('ccr:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('ccr:update-download'),
  installUpdate: () => ipcRenderer.invoke('ccr:update-install'),
  mockUpdateState: (status: string) => ipcRenderer.invoke('ccr:update-dev-mock', status),
  startTurn: (text: string) => ipcRenderer.invoke('ccr:start-turn', text),
  interruptTurn: () => ipcRenderer.invoke('ccr:turn-interrupt'),
  openPath: (path: string) => ipcRenderer.invoke('ccr:open-path', path),
  showItemInFolder: (path: string) =>
    ipcRenderer.invoke('ccr:show-item-in-folder', path),
  copyText: (text: string) => ipcRenderer.invoke('ccr:copy-text', text),
  respondPermission: (input: PermissionRespondInput) =>
    ipcRenderer.invoke('ccr:permission-respond', input),
  getPermissionSettings: () =>
    ipcRenderer.invoke('ccr:get-permission-settings'),
  updatePermissionSettings: (input: PermissionSettingsUpdateInput) =>
    ipcRenderer.invoke('ccr:update-permission-settings', input),
  onEvent: (listener: (event: CcrDesktopEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: CcrDesktopEvent) => {
      listener(payload)
    }
    ipcRenderer.on('ccr:event', handler)
    return () => ipcRenderer.removeListener('ccr:event', handler)
  },
}

contextBridge.exposeInMainWorld('ccr', api)

export type CcrDesktopApi = typeof api
export type { CcrDesktopEvent }
