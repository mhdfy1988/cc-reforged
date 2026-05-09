import { resolveLlmProviderDefinition } from './providerDefinitions.js'
import type {
  LlmProvider,
  LlmProviderDefinition,
  LlmProviderId,
} from './types.js'

export class DuplicateLlmProviderError extends Error {
  constructor(providerName: string) {
    super(`LLM provider already registered: ${providerName}`)
    this.name = 'DuplicateLlmProviderError'
  }
}

export class UnknownLlmProviderError extends Error {
  constructor(providerName: string) {
    super(`Unknown LLM provider: ${providerName}`)
    this.name = 'UnknownLlmProviderError'
  }
}

export interface RegisterLlmProviderOptions {
  replace?: boolean
}

function assertProviderName(name: string): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error('LLM provider name must be a non-empty string.')
  }
  return normalized
}

export class LlmProviderRegistry {
  readonly #providers = new Map<LlmProviderId, LlmProvider>()

  constructor(providers: readonly LlmProvider[] = []) {
    for (const provider of providers) {
      this.register(provider)
    }
  }

  register(
    provider: LlmProvider,
    options: RegisterLlmProviderOptions = {},
  ): this {
    const providerName = assertProviderName(provider.name)
    if (!options.replace && this.#providers.has(providerName)) {
      throw new DuplicateLlmProviderError(providerName)
    }
    this.#providers.set(providerName, provider)
    return this
  }

  has(providerName: LlmProviderId): boolean {
    return this.#providers.has(providerName)
  }

  get(providerName: LlmProviderId): LlmProvider | undefined {
    return this.#providers.get(providerName)
  }

  getDefinition(providerName: LlmProviderId): LlmProviderDefinition | undefined {
    const provider = this.get(providerName)
    return provider ? resolveLlmProviderDefinition(provider) : undefined
  }

  getRequired(providerName: LlmProviderId): LlmProvider {
    const provider = this.get(providerName)
    if (!provider) {
      throw new UnknownLlmProviderError(providerName)
    }
    return provider
  }

  list(): readonly LlmProvider[] {
    return Array.from(this.#providers.values())
  }

  listDefinitions(): readonly LlmProviderDefinition[] {
    return this.list().map(provider => resolveLlmProviderDefinition(provider))
  }
}

export function createLlmProviderRegistry(
  providers: readonly LlmProvider[] = [],
): LlmProviderRegistry {
  return new LlmProviderRegistry(providers)
}
