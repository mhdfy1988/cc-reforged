import { LlmProviderRegistry, } from './providerRegistry.js';
function resolveRequiredProviderName(requestedProvider, defaultProvider) {
    const providerName = requestedProvider ?? defaultProvider;
    if (!providerName) {
        throw new Error('No LLM provider configured for this request.');
    }
    return providerName;
}
function resolveRequiredModel(requestedModel, defaultModel) {
    const model = requestedModel ?? defaultModel;
    if (!model) {
        throw new Error('No LLM model configured for this request.');
    }
    return model;
}
export class LlmRuntime {
    #registry;
    #defaultProvider;
    #defaultModel;
    constructor(options = {}) {
        this.#registry = options.registry ?? new LlmProviderRegistry();
        this.#defaultProvider = options.defaultProvider;
        this.#defaultModel = options.defaultModel;
    }
    registerProvider(provider, options = {}) {
        this.#registry.register(provider, options);
        return this;
    }
    listProviders() {
        return this.#registry.list();
    }
    listProviderDefinitions() {
        return this.#registry.listDefinitions();
    }
    getProvider(providerName) {
        return this.#registry.getRequired(providerName);
    }
    getProviderDefinition(providerName) {
        const definition = this.#registry.getDefinition(providerName);
        if (!definition) {
            throw new Error(`Unknown LLM provider definition: ${providerName}`);
        }
        return definition;
    }
    resolveRequest(request) {
        const providerName = resolveRequiredProviderName(request.provider, this.#defaultProvider);
        const provider = this.#registry.getRequired(providerName);
        const model = resolveRequiredModel(request.model, this.#defaultModel);
        return [
            provider,
            {
                ...request,
                provider: provider.name,
                model,
            },
        ];
    }
    async generate(request) {
        const [provider, normalizedRequest] = this.resolveRequest(request);
        return provider.generate(normalizedRequest);
    }
    async generateImage(request) {
        const [provider, normalizedRequest] = this.resolveImageGenerationRequest(request);
        if (typeof provider.generateImage !== 'function') {
            throw new Error(`LLM provider '${provider.name}' does not support image generation.`);
        }
        return provider.generateImage(normalizedRequest);
    }
    async *stream(request) {
        const [provider, normalizedRequest] = this.resolveRequest(request);
        const startEvent = {
            type: 'response_start',
            provider: provider.name,
            model: normalizedRequest.model,
        };
        yield startEvent;
        if (typeof provider.stream === 'function') {
            try {
                yield* provider.stream(normalizedRequest);
                return;
            }
            catch (error) {
                yield {
                    type: 'response_error',
                    provider: provider.name,
                    model: normalizedRequest.model,
                    error,
                };
                throw error;
            }
        }
        try {
            const response = await provider.generate(normalizedRequest);
            for (const part of response.output) {
                yield {
                    type: 'content_part',
                    provider: provider.name,
                    model: response.model,
                    part,
                };
            }
            yield {
                type: 'response_complete',
                provider: provider.name,
                model: response.model,
                response,
            };
        }
        catch (error) {
            yield {
                type: 'response_error',
                provider: provider.name,
                model: normalizedRequest.model,
                error,
            };
            throw error;
        }
    }
    resolveImageGenerationRequest(request) {
        const providerName = resolveRequiredProviderName(request.provider, this.#defaultProvider);
        const provider = this.#registry.getRequired(providerName);
        const model = resolveRequiredModel(request.model, this.#defaultModel);
        return [
            provider,
            {
                ...request,
                provider: provider.name,
                model,
            },
        ];
    }
}
export function createLlmRuntime(options = {}) {
    return new LlmRuntime(options);
}
//# sourceMappingURL=llmRuntime.js.map