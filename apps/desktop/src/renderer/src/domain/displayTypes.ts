export type DesktopStatus = {
  appServer: string
  platform: string
  repoRoot: string
  runtimeMode: string
  workspacePath: string | null
  initialized: {
    serverVersion?: string
    protocolVersion: string
    schemaVersions?: {
      config?: string
    }
    serverInfo: {
      version?: string
      serverVersion?: string
      coreVersion: string
    }
  } | null
  protocolCompatibility: {
    compatible: boolean
    supportedProtocol: string
    actualProtocol: string
    reason?: string
  } | null
  config: {
    llm?: {
      provider?: string
      providerDisplayName?: string
      profileId?: string
      model?: string
      contextWindow?: number
      authStrategy?: LlmAuthStrategy
      apiMode?: LlmApiMode
      capabilities?: LlmProviderCapabilities
      modelCatalogEntry?: LlmModelCatalogEntry
      modelCapabilities?: LlmModelCapabilities
      baseUrl?: string
      configPath?: string
      configSource?: string
    }
  } | null
  auth: {
    available?: boolean
    provider?: string
  } | null
  mcp: {
    servers?: unknown[]
    errors?: unknown[]
  } | null
  context: RuntimeContextStatus | null
  compact: RuntimeCompactStatus | null
  memory: RuntimeMemoryStatus | null
  permissionSettings: PermissionSettingsState | null
  thread: {
    threadId: string
    title: string
  } | null
  lastTurn: {
    turnId: string
    status: string
    metadata?: TurnRuntimeMetadata
  } | null
  updates: DesktopUpdateState | null
  lastError: string | null
}

export type TurnUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
}

export type LlmModelCatalogEntry = {
  provider: string
  model: string
  displayName?: string
  contextWindow?: number
  maxOutputTokens?: number
  supportsReasoning?: boolean
  supportsTools?: boolean
  inputModalities?: string[]
  modelCapabilities?: LlmModelCapabilities
}

export type LlmModelCapabilitySource =
  | 'builtin'
  | 'profile_override'
  | 'default'

export type LlmModelCapabilities = {
  inputModalities: string[]
  outputModalities: string[]
  tools: boolean
  structuredOutput: boolean
  source: LlmModelCapabilitySource
  reason: string
  baseSource?: LlmModelCapabilitySource
  image?: {
    maxImages?: number
    maxImageBytes?: number
    mimeTypes?: string[]
  }
}

export type LlmApiMode =
  | 'anthropic-messages'
  | 'openai-responses'
  | 'openai-chat'
  | 'custom'

export type LlmAuthStrategy =
  | 'api_key'
  | 'oauth_refreshable'
  | 'oauth_external'
  | 'external_process'
  | 'hybrid'
  | 'unknown'

export type LlmProviderCapabilities = {
  streaming?: boolean
  tools?: boolean
  reasoning?: boolean
  usage?: boolean
}

export type LlmModelProviderCatalog = {
  id: string
  displayName?: string
  authStrategy?: LlmAuthStrategy
  apiMode?: LlmApiMode
  capabilities?: LlmProviderCapabilities
  profiles?: string[]
  models?: LlmModelCatalogEntry[]
}

export type LlmModelProfile = {
  id: string
  name: string
  providerType: string
  apiMode?: LlmApiMode
  authStrategy?: LlmAuthStrategy
  accountId?: string
  baseUrl?: string
  defaultModel?: string
  models?: string[]
  capabilities?: LlmProviderCapabilities
  capabilityOverrides?: {
    default?: Partial<LlmModelCapabilities>
    models?: Record<string, Partial<LlmModelCapabilities>>
  }
  source?: 'file'
  isCurrent?: boolean
}

export type LlmModelListState = {
  current?: {
    profileId?: string
    provider?: string
    model?: string
  }
  profiles?: LlmModelProfile[]
  providers?: LlmModelProviderCatalog[]
}

export type LlmModelAvailabilityState =
  | 'not_configured'
  | 'needs_auth'
  | 'configured'
  | 'auth_ready'
  | 'verified'
  | 'failed'

