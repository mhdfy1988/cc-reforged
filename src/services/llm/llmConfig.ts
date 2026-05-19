import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { z } from 'zod'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { safeParseJSON } from '../../utils/json.js'
import { getDefaultSonnetModel } from '../../utils/model/model.js'
import { getBuiltinLlmProviderDefinition } from './providerDefinitions.js'
import type { LlmModelId, LlmProviderId } from './types.js'

const llmInputModalitySchema = z.enum([
  'text',
  'image',
  'file',
  'audio',
  'video',
])
const llmOutputModalitySchema = z.enum([
  'text',
  'image',
  'audio',
  'file',
  'video',
])

const llmImageCapabilityLimitsSchema = z
  .object({
    maxImages: z.number().int().positive().optional(),
    maxImageBytes: z.number().int().positive().optional(),
    mimeTypes: z.array(z.string().trim().min(1)).optional(),
  })
  .strict()

const llmModelCapabilityOverrideSchema = z
  .object({
    inputModalities: z.array(llmInputModalitySchema).optional(),
    outputModalities: z.array(llmOutputModalitySchema).optional(),
    tools: z.boolean().optional(),
    structuredOutput: z.boolean().optional(),
    image: llmImageCapabilityLimitsSchema.optional(),
    reason: z.string().trim().min(1).optional(),
  })
  .strict()

const llmProfileCapabilityOverridesSchema = z
  .object({
    default: llmModelCapabilityOverrideSchema.optional(),
    models: z.record(llmModelCapabilityOverrideSchema).optional(),
  })
  .strict()

