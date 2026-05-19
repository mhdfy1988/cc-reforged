import {
  OpenAiResponsesHostedImageGenerationAdapter,
  toOpenAiResponsesImageGenerationTool,
  type OpenAiResponsesImageGenerationRequestBody,
} from './openaiResponsesHostedImageGenerationAdapter.js'
import type { CodexOAuthCredential } from '../sessions/CodexOAuthSession.js'
import type {
  LlmImageGenerationRequest,
  LlmImageGenerationResponse,
} from '../types.js'

export interface CodexOAuthImageGenerationAdapterOptions {
  providerId: string
  providerLabel: string
  credential: CodexOAuthCredential
  baseUrl: string
  defaultModel: string
  systemPrompt?: string
  fetchImpl?: typeof fetch
}

const DEFAULT_IMAGE_GENERATION_INSTRUCTIONS =
  'Use the image_generation tool to generate the requested image. Do not answer with text-only content when image generation is available.'

export class CodexOAuthImageGenerationAdapter {
  readonly #providerId: string
  readonly #providerLabel: string
  readonly #credential: CodexOAuthCredential
  readonly #baseUrl: string
  readonly #defaultModel: string
  readonly #systemPrompt?: string
  readonly #fetchImpl: typeof fetch

  constructor(options: CodexOAuthImageGenerationAdapterOptions) {
    this.#providerId = options.providerId
    this.#providerLabel = options.providerLabel
    this.#credential = options.credential
    this.#baseUrl = options.baseUrl
    this.#defaultModel = options.defaultModel
    this.#systemPrompt = options.systemPrompt?.trim()
    this.#fetchImpl = options.fetchImpl || fetch
  }

  async generateImage(
    request: LlmImageGenerationRequest,
  ): Promise<LlmImageGenerationResponse> {
    const accessToken = this.#credential.access.trim()
    if (!accessToken) {
      throw new Error('Codex OAuth access token is missing.')
    }
    const accountId = this.#credential.accountId?.trim()
    if (!accountId) {
      throw new Error(
        'Codex OAuth account id is missing. Please login again or set CCR_CODEX_OAUTH_ACCOUNT_ID.',
      )
    }

    return new OpenAiResponsesHostedImageGenerationAdapter({
      providerId: this.#providerId,
      providerLabel: this.#providerLabel,
      baseUrl: this.#baseUrl,
      defaultModel: this.#defaultModel,
      headers: toCodexOAuthResponsesHeaders({
        accessToken,
        accountId,
      }),
      requestBodyFactory: ({ request: imageRequest, defaultModel }) =>
        toCodexOAuthImageGenerationRequestBody({
          request: imageRequest,
          defaultModel,
          systemPrompt: this.#systemPrompt,
        }),
      resolveResponsesUrl: resolveCodexResponsesUrl,
      fetchImpl: this.#fetchImpl,
    }).generateImage(request)
  }
}

export function toCodexOAuthImageGenerationRequestBody(input: {
  request: LlmImageGenerationRequest
  defaultModel: string
  systemPrompt?: string
}): OpenAiResponsesImageGenerationRequestBody & { stream: true } {
  const prompt = input.request.prompt.trim()
  if (!prompt) {
    throw new Error('Codex OAuth image generation prompt cannot be empty.')
  }

  const model = input.request.model?.trim() || input.defaultModel
  return {
    model,
    store: false,
    stream: true,
    instructions: resolveImageGenerationInstructions(input.systemPrompt),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: prompt,
          },
        ],
      },
    ],
    text: {
      verbosity: 'medium',
    },
    include: ['reasoning.encrypted_content'],
    prompt_cache_key: input.request.sessionId,
    tool_choice: 'auto',
    parallel_tool_calls: true,
    tools: [
      toOpenAiResponsesImageGenerationTool(input.request, {
        includeRequestOptions: false,
        defaultOutputFormat: 'png',
      }),
    ],
  }
}

function toCodexOAuthResponsesHeaders(input: {
  accessToken: string
  accountId: string
}): Headers {
  const headers = new Headers()
  headers.set('authorization', `Bearer ${input.accessToken}`)
  headers.set('chatgpt-account-id', input.accountId)
  headers.set('OpenAI-Beta', 'responses=experimental')
  headers.set('originator', 'ccr')
  headers.set('accept', 'text/event-stream')
  headers.set('content-type', 'application/json')
  return headers
}

function resolveImageGenerationInstructions(
  systemPrompt: string | undefined,
): string {
  return [systemPrompt?.trim(), DEFAULT_IMAGE_GENERATION_INSTRUCTIONS]
    .filter((value): value is string => Boolean(value))
    .join('\n\n')
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '')
}

function resolveCodexResponsesUrl(baseUrl: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  if (normalizedBaseUrl.endsWith('/codex/responses')) {
    return normalizedBaseUrl
  }
  if (normalizedBaseUrl.endsWith('/codex')) {
    return `${normalizedBaseUrl}/responses`
  }
  return `${normalizedBaseUrl}/codex/responses`
}
