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
  return getFallbackModelCatalogEntry(input)
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
