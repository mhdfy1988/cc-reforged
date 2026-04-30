import { z } from 'zod'

export const APP_SERVER_PROTOCOL_VERSION = '0.1'

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

export const ModelListParamsSchema = z
  .object({
    provider: z.string().min(1).optional(),
  })
  .strict()
  .default({})

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

export const TurnStartParamsSchema = z
  .object({
    threadId: z.string().min(1),
    input: z
      .object({
        type: z.literal('text'),
        text: z.string().min(1),
      })
      .strict(),
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
    interrupt: z.boolean().optional(),
    toolUseID: z.string().optional(),
    decisionClassification: z
      .enum(['user_temporary', 'user_permanent', 'user_reject'])
      .optional(),
  })
  .strict()

export type JsonRpcId = z.infer<typeof JsonRpcIdSchema>
export type JsonRpcResponseId = JsonRpcId | null
export type JsonRpcParams = z.infer<typeof JsonRpcParamsSchema>
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>
export type ClientInfo = z.infer<typeof ClientInfoSchema>
export type ClientCapabilities = z.infer<typeof ClientCapabilitiesSchema>
export type InitializeParams = z.infer<typeof InitializeParamsSchema>
export type WorkspaceOpenParams = z.infer<typeof WorkspaceOpenParamsSchema>
export type ThreadStartParams = z.infer<typeof ThreadStartParamsSchema>
export type TurnStartParams = z.infer<typeof TurnStartParamsSchema>
export type PermissionRespondParams = z.infer<
  typeof PermissionRespondParamsSchema
>

export type ServerCapabilities = {
  config: boolean
  auth: boolean
  models: boolean
  mcp: boolean
  workspace: boolean
  threads: boolean
  turns: boolean
  permissions: boolean
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

export const DEFAULT_SERVER_CAPABILITIES: ServerCapabilities = {
  config: true,
  auth: true,
  models: true,
  mcp: true,
  workspace: true,
  threads: true,
  turns: true,
  permissions: true,
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
