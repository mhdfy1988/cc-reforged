import { useEffect, useMemo, useRef, useState } from 'react'
import type { CcrDesktopEvent } from '../../global.js'
import type { LogSnapshot } from '../../domain/displayTypes.js'
import { RawDataBlock } from '../common/RawDataBlock.js'

const LOG_FILE_ORDER = [
  'main.log',
  'app-server.stderr.log',
  'renderer.log',
  'client-error.log',
] as const

const MEMORY_SOURCE_ID = 'current-events'
const LIVE_REFRESH_INTERVAL_MS = 3000

type ParsedLogLevel = 'info' | 'warn' | 'error' | 'raw'

type ParsedLogEntry = {
  id: string
  fileName: string
  at?: string
  level: ParsedLogLevel
  kind: string
  summary: string
  raw: string
  parsed?: Record<string, unknown>
}

type LogSource = {
  id: string
  label: string
  path?: string
  entries: ParsedLogEntry[]
}

export function LogsPage(props: {
  busy: boolean
  events: CcrDesktopEvent[]
  logSnapshot: LogSnapshot | null
  onRefresh: () => Promise<void> | void
}) {
  const [activeSourceId, setActiveSourceId] = useState<string>(LOG_FILE_ORDER[0])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'events' | 'raw'>('events')
  const [liveRefresh, setLiveRefresh] = useState(false)
  const onRefreshRef = useRef(props.onRefresh)
  const busyRef = useRef(props.busy)
  const liveRefreshInFlightRef = useRef(false)

  const sources = useMemo(
    () => buildLogSources(props.logSnapshot, props.events),
    [props.events, props.logSnapshot],
  )

  useEffect(() => {
    if (!sources.some(source => source.id === activeSourceId)) {
      setActiveSourceId(sources[0]?.id ?? MEMORY_SOURCE_ID)
      setSelectedEntryId(null)
    }
  }, [activeSourceId, sources])

  useEffect(() => {
    onRefreshRef.current = props.onRefresh
  }, [props.onRefresh])

  useEffect(() => {
    busyRef.current = props.busy
  }, [props.busy])

  useEffect(() => {
    if (!liveRefresh) {
      return
    }

    let disposed = false
    const refreshLiveLogs = async (): Promise<void> => {
      if (disposed || busyRef.current || liveRefreshInFlightRef.current) {
        return
      }

      liveRefreshInFlightRef.current = true
      try {
        await onRefreshRef.current()
      } catch (error) {
        console.error('Failed to refresh live logs', error)
      } finally {
        liveRefreshInFlightRef.current = false
      }
    }

    void refreshLiveLogs()
    const timer = window.setInterval(() => {
      void refreshLiveLogs()
    }, LIVE_REFRESH_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [liveRefresh])

  const activeSource =
    sources.find(source => source.id === activeSourceId) ?? sources[0]
  const filteredEntries = useMemo(
    () => filterEntries(activeSource?.entries ?? [], query),
    [activeSource?.entries, query],
  )
  const selectedEntry =
    filteredEntries.find(entry => entry.id === selectedEntryId) ??
    filteredEntries[0] ??
    null
  const rawText = filteredEntries.map(entry => entry.raw).join('\n')

  return (
    <section className="page-panel logs logs-workbench workbench-main">
      <header className="logs-title">
        <div>
          <p className="eyebrow">运行日志</p>
          <h2>最近事件</h2>
          <span>{props.logSnapshot?.logDir ?? '日志目录待加载'}</span>
        </div>
        <div className="logs-title-actions">
          <button className="secondary" disabled={props.busy} onClick={props.onRefresh}>
            刷新日志
          </button>
          <button
            aria-pressed={liveRefresh}
            className={`logs-live-toggle ${liveRefresh ? 'active' : ''}`}
            type="button"
            onClick={() => setLiveRefresh(current => !current)}
          >
            <span aria-hidden="true" className="logs-live-dot" />
            {liveRefresh ? '实时中' : '实时'}
          </button>
        </div>
      </header>

      <div className="logs-grid">
        <aside className="logs-source-panel" aria-label="日志来源">
          <div className="logs-column-head">
            <strong>日志文件</strong>
            <span>{sources.length} 项</span>
          </div>
          <div className="logs-source-list">
            {sources.map(source => (
              <button
                className={`logs-source-item ${
                  source.id === activeSource?.id ? 'active' : ''
                }`}
                key={source.id}
                type="button"
                onClick={() => {
                  setActiveSourceId(source.id)
                  setSelectedEntryId(null)
                }}
              >
                <span>
                  <strong>{source.label}</strong>
                  <small>{source.path ?? '当前进程'}</small>
                </span>
                <em>最近 {source.entries.length} 条</em>
              </button>
            ))}
          </div>
        </aside>

        <main className="logs-event-panel">
          <div className="logs-toolbar">
            <div className="logs-column-head">
              <strong>{activeSource?.label ?? '日志'}</strong>
              <span>最近 {activeSource?.entries.length ?? 0} 条</span>
            </div>
            <div className="logs-tools">
              <div className="logs-view-toggle" role="tablist" aria-label="日志视图">
                <button
                  className={viewMode === 'events' ? 'active' : ''}
                  type="button"
                  onClick={() => setViewMode('events')}
                >
                  事件
                </button>
                <button
                  className={viewMode === 'raw' ? 'active' : ''}
                  type="button"
                  onClick={() => setViewMode('raw')}
                >
                  原始
                </button>
              </div>
              <input
                aria-label="搜索日志"
                placeholder="搜索日志"
                value={query}
                onChange={event => {
                  setQuery(event.target.value)
                  setSelectedEntryId(null)
                }}
              />
            </div>
          </div>

          {viewMode === 'events' ? (
            <div className="logs-event-list">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry, index) => (
                  <button
                    className={`logs-event-row ${
                      selectedEntry?.id === entry.id ? 'active' : ''
                    }`}
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntryId(entry.id)}
                  >
                    <span className={`logs-level ${entry.level}`}>
                      {getLevelLabel(entry.level)}
                    </span>
                    <span className="logs-event-main">
                      <strong>{entry.summary}</strong>
                      <small>
                        {formatTime(entry.at)} · {entry.kind}
                      </small>
                    </span>
                    <em>#{filteredEntries.length - index}</em>
                  </button>
                ))
              ) : (
                <div className="logs-empty">暂无日志内容</div>
              )}
            </div>
          ) : (
            <RawDataBlock
              preClassName="logs-raw-view"
              text={rawText || '暂无日志内容'}
            />
          )}
        </main>

        <aside className="logs-detail-panel" aria-label="事件详情">
          <div className="logs-column-head">
            <strong>事件详情</strong>
            <span>{selectedEntry ? getLevelLabel(selectedEntry.level) : '空'}</span>
          </div>
          {selectedEntry ? (
            <div className="logs-detail-body">
              <dl className="logs-detail-facts">
                <div>
                  <dt>时间</dt>
                  <dd>{formatTime(selectedEntry.at)}</dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd>{selectedEntry.fileName}</dd>
                </div>
                <div>
                  <dt>类型</dt>
                  <dd>{selectedEntry.kind}</dd>
                </div>
                <div>
                  <dt>摘要</dt>
                  <dd>{selectedEntry.summary}</dd>
                </div>
              </dl>
              <div className="logs-raw-card">
                <strong>原始 JSON</strong>
                <RawDataBlock text={formatRawDetail(selectedEntry)} />
              </div>
            </div>
          ) : (
            <div className="logs-empty">请选择事件</div>
          )}
        </aside>
      </div>
    </section>
  )
}

