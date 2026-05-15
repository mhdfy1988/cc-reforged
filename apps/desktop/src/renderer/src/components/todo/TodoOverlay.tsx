import { useRef, useState, type PointerEvent } from 'react'
import { TodoListItem } from './TodoListItem.js'
import { RawDataBlock } from '../common/RawDataBlock.js'
import type { TodoOverlaySnapshot } from '../../domain/todoEvents.js'

type OverlayPosition = {
  x: number
  y: number
}

type DragState = {
  startX: number
  startY: number
  originX: number
  originY: number
}

export function TodoOverlay(props: { snapshot: TodoOverlaySnapshot | null }) {
  const [collapsed, setCollapsed] = useState(false)
  const [position, setPosition] = useState<OverlayPosition | null>(null)
  const [dragging, setDragging] = useState(false)
  const overlayRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const snapshot = props.snapshot

  if (!snapshot) {
    return null
  }

  const completed = snapshot.items.filter(item => item.status === 'completed').length
  const total = snapshot.items.length
  const style = position
    ? {
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto',
      }
    : undefined

  return (
    <aside
      className={`todo-overlay ${collapsed ? 'collapsed' : ''} ${
        dragging ? 'dragging' : ''
      }`}
      ref={overlayRef}
      style={style}
    >
      <div
        className="todo-overlay-head"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="按住拖动 TodoWrite 浮层"
      >
        <span>i</span>
        <strong>调用工具：{snapshot.title}</strong>
        <small>
          {completed}/{total}
        </small>
        <button
          className="todo-overlay-toggle"
          onClick={() => setCollapsed(current => !current)}
          onPointerDown={event => event.stopPropagation()}
          type="button"
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </div>

      {collapsed ? null : (
        <div className="todo-overlay-body">
          <ol>
            {snapshot.items.map((item, index) => (
              <TodoListItem
                item={item}
                key={`${item.status}-${item.content}-${index}`}
              />
            ))}
          </ol>
          <details>
            <summary>查看原始 JSON</summary>
            <RawDataBlock value={snapshot.raw} />
          </details>
        </div>
      )}
    </aside>
  )

  function beginDrag(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || !overlayRef.current) {
      return
    }

    const overlayRect = overlayRef.current.getBoundingClientRect()
    const parentRect = getDragParentRect()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: overlayRect.left - parentRect.left,
      originY: overlayRect.top - parentRect.top,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>): void {
    if (!dragRef.current || !overlayRef.current) {
      return
    }

    const parentRect = getDragParentRect()
    const overlayRect = overlayRef.current.getBoundingClientRect()
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY

    setPosition({
      x: clamp(nextX, 12, Math.max(12, parentRect.width - overlayRect.width - 12)),
      y: clamp(nextY, 12, Math.max(12, parentRect.height - overlayRect.height - 12)),
    })
  }

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current) {
      dragRef.current = null
      setDragging(false)
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function getDragParentRect(): DOMRect {
    const parent = overlayRef.current?.offsetParent
    if (parent instanceof HTMLElement) {
      return parent.getBoundingClientRect()
    }
    return document.documentElement.getBoundingClientRect()
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
