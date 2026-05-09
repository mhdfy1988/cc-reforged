export function InteractionStatusBadge(props: { label: string }) {
  return (
    <span className={`interaction-status-badge ${getToneClass(props.label)}`}>
      {props.label}
    </span>
  )
}

function getToneClass(label: string): string {
  if (
    label.includes('拒绝') ||
    label.includes('取消') ||
    label.includes('失败')
  ) {
    return 'is-failed'
  }
  if (
    label.includes('允许') ||
    label.includes('批准') ||
    label.includes('提交')
  ) {
    return 'is-success'
  }
  if (label.includes('等待') || label.includes('提交中')) {
    return 'is-running'
  }
  return 'is-neutral'
}
