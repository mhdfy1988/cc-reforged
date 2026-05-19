import { OpenAiResponsesHostedImageGenerationAdapter, toOpenAiResponsesImageGenerationRequestBody, normalizeOpenAiResponsesImageGenerationResponse, } from './openaiResponsesHostedImageGenerationAdapter.js';
export { normalizeOpenAiResponsesImageGenerationResponse, toOpenAiResponsesImageGenerationRequestBody, };
export class OpenAiResponsesImageGenerationAdapter {
    #providerId;
    #providerLabel;
    #apiKey;
    #baseUrl;
    #defaultModel;
    #missingApiKeyMessage;
    #fetchImpl;
    constructor(options) {
        this.#providerId = options.providerId;
        this.#providerLabel = options.providerLabel;
        this.#apiKey = options.apiKey?.trim();
        this.#baseUrl = options.baseUrl;
        this.#defaultModel = options.defaultModel;
        this.#missingApiKeyMessage =
            options.missingApiKeyMessage ??
                `${options.providerLabel} API key is missing.`;
        this.#fetchImpl = options.fetchImpl || fetch;
    }
    async generateImage(request) {
        const apiKey = this.#apiKey?.trim();
        if (!apiKey) {
            throw new Error(this.#missingApiKeyMessage);
        }
        return new OpenAiResponsesHostedImageGenerationAdapter({
            providerId: this.#providerId,
            providerLabel: this.#providerLabel,
            baseUrl: this.#baseUrl,
            defaultModel: this.#defaultModel,
            headers: {
                authorization: `Bearer ${apiKey}`,
                'content-type': 'application/json',
            },
            requestBodyFactory: toOpenAiResponsesImageGenerationRequestBody,
            fetchImpl: this.#fetchImpl,
        }).generateImage(request);
    }
}
//# sourceMappingURL=openaiResponsesImageGenerationAdapter.js.map