const llmProviderConfigSchema = z
  .object({
    defaultModel: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    authStrategy: z
      .enum([
        'api_key',
        'oauth_refreshable',
        'oauth_external',
        'external_process',
        'hybrid',
        'unknown',
      ])
      .optional(),
    apiMode: z
      .enum(['anthropic-messages', 'openai-responses', 'openai-chat', 'custom'])
      .optional(),
    baseUrl: z.string().trim().min(1).optional(),
    authorizeUrl: z.string().trim().min(1).optional(),
    tokenUrl: z.string().trim().min(1).optional(),
    redirectUri: z.string().trim().min(1).optional(),
    scope: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    systemPrompt: z.string().trim().min(1).optional(),
    transport: z.string().trim().min(1).optional(),
    supportsStreaming: z.boolean().optional(),
    supportsTools: z.boolean().optional(),
    supportsReasoning: z.boolean().optional(),
    supportsUsage: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

const llmProfileAuthConfigSchema = z
  .object({
    strategy: z
      .enum([
        'api_key',
        'oauth_refreshable',
        'oauth_external',
        'external_process',
        'hybrid',
        'unknown',
      ])
      .optional(),
    accountId: z.string().trim().min(1).optional(),
  })
  .strict()

const llmProfileEndpointConfigSchema = z
  .object({
    baseUrl: z.string().trim().min(1).optional(),
  })
  .strict()

const llmProfileModelsConfigSchema = z.union([
  z.array(z.string().trim().min(1)),
  z
    .object({
      source: z.enum(['builtin', 'custom', 'remote', 'mixed']).optional(),
      default: z.string().trim().min(1).optional(),
      include: z.array(z.string().trim().min(1)).optional(),
      custom: z.array(z.string().trim().min(1)).optional(),
    })
    .strict(),
])

const llmProfileConfigSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    providerType: z.string().trim().min(1),
    apiMode: z
      .enum(['anthropic-messages', 'openai-responses', 'openai-chat', 'custom'])
      .optional(),
    baseUrl: z.string().trim().min(1).optional(),
    endpoint: llmProfileEndpointConfigSchema.optional(),
    auth: llmProfileAuthConfigSchema.optional(),
    defaultModel: z.string().trim().min(1).optional(),
    models: llmProfileModelsConfigSchema.optional(),
    supportsStreaming: z.boolean().optional(),
    supportsTools: z.boolean().optional(),
    supportsReasoning: z.boolean().optional(),
    supportsUsage: z.boolean().optional(),
    capabilityOverrides: llmProfileCapabilityOverridesSchema.optional(),
    availability: z
      .object({
        status: z
          .enum([
            'not_configured',
            'needs_auth',
            'configured',
            'auth_ready',
            'verified',
            'failed',
          ])
          .optional(),
        lastCheckedAt: z.string().trim().min(1).optional(),
        error: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

const llmCurrentConfigSchema = z
  .object({
    profileId: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
  })
  .strict()

const llmConfigSchema = z
  .object({
    schemaVersion: z.literal(2).optional(),
    current: llmCurrentConfigSchema.optional(),
    providerOverrides: z.record(llmProviderConfigSchema).optional(),
    profiles: z.record(llmProfileConfigSchema).optional(),
  })
  .strict()

export type LlmProviderConfig = z.infer<typeof llmProviderConfigSchema>
export type LlmModelCapabilityOverrideConfig = z.infer<
  typeof llmModelCapabilityOverrideSchema
>
export type LlmProfileCapabilityOverridesConfig = z.infer<
  typeof llmProfileCapabilityOverridesSchema
>
export type LlmProfileConfig = z.infer<typeof llmProfileConfigSchema>
export type LlmConfigFile = z.infer<typeof llmConfigSchema>

export interface ResolvedLlmProfile {
  id: string
  name: string
  providerType: LlmProviderId
  apiMode: NonNullable<LlmProviderConfig['apiMode']>
  authStrategy: NonNullable<LlmProviderConfig['authStrategy']>
  accountId?: string
  baseUrl?: string
  defaultModel: LlmModelId
  models: LlmModelId[]
  capabilities: {
    streaming: boolean
    tools: boolean
    reasoning: boolean
    usage: boolean
  }
  capabilityOverrides?: LlmProfileCapabilityOverridesConfig
  availability?: NonNullable<LlmProfileConfig['availability']>
  source: 'file'
}

export interface ResolvedLlmConfig {
  provider: LlmProviderId
  model: LlmModelId
  providers: Record<string, LlmProviderConfig>
  currentProfileId: string
  profiles: Record<string, ResolvedLlmProfile>
  path: string
  source: 'default' | 'file' | 'env' | 'file+env'
}

export interface LlmConfigValidationResult {
  valid: boolean
  error?: string
}

export interface PersistedLlmConfigUpdate {
  provider?: string | null
  model?: string | null
  currentProfileId?: string | null
}

export interface PersistedLlmProfileUpdate {
  profileId: string
  profile: LlmProfileConfig
  setCurrent?: boolean
}

const DEFAULT_ANTHROPIC_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: getDefaultSonnetModel(),
  displayName: getBuiltinLlmProviderDefinition('anthropic')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('anthropic')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('anthropic')!.apiMode,
  supportsStreaming:
    getBuiltinLlmProviderDefinition('anthropic')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('anthropic')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('anthropic')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('anthropic')!.capabilities.usage,
}

const DEFAULT_OPENAI_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'gpt-5.4',
  displayName: getBuiltinLlmProviderDefinition('openai')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('openai')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('openai')!.apiMode,
  baseUrl: 'https://api.openai.com/v1',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('openai')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('openai')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('openai')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('openai')!.capabilities.usage,
  metadata: {
    defaultImageModel: 'gpt-image-1',
  },
}

const DEFAULT_CODEX_OAUTH_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'gpt-5.4',
  displayName: getBuiltinLlmProviderDefinition('codex-oauth')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('codex-oauth')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('codex-oauth')!.apiMode,
  baseUrl: 'https://chatgpt.com/backend-api',
  authorizeUrl: 'https://auth.openai.com/oauth/authorize',
  tokenUrl: 'https://auth.openai.com/oauth/token',
  redirectUri: 'http://localhost:1455/auth/callback',
  scope: 'openid profile email offline_access',
  clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
  reasoningEffort: 'high',
  systemPrompt: 'You are a helpful assistant. Reply clearly and concisely.',
  transport: 'sse',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('codex-oauth')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('codex-oauth')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('codex-oauth')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('codex-oauth')!.capabilities.usage,
}

const DEFAULT_DEEPSEEK_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'deepseek-v4-flash',
  displayName: getBuiltinLlmProviderDefinition('deepseek')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('deepseek')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('deepseek')!.apiMode,
  baseUrl: 'https://api.deepseek.com',
  reasoningEffort: 'high',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('deepseek')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('deepseek')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('deepseek')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('deepseek')!.capabilities.usage,
}

