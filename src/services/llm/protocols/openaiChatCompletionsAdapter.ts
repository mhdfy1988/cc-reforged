import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js'
import type {
  LlmContentPart,
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmMessage,
  LlmStopReason,
  LlmToolDefinition,
  LlmUsage,
} from '../types.js'

export type OpenAiChatThinkingType = 'enabled' | 'disabled'
export type OpenAiChatReasoningEffort = 'high' | 'max'

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  reasoning_content?: string
  tool_call_id?: string
  tool_calls?: OpenAiChatToolCall[]
}

interface OpenAiChatToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OpenAiChatCompletion {
  id?: string
  model?: string
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: OpenAiChatToolCall[] | null
    }
  }>
  usage?: OpenAiChatUsage
}

interface OpenAiChatUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

interface OpenAiChatStreamChunk {
  id?: string
  model?: string
  choices?: Array<{
    finish_reason?: string | null
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: Array<{
        index?: number
        id?: string
        type?: 'function'
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
  }>
  usage?: OpenAiChatUsage | null
}

interface OpenAiChatToolCallDraft {
  id: string
  name: string
  argumentsText: string
}

export interface OpenAiChatCompletionsAdapterOptions {
  providerId: string
  providerLabel: string
  apiKey?: string
  baseUrl: string
  defaultModel: string
  defaultReasoningEffort?: OpenAiChatReasoningEffort
  includeStreamUsage?: boolean
  missingApiKeyMessage?: string
  fetchImpl?: typeof fetch
  resolveThinking?: (input: {
    request: LlmGenerateRequest
    model: string
  }) => OpenAiChatThinkingType | undefined
}

export class OpenAiChatCompletionsAdapter {
  readonly #providerId: string
  readonly #providerLabel: string
  readonly #apiKey?: string
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #defaultReasoningEffort: OpenAiChatReasoningEffort
  readonly #includeStreamUsage: boolean
  readonly #missingApiKeyMessage: string
  readonly #fetchImpl: typeof fetch
  readonly #resolveThinking: NonNullable<
    OpenAiChatCompletionsAdapterOptions['resolveThinking']
  >

  constructor(options: OpenAiChatCompletionsAdapterOptions) {
    this.#providerId = options.providerId
    this.#providerLabel = options.providerLabel
    this.#apiKey = options.apiKey?.trim()
    this.#baseUrl = normalizeBaseUrl(options.baseUrl)
    this.#defaultModel = options.defaultModel
    this.#defaultReasoningEffort =
      options.defaultReasoningEffort ?? 'high'
    this.#includeStreamUsage = options.includeStreamUsage ?? true
    this.#missingApiKeyMessage =
      options.missingApiKeyMessage ??
      `${options.providerLabel} API key is missing.`
    this.#fetchImpl = options.fetchImpl || fetch
    this.#resolveThinking = options.resolveThinking ?? (() => undefined)
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const response = await this.#postChatCompletion(request, false)
    const raw = (await response.json()) as OpenAiChatCompletion
    return toGenerateResponse({
      provider: this.#providerId,
      fallbackModel: request.model || this.#defaultModel,
      raw,
      emptyOutputMessage: `${this.#providerLabel} provider returned no usable content.`,
    })
  }

  async *stream(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent> {
    const response = await this.#postChatCompletion(request, true)
    if (!response.body) {
      throw new Error(
        `${this.#providerLabel} streaming response did not include a body.`,
      )
    }

    const output: LlmContentPart[] = []
    const toolCalls = new Map<number, OpenAiChatToolCallDraft>()
    const decoder = new TextDecoder()
    let buffer = ''
    let responseId: string | undefined
    let responseModel = request.model || this.#defaultModel
    let usage: LlmUsage | undefined
    let stopReason: LlmStopReason = 'other'
    let thinking = ''
    let content = ''
    let thinkingStarted = false
    let thinkingEnded = false
    let contentIndex = 0

    const endThinking = (): LlmGenerateEvent | null => {
      if (!thinkingStarted || thinkingEnded) {
        return null
      }
      thinkingEnded = true
      output.push({ type: 'thinking', thinking })
      contentIndex = 1
      return {
        type: 'thinking_end',
        provider: this.#providerId,
        model: responseModel,
        contentIndex: 0,
        content: thinking,
      }
    }

    for await (const chunkText of readSseChunks(response.body, decoder)) {
      buffer += chunkText
      const lines = buffer.split(/\r?\n/u)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) {
          continue
        }
        const data = trimmed.slice('data:'.length).trim()
        if (!data || data === '[DONE]') {
          continue
        }

        const chunk = JSON.parse(data) as OpenAiChatStreamChunk
        responseId = chunk.id || responseId
        responseModel = chunk.model || responseModel
        if (chunk.usage) {
          usage = toLlmUsage(chunk.usage)
        }

        for (const choice of chunk.choices ?? []) {
          if (choice.finish_reason) {
            stopReason = mapStopReason(choice.finish_reason)
          }
          const delta = choice.delta
          if (!delta) {
            continue
          }

          if (delta.reasoning_content) {
            if (!thinkingStarted) {
              thinkingStarted = true
              yield {
                type: 'thinking_start',
                provider: this.#providerId,
                model: responseModel,
                contentIndex: 0,
              }
            }
            thinking += delta.reasoning_content
            yield {
              type: 'thinking_delta',
              provider: this.#providerId,
              model: responseModel,
              contentIndex: 0,
              delta: delta.reasoning_content,
            }
          }

          if (delta.content) {
            const thinkingEndEvent = endThinking()
            if (thinkingEndEvent) {
              yield thinkingEndEvent
            }
            content += delta.content
            yield {
              type: 'content_part',
              provider: this.#providerId,
              model: responseModel,
              contentIndex,
              part: {
                type: 'text',
                text: delta.content,
              },
            }
          }

          for (const toolCall of delta.tool_calls ?? []) {
            const index = toolCall.index ?? toolCalls.size
            const draft =
              toolCalls.get(index) ??
              ({
                id: toolCall.id || `call_${index}`,
                name: '',
                argumentsText: '',
              } satisfies OpenAiChatToolCallDraft)
            draft.id = toolCall.id || draft.id
            draft.name = toolCall.function?.name || draft.name
            draft.argumentsText += toolCall.function?.arguments ?? ''
            toolCalls.set(index, draft)
          }
        }
      }
    }

