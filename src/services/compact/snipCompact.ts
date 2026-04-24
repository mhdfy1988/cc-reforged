import type { Message } from '../../types/message.js'
import { tokenCountWithEstimation } from '../../utils/tokens.js'

const SNIP_NUDGE_INTERVAL_TOKENS = 10_000

export const SNIP_NUDGE_TEXT =
  'Context has grown by about 10k tokens since the last context cleanup. If older messages are no longer needed, use SnipTool to remove them and keep the active context efficient.'

export type SnipMarkerMessage = {
  subtype?: string
  type?: string
  [key: string]: unknown
}

export function isSnipRuntimeEnabled(): boolean {
  return process.env.USER_TYPE === 'ant' && process.env.NODE_ENV !== 'test'
}

export function isSnipMarkerMessage(value: unknown): value is SnipMarkerMessage {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record.subtype === 'snip_marker' || record.type === 'snip_marker'
}

export function shouldNudgeForSnips(messages: Message[]): boolean {
  const resetIndex = findLastSnipNudgeResetIndex(messages)
  const messagesSinceReset =
    resetIndex === -1 ? messages : messages.slice(resetIndex + 1)
  return tokenCountWithEstimation(messagesSinceReset) >= SNIP_NUDGE_INTERVAL_TOKENS
}

export function snipCompactIfNeeded<T>(value: T): T {
  return value
}

function findLastSnipNudgeResetIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isSnipNudgeResetMessage(messages[i])) {
      return i
    }
  }
  return -1
}

function isSnipNudgeResetMessage(message: Message | undefined): boolean {
  if (!message) {
    return false
  }

  const record = message as Record<string, unknown>
  if (
    record.subtype === 'snip_marker' ||
    record.type === 'snip_marker' ||
    record.subtype === 'snip_boundary' ||
    record.type === 'snip_boundary'
  ) {
    return true
  }
  if (message.type === 'system') {
    return (
      message.subtype === 'compact_boundary' ||
      message.subtype === 'microcompact_boundary'
    )
  }
  return (
    message.type === 'attachment' &&
    message.attachment?.type === 'context_efficiency'
  )
}
