import type {
  CcrContentSource,
  CcrGeneratedArtifactSnapshot,
  CcrImageContentBlock,
  CcrVideoContentBlock,
  CcrTextContentBlock,
  CcrThinkingContentBlock,
  CcrToolCallContentBlock,
  CcrToolResultContentBlock,
} from '../../types/contentBlocks.js'

export type LlmProviderId = string
export type LlmModelId = string
export type LlmApiMode =
  | 'anthropic-messages'
  | 'openai-responses'
  | 'openai-chat'
  | 'custom'
export type LlmAuthStrategy =
  | 'api_key'
  | 'oauth_refreshable'
  | 'oauth_external'
  | 'external_process'
  | 'hybrid'
  | 'unknown'
export type LlmInputModality = 'text' | 'image' | 'file' | 'audio' | 'video'
export type LlmOutputModality = 'text' | 'image' | 'audio' | 'file' | 'video'
export type LlmModelCapabilitySource =
  | 'builtin'
  | 'profile_override'
  | 'default'
export type LlmToolSchemaStyle =
  | 'json_schema_function'
  | 'anthropic_input_schema'
  | 'gemini_function_declarations'
export type LlmToolResultStyle =
  | 'tool_role_with_tool_call_id'
  | 'anthropic_tool_result_block'
  | 'gemini_function_response'
  | 'function_call_output'
export type LlmProviderToolProfileSource =
  | 'builtin'
  | 'api_mode_default'
  | 'disabled_default'
export type LlmToolCapabilitySupport = boolean | 'beta' | 'unknown'
export type LlmProviderCapabilityToolSource =
  | 'builtin'
  | 'provider_metadata'
  | 'runtime_provider'
  | 'disabled_default'
export type LlmProviderCapabilityToolRoute =
  | 'same_provider'
  | 'explicit_cross_provider'
export type LlmProviderCapabilityDataBoundary =
  | 'same_provider'
  | 'explicit_cross_provider'

export interface LlmImageCapabilityLimits {
  maxImages?: number
  maxImageBytes?: number
  mimeTypes?: readonly string[]
}

export interface LlmModelCapabilityOverride {
  inputModalities?: readonly LlmInputModality[]
  outputModalities?: readonly LlmOutputModality[]
  tools?: boolean
  structuredOutput?: boolean
  image?: LlmImageCapabilityLimits
  reason?: string
}

export interface LlmModelCapabilities {
  inputModalities: readonly LlmInputModality[]
  outputModalities: readonly LlmOutputModality[]
  tools: boolean
  structuredOutput: boolean
  source: LlmModelCapabilitySource
  reason: string
  baseSource?: LlmModelCapabilitySource
  image?: LlmImageCapabilityLimits
}

export type LlmMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export type LlmTextPart = CcrTextContentBlock

export type LlmThinkingPart = CcrThinkingContentBlock

export type LlmToolCallPart = CcrToolCallContentBlock

export type LlmToolResultPart = CcrToolResultContentBlock & {
  toolCallId: string
  result: unknown
}

export type LlmImageSource = CcrContentSource

export type LlmImagePart = CcrImageContentBlock & {
  mimeType: string
}

export type LlmVideoSource = CcrContentSource

export type LlmVideoPart = CcrVideoContentBlock & {
  mimeType: string
}

export type LlmContentPart =
  | LlmTextPart
  | LlmThinkingPart
  | LlmToolCallPart
  | LlmToolResultPart
  | LlmImagePart
  | LlmVideoPart

export interface LlmToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface LlmMessage {
  role: LlmMessageRole
  parts: readonly LlmContentPart[]
  name?: string
}

export interface LlmUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
  raw?: unknown
}

export interface LlmProviderCapabilities {
  streaming: boolean
  tools: boolean
  reasoning: boolean
  usage: boolean
}

export interface LlmProviderCapabilityToolStatus {
  available: boolean
  toolName: string
  provider: LlmProviderId
  providerDisplayName: string
  model: LlmModelId
  source: LlmProviderCapabilityToolSource
  route: LlmProviderCapabilityToolRoute
  dataBoundary: LlmProviderCapabilityDataBoundary
  message: string
  reason?: string
}

export interface LlmProviderCapabilityTools {
  imageGeneration: LlmProviderCapabilityToolStatus
}

export interface LlmProviderToolProfile {
  providerId: LlmProviderId
  apiMode: LlmApiMode
  source: LlmProviderToolProfileSource
  modelPattern?: string
  toolCalling: {
    supported: boolean
    schemaStyle: LlmToolSchemaStyle
    resultStyle: LlmToolResultStyle
    requiresCallId: boolean
    supportsParallelCalls: boolean | 'unknown'
    supportsStrictSchema: LlmToolCapabilitySupport
    supportsDeferredToolSearch: boolean | 'unknown'
    coreToolsAlwaysInline: readonly string[]
    strictSchemaLimits?: {
      additionalPropertiesFalseRequired?: boolean
      allObjectPropertiesRequired?: boolean
      unsupportedKeywords?: readonly string[]
    }
  }
}