    const thinkingEndEvent = endThinking()
    if (thinkingEndEvent) {
      yield thinkingEndEvent
    }
    if (content) {
      output.push({ type: 'text', text: content })
    }

    let nextIndex = output.length
    for (const draft of Array.from(toolCalls.values())) {
      const part: LlmContentPart = {
        type: 'tool_call',
        id: draft.id,
        name: draft.name || 'unknown_tool',
        input: parseToolArguments(draft.argumentsText),
      }
      output.push(part)
      yield {
        type: 'content_part',
        provider: this.#providerId,
        model: responseModel,
        contentIndex: nextIndex++,
        part,
      }
    }

    yield {
      type: 'response_complete',
      provider: this.#providerId,
      model: responseModel,
      response: {
        provider: this.#providerId,
        model: responseModel,
        output,
        stopReason,
        usage,
        raw: {
          id: responseId,
          diagnostics: {
            baseUrl: this.#baseUrl,
            protocol: 'openai-chat',
            toolCount: request.tools?.length || 0,
          },
        },
      },
    }
  }

  async #postChatCompletion(
    request: LlmGenerateRequest,
    stream: boolean,
  ): Promise<Response> {
    configureGlobalFetchDispatcher()
    const apiKey = this.#apiKey?.trim()
    if (!apiKey) {
      throw new Error(this.#missingApiKeyMessage)
    }

    const response = await this.#fetchImpl(resolveChatCompletionsUrl(this.#baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(toRequestBody({
        request,
        defaultModel: this.#defaultModel,
        defaultReasoningEffort: this.#defaultReasoningEffort,
        includeStreamUsage: this.#includeStreamUsage,
        resolveThinking: this.#resolveThinking,
        stream,
      })),
      signal: request.signal,
    })

    if (!response.ok) {
      throw new Error(await getProviderErrorMessage(response, this.#providerLabel))
    }
    return response
  }
}

function toRequestBody(input: {
  request: LlmGenerateRequest
  defaultModel: string
  defaultReasoningEffort: OpenAiChatReasoningEffort
  includeStreamUsage: boolean
  resolveThinking: NonNullable<
    OpenAiChatCompletionsAdapterOptions['resolveThinking']
  >
  stream: boolean
}): Record<string, unknown> {
  const model = input.request.model?.trim() || input.defaultModel
  const thinking = input.resolveThinking({
    request: input.request,
    model,
  })
  return {
    model,
    messages: toOpenAiChatMessages(input.request.messages),
    stream: input.stream,
    ...(input.stream && input.includeStreamUsage
      ? { stream_options: { include_usage: true } }
      : {}),
    ...(typeof input.request.maxOutputTokens === 'number'
      ? { max_tokens: input.request.maxOutputTokens }
      : {}),
    ...(thinking
      ? {
          thinking: {
            type: thinking,
          },
          reasoning_effort:
            resolveReasoningEffort(getMetadataReasoningEffort(input.request.metadata)) ||
            input.defaultReasoningEffort,
        }
      : typeof input.request.temperature === 'number'
        ? { temperature: input.request.temperature }
        : {}),
    ...(input.request.tools && input.request.tools.length > 0
      ? {
          tools: toOpenAiChatTools(input.request.tools),
          tool_choice: 'auto',
        }
      : {}),
  }
}

