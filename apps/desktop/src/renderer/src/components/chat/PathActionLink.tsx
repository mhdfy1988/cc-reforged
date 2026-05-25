import { useState, type ReactNode } from 'react'

export function PathActionLink(props: {
  path?: string | null
  children?: ReactNode
  className?: string
  disabled?: boolean
  displayPath?: string
  failureLabel?: string
  icon?: boolean
  statusClassName?: string
  successLabel?: string
  title?: string
  onStatusChange?: (status: string | null) => void
}) {
  const [status, setStatus] = useState<string | null>(null)
  const path = normalizePath(props.path)
  const disabled = props.disabled || !path
  const label = props.children ?? props.displayPath ?? path ?? ''

  function updateStatus(nextStatus: string | null): void {
    if (props.onStatusChange) {
      props.onStatusChange(nextStatus)
      return
    }
    setStatus(nextStatus)
  }

  async function openPath(): Promise<void> {
    if (!path) {
      return
    }
    try {
      await window.ccr.openPath(path)
      updateStatus(props.successLabel ?? '已请求打开')
    } catch (error) {
      updateStatus(
        error instanceof Error
          ? error.message
          : (props.failureLabel ?? '打开失败'),
      )
    }
  }

  return (
    <>
      <button
        className={props.className}
        disabled={disabled}
        onClick={() => void openPath()}
        title={props.title ?? path ?? props.displayPath}
        type="button"
      >
        {props.icon === false ? null : (
          <span aria-hidden="true" className="path-action-link-icon" />
        )}
        <span className="path-action-link-label">
          {label}
        </span>
      </button>
      {!props.onStatusChange && status ? (
        <small className={props.statusClassName}>{status}</small>
      ) : null}
    </>
  )
}

function normalizePath(path: string | null | undefined): string | undefined {
  if (typeof path !== 'string') {
    return undefined
  }
  const trimmed = path.trim()
  return trimmed ? trimmed : undefined
}
