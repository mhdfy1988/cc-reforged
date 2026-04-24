function failClosed(exportName) {
    throw new Error(`Not implemented in reforged build: src/cli/bg.ts#${exportName}`);
}
export async function main() {
    failClosed('main');
}
export async function psHandler(args) {
    void args;
    failClosed('psHandler');
}
export async function logsHandler(sessionId) {
    void sessionId;
    failClosed('logsHandler');
}
export async function attachHandler(sessionId) {
    void sessionId;
    failClosed('attachHandler');
}
export async function killHandler(sessionId) {
    void sessionId;
    failClosed('killHandler');
}
export async function handleBgFlag(args) {
    void args;
    failClosed('handleBgFlag');
}
//# sourceMappingURL=bg.js.map