import {
  LlmProviderRegistry,
  type RegisterLlmProviderOptions,
} from './providerRegistry.js'
import type {
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmModelId,
  LlmProvider,
  LlmProviderDefinition,
  LlmProviderId,
} from './types.js'

export interface LlmRuntimeOptions {
  registry?: LlmProviderRegistry
  defaultProvider?: LlmProviderId
  defaultModel?: LlmModelId
}

export interface LlmRuntimeGenerateRequest
  extends Omit<LlmGenerateRequest, 'provider' | 'model'> {
  provider?: LlmProviderId
  model?: LlmModelId
}

function resolveRequiredProviderName(
  requestedProvider: LlmProviderId | undefined,
  defaultProvider: LlmProviderId | undefined,
): LlmProviderId {
  const providerName = requestedProvider ?? defaultProvider
  if (!providerName) {
    throw new Error('No LLM provider configured for this request.')
  }
  return providerName
}

function resolveRequiredModel(
  requestedModel: LlmModelId | undefined,
  defaultModel: LlmModelId | undefined,
): LlmModelId {
  const model = requestedModel ?? defaultModel
  if (!model) {
    throw new Error('No LLM model configured for this request.')
  }
  return model
}

export class LlmRuntime {
  readonly #registry: LlmProviderRegistry
  readonly #defaultProvider?: LlmProviderId
  readonly #defaultModel?: LlmModelId

  constructor(options: LlmRuntimeOptions = {}) {
    this.#registry = options.registry ?? new LlmProviderRegistry()
    this.#defaultProvider = options.defaultProvider
    this.#defaultModel = options.defaultModel
  }

  registerProvider(
    provider: LlmProvider,
    options: RegisterLlmProviderOptions = {},
  ): this {
    this.#registry.register(provider, options)
    return this
  }

  listProviders(): readonly LlmProvider[] {
    return this.#registry.list()
  }

  listProviderDefinitions(): readonly LlmProviderDefinition[] {
    return this.#registry.listDefinitions()
  }

  getProvider(providerName: LlmProviderId): LlmProvider {
    return this.#registry.getRequired(providerName)
  }

  getProviderDefinition(providerName: LlmProviderId): LlmProviderDefinition {
    const definition = this.#registry.getDefinition(providerName)
    if (!definition) {
      throw new Error(`Unknown LLM provider definition: ${providerName}`)
    }
    return definition
  }

  resolveRequest(
    request: LlmRuntimeGenerateRequest,
  ): [LlmProvider, LlmGenerateRequest] {
    const providerName = resolveRequiredProviderName(
      request.provider,
      this.#defaultProvider,
    )
    const provider = this.#registry.getRequired(providerName)
    const model = resolveRequiredModel(request.model, this.#defaultModel)
    return [
      provider,
      {
        ...request,
        provider: provider.name,
        model,
      },
    ]
  }

  async generate(
    request: LlmRuntimeGenerateRequest,
  ): Promise<LlmGenerateResponse> {
    const [provider, normalizedRequest] = this.resolveRequest(request)
    return provider.generate(normalizedRequest)
  }

  async *stream(
    request: LlmRuntimeGenerateRequest,
  ): AsyncIterable<LlmGenerateEvent> {
    const [provider, normalizedRequest] = this.resolveRequest(request)
    const startEvent: LlmGenerateEvent = {
      type: 'response_start',
      provider: provider.name,
      model: normalizedRequest.model,
    }
    yield startEvent

    if (typeof provider.stream === 'function') {
      try {
        yield* provider.stream(normalizedRequest)
        return
      } catch (error) {
        yield {
          type: 'response_error',
          provider: provider.name,
          model: normalizedRequest.model,
          error,
        }
        throw error
      }
    }

    try {
      const response = await provider.generate(normalizedRequest)
      for (const part of response.output) {
        yield {
          type: 'content_part',
          provider: provider.name,
          model: response.model,
          part,
        }
      }
      yield {
        type: 'response_complete',
        provider: provider.name,
        model: response.model,
        response,
      }
    } catch (error) {
      yield {
        type: 'response_error',
        provider: provider.name,
        model: normalizedRequest.model,
        error,
      }
      throw error
    }
  }
}

export function createLlmRuntime(options: LlmRuntimeOptions = {}): LlmRuntime {
  return new LlmRuntime(options)
}
