import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js'
import {
  normalizeOpenAiImageGenerationCall,
  type OpenAiImageGenerationCallItem,
} from './openaiImageGenerationAdapter.js'
import type {
  CcrGeneratedArtifactSnapshot,
  CcrImageContentBlock,
} from '../../../types/contentBlocks.js'
import type {
  LlmImageGenerationRequest,
  LlmImageGenerationResponse,
} from '../types.js'

export interface OpenAiResponsesImageGenerationRawResponse {
  id?: string
  model?: string
  output?: Array<Record<string, unknown>>
  usage?: unknown
  error?: unknown
}

export interface ParsedOpenAiResponsesImageGenerationResponse {
  responseMode: 'json' | 'sse'
  raw?: OpenAiResponsesImageGenerationRawResponse
  events: Array<Record<string, unknown>>
  calls: OpenAiImageGenerationCallItem[]
}

export interface OpenAiResponsesImageGenerationTool {
  type: 'image_generation'
  size?: string
  quality?: string
  output_format?: string
}

export type OpenAiResponsesImageGenerationRequestBody = Record<
  string,
  unknown
> & {
  model: string
  tools: OpenAiResponsesImageGenerationTool[]
}

export type OpenAiResponsesImageGenerationRequestBodyFactory = (input: {
  request: LlmImageGenerationRequest
  defaultModel: string
}) => OpenAiResponsesImageGenerationRequestBody

export interface OpenAiResponsesHostedImageGenerationAdapterOptions {
  providerId: string
  providerLabel: string
  baseUrl: string
  defaultModel: string
  headers: HeadersInit | ((request: LlmImageGenerationRequest) => HeadersInit)
  requestBodyFactory?: OpenAiResponsesImageGenerationRequestBodyFactory
  resolveResponsesUrl?: (baseUrl: string) => string
  fetchImpl?: typeof fetch
}

export class OpenAiResponsesHostedImageGenerationAdapter {
  readonly #providerId: string
  readonly #providerLabel: string
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #headers:
    | HeadersInit
    | ((request: LlmImageGenerationRequest) => HeadersInit)
  readonly #requestBodyFactory: OpenAiResponsesImageGenerationRequestBodyFactory
  readonly #resolveResponsesUrl: (baseUrl: string) => string
  readonly #fetchImpl: typeof fetch

  constructor(options: OpenAiResponsesHostedImageGenerationAdapterOptions) {
    this.#providerId = options.providerId
    this.#providerLabel = options.providerLabel
    this.#baseUrl = normalizeBaseUrl(options.baseUrl)
    this.#defaultModel = options.defaultModel
    this.#headers = options.headers
    this.#requestBodyFactory =
      options.requestBodyFactory ?? toOpenAiResponsesImageGenerationRequestBody
    this.#resolveResponsesUrl =
      options.resolveResponsesUrl ?? resolveOpenAiResponsesUrl
    this.#fetchImpl = options.fetchImpl || fetch
  }

  async generateImage(
    request: LlmImageGenerationRequest,
  ): Promise<LlmImageGenerationResponse> {
    configureGlobalFetchDispatcher()
    const requestBody = this.#requestBodyFactory({
      request,
      defaultModel: this.#defaultModel,
    })
    const response = await this.#fetchImpl(
      this.#resolveResponsesUrl(this.#baseUrl),
      {
        method: 'POST',
        headers: resolveHeaders(this.#headers, request),
        body: JSON.stringify(requestBody),
        signal: request.signal,
      },
    )

    if (!response.ok) {
      throw new Error(
        await getProviderErrorMessage(response, this.#providerLabel, {
          requestBody,
          includeRequestDiagnostics: true,
        }),
      )
    }

    const parsed = await parseOpenAiResponsesImageGenerationResponse(response)
    return normalizeOpenAiResponsesImageGenerationParsedResponse(parsed, {
      request,
      fallbackModel: requestBody.model,
      providerId: this.#providerId,
    })
  }
}

export function toOpenAiResponsesImageGenerationRequestBody(input: {
  request: LlmImageGenerationRequest
  defaultModel: string
}): OpenAiResponsesImageGenerationRequestBody & { input: string } {
  const prompt = input.request.prompt.trim()
  if (!prompt) {
    throw new Error('Responses image generation prompt cannot be empty.')
  }

  const model = input.request.model?.trim() || input.defaultModel
  return {
    model,
    input: prompt,
    tools: [toOpenAiResponsesImageGenerationTool(input.request)],
  }
}

