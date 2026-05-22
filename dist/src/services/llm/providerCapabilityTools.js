import { getLlmProfileForProvider, getLlmProviderConfig, loadLlmConfig, } from './llmConfig.js';
import { getDefaultLlmRuntime } from './defaultRuntime.js';
import { createFallbackLlmProviderDefinition, getBuiltinLlmProviderDefinition, } from './providerDefinitions.js';
const IMAGE_GENERATION_TOOL_NAME = 'GenerateImage';
const BUILTIN_IMAGE_GENERATION_TOOL_CONFIGS = {
    openai: {
        defaultModel: 'gpt-image-1',
        source: 'builtin',
    },
    'codex-oauth': {
        source: 'builtin',
    },
    'glm-api': {
        defaultModel: 'glm-image',
        source: 'builtin',
    },
    minimax: {
        defaultModel: 'image-01',
        source: 'builtin',
    },
    'minimax-cn': {
        defaultModel: 'image-01',
        source: 'builtin',
    },
};
export function resolveLlmProviderCapabilityTools(input = {}) {
    const config = input.config ?? loadLlmConfig();
    const providerId = normalizeNonEmptyString(input.providerId) ?? config.provider;
    const runtime = input.runtime ?? getDefaultLlmRuntime();
    const providerDefinition = resolveProviderDefinition(providerId, runtime);
    const provider = getRuntimeProvider(runtime, providerId);
    const providerConfig = getLlmProviderConfig(providerId, config);
    const profile = resolveProfileForProvider({
        providerId,
        profileId: input.profileId,
        config,
    });
    const metadataImageModel = getDefaultImageModelFromMetadata(providerConfig?.metadata);
    const builtinImageConfig = BUILTIN_IMAGE_GENERATION_TOOL_CONFIGS[providerId];
    const imageGenerationModel = resolveImageGenerationModel({
        requestedModel: input.imageGenerationModel,
        primaryModel: input.model,
        metadataImageModel,
        builtinImageModel: builtinImageConfig?.defaultModel,
        providerId,
        profile,
        providerConfig,
        config,
    });
    const hasRuntimeSupport = typeof provider?.generateImage === 'function';
    const source = resolveImageGenerationSource({
        hasRuntimeSupport,
        metadataImageModel,
        builtinImageConfig,
    });
    return {
        imageGeneration: {
            available: hasRuntimeSupport,
            toolName: IMAGE_GENERATION_TOOL_NAME,
            provider: providerId,
            providerDisplayName: providerDefinition.displayName,
            model: imageGenerationModel,
            source,
            route: 'same_provider',
            dataBoundary: 'same_provider',
            message: hasRuntimeSupport
                ? [
                    `${IMAGE_GENERATION_TOOL_NAME} 将通过 ${providerDefinition.displayName} / ${imageGenerationModel} 执行。`,
                    '数据边界为同供应商能力工具，不会自动跨供应商。',
                ].join('')
                : [
                    `当前供应商不支持生图：${providerDefinition.displayName} / ${imageGenerationModel}。`,
                    '请切换到支持生图的供应商后再试，例如 GLM API（glm-image）、OpenAI（gpt-image-1）、Codex OAuth 或 MiniMax（image-01）。',
                ].join(''),
            ...(hasRuntimeSupport ? {} : { reason: 'provider_unsupported' }),
        },
    };
}
export function summarizeLlmProviderCapabilityTools(capabilityTools) {
    return {
        imageGeneration: {
            available: capabilityTools.imageGeneration.available,
            provider: capabilityTools.imageGeneration.provider,
            model: capabilityTools.imageGeneration.model,
            source: capabilityTools.imageGeneration.source,
            route: capabilityTools.imageGeneration.route,
            dataBoundary: capabilityTools.imageGeneration.dataBoundary,
            message: capabilityTools.imageGeneration.message,
        },
    };
}
function resolveProviderDefinition(providerId, runtime) {
    try {
        return runtime.getProviderDefinition(providerId);
    }
    catch {
        return (getBuiltinLlmProviderDefinition(providerId) ??
            createFallbackLlmProviderDefinition(providerId));
    }
}
function getRuntimeProvider(runtime, providerId) {
    try {
        return runtime.getProvider(providerId);
    }
    catch {
        return undefined;
    }
}
function resolveProfileForProvider(input) {
    const requestedProfileId = normalizeNonEmptyString(input.profileId);
    if (requestedProfileId) {
        const profile = input.config.profiles[requestedProfileId];
        return profile?.providerType === input.providerId ? profile : undefined;
    }
    if (input.providerId === input.config.provider) {
        const currentProfile = input.config.profiles[input.config.currentProfileId];
        if (currentProfile?.providerType === input.providerId) {
            return currentProfile;
        }
    }
    return getLlmProfileForProvider(input.providerId, input.config);
}
function resolveImageGenerationModel(input) {
    return (normalizeNonEmptyString(input.requestedModel) ??
        input.metadataImageModel ??
        input.builtinImageModel ??
        normalizeNonEmptyString(input.primaryModel) ??
        (input.providerId === input.config.provider
            ? normalizeNonEmptyString(input.config.model)
            : undefined) ??
        normalizeNonEmptyString(input.profile?.defaultModel) ??
        normalizeNonEmptyString(input.providerConfig?.defaultModel) ??
        input.providerId);
}
function resolveImageGenerationSource(input) {
    if (!input.hasRuntimeSupport) {
        return 'disabled_default';
    }
    if (input.metadataImageModel) {
        return 'provider_metadata';
    }
    if (input.builtinImageConfig) {
        return input.builtinImageConfig.source;
    }
    return 'runtime_provider';
}
function getDefaultImageModelFromMetadata(metadata) {
    const value = metadata?.defaultImageModel;
    return normalizeNonEmptyString(value);
}
function normalizeNonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
//# sourceMappingURL=providerCapabilityTools.js.map