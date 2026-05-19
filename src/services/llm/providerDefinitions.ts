import type {
  LlmProvider,
  LlmProviderCapabilities,
  LlmProviderDefinition,
  LlmProviderId,
} from './types.js'

const DEFAULT_CAPABILITIES: LlmProviderCapabilities = {
  streaming: false,
  tools: false,
  reasoning: false,
  usage: false,
}

const BUILTIN_PROVIDER_DEFINITION_MAP: Record<string, LlmProviderDefinition> = {
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic',
    apiMode: 'anthropic-messages',
    authStrategy: 'hybrid',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    apiMode: 'openai-chat',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  'codex-oauth': {
    id: 'codex-oauth',
    displayName: 'Codex OAuth',
    apiMode: 'openai-responses',
    authStrategy: 'oauth_refreshable',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    apiMode: 'openai-chat',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  'kimi-api': {
    id: 'kimi-api',
    displayName: 'Kimi API',
    apiMode: 'openai-chat',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  'kimi-code': {
    id: 'kimi-code',
    displayName: 'Kimi Code',
    apiMode: 'anthropic-messages',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  'glm-api': {
    id: 'glm-api',
    displayName: 'GLM API',
    apiMode: 'openai-chat',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  'glm-coding': {
    id: 'glm-coding',
    displayName: 'GLM Coding Plan',
    apiMode: 'openai-chat',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  minimax: {
    id: 'minimax',
    displayName: 'MiniMax 国际版',
    apiMode: 'anthropic-messages',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
  'minimax-cn': {
    id: 'minimax-cn',
    displayName: 'MiniMax 国内版',
    apiMode: 'anthropic-messages',
    authStrategy: 'api_key',
    capabilities: {
      streaming: true,
      tools: true,
      reasoning: true,
      usage: true,
    },
  },
}

function normalizeCapabilities(
  input: Partial<LlmProviderCapabilities> | undefined,
): LlmProviderCapabilities {
  return {
    ...DEFAULT_CAPABILITIES,
    ...(input ?? {}),
  }
}

export function createLlmProviderDefinition(
  input: Omit<LlmProviderDefinition, 'capabilities'> & {
    capabilities?: Partial<LlmProviderCapabilities>
  },
): LlmProviderDefinition {
  return {
    ...input,
    id: input.id.trim(),
    displayName: input.displayName.trim(),
    authStrategy: input.authStrategy,
    capabilities: normalizeCapabilities(input.capabilities),
  }
}

export function mergeLlmProviderDefinition(
  base: LlmProviderDefinition,
  override: Partial<Omit<LlmProviderDefinition, 'capabilities'>> & {
    capabilities?: Partial<LlmProviderCapabilities>
  },
): LlmProviderDefinition {
  return createLlmProviderDefinition({
    ...base,
    ...override,
    capabilities: normalizeCapabilities({
      ...base.capabilities,
      ...(override.capabilities ?? {}),
    }),
  })
}

export function getBuiltinLlmProviderDefinition(
  providerId: LlmProviderId,
): LlmProviderDefinition | undefined {
  const definition = BUILTIN_PROVIDER_DEFINITION_MAP[providerId]
  if (!definition) {
    return undefined
  }
  return createLlmProviderDefinition(definition)
}

export function createFallbackLlmProviderDefinition(
  providerId: LlmProviderId,
  provider?: Pick<LlmProvider, 'stream' | 'supportsStreaming'>,
): LlmProviderDefinition {
  return createLlmProviderDefinition({
    id: providerId,
    displayName: providerId,
    apiMode: 'custom',
    authStrategy: 'unknown',
    capabilities: {
      streaming:
        typeof provider?.stream === 'function' ||
        provider?.supportsStreaming === true,
    },
  })
}

export function resolveLlmProviderDefinition(
  provider: LlmProvider,
): LlmProviderDefinition {
  const builtin =
    getBuiltinLlmProviderDefinition(provider.name) ??
    createFallbackLlmProviderDefinition(provider.name, provider)
  if (!provider.definition) {
    return builtin
  }
  return mergeLlmProviderDefinition(builtin, provider.definition)
}

export function listBuiltinLlmProviderDefinitions(): readonly LlmProviderDefinition[] {
  return Object.values(BUILTIN_PROVIDER_DEFINITION_MAP).map(definition =>
    createLlmProviderDefinition(definition),
  )
}
