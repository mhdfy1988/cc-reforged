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
export type LlmInputModality = 'text' | 'image' | 'audio'

export type LlmMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface LlmTextPart {
  type: 'text'
  text: string
}

export interface LlmToolCallPart {
  type: 'tool_call'
  id: string
  name: string
  input: unknown
}

export interface LlmToolResultPart {
  type: 'tool_result'
  toolCallId: string
  toolName?: string
  result: unknown
  isError?: boolean
}

export type LlmContentPart =
  | LlmTextPart
  | LlmToolCallPart
  | LlmToolResultPart

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

export interface LlmResponseStartEvent {
  type: 'response_start'
  provider: LlmProviderId
  model: LlmModelId
}

export interface LlmContentPartEvent {
  type: 'content_part'
  provider: LlmProviderId
  model: LlmModelId
  part: LlmContentPart
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
  | LlmResponseCompleteEvent
  | LlmResponseErrorEvent

export interface LlmProvider {
  readonly name: LlmProviderId
  readonly definition?: LlmProviderDefinition
  readonly supportsStreaming?: boolean
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>
  stream?(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent>
}
