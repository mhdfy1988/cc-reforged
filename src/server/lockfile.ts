export type RunningServerInfo = {
  pid: number
  httpUrl: string
}

export async function probeRunningServer(): Promise<RunningServerInfo | null> {
  return null
}

export async function writeServerLock(_info: {
  pid: number
  port: number
  host?: string
  httpUrl: string
  startedAt: number
}): Promise<void> {}

export async function removeServerLock(): Promise<void> {}
