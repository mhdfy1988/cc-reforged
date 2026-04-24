export class SSHSessionError extends Error {
}
export async function createSSHSession(..._args) {
    throw new SSHSessionError('SSH session creation is unavailable in this recovery build.');
}
export function createLocalSSHSession(..._args) {
    throw new SSHSessionError('Local SSH session creation is unavailable in this recovery build.');
}
//# sourceMappingURL=createSSHSession.js.map