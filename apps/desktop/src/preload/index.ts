import { contextBridge, ipcRenderer } from 'electron'

type CcrDesktopEvent = {
  type: string
  payload: unknown
  status: unknown
  at: string
}

type DesktopConfirmTone = 'default' | 'warning' | 'danger'

type DesktopConfirmRequest = {
  id: string
  title: string
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel?: string
  tone?: DesktopConfirmTone
}

type DesktopConfirmResponse = {
  id: string
  confirmed: boolean
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

type UsageStatisticsInput = {
  from?: string
  to?: string
  provider?: string
  profileId?: string
  model?: string
  projectPath?: string
  sessionId?: string
  threadId?: string
  limit?: number
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

type McpNameInput = {
  name: string
}

type McpInstallSearchInput = {
  query?: string
}

type McpInstallPlanInput = {
  name?: string
  scope?: 'user' | 'project' | 'local'
  manifest: Record<string, unknown>
  force?: boolean
}

type McpInstallApplyInput = McpInstallPlanInput & {
  confirmed: boolean
  confirmationToken: string
}

type McpInstallSaveManifestInput = {
  manifest: Record<string, unknown>
  overwrite?: boolean
}

type McpInstallAdoptPlanInput = {
  name: string
}

type McpInstallAdoptApplyInput = McpInstallAdoptPlanInput & {
  confirmed: boolean
  confirmationToken: string
}

type ImportedMcpManifestResult = {
  canceled: boolean
  path?: string
  manifest?: Record<string, unknown>
  summary?: {
    schemaVersion?: 1
    name?: string
    kind?: string
    version?: string
    transport?: string
    permissionKinds?: string[]
    envNames?: string[]
    dataBoundary?: string
  }
}

type McpInstallUninstallInput = {
  name: string
  confirmed: boolean
}

type McpInstallRepairInput = {
  name: string
  scope?: 'user' | 'project' | 'local'
  confirmed: boolean
}

type SkillRefInput = {
  skillRef: string
}

type SkillInstallSearchInput = {
  query?: string
}

type SkillInstallPlanInput = {
  scope?: 'user' | 'project'
  manifest: Record<string, unknown>
  force?: boolean
  securityOverrideToken?: string
}

type SkillInstallApplyInput = SkillInstallPlanInput & {
  confirmed: boolean
  confirmationToken: string
}

type SkillImportPlanInput = {
  source: Record<string, unknown>
}

type SkillImportApplyInput = SkillImportPlanInput & {
  confirmed: boolean
  confirmationToken: string
}

type SkillSetEnabledInput = SkillRefInput & {
  enabled: boolean
}

type SkillSetInvocationInput = SkillRefInput & {
  modelInvocable?: boolean
  userInvocable?: boolean
}

type SkillInstallUninstallInput = SkillRefInput & {
  confirmed: boolean
}

type SkillInstallRepairInput = SkillInstallUninstallInput

type SkillInstallSaveManifestInput = {
  manifest: Record<string, unknown>
  overwrite?: boolean
}

type DesktopPathPickerInput = {
  mode: 'file' | 'directory'
  title?: string
  buttonLabel?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

type DesktopPathPickerResult = {
  canceled: boolean
  path?: string
}

type ResumeThreadInput = {
  sessionId: string
  title?: string
  transcriptPath?: string
  projectPath?: string
  metadata?: Record<string, unknown>
}

type RenameSessionHistoryInput = {
  sessionId: string
  title: string
  transcriptPath?: string
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
  choosePath: (input: DesktopPathPickerInput): Promise<DesktopPathPickerResult> =>
    ipcRenderer.invoke('ccr:choose-path', input),
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
  renameSessionHistory: (input: RenameSessionHistoryInput) =>
    ipcRenderer.invoke('ccr:rename-session-history', input),
  refreshMcp: () => ipcRenderer.invoke('ccr:refresh-mcp'),
  inspectMcp: (input: McpNameInput) =>
    ipcRenderer.invoke('ccr:mcp-inspect', input),
  enableMcp: (input: McpNameInput) =>
    ipcRenderer.invoke('ccr:mcp-enable', input),
  disableMcp: (input: McpNameInput) =>
    ipcRenderer.invoke('ccr:mcp-disable', input),
  restartMcp: (input: McpNameInput) =>
    ipcRenderer.invoke('ccr:mcp-restart', input),
  testMcp: (input: McpNameInput) => ipcRenderer.invoke('ccr:mcp-test', input),
  searchMcpInstalls: (input?: McpInstallSearchInput) =>
    ipcRenderer.invoke('ccr:mcp-install-search', input ?? {}),
  planMcpInstall: (input: McpInstallPlanInput) =>
    ipcRenderer.invoke('ccr:mcp-install-plan', input),
  chooseMcpInstallManifest: (): Promise<ImportedMcpManifestResult> =>
    ipcRenderer.invoke('ccr:mcp-install-choose-manifest'),
  applyMcpInstall: (input: McpInstallApplyInput) =>
    ipcRenderer.invoke('ccr:mcp-install-apply', input),
  saveMcpInstallManifest: (input: McpInstallSaveManifestInput) =>
    ipcRenderer.invoke('ccr:mcp-install-save-manifest', input),
  planMcpAdopt: (input: McpInstallAdoptPlanInput) =>
    ipcRenderer.invoke('ccr:mcp-install-adopt-plan', input),
  applyMcpAdopt: (input: McpInstallAdoptApplyInput) =>
    ipcRenderer.invoke('ccr:mcp-install-adopt-apply', input),
  listMcpInstalls: () => ipcRenderer.invoke('ccr:mcp-install-list'),
  uninstallMcp: (input: McpInstallUninstallInput) =>
    ipcRenderer.invoke('ccr:mcp-install-uninstall', input),
  repairMcp: (input: McpInstallRepairInput) =>
    ipcRenderer.invoke('ccr:mcp-install-repair', input),
  listSkillInstalls: () => ipcRenderer.invoke('ccr:skill-install-list'),
  inspectSkill: (input: SkillRefInput) =>
    ipcRenderer.invoke('ccr:skill-inspect', input),
  searchSkillInstalls: (input?: SkillInstallSearchInput) =>
    ipcRenderer.invoke('ccr:skill-install-search', input ?? {}),
  planSkillInstall: (input: SkillInstallPlanInput) =>
    ipcRenderer.invoke('ccr:skill-install-plan', input),
  applySkillInstall: (input: SkillInstallApplyInput) =>
    ipcRenderer.invoke('ccr:skill-install-apply', input),
  planSkillImport: (input: SkillImportPlanInput) =>
    ipcRenderer.invoke('ccr:skill-import-plan', input),
  applySkillImport: (input: SkillImportApplyInput) =>
    ipcRenderer.invoke('ccr:skill-import-apply', input),
  setSkillEnabled: (input: SkillSetEnabledInput) =>
    ipcRenderer.invoke('ccr:skill-state-enabled', input),
  setSkillInvocation: (input: SkillSetInvocationInput) =>
    ipcRenderer.invoke('ccr:skill-state-invocation', input),
  uninstallSkill: (input: SkillInstallUninstallInput) =>
    ipcRenderer.invoke('ccr:skill-install-uninstall', input),
  repairSkill: (input: SkillInstallRepairInput) =>
    ipcRenderer.invoke('ccr:skill-install-repair', input),
  saveSkillInstallManifest: (input: SkillInstallSaveManifestInput) =>
    ipcRenderer.invoke('ccr:skill-install-save-manifest', input),
  refreshRuntime: () => ipcRenderer.invoke('ccr:refresh-runtime'),
  runCompact: (instruction?: string) =>
    ipcRenderer.invoke('ccr:compact-run', instruction),
  getLogs: () => ipcRenderer.invoke('ccr:get-logs'),
  getUsageStatistics: (input?: UsageStatisticsInput) =>
    ipcRenderer.invoke('ccr:get-usage-statistics', input ?? {}),
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
  readClipboardText: (): Promise<string> =>
    ipcRenderer.invoke('ccr:read-clipboard-text'),
  respondPermission: (input: PermissionRespondInput) =>
    ipcRenderer.invoke('ccr:permission-respond', input),
  getPermissionSettings: () =>
    ipcRenderer.invoke('ccr:get-permission-settings'),
  updatePermissionSettings: (input: PermissionSettingsUpdateInput) =>
    ipcRenderer.invoke('ccr:update-permission-settings', input),
  respondConfirmRequest: (input: DesktopConfirmResponse) =>
    ipcRenderer.send('ccr:confirm-response', input),
  onConfirmRequest: (listener: (request: DesktopConfirmRequest) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      request: DesktopConfirmRequest,
    ) => {
      listener(request)
    }
    ipcRenderer.on('ccr:confirm-request', handler)
    return () => ipcRenderer.removeListener('ccr:confirm-request', handler)
  },
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
export type { CcrDesktopEvent, DesktopConfirmRequest, DesktopConfirmTone }
