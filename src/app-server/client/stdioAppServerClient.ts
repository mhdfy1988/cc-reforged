import type {
  AuthStatusParams,
  AuthStatusResult,
  AuthLoginParams,
  AuthLoginResult,
  CompactRunParams,
  CompactRunResult,
  CompactStatusResult,
  ConfigGetResult,
  ContextAnalyzeParams,
  ContextAnalyzeResult,
  ContextStatusResult,
  InitializeParams,
  InitializeResult,
  McpAddParams,
  McpAddResult,
  McpDisableParams,
  McpDisableResult,
  McpEnableParams,
  McpEnableResult,
  McpInstallApplyParams,
  McpInstallApplyResult,
  McpInstallListParams,
  McpInstallListResult,
  McpInstallPlanParams,
  McpInstallPlanResult,
  McpInstallSearchParams,
  McpInstallSearchResult,
  McpInstallUninstallParams,
  McpInstallUninstallResult,
  McpInspectParams,
  McpInspectResult,
  McpListParams,
  McpListResult,
  McpRemoveParams,
  McpRemoveResult,
  McpRestartParams,
  McpRestartResult,
  McpTestParams,
  McpTestResult,
  McpUpdateParams,
  McpUpdateResult,
  MemorySessionStatusResult,
  ModelAvailabilityParams,
  ModelAvailabilityResult,
  ModelCredentialUpdateParams,
  ModelCredentialUpdateResult,
  ModelListParams,
  ModelListResult,
  ModelProfileListParams,
  ModelProfileListResult,
  ModelProfileCopyParams,
  ModelProfileCopyResult,
  ModelProfileDeleteParams,
  ModelProfileDeleteResult,
  ModelProfileSaveParams,
  ModelProfileSaveResult,
  ModelProfileSetCurrentParams,
  ModelProfileSetCurrentResult,
  ModelSetParams,
  ModelSetResult,
  ModelTestParams,
  ModelTestResult,
  PermissionRespondParams,
  PermissionRespondResult,
  PermissionSettingsGetResult,
  PermissionSettingsUpdateParams,
  PermissionSettingsUpdateResult,
  SessionHistoryListParams,
  SessionHistoryListResult,
  ShutdownResult,
  ThreadListResult,
  ThreadResumeParams,
  ThreadResumeResult,
  ThreadStartParams,
  ThreadStartResult,
  TurnInterruptParams,
  TurnInterruptResult,
  TurnStartParams,
  TurnStartResult,
  ThreadScopedStatusParams,
  WorkspaceOpenParams,
  WorkspaceOpenResult,
} from '../protocol.js'
import { JsonRpcClient } from './jsonRpcClient.js'
import {
  startAppServerProcess,
  type AppServerProcess,
  type AppServerProcessOptions,
} from './appServerProcess.js'
import type {
  JsonRpcClientOptions,
  JsonRpcErrorListener,
  JsonRpcLineTransport,
  JsonRpcNotificationListener,
  RequestOptions,
  Unsubscribe,
} from './types.js'

export type StdioAppServerClientOptions = JsonRpcClientOptions & {
  process?: AppServerProcessOptions
}

export class StdioAppServerClient {
  constructor(private readonly rpc: JsonRpcClient) {}

  initialize(
    params: InitializeParams = {},
    options?: RequestOptions,
  ): Promise<InitializeResult> {
    return this.rpc.request('initialize', params, options)
  }

  shutdown(options?: RequestOptions): Promise<ShutdownResult> {
    return this.rpc.request('shutdown', {}, options)
  }

  getConfig(options?: RequestOptions): Promise<ConfigGetResult> {
    return this.rpc.request('config/get', {}, options)
  }

  getAuthStatus(
    params: AuthStatusParams = {},
    options?: RequestOptions,
  ): Promise<AuthStatusResult> {
    return this.rpc.request('auth/status', params, options)
  }

  loginAuth(
    params: AuthLoginParams = {},
    options?: RequestOptions,
  ): Promise<AuthLoginResult> {
    return this.rpc.request('auth/login', params, options)
  }

  listModels(
    params: ModelListParams = {},
    options?: RequestOptions,
  ): Promise<ModelListResult> {
    return this.rpc.request('model/list', params, options)
  }

