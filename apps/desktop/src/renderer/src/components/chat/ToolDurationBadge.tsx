import { useEffect, useState } from 'react'

export function ToolDurationBadge(props: {
  durationMs?: number
  startedAt?: string
  completedAt?: string
  status?: string
}) {
  const isLive = isLiveToolStatus(props.status)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!isLive || props.durationMs !== undefined || !props.startedAt) {
      return
    }
    const timer = window.setInterval(() => {
      setTick(value => value + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isLive, props.durationMs, props.startedAt])

  const durationMs =
    normalizeDurationMs(props.durationMs) ??
    inferDurationMs(props.startedAt, props.completedAt ?? (isLive ? new Date().toISOString() : undefined))

  if (durationMs === undefined) {
    return null
  }
  return (
    <span className="tool-duration-badge">
      耗时 {formatToolDurationMs(durationMs)}
    </span>
  )
}

export function formatToolDurationMs(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }
  const durationMs = Math.max(0, Math.round(value ?? 0))
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }
  if (durationMs < 60_000) {
    const seconds = durationMs / 1000
    return `${seconds >= 10 ? Math.round(seconds) : seconds.toFixed(1)}s`
  }
  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.round((durationMs % 60_000) / 1000)
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function normalizeDurationMs(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return Math.max(0, Math.round(value))
}

function inferDurationMs(
  startedAt: string | undefined,
  completedAt: string | undefined,
): number | undefined {
  if (!startedAt || !completedAt) {
    return undefined
  }
  const startedMs = Date.parse(startedAt)
  const completedMs = Date.parse(completedAt)
  if (!Number.isFinite(startedMs) || !Number.isFinite(completedMs)) {
    return undefined
  }
  return Math.max(0, completedMs - startedMs)
}

function isLiveToolStatus(status: string | undefined): boolean {
  return (
    status === 'preparing' ||
    status === 'waiting_permission' ||
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending'
  )
}
