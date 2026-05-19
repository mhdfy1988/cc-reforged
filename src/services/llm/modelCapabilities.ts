import type {
  LlmApiMode,
  LlmImageCapabilityLimits,
  LlmInputModality,
  LlmModelCapabilities,
  LlmModelCapabilityOverride,
  LlmModelCapabilitySource,
  LlmModelCatalogEntry,
  LlmModelId,
  LlmOutputModality,
  LlmProviderCapabilities,
  LlmProviderId,
} from './types.js'
import type { ResolvedLlmProfile } from './llmConfig.js'

const TEXT_INPUT_MODALITIES: readonly LlmInputModality[] = ['text']
const TEXT_OUTPUT_MODALITIES: readonly LlmOutputModality[] = ['text']
const TEXT_AND_IMAGE_INPUT_MODALITIES: readonly LlmInputModality[] = [
  'text',
  'image',
]

const IMAGE_INPUT_LIMITS: LlmImageCapabilityLimits = {
  maxImages: 20,
  maxImageBytes: 5 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}

const BUILTIN_TEXT_PROVIDER_IDS = new Set([
  'codex-oauth',
  'deepseek',
  'glm-api',
  'glm-coding',
  'kimi-api',
  'kimi-code',
  'minimax',
  'minimax-cn',
])

export interface ResolveLlmModelCapabilitiesInput {
  providerId: LlmProviderId
  apiMode: LlmApiMode
  model: LlmModelId
  providerCapabilities?: Readonly<LlmProviderCapabilities>
  catalogEntry?: LlmModelCatalogEntry
  profile?: ResolvedLlmProfile
}

export function resolveLlmModelCapabilities(
  input: ResolveLlmModelCapabilitiesInput,
): LlmModelCapabilities {
  const base =
    resolveBuiltinLlmModelCapabilities(input) ??
    createDefaultLlmModelCapabilities(input.model)
  const override = resolveProfileCapabilityOverride(input.profile, input.model)
  if (!override) {
    return base
  }
  return applyCapabilityOverride(base, override, input)
}

export function createDefaultLlmModelCapabilities(
  model: LlmModelId,
): LlmModelCapabilities {
  return normalizeModelCapabilities({
    inputModalities: TEXT_INPUT_MODALITIES,
    outputModalities: TEXT_OUTPUT_MODALITIES,
    tools: false,
    structuredOutput: false,
    source: 'default',
    reason: `No builtin capability entry or profile override matched '${model}'.`,
  })
}

function resolveBuiltinLlmModelCapabilities(
  input: ResolveLlmModelCapabilitiesInput,
): LlmModelCapabilities | undefined {
  if (input.catalogEntry?.modelCapabilities) {
    return normalizeModelCapabilities({
      ...input.catalogEntry.modelCapabilities,
      reason:
        input.catalogEntry.modelCapabilities.reason ||
        `Builtin catalog capability entry matched '${input.model}'.`,
    })
  }

  if (input.providerId === 'anthropic') {
    return normalizeModelCapabilities({
      inputModalities:
        input.catalogEntry?.inputModalities ?? TEXT_AND_IMAGE_INPUT_MODALITIES,
      outputModalities: TEXT_OUTPUT_MODALITIES,
      tools:
        input.catalogEntry?.supportsTools ??
        input.providerCapabilities?.tools ??
        false,
      structuredOutput: false,
      source: 'builtin',
      reason: `Builtin Anthropic capability entry matched '${input.model}'.`,
      image: IMAGE_INPUT_LIMITS,
    })
  }

  if (BUILTIN_TEXT_PROVIDER_IDS.has(input.providerId)) {
    const inputModalities =
      input.catalogEntry?.inputModalities ?? TEXT_INPUT_MODALITIES
    return normalizeModelCapabilities({
      inputModalities,
      outputModalities: TEXT_OUTPUT_MODALITIES,
      tools:
        input.catalogEntry?.supportsTools ??
        input.providerCapabilities?.tools ??
        false,
      structuredOutput: false,
      source: 'builtin',
      reason: `Builtin ${input.providerId} capability entry matched '${input.model}'.`,
      image: inputModalities.includes('image') ? IMAGE_INPUT_LIMITS : undefined,
    })
  }

  return undefined
}

