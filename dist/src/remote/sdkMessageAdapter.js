import { logForDebugging } from '../utils/debug.js';
import { fromSDKCompactMetadata } from '../utils/messages/mappers.js';
import { createUserMessage } from '../utils/messages.js';
const STREAM_START_BLOCK_TYPES = new Set([
    'thinking',
    'redacted_thinking',
    'text',
    'tool_use',
    'server_tool_use',
    'web_search_tool_result',
    'code_execution_tool_result',
    'mcp_tool_use',
    'mcp_tool_result',
    'container_upload',
    'web_fetch_tool_result',
    'bash_code_execution_tool_result',
    'text_editor_code_execution_tool_result',
    'tool_search_tool_result',
    'compaction',
]);
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function isAssistantEnvelope(value) {
    return isRecord(value) && 'content' in value;
}
function isStreamEventPayload(value) {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return false;
    }
    switch (value.type) {
        case 'message_start':
        case 'message_stop':
        case 'content_block_stop':
        case 'message_delta':
            return true;
        case 'content_block_start':
            return (typeof value.index === 'number' &&
                isRecord(value.content_block) &&
                typeof value.content_block.type === 'string' &&
                STREAM_START_BLOCK_TYPES.has(value.content_block.type) &&
                (value.content_block.type !== 'tool_use' ||
                    (typeof value.content_block.id === 'string' &&
                        typeof value.content_block.name === 'string' &&
                        'input' in value.content_block)));
        case 'content_block_delta':
            if (typeof value.index !== 'number' ||
                !isRecord(value.delta) ||
                typeof value.delta.type !== 'string') {
                return false;
            }
            switch (value.delta.type) {
                case 'text_delta':
                    return typeof value.delta.text === 'string';
                case 'input_json_delta':
                    return typeof value.delta.partial_json === 'string';
                case 'thinking_delta':
                    return typeof value.delta.thinking === 'string';
                case 'signature_delta':
                    return true;
                default:
                    return false;
            }
        default:
            return false;
    }
}
function isUserMessageContent(value) {
    return typeof value === 'string' || isContentBlockArray(value);
}
function isToolResultBlock(value) {
    return (isRecord(value) &&
        value.type === 'tool_result' &&
        typeof value.tool_use_id === 'string');
}
function isTextContentBlock(value) {
    return isRecord(value) && value.type === 'text' && typeof value.text === 'string';
}
function isContentBlockArray(value) {
    return (Array.isArray(value) &&
        value.every(block => isTextContentBlock(block) || isToolResultBlock(block)));
}
/**
 * Converts SDKMessage from CCR to REPL Message types.
 *
 * The CCR backend sends SDK-format messages via WebSocket. The REPL expects
 * internal Message types for rendering. This adapter bridges the two.
 */
/**
 * Convert an SDKAssistantMessage to an AssistantMessage
 */
function convertAssistantMessage(msg, message) {
    return {
        type: 'assistant',
        message,
        uuid: msg.uuid,
        requestId: undefined,
        timestamp: new Date().toISOString(),
        error: msg.error,
    };
}
/**
 * Convert an SDKPartialAssistantMessage (streaming) to a StreamEvent
 */
function convertStreamEvent(event) {
    return {
        type: 'stream_event',
        event,
    };
}
/**
 * Convert an SDKResultMessage to a SystemMessage
 */
