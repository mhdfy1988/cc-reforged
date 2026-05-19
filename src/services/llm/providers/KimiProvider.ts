import {
  OpenAiChatCompatibleProvider,
  type OpenAiChatCompatibleProviderOptions,
  type OpenAiChatCompatibleProviderSpec,
} from './OpenAiChatCompatibleProvider.js'
import {
  getLlmProfileForProvider,
  getLlmProviderConfig,
  loadLlmConfig,
  type ResolvedLlmConfig,
} from '../llmConfig.js'
import { getLlmProviderApiKey } from '../providerCredentials.js'
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js'
import {
  AnthropicMessagesAdapter,
} from '../protocols/anthropicMessagesAdapter.js'
import type {
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmProvider,
} from '../types.js'

const KIMI_API_SPEC: OpenAiChatCompatibleProviderSpec = {
  providerId: 'kimi-api',
  providerLabel: 'Kimi API',
  defaultBaseUrl: 'https://api.moonshot.cn/v1',
  defaultModel: 'kimi-k2.6',
  apiKeyEnvNames: ['CCR_KIMI_API_KEY', 'KIMI_API_KEY', 'MOONSHOT_API_KEY'],
  baseUrlEnvNames: [
    'CCR_KIMI_API_BASE_URL',
    'KIMI_API_BASE_URL',
    'MOONSHOT_BASE_URL',
  ],
  resolveTemperature: resolveKimiApiTemperature,
}

const KIMI_CODE_SPEC: OpenAiChatCompatibleProviderSpec = {
  providerId: 'kimi-code',
  providerLabel: 'Kimi Code',
  defaultBaseUrl: 'https://api.kimi.com/coding',
  defaultModel: 'kimi-for-coding',
  apiKeyEnvNames: ['CCR_KIMI_CODE_API_KEY', 'KIMI_CODE_API_KEY'],
  baseUrlEnvNames: ['CCR_KIMI_CODE_BASE_URL', 'KIMI_CODE_BASE_URL'],
  missingApiKeyMessage:
    'Kimi Code API key is missing. Set CCR_KIMI_CODE_API_KEY or KIMI_CODE_API_KEY. Kimi Code keys are issued from the Kimi Code console and are separate from Kimi Open Platform keys.',
}

export class KimiApiProvider extends OpenAiChatCompatibleProvider {
  constructor(options: OpenAiChatCompatibleProviderOptions = {}) {
    super(KIMI_API_SPEC, options)
  }
}

export class KimiCodeProvider implements LlmProvider {
  readonly name = KIMI_CODE_SPEC.providerId
  readonly definition = getBuiltinLlmProviderDefinition(this.name)!
  readonly supportsStreaming = true

  readonly #options: OpenAiChatCompatibleProviderOptions

  constructor(options: OpenAiChatCompatibleProviderOptions = {}) {
    this.#options = options
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return this.#createAdapter(request).generate(request)
  }

  stream(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent> {
    return this.#createAdapter(request).stream(request)
  }

  #createAdapter(request: LlmGenerateRequest): AnthropicMessagesAdapter {
    const connection = this.#resolveConnection(request)
    return new AnthropicMessagesAdapter({
      providerId: this.name,
      providerLabel: KIMI_CODE_SPEC.providerLabel,
      apiKey: connection.apiKey,
      baseUrl: normalizeKimiCodeAnthropicBaseUrl(connection.baseUrl),
      defaultModel: connection.defaultModel,
      missingApiKeyMessage: KIMI_CODE_SPEC.missingApiKeyMessage,
      fetchImpl: this.#options.fetchImpl,
    })
  }

  #resolveConnection(request: LlmGenerateRequest): {
    apiKey?: string
    baseUrl: string
    defaultModel: string
  } {
    const resolvedConfig = loadLlmConfig()
    const config = getLlmProviderConfig(this.name, resolvedConfig)
    const profile = getKimiCodeProfileForRequest(
      request.profileId,
      resolvedConfig,
    )
    const credential = getLlmProviderApiKey({
      provider: this.name,
      profileId: profile?.id,
      envNames: KIMI_CODE_SPEC.apiKeyEnvNames,
    })
    return {
      apiKey: this.#options.apiKey?.trim() || credential.apiKey,
      baseUrl:
        this.#options.baseUrl?.trim() ||
        getFirstEnvironmentValue(KIMI_CODE_SPEC.baseUrlEnvNames) ||
        profile?.baseUrl ||
        config?.baseUrl ||
        KIMI_CODE_SPEC.defaultBaseUrl,
      defaultModel:
        this.#options.defaultModel?.trim() ||
        profile?.defaultModel ||
        config?.defaultModel ||
        KIMI_CODE_SPEC.defaultModel,
    }
  }
}

function getKimiCodeProfileForRequest(
  profileId: string | undefined,
  config: ResolvedLlmConfig,
) {
  const normalizedProfileId = profileId?.trim()
  if (normalizedProfileId) {
    const profile = config.profiles[normalizedProfileId]
    return profile?.providerType === 'kimi-code' ? profile : undefined
  }
  return getLlmProfileForProvider('kimi-code', config)
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

function resolveKimiApiTemperature(input: {
  request: LlmGenerateRequest
  model: string
}): number | undefined {
  if (input.model.trim().toLowerCase() === 'kimi-k2.6') {
    return 1
  }
  return input.request.temperature
}

function normalizeKimiCodeAnthropicBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/u, '')
  if (normalized.endsWith('/coding/v1/chat/completions')) {
    return normalized.slice(0, -'/v1/chat/completions'.length)
  }
  if (normalized.endsWith('/coding/v1/messages')) {
    return normalized.slice(0, -'/v1/messages'.length)
  }
  if (normalized.endsWith('/coding/v1')) {
    return normalized.slice(0, -'/v1'.length)
  }
  if (normalized.endsWith('/coding')) {
    return normalized
  }
  return normalized
}
