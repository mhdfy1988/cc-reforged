import { useEffect, useState } from 'react'

export type PageStatusNoticeTone = 'success' | 'error'

export function PageStatusNotice(props: {
  autoDismiss?: boolean
  message: string | null | undefined
  tone?: PageStatusNoticeTone
}) {
  const { autoDismiss = true, message, tone = 'success' } = props
  const [visible, setVisible] = useState(Boolean(message))

  useEffect(() => {
    setVisible(Boolean(message))
    if (!message || !autoDismiss) {
      return
    }
    const timer = window.setTimeout(() => setVisible(false), 3200)
    return () => window.clearTimeout(timer)
  }, [autoDismiss, message])

  if (!message || !visible) {
    return null
  }

  return (
    <div
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`page-status-notice is-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span aria-hidden="true" />
      <strong>{message}</strong>
    </div>
  )
}
