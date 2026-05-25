import { MessageFrame } from './MessageFrame.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function UserMessage(props: { event: DisplayEvent }) {
  return <MessageFrame event={props.event} />
}
