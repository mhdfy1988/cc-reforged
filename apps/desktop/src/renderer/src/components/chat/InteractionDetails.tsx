export function InteractionDetails(props: {
  label?: string
  value: unknown
}) {
  return (
    <details className="interaction-card-details">
      <summary>{props.label ?? '查看详情'}</summary>
      <pre>{formatDetail(props.value)}</pre>
    </details>
  )
}

function formatDetail(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
