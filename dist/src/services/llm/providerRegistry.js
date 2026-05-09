import { resolveLlmProviderDefinition } from './providerDefinitions.js';
export class DuplicateLlmProviderError extends Error {
    constructor(providerName) {
        super(`LLM provider already registered: ${providerName}`);
        this.name = 'DuplicateLlmProviderError';
    }
}
export class UnknownLlmProviderError extends Error {
    constructor(providerName) {
        super(`Unknown LLM provider: ${providerName}`);
        this.name = 'UnknownLlmProviderError';
    }
}
function assertProviderName(name) {
    const normalized = name.trim();
    if (!normalized) {
        throw new Error('LLM provider name must be a non-empty string.');
    }
    return normalized;
}
export class LlmProviderRegistry {
    #providers = new Map();
    constructor(providers = []) {
        for (const provider of providers) {
            this.register(provider);
        }
    }
    register(provider, options = {}) {
        const providerName = assertProviderName(provider.name);
        if (!options.replace && this.#providers.has(providerName)) {
            throw new DuplicateLlmProviderError(providerName);
        }
        this.#providers.set(providerName, provider);
        return this;
    }
    has(providerName) {
        return this.#providers.has(providerName);
    }
    get(providerName) {
        return this.#providers.get(providerName);
    }
    getDefinition(providerName) {
        const provider = this.get(providerName);
        return provider ? resolveLlmProviderDefinition(provider) : undefined;
    }
    getRequired(providerName) {
        const provider = this.get(providerName);
        if (!provider) {
            throw new UnknownLlmProviderError(providerName);
        }
        return provider;
    }
    list() {
        return Array.from(this.#providers.values());
    }
    listDefinitions() {
        return this.list().map(provider => resolveLlmProviderDefinition(provider));
    }
}
export function createLlmProviderRegistry(providers = []) {
    return new LlmProviderRegistry(providers);
}
//# sourceMappingURL=providerRegistry.js.map