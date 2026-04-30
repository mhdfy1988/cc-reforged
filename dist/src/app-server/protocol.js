import { z } from 'zod';
export const APP_SERVER_PROTOCOL_VERSION = '0.1';
export const APP_SERVER_CONFIG_SCHEMA_VERSION = '0.1';
export const JsonRpcIdSchema = z.union([z.string(), z.number()]);
export const JsonRpcParamsSchema = z.record(z.string(), z.unknown());
export const JsonRpcRequestSchema = z
    .object({
    jsonrpc: z.literal('2.0'),
    id: JsonRpcIdSchema,
    method: z.string().min(1),
    params: JsonRpcParamsSchema.optional(),
})
    .strict();
export const JsonRpcSuccessResponseSchema = z
    .object({
    jsonrpc: z.literal('2.0'),
    id: JsonRpcIdSchema.nullable(),
    result: z.unknown(),
})
    .strict();
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
    .strict();
export const JsonRpcResponseSchema = z.union([
    JsonRpcSuccessResponseSchema,
    JsonRpcErrorResponseSchema,
]);
export const JsonRpcNotificationSchema = z
    .object({
    jsonrpc: z.literal('2.0'),
    method: z.string().min(1),
    params: JsonRpcParamsSchema.optional(),
})
    .strict();
export const ClientInfoSchema = z
    .object({
    name: z.string().min(1),
    title: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
})
    .strict();
export const ClientCapabilitiesSchema = z
    .object({
    streaming: z.boolean().optional(),
    permissionPrompts: z.boolean().optional(),
    workspaceTrust: z.boolean().optional(),
    mcpManagement: z.boolean().optional(),
})
    .strict();
export const InitializeParamsSchema = z
    .object({
    clientInfo: ClientInfoSchema.optional(),
    capabilities: ClientCapabilitiesSchema.optional(),
})
    .strict()
    .default({});
export const ShutdownParamsSchema = z.object({}).strict().default({});
export const ConfigGetParamsSchema = z.object({}).strict().default({});
export const AuthStatusParamsSchema = z
    .object({
    provider: z.string().min(1).optional(),
})
    .strict()
    .default({});
export const ModelListParamsSchema = z
    .object({
    provider: z.string().min(1).optional(),
})
    .strict()
    .default({});
export const McpListParamsSchema = z
    .object({
    includeDisabled: z.boolean().optional(),
})
    .strict()
    .default({});
export const WorkspaceOpenParamsSchema = z
    .object({
    path: z.string().min(1),
    trust: z.literal('trusted'),
})
    .strict();
export const ThreadStartParamsSchema = z
    .object({
    title: z.string().min(1).optional(),
    metadata: JsonRpcParamsSchema.optional(),
})
    .strict()
    .default({});
export const ThreadListParamsSchema = z.object({}).strict().default({});
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
    .strict();
export const TurnInterruptParamsSchema = z
    .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    reason: z.string().min(1).optional(),
})
    .strict();
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
    .strict();
export const DEFAULT_SERVER_CAPABILITIES = {
    config: true,
    auth: true,
    models: true,
    mcp: true,
    workspace: true,
    threads: true,
    turns: true,
    permissions: true,
};
export function successResponse(id, result) {
    return {
        jsonrpc: '2.0',
        id,
        result,
    };
}
//# sourceMappingURL=protocol.js.map