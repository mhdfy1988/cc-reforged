import { randomUUID } from 'node:crypto'
import { createDefaultLlmRuntime } from '../services/llm/defaultRuntime.js'
import { loadLlmConfig, type ResolvedLlmConfig } from '../services/llm/llmConfig.js'
import type { Message } from '../types/message.js'
import { createAssistantMessage, createUserMessage } from '../utils/messages.js'
import { CoreError } from './errors.js'
import type {
  CoreEventEmitter,
  CoreJsonObject,
  CoreTurn,
  CoreTurnMetadata,
  CoreWorkspace,
} from './types.js'

export type CoreImageGenerationTurnRunnerInput = {
  turn: CoreTurn
  workspace: CoreWorkspace
  signal: AbortSignal
  emit: CoreEventEmitter
  recordMessage: (message: Message) => void | Promise<void>
}

export type CoreImageGenerationTurnRunner = (
  input: CoreImageGenerationTurnRunnerInput,
) => Promise<CoreTurnMetadata>

type CoreImageGenerationOptions = {
  enabled: boolean
  prompt?: string
  model?: string
  size?: string
  quality?: string
  outputFormat?: string
  responseFormat?: 'b64_json' | 'url'
  n?: number
  metadata?: CoreJsonObject
}

export function shouldRunCoreImageGenerationTurn(
  metadata: CoreTurnMetadata | undefined,
): boolean {
  return normalizeImageGenerationOptions(metadata?.imageGeneration)?.enabled === true
}

export const runCoreImageGenerationTurn: CoreImageGenerationTurnRunner =
  async input => {
    const { turn, signal, emit, recordMessage } = input
    const config = loadLlmConfig()
    const imageOptions = normalizeImageGenerationOptions(
      turn.metadata.imageGeneration,
    )
    if (!imageOptions?.enabled) {
      throw new CoreError(
        'invalid_params',
        'Image generation turn requires imageGeneration metadata.',
      )
    }

    const prompt = (imageOptions.prompt ?? turn.input.text).trim()
    if (!prompt) {
      throw new CoreError(
        'invalid_params',
        'Image generation turn requires a non-empty prompt.',
      )
    }

    const userMessage = createUserMessage({ content: turn.input.text || prompt })
    await recordMessage(userMessage)
    emitCompletedItem(emit, {
      itemId: createItemId(),
      threadId: turn.threadId,
      turnId: turn.turnId,
      kind: 'user_message',
      content: [{ type: 'text', text: turn.input.text || prompt }],
    })

    const runtime = createDefaultLlmRuntime()
    const model = imageOptions.model ?? resolveDefaultImageModel(config)
    const response = await runtime.generateImage({
      provider: config.provider,
      model,
      ...(config.currentProfileId ? { profileId: config.currentProfileId } : {}),
      prompt,
      sessionId: turn.metadata.sessionId ?? turn.threadId,
      outputId: `out_${randomUUID()}`,
      size: imageOptions.size,
      quality: imageOptions.quality,
      outputFormat: imageOptions.outputFormat,
      responseFormat: imageOptions.responseFormat,
      n: imageOptions.n,
      metadata: {
        source: 'session_turn',
        ...(imageOptions.metadata ?? {}),
      },
      signal,
    })

    if (response.output.length === 0) {
      throw new CoreError(
        'internal_error',
        'Image generation provider returned no displayable output.',
      )
    }

    const assistantMessage = createAssistantMessage({
      content: response.output as unknown as Parameters<
        typeof createAssistantMessage
      >[0]['content'],
    })
    assistantMessage.message.model = response.model
    assistantMessage.message.stop_reason = 'end_turn'
    await recordMessage(assistantMessage)

    emitCompletedItem(emit, {
      itemId: createItemId(),
      threadId: turn.threadId,
      turnId: turn.turnId,
      kind: 'assistant_message',
      content: response.output as readonly CoreJsonObject[],
    })

    return {
      provider: response.provider,
      model: response.model,
      requestedModel: model,
      stopReason: 'generated_image',
      generatedImage: {
        outputCount: response.output.length,
        artifactCount: response.generatedArtifacts.length,
        outputIds: response.output
          .map(block => block.outputId)
          .filter((value): value is string => Boolean(value)),
        savedPaths: response.generatedArtifacts
          .map(artifact => artifact.savedPath)
          .filter((value): value is string => Boolean(value)),
      },
    }
  }

function normalizeImageGenerationOptions(
  value: unknown,
): CoreImageGenerationOptions | undefined {
  if (value === true) {
    return { enabled: true }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const object = value as Record<string, unknown>
  const enabled = object.enabled !== false
  return {
    enabled,
    prompt: getString(object.prompt),
    model: getString(object.model),
    size: getString(object.size),
    quality: getString(object.quality),
    outputFormat: getString(object.outputFormat ?? object.output_format),
    responseFormat: getResponseFormat(object.responseFormat ?? object.response_format),
    n: getPositiveInteger(object.n),
    metadata: getRecord(object.metadata),
  }
}

function resolveDefaultImageModel(config: ResolvedLlmConfig): string {
  const providerConfig = config.providers[config.provider]
  const metadataModel = getString(providerConfig?.metadata?.defaultImageModel)
  return metadataModel ?? config.model
}

function emitCompletedItem(
  emit: CoreEventEmitter,
  item: {
    itemId: string
    threadId: string
    turnId: string
    kind: string
    content: readonly CoreJsonObject[]
  },
): void {
  emit({
    type: 'item_started',
    item: {
      ...item,
      status: 'completed',
    },
  })
  emit({
    type: 'item_completed',
    threadId: item.threadId,
    turnId: item.turnId,
    itemId: item.itemId,
    status: 'completed',
    content: item.content,
  })
}

function createItemId(): string {
  return `item_${randomUUID()}`
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined
}

function getRecord(value: unknown): CoreJsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as CoreJsonObject)
    : undefined
}

function getResponseFormat(value: unknown): 'b64_json' | 'url' | undefined {
  return value === 'b64_json' || value === 'url' ? value : undefined
}
