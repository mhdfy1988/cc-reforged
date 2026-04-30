import { getDefaultLlmRuntime } from '../services/llm/defaultRuntime.js'
import { loadLlmConfig } from '../services/llm/llmConfig.js'
import { listKnownLlmModelCatalogEntries } from '../services/llm/modelCatalog.js'
import {
  getResolvedLlmProviderDefinition,
} from '../services/llm/runtimeStatus.js'
import { CoreError } from './errors.js'

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