function convertResultMessage(msg) {
    const isError = msg.subtype !== 'success';
    const content = isError
        ? msg.errors?.join(', ') || 'Unknown error'
        : 'Session completed successfully';
    return {
        type: 'system',
        subtype: 'informational',
        content,
        level: isError ? 'warning' : 'info',
        uuid: msg.uuid,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Convert an SDKSystemMessage (init) to a SystemMessage
 */
function convertInitMessage(msg) {
    return {
        type: 'system',
        subtype: 'informational',
        content: `Remote session initialized (model: ${msg.model})`,
        level: 'info',
        uuid: msg.uuid,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Convert an SDKStatusMessage to a SystemMessage
 */
function convertStatusMessage(msg) {
    if (!msg.status) {
        return null;
    }
    return {
        type: 'system',
        subtype: 'informational',
        content: msg.status === 'compacting'
            ? 'Compacting conversation…'
            : `Status: ${msg.status}`,
        level: 'info',
        uuid: msg.uuid,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Convert an SDKToolProgressMessage to a SystemMessage.
 * We use a system message instead of ProgressMessage since the Progress type
 * is a complex union that requires tool-specific data we don't have from CCR.
 */
function convertToolProgressMessage(msg) {
    return {
        type: 'system',
        subtype: 'informational',
        content: `Tool ${msg.tool_name} running for ${msg.elapsed_time_seconds}s…`,
        level: 'info',
        uuid: msg.uuid,
        timestamp: new Date().toISOString(),
        toolUseID: msg.tool_use_id,
    };
}
/**
 * Convert an SDKCompactBoundaryMessage to a SystemMessage
 */
function convertCompactBoundaryMessage(msg) {
    return {
        type: 'system',
        subtype: 'compact_boundary',
        content: 'Conversation compacted',
        level: 'info',
        uuid: msg.uuid,
        timestamp: new Date().toISOString(),
        compactMetadata: fromSDKCompactMetadata(msg.compact_metadata),
    };
}
/**
 * Convert an SDKMessage to REPL message format
 */
export function convertSDKMessage(msg, opts) {
    switch (msg.type) {
        case 'assistant':
            if (!isAssistantEnvelope(msg.message)) {
                return { type: 'ignored' };
            }
            return {
                type: 'message',
                message: convertAssistantMessage(msg, msg.message),
            };
        case 'user': {
            const content = isAssistantEnvelope(msg.message)
                ? msg.message.content
                : undefined;
            // Tool result messages from the remote server need to be converted so
            // they render and collapse like local tool results. Detect via content
            // shape (tool_result blocks) — parent_tool_use_id is NOT reliable: the
            // agent-side normalizeMessage() hardcodes it to null for top-level
            // tool results, so it can't distinguish tool results from prompt echoes.
            const isToolResult = Array.isArray(content) && content.some(isToolResultBlock);
            if (opts?.convertToolResults && isToolResult) {
                return {
                    type: 'message',
                    message: createUserMessage({
                        content,
                        toolUseResult: msg.tool_use_result,
                        uuid: msg.uuid,
                        timestamp: msg.timestamp,
                    }),
                };
            }
            // When converting historical events, user-typed messages need to be
            // rendered (they weren't added locally by the REPL). Skip tool_results
            // here — already handled above.
            if (opts?.convertUserTextMessages && !isToolResult) {
                if (isUserMessageContent(content)) {
                    return {
                        type: 'message',
                        message: createUserMessage({
                            content,
                            toolUseResult: msg.tool_use_result,
                            uuid: msg.uuid,
                            timestamp: msg.timestamp,
                        }),
                    };
                }
            }
            // User-typed messages (string content) are already added locally by REPL.
            // In CCR mode, all user messages are ignored (tool results handled differently).
            return { type: 'ignored' };
        }
        case 'stream_event':
            if (!isStreamEventPayload(msg.event)) {
                return { type: 'ignored' };
            }
            return { type: 'stream_event', event: convertStreamEvent(msg.event) };
        case 'result':
            // Only show result messages for errors. Success results are noise
            // in multi-turn sessions (isLoading=false is sufficient signal).
            if (msg.subtype !== 'success') {
                return { type: 'message', message: convertResultMessage(msg) };
            }
            return { type: 'ignored' };
        case 'system':
            if (msg.subtype === 'init') {
                return { type: 'message', message: convertInitMessage(msg) };
            }
            if (msg.subtype === 'status') {
                const statusMsg = convertStatusMessage(msg);
                return statusMsg
                    ? { type: 'message', message: statusMsg }
                    : { type: 'ignored' };
            }
            if (msg.subtype === 'compact_boundary') {
                return {
                    type: 'message',
                    message: convertCompactBoundaryMessage(msg),
                };
            }
            // hook_response and other subtypes
            logForDebugging(`[sdkMessageAdapter] Ignoring system message subtype: ${msg.subtype}`);
            return { type: 'ignored' };
        case 'tool_progress':
            return { type: 'message', message: convertToolProgressMessage(msg) };
        case 'auth_status':
            // Auth status is handled separately, not converted to a display message
            logForDebugging('[sdkMessageAdapter] Ignoring auth_status message');
            return { type: 'ignored' };
        case 'tool_use_summary':
            // Tool use summaries are SDK-only events, not displayed in REPL
            logForDebugging('[sdkMessageAdapter] Ignoring tool_use_summary message');
            return { type: 'ignored' };
        case 'rate_limit_event':
            // Rate limit events are SDK-only events, not displayed in REPL
            logForDebugging('[sdkMessageAdapter] Ignoring rate_limit_event message');
            return { type: 'ignored' };
        default: {
            // Gracefully ignore unknown message types. The backend may send new
            // types before the client is updated; logging helps with debugging
            // without crashing or losing the session.
            logForDebugging(`[sdkMessageAdapter] Unknown message type: ${msg.type}`);
            return { type: 'ignored' };
        }
    }
}
/**
 * Check if an SDKMessage indicates the session has ended
 */
export function isSessionEndMessage(msg) {
    return msg.type === 'result';
}
/**
 * Check if an SDKResultMessage indicates success
 */
export function isSuccessResult(msg) {
    return msg.subtype === 'success';
}
/**
 * Extract the result text from a successful SDKResultMessage
 */
export function getResultText(msg) {
    if (msg.subtype === 'success') {
        return msg.result;
    }
    return null;
}
//# sourceMappingURL=sdkMessageAdapter.js.map