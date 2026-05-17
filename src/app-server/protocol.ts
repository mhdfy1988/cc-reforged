import { z } from 'zod'
import type { CorePermissionSettingsSnapshot } from '../core/permissionSettingsCore.js'

export const APP_SERVER_PROTOCOL_VERSION = '0.1'
export const APP_SERVER_CONFIG_SCHEMA_VERSION = '0.1'

export const JsonRpcIdSchema = z.union([z.string(), z.number()])

export const JsonRpcParamsSchema = z.record(z.string(), z.unknown())

export const JsonRpcRequestSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: JsonRpcIdSchema,
    method: z.string().min(1),
    params: JsonRpcParamsSchema.optional(),
  })
  .strict()

export const JsonRpcSuccessResponseSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: JsonRpcIdSchema.nullable(),
    result: z.unknown(),
  })
  .strict()

export const JsonRpcErrorResponseSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: JsonRpcIdSchema.nullable(),
    error: z
      .object({
        code: z.number(),
        message: z.string(),
        data: z
          .object({
            kind: z.string(),
            details: z.unknown().optional(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

export const JsonRpcResponseSchema = z.union([
  JsonRpcSuccessResponseSchema,
  JsonRpcErrorResponseSchema,
])

export const JsonRpcNotificationSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    method: z.string().min(1),
    params: JsonRpcParamsSchema.optional(),
  })
  .strict()

export const ClientInfoSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
  })
  .strict()

export const ClientCapabilitiesSchema = z
  .object({
    streaming: z.boolean().optional(),
    permissionPrompts: z.boolean().optional(),
    workspaceTrust: z.boolean().optional(),
    mcpManagement: z.boolean().optional(),
  })
  .strict()

export const InitializeParamsSchema = z
  .object({
    clientInfo: ClientInfoSchema.optional(),
    capabilities: ClientCapabilitiesSchema.optional(),
  })
  .strict()
  .default({})

export const ShutdownParamsSchema = z.object({}).strict().default({})

export const ConfigGetParamsSchema = z.object({}).strict().default({})

export const AuthStatusParamsSchema = z
  .object({
    provider: z.string().min(1).optional(),
  })
  .strict()
  .default({})

export const AuthLoginParamsSchema = z
  .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
  })
  .strict()
  .default({})

export const ModelListParamsSchema = z
  .object({
    provider: z.string().min(1).optional(),
  })
  .strict()
  .default({})

export const ModelProfileListParamsSchema = z
  .object({
    providerType: z.string().min(1).optional(),
  })
  .strict()
  .default({})

export const ModelProfileSetCurrentParamsSchema = z
  .object({
    profileId: z.string().min(1),
    model: z.string().min(1).optional(),
  })
  .strict()

const ModelCapabilityOverrideSchema = z
  .object({
    inputModalities: z
      .array(z.enum(['text', 'image', 'file', 'audio']))
      .optional(),
    outputModalities: z.array(z.enum(['text', 'image', 'audio'])).optional(),
    tools: z.boolean().optional(),
    structuredOutput: z.boolean().optional(),
    image: z
      .object({
        maxImages: z.number().int().positive().optional(),
        maxImageBytes: z.number().int().positive().optional(),
        mimeTypes: z.array(z.string().min(1)).optional(),
      })
      .strict()
      .optional(),
    reason: z.string().min(1).optional(),
  })
  .strict()

const ModelCapabilityOverridesSchema = z
  .object({
    default: ModelCapabilityOverrideSchema.optional(),
    models: z.record(ModelCapabilityOverrideSchema).optional(),
  })
  .strict()

export const ModelProfileSaveParamsSchema = z
  .object({
    profileId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    providerType: z.string().min(1),
    apiMode: z
      .enum(['anthropic-messages', 'openai-responses', 'openai-chat', 'custom'])
      .optional(),
    authStrategy: z
      .enum([
        'api_key',
        'oauth_refreshable',
        'oauth_external',
        'external_process',
        'hybrid',
        'unknown',
      ])
      .optional(),
    accountId: z.string().min(1).optional(),
    baseUrl: z.string().min(1).optional(),
    defaultModel: z.string().min(1).optional(),
    models: z.array(z.string().min(1)).optional(),
    capabilityOverrides: ModelCapabilityOverridesSchema.optional(),
    setCurrent: z.boolean().optional(),
  })
  .strict()

export const ModelProfileCopyParamsSchema = z
  .object({
    profileId: z.string().min(1),
    name: z.string().min(1).optional(),
  })
  .strict()

