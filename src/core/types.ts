import type {
  CcrAttachmentContentBlockBase,
  CcrContentSource,
  CcrTextContentBlock,
} from '../types/contentBlocks.js'

export type CoreJsonObject = Record<string, unknown>

export type CoreContentSource = CcrContentSource

export type CoreAttachmentContentBlock = Omit<
  CcrAttachmentContentBlockBase,
  'previewDataUrl'
>

export type CoreTextContentBlock = CcrTextContentBlock

export type CoreImageContentBlock = CoreAttachmentContentBlock & {
  type: 'image'
}

export type CoreFileContentBlock = CoreAttachmentContentBlock & {
  type: 'file'
}

export type CoreAudioContentBlock = CoreAttachmentContentBlock & {
  type: 'audio'
}

export type CoreUserContentBlock =
  | CoreTextContentBlock
  | CoreImageContentBlock
  | CoreFileContentBlock
  | CoreAudioContentBlock

export type CoreTurnInput =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'content'
      text: string
      content: CoreUserContentBlock[]
    }

export type CoreWorkspace = {
  path: string
  trusted: boolean
}

export type CoreThreadStatus = 'active' | 'archived' | 'closed'

export type CoreTurnStatus =
  | 'queued'
  | 'running'
  | 'waiting_permission'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'

export type CoreTurnUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
  raw?: unknown
}

export type CoreTurnMetadata = {
  provider?: string
  providerDisplayName?: string
  profileId?: string
  profileName?: string
  apiMode?: string
  authStrategy?: string
  model?: string
  requestedModel?: string
  contextWindow?: number
  messageCount?: number
  lastMessageTypes?: string[]
  compactBoundaryCount?: number
  readFileStateSize?: number
  sessionId?: string
  sessionStoragePath?: string
  sessionStorageStatus?: string
  derivedTitle?: string
  firstUserMessagePreview?: string
  usage?: CoreTurnUsage
  stopReason?: string
  requestId?: string
  latencyMs?: number
  timeToFirstTokenMs?: number
  startedAt?: string | null
  completedAt?: string | null
  errorKind?: string
  multimodalInput?: CoreJsonObject
}

export type CoreThread = {
  threadId: string
  workspacePath: string
  title: string
  status: CoreThreadStatus
  createdAt: string
  updatedAt: string
  activeTurnId: string | null
  metadata: CoreJsonObject
}

export type CoreTurn = {
  turnId: string
  threadId: string
  status: CoreTurnStatus
  input: CoreTurnInput
  provider: string
  model: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  error: CoreJsonObject | null
  metadata: CoreTurnMetadata
}

export type CoreItem = CoreJsonObject & {
  itemId: string
  threadId: string
  turnId: string
  kind: string
  status: string
}

export type CorePermissionRequest = {
  permissionRequestId: string
  threadId: string
  turnId: string
  tool: {
    name: string
    displayName?: string
    description?: string
  }
  input: CoreJsonObject
  permissionSuggestions?: readonly CoreJsonObject[]
  blockedPath?: string
  decisionReason?: string
  toolUseId: string
  agentId?: string
  createdAt: string
}

export type CoreTurnEvent =
  | {
      type: 'thread_started'
      thread: CoreThread
    }
  | {
      type: 'turn_started'
      threadId: string
      turnId: string
      provider: string
      model: string
      metadata?: CoreTurnMetadata
    }
  | {
      type: 'item_started'
      item: CoreItem
    }
  | {
      type: 'item_delta'
      threadId: string
      turnId: string
      itemId: string
      delta: CoreJsonObject
    }
  | {
      type: 'item_completed'
      threadId: string
      turnId: string
      itemId: string
      status: string
      content?: readonly CoreJsonObject[]
    }
  | {
      type: 'turn_completed'
      threadId: string
      turnId: string
      metadata?: CoreTurnMetadata
    }
  | {
      type: 'turn_failed'
      threadId: string
      turnId: string
      error: CoreJsonObject
      metadata?: CoreTurnMetadata
    }
  | {
      type: 'turn_cancelled'
      threadId: string
      turnId: string
      reason: string
      metadata?: CoreTurnMetadata
    }
  | {
      type: 'context_compacted'
      threadId: string
      compactedAt: string
      metadata?: CoreTurnMetadata
      result: CoreJsonObject
    }
  | {
      type: 'permission_requested'
      request: CorePermissionRequest
    }
  | {
      type: 'permission_cancelled'
      permissionRequestId: string
      threadId: string
      turnId: string
      reason: string
    }

export type CoreEventEmitter = (event: CoreTurnEvent) => void
