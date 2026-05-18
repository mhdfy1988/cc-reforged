import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js'
import { toOpenAiImageUrl } from '../imageContent.js'
import {
  isOpenAiChatToolResultProfile,
  resolveProviderToolProfile,
} from '../toolProtocolProfile.js'
import type {
  LlmContentPart,
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmMessage,
  LlmProviderToolProfile,
  LlmStopReason,
  LlmToolDefinition,
  LlmUsage,
} from '../types.js'

export type OpenAiChatThinkingType = 'enabled' | 'disabled'
export type OpenAiChatReasoningEffort = 'high' | 'max'
export type OpenAiChatOutputTokenParam =
  | 'max_tokens'
  | 'max_completion_tokens'

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: OpenAiChatMessageContent
  name?: string
  reasoning_content?: string
  tool_call_id?: string
  tool_calls?: OpenAiChatToolCall[]
}

type OpenAiChatMessageContent = string | null | OpenAiChatContentPart[]

type OpenAiChatContentPart =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'image_url'
      image_url: {
        url: string
      }
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
  outputTokenParam?: OpenAiChatOutputTokenParam
  outputTokenLimit?: number
  includeStreamUsage?: boolean
  includeTools?: boolean
  mergeSystemMessages?: boolean
  toolProfile?: LlmProviderToolProfile
  missingApiKeyMessage?: string
  fetchImpl?: typeof fetch
  resolveTemperature?: (input: {
    request: LlmGenerateRequest
    model: string
  }) => number | undefined
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
  readonly #outputTokenParam: OpenAiChatOutputTokenParam
  readonly #outputTokenLimit?: number
  readonly #includeStreamUsage: boolean
  readonly #includeTools: boolean
  readonly #mergeSystemMessages: boolean
  readonly #toolProfile?: LlmProviderToolProfile
  readonly #missingApiKeyMessage: string
  readonly #fetchImpl: typeof fetch
  readonly #resolveTemperature: NonNullable<
    OpenAiChatCompletionsAdapterOptions['resolveTemperature']
  >
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
    this.#outputTokenParam = options.outputTokenParam ?? 'max_tokens'
    this.#outputTokenLimit = options.outputTokenLimit
    this.#includeStreamUsage = options.includeStreamUsage ?? true
    this.#includeTools = options.includeTools ?? true
    this.#mergeSystemMessages = options.mergeSystemMessages ?? false
    this.#toolProfile = options.toolProfile
    this.#missingApiKeyMessage =
      options.missingApiKeyMessage ??
      `${options.providerLabel} API key is missing.`
    this.#fetchImpl = options.fetchImpl || fetch
    this.#resolveTemperature =
      options.resolveTemperature ??
      (({ request }) => request.temperature)
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

    const requestBody = await toRequestBody({
      request,
      defaultModel: this.#defaultModel,
      defaultReasoningEffort: this.#defaultReasoningEffort,
      outputTokenParam: this.#outputTokenParam,
      outputTokenLimit: this.#outputTokenLimit,
      includeStreamUsage: this.#includeStreamUsage,
      includeTools: this.#includeTools,
      mergeSystemMessages: this.#mergeSystemMessages,
      providerId: this.#providerId,
      toolProfile: this.#toolProfile,
      resolveTemperature: this.#resolveTemperature,
      resolveThinking: this.#resolveThinking,
      stream,
    })
    const response = await this.#fetchImpl(resolveChatCompletionsUrl(this.#baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: request.signal,
    })

    if (!response.ok) {
      throw new Error(
        await getProviderErrorMessage(response, this.#providerLabel, {
          requestBody,
          includeRequestDiagnostics: true,
        }),
      )
    }
    return response
  }
}

