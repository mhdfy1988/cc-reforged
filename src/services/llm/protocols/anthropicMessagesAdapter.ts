import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import type {
  ContentBlockParam,
  Message,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  MessageParam,
  RawMessageStreamEvent,
  StopReason,
  Tool,
  ToolUnion,
  Usage,
} from '@anthropic-ai/sdk/resources/index.mjs'
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

export interface AnthropicMessagesAdapterOptions {
  providerId: string
  providerLabel: string
  apiKey?: string
  baseUrl: string
  defaultModel: string
  defaultMaxOutputTokens?: number
  missingApiKeyMessage?: string
  fetchImpl?: ClientOptions['fetch']
}

interface AnthropicToolCallDraft {
  id: string
  name: string
  input: unknown
  partialJson: string
}

interface AnthropicThinkingDraft {
  thinking: string
  signature?: string
  redacted?: boolean
}

export class AnthropicMessagesAdapter {
  readonly #providerId: string
  readonly #providerLabel: string
  readonly #apiKey?: string
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #defaultMaxOutputTokens: number
  readonly #missingApiKeyMessage: string
  readonly #fetchImpl?: ClientOptions['fetch']

  constructor(options: AnthropicMessagesAdapterOptions) {
    this.#providerId = options.providerId
    this.#providerLabel = options.providerLabel
    this.#apiKey = options.apiKey?.trim()
    this.#baseUrl = normalizeBaseUrl(options.baseUrl)
    this.#defaultModel = options.defaultModel
    this.#defaultMaxOutputTokens = options.defaultMaxOutputTokens ?? 4096
    this.#missingApiKeyMessage =
      options.missingApiKeyMessage ??
      `${options.providerLabel} API key is missing.`
    this.#fetchImpl = options.fetchImpl
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const body = this.#toMessageRequest(request, false)
    const raw = await this.#createClient().messages.create(body, {
      signal: request.signal,
    })
    return toGenerateResponse({
      provider: this.#providerId,
      fallbackModel: request.model || this.#defaultModel,
      raw,
      emptyOutputMessage: `${this.#providerLabel} provider returned no usable content.`,
    })
  }

  async *stream(request: LlmGenerateRequest): AsyncIterable<LlmGenerateEvent> {
    const body = this.#toMessageRequest(request, true)
    const stream = await this.#createClient().messages.create(body, {
      signal: request.signal,
    })
    const emittedEvents: LlmGenerateEvent[] = []
    const response = await toStreamedResponse({
      provider: this.#providerId,
      fallbackModel: request.model || this.#defaultModel,
      stream,
      emit: event => {
        emittedEvents.push(event)
      },
    })

    for (const event of emittedEvents) {
      yield event
    }
    yield {
      type: 'response_complete',
      provider: this.#providerId,
      model: response.model,
      response,
    }
  }

  #createClient(): Anthropic {
    configureGlobalFetchDispatcher()
    const apiKey = this.#apiKey?.trim()
    if (!apiKey) {
      throw new Error(this.#missingApiKeyMessage)
    }
    return new Anthropic({
      apiKey,
      baseURL: this.#baseUrl,
      maxRetries: 0,
      timeout: 600000,
      ...(this.#fetchImpl ? { fetch: this.#fetchImpl } : {}),
    })
  }

  #toMessageRequest(
    request: LlmGenerateRequest,
    stream: false,
  ): MessageCreateParamsNonStreaming
  #toMessageRequest(
    request: LlmGenerateRequest,
    stream: true,
  ): MessageCreateParamsStreaming
  #toMessageRequest(
    request: LlmGenerateRequest,
    stream: boolean,
  ): MessageCreateParamsNonStreaming | MessageCreateParamsStreaming {
    const model = request.model?.trim() || this.#defaultModel
    const mapped = toAnthropicMessages(request.messages)
    const maxTokens =
      typeof request.maxOutputTokens === 'number'
        ? request.maxOutputTokens
        : this.#defaultMaxOutputTokens
    return {
      model,
      messages: mapped.messages,
      max_tokens: maxTokens,
      stream,
      ...(mapped.system ? { system: mapped.system } : {}),
      ...(typeof request.temperature === 'number'
        ? { temperature: clampTemperature(request.temperature) }
        : {}),
      ...(request.tools && request.tools.length > 0
        ? {
            tools: toAnthropicTools(request.tools),
            tool_choice: { type: 'auto' },
          }
        : {}),
    }
  }
}

