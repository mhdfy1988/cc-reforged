import { getLlmProfileForProvider, getLlmProviderConfig, loadLlmConfig, } from '../llmConfig.js';
import { getLlmProviderApiKey } from '../providerCredentials.js';
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js';
import { OpenAiChatCompletionsAdapter, } from '../protocols/openaiChatCompletionsAdapter.js';
import { OpenAiImageGenerationAdapter, } from '../protocols/openaiImageGenerationAdapter.js';
import { OpenAiResponsesImageGenerationAdapter, } from '../protocols/openaiResponsesImageGenerationAdapter.js';
import { shouldUseOpenAiResponsesImageGeneration } from '../openaiImageGenerationRouting.js';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-5.4';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
export class OpenAiProvider {
    name = 'openai';
    definition = getBuiltinLlmProviderDefinition(this.name);
    supportsStreaming = true;
    #options;
    constructor(options = {}) {
        this.#options = options;
    }
    #resolveConnection(request) {
        const resolvedConfig = loadLlmConfig();
        const config = getLlmProviderConfig('openai', resolvedConfig);
        const profile = getOpenAiProfileForRequest(request.profileId, resolvedConfig);
        const credential = getLlmProviderApiKey({
            provider: 'openai',
            profileId: profile?.id,
            envNames: ['CCR_OPENAI_API_KEY', 'OPENAI_API_KEY'],
        });
        return {
            apiKey: this.#options.apiKey?.trim() || credential.apiKey,
            baseUrl: this.#options.baseUrl?.trim() ||
                process.env.CCR_OPENAI_BASE_URL?.trim() ||
                process.env.OPENAI_BASE_URL?.trim() ||
                profile?.baseUrl ||
                config?.baseUrl ||
                DEFAULT_BASE_URL,
            defaultModel: this.#options.defaultModel?.trim() ||
                profile?.defaultModel ||
                config?.defaultModel ||
                DEFAULT_MODEL,
            defaultImageModel: this.#options.defaultImageModel?.trim() ||
                getDefaultImageModelFromMetadata(config?.metadata) ||
                DEFAULT_IMAGE_MODEL,
        };
    }
    #createChatAdapter(request) {
        const connection = this.#resolveConnection(request);
        return new OpenAiChatCompletionsAdapter({
            providerId: this.name,
            providerLabel: 'OpenAI',
            apiKey: connection.apiKey,
            baseUrl: connection.baseUrl,
            defaultModel: connection.defaultModel,
            missingApiKeyMessage: 'OpenAI API key is missing. Set CCR_OPENAI_API_KEY or OPENAI_API_KEY.',
            fetchImpl: this.#options.fetchImpl,
        });
    }
    #createImageAdapter(request) {
        const connection = this.#resolveConnection(request);
        return new OpenAiImageGenerationAdapter({
            providerId: this.name,
            providerLabel: 'OpenAI',
            apiKey: connection.apiKey,
            baseUrl: connection.baseUrl,
            defaultModel: connection.defaultImageModel,
            missingApiKeyMessage: 'OpenAI API key is missing. Set CCR_OPENAI_API_KEY or OPENAI_API_KEY.',
            fetchImpl: this.#options.fetchImpl,
        });
    }
    #createResponsesImageAdapter(request) {
        const connection = this.#resolveConnection(request);
        return new OpenAiResponsesImageGenerationAdapter({
            providerId: this.name,
            providerLabel: 'OpenAI',
            apiKey: connection.apiKey,
            baseUrl: connection.baseUrl,
            defaultModel: connection.defaultModel,
            missingApiKeyMessage: 'OpenAI API key is missing. Set CCR_OPENAI_API_KEY or OPENAI_API_KEY.',
            fetchImpl: this.#options.fetchImpl,
        });
    }
    async generate(request) {
        return this.#createChatAdapter(request).generate(request);
    }
    stream(request) {
        return this.#createChatAdapter(request).stream(request);
    }
    async generateImage(request) {
        const useResponsesImageGeneration = shouldUseOpenAiResponsesImageGeneration(request.metadata);
        const connection = this.#resolveConnection(request);
        const model = request.model?.trim() ||
            (useResponsesImageGeneration
                ? connection.defaultModel
                : connection.defaultImageModel);
        const adapter = useResponsesImageGeneration
            ? this.#createResponsesImageAdapter(request)
            : this.#createImageAdapter(request);
        return adapter.generateImage({
            ...request,
            model,
        });
    }
}
function getOpenAiProfileForRequest(profileId, config) {
    const normalizedProfileId = profileId?.trim();
    if (normalizedProfileId) {
        const profile = config.profiles[normalizedProfileId];
        return profile?.providerType === 'openai' ? profile : undefined;
    }
    return getLlmProfileForProvider('openai', config);
}
function getDefaultImageModelFromMetadata(metadata) {
    const value = metadata?.defaultImageModel;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
//# sourceMappingURL=OpenAiProvider.js.map