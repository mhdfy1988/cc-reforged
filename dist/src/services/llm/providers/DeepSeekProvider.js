import { getLlmProviderConfig } from '../llmConfig.js';
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js';
import { OpenAiChatCompletionsAdapter, } from '../protocols/openaiChatCompletionsAdapter.js';
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_REASONING_EFFORT = 'high';
export class DeepSeekProvider {
    name = 'deepseek';
    definition = getBuiltinLlmProviderDefinition(this.name);
    supportsStreaming = true;
    #adapter;
    constructor(options = {}) {
        const config = getLlmProviderConfig('deepseek');
        const apiKey = options.apiKey?.trim() ||
            process.env.CCR_DEEPSEEK_API_KEY?.trim() ||
            process.env.DEEPSEEK_API_KEY?.trim();
        const baseUrl = options.baseUrl ||
            process.env.CCR_DEEPSEEK_BASE_URL?.trim() ||
            process.env.DEEPSEEK_BASE_URL?.trim() ||
            config?.baseUrl ||
            DEFAULT_BASE_URL;
        const defaultModel = options.defaultModel?.trim() || config?.defaultModel || DEFAULT_MODEL;
        const defaultReasoningEffort = options.defaultReasoningEffort ||
            normalizeReasoningEffort(config?.reasoningEffort) ||
            DEFAULT_REASONING_EFFORT;
        const configuredThinking = options.thinking;
        this.#adapter = new OpenAiChatCompletionsAdapter({
            providerId: this.name,
            providerLabel: 'DeepSeek',
            apiKey,
            baseUrl,
            defaultModel,
            defaultReasoningEffort,
            missingApiKeyMessage: 'DeepSeek API key is missing. Set CCR_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.',
            fetchImpl: options.fetchImpl,
            resolveThinking: ({ model }) => model.startsWith('deepseek-v4-')
                ? configuredThinking || 'enabled'
                : undefined,
        });
    }
    async generate(request) {
        return this.#adapter.generate(request);
    }
    stream(request) {
        return this.#adapter.stream(request);
    }
}
function normalizeReasoningEffort(value) {
    return value === 'high' ? 'high' : undefined;
}
//# sourceMappingURL=DeepSeekProvider.js.map