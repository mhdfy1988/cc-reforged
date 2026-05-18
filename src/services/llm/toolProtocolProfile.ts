import type {
  LlmApiMode,
  LlmProviderId,
  LlmProviderToolProfile,
} from './types.js'

const TODO_WRITE_TOOL_NAME = 'TodoWrite'
const CORE_TOOLS_ALWAYS_INLINE = [TODO_WRITE_TOOL_NAME] as const

type ToolProfileInput = {
  providerId: LlmProviderId
  apiMode: LlmApiMode
  model?: string
}

function createProviderToolProfile(
  input: Omit<LlmProviderToolProfile, 'toolCalling'> & {
    toolCalling: Omit<
      LlmProviderToolProfile['toolCalling'],
      'coreToolsAlwaysInline'
    > & {
      coreToolsAlwaysInline?: readonly string[]
    }
  },
): LlmProviderToolProfile {
  return {
    ...input,
    toolCalling: {
      ...input.toolCalling,
      coreToolsAlwaysInline:
        input.toolCalling.coreToolsAlwaysInline ?? CORE_TOOLS_ALWAYS_INLINE,
    },
  }
}

const OPENAI_CHAT_COMPATIBLE_TOOL_PROFILE = createProviderToolProfile({
  providerId: 'openai-chat-compatible',
  apiMode: 'openai-chat',
  source: 'api_mode_default',
  toolCalling: {
    supported: true,
    schemaStyle: 'json_schema_function',
    resultStyle: 'tool_role_with_tool_call_id',
    requiresCallId: true,
    supportsParallelCalls: 'unknown',
    supportsStrictSchema: 'unknown',
    supportsDeferredToolSearch: false,
  },
})

const BUILTIN_PROVIDER_TOOL_PROFILES: readonly LlmProviderToolProfile[] = [
  createProviderToolProfile({
    providerId: 'deepseek',
    apiMode: 'openai-chat',
    source: 'builtin',
    toolCalling: {
      supported: true,
      schemaStyle: 'json_schema_function',
      resultStyle: 'tool_role_with_tool_call_id',
      requiresCallId: true,
      supportsParallelCalls: 'unknown',
      supportsStrictSchema: 'beta',
      supportsDeferredToolSearch: false,
      strictSchemaLimits: {
        additionalPropertiesFalseRequired: true,
        allObjectPropertiesRequired: true,
        unsupportedKeywords: ['minLength', 'maxLength', 'minItems', 'maxItems'],
      },
    },
  }),
  createProviderToolProfile({
    providerId: 'codex-oauth',
    apiMode: 'openai-responses',
    source: 'builtin',
    toolCalling: {
      supported: true,
      schemaStyle: 'json_schema_function',
      resultStyle: 'function_call_output',
      requiresCallId: true,
      supportsParallelCalls: 'unknown',
      supportsStrictSchema: 'unknown',
      supportsDeferredToolSearch: 'unknown',
    },
  }),
  createProviderToolProfile({
    providerId: 'anthropic',
    apiMode: 'anthropic-messages',
    source: 'builtin',
    toolCalling: {
      supported: true,
      schemaStyle: 'anthropic_input_schema',
      resultStyle: 'anthropic_tool_result_block',
      requiresCallId: true,
      supportsParallelCalls: 'unknown',
      supportsStrictSchema: 'unknown',
      supportsDeferredToolSearch: true,
    },
  }),
  createProviderToolProfile({
    providerId: 'minimax',
    apiMode: 'anthropic-messages',
    source: 'builtin',
    toolCalling: {
      supported: true,
      schemaStyle: 'anthropic_input_schema',
      resultStyle: 'anthropic_tool_result_block',
      requiresCallId: true,
      supportsParallelCalls: 'unknown',
      supportsStrictSchema: 'unknown',
      supportsDeferredToolSearch: 'unknown',
    },
  }),
  createProviderToolProfile({
    providerId: 'minimax-cn',
    apiMode: 'anthropic-messages',
    source: 'builtin',
    toolCalling: {
      supported: true,
      schemaStyle: 'anthropic_input_schema',
      resultStyle: 'anthropic_tool_result_block',
      requiresCallId: true,
      supportsParallelCalls: 'unknown',
      supportsStrictSchema: 'unknown',
      supportsDeferredToolSearch: 'unknown',
    },
  }),
]

export function listBuiltinProviderToolProfiles(): readonly LlmProviderToolProfile[] {
  return BUILTIN_PROVIDER_TOOL_PROFILES.map(cloneProviderToolProfile)
}

export function resolveProviderToolProfile(
  input: ToolProfileInput,
): LlmProviderToolProfile {
  const providerId = input.providerId.trim()
  const model = input.model?.trim()
  const builtin = BUILTIN_PROVIDER_TOOL_PROFILES.find(profile => {
    if (profile.providerId !== providerId || profile.apiMode !== input.apiMode) {
      return false
    }
    return !profile.modelPattern || matchesModelPattern(model, profile.modelPattern)
  })
  if (builtin) {
    return cloneProviderToolProfile(builtin)
  }
  if (input.apiMode === 'openai-chat') {
    return cloneProviderToolProfile({
      ...OPENAI_CHAT_COMPATIBLE_TOOL_PROFILE,
      providerId,
    })
  }
  return createProviderToolProfile({
    providerId,
    apiMode: input.apiMode,
    source: 'disabled_default',
    toolCalling: {
      supported: false,
      schemaStyle: 'json_schema_function',
      resultStyle: 'tool_role_with_tool_call_id',
      requiresCallId: false,
      supportsParallelCalls: 'unknown',
      supportsStrictSchema: 'unknown',
      supportsDeferredToolSearch: false,
      coreToolsAlwaysInline: CORE_TOOLS_ALWAYS_INLINE,
    },
  })
}

export function providerSupportsDeferredToolSearch(
  profile: LlmProviderToolProfile,
): boolean {
  return profile.toolCalling.supportsDeferredToolSearch === true
}

export function shouldSendCoreToolInline(
  profile: LlmProviderToolProfile,
  toolName: string,
): boolean {
  return profile.toolCalling.coreToolsAlwaysInline.includes(toolName)
}

export function isOpenAiChatToolResultProfile(
  profile: LlmProviderToolProfile,
): boolean {
  return (
    profile.toolCalling.supported &&
    profile.toolCalling.resultStyle === 'tool_role_with_tool_call_id' &&
    profile.toolCalling.requiresCallId
  )
}

function cloneProviderToolProfile(
  profile: LlmProviderToolProfile,
): LlmProviderToolProfile {
  return {
    ...profile,
    toolCalling: {
      ...profile.toolCalling,
      coreToolsAlwaysInline: [...profile.toolCalling.coreToolsAlwaysInline],
      ...(profile.toolCalling.strictSchemaLimits
        ? {
            strictSchemaLimits: {
              ...profile.toolCalling.strictSchemaLimits,
              unsupportedKeywords: [
                ...(profile.toolCalling.strictSchemaLimits.unsupportedKeywords ??
                  []),
              ],
            },
          }
        : {}),
    },
  }
}

function matchesModelPattern(
  model: string | undefined,
  pattern: string,
): boolean {
  if (!model) {
    return false
  }
  const normalizedModel = model.toLowerCase()
  const normalizedPattern = pattern.toLowerCase()
  if (normalizedPattern.includes('*')) {
    const escaped = normalizedPattern
      .split('*')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
      .join('.*')
    return new RegExp(`^${escaped}$`, 'u').test(normalizedModel)
  }
  return normalizedModel === normalizedPattern
}
