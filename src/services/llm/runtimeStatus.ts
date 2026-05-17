import {
  getAnthropicApiKeyWithSource,
  getAuthTokenSource,
  isUsing3PServices,
} from '../../utils/auth.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import {
  getDefaultLlmRuntime,
} from './defaultRuntime.js'
import {
  getLlmProfileOAuthCredential,
  getLlmProviderApiKey,
} from './providerCredentials.js'
import {
  getLlmProfileForProvider,
  getLlmProviderConfig,
  loadLlmConfig,
  type ResolvedLlmConfig,
} from './llmConfig.js'
import { getLlmModelCatalogEntry } from './modelCatalog.js'
import { resolveLlmModelCapabilities } from './modelCapabilities.js'
import {
  createFallbackLlmProviderDefinition,
  getBuiltinLlmProviderDefinition,
  mergeLlmProviderDefinition,
} from './providerDefinitions.js'
import { createDefaultCodexOAuthSession } from './sessions/defaultCodexOAuthSession.js'
import type {
  LlmApiMode,
  LlmAuthStrategy,
  LlmModelCatalogEntry,
  LlmModelCapabilities,
  LlmProviderCapabilities,
  LlmProviderDefinition,
} from './types.js'

export interface LlmRuntimeDisplayStatus {
  providerId: string
  providerDisplayName: string
  model: string
  authStrategy: LlmAuthStrategy
  apiMode: LlmApiMode
  capabilities: Readonly<LlmProviderCapabilities>
  modelCatalogEntry: LlmModelCatalogEntry
  modelCapabilities: LlmModelCapabilities
  profileId?: string
  baseUrl?: string
  configPath: string
  configSource: ResolvedLlmConfig['source']
}

export type LlmRuntimeAuthState = 'available' | 'configured' | 'missing'

export interface LlmRuntimeAuthStatus {
  state: LlmRuntimeAuthState
  configured: boolean
  available: boolean
  message: string
  source?: string
  accountId?: string
  expiresAt?: number
  baseUrl?: string
}

interface CodexCredentialSnapshot {
  present: boolean
  source?: string
  accountId?: string
  expiresAt?: number
}

const API_KEY_PROVIDER_ENV_NAMES: Record<string, readonly string[]> = {
  deepseek: ['CCR_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY'],
  minimax: ['CCR_MINIMAX_API_KEY', 'MINIMAX_API_KEY'],
  'minimax-cn': [
    'CCR_MINIMAX_CN_API_KEY',
    'MINIMAX_CN_API_KEY',
    'CCR_MINIMAXI_API_KEY',
    'MINIMAXI_API_KEY',
  ],
}

export function getLlmProviderDisplayName(
  providerId: string,
  config: ResolvedLlmConfig = loadLlmConfig(),
): string {
  return getResolvedLlmProviderDefinition(providerId, config).displayName
}

export function getLlmRuntimeDisplayStatus(
  config: ResolvedLlmConfig = loadLlmConfig(),
): LlmRuntimeDisplayStatus {
  return getLlmRuntimeDisplayStatusForProvider(
    {
      provider: config.provider,
      model: config.model,
    },
    config,
  )
}

export function getLlmRuntimeDisplayStatusForProvider(
  input: {
    profileId?: string
    provider: string
    model?: string
  },
  config: ResolvedLlmConfig = loadLlmConfig(),
): LlmRuntimeDisplayStatus {
  const provider = input.provider.trim()
  const selectedProfile = input.profileId
    ? config.profiles[input.profileId.trim()]
    : undefined
  const providerConfig = getLlmProviderConfig(provider, config)
  const profile =
    selectedProfile?.providerType === provider
      ? selectedProfile
      : getLlmProfileForProvider(provider, config)
  const model =
    input.model?.trim() ||
    (!input.profileId && provider === config.provider ? config.model : undefined) ||
    profile?.defaultModel ||
    config.providers[provider]?.defaultModel ||
    config.model
  const providerDefinition = getResolvedLlmProviderDefinition(
    provider,
    config,
  )
  const modelCatalogEntry = getLlmModelCatalogEntry({
    providerId: provider,
    model,
    providerDefinition,
  })
  const apiMode = profile?.apiMode ?? providerDefinition.apiMode
  const authStrategy = profile?.authStrategy ?? providerDefinition.authStrategy
  return {
    providerId: provider,
    providerDisplayName: providerDefinition.displayName,
    model,
    authStrategy,
    apiMode,
    capabilities: providerDefinition.capabilities,
    modelCatalogEntry,
    modelCapabilities: resolveLlmModelCapabilities({
      providerId: provider,
      apiMode,
      model,
      providerCapabilities: providerDefinition.capabilities,
      catalogEntry: modelCatalogEntry,
      ...(profile ? { profile } : {}),
    }),
    ...(profile ? { profileId: profile.id } : {}),
    ...(profile?.baseUrl ?? providerConfig?.baseUrl
      ? { baseUrl: profile?.baseUrl ?? providerConfig?.baseUrl }
      : {}),
    configPath: config.path,
    configSource: config.source,
  }
}

