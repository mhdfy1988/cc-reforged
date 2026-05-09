import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import { getAnthropicClient } from '../../api/client.js'
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js'
import type {
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmProvider,
} from '../types.js'

export interface AnthropicProviderClientOptions {
  apiKey?: string
  maxRetries: number
  model?: string
  fetchOverride?: ClientOptions['fetch']
  source?: string
}

export interface AnthropicMessageCreateOptions
  extends AnthropicProviderClientOptions {
  request: Parameters<Anthropic['beta']['messages']['create']>[0]
}

export interface AnthropicMessageStreamOptions
  extends AnthropicProviderClientOptions {
  request: Parameters<Anthropic['beta']['messages']['stream']>[0]
}

export interface AnthropicProviderDependencies {
  getClient?: typeof getAnthropicClient
}

interface AnthropicProviderTransitionMetadata {
  anthropicRequest?: Parameters<Anthropic['beta']['messages']['create']>[0]
  anthropicStreamRequest?: Parameters<Anthropic['beta']['messages']['stream']>[0]
  anthropicClientOptions?: Partial<AnthropicProviderClientOptions>
}

function getTransitionMetadata(
  request: LlmGenerateRequest,
): AnthropicProviderTransitionMetadata {
  const metadata = request.metadata
  if (!metadata) {
    return {}
  }
  return metadata as AnthropicProviderTransitionMetadata
}

function getClientOptionsForTransition(
  request: LlmGenerateRequest,
): AnthropicProviderClientOptions {
  const metadata = getTransitionMetadata(request)
  const clientOptions = metadata.anthropicClientOptions ?? {}
  return {
    apiKey: clientOptions.apiKey,
    maxRetries: clientOptions.maxRetries ?? 0,
    model: request.model,
    fetchOverride: clientOptions.fetchOverride,
    source: clientOptions.source,
  }
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic'
  readonly definition = getBuiltinLlmProviderDefinition(this.name)!
  readonly supportsStreaming = true
  readonly #getClient: typeof getAnthropicClient

  constructor(dependencies: AnthropicProviderDependencies = {}) {
    this.#getClient = dependencies.getClient ?? getAnthropicClient
  }

  async getClient(
    options: AnthropicProviderClientOptions,
  ): Promise<Anthropic> {
    return this.#getClient(options)
  }

  async createMessage(options: AnthropicMessageCreateOptions) {
    const { request, ...clientOptions } = options
    const anthropic = await this.getClient(clientOptions)
    return anthropic.beta.messages.create(request)
  }

  async streamMessage(options: AnthropicMessageStreamOptions) {
    const { request, ...clientOptions } = options
    const anthropic = await this.getClient(clientOptions)
    return anthropic.beta.messages.stream(request)
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const metadata = getTransitionMetadata(request)
    if (!metadata.anthropicRequest) {
      throw new Error(
        'AnthropicProvider.generate requires metadata.anthropicRequest during the transition phase.',
      )
    }
    const raw = await this.createMessage({
      ...getClientOptionsForTransition(request),
      request: metadata.anthropicRequest,
    })
    return {
      provider: this.name,
      model: request.model,
      output: [],
      stopReason: 'other',
      raw,
    }
  }

  async *stream(
    request: LlmGenerateRequest,
  ): AsyncIterable<LlmGenerateEvent> {
    const metadata = getTransitionMetadata(request)
    const anthropicRequest =
      metadata.anthropicStreamRequest ?? metadata.anthropicRequest
    if (!anthropicRequest) {
      throw new Error(
        'AnthropicProvider.stream requires metadata.anthropicStreamRequest during the transition phase.',
      )
    }
    const raw = await this.streamMessage({
      ...getClientOptionsForTransition(request),
      request: anthropicRequest,
    })
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
    }
  }
}

export function createAnthropicProvider(
  dependencies: AnthropicProviderDependencies = {},
): AnthropicProvider {
  return new AnthropicProvider(dependencies)
}
