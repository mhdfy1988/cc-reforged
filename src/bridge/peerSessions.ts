export type InterClaudeMessageResult = {
  ok: boolean
  error?: string
}

export async function postInterClaudeMessage(
  _target: string,
  _message: string,
): Promise<InterClaudeMessageResult> {
  return {
    ok: false,
    error: 'peerSessions bridge 尚未恢复',
  }
}
