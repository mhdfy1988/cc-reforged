export function InfoCard(props: { title: string; value: string; detail: string }) {
  return (
    <article className="info-card">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  )
}
