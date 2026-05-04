import { renderMessageBlocks } from '../../domain/contentBlocks.js'
import type { ChatMessage } from '../../domain/displayTypes.js'

export function MessageContent(props: { message: ChatMessage }) {
  const visibleStatus =
    props.message.status && props.message.status !== 'completed'
      ? props.message.status
      : null

  return (
    <div className="message-content">
      {renderMessageBlocks(props.message.text)}
      {visibleStatus ? <small className="message-status"> · {visibleStatus}</small> : null}
    </div>
  )
}