async function toRequestBody(input: {
  request: LlmGenerateRequest
  defaultModel: string
  defaultReasoningEffort: OpenAiChatReasoningEffort
  outputTokenParam: OpenAiChatOutputTokenParam
  outputTokenLimit?: number
  includeStreamUsage: boolean
  includeTools: boolean
  mergeSystemMessages: boolean
  providerId: string
  toolProfile?: LlmProviderToolProfile
  resolveTemperature: NonNullable<
    OpenAiChatCompletionsAdapterOptions['resolveTemperature']
  >
  resolveThinking: NonNullable<
    OpenAiChatCompletionsAdapterOptions['resolveThinking']
  >
  stream: boolean
}): Promise<Record<string, unknown>> {
  const model = input.request.model?.trim() || input.defaultModel
  const toolProfile =
    input.toolProfile ??
    resolveProviderToolProfile({
      providerId: input.providerId,
      apiMode: 'openai-chat',
      model,
    })
  const thinking = input.resolveThinking({
    request: input.request,
    model,
  })
  const outputTokens = resolveOutputTokens(
    input.request.maxOutputTokens,
    input.outputTokenLimit,
  )
  const temperature = input.resolveTemperature({
    request: input.request,
    model,
  })
  return {
    model,
    messages: await toOpenAiChatMessages(input.request.messages, {
      mergeSystemMessages: input.mergeSystemMessages,
      toolProfile,
    }),
    stream: input.stream,
    ...(input.stream && input.includeStreamUsage
      ? { stream_options: { include_usage: true } }
      : {}),
    ...(typeof outputTokens === 'number'
      ? { [input.outputTokenParam]: outputTokens }
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
      : typeof temperature === 'number'
        ? { temperature }
        : {}),
    ...(input.includeTools &&
    toolProfile.toolCalling.supported &&
    input.request.tools &&
    input.request.tools.length > 0
      ? {
          tools: toOpenAiChatTools(input.request.tools),
          tool_choice: 'auto',
        }
      : {}),
  }
}

function resolveOutputTokens(
  maxOutputTokens: number | undefined,
  outputTokenLimit: number | undefined,
): number | undefined {
  if (typeof maxOutputTokens !== 'number') {
    return undefined
  }
  return typeof outputTokenLimit === 'number'
    ? Math.min(maxOutputTokens, outputTokenLimit)
    : maxOutputTokens
}

async function toOpenAiChatMessages(
  messages: readonly LlmMessage[],
  options: {
    mergeSystemMessages?: boolean
    toolProfile?: LlmProviderToolProfile
  } = {},
): Promise<OpenAiChatMessage[]> {
  const mapped: OpenAiChatMessage[] = []
  const mergedSystemParts: string[] = []

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

    if (message.role === 'user') {
      const content = await toOpenAiUserContent(message.parts)
      if (!content) {
        continue
      }
      mapped.push({
        role: 'user',
        content,
        ...(message.name?.trim() ? { name: message.name.trim() } : {}),
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
    if (message.role === 'system' && options.mergeSystemMessages) {
      mergedSystemParts.push(content)
      continue
    }
    mapped.push({
      role: message.role,
      content,
      ...(message.name?.trim() ? { name: message.name.trim() } : {}),
    })
  }

  if (mergedSystemParts.length > 0) {
    mapped.unshift({
      role: 'system',
      content: mergedSystemParts.join('\n\n'),
    })
  }

  if (mapped.length === 0) {
    throw new Error(
      'OpenAI Chat Completions adapter requires at least one usable message.',
    )
  }

  const toolProfile =
    options.toolProfile ??
    resolveProviderToolProfile({
      providerId: 'openai-chat-compatible',
      apiMode: 'openai-chat',
    })
  const repaired = isOpenAiChatToolResultProfile(toolProfile)
    ? repairOpenAiToolMessageSequence(mapped)
    : mapped.filter(message => message.role !== 'tool')
  if (repaired.length === 0) {
    throw new Error(
      'OpenAI Chat Completions adapter requires at least one usable message.',
    )
  }
  return repaired
}

function repairOpenAiToolMessageSequence(
  messages: readonly OpenAiChatMessage[],
): OpenAiChatMessage[] {
  const repaired: OpenAiChatMessage[] = []

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    const toolCalls =
      message.role === 'assistant' && Array.isArray(message.tool_calls)
        ? message.tool_calls
        : []

    if (message.role !== 'assistant' || toolCalls.length === 0) {
      if (message.role !== 'tool') {
        repaired.push(message)
      }
      continue
    }

    repaired.push(message)

    const matched = new Map<string, OpenAiChatMessage>()
    let cursor = index + 1
    while (cursor < messages.length && messages[cursor].role === 'tool') {
      const toolMessage = messages[cursor]
      const toolCallId = toolMessage.tool_call_id
      if (
        typeof toolCallId === 'string' &&
        toolCallId &&
        !matched.has(toolCallId)
      ) {
        matched.set(toolCallId, toolMessage)
      }
      cursor += 1
    }

    for (const toolCall of toolCalls) {
      repaired.push(
        matched.get(toolCall.id) ??
          createInterruptedToolResultMessage(toolCall),
      )
    }

    index = cursor - 1
  }

  return repaired
}

function createInterruptedToolResultMessage(
  toolCall: OpenAiChatToolCall,
): OpenAiChatMessage {
  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    content: JSON.stringify({
      status: 'error',
      code: 'TOOL_CALL_INTERRUPTED',
      message:
        '工具调用被中断，或历史记录中缺少对应的工具结果。CCR 已补齐占位结果以恢复会话连续性。',
      toolName: toolCall.function.name,
    }),
  }
}