  listModelProfiles(
    params: ModelProfileListParams = {},
    options?: RequestOptions,
  ): Promise<ModelProfileListResult> {
    return this.rpc.request('model/profile/list', params, options)
  }

  setModelProfile(
    params: ModelProfileSetCurrentParams,
    options?: RequestOptions,
  ): Promise<ModelProfileSetCurrentResult> {
    return this.rpc.request('model/profile/set-current', params, options)
  }

  saveModelProfile(
    params: ModelProfileSaveParams,
    options?: RequestOptions,
  ): Promise<ModelProfileSaveResult> {
    return this.rpc.request('model/profile/save', params, options)
  }

  copyModelProfile(
    params: ModelProfileCopyParams,
    options?: RequestOptions,
  ): Promise<ModelProfileCopyResult> {
    return this.rpc.request('model/profile/copy', params, options)
  }

  deleteModelProfile(
    params: ModelProfileDeleteParams,
    options?: RequestOptions,
  ): Promise<ModelProfileDeleteResult> {
    return this.rpc.request('model/profile/delete', params, options)
  }

  setModel(
    params: ModelSetParams,
    options?: RequestOptions,
  ): Promise<ModelSetResult> {
    return this.rpc.request('model/set', params, options)
  }

  getModelAvailability(
    params: ModelAvailabilityParams = {},
    options?: RequestOptions,
  ): Promise<ModelAvailabilityResult> {
    return this.rpc.request('model/availability', params, options)
  }

  testModelConnection(
    params: ModelTestParams = {},
    options?: RequestOptions,
  ): Promise<ModelTestResult> {
    return this.rpc.request('model/test', params, options)
  }

  updateModelCredential(
    params: ModelCredentialUpdateParams,
    options?: RequestOptions,
  ): Promise<ModelCredentialUpdateResult> {
    return this.rpc.request('model/credential/update', params, options)
  }

  listMcp(
    params: McpListParams = {},
    options?: RequestOptions,
  ): Promise<McpListResult> {
    return this.rpc.request('mcp/list', params, options)
  }

  inspectMcp(
    params: McpInspectParams,
    options?: RequestOptions,
  ): Promise<McpInspectResult> {
    return this.rpc.request('mcp/inspect', params, options)
  }

  addMcp(
    params: McpAddParams,
    options?: RequestOptions,
  ): Promise<McpAddResult> {
    return this.rpc.request('mcp/add', params, options)
  }

  updateMcp(
    params: McpUpdateParams,
    options?: RequestOptions,
  ): Promise<McpUpdateResult> {
    return this.rpc.request('mcp/update', params, options)
  }

  removeMcp(
    params: McpRemoveParams,
    options?: RequestOptions,
  ): Promise<McpRemoveResult> {
    return this.rpc.request('mcp/remove', params, options)
  }

  enableMcp(
    params: McpEnableParams,
    options?: RequestOptions,
  ): Promise<McpEnableResult> {
    return this.rpc.request('mcp/enable', params, options)
  }

  disableMcp(
    params: McpDisableParams,
    options?: RequestOptions,
  ): Promise<McpDisableResult> {
    return this.rpc.request('mcp/disable', params, options)
  }

  restartMcp(
    params: McpRestartParams,
    options?: RequestOptions,
  ): Promise<McpRestartResult> {
    return this.rpc.request('mcp/restart', params, options)
  }

  testMcp(
    params: McpTestParams,
    options?: RequestOptions,
  ): Promise<McpTestResult> {
    return this.rpc.request('mcp/test', params, options)
  }

  searchMcpInstalls(
    params: McpInstallSearchParams = {},
    options?: RequestOptions,
  ): Promise<McpInstallSearchResult> {
    return this.rpc.request('mcp/install/search', params, options)
  }

  planMcpInstall(
    params: McpInstallPlanParams,
    options?: RequestOptions,
  ): Promise<McpInstallPlanResult> {
    return this.rpc.request('mcp/install/plan', params, options)
  }

  applyMcpInstall(
    params: McpInstallApplyParams,
    options?: RequestOptions,
  ): Promise<McpInstallApplyResult> {
    return this.rpc.request('mcp/install/apply', params, options)
  }

  listMcpInstalls(
    params: McpInstallListParams = {},
    options?: RequestOptions,
  ): Promise<McpInstallListResult> {
    return this.rpc.request('mcp/install/list', params, options)
  }

