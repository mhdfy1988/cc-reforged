import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js'
import {
  normalizeGeneratedImageOutputs,
  type GeneratedImageOutputItem,
} from './generatedImageOutputAdapter.js'
import type {
  LlmImageGenerationRequest,
  LlmImageGenerationResponse,
} from '../types.js'

interface MiniMaxImageGenerationRawResponse {
  id?: string
  data?: {
    image_base64?: string[]
    image_urls?: string[]
  }
  metadata?: {
    failed_count?: number
    success_count?: number
    [key: string]: unknown
  }
  base_resp?: {
    status_code?: number
    status_msg?: string
  }
  error?: unknown
}

export interface MiniMaxImageGenerationAdapterOptions {
  providerId: string
  providerLabel: string
  apiKey?: string
  baseUrl: string
  defaultModel: string
  missingApiKeyMessage?: string
  fetchImpl?: typeof fetch
}

export class MiniMaxImageGenerationAdapter {
  readonly #providerId: string
  readonly #providerLabel: string
  readonly #apiKey?: string
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #missingApiKeyMessage: string
  readonly #fetchImpl: typeof fetch

  constructor(options: MiniMaxImageGenerationAdapterOptions) {
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

    const requestBody = toMiniMaxImageGenerationRequestBody({
      request,
      defaultModel: this.#defaultModel,
    })
    const response = await this.#fetchImpl(
      resolveImageGenerationUrl(this.#baseUrl),
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

    const raw = (await response.json()) as MiniMaxImageGenerationRawResponse
    const statusCode = raw.base_resp?.status_code
    if (typeof statusCode === 'number' && statusCode !== 0) {
      throw new Error(
        `${this.#providerLabel} image generation failed (${statusCode})${
          raw.base_resp?.status_msg ? `: ${raw.base_resp.status_msg}` : '.'
        }`,
      )
    }

    return normalizeMiniMaxImageGenerationResponse(raw, {
      request,
      fallbackModel: requestBody.model,
      providerId: this.#providerId,
    })
  }
}

export function toMiniMaxImageGenerationRequestBody(input: {
  request: LlmImageGenerationRequest
  defaultModel: string
}): Record<string, unknown> & {
  model: string
  prompt: string
  response_format: 'base64' | 'url'
} {
  const prompt = input.request.prompt.trim()
  if (!prompt) {
    throw new Error('MiniMax image generation prompt cannot be empty.')
  }

  const model = input.request.model?.trim() || input.defaultModel
  const width = getMetadataNumber(input.request.metadata, 'width')
  const height = getMetadataNumber(input.request.metadata, 'height')
  const aspectRatio =
    getMetadataString(input.request.metadata, 'aspectRatio') ??
    getMetadataString(input.request.metadata, 'aspect_ratio') ??
    getAspectRatioFromSize(input.request.size)

  return {
    model,
    prompt,
    response_format:
      input.request.responseFormat === 'url' ? 'url' : 'base64',
    ...(typeof input.request.n === 'number' ? { n: input.request.n } : {}),
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(typeof width === 'number' ? { width } : {}),
    ...(typeof height === 'number' ? { height } : {}),
    ...getOptionalMetadataNumber(input.request.metadata, 'seed'),
    ...getOptionalMetadataBoolean(
      input.request.metadata,
      'promptOptimizer',
      'prompt_optimizer',
    ),
    ...getOptionalMetadataBoolean(
      input.request.metadata,
      'aigcWatermark',
      'aigc_watermark',
    ),
  }
}

export async function normalizeMiniMaxImageGenerationResponse(
  raw: MiniMaxImageGenerationRawResponse,
  context: {
    request: LlmImageGenerationRequest
    fallbackModel: string
    providerId?: string
  },
): Promise<LlmImageGenerationResponse> {
  const provider = context.providerId ?? context.request.provider
  const model = context.fallbackModel || context.request.model
  const data = raw.data ?? {}
  const items: GeneratedImageOutputItem[] = [
    ...(data.image_base64 ?? []).map(base64Data => ({
      base64Data,
      raw: { hasBase64: true },
    })),
    ...(data.image_urls ?? []).map(url => ({
      url,
      raw: { hasUrl: true },
    })),
  ]

  return normalizeGeneratedImageOutputs(items, {
    provider,
    model,
    sessionId: context.request.sessionId,
    prompt: context.request.prompt,
    outputId: context.request.outputId,
    ccrHome: context.request.ccrHome,
    outputFormat: context.request.outputFormat,
    raw: toSafeMiniMaxImageGenerationRaw(raw),
  })
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
}

function resolveImageGenerationUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/image_generation')) {
    return baseUrl
  }
  return `${baseUrl}/image_generation`
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
    const parsed = JSON.parse(text) as {
      error?: { message?: unknown }
      base_resp?: { status_msg?: unknown }
    }
    if (typeof parsed.error?.message === 'string') {
      detail = parsed.error.message
    } else if (typeof parsed.base_resp?.status_msg === 'string') {
      detail = parsed.base_resp.status_msg
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
    toSafeMiniMaxImageGenerationRequestDiagnostics(options.requestBody),
  )}`
}

function toSafeMiniMaxImageGenerationRequestDiagnostics(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return {
    keys: Object.keys(body).sort(),
    model: body.model,
    promptChars: typeof body.prompt === 'string' ? body.prompt.length : 0,
    n: body.n,
    aspect_ratio: body.aspect_ratio,
    width: body.width,
    height: body.height,
    response_format: body.response_format,
  }
}

function toSafeMiniMaxImageGenerationRaw(
  raw: MiniMaxImageGenerationRawResponse,
): Record<string, unknown> {
  return {
    id: raw.id,
    metadata: raw.metadata,
    base_resp: raw.base_resp,
    imageCount:
      (raw.data?.image_base64?.length ?? 0) +
      (raw.data?.image_urls?.length ?? 0),
    data: {
      base64Count: raw.data?.image_base64?.length ?? 0,
      urlCount: raw.data?.image_urls?.length ?? 0,
      image_urls: raw.data?.image_urls,
    },
  }
}

function getAspectRatioFromSize(size: string | undefined): string | undefined {
  switch (size?.trim().toLowerCase()) {
    case '1024x1024':
    case '512x512':
    case '256x256':
    case '1:1':
      return '1:1'
    case '1536x1024':
    case '3:2':
      return '3:2'
    case '1024x1536':
    case '2:3':
      return '2:3'
    case '16:9':
    case '9:16':
    case '4:3':
    case '3:4':
    case '21:9':
      return size.trim().toLowerCase()
    default:
      return undefined
  }
}

function getOptionalMetadataNumber(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): Record<string, number> {
  const value = getMetadataNumber(metadata, key)
  return typeof value === 'number' ? { [key]: value } : {}
}

function getOptionalMetadataBoolean(
  metadata: Readonly<Record<string, unknown>> | undefined,
  camelKey: string,
  wireKey: string,
): Record<string, boolean> {
  const value = metadata?.[camelKey] ?? metadata?.[wireKey]
  return typeof value === 'boolean' ? { [wireKey]: value } : {}
}

function getMetadataString(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getMetadataNumber(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}
