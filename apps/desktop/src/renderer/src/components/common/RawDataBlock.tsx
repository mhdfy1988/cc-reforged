import { useEffect, useMemo, useState } from 'react'

type RawDataBlockProps = {
  value?: unknown
  text?: string
  className?: string
  preClassName?: string
}

type CopyState = 'idle' | 'copied' | 'failed'

export function RawDataBlock(props: RawDataBlockProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const content = useMemo(
    () => props.text ?? formatRawData(props.value),
    [props.text, props.value],
  )

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }
    const timer = window.setTimeout(() => setCopyState('idle'), 1500)
    return () => window.clearTimeout(timer)
  }, [copyState])

  async function copyContent(): Promise<void> {
    try {
      if (window.ccr?.copyText) {
        await window.ccr.copyText(content)
      } else {
        await navigator.clipboard.writeText(content)
      }
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const copyLabel =
    copyState === 'copied'
      ? '已复制'
      : copyState === 'failed'
        ? '复制失败'
        : '复制'

  return (
    <div className={`raw-data-block ${props.className ?? ''}`}>
      <button
        aria-label={copyLabel}
        className={`raw-data-copy-button ${copyState}`}
        onClick={() => void copyContent()}
        title={copyLabel}
        type="button"
      >
        {copyState === 'copied' ? (
          <svg
            aria-hidden="true"
            className="raw-data-copy-svg"
            viewBox="0 0 24 24"
          >
            <path d="M5 12.5 9.2 17 19 7" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="raw-data-copy-svg"
            viewBox="0 0 24 24"
          >
            <rect height="11" rx="2" width="11" x="8" y="5" />
            <rect height="11" rx="2" width="11" x="5" y="8" />
          </svg>
        )}
      </button>
      <pre className={props.preClassName}>
        <code>{content}</code>
      </pre>
    </div>
  )
}

export function formatRawData(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}
