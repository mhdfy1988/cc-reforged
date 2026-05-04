import { MessageContent } from './MessageContent.js'
import { displayEventToChatMessage, type DisplayEvent } from '../../domain/displayEvents.js'

export function MessageFrame(props: {
  label: string
  event: DisplayEvent
}) {
  const message = displayEventToChatMessage(props.event)

  return (
    <div className={`message ${message.role} ${message.kind ?? ''}`}>
      <b>{props.label}</b>
      <MessageContent message={message} />
    </div>
  )
}
