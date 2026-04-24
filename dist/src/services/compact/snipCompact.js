import { tokenCountWithEstimation } from '../../utils/tokens.js';
const SNIP_NUDGE_INTERVAL_TOKENS = 10_000;
export const SNIP_NUDGE_TEXT = 'Context has grown by about 10k tokens since the last context cleanup. If older messages are no longer needed, use SnipTool to remove them and keep the active context efficient.';
export function isSnipRuntimeEnabled() {
    return process.env.USER_TYPE === 'ant' && process.env.NODE_ENV !== 'test';
}
export function isSnipMarkerMessage(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return record.subtype === 'snip_marker' || record.type === 'snip_marker';
}
export function shouldNudgeForSnips(messages) {
    const resetIndex = findLastSnipNudgeResetIndex(messages);
    const messagesSinceReset = resetIndex === -1 ? messages : messages.slice(resetIndex + 1);
    return tokenCountWithEstimation(messagesSinceReset) >= SNIP_NUDGE_INTERVAL_TOKENS;
}
export function snipCompactIfNeeded(value) {
    return value;
}
function findLastSnipNudgeResetIndex(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (isSnipNudgeResetMessage(messages[i])) {
            return i;
        }
    }
    return -1;
}
function isSnipNudgeResetMessage(message) {
    if (!message) {
        return false;
    }
    const record = message;
    if (record.subtype === 'snip_marker' ||
        record.type === 'snip_marker' ||
        record.subtype === 'snip_boundary' ||
        record.type === 'snip_boundary') {
        return true;
    }
    if (message.type === 'system') {
        return (message.subtype === 'compact_boundary' ||
            message.subtype === 'microcompact_boundary');
    }
    return (message.type === 'attachment' &&
        message.attachment?.type === 'context_efficiency');
}
//# sourceMappingURL=snipCompact.js.map