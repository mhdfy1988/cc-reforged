import { MessageFrame } from './MessageFrame.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'

export function ToolCard(props: { event: DisplayEvent }) {
  const snapshot = props.event.toolSnapshot
  if (!snapshot) {
    return <MessageFrame label="i" event={props.event} />
  }

  const hasDetail =
    snapshot.input !== undefined ||
    snapshot.result !== undefined ||
    snapshot.errorMessage !== undefined
  const metaItems = getToolMetaItems(snapshot)

  return (
    <div className="message system tool-event tool-card">
      <b>i</b>
      <div className="tool-card-body">
        <div className="tool-card-head">
          <strong>{snapshot.displayName ?? snapshot.name}</strong>
          <span>{getCategoryText(snapshot.category)}</span>
        </div>
        <p className="tool-card-summary" title={snapshot.summary}>
          {snapshot.summary}
        </p>
        {metaItems.length ? (
          <div className="tool-card-meta">
            {metaItems.map(item => (
              <span key={item.label}>
                {item.label}：{item.value}
              </span>
            ))}
          </div>
        ) : null}
        {snapshot.actionableHint ? (
          <p className="tool-card-hint">{snapshot.actionableHint}</p>
        ) : null}
        {hasDetail ? (
          <details>
            <summary>查看详情</summary>
            {snapshot.input === undefined ? null : (
              <ToolDetailBlock title="调用参数" value={snapshot.input} />
            )}
            {snapshot.result === undefined ? null : (
              <ToolDetailBlock title="执行结果" value={snapshot.result} />
            )}
            {snapshot.errorMessage === undefined ? null : (
              <ToolDetailBlock title="错误详情" value={snapshot.errorMessage} />
            )}
          </details>
        ) : null}
        <div className="tool-card-status-row">
          <StatusBadge label={snapshot.statusLabel} status={snapshot.status} />
        </div>
      </div>
    </div>
  )
}

function ToolDetailBlock(props: { title: string; value: unknown }) {
  return (
    <section className="tool-card-detail-block">
      <h4>{props.title}</h4>
      <pre>{formatToolDetail(props.value)}</pre>
    </section>
  )
}

function StatusBadge(props: { label?: string; status: string }) {
  const isRunning = isRunningStatus(props.status)
  return (
    <span
      className={`tool-status-badge ${
        isRunning ? 'is-running' : getStatusClassName(props.status)
      }`}
    >
      {isRunning ? <i aria-hidden="true" /> : null}
      {props.label ?? getStatusText(props.status)}
    </span>
  )
}

function getStatusText(status: string): string {
  if (status === 'failed') {
    return '失败'
  }
  if (status === 'completed') {
    return '成功'
  }
  if (status === 'denied') {
    return '已拒绝'
  }
  if (status === 'cancelled') {
    return '已取消'
  }
  if (status === 'waiting_permission') {
    return '等待权限'
  }
  if (status === 'timeout') {
    return '已超时'
  }
  if (isRunningStatus(status)) {
    return '执行中'
  }
  return status
}

function isRunningStatus(status: string): boolean {
  return (
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending' ||
    status === 'waiting_permission'
  )
}

function getStatusClassName(status: string): string {
  if (
    status === 'failed' ||
    status === 'denied' ||
    status === 'cancelled' ||
    status === 'timeout'
  ) {
    return 'is-failed'
  }
  if (status === 'completed') {
    return 'is-success'
  }
  return 'is-neutral'
}

function getCategoryText(category: string): string {
  switch (category) {
    case 'shell':
      return '命令'
    case 'file':
      return '文件'
    case 'mcp':
      return 'MCP'
    case 'browser':
      return '浏览器'
    case 'search':
      return '搜索'
    case 'control':
      return '控制'
    default:
      return '工具'
  }
}

function getToolMetaItems(snapshot: NonNullable<DisplayEvent['toolSnapshot']>) {
  return [
    shouldShowCommandMeta(snapshot)
      ? { label: '命令', value: snapshot.command }
      : null,
    snapshot.target && snapshot.target !== snapshot.command
      ? { label: '目标', value: snapshot.target }
      : null,
    snapshot.cwd ? { label: '工作目录', value: snapshot.cwd } : null,
    snapshot.shell ? { label: 'Shell', value: snapshot.shell } : null,
    snapshot.risk ? { label: '风险', value: snapshot.risk } : null,
    snapshot.errorClass ? { label: '错误类型', value: snapshot.errorClass } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>
}

function shouldShowCommandMeta(
  snapshot: NonNullable<DisplayEvent['toolSnapshot']>,
): snapshot is NonNullable<DisplayEvent['toolSnapshot']> & { command: string } {
  if (!snapshot.command) {
    return false
  }
  return !snapshot.summary.includes(snapshot.command)
}

function formatToolDetail(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail
  }
  try {
    return JSON.stringify(detail, null, 2)
  } catch {
    return String(detail)
  }
}