async function toStreamedResponse(input: {
  provider: string
  fallbackModel: string
  stream: AsyncIterable<RawMessageStreamEvent>
  emit: (event: LlmGenerateEvent) => void
}): Promise<LlmGenerateResponse> {
  const outputByIndex = new Map<number, LlmContentPart>()
  const textDrafts = new Map<number, string>()
  const thinkingDrafts = new Map<number, AnthropicThinkingDraft>()
  const toolDrafts = new Map<number, AnthropicToolCallDraft>()
  let responseId: string | undefined
  let responseModel = input.fallbackModel
  let usage: LlmUsage | undefined
  let stopReason: LlmStopReason = 'other'

  for await (const event of input.stream) {
    switch (event.type) {
      case 'message_start':
        responseId = event.message.id
        responseModel = event.message.model || responseModel
        usage = event.message.usage
          ? toLlmUsage(event.message.usage)
          : usage
        break
      case 'content_block_start':
        handleContentBlockStart(event, {
          provider: input.provider,
          model: responseModel,
          textDrafts,
          thinkingDrafts,
          toolDrafts,
          outputByIndex,
          emit: input.emit,
        })
        break
      case 'content_block_delta':
        handleContentBlockDelta(event, {
          provider: input.provider,
          model: responseModel,
          textDrafts,
          thinkingDrafts,
          toolDrafts,
          emit: input.emit,
        })
        break
      case 'content_block_stop':
        handleContentBlockStop(event.index, {
          provider: input.provider,
          model: responseModel,
          textDrafts,
          thinkingDrafts,
          toolDrafts,
          outputByIndex,
          emit: input.emit,
        })
        break
      case 'message_delta':
        stopReason = mapStopReason(event.delta.stop_reason)
        usage = toLlmUsage(event.usage)
        break
      case 'message_stop':
        break
    }
  }

  const output = Array.from(outputByIndex.entries())
    .sort(([left], [right]) => left - right)
    .map(([, part]) => part)

  return {
    provider: input.provider,
    model: responseModel,
    output,
    stopReason,
    usage,
    raw: {
      id: responseId,
      protocol: 'anthropic-messages',
    },
  }
}

function handleContentBlockStart(
  event: Extract<RawMessageStreamEvent, { type: 'content_block_start' }>,
  state: {
    provider: string
    model: string
    textDrafts: Map<number, string>
    thinkingDrafts: Map<number, AnthropicThinkingDraft>
    toolDrafts: Map<number, AnthropicToolCallDraft>
    outputByIndex: Map<number, LlmContentPart>
    emit: (event: LlmGenerateEvent) => void
  },
): void {
  const { index, content_block: block } = event
  if (block.type === 'text') {
    const text = block.text || ''
    state.textDrafts.set(index, text)
    if (text) {
      state.emit({
        type: 'content_part',
        provider: state.provider,
        model: state.model,
        contentIndex: index,
        part: { type: 'text', text },
      })
    }
    return
  }
  if (block.type === 'thinking') {
    state.thinkingDrafts.set(index, {
      thinking: block.thinking || '',
      signature: block.signature,
    })
    state.emit({
      type: 'thinking_start',
      provider: state.provider,
      model: state.model,
      contentIndex: index,
    })
    if (block.thinking) {
      state.emit({
        type: 'thinking_delta',
        provider: state.provider,
        model: state.model,
        contentIndex: index,
        delta: block.thinking,
      })
    }
    return
  }
  if (block.type === 'redacted_thinking') {
    const part: LlmContentPart = {
      type: 'thinking',
      thinking: '',
      redacted: true,
      signature: block.data,
    }
    state.outputByIndex.set(index, part)
    return
  }
  if (block.type === 'tool_use') {
    state.toolDrafts.set(index, {
      id: block.id,
      name: block.name,
      input: block.input,
      partialJson: '',
    })
  }
}

