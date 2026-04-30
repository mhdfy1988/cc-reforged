import {
  complete as piComplete,
  getModel as piGetModel,
  stream as piStream,
  type AssistantMessage as PiAiAssistantMessage,
  type AssistantMessageEvent as PiAiAssistantMessageEvent,
  type Context as PiAiContext,
  type Message as PiAiMessage,
  type Model as PiAiModel,
  type ProviderStreamOptions as PiAiProviderStreamOptions,
  type SimpleStreamOptions as PiAiSimpleStreamOptions,
  type Tool as PiAiTool,
} from '@mariozechner/pi-ai'
import { getLlmProviderConfig } from '../llmConfig.js'
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js'
import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js'
import type {
  LlmContentPart,
  LlmGenerateEvent,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmMessage,
  LlmProvider,
  LlmToolDefinition,
  LlmToolResultPart,
  LlmUsage,
} from '../types.js'
import {
  CodexOAuthSession,
  type CodexOAuthAvailability,
  type CodexOAuthSessionOptions,
} from '../sessions/CodexOAuthSession.js'
import { createDefaultCodexOAuthSession } from '../sessions/defaultCodexOAuthSession.js'

type PiAiTransport = NonNullable<PiAiSimpleStreamOptions['transport']>
type PiAiComplete = typeof piComplete
type PiAiStream = typeof piStream
type PiAiGetModel = typeof piGetModel
type CodexReasoningEffort = 'low' | 'medium' | 'high'

const DEFAULT_BASE_URL = 'https://chatgpt.com/backend-api'
const DEFAULT_MODEL = 'gpt-5.4'
const DEFAULT_TRANSPORT: PiAiTransport = 'sse'
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant. Reply clearly and concisely.'

const EMPTY_PI_USAGE: PiAiAssistantMessage['usage'] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
}

export interface CodexOAuthProviderOptions {
  session?: CodexOAuthSession
  sessionOptions?: CodexOAuthSessionOptions
  baseUrl?: string
  defaultModel?: string
  defaultReasoningEffort?: CodexReasoningEffort
  defaultTransport?: PiAiTransport
  defaultSystemPrompt?: string
  completeImpl?: PiAiComplete
  streamImpl?: PiAiStream
  getModelImpl?: PiAiGetModel
}

type PreparedRequest = {
  credential: Awaited<ReturnType<CodexOAuthSession['getValidCredential']>>
  model: string
  reasoningEffort: CodexReasoningEffort
  systemPrompt: string
  context: PiAiContext
  options: PiAiProviderStreamOptions
}

export class CodexOAuthProvider implements LlmProvider {
  readonly name = 'codex-oauth'
  readonly definition = getBuiltinLlmProviderDefinition(this.name)!
  readonly supportsStreaming = true

  readonly #session: CodexOAuthSession
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #defaultReasoningEffort: CodexReasoningEffort
  readonly #defaultTransport: PiAiTransport
  readonly #defaultSystemPrompt: string
  readonly #completeImpl: PiAiComplete
  readonly #streamImpl: PiAiStream
  readonly #getModelImpl: PiAiGetModel

