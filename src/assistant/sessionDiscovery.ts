export type AssistantSession = {
  id: string
  title?: string
  cwd?: string
  [key: string]: unknown
}

export async function discoverAssistantSessions(): Promise<AssistantSession[]> {
  return []
}