export const ModelProfileDeleteParamsSchema = z
  .object({
    profileId: z.string().min(1),
  })
  .strict()

export const ModelSetParamsSchema = z
  .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1),
  })
  .strict()

export const ModelAvailabilityParamsSchema = z
  .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
  .strict()
  .default({})

export const ModelTestParamsSchema = z
  .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
  })
  .strict()
  .default({})

export const ModelCredentialUpdateParamsSchema = z
  .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1),
    model: z.string().min(1).optional(),
    apiKey: z.string().optional().nullable(),
  })
  .strict()

export const McpListParamsSchema = z
  .object({
    includeDisabled: z.boolean().optional(),
  })
  .strict()
  .default({})

export const WorkspaceOpenParamsSchema = z
  .object({
    path: z.string().min(1),
    trust: z.literal('trusted'),
  })
  .strict()

export const ThreadStartParamsSchema = z
  .object({
    title: z.string().min(1).optional(),
    metadata: JsonRpcParamsSchema.optional(),
  })
  .strict()
  .default({})

export const ThreadListParamsSchema = z.object({}).strict().default({})

export const ThreadResumeParamsSchema = z
  .object({
    sessionId: z.string().min(1),
    title: z.string().min(1).optional(),
    transcriptPath: z.string().min(1).optional(),
    projectPath: z.string().min(1).optional(),
    metadata: JsonRpcParamsSchema.optional(),
  })
  .strict()

export const SessionHistoryListParamsSchema = z
  .object({
    scope: z.enum(['sameRepo', 'allProjects']).optional().default('sameRepo'),
    query: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
    cursor: z.string().optional(),
    includeCurrent: z.boolean().optional(),
  })
  .strict()
  .default({})

export const TurnContentSourceSchema = z.union([
  z
    .object({
      kind: z.literal('file'),
      path: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('url'),
      url: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('contentRef'),
      contentRef: z.string().min(1),
    })
    .strict(),
])

const TurnAttachmentMetadataSchema = z
  .object({
    attachmentId: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    source: TurnContentSourceSchema.optional(),
  })
  .strict()

export const TurnTextContentBlockSchema = z
  .object({
    type: z.literal('text'),
    text: z.string().min(1),
  })
  .strict()

export const TurnImageContentBlockSchema = TurnAttachmentMetadataSchema.extend({
  type: z.literal('image'),
}).strict()

export const TurnFileContentBlockSchema = TurnAttachmentMetadataSchema.extend({
  type: z.literal('file'),
}).strict()

export const TurnAudioContentBlockSchema = TurnAttachmentMetadataSchema.extend({
  type: z.literal('audio'),
}).strict()

export const TurnContentBlockSchema = z.discriminatedUnion('type', [
  TurnTextContentBlockSchema,
  TurnImageContentBlockSchema,
  TurnFileContentBlockSchema,
  TurnAudioContentBlockSchema,
])

export const TurnInputSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('text'),
      text: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('content'),
      content: z.array(TurnContentBlockSchema).min(1),
    })
    .strict(),
])

