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
  LlmProviderId,
} from '../types.js'

export type MiniMaxProviderId = 'minimax' | 'minimax-cn'

export interface MiniMaxProviderOptions {
  providerId?: MiniMaxProviderId
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  fetchImpl?: typeof fetch
}

interface MiniMaxProviderPreset {
  providerId: MiniMaxProviderId
  label: string
  baseUrl: string
  defaultModel: string
  envNames: readonly string[]
  baseUrlEnvNames: readonly string[]
}

const MINIMAX_PROVIDER_PRESETS: Record<MiniMaxProviderId, MiniMaxProviderPreset> = {
  minimax: {
    providerId: 'minimax',
    label: 'MiniMax 国际版',
    baseUrl: 'https://api.minimax.io/anthropic',
    defaultModel: 'MiniMax-M2.7',
    envNames: ['CCR_MINIMAX_API_KEY', 'MINIMAX_API_KEY'],
    baseUrlEnvNames: ['CCR_MINIMAX_BASE_URL', 'MINIMAX_BASE_URL'],
  },
  'minimax-cn': {
    providerId: 'minimax-cn',
    label: 'MiniMax 国内版',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2.7',
    envNames: [
      'CCR_MINIMAX_CN_API_KEY',
      'MINIMAX_CN_API_KEY',
      'CCR_MINIMAXI_API_KEY',
      'MINIMAXI_API_KEY',
    ],
    baseUrlEnvNames: [
      'CCR_MINIMAX_CN_BASE_URL',
      'MINIMAX_CN_BASE_URL',
      'CCR_MINIMAXI_BASE_URL',
      'MINIMAXI_BASE_URL',
    ],
  },
}

export class MiniMaxProvider implements LlmProvider {
  readonly name: LlmProviderId
  readonly definition
  readonly supportsStreaming = true

  readonly #options: MiniMaxProviderOptions
  readonly #preset: MiniMaxProviderPreset

  constructor(options: MiniMaxProviderOptions = {}) {
    this.#options = options
    this.#preset =
      MINIMAX_PROVIDER_PRESETS[options.providerId ?? 'minimax']
    this.name = this.#preset.providerId
    this.definition = getBuiltinLlmProviderDefinition(this.name)!
  }

  #createAdapter(request: LlmGenerateRequest): AnthropicMessagesAdapter {
    const resolvedConfig = loadLlmConfig()
    const config = getLlmProviderConfig(this.name, resolvedConfig)
    const profile = getMiniMaxProfileForRequest(
      this.name,
      request.profileId,
      resolvedConfig,
    )
    const credential = getLlmProviderApiKey({
      provider: this.name,
      profileId: profile?.id,
      envNames: this.#preset.envNames,
    })
    const apiKey =
      this.#options.apiKey?.trim() ||
      credential.apiKey
    const baseUrl =
      this.#options.baseUrl?.trim() ||
      getFirstEnvValue(this.#preset.baseUrlEnvNames) ||
      profile?.baseUrl ||
      config?.baseUrl ||
      this.#preset.baseUrl
    const defaultModel =
      this.#options.defaultModel?.trim() ||
      profile?.defaultModel ||
      config?.defaultModel ||
      this.#preset.defaultModel

    return new AnthropicMessagesAdapter({
      providerId: this.name,
      providerLabel: this.#preset.label,
      apiKey,
      baseUrl: normalizeMiniMaxAnthropicBaseUrl(
        baseUrl,
        this.#preset.providerId,
      ),
      defaultModel,
      missingApiKeyMessage:
        `${this.#preset.label} API key is missing. Set ${this.#preset.envNames.join(' or ')}.`,
      fetchImpl: this.#options.fetchImpl,
    })
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return this.#createAdapter(request).generate(request)
  }

  stream(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent> {
    return this.#createAdapter(request).stream(request)
  }
}

export class MiniMaxInternationalProvider extends MiniMaxProvider {
  constructor(options: Omit<MiniMaxProviderOptions, 'providerId'> = {}) {
    super({ ...options, providerId: 'minimax' })
  }
}

export class MiniMaxChinaProvider extends MiniMaxProvider {
  constructor(options: Omit<MiniMaxProviderOptions, 'providerId'> = {}) {
    super({ ...options, providerId: 'minimax-cn' })
  }
}

function getMiniMaxProfileForRequest(
  providerId: LlmProviderId,
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

function getFirstEnvValue(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }
  return undefined
}

function normalizeMiniMaxAnthropicBaseUrl(
  baseUrl: string,
  providerId: MiniMaxProviderId,
): string {
  const normalized = baseUrl.trim().replace(/\/+$/u, '')
  if (
    providerId === 'minimax' &&
    normalized === 'https://api.minimax.io/v1'
  ) {
    return 'https://api.minimax.io/anthropic'
  }
  if (
    providerId === 'minimax-cn' &&
    normalized === 'https://api.minimaxi.com/v1'
  ) {
    return 'https://api.minimaxi.com/anthropic'
  }
  return normalized
}
