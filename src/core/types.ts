export type CoreJsonObject = Record<string, unknown>

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
  input: {
    type: 'text'
    text: string
  }
  provider: string
  model: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  error: CoreJsonObject | null
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
      itemId: string
      status: string
      content?: readonly CoreJsonObject[]
    }
  | {
      type: 'turn_completed'
      threadId: string
      turnId: string
    }
  | {
      type: 'turn_failed'
      threadId: string
      turnId: string
      error: CoreJsonObject
    }
  | {
      type: 'turn_cancelled'
      threadId: string
      turnId: string
      reason: string
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
