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
export const AuthLoginParamsSchema = z
    .object({
    profileId: z.string().min(1).optional(),
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
export const ModelProfileListParamsSchema = z
    .object({
    providerType: z.string().min(1).optional(),
})
    .strict()
    .default({});
export const ModelProfileSetCurrentParamsSchema = z
    .object({
    profileId: z.string().min(1),
    model: z.string().min(1).optional(),
})
    .strict();
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
    setCurrent: z.boolean().optional(),
})
    .strict();
export const ModelProfileCopyParamsSchema = z
    .object({
    profileId: z.string().min(1),
    name: z.string().min(1).optional(),
})
    .strict();
export const ModelProfileDeleteParamsSchema = z
    .object({
    profileId: z.string().min(1),
})
    .strict();
export const ModelSetParamsSchema = z
    .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1),
})
    .strict();
export const ModelAvailabilityParamsSchema = z
    .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
})
    .strict()
    .default({});
export const ModelTestParamsSchema = z
    .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
})
    .strict()
    .default({});
export const ModelCredentialUpdateParamsSchema = z
    .object({
    profileId: z.string().min(1).optional(),
    provider: z.string().min(1),
    model: z.string().min(1).optional(),
    apiKey: z.string().optional().nullable(),
})
    .strict();
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
export const ThreadResumeParamsSchema = z
    .object({
    sessionId: z.string().min(1),
    title: z.string().min(1).optional(),
    transcriptPath: z.string().min(1).optional(),
    projectPath: z.string().min(1).optional(),
    metadata: JsonRpcParamsSchema.optional(),
})
    .strict();
export const SessionHistoryListParamsSchema = z
    .object({
    scope: z.enum(['sameRepo', 'allProjects']).optional().default('sameRepo'),
    query: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
    cursor: z.string().optional(),
    includeCurrent: z.boolean().optional(),
})
    .strict()
    .default({});
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
    acceptFeedback: z.string().optional(),
    interrupt: z.boolean().optional(),
    toolUseID: z.string().optional(),
    decisionClassification: z
        .enum(['user_temporary', 'user_permanent', 'user_reject'])
        .optional(),
})
    .strict();
export const PermissionSettingsGetParamsSchema = z.object({}).strict().default({});
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
    .strict();
export const ThreadScopedStatusParamsSchema = z
    .object({
    threadId: z.string().min(1).optional(),
})
    .strict()
    .default({});
export const ContextAnalyzeParamsSchema = ThreadScopedStatusParamsSchema;
export const CompactRunParamsSchema = z
    .object({
    threadId: z.string().min(1),
    instruction: z.string().optional(),
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
    context: true,
    compact: true,
    memory: true,
};
export function successResponse(id, result) {
    return {
        jsonrpc: '2.0',
        id,
        result,
    };
}
//# sourceMappingURL=protocol.js.map