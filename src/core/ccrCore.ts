import { getCoreAuthStatus } from './authCore.js'
import { getCoreConfigSnapshot } from './configCore.js'
import { listCoreMcpServers } from './mcpCore.js'
import { listCoreModels } from './modelCore.js'
import { CoreSessionService } from './sessionCore.js'
import type { CoreEventEmitter } from './types.js'
import { CoreWorkspaceService } from './workspaceCore.js'

export type CcrCore = ReturnType<typeof createCcrCore>

export function createCcrCore(options: {
  emit?: CoreEventEmitter
} = {}) {
  const emit = options.emit ?? (() => {})
  const workspace = new CoreWorkspaceService()
  const session = new CoreSessionService({
    emit,
    getWorkspace: () => workspace.getWorkspace(),
  })

  return {
    config: {
      getSnapshot: getCoreConfigSnapshot,
    },
    auth: {
      getStatus: getCoreAuthStatus,
    },
    model: {
      listModels: listCoreModels,
    },
    mcp: {
      listServers: listCoreMcpServers,
    },
    workspace,
    session,
  }
}
