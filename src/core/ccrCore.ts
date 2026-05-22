import { getCoreAuthStatus, loginCoreAuth } from './authCore.js'
import { getCoreConfigSnapshot } from './configCore.js'
import {
  addCoreMcpServer,
  applyCoreMcpInstall,
  inspectCoreMcpServer,
  listCoreMcpServers,
  listCoreMcpInstalls,
  planCoreMcpInstall,
  removeCoreMcpServer,
  restartCoreMcpServer,
  searchCoreMcpInstallCandidates,
  setCoreMcpServerEnabled,
  testCoreMcpServer,
  uninstallCoreMcpInstalledServer,
  updateCoreMcpServer,
} from './mcpCore.js'
import {
  copyCoreModelProfile,
  deleteCoreModelProfile,
  getCoreModelAvailability,
  listCoreModelProfiles,
  listCoreModels,
  saveCoreModelProfile,
  setCoreModel,
  setCoreModelProfile,
  testCoreModelConnection,
  updateCoreModelCredential,
} from './modelCore.js'
import { CorePermissionService } from './permissionCore.js'
import { CoreSessionService } from './sessionCore.js'
import type { CoreEventEmitter } from './types.js'
import { CoreWorkspaceService } from './workspaceCore.js'

export type CcrCore = ReturnType<typeof createCcrCore>

export function createCcrCore(options: {
  emit?: CoreEventEmitter
} = {}) {
  const emit = options.emit ?? (() => {})
  const workspace = new CoreWorkspaceService()
  const permission = new CorePermissionService({ emit })
  const session = new CoreSessionService({
    emit,
    getWorkspace: () => workspace.getWorkspace(),
    cancelPermissionsForTurn: input => permission.cancelForTurn(input),
    createCanUseTool: input => permission.createCanUseTool(input),
  })

  return {
    config: {
      getSnapshot: getCoreConfigSnapshot,
    },
    auth: {
      getStatus: getCoreAuthStatus,
      login: loginCoreAuth,
    },
    model: {
      getAvailability: getCoreModelAvailability,
      listProfiles: listCoreModelProfiles,
      listModels: listCoreModels,
      copyProfile: copyCoreModelProfile,
      deleteProfile: deleteCoreModelProfile,
      saveProfile: saveCoreModelProfile,
      setModel: setCoreModel,
      setProfile: setCoreModelProfile,
      testConnection: testCoreModelConnection,
      updateCredential: updateCoreModelCredential,
    },
    mcp: {
      addServer: addCoreMcpServer,
      inspectServer: inspectCoreMcpServer,
      listServers: listCoreMcpServers,
      removeServer: removeCoreMcpServer,
      restartServer: restartCoreMcpServer,
      searchInstallCandidates: searchCoreMcpInstallCandidates,
      setServerEnabled: setCoreMcpServerEnabled,
      testServer: testCoreMcpServer,
      planInstall: planCoreMcpInstall,
      applyInstall: applyCoreMcpInstall,
      listInstalls: listCoreMcpInstalls,
      uninstallInstalledServer: uninstallCoreMcpInstalledServer,
      updateServer: updateCoreMcpServer,
    },
    workspace,
    permission,
    session,
  }
}
