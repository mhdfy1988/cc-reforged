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

type ModelListInput = {
  provider?: string
}

type AuthLoginInput = {
  profileId?: string
  provider?: string
}

type ModelSetInput = {
  profileId?: string
  provider?: string
  model: string
}

type ModelAvailabilityInput = {
  profileId?: string
  provider?: string
  model?: string
}

type ModelTestInput = {
  profileId?: string
  provider?: string
  model?: string
  prompt?: string
}

type ModelCredentialUpdateInput = {
  profileId?: string
  provider: string
  model?: string
  apiKey?: string | null
}

type ModelProfileSaveInput = {
  profileId?: string
  name?: string
  providerType: string
  apiMode?: 'anthropic-messages' | 'openai-responses' | 'openai-chat' | 'custom'
  authStrategy?:
    | 'api_key'
    | 'oauth_refreshable'
    | 'oauth_external'
    | 'external_process'
    | 'hybrid'
    | 'unknown'
  accountId?: string
  baseUrl?: string
  defaultModel?: string
  models?: string[]
  capabilityOverrides?: {
    default?: {
      inputModalities?: Array<'text' | 'image' | 'file' | 'audio'>
      outputModalities?: Array<'text' | 'image' | 'audio'>
      tools?: boolean
      structuredOutput?: boolean
      image?: {
        maxImages?: number
        maxImageBytes?: number
        mimeTypes?: string[]
      }
      reason?: string
    }
    models?: Record<
      string,
      {
        inputModalities?: Array<'text' | 'image' | 'file' | 'audio'>
        outputModalities?: Array<'text' | 'image' | 'audio'>
        tools?: boolean
        structuredOutput?: boolean
        image?: {
          maxImages?: number
          maxImageBytes?: number
          mimeTypes?: string[]
        }
        reason?: string
      }
    >
  }
  setCurrent?: boolean
}

type ModelProfileCopyInput = {
  profileId: string
  name?: string
}

type ModelProfileDeleteInput = {
  profileId: string
}

type ResumeThreadInput = {
  sessionId: string
  title?: string
  transcriptPath?: string
  projectPath?: string
  metadata?: Record<string, unknown>
}

type DesktopAttachmentSource =
  | {
      kind: 'file'
      path: string
    }
  | {
      kind: 'contentRef'
      contentRef: string
    }

type DesktopAttachmentPrepareInput = {
  attachments: Array<{
    id: string
    name: string
    path?: string
    data?: ArrayBuffer
    mimeType: string
    sizeBytes: number
    modality: 'image' | 'file' | 'audio'
  }>
}

type DesktopPreparedAttachment = {
  id: string
  attachmentId?: string
  displayName: string
  mimeType: string
  sizeBytes: number
  modality: 'image' | 'file' | 'audio'
  source?: DesktopAttachmentSource
  previewDataUrl?: string
  previewText?: string
  textContent?: string
  contentRef?: string
  sendMode?: 'image' | 'text' | 'metadata'
  safety?: 'workspace' | 'outside_workspace'
  status: 'ready' | 'rejected'
  error?: string
}

type DesktopAttachmentPrepareResult = {
  attachments: DesktopPreparedAttachment[]
}

type DesktopImagePreviewInput = {
  path: string
  maxEdge?: number
}

type DesktopImagePreviewResult = {
  previewDataUrl?: string
}

type DesktopWindowControlState = {
  maximized: boolean
  fullscreen: boolean
}

type DesktopTurnAttachmentInput = {
  type: 'image' | 'text'
  attachmentId: string
  displayName: string
  mimeType: string
  sizeBytes: number
  source: DesktopAttachmentSource
  text?: string
}

type DesktopImageGenerationOption =
  | boolean
  | {
      enabled?: boolean
      prompt?: string
      model?: string
      size?: string
      quality?: string
      outputFormat?: string
      responseFormat?: 'b64_json' | 'url'
      n?: number
      metadata?: Record<string, unknown>
    }

type DesktopStartTurnInput = {
  text: string
  attachments?: DesktopTurnAttachmentInput[]
  options?: {
    imageGeneration?: DesktopImageGenerationOption
  }
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
  loginAuth: (input?: AuthLoginInput) =>
    ipcRenderer.invoke('ccr:auth-login', input ?? {}),
  listModels: (input?: ModelListInput) =>
    ipcRenderer.invoke('ccr:list-models', input ?? {}),
  setModel: (input: ModelSetInput) =>
    ipcRenderer.invoke('ccr:set-model', input),
  getModelAvailability: (input?: ModelAvailabilityInput) =>
    ipcRenderer.invoke('ccr:model-availability', input ?? {}),
  testModelConnection: (input?: ModelTestInput) =>
    ipcRenderer.invoke('ccr:model-test', input ?? {}),
  saveModelProfile: (input: ModelProfileSaveInput) =>
    ipcRenderer.invoke('ccr:model-profile-save', input),
  copyModelProfile: (input: ModelProfileCopyInput) =>
    ipcRenderer.invoke('ccr:model-profile-copy', input),
  deleteModelProfile: (input: ModelProfileDeleteInput) =>
    ipcRenderer.invoke('ccr:model-profile-delete', input),
  updateModelCredential: (input: ModelCredentialUpdateInput) =>
    ipcRenderer.invoke('ccr:model-credential-update', input),
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
  prepareAttachments: (
    input: DesktopAttachmentPrepareInput,
  ): Promise<DesktopAttachmentPrepareResult> =>
    ipcRenderer.invoke('ccr:prepare-attachments', input),
  getImagePreview: (
    input: DesktopImagePreviewInput,
  ): Promise<DesktopImagePreviewResult> =>
    ipcRenderer.invoke('ccr:image-preview', input),
  getWindowState: (): Promise<DesktopWindowControlState> =>
    ipcRenderer.invoke('ccr:window-state'),
  minimizeWindow: (): Promise<DesktopWindowControlState> =>
    ipcRenderer.invoke('ccr:window-minimize'),
  toggleMaximizeWindow: (): Promise<DesktopWindowControlState> =>
    ipcRenderer.invoke('ccr:window-toggle-maximize'),
  closeWindow: (): Promise<DesktopWindowControlState> =>
    ipcRenderer.invoke('ccr:window-close'),
  startTurn: (input: string | DesktopStartTurnInput) =>
    ipcRenderer.invoke('ccr:start-turn', input),
  interruptTurn: () => ipcRenderer.invoke('ccr:turn-interrupt'),
  openPath: (path: string) => ipcRenderer.invoke('ccr:open-path', path),
  showItemInFolder: (path: string) =>
    ipcRenderer.invoke('ccr:show-item-in-folder', path),
  savePathAs: (path: string) => ipcRenderer.invoke('ccr:save-path-as', path),
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
  onWindowState: (listener: (state: DesktopWindowControlState) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: DesktopWindowControlState,
    ) => {
      listener(state)
    }
    ipcRenderer.on('ccr:window-state', handler)
    return () => ipcRenderer.removeListener('ccr:window-state', handler)
  },
}

contextBridge.exposeInMainWorld('ccr', api)

export type CcrDesktopApi = typeof api
export type { CcrDesktopEvent }
