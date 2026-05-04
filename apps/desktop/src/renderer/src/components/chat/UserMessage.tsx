import { MessageFrame } from './MessageFrame.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function UserMessage(props: { event: DisplayEvent }) {
  return <MessageFrame label="我" event={props.event} />
}
