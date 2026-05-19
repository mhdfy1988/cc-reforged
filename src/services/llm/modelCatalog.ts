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
const TEXT_IMAGE_VIDEO_MODALITIES: readonly LlmInputModality[] = [
  'text',
  'image',
  'video',
]

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

const OPENAI_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'gpt-5.4': {
    displayName: 'GPT-5.4',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_AND_IMAGE_MODALITIES,
    modelCapabilities: {
      inputModalities: TEXT_AND_IMAGE_MODALITIES,
      outputModalities: ['text'],
      tools: true,
      structuredOutput: true,
      source: 'builtin',
      reason: 'OpenAI Chat / Responses text model default.',
    },
  },
  'gpt-image-1': {
    displayName: 'GPT Image 1',
    contextWindow: 32_000,
    maxOutputTokens: 0,
    supportsReasoning: false,
    supportsTools: false,
    inputModalities: TEXT_ONLY_MODALITIES,
    modelCapabilities: {
      inputModalities: TEXT_ONLY_MODALITIES,
      outputModalities: ['image'],
      tools: false,
      structuredOutput: false,
      source: 'builtin',
      reason: 'OpenAI Images API model for generated image outputs.',
      image: {
        mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      },
    },
    metadata: {
      protocol: 'openai-images',
    },
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

const KIMI_API_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'kimi-k2.6': {
    displayName: 'Kimi K2.6',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_IMAGE_VIDEO_MODALITIES,
    metadata: {
      baseUrl: 'https://api.moonshot.cn/v1',
      platform: 'kimi-open-platform',
      protocol: 'openai-chat',
      ccrMultimodalAdapter: 'openai-chat-image-url-video-url',
    },
  },
}

const KIMI_CODE_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'kimi-for-coding': {
    displayName: 'Kimi Code 统一模型标识',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
    metadata: {
      baseUrl: 'https://api.kimi.com/coding',
      modelIdentifierKind: 'unified',
      platform: 'kimi-code',
      protocol: 'anthropic-messages',
    },
  },
}

const GLM_API_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'glm-5.1': {
    displayName: 'GLM 5.1',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
    metadata: {
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      platform: 'glm-open-platform',
      protocol: 'openai-chat',
    },
  },
  'glm-5v-turbo': {
    displayName: 'GLM-5V-Turbo',
    contextWindow: 200_000,
    maxOutputTokens: 128_000,
    supportsReasoning: false,
    supportsTools: true,
    inputModalities: TEXT_IMAGE_VIDEO_MODALITIES,
    metadata: {
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      platform: 'glm-open-platform',
      protocol: 'openai-chat',
      ccrMultimodalAdapter: 'openai-chat-image-url-video-url',
      officialFileInput: true,
      ccrFileInput: 'pending-provider-file-upload-or-url-only-policy',
    },
  },
  'glm-image': {
    displayName: 'GLM-Image',
    contextWindow: 32_000,
    maxOutputTokens: 0,
    supportsReasoning: false,
    supportsTools: false,
    inputModalities: TEXT_ONLY_MODALITIES,
    modelCapabilities: {
      inputModalities: TEXT_ONLY_MODALITIES,
      outputModalities: ['image'],
      tools: false,
      structuredOutput: false,
      source: 'builtin',
      reason: 'GLM API native image generation model.',
      image: {
        mimeTypes: ['image/png', 'image/jpeg'],
      },
    },
    metadata: {
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      platform: 'glm-open-platform',
      protocol: 'openai-images',
      endpoint: '/images/generations',
    },
  },
}