  constructor(options: CodexOAuthProviderOptions = {}) {
    const config = getLlmProviderConfig('codex-oauth')
    this.#session =
      options.session ||
      (options.sessionOptions
        ? new CodexOAuthSession(options.sessionOptions)
        : createDefaultCodexOAuthSession())
    this.#baseUrl = normalizeBaseUrl(
      options.baseUrl || config?.baseUrl || DEFAULT_BASE_URL,
    )
    this.#defaultModel =
      options.defaultModel?.trim() || config?.defaultModel || DEFAULT_MODEL
    this.#defaultReasoningEffort = normalizeReasoningEffort(
      options.defaultReasoningEffort || config?.reasoningEffort,
    )
    this.#defaultTransport =
      (options.defaultTransport ||
        normalizeTransport(config?.transport) ||
        DEFAULT_TRANSPORT) as PiAiTransport
    this.#defaultSystemPrompt =
      options.defaultSystemPrompt?.trim() ||
      config?.systemPrompt ||
      DEFAULT_SYSTEM_PROMPT
    this.#completeImpl = options.completeImpl || piComplete
    this.#streamImpl = options.streamImpl || piStream
    this.#getModelImpl = options.getModelImpl || piGetModel
  }

  async getAvailability(): Promise<CodexOAuthAvailability> {
    return this.#session.getAvailability()
  }

  async generate(
    request: LlmGenerateRequest,
  ): Promise<LlmGenerateResponse> {
    const prepared = await this.#prepareRequest(request)
    const message = await this.#completeImpl(
      resolvePiAiModel({
        model: prepared.model,
        baseUrl: this.#baseUrl,
        getModelImpl: this.#getModelImpl,
      }),
      prepared.context,
      prepared.options,
    )
    return toGenerateResponse({
      provider: this.name,
      model: prepared.model,
      message,
      diagnostics: {
        baseUrl: this.#baseUrl,
        transport: this.#defaultTransport,
        systemPrompt: prepared.systemPrompt,
        accountId: prepared.credential.accountId,
        reasoningEffort: prepared.reasoningEffort,
        toolCount: request.tools?.length || 0,
      },
    })
  }

  async *stream(
    request: LlmGenerateRequest,
  ): AsyncIterable<LlmGenerateEvent> {
    const prepared = await this.#prepareRequest(request)
    const messageStream = this.#streamImpl(
      resolvePiAiModel({
        model: prepared.model,
        baseUrl: this.#baseUrl,
        getModelImpl: this.#getModelImpl,
      }),
      prepared.context,
      prepared.options,
    )

    for await (const event of messageStream) {
      const mappedEvent = mapStreamingEvent({
        event,
        provider: this.name,
        model: prepared.model,
      })
      if (mappedEvent) {
        yield mappedEvent
      }
    }

    const finalMessage = await messageStream.result()
    const response = toGenerateResponse({
      provider: this.name,
      model: prepared.model,
      message: finalMessage,
      diagnostics: {
        baseUrl: this.#baseUrl,
        transport: this.#defaultTransport,
        systemPrompt: prepared.systemPrompt,
        accountId: prepared.credential.accountId,
        reasoningEffort: prepared.reasoningEffort,
        toolCount: request.tools?.length || 0,
      },
    })

    yield {
      type: 'response_complete',
      provider: this.name,
      model: prepared.model,
      response,
    }
  }

  async #prepareRequest(
    request: LlmGenerateRequest,
  ): Promise<PreparedRequest> {
    configureGlobalFetchDispatcher()
    const credential = await this.#session.getValidCredential()
    const model = request.model?.trim() || this.#defaultModel
    const reasoningEffort = normalizeReasoningEffort(
      getReasoningEffort(request.metadata) || this.#defaultReasoningEffort,
    )
    const systemPrompt = resolveSystemPrompt(
      request.messages,
      this.#defaultSystemPrompt,
    )
    const context: PiAiContext = {
      systemPrompt,
      messages: toPiAiMessages(request.messages, model),
      ...(request.tools && request.tools.length > 0
        ? { tools: toPiAiTools(request.tools) }
        : {}),
    }
    const options: PiAiProviderStreamOptions = {
      apiKey: credential.access,
      transport: this.#defaultTransport,
      signal: request.signal,
      ...(typeof request.maxOutputTokens === 'number'
        ? { maxTokens: request.maxOutputTokens }
        : {}),
      ...(typeof request.temperature === 'number'
        ? { temperature: request.temperature }
        : {}),
      ...(request.metadata ? { metadata: { ...request.metadata } } : {}),
      reasoningEffort,
    }

    return {
      credential,
      model,
      reasoningEffort,
      systemPrompt,
      context,
      options,
    }
  }
}

function normalizeReasoningEffort(
  value: string | undefined,
): CodexReasoningEffort {
  return value === 'medium' || value === 'high' ? value : 'low'
}

function normalizeTransport(value: string | undefined): PiAiTransport | null {
  return value === 'auto' || value === 'sse' || value === 'websocket'
    ? value
    : null
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
}