const DEFAULT_KIMI_API_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'kimi-k2.6',
  displayName: getBuiltinLlmProviderDefinition('kimi-api')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('kimi-api')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('kimi-api')!.apiMode,
  baseUrl: 'https://api.moonshot.cn/v1',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('kimi-api')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('kimi-api')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('kimi-api')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('kimi-api')!.capabilities.usage,
  metadata: {
    platform: 'kimi-open-platform',
  },
}

const DEFAULT_KIMI_CODE_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'kimi-for-coding',
  displayName: getBuiltinLlmProviderDefinition('kimi-code')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('kimi-code')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('kimi-code')!.apiMode,
  baseUrl: 'https://api.kimi.com/coding',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('kimi-code')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('kimi-code')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('kimi-code')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('kimi-code')!.capabilities.usage,
  metadata: {
    platform: 'kimi-code',
    modelIdentifierKind: 'unified',
  },
}

const DEFAULT_GLM_API_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'glm-5.1',
  displayName: getBuiltinLlmProviderDefinition('glm-api')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('glm-api')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('glm-api')!.apiMode,
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('glm-api')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('glm-api')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('glm-api')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('glm-api')!.capabilities.usage,
  metadata: {
    platform: 'glm-open-platform',
    defaultImageModel: 'glm-image',
  },
}

const DEFAULT_GLM_CODING_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'glm-5.1',
  displayName: getBuiltinLlmProviderDefinition('glm-coding')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('glm-coding')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('glm-coding')!.apiMode,
  baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('glm-coding')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('glm-coding')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('glm-coding')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('glm-coding')!.capabilities.usage,
  metadata: {
    platform: 'glm-coding-plan',
  },
}

const DEFAULT_MINIMAX_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'MiniMax-M2.7',
  displayName: getBuiltinLlmProviderDefinition('minimax')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('minimax')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('minimax')!.apiMode,
  baseUrl: 'https://api.minimax.io/anthropic',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('minimax')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('minimax')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('minimax')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('minimax')!.capabilities.usage,
  metadata: {
    defaultImageModel: 'image-01',
  },
}

const DEFAULT_MINIMAX_CN_PROVIDER_CONFIG: LlmProviderConfig = {
  defaultModel: 'MiniMax-M2.7',
  displayName: getBuiltinLlmProviderDefinition('minimax-cn')!.displayName,
  authStrategy: getBuiltinLlmProviderDefinition('minimax-cn')!.authStrategy,
  apiMode: getBuiltinLlmProviderDefinition('minimax-cn')!.apiMode,
  baseUrl: 'https://api.minimaxi.com/anthropic',
  supportsStreaming:
    getBuiltinLlmProviderDefinition('minimax-cn')!.capabilities.streaming,
  supportsTools:
    getBuiltinLlmProviderDefinition('minimax-cn')!.capabilities.tools,
  supportsReasoning:
    getBuiltinLlmProviderDefinition('minimax-cn')!.capabilities.reasoning,
  supportsUsage:
    getBuiltinLlmProviderDefinition('minimax-cn')!.capabilities.usage,
  metadata: {
    defaultImageModel: 'image-01',
  },
}

