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
const ModelCapabilityOverrideSchema = z
    .object({
    inputModalities: z
        .array(z.enum(['text', 'image', 'file', 'audio', 'video']))
        .optional(),
    outputModalities: z
        .array(z.enum(['text', 'image', 'audio', 'file', 'video']))
        .optional(),
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
    .strict();
const ModelCapabilityOverridesSchema = z
    .object({
    default: ModelCapabilityOverrideSchema.optional(),
    models: z.record(ModelCapabilityOverrideSchema).optional(),
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
    capabilityOverrides: ModelCapabilityOverridesSchema.optional(),
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
const McpWritableScopeSchema = z.enum(['user', 'project', 'local']);
export const McpInspectParamsSchema = z
    .object({
    name: z.string().min(1),
})
    .strict();
export const McpAddParamsSchema = z
    .object({
    name: z.string().min(1),
    scope: McpWritableScopeSchema,
    config: JsonRpcParamsSchema,
})
    .strict();
export const McpUpdateParamsSchema = McpAddParamsSchema;
export const McpRemoveParamsSchema = z
    .object({
    name: z.string().min(1),
    scope: McpWritableScopeSchema,
})
    .strict();
export const McpEnableParamsSchema = McpInspectParamsSchema;
export const McpDisableParamsSchema = McpInspectParamsSchema;
export const McpRestartParamsSchema = McpInspectParamsSchema;
export const McpTestParamsSchema = McpInspectParamsSchema;
export const McpInstallSearchParamsSchema = z
    .object({
    query: z.string().optional(),
})
    .strict()
    .default({});
export const McpInstallPlanParamsSchema = z
    .object({
    name: z.string().min(1).optional(),
    scope: McpWritableScopeSchema.default('user'),
    manifest: JsonRpcParamsSchema,
    force: z.boolean().optional(),
})
    .strict();
export const McpInstallApplyParamsSchema = McpInstallPlanParamsSchema.extend({
    confirmed: z.boolean(),
    confirmationToken: z.string().min(1),
}).strict();
export const McpInstallSaveManifestParamsSchema = z
    .object({
    manifest: JsonRpcParamsSchema,
    overwrite: z.boolean().optional(),
})
    .strict();
export const McpInstallAdoptPlanParamsSchema = z
    .object({
    name: z.string().min(1),
})
    .strict();
export const McpInstallAdoptApplyParamsSchema = McpInstallAdoptPlanParamsSchema.extend({
    confirmed: z.boolean(),
    confirmationToken: z.string().min(1),
}).strict();
export const McpInstallListParamsSchema = z.object({}).strict().default({});
export const McpInstallUninstallParamsSchema = z
    .object({
    name: z.string().min(1),
    confirmed: z.boolean(),
})
    .strict();
export const McpInstallRepairParamsSchema = z
    .object({
    name: z.string().min(1),
    scope: McpWritableScopeSchema.default('user'),
    confirmed: z.boolean(),
})
    .strict();
const SkillInstallScopeSchema = z.enum(['user', 'project']);
export const SkillInstallSearchParamsSchema = z
    .object({
    query: z.string().optional(),
})
    .strict()
    .default({});
export const SkillInstallPlanParamsSchema = z
    .object({
    scope: SkillInstallScopeSchema.default('user'),
    manifest: JsonRpcParamsSchema,
    force: z.boolean().optional(),
    securityOverrideToken: z.string().min(1).optional(),
})
    .strict();
export const SkillInstallApplyParamsSchema = SkillInstallPlanParamsSchema.extend({
    confirmed: z.boolean(),
    confirmationToken: z.string().min(1),
}).strict();
export const SkillInstallListParamsSchema = z.object({}).strict().default({});
export const SkillInspectParamsSchema = z
    .object({
    skillRef: z.string().min(1),
})
    .strict();
export const SkillImportPlanParamsSchema = z
    .object({
    source: JsonRpcParamsSchema,
})
    .strict();
export const SkillImportApplyParamsSchema = SkillImportPlanParamsSchema.extend({
    confirmed: z.boolean(),
    confirmationToken: z.string().min(1),
}).strict();
export const SkillSetEnabledParamsSchema = z
    .object({
    skillRef: z.string().min(1),
    enabled: z.boolean(),
})
    .strict();
export const SkillSetInvocationParamsSchema = z
    .object({
    skillRef: z.string().min(1),
    modelInvocable: z.boolean().optional(),
    userInvocable: z.boolean().optional(),
})
    .strict();
export const SkillInstallUninstallParamsSchema = z
    .object({
    skillRef: z.string().min(1),
    confirmed: z.boolean(),
})
    .strict();
export const SkillInstallRepairParamsSchema = SkillInstallUninstallParamsSchema;
export const SkillInstallSaveManifestParamsSchema = z
    .object({
    manifest: JsonRpcParamsSchema,
    overwrite: z.boolean().optional(),
})
    .strict();
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
export const ThreadMessagesListParamsSchema = z
    .object({
    threadId: z.string().min(1),
})
    .strict();
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
export const SessionHistoryRenameParamsSchema = z
    .object({
    sessionId: z.string().uuid(),
    title: z.string().trim().min(1).max(80),
    transcriptPath: z.string().min(1).optional(),
})
    .strict();
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
]);
const TurnAttachmentMetadataSchema = z
    .object({
    attachmentId: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    source: TurnContentSourceSchema.optional(),
})
    .strict();
export const TurnTextContentBlockSchema = z
    .object({
    type: z.literal('text'),
    text: z.string().min(1),
})
    .strict();
export const TurnImageContentBlockSchema = TurnAttachmentMetadataSchema.extend({
    type: z.literal('image'),
}).strict();
export const TurnFileContentBlockSchema = TurnAttachmentMetadataSchema.extend({
    type: z.literal('file'),
}).strict();
export const TurnAudioContentBlockSchema = TurnAttachmentMetadataSchema.extend({
    type: z.literal('audio'),
}).strict();
export const TurnVideoContentBlockSchema = TurnAttachmentMetadataSchema.extend({
    type: z.literal('video'),
}).strict();
export const TurnContentBlockSchema = z.discriminatedUnion('type', [
    TurnTextContentBlockSchema,
    TurnImageContentBlockSchema,
    TurnFileContentBlockSchema,
    TurnAudioContentBlockSchema,
    TurnVideoContentBlockSchema,
]);
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
]);
export const TurnImageGenerationOptionsSchema = z
    .object({
    enabled: z.boolean().optional(),
    prompt: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    size: z.string().min(1).optional(),
    quality: z.string().min(1).optional(),
    outputFormat: z.string().min(1).optional(),
    responseFormat: z.enum(['b64_json', 'url']).optional(),
    n: z.number().int().positive().optional(),
    metadata: z.record(z.unknown()).optional(),
})
    .strict();
export const TurnImageGenerationOptionSchema = z.union([
    z.boolean(),
    TurnImageGenerationOptionsSchema,
]);
export const TurnStartParamsSchema = z
    .object({
    threadId: z.string().min(1),
    input: TurnInputSchema,
    options: z
        .object({
        stream: z.boolean().optional(),
        imageGeneration: TurnImageGenerationOptionSchema.optional(),
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
export const PermissionPendingListParamsSchema = z.object({}).strict().default({});
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
    skills: true,
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