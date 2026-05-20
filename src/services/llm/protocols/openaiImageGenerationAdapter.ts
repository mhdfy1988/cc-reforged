import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js'
import {
  normalizeGeneratedImageOutputs,
  type GeneratedImageNormalizationContext,
  type GeneratedImageOutputItem,
} from './generatedImageOutputAdapter.js'
import type {
  LlmImageGenerationRequest,
  LlmImageGenerationResponse,
} from '../types.js'

interface OpenAiImageGenerationDataItem {
  b64_json?: string
  url?: string
  revised_prompt?: string
}

interface OpenAiImageGenerationRawResponse {
  created?: number
  data?: OpenAiImageGenerationDataItem[]
  usage?: unknown
  error?: unknown
}

export interface OpenAiImageGenerationCallItem {
  type?: 'image_generation_call' | string
  id?: string
  call_id?: string
  status?: string
  result?: string | null
  revised_prompt?: string
  prompt?: string
}

export type OpenAiGeneratedImageOutputItem = GeneratedImageOutputItem
export type OpenAiGeneratedImageNormalizationContext =
  GeneratedImageNormalizationContext

export interface OpenAiImageGenerationAdapterOptions {
  providerId: string
  providerLabel: string
  apiKey?: string
  baseUrl: string
  defaultModel: string
  missingApiKeyMessage?: string
  fetchImpl?: typeof fetch
}

export class OpenAiImageGenerationAdapter {
  readonly #providerId: string
  readonly #providerLabel: string
  readonly #apiKey?: string
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #missingApiKeyMessage: string
  readonly #fetchImpl: typeof fetch

  constructor(options: OpenAiImageGenerationAdapterOptions) {
    this.#providerId = options.providerId
    this.#providerLabel = options.providerLabel
    this.#apiKey = options.apiKey?.trim()
    this.#baseUrl = normalizeBaseUrl(options.baseUrl)
    this.#defaultModel = options.defaultModel
    this.#missingApiKeyMessage =
      options.missingApiKeyMessage ??
      `${options.providerLabel} API key is missing.`
    this.#fetchImpl = options.fetchImpl || fetch
  }

