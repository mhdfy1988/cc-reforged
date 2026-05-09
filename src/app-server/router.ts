import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { createCcrCore, type CcrCore } from '../core/index.js'
import { coreEventToJsonRpcNotification } from './coreEventMapper.js'
import { AppServerError, errorResponse } from './errors.js'
import {
  handleCompactRun,
  handleCompactStatus,
  handleContextAnalyze,
  handleContextStatus,
  handleMemorySessionStatus,
} from './handlers/contextHandlers.js'
import {
  handleAuthStatus,
  handleConfigGet,
  handleModelList,
} from './handlers/llmHandlers.js'
import { handleMcpList } from './handlers/mcpHandlers.js'
import {
  handlePermissionRespond,
  handlePermissionSettingsGet,
  handlePermissionSettingsUpdate,
} from './handlers/permissionHandlers.js'
import {
  handleSessionHistoryList,
  handleThreadList,
  handleThreadResume,
  handleThreadStart,
  handleTurnInterrupt,
  handleTurnStart,
} from './handlers/sessionHandlers.js'
import { handleWorkspaceOpen } from './handlers/workspaceHandlers.js'
import { setupAppServerRuntime } from './setup.js'
import {
  APP_SERVER_CONFIG_SCHEMA_VERSION,
  APP_SERVER_PROTOCOL_VERSION,
  DEFAULT_SERVER_CAPABILITIES,
  InitializeParamsSchema,
  JsonRpcRequestSchema,
  ShutdownParamsSchema,
  successResponse,
  type ClientInfo,
  type JsonRpcNotification,
  type JsonRpcResponse,
  type JsonRpcResponseId,
  type ServerCapabilities,
} from './protocol.js'

export type AppServerContext = {
  initialized: boolean
  shutdownRequested: boolean
  startedAt: number
  ccrHome: string
  clientInfo?: ClientInfo
  capabilities: ServerCapabilities
  emit: (notification: JsonRpcNotification) => void
  core: CcrCore
}

export function createAppServerContext(options: {
  emit?: (notification: JsonRpcNotification) => void
} = {}): AppServerContext {
  const emit = options.emit ?? (() => {})
  const core = createCcrCore({
    emit: event => emit(coreEventToJsonRpcNotification(event)),
  })
  return {
    initialized: false,
    shutdownRequested: false,
    startedAt: Date.now(),
    ccrHome: getClaudeConfigHomeDir(),
    capabilities: DEFAULT_SERVER_CAPABILITIES,
    emit,
    core,
  }
}

export async function handleJsonRpcMessage(
  context: AppServerContext,
  rawMessage: unknown,
): Promise<JsonRpcResponse> {
  const requestParse = JsonRpcRequestSchema.safeParse(rawMessage)
  if (!requestParse.success) {
    const id = extractResponseId(rawMessage)
    return errorResponse(
      id,
      new AppServerError('invalid_request', undefined, requestParse.error.issues),
    )
  }

  const request = requestParse.data

  if (!context.initialized && !isPreInitializeMethod(request.method)) {
    return errorResponse(request.id, new AppServerError('not_initialized'))
  }

  try {
    switch (request.method) {
      case 'initialize':
        return successResponse(
          request.id,
          await initialize(context, request.params),
        )
      case 'shutdown':
        return successResponse(request.id, shutdown(context, request.params))
      case 'config/get':
        return successResponse(request.id, handleConfigGet(context, request.params))
      case 'auth/status':
        return successResponse(
          request.id,
          await handleAuthStatus(context, request.params),
        )
      case 'model/list':
        return successResponse(request.id, handleModelList(context, request.params))
      case 'mcp/list':
        return successResponse(
          request.id,
          await handleMcpList(context, request.params),
        )
      case 'workspace/open':
        return successResponse(
          request.id,
          await handleWorkspaceOpen(context, request.params),
        )
      case 'thread/start':
        return successResponse(
          request.id,
          handleThreadStart(context, request.params),
        )
      case 'thread/list':
        return successResponse(
          request.id,
          handleThreadList(context, request.params),
        )
      case 'session/history/list':
        return successResponse(
          request.id,
          await handleSessionHistoryList(context, request.params),
        )
      case 'thread/resume':
        return successResponse(
          request.id,
          await handleThreadResume(context, request.params),
        )
      case 'turn/start':
        return successResponse(request.id, handleTurnStart(context, request.params))
      case 'turn/interrupt':
        return successResponse(
          request.id,
          handleTurnInterrupt(context, request.params),
        )
      case 'permission/respond':
        return successResponse(
          request.id,
          handlePermissionRespond(context, request.params),
        )
      case 'permission/settings/get':
        return successResponse(
          request.id,
          handlePermissionSettingsGet(context, request.params),
        )
      case 'permission/settings/update':
        return successResponse(
          request.id,
          handlePermissionSettingsUpdate(context, request.params),
        )
      case 'context/status':
        return successResponse(
          request.id,
          handleContextStatus(context, request.params),
        )
      case 'context/analyze':
        return successResponse(
          request.id,
          await handleContextAnalyze(context, request.params),
        )
      case 'compact/status':
        return successResponse(
          request.id,
          handleCompactStatus(context, request.params),
        )
      case 'compact/run':
        return successResponse(
          request.id,
          await handleCompactRun(context, request.params),
        )
      case 'memory/session/status':
        return successResponse(
          request.id,
          await handleMemorySessionStatus(context, request.params),
        )
      default:
        return errorResponse(
          request.id,
          new AppServerError('method_not_found', `Method not found: ${request.method}`),
        )
    }
  } catch (error) {
    return errorResponse(request.id, error)
  }
}

function isPreInitializeMethod(method: string): boolean {
  return method === 'initialize' || method === 'shutdown'
}

async function initialize(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  if (context.initialized) {
    throw new AppServerError('already_initialized')
  }

  const parsedParams = InitializeParamsSchema.parse(params ?? {})
  const runtime = await setupAppServerRuntime()
  context.initialized = true
  context.clientInfo = parsedParams.clientInfo

  return {
    serverInfo: {
      name: 'ccr-app-server',
      version: APP_SERVER_PROTOCOL_VERSION,
      serverVersion: APP_SERVER_PROTOCOL_VERSION,
      coreVersion: getCoreVersion(),
    },
    serverVersion: APP_SERVER_PROTOCOL_VERSION,
    protocolVersion: APP_SERVER_PROTOCOL_VERSION,
    schemaVersions: {
      config: APP_SERVER_CONFIG_SCHEMA_VERSION,
    },
    ccrHome: context.ccrHome,
    platform: {
      os: process.platform,
      arch: process.arch,
      node: process.version,
    },
    runtime,
    capabilities: context.capabilities,
  }
}

function shutdown(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  ShutdownParamsSchema.parse(params ?? {})
  context.shutdownRequested = true
  process.exitCode = 0

  return {
    accepted: true,
  }
}

function extractResponseId(rawMessage: unknown): JsonRpcResponseId {
  if (
    rawMessage &&
    typeof rawMessage === 'object' &&
    'id' in rawMessage &&
    (typeof rawMessage.id === 'string' || typeof rawMessage.id === 'number')
  ) {
    return rawMessage.id
  }

  return null
}

function getCoreVersion(): string {
  const macro = (globalThis as typeof globalThis & {
    MACRO?: {
      VERSION?: string
    }
  }).MACRO

  return typeof macro?.VERSION === 'string' ? macro.VERSION : '0.0.0-dev'
}
