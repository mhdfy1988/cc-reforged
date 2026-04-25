import Anthropic, {} from '@anthropic-ai/sdk';
import { getAnthropicClient } from '../../api/client.js';
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js';
function getTransitionMetadata(request) {
    const metadata = request.metadata;
    if (!metadata) {
        return {};
    }
    return metadata;
}
function getClientOptionsForTransition(request) {
    const metadata = getTransitionMetadata(request);
    const clientOptions = metadata.anthropicClientOptions ?? {};
    return {
        apiKey: clientOptions.apiKey,
        maxRetries: clientOptions.maxRetries ?? 0,
        model: request.model,
        fetchOverride: clientOptions.fetchOverride,
        source: clientOptions.source,
    };
}
export class AnthropicProvider {
    name = 'anthropic';
    definition = getBuiltinLlmProviderDefinition(this.name);
    supportsStreaming = true;
    #getClient;
    constructor(dependencies = {}) {
        this.#getClient = dependencies.getClient ?? getAnthropicClient;
    }
    async getClient(options) {
        return this.#getClient(options);
    }
    async createMessage(options) {
        const { request, ...clientOptions } = options;
        const anthropic = await this.getClient(clientOptions);
        return anthropic.beta.messages.create(request);
    }
    async streamMessage(options) {
        const { request, ...clientOptions } = options;
        const anthropic = await this.getClient(clientOptions);
        return anthropic.beta.messages.stream(request);
    }
    async generate(request) {
        const metadata = getTransitionMetadata(request);
        if (!metadata.anthropicRequest) {
            throw new Error('AnthropicProvider.generate requires metadata.anthropicRequest during the transition phase.');
        }
        const raw = await this.createMessage({
            ...getClientOptionsForTransition(request),
            request: metadata.anthropicRequest,
        });
        return {
            provider: this.name,
            model: request.model,
            output: [],
            stopReason: 'other',
            raw,
        };
    }
    async *stream(request) {
        const metadata = getTransitionMetadata(request);
        const anthropicRequest = metadata.anthropicStreamRequest ?? metadata.anthropicRequest;
        if (!anthropicRequest) {
            throw new Error('AnthropicProvider.stream requires metadata.anthropicStreamRequest during the transition phase.');
        }
        const raw = await this.streamMessage({
            ...getClientOptionsForTransition(request),
            request: anthropicRequest,
        });
        yield {
            type: 'response_complete',
            provider: this.name,
            model: request.model,
            response: {
                provider: this.name,
                model: request.model,
                output: [],
                stopReason: 'other',
                raw,
            },
        };
    }
}
export function createAnthropicProvider(dependencies = {}) {
    return new AnthropicProvider(dependencies);
}
//# sourceMappingURL=AnthropicProvider.js.map