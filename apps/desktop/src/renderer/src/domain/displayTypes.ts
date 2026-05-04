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
      model?: string
      contextWindow?: number
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

export type TurnRuntimeMetadata = {
  turnId?: string
  threadId?: string
  status?: string
  provider?: string
  model?: string
  contextWindow?: number
  usage?: TurnUsage
  stopReason?: string
  requestId?: string
  latencyMs?: number
  timeToFirstTokenMs?: number
  startedAt?: string | null
  completedAt?: string | null
  errorKind?: string
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
  toolUseId?: string
  toolName: string
  input: JsonObject
  status: 'pending' | 'allowed' | 'denied' | 'cancelled'
}

export type PageId = 'chat' | 'mcp' | 'settings' | 'logs'

export type LogSnapshot = {
  logDir: string
  files: Array<{
    name: string
    path: string
    content: string
  }>
}
