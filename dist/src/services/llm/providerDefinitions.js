const DEFAULT_CAPABILITIES = {
    streaming: false,
    tools: false,
    reasoning: false,
    usage: false,
};
const BUILTIN_PROVIDER_DEFINITION_MAP = {
    anthropic: {
        id: 'anthropic',
        displayName: 'Anthropic',
        apiMode: 'anthropic-messages',
        authStrategy: 'hybrid',
        capabilities: {
            streaming: true,
            tools: true,
            reasoning: true,
            usage: true,
        },
    },
    'codex-oauth': {
        id: 'codex-oauth',
        displayName: 'Codex OAuth',
        apiMode: 'openai-responses',
        authStrategy: 'oauth_refreshable',
        capabilities: {
            streaming: true,
            tools: true,
            reasoning: true,
            usage: true,
        },
    },
    deepseek: {
        id: 'deepseek',
        displayName: 'DeepSeek',
        apiMode: 'openai-chat',
        authStrategy: 'api_key',
        capabilities: {
            streaming: true,
            tools: true,
            reasoning: true,
            usage: true,
        },
    },
    minimax: {
        id: 'minimax',
        displayName: 'MiniMax 国际版',
        apiMode: 'anthropic-messages',
        authStrategy: 'api_key',
        capabilities: {
            streaming: true,
            tools: true,
            reasoning: true,
            usage: true,
        },
    },
    'minimax-cn': {
        id: 'minimax-cn',
        displayName: 'MiniMax 国内版',
        apiMode: 'anthropic-messages',
        authStrategy: 'api_key',
        capabilities: {
            streaming: true,
            tools: true,
            reasoning: true,
            usage: true,
        },
    },
};
function normalizeCapabilities(input) {
    return {
        ...DEFAULT_CAPABILITIES,
        ...(input ?? {}),
    };
}
export function createLlmProviderDefinition(input) {
    return {
        ...input,
        id: input.id.trim(),
        displayName: input.displayName.trim(),
        authStrategy: input.authStrategy,
        capabilities: normalizeCapabilities(input.capabilities),
    };
}
export function mergeLlmProviderDefinition(base, override) {
    return createLlmProviderDefinition({
        ...base,
        ...override,
        capabilities: normalizeCapabilities({
            ...base.capabilities,
            ...(override.capabilities ?? {}),
        }),
    });
}
export function getBuiltinLlmProviderDefinition(providerId) {
    const definition = BUILTIN_PROVIDER_DEFINITION_MAP[providerId];
    if (!definition) {
        return undefined;
    }
    return createLlmProviderDefinition(definition);
}
export function createFallbackLlmProviderDefinition(providerId, provider) {
    return createLlmProviderDefinition({
        id: providerId,
        displayName: providerId,
        apiMode: 'custom',
        authStrategy: 'unknown',
        capabilities: {
            streaming: typeof provider?.stream === 'function' ||
                provider?.supportsStreaming === true,
        },
    });
}
export function resolveLlmProviderDefinition(provider) {
    const builtin = getBuiltinLlmProviderDefinition(provider.name) ??
        createFallbackLlmProviderDefinition(provider.name, provider);
    if (!provider.definition) {
        return builtin;
    }
    return mergeLlmProviderDefinition(builtin, provider.definition);
}
export function listBuiltinLlmProviderDefinitions() {
    return Object.values(BUILTIN_PROVIDER_DEFINITION_MAP).map(definition => createLlmProviderDefinition(definition));
}
//# sourceMappingURL=providerDefinitions.js.map