function getDefaultProviders(): Record<string, LlmProviderConfig> {
  return {
    anthropic: { ...DEFAULT_ANTHROPIC_PROVIDER_CONFIG },
    openai: { ...DEFAULT_OPENAI_PROVIDER_CONFIG },
    'codex-oauth': { ...DEFAULT_CODEX_OAUTH_PROVIDER_CONFIG },
    deepseek: { ...DEFAULT_DEEPSEEK_PROVIDER_CONFIG },
    'kimi-api': { ...DEFAULT_KIMI_API_PROVIDER_CONFIG },
    'kimi-code': { ...DEFAULT_KIMI_CODE_PROVIDER_CONFIG },
    'glm-api': { ...DEFAULT_GLM_API_PROVIDER_CONFIG },
    'glm-coding': { ...DEFAULT_GLM_CODING_PROVIDER_CONFIG },
    minimax: { ...DEFAULT_MINIMAX_PROVIDER_CONFIG },
    'minimax-cn': { ...DEFAULT_MINIMAX_CN_PROVIDER_CONFIG },
  }
}

function mergeProviderConfigs(
  defaults: Record<string, LlmProviderConfig>,
  overrides: Record<string, LlmProviderConfig> | undefined,
): Record<string, LlmProviderConfig> {
  if (!overrides) {
    return defaults
  }
  const merged: Record<string, LlmProviderConfig> = { ...defaults }
  for (const [providerId, override] of Object.entries(overrides)) {
    merged[providerId] = {
      ...(defaults[providerId] ?? {}),
      ...override,
    }
  }
  return merged
}

function getProviderOverrides(
  fileConfig: LlmConfigFile | null,
): Record<string, LlmProviderConfig> | undefined {
  return fileConfig?.providerOverrides
}

function getDefaultProfileName(
  providerId: string,
  providerConfig: LlmProviderConfig,
): string {
  const displayName = providerConfig.displayName?.trim() || providerId
  if (providerConfig.authStrategy === 'oauth_refreshable') {
    return `${displayName} 登录配置`
  }
  if (providerConfig.authStrategy === 'api_key') {
    return `${displayName} API Key`
  }
  return `${displayName} 默认连接`
}

function getProviderCapabilities(providerConfig: LlmProviderConfig): {
  streaming: boolean
  tools: boolean
  reasoning: boolean
  usage: boolean
} {
  return {
    streaming: providerConfig.supportsStreaming ?? false,
    tools: providerConfig.supportsTools ?? false,
    reasoning: providerConfig.supportsReasoning ?? false,
    usage: providerConfig.supportsUsage ?? false,
  }
}

function resolveProfileModels(input: {
  profileModels?: LlmProfileConfig['models']
  defaultModel: string
}): LlmModelId[] {
  const models = getProfileModelIds(input.profileModels)
  const deduped = Array.from(new Set([input.defaultModel, ...(models ?? [])]))
  return deduped.length > 0 ? deduped : [input.defaultModel]
}

function getProfileModelIds(
  profileModels: LlmProfileConfig['models'] | undefined,
): string[] | undefined {
  if (!profileModels) {
    return undefined
  }
  if (Array.isArray(profileModels)) {
    return profileModels.map(model => model.trim()).filter(Boolean)
  }
  return [
    profileModels.default,
    ...(profileModels.include ?? []),
    ...(profileModels.custom ?? []),
  ]
    .map(model => model?.trim())
    .filter((model): model is string => Boolean(model))
}

function getProfileDefaultModel(
  profileModels: LlmProfileConfig['models'] | undefined,
): string | undefined {
  if (!profileModels || Array.isArray(profileModels)) {
    return undefined
  }
  return profileModels.default?.trim()
}

