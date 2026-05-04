import type { TodoListItem as TodoListItemModel } from '../../domain/todoEvents.js'

export function TodoListItem(props: { item: TodoListItemModel }) {
  const marker = getStatusMarker(props.item.status)
  const activeText =
    props.item.status === 'in_progress' && props.item.activeForm
      ? props.item.activeForm
      : null

  return (
    <li className={`todo-overlay-item ${props.item.status}`}>
      <span>{marker}</span>
      <div>
        <p>{props.item.content}</p>
        {activeText ? <small>正在：{activeText}</small> : null}
      </div>
    </li>
  )
}

function getStatusMarker(status: string): string {
  if (status === 'completed') {
    return '✓'
  }
  if (status === 'in_progress') {
    return '●'
  }
  return '○'
}
