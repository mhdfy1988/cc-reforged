let onEnqueue: (() => void) | null = null
let socketPath =
  process.env.CLAUDE_CODE_UDS_SOCKET_PATH ??
  process.env.CLAUDE_CODE_MESSAGING_SOCKET ??
  ''

export function getUdsMessagingSocketPath(): string {
  return socketPath
}

export function getDefaultUdsSocketPath(): string {
  return socketPath
}

export async function startUdsMessaging(
  requestedSocketPath: string,
  _options: { isExplicit: boolean },
): Promise<void> {
  socketPath = requestedSocketPath || socketPath
  if (!socketPath) {
    return
  }

  process.env.CLAUDE_CODE_UDS_SOCKET_PATH = socketPath
  process.env.CLAUDE_CODE_MESSAGING_SOCKET = socketPath
}

export function setOnEnqueue(handler: (() => void) | null): void {
  onEnqueue = handler
}

export function clearOnEnqueue(): void {
  onEnqueue = null
}

export function notifyEnqueue(): void {
  onEnqueue?.()
}
