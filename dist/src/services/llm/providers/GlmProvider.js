import { getLlmProfileForProvider, getLlmProviderConfig, loadLlmConfig, } from '../llmConfig.js';
import { getLlmProviderApiKey } from '../providerCredentials.js';
import { OpenAiImageGenerationAdapter, } from '../protocols/openaiImageGenerationAdapter.js';
import { OpenAiChatCompatibleProvider, } from './OpenAiChatCompatibleProvider.js';
const GLM_API_SPEC = {
    providerId: 'glm-api',
    providerLabel: 'GLM API',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-5.1',
    apiKeyEnvNames: [
        'CCR_GLM_API_KEY',
        'GLM_API_KEY',
        'ZAI_API_KEY',
        'ZHIPUAI_API_KEY',
    ],
    baseUrlEnvNames: ['CCR_GLM_API_BASE_URL', 'GLM_API_BASE_URL'],
};
const GLM_IMAGE_GENERATION_MODELS = new Set(['glm-image']);
const GLM_CODING_SPEC = {
    providerId: 'glm-coding',
    providerLabel: 'GLM Coding Plan',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    defaultModel: 'glm-5.1',
    apiKeyEnvNames: [
        'CCR_GLM_CODING_API_KEY',
        'GLM_CODING_API_KEY',
        'ZAI_CODING_API_KEY',
    ],
    baseUrlEnvNames: ['CCR_GLM_CODING_BASE_URL', 'GLM_CODING_BASE_URL'],
    missingApiKeyMessage: 'GLM Coding Plan API key is missing. Set CCR_GLM_CODING_API_KEY, GLM_CODING_API_KEY, or ZAI_CODING_API_KEY.',
};
export class GlmApiProvider extends OpenAiChatCompatibleProvider {
    #options;
    constructor(options = {}) {
        super(GLM_API_SPEC, options);
        this.#options = options;
    }
    async generate(request) {
        if (isGlmImageGenerationModel(request.model)) {
            throw createGlmImageChatRouteError();
        }
        return super.generate(request);
    }
    stream(request) {
        if (isGlmImageGenerationModel(request.model)) {
            throw createGlmImageChatRouteError();
        }
        return super.stream(request);
    }
    async generateImage(request) {
        const connection = resolveGlmApiConnection(request.profileId, this.#options);
        const adapter = new OpenAiImageGenerationAdapter({
            providerId: GLM_API_SPEC.providerId,
            providerLabel: GLM_API_SPEC.providerLabel,
            apiKey: connection.apiKey,
            baseUrl: connection.baseUrl,
            defaultModel: connection.defaultImageModel,
            missingApiKeyMessage: 'GLM API key is missing. Set CCR_GLM_API_KEY, GLM_API_KEY, ZAI_API_KEY, or ZHIPUAI_API_KEY.',
            fetchImpl: this.#options.fetchImpl,
        });
        return adapter.generateImage({
            ...request,
            model: request.model?.trim() || connection.defaultImageModel,
        });
    }
}
export class GlmCodingProvider extends OpenAiChatCompatibleProvider {
    constructor(options = {}) {
        super(GLM_CODING_SPEC, options);
    }
}
function resolveGlmApiConnection(profileId, options) {
    const config = loadLlmConfig();
    const providerConfig = getLlmProviderConfig(GLM_API_SPEC.providerId, config);
    const profile = getGlmProfileForRequest(profileId, config);
    const credential = getLlmProviderApiKey({
        provider: GLM_API_SPEC.providerId,
        profileId: profile?.id,
        envNames: GLM_API_SPEC.apiKeyEnvNames,
    });
    return {
        apiKey: options.apiKey?.trim() || credential.apiKey,
        baseUrl: options.baseUrl?.trim() ||
            getFirstEnvironmentValue(GLM_API_SPEC.baseUrlEnvNames) ||
            profile?.baseUrl ||
            providerConfig?.baseUrl ||
            GLM_API_SPEC.defaultBaseUrl,
        defaultImageModel: getDefaultImageModelFromMetadata(providerConfig?.metadata) ?? 'glm-image',
    };
}
function getGlmProfileForRequest(profileId, config) {
    const normalizedProfileId = profileId?.trim();
    if (normalizedProfileId) {
        const profile = config.profiles[normalizedProfileId];
        return profile?.providerType === GLM_API_SPEC.providerId ? profile : undefined;
    }
    return getLlmProfileForProvider(GLM_API_SPEC.providerId, config);
}
function getFirstEnvironmentValue(names) {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) {
            return value;
        }
    }
    return undefined;
}
function getDefaultImageModelFromMetadata(metadata) {
    const value = metadata?.defaultImageModel;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function isGlmImageGenerationModel(model) {
    return GLM_IMAGE_GENERATION_MODELS.has(model?.trim().toLowerCase() ?? '');
}
function createGlmImageChatRouteError() {
    return new Error('GLM-Image only supports the image generation route. Use a GLM API text model as the current model; CCR will call glm-image through /images/generations when an image-generation prompt is detected.');
}
//# sourceMappingURL=GlmProvider.js.map