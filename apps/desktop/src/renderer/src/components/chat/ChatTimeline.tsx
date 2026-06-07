import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import type { MessageAvatarRuntime } from '../../domain/avatarEvents.js'
import type {
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'
import type { TodoOverlaySnapshot } from '../../domain/todoEvents.js'

export function ChatTimeline(props: {
  activeTurnId: string | null
  canInterruptTurn: boolean
  events: DisplayEvent[]
  avatarRuntime?: MessageAvatarRuntime
  permissions: PermissionCard[]
  todoOverlay: TodoOverlaySnapshot | null
  onOpenLogs?: () => void
  onOpenModels?: () => void
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
  const visibleEvents = useMemo(
    () => getVisibleTimelineEvents(props.events),
    [props.events],
  )
  const inlinePermissionIds = getInlinePermissionIds(
    visibleEvents,
    props.permissions,
    props.events,
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
            {visibleEvents.map(event => (
              <TimelineEvent
                event={event}
                avatarRuntime={props.avatarRuntime}
                key={event.id}
                permission={getInlinePermissionForEvent(
                  event,
                  props.permissions,
                  props.events,
                )}
                onOpenLogs={props.onOpenLogs}
                onOpenModels={props.onOpenModels}
                onRespondPermission={props.onRespondPermission}
              />
            ))}

            {props.activeTurnId ? (
              <ThinkingIndicator
                avatarRuntime={props.avatarRuntime}
                canStop={props.canInterruptTurn}
              />
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
  avatarRuntime?: MessageAvatarRuntime
  onOpenLogs?: () => void
  onOpenModels?: () => void
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
    return (
      <AssistantMessage
        event={event}
        avatarRuntime={props.avatarRuntime}
        onOpenLogs={props.onOpenLogs}
        onOpenModels={props.onOpenModels}
        permission={props.permission}
        onRespondPermission={props.onRespondPermission}
      />
    )
  }

  if (event.type === 'error') {
    return (
      <ErrorCard
        event={event}
        onOpenLogs={props.onOpenLogs}
        onOpenModels={props.onOpenModels}
      />
    )
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
  allEvents: DisplayEvent[],
): Set<string> {
  const ids = new Set<string>()
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    const permission = getInlinePermissionForEvent(
      event,
      permissions,
      allEvents,
    )
    if (permission) {
      ids.add(permission.permissionRequestId)
    }
  }
  return ids
}

function getInlinePermissionForEvent(
  event: DisplayEvent,
  permissions: PermissionCard[],
  allEvents: DisplayEvent[],
): PermissionCard | undefined {
  const planPermission = getInlinePlanApprovalPermissionForAssistantEvent(
    event,
    permissions,
    allEvents,
  )
  if (planPermission) {
    return planPermission
  }

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

function getInlinePlanApprovalPermissionForAssistantEvent(
  event: DisplayEvent,
  permissions: PermissionCard[],
  allEvents: DisplayEvent[],
): PermissionCard | undefined {
  if (event.type !== 'assistant_message') {
    return undefined
  }

  const anchoredCandidates = permissions.filter(permission => {
    if (!isInlinePlanApprovalPermission(permission)) {
      return false
    }
    const anchorAssistantId = resolvePlanApprovalAnchorAssistantId(
      permission,
      allEvents,
    )
    return Boolean(anchorAssistantId && anchorAssistantId === event.id)
  })
  if (!anchoredCandidates.length) {
    return undefined
  }

  return (
    anchoredCandidates.find(permission => permission.status === 'pending') ??
    anchoredCandidates[anchoredCandidates.length - 1]
  )
}

function resolvePlanApprovalAnchorAssistantId(
  permission: PermissionCard,
  allEvents: DisplayEvent[],
): string | undefined {
  const turnId =
    typeof permission.turnId === 'string' && permission.turnId.trim()
      ? permission.turnId.trim()
      : undefined
  const hiddenControlCallIndex = findHiddenControlCallEventIndexForPermission(
    allEvents,
    permission,
    turnId,
  )
  if (hiddenControlCallIndex !== -1) {
    const anchor = findNearestAssistantMessageBeforeIndex(
      allEvents,
      hiddenControlCallIndex,
      turnId,
    )
    if (anchor) {
      return anchor.id
    }
  }

  if (turnId) {
    const fallbackAssistant = findLastAssistantMessageForTurn(allEvents, turnId)
    if (fallbackAssistant) {
      return fallbackAssistant.id
    }
  }

  return findLastAssistantMessage(allEvents)?.id
}

function findLastAssistantMessageForTurn(
  events: DisplayEvent[],
  turnId: string,
): DisplayEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.identity?.turnId !== turnId) {
      continue
    }
    if (event.type === 'assistant_message') {
      return event
    }
  }
  return undefined
}

function findLastAssistantMessage(events: DisplayEvent[]): DisplayEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type === 'assistant_message') {
      return event
    }
  }
  return undefined
}

