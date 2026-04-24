export type SessionManagerOptions = {
  idleTimeoutMs?: number
  maxSessions?: number
}

export class SessionManager {
  constructor(_backend: unknown, _options: SessionManagerOptions) {}

  async destroyAll(): Promise<void> {}
}
