import { useEffect, useState, type MouseEvent } from 'react'
import { renderMessageBlocks } from '../../domain/contentBlocks.js'
import type { ChatMessage } from '../../domain/displayTypes.js'

type MessageCopyMenuState = {
  x: number
  y: number
  text: string
  label: string
  status?: string
}

export function MessageContent(props: { message: ChatMessage }) {
  const visibleStatus =
    props.message.status && props.message.status !== 'completed'
      ? props.message.status
      : null
  const [copyMenu, setCopyMenu] = useState<MessageCopyMenuState | null>(null)

  useEffect(() => {
    if (!copyMenu) {
      return
    }

    const close = () => setCopyMenu(null)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [copyMenu])

  function openCopyMenu(event: MouseEvent<HTMLDivElement>): void {
    const messageText = props.message.text.trim()
    const selectedText = getSelectedTextWithin(event.currentTarget)
    const text = selectedText || messageText
    if (!text) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setCopyMenu({
      x: clampMenuX(event.clientX),
      y: clampMenuY(event.clientY),
      text,
      label: selectedText ? '复制选中内容' : '复制消息内容',
    })
  }

  async function copyMenuText(): Promise<void> {
    if (!copyMenu) {
      return
    }
    try {
      await window.ccr.copyText(copyMenu.text)
      setCopyMenu({ ...copyMenu, status: '已复制' })
      window.setTimeout(() => setCopyMenu(null), 620)
    } catch (error) {
      setCopyMenu({
        ...copyMenu,
        status: error instanceof Error ? error.message : '复制失败',
      })
    }
  }

  return (
    <div className="message-content" onContextMenu={openCopyMenu}>
      {renderMessageBlocks(props.message.text)}
      {visibleStatus ? <small className="message-status"> · {visibleStatus}</small> : null}
      {copyMenu ? (
        <div
          className="message-copy-menu"
          onClick={event => event.stopPropagation()}
          style={{ left: copyMenu.x, top: copyMenu.y }}
        >
          <button onClick={() => void copyMenuText()} type="button">
            <span>{copyMenu.status ?? copyMenu.label}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function getSelectedTextWithin(element: HTMLElement): string {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    return ''
  }
  const anchorNode = selection.anchorNode
  const focusNode = selection.focusNode
  if (
    (anchorNode && !element.contains(anchorNode)) ||
    (focusNode && !element.contains(focusNode))
  ) {
    return ''
  }
  return selection.toString().trim()
}

function clampMenuX(value: number): number {
  const width = 176
  return Math.max(8, Math.min(value, window.innerWidth - width - 8))
}

function clampMenuY(value: number): number {
  const height = 44
  return Math.max(8, Math.min(value, window.innerHeight - height - 8))
}