function resolveFileProfile(input: {
  profileId: string
  profile: LlmProfileConfig
  providers: Record<string, LlmProviderConfig>
}): ResolvedLlmProfile {
  const providerConfig = input.providers[input.profile.providerType] ?? {}
  const defaultModel =
    input.profile.defaultModel?.trim() ||
    getProfileDefaultModel(input.profile.models) ||
    providerConfig.defaultModel?.trim()
  if (!defaultModel) {
    throw new Error(
      `LLM profile '${input.profileId}' does not define a default model.`,
    )
  }
  const authStrategy =
    input.profile.auth?.strategy ??
    providerConfig.authStrategy ??
    'unknown'
  const apiMode = input.profile.apiMode ?? providerConfig.apiMode ?? 'custom'
  return {
    id: input.profileId,
    name:
      input.profile.name?.trim() ||
      getDefaultProfileName(input.profile.providerType, providerConfig),
    providerType: input.profile.providerType,
    apiMode,
    authStrategy,
    ...(input.profile.auth?.accountId
      ? { accountId: input.profile.auth.accountId }
      : {}),
    ...(input.profile.endpoint?.baseUrl ?? input.profile.baseUrl ?? providerConfig.baseUrl
      ? {
          baseUrl:
            input.profile.endpoint?.baseUrl ??
            input.profile.baseUrl ??
            providerConfig.baseUrl,
        }
      : {}),
    defaultModel,
    models: resolveProfileModels({
      profileModels: input.profile.models,
      defaultModel,
    }),
    capabilities: {
      streaming:
        input.profile.supportsStreaming ??
        providerConfig.supportsStreaming ??
        false,
      tools:
        input.profile.supportsTools ?? providerConfig.supportsTools ?? false,
      reasoning:
        input.profile.supportsReasoning ??
        providerConfig.supportsReasoning ??
        false,
      usage: input.profile.supportsUsage ?? providerConfig.supportsUsage ?? false,
    },
    ...(input.profile.capabilityOverrides
      ? { capabilityOverrides: input.profile.capabilityOverrides }
      : {}),
    ...(input.profile.availability
      ? { availability: input.profile.availability }
      : {}),
    source: 'file',
  }
}

function resolveProfiles(input: {
  providers: Record<string, LlmProviderConfig>
  profiles?: Record<string, LlmProfileConfig>
}): Record<string, ResolvedLlmProfile> {
  const profiles: Record<string, ResolvedLlmProfile> = {}
  for (const [profileId, profile] of Object.entries(input.profiles ?? {})) {
    profiles[profileId] = resolveFileProfile({
      profileId,
      profile,
      providers: input.providers,
    })
  }
  return profiles
}

function findProfileForProvider(
  profiles: Record<string, ResolvedLlmProfile>,
  provider: string,
): ResolvedLlmProfile | undefined {
  return Object.values(profiles).find(profile => profile.providerType === provider)
}

function resolveCurrentProfile(input: {
  provider: string
  explicitProfileId?: string
  profiles: Record<string, ResolvedLlmProfile>
}): ResolvedLlmProfile {
  const explicitProfile = input.explicitProfileId
    ? input.profiles[input.explicitProfileId]
    : undefined
  if (explicitProfile && explicitProfile.providerType === input.provider) {
    return explicitProfile
  }
  const providerProfile = findProfileForProvider(input.profiles, input.provider)
  if (providerProfile) {
    return providerProfile
  }
  throw new Error(
    `No LLM profile configured for provider '${input.provider}'. Add a profile or provider default model.`,
  )
}

export function getDefaultLlmConfigPath(): string {
  return join(getClaudeConfigHomeDir(), 'data', 'llm.config.local.json')
}

function getConfiguredLlmConfigPath(): string {
  const explicitPath = process.env.CCR_LLM_CONFIG_PATH?.trim()
  return explicitPath || getDefaultLlmConfigPath()
}

export function getResolvedLlmConfigPath(): string {
  return getConfiguredLlmConfigPath()
}

function readLlmConfigFile(filePath: string): LlmConfigFile | null {
  const fs = getFsImplementation()
  if (!fs.existsSync(filePath)) {
    return null
  }
  const rawContent = fs.readFileSync(filePath, { encoding: 'utf8' })
  const parsed = safeParseJSON(rawContent, true)
  if (!parsed) {
    throw new Error(`Invalid LLM config JSON: ${filePath}`)
  }
  return llmConfigSchema.parse(parsed)
}

function getEnvironmentOverrides(): { provider?: string; model?: string } {
  const provider = process.env.CCR_LLM_PROVIDER?.trim()
  const model = process.env.CCR_LLM_MODEL?.trim()
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  }
}