function buildLogSources(
  snapshot: LogSnapshot | null,
  events: CcrDesktopEvent[],
): LogSource[] {
  const files = snapshot?.files ?? []
  const fileByName = new Map(files.map(file => [file.name, file]))
  const orderedNames = [
    ...LOG_FILE_ORDER,
    ...files
      .map(file => file.name)
      .filter(name => !LOG_FILE_ORDER.includes(name as (typeof LOG_FILE_ORDER)[number])),
  ]

  const fileSources = orderedNames.map(name => {
    const file = fileByName.get(name)
    const entries = parseLogContent(name, file?.content ?? '')

    return {
      id: name,
      label: name,
      path: file?.path,
      entries,
    }
  })

  return [
    ...fileSources,
    {
      id: MEMORY_SOURCE_ID,
      label: '当前事件',
      entries: parseCurrentEvents(events),
    },
  ]
}

function parseLogContent(fileName: string, content: string): ParsedLogEntry[] {
  return content
    .split(/\r?\n/)
    .map((line, lineIndex): ParsedLogEntry | null => {
      const raw = line.trim()
      if (!raw) {
        return null
      }

      try {
        const parsed = JSON.parse(raw)
        const record = asRecord(parsed)
        if (!record) {
          return createRawEntry(fileName, raw, lineIndex)
        }

        return {
          id: `${fileName}-${lineIndex}`,
          fileName,
          at: getString(record.at),
          level: inferLevel(fileName, record),
          kind: inferKind(record),
          summary: inferSummary(fileName, record),
          raw,
          parsed: record,
        }
      } catch {
        return createRawEntry(fileName, raw, lineIndex)
      }
    })
    .filter((entry): entry is ParsedLogEntry => Boolean(entry))
    .reverse()
}

