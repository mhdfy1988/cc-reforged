import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { z } from 'zod'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { safeParseJSON } from '../../utils/json.js'
import { getDefaultSonnetModel } from '../../utils/model/model.js'
import { getBuiltinLlmProviderDefinition } from './providerDefinitions.js'
import type { LlmModelId, LlmProviderId } from './types.js'

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
    credentialFilePath: z.string().trim().min(1).optional(),
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

const llmConfigSchema = z
  .object({
    provider: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    providers: z.record(llmProviderConfigSchema).optional(),
  })
  .strict()

export type LlmProviderConfig = z.infer<typeof llmProviderConfigSchema>
export type LlmConfigFile = z.infer<typeof llmConfigSchema>

export interface ResolvedLlmConfig {
  provider: LlmProviderId
  model: LlmModelId
  providers: Record<string, LlmProviderConfig>
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
  credentialFilePath: join(getClaudeConfigHomeDir(), 'data', 'codex-oauth.json'),
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

function getDefaultProviders(): Record<string, LlmProviderConfig> {
  return {
    anthropic: { ...DEFAULT_ANTHROPIC_PROVIDER_CONFIG },
    'codex-oauth': { ...DEFAULT_CODEX_OAUTH_PROVIDER_CONFIG },
    deepseek: { ...DEFAULT_DEEPSEEK_PROVIDER_CONFIG },
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

function getEnvironmentOverrides(): LlmConfigFile {
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

function resolveModelForProvider(
  provider: LlmProviderId,
  explicitModel: string | undefined,
  providers: Record<string, LlmProviderConfig>,
): LlmModelId {
  if (explicitModel) {
    return explicitModel
  }
  const providerDefault = providers[provider]?.defaultModel?.trim()
  if (providerDefault) {
    return providerDefault
  }
  if (provider === 'anthropic') {
    return getDefaultSonnetModel()
  }
  throw new Error(
    `No model configured for provider '${provider}'. Set CCR_LLM_MODEL or add a provider default model.`,
  )
}

export function loadLlmConfig(): ResolvedLlmConfig {
  const filePath = getConfiguredLlmConfigPath()
  const fileConfig = readLlmConfigFile(filePath)
  const envConfig = getEnvironmentOverrides()
  const defaultProviders = getDefaultProviders()
  const mergedProviders = mergeProviderConfigs(
    defaultProviders,
    fileConfig?.providers,
  )

  const provider = (
    envConfig.provider ??
    fileConfig?.provider ??
    'codex-oauth'
  ).trim() as LlmProviderId

  const model = resolveModelForProvider(
    provider,
    envConfig.model ?? fileConfig?.model,
    mergedProviders,
  )

  return {
    provider,
    model,
    providers: mergedProviders,
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

export async function updatePersistedLlmConfig(
  update: PersistedLlmConfigUpdate,
): Promise<ResolvedLlmConfig> {
  const filePath = getConfiguredLlmConfigPath()
  const currentFileConfig = readLlmConfigFile(filePath) ?? {}
  const nextFileConfig: LlmConfigFile = {
    ...currentFileConfig,
  }

  if (update.provider !== undefined) {
    if (update.provider === null) {
      delete nextFileConfig.provider
    } else {
      nextFileConfig.provider = update.provider.trim()
    }
  }

  if (update.model !== undefined) {
    if (update.model === null) {
      delete nextFileConfig.model
    } else {
      nextFileConfig.model = update.model.trim()
    }
  }

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(nextFileConfig, null, 2) + '\n', 'utf8')
  return loadLlmConfig()
}