function getReasoningEffort(
  metadata: LlmGenerateRequest['metadata'],
): string | undefined {
  if (!metadata) {
    return undefined
  }
  const value = metadata.reasoningEffort
  return typeof value === 'string' ? value : undefined
}

function resolveSystemPrompt(
  messages: readonly LlmMessage[],
  defaultSystemPrompt: string,
): string {
  const textBlocks = messages
    .filter(message => message.role === 'system')
    .flatMap(message =>
      message.parts
        .filter(part => part.type === 'text')
        .map(part => part.text.trim())
        .filter(Boolean),
    )
  return textBlocks.length > 0
    ? textBlocks.join('\n\n')
    : defaultSystemPrompt
}

function toPiAiMessages(
  messages: readonly LlmMessage[],
  model: string,
): PiAiMessage[] {
  const mapped: PiAiMessage[] = []
  let timestamp = Date.now()

  for (const message of messages) {
    if (message.role === 'system') {
      continue
    }

    switch (message.role) {
      case 'user': {
        const content = textPartsToString(message.parts, 'user')
        if (!content) {
          continue
        }
        mapped.push({
          role: 'user',
          content,
          timestamp: timestamp++,
        })
        break
      }
      case 'assistant': {
        const content = toPiAiAssistantContent(message.parts)
        if (content.length === 0) {
          continue
        }
        mapped.push({
          role: 'assistant',
          content,
          api: 'openai-codex-responses',
          provider: 'openai-codex',
          model,
          usage: EMPTY_PI_USAGE,
          stopReason: 'stop',
          timestamp: timestamp++,
        })
        break
      }
      case 'tool': {
        const toolResults = message.parts.filter(
          (part): part is LlmToolResultPart => part.type === 'tool_result',
        )
        if (toolResults.length !== message.parts.length) {
          throw new Error(
            'CodexOAuthProvider P7 requires tool-role messages to contain only tool_result parts.',
          )
        }
        for (const part of toolResults) {
          mapped.push({
            role: 'toolResult',
            toolCallId: part.toolCallId,
            toolName:
              part.toolName?.trim() || message.name?.trim() || 'unknown_tool',
            content: [
              {
                type: 'text',
                text: serializeToolResult(part.result),
              },
            ],
            isError: part.isError ?? false,
            timestamp: timestamp++,
          })
        }
        break
      }
      default:
        throw new Error(
          `CodexOAuthProvider does not support message role '${String(
            message.role,
          )}'.`,
        )
    }
  }

  if (mapped.length === 0) {
    throw new Error('CodexOAuthProvider requires at least one usable message.')
  }

  return mapped
}

function textPartsToString(
  parts: readonly LlmContentPart[],
  role: 'user' | 'assistant',
): string {
  const textParts = parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
    .trim()
  const hasUnsupportedPart = parts.some(part => part.type !== 'text')
  if (!textParts && hasUnsupportedPart) {
    throw new Error(
      `CodexOAuthProvider only supports text-only ${role} content when flattening to a single text block.`,
    )
  }
  if (hasUnsupportedPart) {
    throw new Error(
      `CodexOAuthProvider only supports text-only ${role} content when flattening to a single text block.`,
    )
  }
  return textParts
}

function toPiAiAssistantContent(
  parts: readonly LlmContentPart[],
): PiAiAssistantMessage['content'] {
  const mapped: PiAiAssistantMessage['content'] = []
  for (const part of parts) {
    if (part.type === 'text') {
      const text = part.text.trim()
      if (!text) {
        continue
      }
      mapped.push({
        type: 'text',
        text,
      })
      continue
    }
    if (part.type === 'tool_call') {
      mapped.push({
        type: 'toolCall',
        id: part.id,
        name: part.name,
        arguments: toRecord(part.input, 'tool_call input'),
      })
      continue
    }
    throw new Error(
      'CodexOAuthProvider assistant messages only support text and tool_call parts.',
    )
  }
  return mapped
}

function toPiAiTools(tools: readonly LlmToolDefinition[]): PiAiTool[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema as PiAiTool['parameters'],
  }))
}