function resolveProfileCapabilityOverride(
  profile: ResolvedLlmProfile | undefined,
  model: LlmModelId,
): LlmModelCapabilityOverride | undefined {
  const overrides = profile?.capabilityOverrides
  if (!overrides) {
    return undefined
  }

  const modelOverride = findModelOverride(overrides.models, model)
  if (!overrides.default) {
    return modelOverride
  }
  if (!modelOverride) {
    return overrides.default
  }

  return {
    ...overrides.default,
    ...modelOverride,
    image: {
      ...overrides.default.image,
      ...modelOverride.image,
    },
  }
}

function findModelOverride(
  overrides: Record<string, LlmModelCapabilityOverride> | undefined,
  model: LlmModelId,
): LlmModelCapabilityOverride | undefined {
  if (!overrides) {
    return undefined
  }
  const exact = overrides[model]
  if (exact) {
    return exact
  }
  const normalizedModel = model.toLowerCase()
  return Object.entries(overrides).find(
    ([key]) => key.toLowerCase() === normalizedModel,
  )?.[1]
}

function applyCapabilityOverride(
  base: LlmModelCapabilities,
  override: LlmModelCapabilityOverride,
  input: ResolveLlmModelCapabilitiesInput,
): LlmModelCapabilities {
  return normalizeModelCapabilities({
    inputModalities: override.inputModalities ?? base.inputModalities,
    outputModalities: override.outputModalities ?? base.outputModalities,
    tools: override.tools ?? base.tools,
    structuredOutput: override.structuredOutput ?? base.structuredOutput,
    image: {
      ...base.image,
      ...override.image,
    },
    source: 'profile_override',
    baseSource: base.source,
    reason:
      override.reason ??
      `Profile '${input.profile?.id ?? 'unknown'}' capability override matched '${input.model}'.`,
  })
}

function normalizeModelCapabilities(
  input: Omit<LlmModelCapabilities, 'inputModalities' | 'outputModalities'> & {
    inputModalities: readonly LlmInputModality[]
    outputModalities: readonly LlmOutputModality[]
  },
): LlmModelCapabilities {
  const inputModalities = normalizeInputModalities(input.inputModalities)
  const outputModalities = normalizeOutputModalities(input.outputModalities)
  const hasImageModality =
    inputModalities.includes('image') || outputModalities.includes('image')
  const image =
    hasImageModality && input.image
      ? normalizeImageLimits(input.image)
      : undefined

  return {
    inputModalities,
    outputModalities,
    tools: input.tools,
    structuredOutput: input.structuredOutput,
    source: input.source,
    reason: input.reason,
    ...(input.baseSource ? { baseSource: input.baseSource } : {}),
    ...(image ? { image } : {}),
  }
}

function normalizeInputModalities(
  modalities: readonly LlmInputModality[],
): readonly LlmInputModality[] {
  return normalizeModalities(modalities, TEXT_INPUT_MODALITIES)
}

function normalizeOutputModalities(
  modalities: readonly LlmOutputModality[],
): readonly LlmOutputModality[] {
  return normalizeModalities(modalities, TEXT_OUTPUT_MODALITIES)
}

function normalizeModalities<T extends string>(
  modalities: readonly T[],
  fallback: readonly T[],
): readonly T[] {
  const deduped = Array.from(new Set(modalities))
  return deduped.length > 0 ? deduped : [...fallback]
}

function normalizeImageLimits(
  limits: LlmImageCapabilityLimits,
): LlmImageCapabilityLimits {
  return {
    ...(limits.maxImages ? { maxImages: limits.maxImages } : {}),
    ...(limits.maxImageBytes ? { maxImageBytes: limits.maxImageBytes } : {}),
    ...(limits.mimeTypes && limits.mimeTypes.length > 0
      ? { mimeTypes: Array.from(new Set(limits.mimeTypes)) }
      : {}),
  }
}

export function getCapabilitySourceLabel(
  source: LlmModelCapabilitySource,
): string {
  if (source === 'builtin') {
    return '内置能力目录'
  }
  if (source === 'profile_override') {
    return 'Profile 覆盖'
  }
  return '默认纯文本能力'
}