function resolveConfigSource(
  hasFileConfig: boolean,
  hasEnvOverride: boolean,
): ResolvedLlmConfig['source'] {
  if (hasFileConfig && hasEnvOverride) {
    return 'file+env'
  }
  if (hasEnvOverride) {
    return 'env'
  }
  if (hasFileConfig) {
    return 'file'
  }
  return 'default'
}

export function loadLlmConfig(): ResolvedLlmConfig {
  const filePath = getConfiguredLlmConfigPath()
  const fileConfig = readLlmConfigFile(filePath)
  const envConfig = getEnvironmentOverrides()
  const defaultProviders = getDefaultProviders()
  const mergedProviders = mergeProviderConfigs(
    defaultProviders,
    getProviderOverrides(fileConfig),
  )
  const currentProfileId =
    fileConfig?.current?.profileId?.trim()
  const profiles = resolveProfiles({
    providers: mergedProviders,
    profiles: fileConfig?.profiles,
  })
  const currentProfile =
    currentProfileId && profiles[currentProfileId]
      ? profiles[currentProfileId]
      : undefined

  const provider = (
    envConfig.provider ??
    currentProfile?.providerType ??
    ''
  ).trim() as LlmProviderId
  const model = (
    envConfig.model ??
    fileConfig?.current?.model ??
    currentProfile?.defaultModel ??
    ''
  ).trim() as LlmModelId

  return {
    provider,
    model,
    providers: mergedProviders,
    currentProfileId: currentProfile?.id ?? currentProfileId ?? '',
    profiles,
    path: filePath,
    source: resolveConfigSource(
      fileConfig !== null,
      Boolean(envConfig.provider || envConfig.model),
    ),
  }
}

export function validateLlmConfigForProviders(
  config: Pick<ResolvedLlmConfig, 'provider' | 'model'>,
  availableProviders: readonly string[],
): LlmConfigValidationResult {
  if (!config.provider.trim()) {
    return { valid: false, error: 'LLM provider cannot be empty.' }
  }
  if (!config.model.trim()) {
    return { valid: false, error: 'LLM model cannot be empty.' }
  }
  if (
    availableProviders.length > 0 &&
    !availableProviders.includes(config.provider)
  ) {
    return {
      valid: false,
      error: `LLM provider '${config.provider}' is not registered in the current runtime.`,
    }
  }
  return { valid: true }
}

export function getLlmProviderConfig(
  providerId: string,
  config: ResolvedLlmConfig = loadLlmConfig(),
): LlmProviderConfig | undefined {
  return config.providers[providerId]
}

export function listResolvedLlmProfiles(
  config: ResolvedLlmConfig = loadLlmConfig(),
): ResolvedLlmProfile[] {
  return Object.values(config.profiles)
}

export function getCurrentLlmProfile(
  config: ResolvedLlmConfig = loadLlmConfig(),
): ResolvedLlmProfile {
  const profile = config.profiles[config.currentProfileId]
  if (!profile) {
    throw new Error('No current LLM profile configured.')
  }
  return profile
}

export function getLlmProfileForProvider(
  providerId: string,
  config: ResolvedLlmConfig = loadLlmConfig(),
): ResolvedLlmProfile | undefined {
  const current = config.profiles[config.currentProfileId]
  if (current?.providerType === providerId) {
    return current
  }
  return findProfileForProvider(config.profiles, providerId)
}

export async function updatePersistedLlmConfig(
  update: PersistedLlmConfigUpdate,
): Promise<ResolvedLlmConfig> {
  const filePath = getConfiguredLlmConfigPath()
  const currentFileConfig = readLlmConfigFile(filePath) ?? {}
  const nextFileConfig: LlmConfigFile = {
    ...currentFileConfig,
    schemaVersion: 2,
    current: {
      ...(currentFileConfig.current ?? {}),
    },
  }

  if (update.provider !== undefined) {
    // Provider is derived from current.profileId in the v2 config shape.
  }

  if (update.model !== undefined) {
    if (update.model === null) {
      delete nextFileConfig.current?.model
    } else {
      const model = update.model.trim()
      nextFileConfig.current = {
        ...(nextFileConfig.current ?? {}),
        model,
      }
    }
  }

  if (update.currentProfileId !== undefined) {
    if (update.currentProfileId === null) {
      delete nextFileConfig.current?.profileId
    } else {
      const profileId = update.currentProfileId.trim()
      nextFileConfig.current = {
        ...(nextFileConfig.current ?? {}),
        profileId,
      }
    }
  }

  if (
    nextFileConfig.current &&
    !nextFileConfig.current.profileId &&
    !nextFileConfig.current.model
  ) {
    delete nextFileConfig.current
  }

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(nextFileConfig, null, 2) + '\n', 'utf8')
  return loadLlmConfig()
}

