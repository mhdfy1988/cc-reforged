import { MessageFrame } from './MessageFrame.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function ThinkingSummaryCard(props: { event: DisplayEvent }) {
  return <MessageFrame label="i" event={props.event} />
}
