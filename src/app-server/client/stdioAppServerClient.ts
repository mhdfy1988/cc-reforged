import type {
  AuthStatusParams,
  AuthStatusResult,
  ConfigGetResult,
  InitializeParams,
  InitializeResult,
  McpListParams,
  McpListResult,
  ModelListParams,
  ModelListResult,
  PermissionRespondParams,
  PermissionRespondResult,
  ShutdownResult,
  ThreadListResult,
  ThreadStartParams,
  ThreadStartResult,
  TurnInterruptParams,
  TurnInterruptResult,
  TurnStartParams,
  TurnStartResult,
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

  listModels(
    params: ModelListParams = {},
    options?: RequestOptions,
  ): Promise<ModelListResult> {
    return this.rpc.request('model/list', params, options)
  }

  listMcp(
    params: McpListParams = {},
    options?: RequestOptions,
  ): Promise<McpListResult> {
    return this.rpc.request('mcp/list', params, options)
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
