import type { ToolUseContext } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import type { Attachment } from '../../utils/attachments.js'

export type SkillDiscoveryAttachment = Attachment

type SkillDiscoveryPrefetchOutcome =
  | {
      kind: 'attachments'
      attachments: SkillDiscoveryAttachment[]
    }
  | {
      kind: 'unavailable'
      error: SkillDiscoveryPrefetchUnavailableError
    }

export type SkillDiscoveryPrefetchHandle = Promise<SkillDiscoveryPrefetchOutcome>

export class SkillDiscoveryPrefetchUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillDiscoveryPrefetchUnavailableError'
  }
}

export function isSkillDiscoveryPrefetchUnavailableError(
  error: unknown,
): error is SkillDiscoveryPrefetchUnavailableError {
  return (
    error instanceof Error &&
    error.name === 'SkillDiscoveryPrefetchUnavailableError'
  )
}

function unavailable(
  message: string,
): SkillDiscoveryPrefetchOutcome {
  return {
    kind: 'unavailable',
    error: new SkillDiscoveryPrefetchUnavailableError(message),
  }
}

export function startSkillDiscoveryPrefetch(
  _input: string | null,
  _messages: Message[],
  _toolUseContext: ToolUseContext,
): SkillDiscoveryPrefetchHandle {
  return Promise.resolve(
    unavailable('Skill discovery prefetch is unavailable in this recovery build.'),
  )
}

export async function collectSkillDiscoveryPrefetch(
  handle: SkillDiscoveryPrefetchHandle,
): Promise<SkillDiscoveryAttachment[]> {
  const result = await handle
  if (result.kind === 'unavailable') {
    throw result.error
  }
  return result.attachments
}

export function getTurnZeroSkillDiscovery(
  _input: string,
  _messages: Message[],
  _toolUseContext: ToolUseContext,
): Promise<SkillDiscoveryAttachment[]> {
  return Promise.reject(
    new SkillDiscoveryPrefetchUnavailableError(
      'Turn-zero skill discovery is unavailable in this recovery build.',
    ),
  )
}
