import {
  OpenAiResponsesHostedImageGenerationAdapter,
  toOpenAiResponsesImageGenerationRequestBody,
  normalizeOpenAiResponsesImageGenerationResponse,
  type OpenAiResponsesImageGenerationRawResponse,
  type OpenAiResponsesImageGenerationRequestBody,
  type OpenAiResponsesImageGenerationTool,
} from './openaiResponsesHostedImageGenerationAdapter.js'
import type {
  LlmImageGenerationRequest,
  LlmImageGenerationResponse,
} from '../types.js'

export {
  normalizeOpenAiResponsesImageGenerationResponse,
  toOpenAiResponsesImageGenerationRequestBody,
  type OpenAiResponsesImageGenerationRawResponse,
  type OpenAiResponsesImageGenerationRequestBody,
  type OpenAiResponsesImageGenerationTool,
}

export interface OpenAiResponsesImageGenerationAdapterOptions {
  providerId: string
  providerLabel: string
  apiKey?: string
  baseUrl: string
  defaultModel: string
  missingApiKeyMessage?: string
  fetchImpl?: typeof fetch
}

export class OpenAiResponsesImageGenerationAdapter {
  readonly #providerId: string
  readonly #providerLabel: string
  readonly #apiKey?: string
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #missingApiKeyMessage: string
  readonly #fetchImpl: typeof fetch

  constructor(options: OpenAiResponsesImageGenerationAdapterOptions) {
    this.#providerId = options.providerId
    this.#providerLabel = options.providerLabel
    this.#apiKey = options.apiKey?.trim()
    this.#baseUrl = options.baseUrl
    this.#defaultModel = options.defaultModel
    this.#missingApiKeyMessage =
      options.missingApiKeyMessage ??
      `${options.providerLabel} API key is missing.`
    this.#fetchImpl = options.fetchImpl || fetch
  }

  async generateImage(
    request: LlmImageGenerationRequest,
  ): Promise<LlmImageGenerationResponse> {
    const apiKey = this.#apiKey?.trim()
    if (!apiKey) {
      throw new Error(this.#missingApiKeyMessage)
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
    }).generateImage(request)
  }
}
