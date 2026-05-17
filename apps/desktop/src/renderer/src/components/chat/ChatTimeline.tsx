import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AssistantMessage } from './AssistantMessage.js'
import { ErrorCard } from './ErrorCard.js'
import { FileCard } from './FileCard.js'
import { PermissionRequestCard } from './PermissionRequestCard.js'
import { SystemNoticeCard } from './SystemNoticeCard.js'
import { ThinkingIndicator } from './ThinkingIndicator.js'
import { ThinkingSummaryCard } from './ThinkingSummaryCard.js'
import { ToolCard } from './ToolCard.js'
import { UserMessage } from './UserMessage.js'
import { TodoOverlay } from '../todo/TodoOverlay.js'
import {
  AUTO_SCROLL_RESUME_THRESHOLD_PX,
  getScrollMetrics,
  hasScrollableContentBelow,
  isNearScrollBottom,
  USER_SCROLL_DIRECTION_EPSILON_PX,
} from '../../domain/autoScroll.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'
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
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoFollowRef = useRef(true)
  const lastScrollTopRef = useRef<number | null>(null)
  const [hasNewContentBelow, setHasNewContentBelow] = useState(false)
  const inlinePermissionIds = getInlinePermissionIds(
    props.events,
    props.permissions,
  )

  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    if (shouldAutoFollowRef.current) {
      scrollToTimelineBottom(container, 'auto')
      lastScrollTopRef.current = container.scrollTop
      setHasNewContentBelow(false)
      return
    }

    setHasNewContentBelow(
      hasScrollableContentBelow(getScrollMetrics(container)),
    )
  }, [props.activeTurnId, props.events, props.permissions])

  useEffect(() => {
    const container = scrollContainerRef.current
    const content = contentRef.current
    if (!container || !content || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      if (shouldAutoFollowRef.current) {
        scrollToTimelineBottom(container, 'auto')
        lastScrollTopRef.current = container.scrollTop
        setHasNewContentBelow(false)
        return
      }

      setHasNewContentBelow(
        hasScrollableContentBelow(getScrollMetrics(container)),
      )
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  function handleScroll(): void {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const metrics = getScrollMetrics(container)
    const previousScrollTop = lastScrollTopRef.current ?? metrics.scrollTop
    const isUserScrollingUp =
      metrics.scrollTop < previousScrollTop - USER_SCROLL_DIRECTION_EPSILON_PX
    const isAtBottom = isNearScrollBottom(
      metrics,
      AUTO_SCROLL_RESUME_THRESHOLD_PX,
    )

    if (isUserScrollingUp) {
      shouldAutoFollowRef.current = false
    } else if (isAtBottom) {
      shouldAutoFollowRef.current = true
    }

    lastScrollTopRef.current = metrics.scrollTop

    if (shouldAutoFollowRef.current) {
      setHasNewContentBelow(false)
      return
    }
    setHasNewContentBelow(hasScrollableContentBelow(metrics))
  }

  function jumpToBottom(): void {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    shouldAutoFollowRef.current = true
    scrollToTimelineBottom(container, 'smooth')
    lastScrollTopRef.current = container.scrollTop
    setHasNewContentBelow(false)
  }

  return (
    <>
      <div className="chat-timeline-frame">
        <section className="chat" onScroll={handleScroll} ref={scrollContainerRef}>
          <div className="chat-content" ref={contentRef}>
            {props.events.map(event => (
              <TimelineEvent
                event={event}
                key={event.id}
                permission={getInlinePermissionForEvent(
                  event,
                  props.permissions,
                )}
                onRespondPermission={props.onRespondPermission}
              />
            ))}

            {props.activeTurnId ? (
              <ThinkingIndicator canStop={props.canInterruptTurn} />
            ) : null}

            {props.permissions
              .filter(
                permission =>
                  !inlinePermissionIds.has(permission.permissionRequestId),
              )
              .map(permission => (
              <PermissionRequestCard
                key={permission.permissionRequestId}
                permission={permission}
                onRespond={props.onRespondPermission}
              />
            ))}
          </div>
        </section>
        {hasNewContentBelow ? (
          <button
            className="chat-scroll-bottom"
            onClick={jumpToBottom}
            type="button"
          >
            回到底部
          </button>
        ) : null}
      </div>
      <TodoOverlay snapshot={props.todoOverlay} />
    </>
  )
}

function scrollToTimelineBottom(
  container: HTMLElement,
  behavior: ScrollBehavior,
): void {
  container.scrollTo({
    top: container.scrollHeight,
    behavior,
  })
}

function TimelineEvent(props: {
  event: DisplayEvent
  permission?: PermissionCard
  onRespondPermission: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
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
    return (
      <ToolCard
        event={event}
        permission={props.permission}
        onRespondPermission={props.onRespondPermission}
      />
    )
  }

  if (
    event.type === 'file_change' ||
    event.type === 'file_reference' ||
    event.type === 'attachment'
  ) {
    return <FileCard event={event} />
  }

  return <SystemNoticeCard event={event} />
}

function getInlinePermissionIds(
  events: DisplayEvent[],
  permissions: PermissionCard[],
): Set<string> {
  const ids = new Set<string>()
  for (const event of events) {
    const permission = getInlinePermissionForEvent(event, permissions)
    if (permission) {
      ids.add(permission.permissionRequestId)
    }
  }
  return ids
}

function getInlinePermissionForEvent(
  event: DisplayEvent,
  permissions: PermissionCard[],
): PermissionCard | undefined {
  const eventToolUseId = getEventToolUseId(event)
  const permissionRequestId = event.toolSnapshot?.permissionRequestId
  if (!eventToolUseId && !permissionRequestId) {
    return undefined
  }

  return permissions.find(permission => {
    if (!isInlineToolPermission(permission)) {
      return false
    }
    if (
      permissionRequestId &&
      permission.permissionRequestId === permissionRequestId
    ) {
      return true
    }
    return Boolean(eventToolUseId && permission.toolUseId === eventToolUseId)
  })
}

function getEventToolUseId(event: DisplayEvent): string | undefined {
  return (
    event.toolSnapshot?.identity?.toolUseId ??
    getRawToolUseId(event.toolSnapshot?.raw) ??
    event.fileToolSnapshot?.toolUseId ??
    event.fileToolSnapshot?.identity?.toolUseId ??
    event.fileSnapshot?.toolUseId ??
    event.fileSnapshot?.identity?.toolUseId ??
    event.referenceSnapshot?.toolUseId ??
    event.referenceSnapshot?.identity?.toolUseId ??
    event.identity?.toolUseId
  )
}

function getRawToolUseId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const object = value as Record<string, unknown>
  const id =
    object.id ??
    object.toolUseId ??
    object.toolUseID ??
    object.tool_use_id
  return typeof id === 'string' && id.trim() ? id : undefined
}

function isInlineToolPermission(permission: PermissionCard): boolean {
  if (
    permission.interactionKind === 'ask_user_question' ||
    permission.interactionKind === 'plan_approval' ||
    permission.interactionKind === 'enter_plan_mode' ||
    permission.toolName === 'AskUserQuestion' ||
    permission.toolName === 'ExitPlanMode' ||
    permission.toolName === 'ExitPlanModeV2' ||
    permission.toolName === 'EnterPlanMode'
  ) {
    return false
  }
  return Boolean(permission.toolUseId)
}
