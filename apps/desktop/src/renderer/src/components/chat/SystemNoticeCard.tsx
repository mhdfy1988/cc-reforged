import { MessageFrame } from './MessageFrame.js'
import { MessageAvatar } from './MessageAvatar.js'
import type {
  DisplayCompactSnapshot,
  DisplayEvent,
} from '../../domain/displayEvents.js'

export function SystemNoticeCard(props: {
  event: DisplayEvent
  compactCarryover?: boolean
}) {
  if (props.event.sourceKind === 'context_compaction') {
    return <ContextCompactionNotice event={props.event} />
  }

  return (
    <MessageFrame
      compactCarryover={props.compactCarryover}
      event={props.event}
    />
  )
}

function ContextCompactionNotice(props: { event: DisplayEvent }) {
  const snapshot = props.event.compactSnapshot
  const isRunning =
    props.event.status === 'running' || snapshot?.status === 'running'
  const metrics = getCompactMetrics(snapshot)
  const title = isRunning ? '正在压缩上下文' : '上下文已压缩'
  const description = getCompactDescription({
    text: props.event.text,
    title,
    hasMetrics: metrics.length > 0,
  })

  return (
    <div className="message system context-compaction">
      <MessageAvatar event={props.event} />
      <div className="message-body">
        <div
          className={`context-compaction-card ${
            isRunning ? 'is-running' : 'is-completed'
          }`}
        >
          <div className="context-compaction-row">
            <strong>{title}</strong>
            <span className="context-compaction-status">
              {isRunning ? (
                <i aria-hidden="true" />
              ) : null}
              {isRunning ? '进行中' : '完成'}
            </span>
          </div>
          {description ? <p>{description}</p> : null}
          {metrics.length > 0 ? (
            <div className="context-compaction-metrics">
              {metrics.map(metric => (
                <span key={metric.label}>
                  <small>{metric.label}</small>
                  <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function getCompactDescription(input: {
  text: string
  title: string
  hasMetrics: boolean
}): string | null {
  const text = input.text.trim()
  if (!text || text === input.title || text === `${input.title}。`) {
    return null
  }
  if (
    input.title === '上下文已压缩' &&
    (text === '上下文已压缩，运行状态已刷新。' ||
      (input.hasMetrics && text.startsWith('上下文已压缩：')))
  ) {
    return null
  }
  return text
}

function getCompactMetrics(
  snapshot: DisplayCompactSnapshot | undefined,
): Array<{ label: string; value: string }> {
  if (!snapshot) {
    return []
  }

  const outputTokens =
    snapshot.truePostCompactTokenCount ?? snapshot.postCompactTokenCount
  const metrics: Array<{ label: string; value: string }> = []
  if (
    snapshot.preCompactTokenCount !== undefined &&
    outputTokens !== undefined
  ) {
    metrics.push({
      label: 'Token',
      value: `${formatCompactNumber(snapshot.preCompactTokenCount)} -> ${formatCompactNumber(outputTokens)}`,
    })
  }
  if (snapshot.summaryMessageCount !== undefined) {
    metrics.push({
      label: '摘要',
      value: `${formatCompactNumber(snapshot.summaryMessageCount)} 条`,
    })
  }
  if (snapshot.attachmentCount !== undefined) {
    metrics.push({
      label: '附件',
      value: `${formatCompactNumber(snapshot.attachmentCount)} 个`,
    })
  }
  return metrics
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}