function findHiddenControlCallEventIndexForPermission(
  events: DisplayEvent[],
  permission: PermissionCard,
  turnId: string | undefined,
): number {
  const normalizedToolUseId =
    typeof permission.toolUseId === 'string' && permission.toolUseId.trim()
      ? permission.toolUseId.trim()
      : undefined

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (
      event.type !== 'tool_call' ||
      !event.timelineHidden ||
      event.toolSnapshot?.kind !== 'call'
    ) {
      continue
    }
    if (turnId && event.identity?.turnId !== turnId) {
      continue
    }
    if (normalizedToolUseId) {
      if (getEventToolUseId(event) === normalizedToolUseId) {
        return index
      }
      continue
    }
    if (event.toolSnapshot?.name === permission.toolName) {
      return index
    }
  }
  return -1
}

function findNearestAssistantMessageBeforeIndex(
  events: DisplayEvent[],
  startIndex: number,
  turnId: string | undefined,
): DisplayEvent | undefined {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (turnId && event.identity?.turnId !== turnId) {
      continue
    }
    if (event.type === 'assistant_message') {
      return event
    }
  }
  return undefined
}

function getEventToolUseId(event: DisplayEvent): string | undefined {
  return (
    event.toolSnapshot?.identity?.toolUseId ??
    event.fileToolSnapshot?.toolUseId ??
    event.fileToolSnapshot?.identity?.toolUseId ??
    event.fileSnapshot?.toolUseId ??
    event.fileSnapshot?.identity?.toolUseId ??
    event.referenceSnapshot?.toolUseId ??
    event.referenceSnapshot?.identity?.toolUseId ??
    event.identity?.toolUseId
  )
}

function isInlineToolPermission(permission: PermissionCard): boolean {
  if (
    permission.interactionKind === 'ask_user_question' ||
    isInlinePlanApprovalPermission(permission) ||
    permission.interactionKind === 'enter_plan_mode' ||
    permission.toolName === 'AskUserQuestion'
  ) {
    return false
  }
  return Boolean(permission.toolUseId)
}

function isInlinePlanApprovalPermission(permission: PermissionCard): boolean {
  return (
    permission.interactionKind === 'plan_approval' ||
    permission.toolName === 'ExitPlanMode' ||
    permission.toolName === 'ExitPlanModeV2'
  )
}

export function getVisibleTimelineEvents(events: DisplayEvent[]): DisplayEvent[] {
  const timelineEvents = events.filter(event => !event.timelineHidden)
  const hiddenEventIds = getHiddenCompactRecoveryEventIds(timelineEvents)
  return timelineEvents.filter(event => !hiddenEventIds.has(event.id))
}

function getHiddenCompactRecoveryEventIds(
  events: DisplayEvent[],
): Set<string> {
  const hiddenIds = new Set<string>()
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (!isRawCompactBoundaryNotice(event)) {
      continue
    }
    hiddenIds.add(event.id)

    for (let nextIndex = index + 1; nextIndex < events.length; nextIndex += 1) {
      const nextEvent = events[nextIndex]
      if (isCompactRecoveryAttachmentEvent(nextEvent)) {
        hiddenIds.add(nextEvent.id)
        continue
      }
      break
    }
  }
  return hiddenIds
}

function isRawCompactBoundaryNotice(event: DisplayEvent): boolean {
  if (event.type !== 'system_notice') {
    return false
  }
  const text = event.text.trim().toLowerCase()
  return text === 'conversation compacted'
}

function isCompactRecoveryAttachmentEvent(event: DisplayEvent): boolean {
  if (event.type !== 'system_notice') {
    return false
  }
  if (!event.attachmentSnapshots?.length) {
    return false
  }
  if (
    event.toolSnapshot ||
    event.fileSnapshot ||
    event.referenceSnapshot ||
    event.attachmentSnapshot
  ) {
    return false
  }
  return isAttachmentNoticeText(event.text)
}

function isAttachmentNoticeText(value: string): boolean {
  const normalized = value.trim()
  return normalized.startsWith('附件：') || normalized.startsWith('Attachment:')
}
