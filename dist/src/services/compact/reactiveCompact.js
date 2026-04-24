export function isReactiveOnlyMode() {
    return false;
}
export function isReactiveCompactEnabled() {
    return false;
}
export function isWithheldPromptTooLong(_message) {
    return false;
}
export function isWithheldMediaSizeError(_message) {
    return false;
}
export async function reactiveCompactOnPromptTooLong(_messages, _cacheSafeParams, _options) {
    return {
        ok: false,
        reason: 'error',
    };
}
export async function tryReactiveCompact(_input) {
    return null;
}
//# sourceMappingURL=reactiveCompact.js.map