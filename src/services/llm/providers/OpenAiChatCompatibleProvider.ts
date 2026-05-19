import {
  getLlmProfileForProvider,
  getLlmProviderConfig,
  loadLlmConfig,
  type ResolvedLlmConfig,
} from '../llmConfig.js'
import { getLlmProviderApiKey } from '../providerCredentials.js'
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js'
import {
  OpenAiChatCompletionsAdapter,
  type OpenAiChatCompletionsAdapterOptions,
  type OpenAiChatReasoningEffort,
} from '../protocols/openaiChatCompletionsAdapter.js'
import type {
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmProvider,
  LlmProviderDefinition,
} from '../types.js'

export interface OpenAiChatCompatibleProviderSpec {
  providerId: string
  providerLabel: string
  defaultBaseUrl: string
  defaultModel: string
  apiKeyEnvNames: readonly string[]
  baseUrlEnvNames: readonly string[]
  defaultReasoningEffort?: OpenAiChatReasoningEffort
  includeTools?: boolean
  includeStreamUsage?: boolean
  mergeSystemMessages?: boolean
  outputTokenParam?: OpenAiChatCompletionsAdapterOptions['outputTokenParam']
  outputTokenLimit?: number
  missingApiKeyMessage?: string
  resolveTemperature?: OpenAiChatCompletionsAdapterOptions['resolveTemperature']
  resolveThinking?: OpenAiChatCompletionsAdapterOptions['resolveThinking']
}

export interface OpenAiChatCompatibleProviderOptions {
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  defaultReasoningEffort?: OpenAiChatReasoningEffort
  fetchImpl?: typeof fetch
}

export class OpenAiChatCompatibleProvider implements LlmProvider {
  readonly name: string
  readonly definition: LlmProviderDefinition
  readonly supportsStreaming = true

  readonly #spec: OpenAiChatCompatibleProviderSpec
  readonly #options: OpenAiChatCompatibleProviderOptions

  constructor(
    spec: OpenAiChatCompatibleProviderSpec,
    options: OpenAiChatCompatibleProviderOptions = {},
  ) {
    this.name = spec.providerId
    this.definition = getBuiltinLlmProviderDefinition(spec.providerId)!
    this.#spec = spec
    this.#options = options
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return this.#createAdapter(request).generate(request)
  }

  stream(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent> {
    return this.#createAdapter(request).stream(request)
  }

  #createAdapter(request: LlmGenerateRequest): OpenAiChatCompletionsAdapter {
    const resolvedConfig = loadLlmConfig()
    const config = getLlmProviderConfig(this.name, resolvedConfig)
    const profile = getProfileForRequest(
      this.name,
      request.profileId,
      resolvedConfig,
    )
    const credential = getLlmProviderApiKey({
      provider: this.name,
      profileId: profile?.id,
      envNames: this.#spec.apiKeyEnvNames,
    })
    const apiKey = this.#options.apiKey?.trim() || credential.apiKey
    const baseUrl =
      this.#options.baseUrl ||
      getFirstEnvironmentValue(this.#spec.baseUrlEnvNames) ||
      profile?.baseUrl ||
      config?.baseUrl ||
      this.#spec.defaultBaseUrl
    const defaultModel =
      this.#options.defaultModel?.trim() ||
      profile?.defaultModel ||
      config?.defaultModel ||
      this.#spec.defaultModel
    const defaultReasoningEffort =
      this.#options.defaultReasoningEffort ||
      normalizeReasoningEffort(config?.reasoningEffort) ||
      this.#spec.defaultReasoningEffort

    return new OpenAiChatCompletionsAdapter({
      providerId: this.name,
      providerLabel: this.#spec.providerLabel,
      apiKey,
      baseUrl,
      defaultModel,
      defaultReasoningEffort,
      outputTokenParam: this.#spec.outputTokenParam,
      outputTokenLimit: this.#spec.outputTokenLimit,
      includeTools: this.#spec.includeTools,
      includeStreamUsage: this.#spec.includeStreamUsage,
      mergeSystemMessages: this.#spec.mergeSystemMessages,
      missingApiKeyMessage:
        this.#spec.missingApiKeyMessage ??
        `${this.#spec.providerLabel} API key is missing. Set one of ${this.#spec.apiKeyEnvNames.join(', ')}.`,
      fetchImpl: this.#options.fetchImpl,
      resolveTemperature: this.#spec.resolveTemperature,
      resolveThinking: this.#spec.resolveThinking,
    })
  }
}

function getProfileForRequest(
  providerId: string,
  profileId: string | undefined,
  config: ResolvedLlmConfig,
) {
  const normalizedProfileId = profileId?.trim()
  if (normalizedProfileId) {
    const profile = config.profiles[normalizedProfileId]
    return profile?.providerType === providerId ? profile : undefined
  }
  return getLlmProfileForProvider(providerId, config)
}

function getFirstEnvironmentValue(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }
  return undefined
}

function normalizeReasoningEffort(
  value: string | undefined,
): OpenAiChatReasoningEffort | undefined {
  return value === 'high' ? 'high' : undefined
}