const GLM_CODING_MODEL_CATALOG: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>> = {
  'glm-5.1': {
    displayName: 'GLM 5.1',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsReasoning: true,
    supportsTools: true,
    inputModalities: TEXT_ONLY_MODALITIES,
    metadata: {
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
      platform: 'glm-coding-plan',
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
  'image-01': {
    displayName: 'MiniMax Image 01',
    contextWindow: 32_000,
    maxOutputTokens: 0,
    supportsReasoning: false,
    supportsTools: false,
    inputModalities: TEXT_ONLY_MODALITIES,
    modelCapabilities: {
      inputModalities: TEXT_ONLY_MODALITIES,
      outputModalities: ['image'],
      tools: false,
      structuredOutput: false,
      source: 'builtin',
      reason: 'MiniMax native image generation model.',
      image: {
        mimeTypes: ['image/png', 'image/jpeg'],
      },
    },
    metadata: {
      protocol: 'minimax-image-generation',
    },
  },
  'image-01-live': {
    displayName: 'MiniMax Image 01 Live',
    contextWindow: 32_000,
    maxOutputTokens: 0,
    supportsReasoning: false,
    supportsTools: false,
    inputModalities: TEXT_ONLY_MODALITIES,
    modelCapabilities: {
      inputModalities: TEXT_ONLY_MODALITIES,
      outputModalities: ['image'],
      tools: false,
      structuredOutput: false,
      source: 'builtin',
      reason: 'MiniMax native image generation live model.',
      image: {
        mimeTypes: ['image/png', 'image/jpeg'],
      },
    },
    metadata: {
      protocol: 'minimax-image-generation',
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
  if (input.providerId === 'openai') {
    return getOpenAiModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'deepseek') {
    return getDeepSeekModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'kimi-api') {
    return getKimiApiModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'kimi-code') {
    return getKimiCodeModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'glm-api') {
    return getGlmApiModelCatalogEntry(input.model, input.providerDefinition)
  }
  if (input.providerId === 'glm-coding') {
    return getGlmCodingModelCatalogEntry(input.model, input.providerDefinition)
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
  if (input.providerId === 'openai') {
    return Object.keys(OPENAI_MODEL_CATALOG).map(model =>
      getOpenAiModelCatalogEntry(model, input.providerDefinition),
    )
  }
  if (input.providerId === 'deepseek') {
    return Object.keys(DEEPSEEK_MODEL_CATALOG).map(model =>
      getDeepSeekModelCatalogEntry(model, input.providerDefinition),
    )
  }
  if (input.providerId === 'kimi-api') {
    return Object.keys(KIMI_API_MODEL_CATALOG).map(model =>
      getKimiApiModelCatalogEntry(model, input.providerDefinition),
    )
  }
  if (input.providerId === 'kimi-code') {
    return Object.keys(KIMI_CODE_MODEL_CATALOG).map(model =>
      getKimiCodeModelCatalogEntry(model, input.providerDefinition),
    )
  }
  if (input.providerId === 'glm-api') {
    return Object.keys(GLM_API_MODEL_CATALOG).map(model =>
      getGlmApiModelCatalogEntry(model, input.providerDefinition),
    )
  }
  if (input.providerId === 'glm-coding') {
    return Object.keys(GLM_CODING_MODEL_CATALOG).map(model =>
      getGlmCodingModelCatalogEntry(model, input.providerDefinition),
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

function getOpenAiModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  const catalogEntry = OPENAI_MODEL_CATALOG[model]
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
    inputModalities: TEXT_AND_IMAGE_MODALITIES,
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

function getKimiApiModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  return getOpenAiChatCompatibleCatalogEntry({
    model,
    providerDefinition,
    catalog: KIMI_API_MODEL_CATALOG,
    baseUrl: 'https://api.moonshot.cn/v1',
    platform: 'kimi-open-platform',
  })
}

function getKimiCodeModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  return getOpenAiChatCompatibleCatalogEntry({
    model,
    providerDefinition,
    catalog: KIMI_CODE_MODEL_CATALOG,
    baseUrl: 'https://api.kimi.com/coding',
    platform: 'kimi-code',
    modelIdentifierKind: 'unified',
  })
}

function getGlmApiModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  return getOpenAiChatCompatibleCatalogEntry({
    model,
    providerDefinition,
    catalog: GLM_API_MODEL_CATALOG,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    platform: 'glm-open-platform',
  })
}

function getGlmCodingModelCatalogEntry(
  model: LlmModelId,
  providerDefinition: LlmProviderDefinition,
): LlmModelCatalogEntry {
  return getOpenAiChatCompatibleCatalogEntry({
    model,
    providerDefinition,
    catalog: GLM_CODING_MODEL_CATALOG,
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    platform: 'glm-coding-plan',
  })
}

function getOpenAiChatCompatibleCatalogEntry(input: {
  model: LlmModelId
  providerDefinition: LlmProviderDefinition
  catalog: Record<string, Omit<LlmModelCatalogEntry, 'provider' | 'model'>>
  baseUrl: string
  platform: string
  modelIdentifierKind?: string
}): LlmModelCatalogEntry {
  const catalogEntry = input.catalog[input.model]
  if (catalogEntry) {
    return {
      provider: input.providerDefinition.id,
      model: input.model,
      ...catalogEntry,
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
    metadata: {
      baseUrl: input.baseUrl,
      platform: input.platform,
      protocol: 'openai-chat',
      ...(input.modelIdentifierKind
        ? { modelIdentifierKind: input.modelIdentifierKind }
        : {}),
    },
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