  async generateImage(
    request: LlmImageGenerationRequest,
  ): Promise<LlmImageGenerationResponse> {
    configureGlobalFetchDispatcher()
    const apiKey = this.#apiKey?.trim()
    if (!apiKey) {
      throw new Error(this.#missingApiKeyMessage)
    }

    const requestBody = toOpenAiImageGenerationRequestBody({
      request,
      defaultModel: this.#defaultModel,
    })
    const response = await this.#fetchImpl(
      resolveImageGenerationsUrl(this.#baseUrl),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
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

    const raw = (await response.json()) as OpenAiImageGenerationRawResponse
    return normalizeOpenAiImageGenerationResponse(raw, {
      request,
      fallbackModel: requestBody.model,
      providerId: this.#providerId,
      fetchImpl: this.#fetchImpl,
    })
  }
}

export function toOpenAiImageGenerationRequestBody(input: {
  request: LlmImageGenerationRequest
  defaultModel: string
}): Record<string, unknown> & { model: string; prompt: string } {
  const prompt = input.request.prompt.trim()
  if (!prompt) {
    throw new Error('Image generation prompt cannot be empty.')
  }

  const model = input.request.model?.trim() || input.defaultModel
  const responseFormat =
    input.request.responseFormat ??
    (usesDefaultUrlImageResponse(model) ? undefined : 'b64_json')

  return {
    model,
    prompt,
    ...(typeof input.request.n === 'number' ? { n: input.request.n } : {}),
    ...(input.request.size ? { size: input.request.size } : {}),
    ...(input.request.quality ? { quality: input.request.quality } : {}),
    ...(input.request.outputFormat
      ? { output_format: input.request.outputFormat }
      : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
  }
}

export async function normalizeOpenAiImageGenerationResponse(
  raw: OpenAiImageGenerationRawResponse,
  context: {
    request: LlmImageGenerationRequest
    fallbackModel: string
    providerId?: string
    fetchImpl?: typeof fetch
  },
): Promise<LlmImageGenerationResponse> {
  const provider = context.providerId ?? context.request.provider
  const model = context.fallbackModel || context.request.model
  return normalizeOpenAiGeneratedImageOutputs(
    (raw.data ?? []).map(item => ({
      base64Data: item.b64_json,
      url: item.url,
      revisedPrompt: item.revised_prompt,
      raw: item,
    })),
    {
      provider,
      model,
      sessionId: context.request.sessionId,
      prompt: context.request.prompt,
      outputId: context.request.outputId,
      ccrHome: context.request.ccrHome,
      outputFormat: context.request.outputFormat,
      fetchImpl: context.fetchImpl,
      signal: context.request.signal,
      raw: toSafeOpenAiImageGenerationRaw(raw),
    },
  )
}

export async function normalizeOpenAiImageGenerationCall(
  call: OpenAiImageGenerationCallItem,
  context: Omit<
    OpenAiGeneratedImageNormalizationContext,
    'outputId' | 'prompt' | 'raw'
  > & {
    outputId?: string
    prompt?: string
  },
): Promise<LlmImageGenerationResponse> {
  const outputId =
    context.outputId ??
    getNonEmptyString(call.id) ??
    getNonEmptyString(call.call_id)
  const prompt = context.prompt ?? getNonEmptyString(call.prompt)
  const result = getNonEmptyString(call.result)

  return normalizeOpenAiGeneratedImageOutputs(
    [
      {
        outputId,
        base64Data: result,
        revisedPrompt: getNonEmptyString(call.revised_prompt),
        raw: call,
      },
    ],
    {
      ...context,
      outputId,
      prompt,
      raw: toSafeOpenAiImageGenerationCallRaw(call),
    },
  )
}

export async function normalizeOpenAiGeneratedImageOutputs(
  items: readonly OpenAiGeneratedImageOutputItem[],
  context: OpenAiGeneratedImageNormalizationContext,
): Promise<LlmImageGenerationResponse> {
  return normalizeGeneratedImageOutputs(items, context)
}

function usesDefaultUrlImageResponse(model: string): boolean {
  const normalized = model.toLowerCase()
  return normalized.startsWith('gpt-image') || normalized === 'glm-image'
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
}

function resolveImageGenerationsUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/images/generations')) {
    return baseUrl
  }
  return `${baseUrl}/images/generations`
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
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
  const message = `${providerLabel} image generation request failed (${
    response.status
  } ${response.statusText})${detail ? `: ${detail}` : '.'}`
  if (!options.includeRequestDiagnostics || !options.requestBody) {
    return message
  }
  return `${message}; requestDiagnostics=${JSON.stringify(
    toSafeImageGenerationRequestDiagnostics(options.requestBody),
  )}`
}

function toSafeImageGenerationRequestDiagnostics(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return {
    keys: Object.keys(body).sort(),
    model: body.model,
    promptChars: typeof body.prompt === 'string' ? body.prompt.length : 0,
    n: body.n,
    size: body.size,
    quality: body.quality,
    output_format: body.output_format,
    response_format: body.response_format,
  }
}

function toSafeOpenAiImageGenerationRaw(
  raw: OpenAiImageGenerationRawResponse,
): Record<string, unknown> {
  return {
    created: raw.created,
    imageCount: raw.data?.length ?? 0,
    usage: raw.usage,
    data: raw.data?.map(item => ({
      hasBase64: Boolean(item.b64_json),
      hasUrl: Boolean(item.url),
      revised_prompt: item.revised_prompt,
    })),
  }
}

function toSafeOpenAiImageGenerationCallRaw(
  call: OpenAiImageGenerationCallItem,
): Record<string, unknown> {
  return {
    type: call.type,
    id: call.id,
    call_id: call.call_id,
    status: call.status,
    hasResult: Boolean(call.result),
    revised_prompt: call.revised_prompt,
  }
}
