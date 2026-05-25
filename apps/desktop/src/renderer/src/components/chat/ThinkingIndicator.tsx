import { MessageAvatar } from './MessageAvatar.js'
import {
  resolveMessageAvatar,
  type MessageAvatarRuntime,
} from '../../domain/avatarEvents.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function ThinkingIndicator(props: {
  avatarRuntime?: MessageAvatarRuntime
  canStop: boolean
}) {
  const event: DisplayEvent = {
    id: 'thinking-indicator',
    type: 'assistant_message',
    text: props.canStop ? '正在处理，可点击停止' : '正在启动',
    status: 'running',
  }
  return (
    <div aria-live="polite" className="message assistant thinking-message">
      <MessageAvatar
        descriptor={resolveMessageAvatar(event, props.avatarRuntime)}
        event={event}
      />
      <div className="thinking-content">
        <span>{props.canStop ? '正在处理，可点击停止' : '正在启动'}</span>
        <span className="thinking-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  )
}