export function toOpenAiResponsesImageGenerationTool(
  request: LlmImageGenerationRequest,
  options: {
    includeRequestOptions?: boolean
    defaultOutputFormat?: string
  } = {},
): OpenAiResponsesImageGenerationTool {
  const includeRequestOptions = options.includeRequestOptions ?? true
  const outputFormat =
    request.outputFormat?.trim() || options.defaultOutputFormat?.trim()
  return {
    type: 'image_generation',
    ...(includeRequestOptions && request.size ? { size: request.size } : {}),
    ...(includeRequestOptions && request.quality
      ? { quality: request.quality }
      : {}),
    ...(outputFormat ? { output_format: outputFormat } : {}),
  }
}

export async function parseOpenAiResponsesImageGenerationResponse(
  response: Response,
): Promise<ParsedOpenAiResponsesImageGenerationResponse> {
  const text = await response.text()
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('text/event-stream') || looksLikeSse(text)) {
    const events = parseSseJsonPayloads(text)
    const raw = findCompletedResponse(events)
    return {
      responseMode: 'sse',
      raw,
      events,
      calls: getImageGenerationCalls({ raw, events }),
    }
  }

  const raw = parseJsonObject(text) as
    | OpenAiResponsesImageGenerationRawResponse
    | undefined
  if (!raw) {
    throw new Error('OpenAI Responses image generation returned an empty response.')
  }
  return {
    responseMode: 'json',
    raw,
    events: [],
    calls: getImageGenerationCalls({ raw, events: [] }),
  }
}

export async function normalizeOpenAiResponsesImageGenerationResponse(
  raw: OpenAiResponsesImageGenerationRawResponse,
  context: {
    request: LlmImageGenerationRequest
    fallbackModel: string
    providerId?: string
  },
): Promise<LlmImageGenerationResponse> {
  return normalizeOpenAiResponsesImageGenerationParsedResponse(
    {
      responseMode: 'json',
      raw,
      events: [],
      calls: getImageGenerationCalls({ raw, events: [] }),
    },
    context,
  )
}

export async function normalizeOpenAiResponsesImageGenerationParsedResponse(
  parsed: ParsedOpenAiResponsesImageGenerationResponse,
  context: {
    request: LlmImageGenerationRequest
    fallbackModel: string
    providerId?: string
  },
): Promise<LlmImageGenerationResponse> {
  const provider = context.providerId ?? context.request.provider
  const model = parsed.raw?.model?.trim() || context.fallbackModel
  if (parsed.calls.length === 0) {
    throw new Error(
      'OpenAI Responses image generation returned no image_generation_call output.',
    )
  }

  const output: CcrImageContentBlock[] = []
  const generatedArtifacts: CcrGeneratedArtifactSnapshot[] = []
  for (const call of parsed.calls) {
    const normalized = await normalizeOpenAiImageGenerationCall(call, {
      provider,
      model,
      sessionId: context.request.sessionId,
      ccrHome: context.request.ccrHome,
      prompt: context.request.prompt,
      outputFormat: context.request.outputFormat,
      outputId:
        parsed.calls.length === 1 ? context.request.outputId : undefined,
    })
    output.push(...normalized.output)
    generatedArtifacts.push(...normalized.generatedArtifacts)
  }

  return {
    provider,
    model,
    output,
    generatedArtifacts,
    raw: toSafeOpenAiResponsesImageGenerationRaw(parsed),
  }
}

export function resolveOpenAiResponsesUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/responses')) {
    return baseUrl
  }
  return `${baseUrl}/responses`
}

function resolveHeaders(
  value:
    | HeadersInit
    | ((request: LlmImageGenerationRequest) => HeadersInit),
  request: LlmImageGenerationRequest,
): HeadersInit {
  return typeof value === 'function' ? value(request) : value
}

