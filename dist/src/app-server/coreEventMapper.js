import { coreEventToThreadDisplayPatch } from './threadDisplay.js';
export function coreEventToJsonRpcNotification(event) {
    switch (event.type) {
        case 'thread_started':
            return {
                jsonrpc: '2.0',
                method: 'thread/started',
                params: { thread: event.thread },
            };
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
            };
        case 'turn_completed':
            return {
                jsonrpc: '2.0',
                method: 'turn/completed',
                params: {
                    threadId: event.threadId,
                    turnId: event.turnId,
                    ...(event.metadata ? { metadata: event.metadata } : {}),
                },
            };
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
            };
        case 'item_started':
        case 'item_delta':
        case 'item_completed':
        case 'turn_failed':
        case 'context_compaction_started':
        case 'context_compacted':
        case 'permission_requested':
        case 'permission_cancelled':
            return null;
    }
}
export function coreEventToThreadDisplayPatchNotification(event) {
    const patch = coreEventToThreadDisplayPatch(event);
    if (!patch) {
        return null;
    }
    return {
        jsonrpc: '2.0',
        method: 'thread/display/patch',
        params: patch,
    };
}
//# sourceMappingURL=coreEventMapper.js.map