export interface LlmProviderDefinition {
  id: LlmProviderId
  displayName: string
  apiMode: LlmApiMode
  authStrategy: LlmAuthStrategy
  capabilities: Readonly<LlmProviderCapabilities>
}

export interface LlmModelCatalogEntry {
  provider: LlmProviderId
  model: LlmModelId
  displayName: string
  contextWindow: number
  maxOutputTokens: number
  supportsReasoning: boolean
  supportsTools: boolean
  inputModalities: readonly LlmInputModality[]
  modelCapabilities?: LlmModelCapabilities
  metadata?: Readonly<Record<string, unknown>>
}

export type LlmStopReason =
  | 'stop'
  | 'max_tokens'
  | 'tool_use'
  | 'cancelled'
  | 'error'
  | 'other'

export interface LlmGenerateRequest {
  provider: LlmProviderId
  model: LlmModelId
  profileId?: string
  messages: readonly LlmMessage[]
  tools?: readonly LlmToolDefinition[]
  maxOutputTokens?: number
  temperature?: number
  metadata?: Readonly<Record<string, unknown>>
  signal?: AbortSignal
}

export interface LlmGenerateResponse {
  provider: LlmProviderId
  model: LlmModelId
  output: readonly LlmContentPart[]
  stopReason: LlmStopReason
  usage?: LlmUsage
  raw?: unknown
}

export type LlmImageGenerationSize =
  | 'auto'
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '256x256'
  | '512x512'
  | string

export type LlmImageGenerationQuality =
  | 'auto'
  | 'low'
  | 'medium'
  | 'high'
  | 'standard'
  | 'hd'
  | string

export type LlmImageGenerationOutputFormat =
  | 'png'
  | 'jpeg'
  | 'webp'
  | string

export type LlmImageGenerationResponseFormat = 'b64_json' | 'url'

export interface LlmImageGenerationRequest {
  provider: LlmProviderId
  model: LlmModelId
  profileId?: string
  prompt: string
  sessionId: string
  outputId?: string
  ccrHome?: string
  size?: LlmImageGenerationSize
  quality?: LlmImageGenerationQuality
  outputFormat?: LlmImageGenerationOutputFormat
  responseFormat?: LlmImageGenerationResponseFormat
  n?: number
  metadata?: Readonly<Record<string, unknown>>
  signal?: AbortSignal
}

export interface LlmImageGenerationResponse {
  provider: LlmProviderId
  model: LlmModelId
  output: readonly CcrImageContentBlock[]
  generatedArtifacts: readonly CcrGeneratedArtifactSnapshot[]
  raw?: unknown
}

export interface LlmResponseStartEvent {
  type: 'response_start'
  provider: LlmProviderId
  model: LlmModelId
}

export interface LlmContentPartEvent {
  type: 'content_part'
  provider: LlmProviderId
  model: LlmModelId
  contentIndex?: number
  part: LlmContentPart
}

export interface LlmThinkingStartEvent {
  type: 'thinking_start'
  provider: LlmProviderId
  model: LlmModelId
  contentIndex?: number
}

export interface LlmThinkingDeltaEvent {
  type: 'thinking_delta'
  provider: LlmProviderId
  model: LlmModelId
  contentIndex?: number
  delta: string
}

export interface LlmThinkingEndEvent {
  type: 'thinking_end'
  provider: LlmProviderId
  model: LlmModelId
  contentIndex?: number
  content: string
}

export interface LlmResponseCompleteEvent {
  type: 'response_complete'
  provider: LlmProviderId
  model: LlmModelId
  response: LlmGenerateResponse
}

export interface LlmResponseErrorEvent {
  type: 'response_error'
  provider: LlmProviderId
  model: LlmModelId
  error: unknown
}

export type LlmGenerateEvent =
  | LlmResponseStartEvent
  | LlmContentPartEvent
  | LlmThinkingStartEvent
  | LlmThinkingDeltaEvent
  | LlmThinkingEndEvent
  | LlmResponseCompleteEvent
  | LlmResponseErrorEvent

export interface LlmProvider {
  readonly name: LlmProviderId
  readonly definition?: LlmProviderDefinition
  readonly supportsStreaming?: boolean
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>
  generateImage?(
    request: LlmImageGenerationRequest,
  ): Promise<LlmImageGenerationResponse>
  stream?(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent>
}
