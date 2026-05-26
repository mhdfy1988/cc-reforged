import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { logError } from '../../utils/log.js'
import type { RuntimeContextBudget } from '../llm/contextBudget.js'

export type ModelUsageEventSource =
  | 'cli'
  | 'core'
  | 'app-server'
  | 'desktop'
  | 'advisor'
  | 'unknown'

export type ModelUsageEventUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  totalTokens: number
  webSearchRequests?: number
  webFetchRequests?: number
}

export type ModelUsageEventContextBudget = RuntimeContextBudget

export type ModelUsageEvent = {
  eventVersion: 1
  eventId: string
  timestamp: string
  provider: string
  providerDisplayName?: string
  profileId?: string
  profileName?: string
  model: string
  requestedModel?: string
  contextBudget: ModelUsageEventContextBudget
  usage: ModelUsageEventUsage
  costUSD?: number
  costStatus: 'calculated' | 'unavailable'
  costUnavailableReason?: string
  sessionId?: string
  threadId?: string
  turnId?: string
  requestId?: string
  cwd?: string
  projectPath?: string
  source: ModelUsageEventSource
}

export type ModelUsageEventInput = Omit<
  ModelUsageEvent,
  'eventVersion' | 'eventId' | 'timestamp'
> & {
  timestamp?: string
  eventId?: string
}

export type ModelUsageEventWriteResult =
  | {
      ok: true
      event: ModelUsageEvent
      filePath: string
    }
  | {
      ok: false
      event: ModelUsageEvent
      filePath: string
      error: string
    }

export function createModelUsageEvent(
  input: ModelUsageEventInput,
): ModelUsageEvent {
  const timestamp = input.timestamp ?? new Date().toISOString()
  const event: ModelUsageEvent = {
    eventVersion: 1,
    ...input,
    timestamp,
    eventId: input.eventId ?? createModelUsageEventId(input, timestamp),
  }
  validateModelUsageEvent(event)
  return event
}

export function appendModelUsageEvent(
  input: ModelUsageEventInput,
): ModelUsageEventWriteResult {
  const event = createModelUsageEvent(input)
  const filePath = getModelUsageEventsFilePath(event.timestamp)
  try {
    mkdirSync(getModelUsageEventsDir(), { recursive: true })
    appendFileSync(filePath, `${JSON.stringify(event)}\n`, {
      encoding: 'utf8',
    })
    return { ok: true, event, filePath }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError(
      new Error(
        [
          'Failed to append ModelUsageEvent.',
          `path=${filePath}`,
          `provider=${event.provider}`,
          `profileId=${event.profileId ?? ''}`,
          `model=${event.model}`,
          `requestId=${event.requestId ?? ''}`,
          `sessionId=${event.sessionId ?? ''}`,
          `threadId=${event.threadId ?? ''}`,
          `turnId=${event.turnId ?? ''}`,
          `error=${message}`,
        ].join(' '),
      ),
    )
    return { ok: false, event, filePath, error: message }
  }
}

export function getModelUsageEventsDir(): string {
  return process.env.CCR_USAGE_EVENTS_DIR?.trim()
    ? process.env.CCR_USAGE_EVENTS_DIR.trim()
    : join(getClaudeConfigHomeDir(), 'usage-events')
}

export function getModelUsageEventsFilePath(timestamp: string): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid ModelUsageEvent timestamp: ${timestamp}`)
  }
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return join(getModelUsageEventsDir(), `${year}-${month}.jsonl`)
}

export function createModelUsageEventId(
  input: ModelUsageEventInput,
  timestamp: string = input.timestamp ?? new Date().toISOString(),
): string {
  const usage = input.usage
  const stableParts = input.requestId
    ? [
        input.requestId,
        input.provider,
        input.profileId ?? '',
        input.model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheReadInputTokens,
        usage.cacheCreationInputTokens,
        input.costUSD ?? '',
      ]
    : [
        input.sessionId ?? '',
        input.threadId ?? '',
        input.turnId ?? '',
        timestamp,
        input.provider,
        input.model,
        usage.inputTokens,
        usage.outputTokens,
        input.costUSD ?? '',
      ]
  return createHash('sha256').update(stableParts.join('\u001f')).digest('hex')
}

function validateModelUsageEvent(event: ModelUsageEvent): void {
  assertNonEmptyString(event.provider, 'provider')
  assertNonEmptyString(event.model, 'model')
  assertNonEmptyString(event.source, 'source')
  assertNonEmptyString(event.costStatus, 'costStatus')
  if (event.costUSD !== undefined) {
    assertFiniteNumber(event.costUSD, 'costUSD')
  }
  assertFiniteNumber(event.usage.inputTokens, 'usage.inputTokens')
  assertFiniteNumber(event.usage.outputTokens, 'usage.outputTokens')
  assertFiniteNumber(
    event.usage.cacheReadInputTokens,
    'usage.cacheReadInputTokens',
  )
  assertFiniteNumber(
    event.usage.cacheCreationInputTokens,
    'usage.cacheCreationInputTokens',
  )
  assertFiniteNumber(event.usage.totalTokens, 'usage.totalTokens')
  assertFiniteNumber(
    event.contextBudget.totalContextWindow,
    'contextBudget.totalContextWindow',
  )
  assertFiniteNumber(
    event.contextBudget.effectiveInputWindow,
    'contextBudget.effectiveInputWindow',
  )
}

function assertNonEmptyString(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ModelUsageEvent ${field}.`)
  }
}

function assertFiniteNumber(value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ModelUsageEvent ${field}.`)
  }
}