function handleContentBlockDelta(
  event: Extract<RawMessageStreamEvent, { type: 'content_block_delta' }>,
  state: {
    provider: string
    model: string
    textDrafts: Map<number, string>
    thinkingDrafts: Map<number, AnthropicThinkingDraft>
    toolDrafts: Map<number, AnthropicToolCallDraft>
    emit: (event: LlmGenerateEvent) => void
  },
): void {
  const { index, delta } = event
  if (delta.type === 'text_delta') {
    state.textDrafts.set(index, (state.textDrafts.get(index) || '') + delta.text)
    state.emit({
      type: 'content_part',
      provider: state.provider,
      model: state.model,
      contentIndex: index,
      part: { type: 'text', text: delta.text },
    })
    return
  }
  if (delta.type === 'thinking_delta') {
    const draft = state.thinkingDrafts.get(index) ?? { thinking: '' }
    draft.thinking += delta.thinking
    state.thinkingDrafts.set(index, draft)
    state.emit({
      type: 'thinking_delta',
      provider: state.provider,
      model: state.model,
      contentIndex: index,
      delta: delta.thinking,
    })
    return
  }
  if (delta.type === 'signature_delta') {
    const draft = state.thinkingDrafts.get(index) ?? { thinking: '' }
    draft.signature = delta.signature
    state.thinkingDrafts.set(index, draft)
    return
  }
  if (delta.type === 'input_json_delta') {
    const draft = state.toolDrafts.get(index)
    if (draft) {
      draft.partialJson += delta.partial_json
    }
  }
}

function handleContentBlockStop(
  index: number,
  state: {
    provider: string
    model: string
    textDrafts: Map<number, string>
    thinkingDrafts: Map<number, AnthropicThinkingDraft>
    toolDrafts: Map<number, AnthropicToolCallDraft>
    outputByIndex: Map<number, LlmContentPart>
    emit: (event: LlmGenerateEvent) => void
  },
): void {
  if (state.textDrafts.has(index)) {
    const text = state.textDrafts.get(index) || ''
    if (text) {
      state.outputByIndex.set(index, { type: 'text', text })
    }
    state.textDrafts.delete(index)
    return
  }

  const thinkingDraft = state.thinkingDrafts.get(index)
  if (thinkingDraft) {
    state.outputByIndex.set(index, {
      type: 'thinking',
      thinking: thinkingDraft.thinking,
      ...(thinkingDraft.signature
        ? { signature: thinkingDraft.signature }
        : {}),
      ...(thinkingDraft.redacted ? { redacted: true } : {}),
    })
    state.emit({
      type: 'thinking_end',
      provider: state.provider,
      model: state.model,
      contentIndex: index,
      content: thinkingDraft.thinking,
    })
    state.thinkingDrafts.delete(index)
    return
  }

  const toolDraft = state.toolDrafts.get(index)
  if (toolDraft) {
    const part: LlmContentPart = {
      type: 'tool_call',
      id: toolDraft.id,
      name: toolDraft.name,
      input: toolDraft.partialJson
        ? parseToolInput(toolDraft.partialJson)
        : toObject(toolDraft.input),
    }
    state.outputByIndex.set(index, part)
    state.emit({
      type: 'content_part',
      provider: state.provider,
      model: state.model,
      contentIndex: index,
      part,
    })
    state.toolDrafts.delete(index)
  }
}

function toAnthropicMessages(input: readonly LlmMessage[]): {
  system?: string
  messages: MessageParam[]
} {
  const systemParts: string[] = []
  const messages: MessageParam[] = []

  for (const message of input) {
    if (message.role === 'system') {
      const text = collectText(message.parts)
      if (text) {
        systemParts.push(text)
      }
      continue
    }

    if (message.role === 'tool') {
      const blocks = message.parts.flatMap(part => {
        if (part.type !== 'tool_result') {
          throw new Error(
            'Anthropic Messages adapter requires tool-role messages to contain only tool_result parts.',
          )
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: part.toolCallId,
          content: serializeToolResult(part.result),
          ...(typeof part.isError === 'boolean'
            ? { is_error: part.isError }
            : {}),
        }
      })
      pushAnthropicMessage(messages, {
        role: 'user',
        content: blocks,
      })
      continue
    }

    const content = toAnthropicContentBlocks(message)
    if (content.length === 0) {
      continue
    }
    pushAnthropicMessage(messages, {
      role: message.role,
      content,
    })
  }

  if (messages.length === 0) {
    throw new Error(
      'Anthropic Messages adapter requires at least one usable user or assistant message.',
    )
  }

  return {
    ...(systemParts.length > 0
      ? { system: systemParts.join('\n\n') }
      : {}),
    messages,
  }
}

