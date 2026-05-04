import type { CoreTurnEvent } from '../core/index.js'
import type { JsonRpcNotification } from './protocol.js'

export function coreEventToJsonRpcNotification(
  event: CoreTurnEvent,
): JsonRpcNotification {
  switch (event.type) {
    case 'thread_started':
      return {
        jsonrpc: '2.0',
        method: 'thread/started',
        params: { thread: event.thread },
      }
    case 'turn_started':
      return {
        jsonrpc: '2.0',
        method: 'turn/started',
        params: {
          threadId: event.threadId,
          turnId: event.turnId,
          provider: event.provider,
          model: event.model,
          ...(event.metadata ? { metadata: event.metadata } : {}),
        },
      }
    case 'item_started':
      return {
        jsonrpc: '2.0',
        method: 'item/started',
        params: { item: event.item },
      }
    case 'item_delta':
      return {
        jsonrpc: '2.0',
        method: 'item/delta',
        params: {
          threadId: event.threadId,
          turnId: event.turnId,
          itemId: event.itemId,
          delta: event.delta,
        },
      }
    case 'item_completed':
      return {
        jsonrpc: '2.0',
        method: 'item/completed',
        params: {
          threadId: event.threadId,
          turnId: event.turnId,
          itemId: event.itemId,
          status: event.status,
          ...(event.content ? { content: event.content } : {}),
        },
      }
    case 'turn_completed':
      return {
        jsonrpc: '2.0',
        method: 'turn/completed',
        params: {
          threadId: event.threadId,
          turnId: event.turnId,
          ...(event.metadata ? { metadata: event.metadata } : {}),
        },
      }
    case 'turn_failed':
      return {
        jsonrpc: '2.0',
        method: 'turn/failed',
        params: {
          threadId: event.threadId,
          turnId: event.turnId,
          error: event.error,
          ...(event.metadata ? { metadata: event.metadata } : {}),
        },
      }
    case 'turn_cancelled':
      return {
        jsonrpc: '2.0',
        method: 'turn/cancelled',
        params: {
          threadId: event.threadId,
          turnId: event.turnId,
          reason: event.reason,
          ...(event.metadata ? { metadata: event.metadata } : {}),
        },
      }
    case 'permission_requested':
      return {
        jsonrpc: '2.0',
        method: 'permission/requested',
        params: event.request,
      }
    case 'permission_cancelled':
      return {
        jsonrpc: '2.0',
        method: 'permission/cancelled',
        params: {
          permissionRequestId: event.permissionRequestId,
          threadId: event.threadId,
          turnId: event.turnId,
          reason: event.reason,
        },
      }
  }
}