async function toOpenAiUserContent(
  parts: readonly LlmContentPart[],
): Promise<OpenAiChatMessageContent | undefined> {
  const contentParts: OpenAiChatContentPart[] = []
  let textBuffer = ''
  let hasImage = false

  const flushText = () => {
    const text = textBuffer.trim()
    if (text) {
      contentParts.push({ type: 'text', text })
    }
    textBuffer = ''
  }

  for (const part of parts) {
    if (part.type === 'text') {
      textBuffer += part.text
      continue
    }
    if (part.type === 'image') {
      hasImage = true
      flushText()
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: await toOpenAiImageUrl(part),
        },
      })
    }
  }

  if (!hasImage) {
    const text = textBuffer.trim()
    return text || undefined
  }

  flushText()
  return contentParts.length > 0 ? contentParts : undefined
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
  options: {
    requestBody?: Record<string, unknown>
    includeRequestDiagnostics?: boolean
  } = {},
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
  const message = `${providerLabel} API request failed (${response.status} ${
    response.statusText
  })${detail ? `: ${detail}` : '.'}`
  if (!options.includeRequestDiagnostics || !options.requestBody) {
    return message
  }
  return `${message}; requestDiagnostics=${JSON.stringify(
    toSafeRequestDiagnostics(options.requestBody),
  )}`
}

function toSafeRequestDiagnostics(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const messages = Array.isArray(body.messages)
    ? body.messages.filter(
        (message): message is Record<string, unknown> =>
          !!message && typeof message === 'object' && !Array.isArray(message),
      )
    : []
  const roleCounts: Record<string, number> = {}
  let totalTextChars = 0
  let emptyContentCount = 0
  let nonStringContentCount = 0
  let contentPartCount = 0
  let imageContentPartCount = 0
  let assistantToolCallCount = 0
  let toolMessageCount = 0
  let reasoningContentCount = 0

  for (const message of messages) {
    const role =
      typeof message.role === 'string' ? message.role : 'unknown'
    roleCounts[role] = (roleCounts[role] || 0) + 1
    if (role === 'tool') {
      toolMessageCount += 1
    }
    if (Array.isArray(message.tool_calls)) {
      assistantToolCallCount += message.tool_calls.length
    }
    if (typeof message.reasoning_content === 'string') {
      reasoningContentCount += 1
    }
    if (typeof message.content === 'string') {
      totalTextChars += message.content.length
      if (!message.content.trim()) {
        emptyContentCount += 1
      }
      continue
    }
    if (Array.isArray(message.content)) {
      nonStringContentCount += 1
      for (const part of message.content) {
        if (!part || typeof part !== 'object' || Array.isArray(part)) {
          continue
        }
        contentPartCount += 1
        const type = (part as { type?: unknown }).type
        if (
          type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          totalTextChars += (part as { text: string }).text.length
        }
        if (type === 'image_url') {
          imageContentPartCount += 1
        }
      }
      continue
    }
    if (message.content === null) {
      emptyContentCount += 1
      continue
    }
    nonStringContentCount += 1
  }

  return {
    keys: Object.keys(body).sort(),
    model: body.model,
    stream: body.stream,
    max_tokens: body.max_tokens,
    max_completion_tokens: body.max_completion_tokens,
    temperature: body.temperature,
    top_p: body.top_p,
    hasThinking: hasOwn(body, 'thinking'),
    reasoning_effort: body.reasoning_effort,
    hasStreamOptions: hasOwn(body, 'stream_options'),
    hasToolChoice: hasOwn(body, 'tool_choice'),
    toolCount: Array.isArray(body.tools) ? body.tools.length : 0,
    messageCount: messages.length,
    roleCounts,
    firstRoles: messages
      .slice(0, 8)
      .map(message => message.role)
      .filter(role => typeof role === 'string'),
    lastRoles: messages
      .slice(-8)
      .map(message => message.role)
      .filter(role => typeof role === 'string'),
    totalTextChars,
    emptyContentCount,
    nonStringContentCount,
    contentPartCount,
    imageContentPartCount,
    assistantToolCallCount,
    toolMessageCount,
    reasoningContentCount,
  }
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}