export async function upsertPersistedLlmProfile(
  update: PersistedLlmProfileUpdate,
): Promise<ResolvedLlmConfig> {
  const filePath = getConfiguredLlmConfigPath()
  const currentFileConfig = readLlmConfigFile(filePath) ?? {}
  const profileId = update.profileId.trim()
  const profile = llmProfileConfigSchema.parse(update.profile)
  const nextFileConfig: LlmConfigFile = {
    ...currentFileConfig,
    schemaVersion: 2,
    profiles: {
      ...(currentFileConfig.profiles ?? {}),
      [profileId]: profile,
    },
    current: {
      ...(currentFileConfig.current ?? {}),
    },
  }

  if (update.setCurrent) {
    const model =
      profile.defaultModel?.trim() ||
      getProfileDefaultModel(profile.models) ||
      nextFileConfig.providerOverrides?.[profile.providerType]?.defaultModel?.trim() ||
      getDefaultProviders()[profile.providerType]?.defaultModel?.trim()
    nextFileConfig.current = {
      ...(nextFileConfig.current ?? {}),
      profileId,
      ...(model ? { model } : {}),
    }
    if (model) {
      // Current model lives under current.model in the v2 config shape.
    }
  }

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(nextFileConfig, null, 2) + '\n', 'utf8')
  return loadLlmConfig()
}

export async function deletePersistedLlmProfile(
  profileId: string,
): Promise<ResolvedLlmConfig> {
  const filePath = getConfiguredLlmConfigPath()
  const currentFileConfig = readLlmConfigFile(filePath) ?? {}
  const normalizedProfileId = profileId.trim()
  const fileProfile = currentFileConfig.profiles?.[normalizedProfileId]
  if (!fileProfile) {
    throw new Error(`LLM profile '${normalizedProfileId}' is not stored in config.`)
  }
  const nextProfiles = { ...(currentFileConfig.profiles ?? {}) }
  delete nextProfiles[normalizedProfileId]

  const nextFileConfig: LlmConfigFile = {
    ...currentFileConfig,
    schemaVersion: 2,
    profiles: nextProfiles,
    current: {
      ...(currentFileConfig.current ?? {}),
    },
  }
  if (Object.keys(nextProfiles).length === 0) {
    delete nextFileConfig.profiles
  }

  const wasCurrent =
    currentFileConfig.current?.profileId === normalizedProfileId
  if (wasCurrent) {
    const fallbackEntry =
      Object.entries(nextProfiles).find(
        ([, profile]) => profile.providerType === fileProfile.providerType,
      ) ?? Object.entries(nextProfiles)[0]
    if (fallbackEntry) {
      const [fallbackProfileId, fallbackProfile] = fallbackEntry
      const fallbackModel =
        fallbackProfile.defaultModel?.trim() ||
        getProfileDefaultModel(fallbackProfile.models)
      nextFileConfig.current = {
        ...(nextFileConfig.current ?? {}),
        profileId: fallbackProfileId,
        ...(fallbackModel ? { model: fallbackModel } : {}),
      }
      if (fallbackModel) {
        // Current model lives under current.model in the v2 config shape.
      } else {
        delete nextFileConfig.current.model
      }
    } else {
      delete nextFileConfig.current?.profileId
      delete nextFileConfig.current.model
    }
  }

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(nextFileConfig, null, 2) + '\n', 'utf8')
  return loadLlmConfig()
}