function parseCurrentEvents(events: CcrDesktopEvent[]): ParsedLogEntry[] {
  return events.map((event, index) => {
    const payload = asRecord(event.payload)
    const parsed = {
      type: event.type,
      payload: event.payload,
      status: event.status,
      at: event.at,
    }

    return {
      id: `${MEMORY_SOURCE_ID}-${event.at}-${index}`,
      fileName: '当前事件',
      at: event.at,
      level: inferLevel('current-events', parsed),
      kind: getString(payload?.method) ?? event.type,
      summary: getString(payload?.method) ?? event.type,
      raw: safeStringify(parsed),
      parsed,
    }
  })
}

function createRawEntry(
  fileName: string,
  raw: string,
  lineIndex: number,
): ParsedLogEntry {
  return {
    id: `${fileName}-raw-${lineIndex}`,
    fileName,
    level: 'raw',
    kind: raw.startsWith('{') ? 'truncated' : 'raw',
    summary: raw.startsWith('{') ? '截断行' : summarizeValue(raw),
    raw,
  }
}

function filterEntries(entries: ParsedLogEntry[], query: string): ParsedLogEntry[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return entries
  }

  return entries.filter(entry =>
    [
      entry.fileName,
      entry.at,
      entry.kind,
      entry.summary,
      entry.raw,
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase()
      .includes(normalizedQuery),
  )
}

function inferSummary(fileName: string, record: Record<string, unknown>): string {
  const summary = asRecord(record.summary)
  const event = asRecord(record.event)

  if (fileName === 'main.log') {
    return firstSummary(
      getString(summary?.message),
      getString(record.message),
      getString(record.error),
      getString(record.type),
      record.summary,
    )
  }

  if (fileName === 'app-server.stderr.log') {
    const code = getString(event?.code) ?? formatUnknown(event?.code)
    const signal = getString(event?.signal) ?? formatUnknown(event?.signal)
    return firstSummary(
      getString(record.chunk),
      getString(event?.stderr),
      getString(event?.error),
      code && signal ? `退出 ${code}/${signal}` : undefined,
      record.event,
    )
  }

  if (fileName === 'client-error.log') {
    return firstSummary(
      getString(record.message),
      getString(record.kind),
      record.details,
    )
  }

  if (fileName === 'renderer.log') {
    const eventName = getString(record.event)
    const message = getString(record.message)
    return firstSummary(
      eventName && message ? `${eventName}: ${message}` : undefined,
      eventName,
      message,
    )
  }

  return firstSummary(
    getString(record.message),
    getString(record.type),
    getString(record.event),
    getString(record.kind),
    record,
  )
}

function inferKind(record: Record<string, unknown>): string {
  const payload = asRecord(record.payload)

  return firstSummary(
    getString(record.type),
    getString(record.event),
    getString(record.kind),
    getString(payload?.method),
    'raw',
  )
}

function inferLevel(
  fileName: string,
  record: Record<string, unknown>,
): ParsedLogLevel {
  if (fileName === 'client-error.log' || fileName === 'app-server.stderr.log') {
    return 'error'
  }

  const text = [
    getString(record.kind),
    getString(record.message),
    getString(record.error),
    getString(record.type),
    getString(record.event),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (text.includes('error') || text.includes('failed')) {
    return 'error'
  }
  if (text.includes('update')) {
    return 'warn'
  }

  return 'info'
}

function firstSummary(...values: unknown[]): string {
  for (const value of values) {
    const summary = summarizeValue(value)
    if (summary) {
      return summary
    }
  }

  return '无摘要'
}

function summarizeValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return truncate(value.trim())
  }
  if (value === null || value === undefined) {
    return undefined
  }

  return truncate(formatUnknown(value))
}

function formatUnknown(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'string') {
    return value
  }

  return safeStringify(value)
}

function formatRawDetail(entry: ParsedLogEntry): string {
  return entry.parsed ? safeStringify(entry.parsed) : entry.raw
}

function formatTime(value?: string): string {
  if (!value) {
    return '无时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getLevelLabel(level: ParsedLogLevel): string {
  if (level === 'error') {
    return '错误'
  }
  if (level === 'warn') {
    return '更新'
  }
  if (level === 'raw') {
    return '原始'
  }

  return '信息'
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function truncate(value: string, maxLength = 180): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}
