import {
  createCcrErrorSnapshot,
  type CcrErrorSnapshot,
} from '../types/errorSnapshot.js'
import type {
  ThreadDisplayProjectionIdentity,
} from './threadDisplayProjection.js'

export function createAppServerErrorSnapshot(input: {
  message: string
  itemId: string
  threadId?: string
  turnId?: string
}): CcrErrorSnapshot {
  return createCcrErrorSnapshot({
    message: input.message,
    source: 'app_server',
    safeDetails: {
      itemId: input.itemId,
      threadId: input.threadId,
      turnId: input.turnId,
    },
  })
}

export function createToolErrorSnapshot(input: {
  message: string
  identity: ThreadDisplayProjectionIdentity
  toolName?: string
  errorClass?: string
  status?: string
}): CcrErrorSnapshot {
  return createCcrErrorSnapshot({
    message: input.message,
    source: 'tool',
    category: 'tool_error',
    turnId: input.identity.turnId,
    toolUseId: input.identity.toolUseId,
    safeDetails: {
      toolName: input.toolName,
      errorClass: input.errorClass,
      status: input.status,
    },
  })
}