export function getResolvedLlmProviderDefinition(
  providerId: string,
  config: ResolvedLlmConfig = loadLlmConfig(),
): LlmProviderDefinition {
  const providerConfig = getLlmProviderConfig(providerId, config)
  const builtinDefinition =
    getBuiltinLlmProviderDefinition(providerId) ??
    createFallbackLlmProviderDefinition(providerId)
  let runtimeDefinition = builtinDefinition

  try {
    runtimeDefinition = getDefaultLlmRuntime().getProviderDefinition(providerId)
  } catch {
    runtimeDefinition = builtinDefinition
  }

  return mergeLlmProviderDefinition(runtimeDefinition, {
    ...(providerConfig?.displayName?.trim()
      ? { displayName: providerConfig.displayName.trim() }
      : {}),
    ...(providerConfig?.authStrategy
      ? { authStrategy: providerConfig.authStrategy }
      : {}),
    ...(providerConfig?.apiMode ? { apiMode: providerConfig.apiMode } : {}),
    capabilities: {
      ...(providerConfig?.supportsStreaming !== undefined
        ? { streaming: providerConfig.supportsStreaming }
        : {}),
      ...(providerConfig?.supportsTools !== undefined
        ? { tools: providerConfig.supportsTools }
        : {}),
      ...(providerConfig?.supportsReasoning !== undefined
        ? { reasoning: providerConfig.supportsReasoning }
        : {}),
      ...(providerConfig?.supportsUsage !== undefined
        ? { usage: providerConfig.supportsUsage }
        : {}),
    },
  })
}

export function getLlmRuntimeAuthStatusSync(
  config: ResolvedLlmConfig = loadLlmConfig(),
): LlmRuntimeAuthStatus {
  return getLlmRuntimeAuthStatusSyncForProvider(
    {
      provider: config.provider,
      model: config.model,
    },
    config,
  )
}

export function getLlmRuntimeAuthStatusSyncForProvider(
  input: {
    profileId?: string
    provider: string
    model?: string
  },
  config: ResolvedLlmConfig = loadLlmConfig(),
): LlmRuntimeAuthStatus {
  const displayStatus = getLlmRuntimeDisplayStatusForProvider(input, config)
  if (displayStatus.providerId === 'codex-oauth') {
    return getCodexAuthStatusSync(config, displayStatus)
  }
  const apiKeyEnvNames = getApiKeyEnvNames(displayStatus.providerId)
  if (apiKeyEnvNames) {
    return getApiKeyAuthStatus(displayStatus, apiKeyEnvNames)
  }
  return getAnthropicAuthStatus(displayStatus)
}

export async function getLlmRuntimeAuthStatus(
  config: ResolvedLlmConfig = loadLlmConfig(),
): Promise<LlmRuntimeAuthStatus> {
  return getLlmRuntimeAuthStatusForProvider(
    {
      provider: config.provider,
      model: config.model,
    },
    config,
  )
}

export async function getLlmRuntimeAuthStatusForProvider(
  input: {
    profileId?: string
    provider: string
    model?: string
  },
  config: ResolvedLlmConfig = loadLlmConfig(),
): Promise<LlmRuntimeAuthStatus> {
  const displayStatus = getLlmRuntimeDisplayStatusForProvider(input, config)
  const apiKeyEnvNames = getApiKeyEnvNames(displayStatus.providerId)
  if (apiKeyEnvNames) {
    return getApiKeyAuthStatus(displayStatus, apiKeyEnvNames)
  }
  if (displayStatus.providerId !== 'codex-oauth') {
    return getAnthropicAuthStatus(displayStatus)
  }

  const availability = await createDefaultCodexOAuthSession({
    ...(displayStatus.profileId ? { profileId: displayStatus.profileId } : {}),
  }).getAvailability()
  if (availability.available) {
    return {
      state: 'available',
      configured: true,
      available: true,
      message: 'Codex OAuth credential is available.',
      source: availability.details?.source,
      accountId: availability.details?.accountId,
      expiresAt: availability.details?.expiresAt,
      baseUrl: availability.details?.baseUrl ?? displayStatus.baseUrl,
    }
  }

  if (availability.configured) {
    return {
      state: 'configured',
      configured: true,
      available: false,
      message:
        'Codex OAuth credential exists but is not currently usable. Re-login may be required.',
      source: availability.details?.source,
      accountId: availability.details?.accountId,
      expiresAt: availability.details?.expiresAt,
      baseUrl: availability.details?.baseUrl ?? displayStatus.baseUrl,
    }
  }

  return {
    state: 'missing',
    configured: false,
    available: false,
    message: 'No Codex OAuth credential detected.',
    source: availability.details?.source,
    baseUrl: availability.details?.baseUrl ?? displayStatus.baseUrl,
  }
}