function pushAnthropicMessage(
  messages: MessageParam[],
  next: MessageParam,
): void {
  const previous = messages[messages.length - 1]
  if (!previous || previous.role !== next.role) {
    messages.push(next)
    return
  }
  previous.content = [
    ...normalizeContentBlocks(previous.content),
    ...normalizeContentBlocks(next.content),
  ]
}

function toAnthropicContentBlocks(message: LlmMessage): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = []
  for (const part of message.parts) {
    if (part.type === 'text') {
      if (part.text.trim()) {
        blocks.push({ type: 'text', text: part.text })
      }
      continue
    }
    if (part.type === 'thinking') {
      if (part.redacted) {
        blocks.push({
          type: 'redacted_thinking',
          data: part.signature ?? part.thinking,
        })
        continue
      }
      blocks.push({
        type: 'thinking',
        thinking: part.thinking,
        signature: part.signature ?? '',
      })
      continue
    }
    if (part.type === 'tool_call') {
      blocks.push({
        type: 'tool_use',
        id: part.id,
        name: part.name,
        input: toObject(part.input),
      })
    }
  }
  return blocks
}

function normalizeContentBlocks(
  content: MessageParam['content'],
): ContentBlockParam[] {
  if (typeof content === 'string') {
    return content.trim() ? [{ type: 'text', text: content }] : []
  }
  return content
}

function collectText(parts: readonly LlmContentPart[]): string {
  return parts
    .filter((part): part is Extract<LlmContentPart, { type: 'text' }> =>
      part.type === 'text',
    )
    .map(part => part.text)
    .join('')
    .trim()
}

function toAnthropicTools(
  tools: readonly LlmToolDefinition[],
): ToolUnion[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: normalizeToolInputSchema(tool.inputSchema),
  }))
}

function normalizeToolInputSchema(
  schema: Record<string, unknown>,
): Tool.InputSchema {
  return {
    ...schema,
    type: 'object',
  } as Tool.InputSchema
}

function toGenerateResponse(input: {
  provider: string
  fallbackModel: string
  raw: Message
  emptyOutputMessage: string
}): LlmGenerateResponse {
  const output = input.raw.content.flatMap(block => toLlmContentPart(block))
  if (output.length === 0) {
    throw new Error(input.emptyOutputMessage)
  }
  return {
    provider: input.provider,
    model: input.raw.model || input.fallbackModel,
    output,
    stopReason: mapStopReason(input.raw.stop_reason),
    usage: toLlmUsage(input.raw.usage),
    raw: input.raw,
  }
}

function toLlmContentPart(
  block: Message['content'][number],
): LlmContentPart[] {
  if (block.type === 'text') {
    return block.text ? [{ type: 'text', text: block.text }] : []
  }
  if (block.type === 'thinking') {
    return [
      {
        type: 'thinking',
        thinking: block.thinking,
        signature: block.signature,
      },
    ]
  }
  if (block.type === 'redacted_thinking') {
    return [
      {
        type: 'thinking',
        thinking: '',
        redacted: true,
        signature: block.data,
      },
    ]
  }
  if (block.type === 'tool_use') {
    return [
      {
        type: 'tool_call',
        id: block.id,
        name: block.name,
        input: toObject(block.input),
      },
    ]
  }
  return []
}

function toLlmUsage(
  usage: Pick<
    Usage,
    | 'cache_creation_input_tokens'
    | 'cache_read_input_tokens'
    | 'input_tokens'
    | 'output_tokens'
  >,
): LlmUsage {
  const cacheCreation = usage.cache_creation_input_tokens ?? undefined
  const cacheRead = usage.cache_read_input_tokens ?? undefined
  const inputTokens = usage.input_tokens ?? 0
  const outputTokens = usage.output_tokens
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens +
      outputTokens +
      (cacheCreation ?? 0) +
      (cacheRead ?? 0),
    cacheCreationInputTokens: cacheCreation,
    cacheReadInputTokens: cacheRead,
    raw: usage,
  }
}

function mapStopReason(reason: StopReason | null | undefined): LlmStopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop'
    case 'max_tokens':
      return 'max_tokens'
    case 'tool_use':
      return 'tool_use'
    case 'pause_turn':
    case 'refusal':
      return 'other'
    default:
      return 'other'
  }
}

function parseToolInput(value: string): Record<string, unknown> {
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

function clampTemperature(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
}
