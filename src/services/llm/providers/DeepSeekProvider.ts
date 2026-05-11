import { getLlmProviderConfig } from '../llmConfig.js'
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

  readonly #adapter: OpenAiChatCompletionsAdapter

  constructor(options: DeepSeekProviderOptions = {}) {
    const config = getLlmProviderConfig('deepseek')
    const apiKey =
      options.apiKey?.trim() ||
      process.env.CCR_DEEPSEEK_API_KEY?.trim() ||
      process.env.DEEPSEEK_API_KEY?.trim()
    const baseUrl =
      options.baseUrl ||
      process.env.CCR_DEEPSEEK_BASE_URL?.trim() ||
      process.env.DEEPSEEK_BASE_URL?.trim() ||
      config?.baseUrl ||
      DEFAULT_BASE_URL
    const defaultModel =
      options.defaultModel?.trim() || config?.defaultModel || DEFAULT_MODEL
    const defaultReasoningEffort =
      options.defaultReasoningEffort ||
      normalizeReasoningEffort(config?.reasoningEffort) ||
      DEFAULT_REASONING_EFFORT
    const configuredThinking = options.thinking

    this.#adapter = new OpenAiChatCompletionsAdapter({
      providerId: this.name,
      providerLabel: 'DeepSeek',
      apiKey,
      baseUrl,
      defaultModel,
      defaultReasoningEffort,
      missingApiKeyMessage:
        'DeepSeek API key is missing. Set CCR_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.',
      fetchImpl: options.fetchImpl,
      resolveThinking: ({ model }) =>
        model.startsWith('deepseek-v4-')
          ? configuredThinking || 'enabled'
          : undefined,
    })
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return this.#adapter.generate(request)
  }

  stream(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent> {
    return this.#adapter.stream(request)
  }
}

function normalizeReasoningEffort(
  value: string | undefined,
): OpenAiChatReasoningEffort | undefined {
  return value === 'high' ? 'high' : undefined
}
