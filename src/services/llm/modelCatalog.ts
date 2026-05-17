import { getModelMaxOutputTokens, getContextWindowForModel } from '../../utils/context.js'
import {
  getPublicModelDisplayName,
  renderModelName,
} from '../../utils/model/model.js'
import type {
  LlmInputModality,
  LlmModelCatalogEntry,
  LlmModelId,
  LlmProviderDefinition,
  LlmProviderId,
} from './types.js'

const TEXT_ONLY_MODALITIES: readonly LlmInputModality[] = ['text']
const TEXT_AND_IMAGE_MODALITIES: readonly LlmInputModality[] = ['text', 'image']

const CODEX_OAUTH_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'gpt-5.5': {
    displayName: 'GPT-5.5',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_AND_IMAGE_MODALITIES,
  },
  'gpt-5.4': {
    displayName: 'GPT-5.4',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
  },
  'gpt-5.4-mini': {
    displayName: 'GPT-5.4 Mini',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
  },
}

const DEEPSEEK_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'deepseek-v4-flash': {
    displayName: 'DeepSeek V4 Flash',
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
    metadata: {
      baseUrl: 'https://api.deepseek.com',
      thinkingDefault: 'enabled',
      protocol: 'openai-chat',
    },
  },
  'deepseek-v4-pro': {
    displayName: 'DeepSeek V4 Pro',
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
    metadata: {
      baseUrl: 'https://api.deepseek.com',
      thinkingDefault: 'enabled',
      protocol: 'openai-chat',
    },
  },
}

const MINIMAX_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'MiniMax-M2.7': {
    displayName: 'MiniMax M2.7',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
    metadata: {
      protocol: 'anthropic-compatible',
    },
  },
  'MiniMax-M2.7-highspeed': {
    displayName: 'MiniMax M2.7 Highspeed',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
    metadata: {
      protocol: 'anthropic-compatible',
    },
  },
}

export function getLlmModelCatalogEntry(input: {
  providerId: LlmProviderId
  model: LlmModelId
  providerDefinition: LlmProviderDefinition
}): LlmModelCatalogEntry {
  if (input.providerId === 'anthropic') {
    return getAnthropicModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'codex-oauth') {
    return getCodexOAuthModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'deepseek') {
    return getDeepSeekModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'minimax' || input.providerId === 'minimax-cn') {
    return getMiniMaxModelCatalogEntry(input)
  }
  return getFallbackModelCatalogEntry(input)
}

export function listKnownLlmModelCatalogEntries(input: {
  providerId: LlmProviderId
  defaultModel: LlmModelId
  providerDefinition: LlmProviderDefinition
}): readonly LlmModelCatalogEntry[] {
  if (input.providerId === 'codex-oauth') {
    return Object.keys(CODEX_OAUTH_MODEL_CATALOG).map(model =>
      getCodexOAuthModelCatalogEntry(model, input.providerDefinition),
    )
  }
  if (input.providerId === 'deepseek') {
    return Object.keys(DEEPSEEK_MODEL_CATALOG).map(model =>
      getDeepSeekModelCatalogEntry(model, input.providerDefinition),
    )
  }
  if (input.providerId === 'minimax' || input.providerId === 'minimax-cn') {
    return Object.keys(MINIMAX_MODEL_CATALOG).map(model =>
      getMiniMaxModelCatalogEntry({
        providerId: input.providerId,
        model,
        providerDefinition: input.providerDefinition,
      }),
    )
  }

  return [
    getLlmModelCatalogEntry({
      providerId: input.providerId,
      model: input.defaultModel,
      providerDefinition: input.providerDefinition,
    }),
  ]
}

function getAnthropicModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  const maxOutput = getModelMaxOutputTokens(model)
  return {
    provider: providerDefinition.id,
    model,
    displayName: getPublicModelDisplayName(model) ?? renderModelName(model),
    contextWindow: getContextWindowForModel(model),
    maxOutputTokens: maxOutput.upperLimit,
    supportsReasoning: providerDefinition.capabilities.reasoning,
    supportsTools: providerDefinition.capabilities.tools,
    inputModalities: TEXT_AND_IMAGE_MODALITIES,
    metadata: {
      defaultMaxOutputTokens: maxOutput.default,
    },
  }
}

function getCodexOAuthModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  const catalogEntry = CODEX_OAUTH_MODEL_CATALOG[model]
  if (catalogEntry) {
    return {
      provider: providerDefinition.id,
      model,
      ...catalogEntry,
    }
  }
  return {
    provider: providerDefinition.id,
    model,
    displayName: model,
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: providerDefinition.capabilities.reasoning,
    supportsTools: providerDefinition.capabilities.tools,
    inputModalities: TEXT_ONLY_MODALITIES,
  }
}

function getDeepSeekModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  const catalogEntry = DEEPSEEK_MODEL_CATALOG[model]
  if (catalogEntry) {
    return {
      provider: providerDefinition.id,
      model,
      ...catalogEntry,
    }
  }
  return {
    provider: providerDefinition.id,
    model,
    displayName: model,
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
    supportsReasoning: providerDefinition.capabilities.reasoning,
    supportsTools: providerDefinition.capabilities.tools,
    inputModalities: TEXT_ONLY_MODALITIES,
  }
}

function getMiniMaxModelCatalogEntry(input: {
  providerId: LlmProviderId
  model: LlmModelId
  providerDefinition: LlmProviderDefinition
}): LlmModelCatalogEntry {
  const catalogEntry = MINIMAX_MODEL_CATALOG[input.model]
  if (catalogEntry) {
    return {
      provider: input.providerDefinition.id,
      model: input.model,
      ...catalogEntry,
      metadata: {
        ...catalogEntry.metadata,
        baseUrl:
          input.providerId === 'minimax-cn'
            ? 'https://api.minimaxi.com/anthropic'
            : 'https://api.minimax.io/anthropic',
      },
    }
  }
  return {
    provider: input.providerDefinition.id,
    model: input.model,
    displayName: input.model,
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: input.providerDefinition.capabilities.reasoning,
    supportsTools: input.providerDefinition.capabilities.tools,
    inputModalities: TEXT_ONLY_MODALITIES,
  }
}

function getFallbackModelCatalogEntry(input: {
  providerId: LlmProviderId
  model: LlmModelId
  providerDefinition: LlmProviderDefinition
}): LlmModelCatalogEntry {
  return {
    provider: input.providerId,
    model: input.model,
    displayName: input.model,
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: input.providerDefinition.capabilities.reasoning,
    supportsTools: input.providerDefinition.capabilities.tools,
    inputModalities: TEXT_ONLY_MODALITIES,
  }
}