function getImageGenerationCalls(input: {
  raw?: OpenAiResponsesImageGenerationRawResponse
  events: readonly Record<string, unknown>[]
}): OpenAiImageGenerationCallItem[] {
  const calls: OpenAiImageGenerationCallItem[] = []
  const seen = new Set<string>()
  for (const item of input.raw?.output ?? []) {
    addImageGenerationCall(calls, seen, item)
  }

  for (const event of input.events) {
    addImageGenerationCall(calls, seen, event)
    const item = toRecord(event.item)
    if (item) {
      addImageGenerationCall(calls, seen, item)
    }
    const response = toRecord(event.response)
    for (const outputItem of toRecordArray(response?.output)) {
      addImageGenerationCall(calls, seen, outputItem)
    }
    for (const outputItem of toRecordArray(event.output)) {
      addImageGenerationCall(calls, seen, outputItem)
    }
  }
  return calls
}

function addImageGenerationCall(
  calls: OpenAiImageGenerationCallItem[],
  seen: Set<string>,
  value: Record<string, unknown> | undefined,
): void {
  if (!value || value.type !== 'image_generation_call') {
    return
  }
  const call = value as OpenAiImageGenerationCallItem
  const key = getNonEmptyString(call.id) ?? getNonEmptyString(call.call_id)
  if (key) {
    if (seen.has(key)) {
      return
    }
    seen.add(key)
  }
  calls.push(call)
}

function findCompletedResponse(
  events: readonly Record<string, unknown>[],
): OpenAiResponsesImageGenerationRawResponse | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const response = toRecord(events[index].response)
    if (response) {
      return response as OpenAiResponsesImageGenerationRawResponse
    }
  }
  return undefined
}

function parseSseJsonPayloads(text: string): Array<Record<string, unknown>> {
  const normalized = text.replace(/\r\n/gu, '\n')
  const payloads: Array<Record<string, unknown>> = []
  for (const block of normalized.split(/\n\n+/u)) {
    const data = block
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice('data:'.length).trimStart())
      .join('\n')
      .trim()
    if (!data || data === '[DONE]') {
      continue
    }
    const parsed = parseJsonObject(data)
    if (parsed) {
      payloads.push(parsed)
    }
  }
  return payloads
}

function looksLikeSse(text: string): boolean {
  return text.includes('\ndata:') || text.startsWith('data:')
}

function parseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown
    return toRecord(parsed)
  } catch {
    return undefined
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value
        .map(item => toRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : []
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
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
  const message = `${providerLabel} Responses image generation request failed (${
    response.status
  } ${response.statusText})${detail ? `: ${detail}` : '.'}`
  if (!options.includeRequestDiagnostics || !options.requestBody) {
    return message
  }
  return `${message}; requestDiagnostics=${JSON.stringify(
    toSafeResponsesImageGenerationRequestDiagnostics(options.requestBody),
  )}`
}

function toSafeResponsesImageGenerationRequestDiagnostics(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const input = body.input
  const tools = Array.isArray(body.tools) ? body.tools : []
  const imageTool = tools.find(
    tool =>
      Boolean(tool) &&
      typeof tool === 'object' &&
      (tool as { type?: unknown }).type === 'image_generation',
  ) as OpenAiResponsesImageGenerationTool | undefined
  return {
    keys: Object.keys(body).sort(),
    model: body.model,
    inputChars: typeof input === 'string' ? input.length : undefined,
    inputCount: Array.isArray(input) ? input.length : undefined,
    toolCount: tools.length,
    imageTool: imageTool
      ? {
          type: imageTool.type,
          size: imageTool.size,
          quality: imageTool.quality,
          output_format: imageTool.output_format,
        }
      : undefined,
  }
}

function toSafeOpenAiResponsesImageGenerationRaw(
  parsed: ParsedOpenAiResponsesImageGenerationResponse,
): Record<string, unknown> {
  return {
    responseMode: parsed.responseMode,
    id: parsed.raw?.id,
    model: parsed.raw?.model,
    outputCount: parsed.raw?.output?.length ?? 0,
    eventCount: parsed.events.length,
    usage: parsed.raw?.usage,
    calls: parsed.calls.map(call => ({
      type: call.type,
      id: call.id,
      call_id: call.call_id,
      status: call.status,
      hasResult: Boolean(call.result),
      revised_prompt: call.revised_prompt,
    })),
  }
}
