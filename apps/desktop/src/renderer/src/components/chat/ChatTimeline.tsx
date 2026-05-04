import { AssistantMessage } from './AssistantMessage.js'
import { ErrorCard } from './ErrorCard.js'
import { PermissionRequestCard } from './PermissionRequestCard.js'
import { SystemNoticeCard } from './SystemNoticeCard.js'
import { ThinkingIndicator } from './ThinkingIndicator.js'
import { ThinkingSummaryCard } from './ThinkingSummaryCard.js'
import { ToolCard } from './ToolCard.js'
import { UserMessage } from './UserMessage.js'
import { TodoOverlay } from '../todo/TodoOverlay.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type { PermissionCard } from '../../domain/displayTypes.js'
import type { TodoOverlaySnapshot } from '../../domain/todoEvents.js'

export function ChatTimeline(props: {
  activeTurnId: string | null
  canInterruptTurn: boolean
  events: DisplayEvent[]
  permissions: PermissionCard[]
  todoOverlay: TodoOverlaySnapshot | null
  onRespondPermission: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
  ) => Promise<void>
}) {
  return (
    <>
      <section className="chat">
        {props.events.map(event => (
          <TimelineEvent event={event} key={event.id} />
        ))}

        {props.activeTurnId ? (
          <ThinkingIndicator canStop={props.canInterruptTurn} />
        ) : null}

        {props.permissions.map(permission => (
          <PermissionRequestCard
            key={permission.permissionRequestId}
            permission={permission}
            onRespond={props.onRespondPermission}
          />
        ))}
      </section>
      <TodoOverlay snapshot={props.todoOverlay} />
    </>
  )
}

function TimelineEvent(props: { event: DisplayEvent }) {
  const event = props.event

  if (event.type === 'user_message') {
    return <UserMessage event={event} />
  }

  if (event.type === 'assistant_message') {
    return <AssistantMessage event={event} />
  }

  if (event.type === 'error') {
    return <ErrorCard event={event} />
  }

  if (event.type === 'thinking_summary') {
    return <ThinkingSummaryCard event={event} />
  }

  if (event.type === 'tool_call' || event.type === 'tool_result') {
    return <ToolCard event={event} />
  }

  return <SystemNoticeCard event={event} />
}
