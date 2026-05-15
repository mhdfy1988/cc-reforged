import { RawDataBlock } from '../common/RawDataBlock.js'

export function InteractionDetails(props: {
  label?: string
  value: unknown
}) {
  return (
    <details className="interaction-card-details">
      <summary>{props.label ?? '查看详情'}</summary>
      <RawDataBlock value={props.value} />
    </details>
  )
}
