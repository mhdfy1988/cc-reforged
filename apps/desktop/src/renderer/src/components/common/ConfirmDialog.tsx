import { useEffect, useId, useRef } from 'react'

export type ConfirmDialogTone = 'default' | 'warning' | 'danger'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const titleId = useId()
  const detailId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!props.open) {
      return
    }
    cancelRef.current?.focus()
  }, [props.open])

  useEffect(() => {
    if (!props.open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        props.onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [props])

  if (!props.open) {
    return null
  }

  const tone = props.tone ?? 'default'
  const describedBy = props.detail ? detailId : undefined
  const confirmClassName = ['primary-action', tone === 'danger' ? 'danger' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={props.onCancel}
      role="presentation"
    >
      <section
        aria-describedby={describedBy}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`confirm-dialog ${getConfirmDialogToneClass(tone)}`}
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
      >
        <span className="confirm-dialog-marker" aria-hidden="true" />
        <div className="confirm-dialog-body">
          <header className="confirm-dialog-header">
            <strong id={titleId}>{props.title}</strong>
          </header>
          <p className="confirm-dialog-message">{props.message}</p>
          {props.detail ? (
            <pre className="confirm-dialog-detail" id={detailId}>
              {props.detail}
            </pre>
          ) : null}
          <footer className="confirm-dialog-actions">
            <button
              className="ghost-action"
              disabled={props.busy}
              onClick={props.onCancel}
              ref={cancelRef}
              type="button"
            >
              {props.cancelLabel ?? '取消'}
            </button>
            <button
              className={confirmClassName}
              disabled={props.busy}
              onClick={props.onConfirm}
              type="button"
            >
              {props.busy ? '处理中' : props.confirmLabel}
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}

export function getConfirmDialogToneClass(tone: ConfirmDialogTone): string {
  return `confirm-dialog--${tone}`
}
