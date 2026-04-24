export type LiveSession = {
  kind?: string
  sessionId?: string
}

export async function sendToUdsSocket(_target: string, _message: string): Promise<void> {
  throw new Error('udsClient 入口尚未恢复。')
}

export async function listAllLiveSessions(): Promise<LiveSession[]> {
  return []
}
