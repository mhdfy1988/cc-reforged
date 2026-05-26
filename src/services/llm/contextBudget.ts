import {
  getLlmProviderConfig,
  getLlmProfileForProvider,
  loadLlmConfig,
  type ResolvedLlmConfig,
} from './llmConfig.js'
import { getLlmModelCatalogEntry } from './modelCatalog.js'
import {
  createFallbackLlmProviderDefinition,
  getBuiltinLlmProviderDefinition,
  mergeLlmProviderDefinition,
} from './providerDefinitions.js'
import type { LlmModelId, LlmProviderId } from './types.js'

export const CONTEXT_BUDGET_SUMMARY_OUTPUT_RESERVE = 20_000
export const CONTEXT_BUDGET_AUTO_COMPACT_BUFFER = 13_000
export const CONTEXT_BUDGET_WARNING_BUFFER = 20_000
export const CONTEXT_BUDGET_ERROR_BUFFER = 20_000
export const CONTEXT_BUDGET_MANUAL_COMPACT_BUFFER = 3_000

export type ContextBudgetSource =
  | 'model_catalog'
  | 'model_catalog_env_capped'

export type RuntimeContextBudget = {
  providerId: string
  profileId?: string
  model: string
  totalContextWindow: number
  maxOutputTokens: number
  reservedOutputTokens: number
  effectiveInputWindow: number
  autoCompactThreshold: number
  warningThreshold: number
  errorThreshold: number
  blockingLimit: number
  source: ContextBudgetSource
}

export type RuntimeContextBudgetInput = {
  config?: ResolvedLlmConfig
  providerId?: string
  profileId?: string
  model?: string
  reservedOutputTokens?: number
  respectAutoCompactWindow?: boolean
}

export function resolveRuntimeContextBudget(
  input: RuntimeContextBudgetInput = {},
): RuntimeContextBudget {
  const config = input.config ?? loadLlmConfig()
  const providerId = input.providerId ?? config.provider
  const profile =
    (input.profileId ? config.profiles[input.profileId] : undefined) ??
    (config.currentProfileId ? config.profiles[config.currentProfileId] : undefined)
  const providerProfile =
    profile?.providerType === providerId
      ? profile
      : getLlmProfileForProvider(providerId, config)
  const model =
    input.model?.trim() ||
    (providerId === config.provider ? config.model : undefined) ||
    providerProfile?.defaultModel ||
    config.providers[providerId]?.defaultModel ||
    config.model
  const providerConfig = getLlmProviderConfig(providerId, config)
  const providerDefinition = mergeLlmProviderDefinition(
    getBuiltinLlmProviderDefinition(providerId) ??
      createFallbackLlmProviderDefinition(providerId),
    {
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
    },
  )
  const catalogEntry = getLlmModelCatalogEntry({
    providerId: providerId as LlmProviderId,
    model: model as LlmModelId,
    providerDefinition,
  })
  if (catalogEntry.contextWindow <= 0) {
    throw new Error(
      `Missing context budget for provider='${providerId}', model='${model}'.`,
    )
  }
  const totalContextWindow = catalogEntry.contextWindow
  const maxOutputTokens = Math.max(0, catalogEntry.maxOutputTokens)
  const reservedOutputTokens =
    input.reservedOutputTokens ??
    Math.min(maxOutputTokens, CONTEXT_BUDGET_SUMMARY_OUTPUT_RESERVE)
  const cap = parseAutoCompactWindowCap()
  const shouldApplyCap = input.respectAutoCompactWindow !== false && cap !== undefined
  const budgetContextWindow = shouldApplyCap
    ? Math.min(totalContextWindow, cap)
    : totalContextWindow
  const effectiveInputWindow = Math.max(0, budgetContextWindow - reservedOutputTokens)
  const autoCompactThreshold = Math.max(
    0,
    effectiveInputWindow - CONTEXT_BUDGET_AUTO_COMPACT_BUFFER,
  )
  const warningThreshold = Math.max(
    0,
    autoCompactThreshold - CONTEXT_BUDGET_WARNING_BUFFER,
  )
  const errorThreshold = Math.max(
    0,
    autoCompactThreshold - CONTEXT_BUDGET_ERROR_BUFFER,
  )
  const blockingLimit = Math.max(
    0,
    effectiveInputWindow - CONTEXT_BUDGET_MANUAL_COMPACT_BUFFER,
  )
  const source: ContextBudgetSource = shouldApplyCap
    ? 'model_catalog_env_capped'
    : 'model_catalog'

  return {
    providerId,
    ...(providerProfile?.id ? { profileId: providerProfile.id } : {}),
    model,
    totalContextWindow,
    maxOutputTokens,
    reservedOutputTokens,
    effectiveInputWindow,
    autoCompactThreshold,
    warningThreshold,
    errorThreshold,
    blockingLimit,
    source,
  }
}

function parseAutoCompactWindowCap(): number | undefined {
  const value = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW
  if (!value) {
    return undefined
  }
  const parsed = parseInt(value, 10)
  return !isNaN(parsed) && parsed > 0 ? parsed : undefined
}
