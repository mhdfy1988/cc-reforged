import { getDefaultLlmRuntime } from '../services/llm/defaultRuntime.js'
import {
  loadLlmConfig,
  type ResolvedLlmConfig,
  updatePersistedLlmConfig,
} from '../services/llm/llmConfig.js'
import { listKnownLlmModelCatalogEntries } from '../services/llm/modelCatalog.js'
import {
  getLlmRuntimeAuthStatusForProvider,
  getLlmRuntimeAuthStatusSyncForProvider,
  getLlmRuntimeDisplayStatusForProvider,
  getResolvedLlmProviderDefinition,
} from '../services/llm/runtimeStatus.js'
import type {
  LlmModelCatalogEntry,
  LlmProviderDefinition,
} from '../services/llm/types.js'
import { CoreError } from './errors.js'

type ModelAvailabilityState =
  | 'not_configured'
  | 'needs_auth'
  | 'configured'
  | 'auth_ready'
  | 'verified'
  | 'failed'

interface ResolvedModelSelection {
  config: ResolvedLlmConfig
  provider: string
  model: string
  providerDefinition: LlmProviderDefinition
  modelCatalogEntry: LlmModelCatalogEntry
}

export function listCoreModels(provider?: string): Record<string, unknown> {
  const config = loadLlmConfig()
  const runtime = getDefaultLlmRuntime()
  const providerDefinitions = runtime.listProviderDefinitions()

  const providers = providerDefinitions
    .filter(definition => !provider || definition.id === provider)
    .map(definition => {
      const providerConfig = config.providers[definition.id]
      const defaultModel =
        providerConfig?.defaultModel ??
        (definition.id === config.provider ? config.model : definition.id)
      return {
        id: definition.id,
        displayName: definition.displayName,
        authStrategy: definition.authStrategy,
        apiMode: definition.apiMode,
        capabilities: definition.capabilities,
        models: listKnownLlmModelCatalogEntries({
          providerId: definition.id,
          defaultModel,
          providerDefinition: getResolvedLlmProviderDefinition(
            definition.id,
            config,
          ),
        }),
      }
    })

  if (provider && providers.length === 0) {
    throw new CoreError('invalid_params', 'Unknown LLM provider.', {
      requestedProvider: provider,
    })
  }

  return {
    current: {
      provider: config.provider,
      model: config.model,
    },
    providers,
  }
}

export function getCoreModelAvailability(input: {
  provider?: string
  model?: string
} = {}): Record<string, unknown> {
  const selection = resolveCoreModelSelection(input)
  const displayStatus = getLlmRuntimeDisplayStatusForProvider(
    {
      provider: selection.provider,
      model: selection.model,
    },
    selection.config,
  )
  const authStatus = getLlmRuntimeAuthStatusSyncForProvider(
    {
      provider: selection.provider,
      model: selection.model,
    },
    selection.config,
  )
  const state = getLocalAvailabilityState(authStatus)
  return {
    provider: selection.provider,
    providerDisplayName: displayStatus.providerDisplayName,
    model: selection.model,
    state,
    configured: state !== 'not_configured',
    available: authStatus.available,
    testable: authStatus.available,
    networkChecked: false,
    checkedAt: new Date().toISOString(),
    auth: {
      state: authStatus.state,
      configured: authStatus.configured,
      available: authStatus.available,
      message: authStatus.message,
      ...(authStatus.source ? { source: authStatus.source } : {}),
    },
    apiMode: displayStatus.apiMode,
    authStrategy: displayStatus.authStrategy,
    capabilities: displayStatus.capabilities,
    modelCatalogEntry: selection.modelCatalogEntry,
    ...(displayStatus.baseUrl ? { baseUrl: displayStatus.baseUrl } : {}),
    configPath: displayStatus.configPath,
    configSource: displayStatus.configSource,
  }
}

