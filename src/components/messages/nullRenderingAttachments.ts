import type { Attachment } from 'src/utils/attachments.js'
import type { Message, NormalizedMessage } from '../../types/message.js'
import {
  isNullRenderingAttachmentType,
  NULL_RENDERING_ATTACHMENT_TYPES,
  type NullRenderingAttachmentType,
} from 'src/utils/nullRenderingAttachmentTypes.js'

export type { NullRenderingAttachmentType } from 'src/utils/nullRenderingAttachmentTypes.js'

type Assert<T extends true> = T
type _NullRenderingTypesAreAttachmentTypes = Assert<
  NullRenderingAttachmentType extends Attachment['type'] ? true : false
>

/**
 * Attachment types that AttachmentMessage renders as `null` unconditionally
 * (no visible output regardless of runtime state). Messages.tsx filters these
 * out BEFORE the render cap / message count so invisible entries don't consume
 * the 200-message render budget (CC-724).
 *
 * Sync is enforced by TypeScript: AttachmentMessage's switch `default:` branch
 * asserts `attachment.type satisfies NullRenderingAttachmentType`. Adding a new
 * Attachment type without either a case or an entry here will fail typecheck.
 */

/**
 * True when this message is an attachment that AttachmentMessage renders as
 * null with no visible output. Messages.tsx filters these out before counting
 * and before applying the 200-message render cap, so invisible hook
 * attachments (hook_success, hook_additional_context, hook_cancelled) don't
 * inflate the "N messages" count or eat into the render budget (CC-724).
 */
export function isNullRenderingAttachment(
  msg: Message | NormalizedMessage,
): boolean {
  return (
    msg.type === 'attachment' &&
    isNullRenderingAttachmentType(msg.attachment.type)
  )
}