function toOpenAiChatMessages(
  messages: readonly LlmMessage[],
): OpenAiChatMessage[] {
  const mapped: OpenAiChatMessage[] = []

  for (const message of messages) {
    if (message.role === 'tool') {
      for (const part of message.parts) {
        if (part.type !== 'tool_result') {
          throw new Error(
            'OpenAI Chat Completions adapter requires tool-role messages to contain only tool_result parts.',
          )
        }
        mapped.push({
          role: 'tool',
          tool_call_id: part.toolCallId,
          content: serializeToolResult(part.result),
        })
      }
      continue
    }

    if (message.role === 'assistant') {
      let text = ''
      let reasoning = ''
      const toolCalls: OpenAiChatToolCall[] = []
      for (const part of message.parts) {
        if (part.type === 'text') {
          text += part.text
          continue
        }
        if (part.type === 'thinking' && !part.redacted) {
          reasoning += part.thinking
          continue
        }
        if (part.type === 'tool_call') {
          toolCalls.push({
            id: part.id,
            type: 'function',
            function: {
              name: part.name,
              arguments: JSON.stringify(toObject(part.input)),
            },
          })
        }
      }
      if (!text.trim() && !reasoning.trim() && toolCalls.length === 0) {
        continue
      }
      mapped.push({
        role: 'assistant',
        content: text || null,
        ...(reasoning ? { reasoning_content: reasoning } : {}),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      })
      continue
    }

    const content = message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('')
      .trim()
    if (!content) {
      continue
    }
    mapped.push({
      role: message.role,
      content,
      ...(message.name?.trim() ? { name: message.name.trim() } : {}),
    })
  }

  if (mapped.length === 0) {
    throw new Error(
      'OpenAI Chat Completions adapter requires at least one usable message.',
    )
  }
  return mapped
}

function toOpenAiChatTools(
  tools: readonly LlmToolDefinition[],
): Array<Record<string, unknown>> {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }))
}

function toGenerateResponse(input: {
  provider: string
  fallbackModel: string
  raw: OpenAiChatCompletion
  emptyOutputMessage: string
}): LlmGenerateResponse {
  const choice = input.raw.choices?.[0]
  const message = choice?.message
  const output: LlmContentPart[] = []
  const reasoning = message?.reasoning_content?.trim()
  if (reasoning) {
    output.push({ type: 'thinking', thinking: reasoning })
  }
  if (message?.content) {
    output.push({ type: 'text', text: message.content })
  }
  for (const toolCall of message?.tool_calls ?? []) {
    output.push({
      type: 'tool_call',
      id: toolCall.id,
      name: toolCall.function.name,
      input: parseToolArguments(toolCall.function.arguments),
    })
  }

  if (output.length === 0) {
    throw new Error(input.emptyOutputMessage)
  }

  return {
    provider: input.provider,
    model: input.raw.model || input.fallbackModel,
    output,
    stopReason: mapStopReason(choice?.finish_reason),
    usage: input.raw.usage ? toLlmUsage(input.raw.usage) : undefined,
    raw: input.raw,
  }
}

async function* readSseChunks(
  body: ReadableStream<Uint8Array>,
  decoder: TextDecoder,
): AsyncIterable<string> {
  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (value) {
        yield decoder.decode(value, { stream: true })
      }
    }
    const tail = decoder.decode()
    if (tail) {
      yield tail
    }
  } finally {
    reader.releaseLock()
  }
}

function parseToolArguments(value: string): Record<string, unknown> {
  const trimmed = value.trim()
  if (!trimmed) {
    return {}
  }
  try {
    return toObject(JSON.parse(trimmed))
  } catch {
    return { _raw: value }
  }
}

function serializeToolResult(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }
  if (result === null || result === undefined) {
    return ''
  }
  try {
    return JSON.stringify(result)
  } catch {
    return String(result)
  }
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function toLlmUsage(usage: OpenAiChatUsage): LlmUsage {
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    cacheReadInputTokens: usage.prompt_cache_hit_tokens,
    raw: usage,
  }
}

function mapStopReason(reason: string | null | undefined): LlmStopReason {
  switch (reason) {
    case 'stop':
      return 'stop'
    case 'length':
      return 'max_tokens'
    case 'tool_calls':
      return 'tool_use'
    case 'content_filter':
      return 'error'
    default:
      return 'other'
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
}

function resolveChatCompletionsUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl
  }
  return `${baseUrl}/chat/completions`
}

function resolveReasoningEffort(
  value: string | undefined,
): OpenAiChatReasoningEffort | undefined {
  if (!value) {
    return undefined
  }
  return value === 'max' || value === 'xhigh' ? 'max' : 'high'
}

function getMetadataReasoningEffort(
  metadata: LlmGenerateRequest['metadata'],
): string | undefined {
  const value = metadata?.reasoningEffort
  return typeof value === 'string' ? value : undefined
}

async function getProviderErrorMessage(
  response: Response,
  providerLabel: string,
): Promise<string> {
  const text = await response.text().catch(() => '')
  let detail = text.trim()
  try {
    const parsed = JSON.parse(text) as { error?: { message?: unknown } }
    if (typeof parsed.error?.message === 'string') {
      detail = parsed.error.message
    }
  } catch {
    // Preserve the raw response text when it is not JSON.
  }
  return `${providerLabel} API request failed (${response.status} ${
    response.statusText
  })${detail ? `: ${detail}` : '.'}`
}
