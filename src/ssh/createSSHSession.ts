type SSHSessionManagerLike = {
  connect(): void
  disconnect(): void
  respondToPermissionRequest(
    requestId: string,
    response: {
      behavior: 'allow' | 'deny'
      updatedInput?: unknown
      message?: string
    },
  ): void
}

export type SSHSession = {
  remoteCwd: string
  proc: {
    exitCode: number | null
    signalCode: string | null
  }
  proxy: {
    stop(): void
  }
  getStderrTail(): string
  createManager(_handlers: unknown): SSHSessionManagerLike
}

export class SSHSessionError extends Error {}

export async function createSSHSession(
  ..._args: unknown[]
): Promise<SSHSession> {
  throw new SSHSessionError(
    'SSH session creation is unavailable in this recovery build.',
  )
}

export function createLocalSSHSession(..._args: unknown[]): SSHSession {
  throw new SSHSessionError(
    'Local SSH session creation is unavailable in this recovery build.',
  )
}