export async function testCoreModelConnection(input: {
  provider?: string
  model?: string
  prompt?: string
} = {}): Promise<Record<string, unknown>> {
  const startedAt = Date.now()
  const selection = resolveCoreModelSelection(input)
  const displayStatus = getLlmRuntimeDisplayStatusForProvider(
    {
      provider: selection.provider,
      model: selection.model,
    },
    selection.config,
  )
  const authStatus = await getLlmRuntimeAuthStatusForProvider(
    {
      provider: selection.provider,
      model: selection.model,
    },
    selection.config,
  )
  const localAvailability = getCoreModelAvailability({
    provider: selection.provider,
    model: selection.model,
  })

  if (!authStatus.available) {
    return {
      ...localAvailability,
      state: getLocalAvailabilityState(authStatus),
      ok: false,
      networkChecked: false,
      latencyMs: Date.now() - startedAt,
      error: {
        kind: 'auth_required',
        message: authStatus.message,
      },
    }
  }

  if (displayStatus.apiMode === 'anthropic-messages') {
    return {
      ...localAvailability,
      state: 'configured' satisfies ModelAvailabilityState,
      ok: false,
      networkChecked: false,
      latencyMs: Date.now() - startedAt,
      error: {
        kind: 'unsupported_protocol',
        message:
          'Connection test for anthropic-messages is not wired through the LLM runtime yet.',
      },
    }
  }

  try {
    const runtime = getDefaultLlmRuntime()
    const response = await runtime.generate({
      provider: selection.provider,
      model: selection.model,
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'text',
              text:
                input.prompt?.trim() ||
                'Reply with exactly: CCR_CONNECTION_OK',
            },
          ],
        },
      ],
      maxOutputTokens: 32,
      temperature: 0,
      metadata: {
        connectionTest: true,
      },
    })
    const text = response.output
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('')
      .trim()
    return {
      ...localAvailability,
      state: 'verified' satisfies ModelAvailabilityState,
      ok: true,
      available: true,
      testable: true,
      networkChecked: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      response: {
        stopReason: response.stopReason,
        text: text.slice(0, 240),
        usage: response.usage,
      },
    }
  } catch (error) {
    return {
      ...localAvailability,
      state: 'failed' satisfies ModelAvailabilityState,
      ok: false,
      available: false,
      networkChecked: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      error: {
        kind: 'request_failed',
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export async function setCoreModel(input: {
  provider?: string
  model: string
}): Promise<Record<string, unknown>> {
  const currentConfig = loadLlmConfig()
  const requestedProvider = input.provider?.trim() || currentConfig.provider
  const requestedModel = input.model.trim()

  if (!requestedModel) {
    throw new CoreError('invalid_params', 'LLM model cannot be empty.')
  }

  if (process.env.CCR_LLM_MODEL?.trim()) {
    throw new CoreError(
      'invalid_params',
      'LLM model is currently forced by CCR_LLM_MODEL.',
      {
        env: 'CCR_LLM_MODEL',
      },
    )
  }

  if (
    requestedProvider !== currentConfig.provider &&
    process.env.CCR_LLM_PROVIDER?.trim()
  ) {
    throw new CoreError(
      'invalid_params',
      'LLM provider is currently forced by CCR_LLM_PROVIDER.',
      {
        env: 'CCR_LLM_PROVIDER',
      },
    )
  }

  const runtime = getDefaultLlmRuntime()
  const providerDefinitions = runtime.listProviderDefinitions()
  const providerDefinition = providerDefinitions.find(
    definition => definition.id === requestedProvider,
  )
  if (!providerDefinition) {
    throw new CoreError('invalid_params', 'Unknown LLM provider.', {
      requestedProvider,
    })
  }

  const models = listKnownLlmModelCatalogEntries({
    providerId: requestedProvider,
    defaultModel:
      currentConfig.providers[requestedProvider]?.defaultModel ??
      currentConfig.model,
    providerDefinition: getResolvedLlmProviderDefinition(
      requestedProvider,
      currentConfig,
    ),
  })
  if (!models.some(model => model.model === requestedModel)) {
    throw new CoreError('invalid_params', 'Unknown LLM model.', {
      provider: requestedProvider,
      requestedModel,
    })
  }

  const nextConfig = await updatePersistedLlmConfig({
    provider: requestedProvider,
    model: requestedModel,
  })

  return {
    current: {
      provider: nextConfig.provider,
      model: nextConfig.model,
    },
    provider: nextConfig.provider,
    model: nextConfig.model,
    configPath: nextConfig.path,
    configSource: nextConfig.source,
  }
}

function resolveCoreModelSelection(input: {
  provider?: string
  model?: string
}): ResolvedModelSelection {
  const config = loadLlmConfig()
  const requestedProvider = input.provider?.trim() || config.provider
  const runtime = getDefaultLlmRuntime()
  const providerDefinition = runtime
    .listProviderDefinitions()
    .find(definition => definition.id === requestedProvider)
  if (!providerDefinition) {
    throw new CoreError('invalid_params', 'Unknown LLM provider.', {
      requestedProvider,
    })
  }

  const requestedModel =
    input.model?.trim() ||
    (requestedProvider === config.provider
      ? config.model
      : config.providers[requestedProvider]?.defaultModel?.trim())

  if (!requestedModel) {
    throw new CoreError('invalid_params', 'LLM model cannot be empty.', {
      requestedProvider,
    })
  }

  const models = listKnownLlmModelCatalogEntries({
    providerId: requestedProvider,
    defaultModel:
      config.providers[requestedProvider]?.defaultModel ?? requestedModel,
    providerDefinition: getResolvedLlmProviderDefinition(
      requestedProvider,
      config,
    ),
  })
  const modelCatalogEntry = models.find(model => model.model === requestedModel)
  if (!modelCatalogEntry) {
    throw new CoreError('invalid_params', 'Unknown LLM model.', {
      provider: requestedProvider,
      requestedModel,
    })
  }

  return {
    config,
    provider: requestedProvider,
    model: requestedModel,
    providerDefinition,
    modelCatalogEntry,
  }
}

function getLocalAvailabilityState(input: {
  configured: boolean
  available: boolean
}): ModelAvailabilityState {
  if (input.available) {
    return 'auth_ready'
  }
  if (input.configured) {
    return 'configured'
  }
  return 'needs_auth'
}
