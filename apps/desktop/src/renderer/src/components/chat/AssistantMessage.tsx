import { MessageFrame } from './MessageFrame.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function AssistantMessage(props: { event: DisplayEvent }) {
  return <MessageFrame label="C" event={props.event} />
}