  uninstallMcp(
    params: McpInstallUninstallParams,
    options?: RequestOptions,
  ): Promise<McpInstallUninstallResult> {
    return this.rpc.request('mcp/install/uninstall', params, options)
  }

  openWorkspace(
    params: WorkspaceOpenParams,
    options?: RequestOptions,
  ): Promise<WorkspaceOpenResult> {
    return this.rpc.request('workspace/open', params, options)
  }

  startThread(
    params: ThreadStartParams = {},
    options?: RequestOptions,
  ): Promise<ThreadStartResult> {
    return this.rpc.request('thread/start', params, options)
  }

  listThreads(options?: RequestOptions): Promise<ThreadListResult> {
    return this.rpc.request('thread/list', {}, options)
  }

  listSessionHistory(
    params: SessionHistoryListParams = {},
    options?: RequestOptions,
  ): Promise<SessionHistoryListResult> {
    return this.rpc.request('session/history/list', params, options)
  }

  resumeThread(
    params: ThreadResumeParams,
    options?: RequestOptions,
  ): Promise<ThreadResumeResult> {
    return this.rpc.request('thread/resume', params, options)
  }

  startTurn(
    params: TurnStartParams,
    options?: RequestOptions,
  ): Promise<TurnStartResult> {
    return this.rpc.request('turn/start', params, options)
  }

  interruptTurn(
    params: TurnInterruptParams,
    options?: RequestOptions,
  ): Promise<TurnInterruptResult> {
    return this.rpc.request('turn/interrupt', params, options)
  }

  respondPermission(
    params: PermissionRespondParams,
    options?: RequestOptions,
  ): Promise<PermissionRespondResult> {
    return this.rpc.request('permission/respond', params, options)
  }

  getPermissionSettings(
    options?: RequestOptions,
  ): Promise<PermissionSettingsGetResult> {
    return this.rpc.request('permission/settings/get', {}, options)
  }

  updatePermissionSettings(
    params: PermissionSettingsUpdateParams,
    options?: RequestOptions,
  ): Promise<PermissionSettingsUpdateResult> {
    return this.rpc.request('permission/settings/update', params, options)
  }

  getContextStatus(
    params: ThreadScopedStatusParams = {},
    options?: RequestOptions,
  ): Promise<ContextStatusResult> {
    return this.rpc.request('context/status', params, options)
  }

  analyzeContext(
    params: ContextAnalyzeParams = {},
    options?: RequestOptions,
  ): Promise<ContextAnalyzeResult> {
    return this.rpc.request('context/analyze', params, options)
  }

  getCompactStatus(
    params: ThreadScopedStatusParams = {},
    options?: RequestOptions,
  ): Promise<CompactStatusResult> {
    return this.rpc.request('compact/status', params, options)
  }

  runCompact(
    params: CompactRunParams,
    options?: RequestOptions,
  ): Promise<CompactRunResult> {
    return this.rpc.request('compact/run', params, options)
  }

  getMemorySessionStatus(
    params: ThreadScopedStatusParams = {},
    options?: RequestOptions,
  ): Promise<MemorySessionStatusResult> {
    return this.rpc.request('memory/session/status', params, options)
  }

  onNotification(listener: JsonRpcNotificationListener): Unsubscribe {
    return this.rpc.onNotification(listener)
  }

  onError(listener: JsonRpcErrorListener): Unsubscribe {
    return this.rpc.onError(listener)
  }

  close(): void {
    this.rpc.close()
  }
}

export type ManagedStdioAppServerClient = {
  client: StdioAppServerClient
  process: AppServerProcess
  close: () => Promise<void>
}

export function createStdioAppServerClient(
  transport: JsonRpcLineTransport,
  options: JsonRpcClientOptions = {},
): StdioAppServerClient {
  return new StdioAppServerClient(new JsonRpcClient(transport, options))
}

export function startManagedStdioAppServerClient(
  options: StdioAppServerClientOptions = {},
): ManagedStdioAppServerClient {
  const process = startAppServerProcess(options.process)
  const client = createStdioAppServerClient(process, options)

  return {
    client,
    process,
    async close(): Promise<void> {
      try {
        await client.shutdown({ timeoutMs: 5_000 })
        await process.waitForExit()
      } catch {
        process.close()
        await process.waitForExit()
      } finally {
        client.close()
      }
    },
  }
}
