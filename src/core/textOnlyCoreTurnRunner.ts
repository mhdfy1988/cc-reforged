import { randomUUID } from 'node:crypto'
import {
  queryWithLlmRuntime,
} from '../services/llm/claudeApiAdapter.js'
import { loadLlmConfig } from '../services/llm/llmConfig.js'
import { getLlmRuntimeAuthStatus } from '../services/llm/runtimeStatus.js'
import type { AssistantMessage } from '../types/message.js'
import { createUserMessage } from '../utils/messages.js'
import { asSystemPrompt } from '../utils/systemPromptType.js'
import { CoreError } from './errors.js'
import type {
  CoreEventEmitter,
  CoreTurn,
  CoreTurnMetadata,
  CoreTurnUsage,
} from './types.js'

export async function runTextOnlyCoreTurn(input: {
  turn: CoreTurn
  signal: AbortSignal
  emit: CoreEventEmitter
}): Promise<CoreTurnMetadata> {
  const { turn, signal, emit } = input
  const metadata: CoreTurnMetadata = {}
  const config = loadLlmConfig()
  const authStatus = await getLlmRuntimeAuthStatus(config)
  if (!authStatus.available) {
    throw new CoreError('auth_required', authStatus.message)
  }

  const userItemId = createItemId()
  emit({
    type: 'item_started',
    item: {
      itemId: userItemId,
      threadId: turn.threadId,
      turnId: turn.turnId,
      kind: 'user_message',
      status: 'completed',
      content: [{ type: 'text', text: turn.input.text }],
    },
  })
  emit({
    type: 'item_completed',
    threadId: turn.threadId,
    turnId: turn.turnId,
    itemId: userItemId,
    status: 'completed',
  })

  const assistantItemId = createItemId()
  emit({
    type: 'item_started',
    item: {
      itemId: assistantItemId,
      threadId: turn.threadId,
      turnId: turn.turnId,
      kind: 'assistant_message',
      status: 'streaming',
      content: [],
    },
  })

  let text = ''
  for await (const event of queryWithLlmRuntime({
    messages: [
      createUserMessage({
        content: turn.input.text,
      }),
    ],
    systemPrompt: asSystemPrompt([]),
    toolSchemas: [],
    signal,
    model: turn.model,
  })) {
    if (signal.aborted) {
      throw new CoreError('turn_not_active', 'Turn was interrupted.')
    }

    if (
      event.type === 'stream_event' &&
      event.event.type === 'content_block_delta' &&
      event.event.delta.type === 'text_delta'
    ) {
      text += event.event.delta.text
      emit({
        type: 'item_delta',
        threadId: turn.threadId,
        turnId: turn.turnId,
        itemId: assistantItemId,
        delta: {
          type: 'text',
          text: event.event.delta.text,
        },
      })
    }

    if (event.type === 'assistant' && event.isApiErrorMessage) {
      collectAssistantMetadata(metadata, event)
      throw new CoreError('internal_error', extractAssistantText(event))
    }

    if (event.type === 'stream_event') {
      collectStreamEventMetadata(metadata, event)
    }

    if (event.type === 'assistant') {
      collectAssistantMetadata(metadata, event)
    }
  }

  emit({
    type: 'item_completed',
    threadId: turn.threadId,
    turnId: turn.turnId,
    itemId: assistantItemId,
    status: 'completed',
    content: [{ type: 'text', text }],
  })

  return metadata
}

function createItemId(): string {
  return `item_${randomUUID()}`
}

function extractAssistantText(message: AssistantMessage): string {
  const content = message.message.content
  if (!Array.isArray(content)) {
    return 'Model request failed.'
  }
  const text = content
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part &&
        typeof part === 'object' &&
        part.type === 'text' &&
        typeof part.text === 'string',
    )
    .map(part => part.text)
    .join('')
    .trim()
  return text || 'Model request failed.'
}

function collectStreamEventMetadata(
  metadata: CoreTurnMetadata,
  event: { event?: Record<string, unknown>; ttftMs?: number },
): void {
  if (typeof event.ttftMs === 'number') {
    metadata.timeToFirstTokenMs = event.ttftMs
  }

  const streamEvent = event.event
  if (!streamEvent) {
    return
  }
  if (streamEvent.type === 'message_delta') {
    const usage = normalizeUsage(streamEvent.usage)
    if (usage) {
      metadata.usage = usage
    }
    const delta =
      streamEvent.delta && typeof streamEvent.delta === 'object'
        ? (streamEvent.delta as Record<string, unknown>)
        : null
    const stopReason = getString(delta?.stop_reason ?? delta?.stopReason)
    if (stopReason) {
      metadata.stopReason = stopReason
    }
  }
}

function collectAssistantMetadata(
  metadata: CoreTurnMetadata,
  message: AssistantMessage,
): void {
  const requestId = getString(message.requestId ?? message.message.id)
  if (requestId) {
    metadata.requestId = requestId
  }
  const model = getString(message.message.model)
  if (model) {
    metadata.model = model
  }
  const stopReason = getString(
    message.message.stop_reason ?? message.message.stopReason,
  )
  if (stopReason) {
    metadata.stopReason = stopReason
  }
  const usage = normalizeUsage(message.message.usage)
  if (usage) {
    metadata.usage = usage
  }
}

function normalizeUsage(value: unknown): CoreTurnUsage | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const usage = value as Record<string, unknown>
  const inputTokens = getNumber(usage.input_tokens ?? usage.inputTokens)
  const outputTokens = getNumber(usage.output_tokens ?? usage.outputTokens)
  const cacheCreationInputTokens = getNumber(
    usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens,
  )
  const cacheReadInputTokens = getNumber(
    usage.cache_read_input_tokens ?? usage.cacheReadInputTokens,
  )
  const totalTokens = getNumber(usage.total_tokens ?? usage.totalTokens)
  const computedTotal = [
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
  ]
    .filter((item): item is number => typeof item === 'number')
    .reduce((sum, item) => sum + item, 0)

  return Object.fromEntries(
    Object.entries({
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      totalTokens:
        typeof totalTokens === 'number'
          ? totalTokens
          : computedTotal > 0
            ? computedTotal
            : undefined,
      raw: value,
    }).filter(([, nestedValue]) => nestedValue !== undefined),
  ) as CoreTurnUsage
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
