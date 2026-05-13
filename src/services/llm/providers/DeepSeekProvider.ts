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
  type OpenAiChatReasoningEffort,
  type OpenAiChatThinkingType,
} from '../protocols/openaiChatCompletionsAdapter.js'
import type {
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmProvider,
} from '../types.js'

export interface DeepSeekProviderOptions {
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  defaultReasoningEffort?: OpenAiChatReasoningEffort
  thinking?: OpenAiChatThinkingType
  fetchImpl?: typeof fetch
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-v4-flash'
const DEFAULT_REASONING_EFFORT: OpenAiChatReasoningEffort = 'high'

export class DeepSeekProvider implements LlmProvider {
  readonly name = 'deepseek'
  readonly definition = getBuiltinLlmProviderDefinition(this.name)!
  readonly supportsStreaming = true

  readonly #options: DeepSeekProviderOptions

  constructor(options: DeepSeekProviderOptions = {}) {
    this.#options = options
  }

  #createAdapter(request: LlmGenerateRequest): OpenAiChatCompletionsAdapter {
    const resolvedConfig = loadLlmConfig()
    const config = getLlmProviderConfig('deepseek', resolvedConfig)
    const profile = getDeepSeekProfileForRequest(
      request.profileId,
      resolvedConfig,
    )
    const credential = getLlmProviderApiKey({
      provider: 'deepseek',
      profileId: profile?.id,
      envNames: ['CCR_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY'],
    })
    const apiKey =
      this.#options.apiKey?.trim() ||
      credential.apiKey
    const baseUrl =
      this.#options.baseUrl ||
      process.env.CCR_DEEPSEEK_BASE_URL?.trim() ||
      process.env.DEEPSEEK_BASE_URL?.trim() ||
      profile?.baseUrl ||
      config?.baseUrl ||
      DEFAULT_BASE_URL
    const defaultModel =
      this.#options.defaultModel?.trim() ||
      profile?.defaultModel ||
      config?.defaultModel ||
      DEFAULT_MODEL
    const defaultReasoningEffort =
      this.#options.defaultReasoningEffort ||
      normalizeReasoningEffort(config?.reasoningEffort) ||
      DEFAULT_REASONING_EFFORT
    const configuredThinking = this.#options.thinking

    return new OpenAiChatCompletionsAdapter({
      providerId: this.name,
      providerLabel: 'DeepSeek',
      apiKey,
      baseUrl,
      defaultModel,
      defaultReasoningEffort,
      missingApiKeyMessage:
        'DeepSeek API key is missing. Set CCR_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.',
      fetchImpl: this.#options.fetchImpl,
      resolveThinking: ({ model }) =>
        model.startsWith('deepseek-v4-')
          ? configuredThinking || 'enabled'
          : undefined,
    })
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return this.#createAdapter(request).generate(request)
  }

  stream(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent> {
    return this.#createAdapter(request).stream(request)
  }
}

function getDeepSeekProfileForRequest(
  profileId: string | undefined,
  config: ResolvedLlmConfig,
) {
  const normalizedProfileId = profileId?.trim()
  if (normalizedProfileId) {
    const profile = config.profiles[normalizedProfileId]
    return profile?.providerType === 'deepseek' ? profile : undefined
  }
  return getLlmProfileForProvider('deepseek', config)
}

function normalizeReasoningEffort(
  value: string | undefined,
): OpenAiChatReasoningEffort | undefined {
  return value === 'high' ? 'high' : undefined
}
