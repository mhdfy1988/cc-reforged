import { getLlmProfileForProvider, getLlmProviderConfig, loadLlmConfig, } from '../llmConfig.js';
import { getLlmProviderApiKey } from '../providerCredentials.js';
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js';
import { OpenAiChatCompletionsAdapter, } from '../protocols/openaiChatCompletionsAdapter.js';
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_REASONING_EFFORT = 'high';
export class DeepSeekProvider {
    name = 'deepseek';
    definition = getBuiltinLlmProviderDefinition(this.name);
    supportsStreaming = true;
    #options;
    constructor(options = {}) {
        this.#options = options;
    }
    #createAdapter(request) {
        const resolvedConfig = loadLlmConfig();
        const config = getLlmProviderConfig('deepseek', resolvedConfig);
        const profile = getDeepSeekProfileForRequest(request.profileId, resolvedConfig);
        const credential = getLlmProviderApiKey({
            provider: 'deepseek',
            profileId: profile?.id,
            envNames: ['CCR_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY'],
        });
        const apiKey = this.#options.apiKey?.trim() ||
            credential.apiKey;
        const baseUrl = this.#options.baseUrl ||
            process.env.CCR_DEEPSEEK_BASE_URL?.trim() ||
            process.env.DEEPSEEK_BASE_URL?.trim() ||
            profile?.baseUrl ||
            config?.baseUrl ||
            DEFAULT_BASE_URL;
        const defaultModel = this.#options.defaultModel?.trim() ||
            profile?.defaultModel ||
            config?.defaultModel ||
            DEFAULT_MODEL;
        const defaultReasoningEffort = this.#options.defaultReasoningEffort ||
            normalizeReasoningEffort(config?.reasoningEffort) ||
            DEFAULT_REASONING_EFFORT;
        const configuredThinking = this.#options.thinking;
        return new OpenAiChatCompletionsAdapter({
            providerId: this.name,
            providerLabel: 'DeepSeek',
            apiKey,
            baseUrl,
            defaultModel,
            defaultReasoningEffort,
            missingApiKeyMessage: 'DeepSeek API key is missing. Set CCR_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.',
            fetchImpl: this.#options.fetchImpl,
            resolveThinking: ({ model }) => model.startsWith('deepseek-v4-')
                ? configuredThinking || 'enabled'
                : undefined,
        });
    }
    async generate(request) {
        return this.#createAdapter(request).generate(request);
    }
    stream(request) {
        return this.#createAdapter(request).stream(request);
    }
}
function getDeepSeekProfileForRequest(profileId, config) {
    const normalizedProfileId = profileId?.trim();
    if (normalizedProfileId) {
        const profile = config.profiles[normalizedProfileId];
        return profile?.providerType === 'deepseek' ? profile : undefined;
    }
    return getLlmProfileForProvider('deepseek', config);
}
function normalizeReasoningEffort(value) {
    return value === 'high' ? 'high' : undefined;
}
//# sourceMappingURL=DeepSeekProvider.js.map