export type LlmModelAvailability = {
  provider?: string
  providerDisplayName?: string
  profileId?: string
  profileName?: string
  model?: string
  state?: LlmModelAvailabilityState
  configured?: boolean
  available?: boolean
  testable?: boolean
  networkChecked?: boolean
  checkedAt?: string
  latencyMs?: number
  auth?: {
    state?: string
    configured?: boolean
    available?: boolean
    message?: string
    source?: string
    accountId?: string
    expiresAt?: number
    baseUrl?: string
  }
  apiMode?: LlmApiMode
  authStrategy?: LlmAuthStrategy
  capabilities?: LlmProviderCapabilities
  modelCatalogEntry?: LlmModelCatalogEntry
  modelCapabilities?: LlmModelCapabilities
  baseUrl?: string
  configPath?: string
  configSource?: string
  ok?: boolean
  error?: {
    kind?: string
    message?: string
  }
  response?: {
    stopReason?: string
    text?: string
    usage?: TurnUsage
  }
}

export type LlmModelCredentialUpdateResult = {
  provider?: string
  model?: string
  credential?: {
    configured?: boolean
    source?: string
  }
  availability?: LlmModelAvailability
}

export type LlmModelProfileSaveInput = {
  profileId?: string
  name?: string
  providerType: string
  apiMode?: LlmApiMode
  authStrategy?: LlmAuthStrategy
  accountId?: string
  baseUrl?: string
  defaultModel?: string
  models?: string[]
  capabilityOverrides?: LlmModelProfile['capabilityOverrides']
  setCurrent?: boolean
}

export type LlmModelProfileMutationResult = {
  current?: LlmModelListState['current']
  profile?: LlmModelProfile
  profiles?: LlmModelProfile[]
}

export type TurnRuntimeMetadata = {
  turnId?: string
  threadId?: string
  status?: string
  provider?: string
  providerDisplayName?: string
  profileId?: string
  profileName?: string
  apiMode?: LlmApiMode | string
  authStrategy?: LlmAuthStrategy | string
  model?: string
  requestedModel?: string
  contextWindow?: number
  usage?: TurnUsage
  stopReason?: string
  requestId?: string
  latencyMs?: number
  timeToFirstTokenMs?: number
  startedAt?: string | null
  completedAt?: string | null
  errorKind?: string
  estimatedTokens?: number
  messageCount?: number
  compactBoundaryCount?: number
  readFileStateSize?: number
}

export type RuntimeContextStatus = {
  available?: boolean
  threadId?: string
  activeTurnId?: string | null
  provider?: string
  providerDisplayName?: string
  profileId?: string
  profileName?: string
  apiMode?: LlmApiMode | string
  authStrategy?: LlmAuthStrategy | string
  model?: string
  contextWindow?: number
  estimatedTokens?: number
  messageCount?: number
  compactBoundaryCount?: number
  readFileStateSize?: number
  usage?: TurnUsage
  sessionStorageStatus?: string
  contentReplacement?: {
    enabled?: boolean
    seenCount?: number
    replacementCount?: number
  }
  memoryAttachments?: {
    nestedTriggerCount?: number
    loadedNestedMemoryPathCount?: number
    dynamicSkillTriggerCount?: number
    discoveredSkillCount?: number
  }
}

export type RuntimeCompactStatus = {
  available?: boolean
  threadId?: string
  estimatedTokens?: number
  effectiveContextWindow?: number
  autoCompactEnabled?: boolean
  autoCompactThreshold?: number
  distanceToAutoCompact?: number
  compactBoundaryCount?: number
  lastCompactBoundaryAt?: string
}

export type RuntimeMemoryStatus = {
  available?: boolean
  threadId?: string
  hookRegistered?: boolean
  autoCompactEnabled?: boolean
  gateEnabled?: boolean
  initialized?: boolean
  contentLength?: number
  memoryPath?: string
  sessionStorageStatus?: string
}

export type PermissionSettingsValue = {
  allow: string[]
  deny: string[]
  ask: string[]
  defaultMode: PermissionModeSetting | string | null
  disableBypassPermissionsMode: boolean
  additionalDirectories: string[]
}