export const TurnStartParamsSchema = z
  .object({
    threadId: z.string().min(1),
    input: TurnInputSchema,
    options: z
      .object({
        stream: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const TurnInterruptParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    reason: z.string().min(1).optional(),
  })
  .strict()

export const PermissionRespondParamsSchema = z
  .object({
    permissionRequestId: z.string().min(1),
    behavior: z.enum(['allow', 'deny']),
    updatedInput: JsonRpcParamsSchema.optional(),
    updatedPermissions: z.array(z.unknown()).optional(),
    message: z.string().optional(),
    acceptFeedback: z.string().optional(),
    interrupt: z.boolean().optional(),
    toolUseID: z.string().optional(),
    decisionClassification: z
      .enum(['user_temporary', 'user_permanent', 'user_reject'])
      .optional(),
  })
  .strict()

export const PermissionSettingsGetParamsSchema = z.object({}).strict().default({})

export const PermissionSettingsUpdateParamsSchema = z
  .object({
    source: z.enum(['localSettings', 'projectSettings', 'userSettings']),
    permissions: z
      .object({
        allow: z.array(z.string()).optional(),
        deny: z.array(z.string()).optional(),
        ask: z.array(z.string()).optional(),
        defaultMode: z
          .enum([
            'acceptEdits',
            'bypassPermissions',
            'default',
            'dontAsk',
            'plan',
          ])
          .nullable()
          .optional(),
        disableBypassPermissionsMode: z.boolean().nullable().optional(),
        additionalDirectories: z.array(z.string()).optional(),
      })
      .strict(),
  })
  .strict()

export const ThreadScopedStatusParamsSchema = z
  .object({
    threadId: z.string().min(1).optional(),
  })
  .strict()
  .default({})

export const ContextAnalyzeParamsSchema = ThreadScopedStatusParamsSchema

export const CompactRunParamsSchema = z
  .object({
    threadId: z.string().min(1),
    instruction: z.string().optional(),
  })
  .strict()

export type JsonRpcId = z.infer<typeof JsonRpcIdSchema>
export type JsonRpcResponseId = JsonRpcId | null
export type JsonRpcParams = z.infer<typeof JsonRpcParamsSchema>
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>
export type ClientInfo = z.infer<typeof ClientInfoSchema>
export type ClientCapabilities = z.infer<typeof ClientCapabilitiesSchema>
export type InitializeParams = z.infer<typeof InitializeParamsSchema>
export type AuthStatusParams = z.infer<typeof AuthStatusParamsSchema>
export type AuthLoginParams = z.infer<typeof AuthLoginParamsSchema>
export type ModelListParams = z.infer<typeof ModelListParamsSchema>
export type ModelProfileListParams = z.infer<
  typeof ModelProfileListParamsSchema
>
export type ModelProfileSetCurrentParams = z.infer<
  typeof ModelProfileSetCurrentParamsSchema
>
export type ModelProfileSaveParams = z.infer<
  typeof ModelProfileSaveParamsSchema
>
export type ModelProfileCopyParams = z.infer<
  typeof ModelProfileCopyParamsSchema
>
export type ModelProfileDeleteParams = z.infer<
  typeof ModelProfileDeleteParamsSchema
>
export type ModelSetParams = z.infer<typeof ModelSetParamsSchema>
export type ModelAvailabilityParams = z.infer<
  typeof ModelAvailabilityParamsSchema
>
export type ModelTestParams = z.infer<typeof ModelTestParamsSchema>
export type ModelCredentialUpdateParams = z.infer<
  typeof ModelCredentialUpdateParamsSchema
>
export type McpListParams = z.infer<typeof McpListParamsSchema>
export type WorkspaceOpenParams = z.infer<typeof WorkspaceOpenParamsSchema>
export type ThreadStartParams = z.infer<typeof ThreadStartParamsSchema>
export type ThreadResumeParams = z.infer<typeof ThreadResumeParamsSchema>
export type SessionHistoryListParams = z.infer<
  typeof SessionHistoryListParamsSchema
>
export type TurnInterruptParams = z.infer<typeof TurnInterruptParamsSchema>
export type TurnStartParams = {
  threadId: string
  input: TurnInput
  options?: {
    stream?: boolean
  }
}
export type PermissionRespondParams = z.infer<
  typeof PermissionRespondParamsSchema
>
export type PermissionSettingsGetParams = z.infer<
  typeof PermissionSettingsGetParamsSchema
>
export type PermissionSettingsUpdateParams = z.infer<
  typeof PermissionSettingsUpdateParamsSchema
>
export type ThreadScopedStatusParams = z.infer<
  typeof ThreadScopedStatusParamsSchema
>
export type ContextAnalyzeParams = z.infer<typeof ContextAnalyzeParamsSchema>
export type CompactRunParams = z.infer<typeof CompactRunParamsSchema>

export type ServerCapabilities = {
  config: boolean
  auth: boolean
  models: boolean
  mcp: boolean
  workspace: boolean
  threads: boolean
  turns: boolean
  permissions: boolean
  context: boolean
  compact: boolean
  memory: boolean
}

export type JsonRpcSuccessResponse = {
  jsonrpc: '2.0'
  id: JsonRpcResponseId
  result: unknown
}

export type JsonRpcErrorResponse = {
  jsonrpc: '2.0'
  id: JsonRpcResponseId
  error: {
    code: number
    message: string
    data: {
      kind: string
      details?: unknown
    }
  }
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse

export type JsonRpcNotification = {
  jsonrpc: '2.0'
  method: string
  params?: JsonRpcParams
}

export type PlatformInfo = {
  os: string
  arch: string
  node: string
}

export type ServerInfo = {
  name: string
  version: string
  serverVersion: string
  coreVersion: string
}

export type SchemaVersions = {
  config: string
}

export type InitializeResult = {
  serverInfo: ServerInfo
  serverVersion: string
  protocolVersion: string
  schemaVersions: SchemaVersions
  ccrHome: string
  platform: PlatformInfo
  capabilities: ServerCapabilities
}

export type ShutdownResult = {
  accepted: boolean
}

export type ConfigGetResult = Record<string, unknown>

export type AuthStatusResult = Record<string, unknown>

export type AuthLoginResult = Record<string, unknown>

export type ModelListResult = Record<string, unknown>

export type ModelProfileListResult = Record<string, unknown>

export type ModelProfileSetCurrentResult = Record<string, unknown>

export type ModelProfileSaveResult = Record<string, unknown>

export type ModelProfileCopyResult = Record<string, unknown>

export type ModelProfileDeleteResult = Record<string, unknown>

export type ModelSetResult = Record<string, unknown>

export type ModelAvailabilityResult = Record<string, unknown>

export type ModelTestResult = Record<string, unknown>

export type ModelCredentialUpdateResult = Record<string, unknown>

export type McpListResult = Record<string, unknown>

export type WorkspaceOpenResult = {
  workspace: {
    path: string
    trusted: boolean
  }
}

export type AppServerThread = {
  threadId: string
  workspacePath: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
  activeTurnId: string | null
  metadata: Record<string, unknown>
}

export type AppServerTurn = {
  turnId: string
  threadId: string
  status: string
  input:
    | {
        type: 'text'
        text: string
      }
    | {
        type: 'content'
        text: string
        content: TurnContentBlock[]
      }
  provider: string
  model: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  error: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

export type AppServerThreadMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'error'
  text: string
  status?: string
  kind?: string
  createdAt?: string
  sourceType?: string
  content?: unknown
}

export type ThreadStartResult = {
  thread: AppServerThread
}

export type ThreadResumeResult = {
  thread: AppServerThread
  messages: AppServerThreadMessage[]
}

export type ThreadListResult = {
  threads: AppServerThread[]
}

export type SessionHistoryTitleSource =
  | 'customTitle'
  | 'aiTitle'
  | 'lastPrompt'
  | 'firstPrompt'
  | 'fallback'

export type SessionHistoryItem = {
  sessionId: string
  threadId: string
  title: string
  titleSource: SessionHistoryTitleSource
  firstPrompt?: string
  lastPrompt?: string
  summary?: string
  createdAt: string
  updatedAt: string
  messageCount: number
  projectPath?: string
  transcriptPath?: string
  isCurrentSession: boolean
  status: 'closed' | 'current'
}

export type SessionHistoryWorkspaceGroup = {
  workspacePath: string
  workspaceName: string
  isCurrentWorkspace: boolean
  updatedAt: string
  sessionCount: number
  sessions: SessionHistoryItem[]
}

export type SessionHistoryListResult = {
  groups: SessionHistoryWorkspaceGroup[]
  nextCursor?: string
}

export type TurnContentSource =
  | {
      kind: 'file'
      path: string
    }
  | {
      kind: 'url'
      url: string
    }
  | {
      kind: 'contentRef'
      contentRef: string
    }

export type TurnAttachmentMetadata = {
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: TurnContentSource
}

export type TurnTextContentBlock = {
  type: 'text'
  text: string
}

export type TurnImageContentBlock = TurnAttachmentMetadata & {
  type: 'image'
}

export type TurnFileContentBlock = TurnAttachmentMetadata & {
  type: 'file'
}

export type TurnAudioContentBlock = TurnAttachmentMetadata & {
  type: 'audio'
}

export type TurnContentBlock =
  | TurnTextContentBlock
  | TurnImageContentBlock
  | TurnFileContentBlock
  | TurnAudioContentBlock

export type TurnInput =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'content'
      content: TurnContentBlock[]
    }

export type TurnStartResult = {
  turn: AppServerTurn
}

export type TurnInterruptResult = {
  accepted: boolean
}

export type PermissionRespondResult = {
  accepted: boolean
}

export type PermissionSettingsGetResult = CorePermissionSettingsSnapshot

export type PermissionSettingsUpdateResult = CorePermissionSettingsSnapshot

export type ContextStatusResult = Record<string, unknown>

export type ContextAnalyzeResult = Record<string, unknown>

export type CompactStatusResult = Record<string, unknown>

export type CompactRunResult = Record<string, unknown>

export type MemorySessionStatusResult = Record<string, unknown>

export const DEFAULT_SERVER_CAPABILITIES: ServerCapabilities = {
  config: true,
  auth: true,
  models: true,
  mcp: true,
  workspace: true,
  threads: true,
  turns: true,
  permissions: true,
  context: true,
  compact: true,
  memory: true,
}

export function successResponse(
  id: JsonRpcResponseId,
  result: unknown,
): JsonRpcSuccessResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  }
}