function toRecord(value: unknown, label: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  throw new Error(`CodexOAuthProvider requires ${label} to be an object.`)
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

function resolvePiAiModel(input: {
  model: string
  baseUrl: string
  getModelImpl: PiAiGetModel
}): PiAiModel<'openai-codex-responses'> {
  try {
    const resolved = input.getModelImpl(
      'openai-codex' as Parameters<PiAiGetModel>[0],
      input.model as Parameters<PiAiGetModel>[1],
    ) as PiAiModel<'openai-codex-responses'>
    return {
      ...resolved,
      id: resolved.id || input.model,
      name: resolved.name || input.model,
      api: 'openai-codex-responses',
      provider: 'openai-codex',
      baseUrl: input.baseUrl,
    }
  } catch {
    return {
      id: input.model,
      name: input.model,
      api: 'openai-codex-responses',
      provider: 'openai-codex',
      baseUrl: input.baseUrl,
      reasoning: true,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow: 200000,
      maxTokens: 32000,
    }
  }
}

function toGenerateResponse(input: {
  provider: string
  model: string
  message: PiAiAssistantMessage
  diagnostics: Record<string, unknown>
}): LlmGenerateResponse {
  const output = extractAssistantContentParts(input.message)
  if (output.length === 0) {
    const errorMessage = extractMessageError(input.message)
    if (errorMessage) {
      throw new Error(errorMessage)
    }
    throw new Error('Codex OAuth provider returned no usable content.')
  }

  return {
    provider: input.provider,
    model: input.model,
    output,
    stopReason: mapStopReason(input.message.stopReason),
    usage: toLlmUsage(input.message.usage),
    raw: {
      message: input.message,
      diagnostics: input.diagnostics,
    },
  }
}

function extractAssistantContentParts(
  message: PiAiAssistantMessage,
): LlmContentPart[] {
  const mapped: LlmContentPart[] = []
  for (const item of message.content) {
    if (item.type === 'text') {
      mapped.push({
        type: 'text',
        text: item.text,
      })
      continue
    }
    if (item.type === 'toolCall') {
      mapped.push({
        type: 'tool_call',
        id: item.id,
        name: item.name,
        input: item.arguments,
      })
    }
  }
  return mapped
}

function toLlmUsage(
  usage: PiAiAssistantMessage['usage'] | undefined,
): LlmUsage | undefined {
  if (!usage) {
    return undefined
  }
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.totalTokens,
    cacheCreationInputTokens: usage.cacheWrite,
    cacheReadInputTokens: usage.cacheRead,
    raw: usage,
  }
}

function mapStopReason(stopReason: string | undefined) {
  if (stopReason === 'error') {
    return 'error' as const
  }
  if (stopReason === 'aborted') {
    return 'cancelled' as const
  }
  if (stopReason === 'length') {
    return 'max_tokens' as const
  }
  if (stopReason === 'toolUse') {
    return 'tool_use' as const
  }
  if (stopReason === 'stop') {
    return 'stop' as const
  }
  return 'other' as const
}

function extractMessageError(message: PiAiAssistantMessage): string | null {
  if (message.stopReason !== 'error' && message.stopReason !== 'aborted') {
    return null
  }
  return message.errorMessage?.trim() || 'Codex OAuth request failed.'
}

function mapStreamingEvent(input: {
  event: PiAiAssistantMessageEvent
  provider: string
  model: string
}): LlmGenerateEvent | null {
  switch (input.event.type) {
    case 'text_delta':
      return {
        type: 'content_part',
        provider: input.provider,
        model: input.model,
        part: {
          type: 'text',
          text: input.event.delta,
        },
      }
    case 'toolcall_end':
      return {
        type: 'content_part',
        provider: input.provider,
        model: input.model,
        part: {
          type: 'tool_call',
          id: input.event.toolCall.id,
          name: input.event.toolCall.name,
          input: input.event.toolCall.arguments,
        },
      }
    case 'error':
      throw new Error(extractMessageError(input.event.error))
    default:
      return null
  }
}
