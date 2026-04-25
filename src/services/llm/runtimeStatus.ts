import {
  getAnthropicApiKeyWithSource,
  getAuthTokenSource,
  isUsing3PServices,
} from '../../utils/auth.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import {
  getDefaultLlmRuntime,
} from './defaultRuntime.js'
import {
  getLlmProviderConfig,
  loadLlmConfig,
  type ResolvedLlmConfig,
} from './llmConfig.js'
import { getLlmModelCatalogEntry } from './modelCatalog.js'
import {
  createFallbackLlmProviderDefinition,
  getBuiltinLlmProviderDefinition,
  mergeLlmProviderDefinition,
} from './providerDefinitions.js'
import { getDefaultCodexOAuthSession } from './sessions/defaultCodexOAuthSession.js'
import type {
  LlmApiMode,
  LlmAuthStrategy,
  LlmModelCatalogEntry,
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

export function getLlmProviderDisplayName(
  providerId: string,
  config: ResolvedLlmConfig = loadLlmConfig(),
): string {
  return getResolvedLlmProviderDefinition(providerId, config).displayName
}

export function getLlmRuntimeDisplayStatus(
  config: ResolvedLlmConfig = loadLlmConfig(),
): LlmRuntimeDisplayStatus {
  const providerConfig = getLlmProviderConfig(config.provider, config)
  const providerDefinition = getResolvedLlmProviderDefinition(
    config.provider,
    config,
  )
  return {
    providerId: config.provider,
    providerDisplayName: providerDefinition.displayName,
    model: config.model,
    authStrategy: providerDefinition.authStrategy,
    apiMode: providerDefinition.apiMode,
    capabilities: providerDefinition.capabilities,
    modelCatalogEntry: getLlmModelCatalogEntry({
      providerId: config.provider,
      model: config.model,
      providerDefinition,
    }),
    ...(providerConfig?.baseUrl ? { baseUrl: providerConfig.baseUrl } : {}),
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
  const displayStatus = getLlmRuntimeDisplayStatus(config)
  if (displayStatus.providerId === 'codex-oauth') {
    return getCodexAuthStatusSync(config, displayStatus)
  }
  return getAnthropicAuthStatus(displayStatus)
}

export async function getLlmRuntimeAuthStatus(
  config: ResolvedLlmConfig = loadLlmConfig(),
): Promise<LlmRuntimeAuthStatus> {
  const displayStatus = getLlmRuntimeDisplayStatus(config)
  if (displayStatus.providerId !== 'codex-oauth') {
    return getAnthropicAuthStatus(displayStatus)
  }

  const availability = await getDefaultCodexOAuthSession().getAvailability()
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
  const snapshot = getCodexCredentialSnapshotSync(config)
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

  const credentialFilePath = getLlmProviderConfig(
    'codex-oauth',
    config,
  )?.credentialFilePath?.trim()

  if (!credentialFilePath) {
    return { present: false }
  }

  const fs = getFsImplementation()
  if (!fs.existsSync(credentialFilePath)) {
    return {
      present: false,
      source: credentialFilePath,
    }
  }

  try {
    const raw = fs.readFileSync(credentialFilePath, { encoding: 'utf8' })
    const parsed = JSON.parse(raw) as {
      access?: string
      accountId?: string
      expires?: number
    }
    if (typeof parsed.access !== 'string' || !parsed.access.trim()) {
      return {
        present: false,
        source: credentialFilePath,
      }
    }
    return {
      present: true,
      source: credentialFilePath,
      ...(typeof parsed.accountId === 'string'
        ? { accountId: parsed.accountId }
        : {}),
      ...(typeof parsed.expires === 'number'
        ? { expiresAt: parsed.expires }
        : {}),
    }
  } catch {
    return {
      present: false,
      source: credentialFilePath,
    }
  }
}

function hasCodexCredentialInEnv(): boolean {
  return Boolean(process.env.CLAUDE_CODE_CODEX_OAUTH_ACCESS_TOKEN?.trim())
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