function getCodexAuthStatusSync(
  config: ResolvedLlmConfig,
  displayStatus: LlmRuntimeDisplayStatus,
): LlmRuntimeAuthStatus {
  const snapshot = getCodexCredentialSnapshotSync(config, displayStatus)
  if (!snapshot.present) {
    return {
      state: 'missing',
      configured: false,
      available: false,
      message: 'No Codex OAuth credential detected.',
      source: snapshot.source,
      baseUrl: displayStatus.baseUrl,
    }
  }

  if (snapshot.expiresAt && snapshot.expiresAt <= Date.now()) {
    return {
      state: 'configured',
      configured: true,
      available: false,
      message:
        'Codex OAuth credential exists but the current access token appears to be expired.',
      source: snapshot.source,
      accountId: snapshot.accountId,
      expiresAt: snapshot.expiresAt,
      baseUrl: displayStatus.baseUrl,
    }
  }

  return {
    state: 'available',
    configured: true,
    available: true,
    message: 'Codex OAuth credential is configured.',
    source: snapshot.source,
    accountId: snapshot.accountId,
    expiresAt: snapshot.expiresAt,
    baseUrl: displayStatus.baseUrl,
  }
}

function getCodexCredentialSnapshotSync(
  config: ResolvedLlmConfig,
  displayStatus: LlmRuntimeDisplayStatus,
): CodexCredentialSnapshot {
  if (hasCodexCredentialInEnv()) {
    const expiresAt = Number.parseInt(
      process.env.CLAUDE_CODE_CODEX_OAUTH_EXPIRES_AT ?? '',
      10,
    )
    return {
      present: true,
      source: 'env',
      ...(process.env.CLAUDE_CODE_CODEX_OAUTH_ACCOUNT_ID?.trim()
        ? { accountId: process.env.CLAUDE_CODE_CODEX_OAUTH_ACCOUNT_ID.trim() }
        : {}),
      ...(Number.isFinite(expiresAt) ? { expiresAt } : {}),
    }
  }

  const profileId =
    displayStatus.profileId ||
    config.currentProfileId ||
    getLlmProfileForProvider('codex-oauth', config)?.id
  const stored = getLlmProfileOAuthCredential(profileId)
  if (!stored.credential?.access?.trim()) {
    return {
      present: false,
      source: stored.source,
    }
  }
  return {
    present: true,
    source: stored.source,
    ...(stored.credential.accountId
      ? { accountId: stored.credential.accountId }
      : {}),
    ...(typeof stored.credential.expires === 'number'
      ? { expiresAt: stored.credential.expires }
      : {}),
  }
}

function hasCodexCredentialInEnv(): boolean {
  return Boolean(process.env.CLAUDE_CODE_CODEX_OAUTH_ACCESS_TOKEN?.trim())
}

function getApiKeyEnvNames(providerId: string): readonly string[] | undefined {
  return API_KEY_PROVIDER_ENV_NAMES[providerId]
}

function getApiKeyAuthStatus(
  displayStatus: LlmRuntimeDisplayStatus,
  envNames: readonly string[],
): LlmRuntimeAuthStatus {
  const credential = getLlmProviderApiKey({
    provider: displayStatus.providerId,
    profileId: displayStatus.profileId,
    envNames,
  })
  if (credential.apiKey) {
    return {
      state: 'available',
      configured: true,
      available: true,
      message: `${displayStatus.providerDisplayName} API key is available.`,
      source: credential.source,
      baseUrl: displayStatus.baseUrl,
    }
  }

  return {
    state: 'missing',
    configured: false,
    available: false,
    message: `${displayStatus.providerDisplayName} API key is missing.`,
    source: credential.source,
    baseUrl: displayStatus.baseUrl,
  }
}

function getAnthropicAuthStatus(
  displayStatus: LlmRuntimeDisplayStatus,
): LlmRuntimeAuthStatus {
  const { source: authTokenSource, hasToken } = getAuthTokenSource()
  const { source: apiKeySource } = getAnthropicApiKeyWithSource()
  const using3P = isUsing3PServices()
  if (using3P) {
    return {
      state: 'available',
      configured: true,
      available: true,
      message: 'External provider credentials are active.',
      source: getAPIProvider(),
      baseUrl: displayStatus.baseUrl,
    }
  }
  if (hasToken && authTokenSource !== 'none') {
    return {
      state: 'available',
      configured: true,
      available: true,
      message: 'Anthropic OAuth credential is available.',
      source: authTokenSource,
      baseUrl: displayStatus.baseUrl,
    }
  }
  const profileApiKey = getLlmProviderApiKey({
    provider: displayStatus.providerId,
    profileId: displayStatus.profileId,
    envNames: ['ANTHROPIC_API_KEY'],
  })
  if (profileApiKey.apiKey) {
    return {
      state: 'available',
      configured: true,
      available: true,
      message: 'Anthropic API key is available.',
      source: profileApiKey.source,
      baseUrl: displayStatus.baseUrl,
    }
  }
  const envApiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (apiKeySource !== 'none' || envApiKey) {
    return {
      state: 'available',
      configured: true,
      available: true,
      message: 'Anthropic API key is available.',
      source: apiKeySource !== 'none' ? apiKeySource : 'ANTHROPIC_API_KEY',
      baseUrl: displayStatus.baseUrl,
    }
  }
  return {
    state: 'missing',
    configured: false,
    available: false,
    message: 'No Anthropic credential detected.',
    baseUrl: displayStatus.baseUrl,
  }
}
