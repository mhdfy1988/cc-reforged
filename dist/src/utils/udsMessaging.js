let onEnqueue = null;
let socketPath = process.env.CLAUDE_CODE_UDS_SOCKET_PATH ??
    process.env.CLAUDE_CODE_MESSAGING_SOCKET ??
    '';
export function getUdsMessagingSocketPath() {
    return socketPath;
}
export function getDefaultUdsSocketPath() {
    return socketPath;
}
export async function startUdsMessaging(requestedSocketPath, _options) {
    socketPath = requestedSocketPath || socketPath;
    if (!socketPath) {
        return;
    }
    process.env.CLAUDE_CODE_UDS_SOCKET_PATH = socketPath;
    process.env.CLAUDE_CODE_MESSAGING_SOCKET = socketPath;
}
export function setOnEnqueue(handler) {
    onEnqueue = handler;
}
export function clearOnEnqueue() {
    onEnqueue = null;
}
export function notifyEnqueue() {
    onEnqueue?.();
}
//# sourceMappingURL=udsMessaging.js.map