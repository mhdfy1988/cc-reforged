import { MessageFrame } from './MessageFrame.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function SystemNoticeCard(props: {
  event: DisplayEvent
  compactCarryover?: boolean
}) {
  return (
    <MessageFrame
      compactCarryover={props.compactCarryover}
      event={props.event}
      label="i"
    />
  )
}