export type PermissionModeSetting =
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'default'
  | 'dontAsk'
  | 'plan'

export type PermissionSettingsSourceId =
  | 'localSettings'
  | 'projectSettings'
  | 'userSettings'
  | 'flagSettings'
  | 'policySettings'

export type EditablePermissionSettingsSource =
  | 'localSettings'
  | 'projectSettings'
  | 'userSettings'

export type PermissionSettingsSource = {
  source: PermissionSettingsSourceId
  label: string
  editable: boolean
  enabled: boolean
  path?: string
  readPaths: string[]
  permissions: PermissionSettingsValue
}

export type PermissionSettingsState = {
  effective: PermissionSettingsValue
  sources: PermissionSettingsSource[]
  editableSources: EditablePermissionSettingsSource[]
  defaultSource: EditablePermissionSettingsSource
  modes: Array<{
    value: PermissionModeSetting
    label: string
  }>
}

export type PermissionSettingsUpdateInput = {
  source: EditablePermissionSettingsSource
  permissions: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
    defaultMode?: PermissionModeSetting | null
    disableBypassPermissionsMode?: boolean | null
    additionalDirectories?: string[]
  }
}

export type DesktopUpdateState = {
  status: string
  enabled: boolean
  currentVersion: string
  source: string
  availableUpdate: {
    version?: string
    releaseName?: string
    releaseDate?: string
  } | null
  progress: {
    percent: number
    transferred?: number
    total?: number
    bytesPerSecond?: number
  } | null
  lastCheckedAt: string | null
  lastError: string | null
  disabledReason: string | null
  canCheck: boolean
  canDownload: boolean
  canInstall: boolean
}

export type JsonObject = Record<string, unknown>

export type NotificationPayload = {
  method: string
  params?: JsonObject
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'error'
  text: string
  status?: string
  kind?: string
}

export type PermissionCard = {
  permissionRequestId: string
  threadId?: string
  turnId?: string
  toolUseId?: string
  toolName: string
  displayName?: string
  description?: string
  input: JsonObject
  permissionSuggestions?: unknown[]
  blockedPath?: string
  decisionReason?: string
  agentId?: string
  createdAt?: string
  interactionKind?: PermissionInteractionKind
  status: 'pending' | 'allowed' | 'denied' | 'cancelled'
}

export type PermissionInteractionKind =
  | 'ask_user_question'
  | 'plan_approval'
  | 'enter_plan_mode'
  | 'shell_permission'
  | 'file_permission'
  | 'web_fetch'
  | 'skill'
  | 'review_artifact'
  | 'workflow'
  | 'monitor'
  | 'fallback'

export type PermissionRespondPayload = {
  updatedInput?: JsonObject
  updatedPermissions?: unknown[]
  message?: string
  acceptFeedback?: string
  interrupt?: boolean
  toolUseID?: string
  decisionClassification?: 'user_temporary' | 'user_permanent' | 'user_reject'
}

export type ThreadHistoryItem = {
  threadId?: string
  sessionId?: string
  title?: string
  titleSource?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  messageCount?: number
  projectPath?: string
  transcriptPath?: string
  firstPrompt?: string
  lastPrompt?: string
  summary?: string
  isCurrentSession?: boolean
  activeTurnId?: string | null
  metadata?: Record<string, unknown>
}

export type ThreadHistoryScope = 'sameRepo' | 'allProjects'

export type ThreadHistoryGroup = {
  workspacePath: string
  workspaceName: string
  isCurrentWorkspace: boolean
  updatedAt: string
  sessionCount: number
  sessions: ThreadHistoryItem[]
}

export type ThreadHistoryState = {
  status: 'closed' | 'loading' | 'ready' | 'empty' | 'error'
  scope: ThreadHistoryScope
  query: string
  groups: ThreadHistoryGroup[]
  threads: ThreadHistoryItem[]
  nextCursor?: string
  error?: string
}

export type PageId = 'chat' | 'models' | 'mcp' | 'settings' | 'logs'

export type LogSnapshot = {
  logDir: string
  files: Array<{
    name: string
    path: string
    content: string
  }>
}
