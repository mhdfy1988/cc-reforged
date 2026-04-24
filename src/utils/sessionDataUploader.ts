export async function uploadSessionData(..._args: unknown[]): Promise<void> {}

export type SessionTurnUploader = ((messages: unknown[]) => Promise<void>) | null

export async function createSessionTurnUploader(): Promise<SessionTurnUploader> {
  return null
}
