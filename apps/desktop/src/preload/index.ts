import { contextBridge, ipcRenderer } from 'electron'

type CcrDesktopEvent = {
  type: string
  payload: unknown
  status: unknown
  at: string
}

const api = {
  getStatus: () => ipcRenderer.invoke('ccr:get-status'),
  restartAppServer: () => ipcRenderer.invoke('ccr:restart-app-server'),
  chooseWorkspace: () => ipcRenderer.invoke('ccr:choose-workspace'),
  openWorkspace: (path: string) => ipcRenderer.invoke('ccr:open-workspace', path),
  startThread: (title?: string) => ipcRenderer.invoke('ccr:start-thread', title),
  refreshMcp: () => ipcRenderer.invoke('ccr:refresh-mcp'),
  getLogs: () => ipcRenderer.invoke('ccr:get-logs'),
  getUpdateStatus: () => ipcRenderer.invoke('ccr:update-status'),
  checkForUpdates: () => ipcRenderer.invoke('ccr:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('ccr:update-download'),
  installUpdate: () => ipcRenderer.invoke('ccr:update-install'),
  startTurn: (text: string) => ipcRenderer.invoke('ccr:start-turn', text),
  respondPermission: (input: {
    permissionRequestId: string
    behavior: 'allow' | 'deny'
    message?: string
  }) => ipcRenderer.invoke('ccr:permission-respond', input),
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
