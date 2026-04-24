import type { Message } from '../../types/message.js'

export type ReactiveCompactOutcome =
  | {
      ok: true
      result: {
        userDisplayMessage?: string
        [key: string]: unknown
      }
    }
  | {
      ok: false
      reason:
        | 'too_few_groups'
        | 'aborted'
        | 'exhausted'
        | 'error'
        | 'media_unstrippable'
    }

export function isReactiveOnlyMode(): boolean {
  return false
}

export function isReactiveCompactEnabled(): boolean {
  return false
}

export function isWithheldPromptTooLong(_message: unknown): boolean {
  return false
}

export function isWithheldMediaSizeError(_message: unknown): boolean {
  return false
}

export async function reactiveCompactOnPromptTooLong(
  _messages: Message[],
  _cacheSafeParams: unknown,
  _options: unknown,
): Promise<ReactiveCompactOutcome> {
  return {
    ok: false,
    reason: 'error',
  }
}

export async function tryReactiveCompact(
  _input: unknown,
): Promise<null> {
  return null
}
