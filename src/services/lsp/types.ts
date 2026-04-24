export type LspServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export type LspServerConfig = {
  type?: string
  command?: string
  args?: string[]
  extensionToLanguage?: Record<string, string>
  transport?: 'stdio' | 'socket'
  env?: Record<string, string>
  workspaceFolder?: string
  initializationOptions?: unknown
  settings?: unknown
  startupTimeout?: number
  maxRestarts?: number
  restartOnCrash?: boolean
  shutdownTimeout?: number
  [key: string]: unknown
}

export type ScopedLspServerConfig = LspServerConfig & {
  scope: 'local' | 'user' | 'project' | 'dynamic' | 'enterprise' | 'claudeai' | 'managed'
  pluginSource?: string
}
