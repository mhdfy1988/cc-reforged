import { useMemo, useState } from 'react'
import type {
  UsageStatisticsEvent,
  UsageStatisticsGroup,
  UsageStatisticsState,
} from '../../domain/displayTypes.js'

export type UsageStatisticsFilters = {
  from?: string
  to?: string
  provider?: string
  profileId?: string
  model?: string
  projectPath?: string
  sessionId?: string
  threadId?: string
}

export function UsageStatisticsPage(props: {
  busy: boolean
  error: string | null
  stats: UsageStatisticsState | null
  onRefresh: (filters?: UsageStatisticsFilters) => Promise<void> | void
}) {
  const [filters, setFilters] = useState<UsageStatisticsFilters>({})
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const selectedEvent =
    props.stats?.events.find(event => event.eventId === selectedEventId) ??
    props.stats?.events[0] ??
    null
  const report = useMemo(() => buildUsageReport(props.stats), [props.stats])

  function updateFilter<K extends keyof UsageStatisticsFilters>(
    key: K,
    value: string,
  ): void {
    setFilters(current => ({
      ...current,
      [key]: value.trim() || undefined,
    }))
  }

  function refreshWithFilters(): void {
    void props.onRefresh(toRequestFilters(filters))
  }

  return (
    <section className="page-panel usage-page workbench-main">
      <header className="usage-title">
        <div>
          <h2>使用统计</h2>
        </div>
      </header>

      <div className="usage-filters" aria-label="使用统计过滤器">
        <label>
          <span>开始</span>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={event => updateFilter('from', event.target.value)}
          />
        </label>
        <label>
          <span>结束</span>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={event => updateFilter('to', event.target.value)}
          />
        </label>
        <button className="secondary" disabled={props.busy} onClick={refreshWithFilters}>
          查询
        </button>
      </div>

      {props.error ? <div className="usage-error">{props.error}</div> : null}

      {!props.stats ? (
        <div className="usage-empty">暂无统计数据</div>
      ) : (
        <>
          <div className="usage-summary-grid">
            <SummaryTile title="今天" group={props.stats.today} />
            <SummaryTile title="本月" group={props.stats.month} />
            <SummaryTile title="当前筛选" group={props.stats.totals} />
            <div className="usage-summary-tile">
              <span>文件</span>
              <strong>{props.stats.filesRead.length}</strong>
              <small>
                坏行 {props.stats.badLineCount} · 明细 {props.stats.events.length}
              </small>
            </div>
          </div>

          <div className="usage-dashboard-sections">
            <UsageReportSection
              title="供应商"
              days={report.days}
              tokenSeries={report.tokens.byProvider}
              eventSeries={report.events.byProvider}
            />
            <UsageReportSection
              title="模型"
              days={report.days}
              tokenSeries={report.tokens.byModel}
              eventSeries={report.events.byModel}
            />
            <UsageReportSection
              title="项目"
              days={report.days}
              tokenSeries={report.tokens.byProject}
              eventSeries={report.events.byProject}
            />
            <UsageReportSection
              title="配置"
              days={report.days}
              tokenSeries={report.tokens.byProfile}
              eventSeries={report.events.byProfile}
            />
          </div>

          <section className="usage-report-section">
            <h3>调用明细</h3>
            <div className="usage-report-grid">
              <section className="usage-panel usage-events-panel usage-report-panel">
                <div className="usage-panel-head">
                  <strong>调用列表</strong>
                  <span>{props.stats.events.length} 条</span>
                </div>
                <div className="usage-call-list">
                  {props.stats.events.length === 0 ? (
                    <div className="usage-empty compact">当前筛选无调用记录</div>
                  ) : (
                    props.stats.events.map(event => (
                      <button
                        className={`usage-call-row ${
                          event.eventId === selectedEvent?.eventId ? 'active' : ''
                        }`}
                        key={event.eventId}
                        type="button"
                        onClick={() => setSelectedEventId(event.eventId)}
                      >
                        <span className="usage-call-main">
                          <strong>{event.model}</strong>
                          <small>
                            {formatDateTime(event.timestamp)} ·{' '}
                            {event.providerDisplayName ?? event.provider} ·{' '}
                            {compactPath(event.projectPath ?? event.cwd ?? '无')}
                          </small>
                        </span>
                        <span className="usage-call-token">
                          {formatTokens(event.totalTokens)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="usage-panel usage-event-detail">
                <div className="usage-panel-head">
                  <strong>调用事实</strong>
                  <span>{selectedEvent ? shortId(selectedEvent.eventId) : '无'}</span>
                </div>
                {selectedEvent ? <EventDetail event={selectedEvent} /> : null}
              </section>
            </div>
          </section>
        </>
      )}
    </section>
  )
}

function SummaryTile(props: { title: string; group: UsageStatisticsGroup }) {
  return (
    <div className="usage-summary-tile">
      <span>{props.title}</span>
      <strong>{formatTokens(props.group.totalTokens)}</strong>
      <small>{props.group.eventCount} 次调用</small>
    </div>
  )
}

function EventDetail(props: { event: UsageStatisticsEvent }) {
  const event = props.event
  const rows = [
    ['时间', formatDateTime(event.timestamp)],
    ['Provider', event.providerDisplayName ?? event.provider],
    ['Profile', event.profileName ?? event.profileId ?? '未知'],
    ['Model', event.model],
    ['Input', formatTokens(event.inputTokens)],
    ['Output', formatTokens(event.outputTokens)],
    ['Cache read', formatTokens(event.cacheReadInputTokens)],
    ['Cache write', formatTokens(event.cacheCreationInputTokens)],
    ['Total', formatTokens(event.totalTokens)],
    ['Request', event.requestId ?? '无'],
    ['Session', event.sessionId ?? '无'],
    ['Thread', event.threadId ?? '无'],
    ['Turn', event.turnId ?? '无'],
    ['Project', event.projectPath ?? event.cwd ?? '无'],
  ]
  return (
    <dl className="usage-detail-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

type UsageDayPoint = {
  key: string
  label: string
}

type UsageChartSeries = {
  key: string
  label: string
  color: string
  values: Map<string, number>
}

type UsageReportMetricSet = {
  byProvider: UsageChartSeries[]
  byModel: UsageChartSeries[]
  byProject: UsageChartSeries[]
  byProfile: UsageChartSeries[]
}

type UsageReportData = {
  days: UsageDayPoint[]
  tokens: UsageReportMetricSet
  events: UsageReportMetricSet
}

type UsageChartSeriesMapSet = {
  byProvider: Map<string, UsageChartSeries>
  byModel: Map<string, UsageChartSeries>
  byProject: Map<string, UsageChartSeries>
  byProfile: Map<string, UsageChartSeries>
}

const CHART_COLORS = [
  '#6f7786',
  '#1677c6',
  '#00a878',
  '#f04b35',
  '#f5a400',
  '#7d5bd6',
  '#c2568f',
  '#2f9ca0',
]

function UsageReportSection(props: {
  title: string
  days: UsageDayPoint[]
  tokenSeries: UsageChartSeries[]
  eventSeries: UsageChartSeries[]
}) {
  return (
    <section className="usage-report-section">
      <h3>{props.title}</h3>
      <div className="usage-dashboard-grid">
        <UsageReportPanel
          title="Token 使用量"
          days={props.days}
          series={props.tokenSeries}
          valueKind="tokens"
        />
        <UsageReportPanel
          title="调用次数"
          days={props.days}
          series={props.eventSeries}
          valueKind="events"
        />
      </div>
    </section>
  )
}

function UsageReportPanel(props: {
  title: string
  days: UsageDayPoint[]
  series: UsageChartSeries[]
  valueKind: 'tokens' | 'events'
}) {
  return (
    <section className="usage-panel usage-report-card">
      <div className="usage-panel-head">
        <strong>{props.title}</strong>
        <span>{props.series.length} 项</span>
      </div>
      <DailyUsageChart
        days={props.days}
        series={props.series}
        valueKind={props.valueKind}
      />
    </section>
  )
}

function DailyUsageChart(props: {
  days: UsageDayPoint[]
  series: UsageChartSeries[]
  valueKind: 'tokens' | 'events'
}) {
  const series = props.series
  const [tooltip, setTooltip] = useState<{
    day: string
    label: string
    value: number
    left: number
    top: number
    placement: 'above' | 'below'
  } | null>(null)
  const points = props.days.length > 0 ? props.days : []
  const maxValue = Math.max(
    1,
    ...points.map(day =>
      series.reduce((sum, item) => sum + (item.values.get(day.key) ?? 0), 0),
    ),
  )
  const formatValue =
    props.valueKind === 'tokens' ? formatTokens : (value: number) => String(value)
  return (
    <div className="usage-chart">
      <div className="usage-chart-scale">
        <span>{formatValue(maxValue)}</span>
        <span>{formatValue(Math.round(maxValue / 2))}</span>
        <span>0</span>
      </div>
      <svg className="usage-bar-chart" viewBox="0 0 720 210" preserveAspectRatio="none">
        <line x1="0" y1="26" x2="720" y2="26" />
        <line x1="0" y1="104" x2="720" y2="104" />
        <line x1="0" y1="182" x2="720" y2="182" />
        {points.map((day, index) => {
          const slot = 720 / Math.max(1, points.length)
          const width = Math.max(5, Math.min(22, slot * 0.42))
          const x = index * slot + (slot - width) / 2
          let stackedHeight = 0
          return series.map(item => {
            const value = item.values.get(day.key) ?? 0
            const height = value > 0 ? Math.max(3, (value / maxValue) * 156) : 0
            stackedHeight += height
            const y = 182 - stackedHeight
            return (
              <rect
                key={`${day.key}:${item.key}`}
                x={x}
                y={y}
                width={width}
                height={height}
                className="usage-chart-segment"
                rx="3"
                onMouseEnter={() =>
                  setTooltip({
                    day: day.label,
                    label: item.label,
                    value,
                    left: ((index + 0.5) / Math.max(1, points.length)) * 100,
                    top: (y / 210) * 100,
                    placement: y < 58 ? 'below' : 'above',
                  })
                }
                onMouseLeave={() => setTooltip(null)}
                style={{ fill: item.color }}
              />
            )
          })
        })}
      </svg>
      <div className="usage-chart-axis">
        <span>{points[0]?.label ?? '-'}</span>
        <span>{points.at(-1)?.label ?? '-'}</span>
      </div>
      {tooltip ? (
        <div
          className="usage-chart-tooltip"
          data-placement={tooltip.placement}
          style={{
            left: `${tooltip.left}%`,
            top: `${tooltip.top}%`,
          }}
        >
          <strong>{tooltip.label}</strong>
          <span>{tooltip.day}</span>
          <em>{formatValue(tooltip.value)}</em>
        </div>
      ) : null}
      <div className="usage-chart-legend">
        {series.length === 0 ? (
          <span>暂无数据</span>
        ) : (
          series.map(item => (
            <span key={item.key}>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function buildUsageReport(stats: UsageStatisticsState | null): UsageReportData {
  if (!stats) {
    return emptyUsageReport()
  }
  const dayKeys = new Map<string, UsageDayPoint>()
  const tokenMaps = createDimensionMaps()
  const eventMaps = createDimensionMaps()

  for (const event of stats.events) {
    const dayKey = dateKey(event.timestamp)
    dayKeys.set(dayKey, { key: dayKey, label: formatDayLabel(dayKey) })
    addDimensionValue(
      tokenMaps.byProvider,
      event.provider,
      event.providerDisplayName ?? event.provider,
      dayKey,
      event.totalTokens,
    )
    addDimensionValue(tokenMaps.byModel, event.model, event.model, dayKey, event.totalTokens)
    addDimensionValue(
      tokenMaps.byProject,
      event.projectPath ?? event.cwd ?? '未知项目',
      compactPath(event.projectPath ?? event.cwd ?? '未知项目'),
      dayKey,
      event.totalTokens,
    )
    addDimensionValue(
      tokenMaps.byProfile,
      event.profileId ?? 'unknown-profile',
      event.profileName ?? event.profileId ?? '未知配置',
      dayKey,
      event.totalTokens,
    )
    addDimensionValue(
      eventMaps.byProvider,
      event.provider,
      event.providerDisplayName ?? event.provider,
      dayKey,
      1,
    )
    addDimensionValue(eventMaps.byModel, event.model, event.model, dayKey, 1)
    addDimensionValue(
      eventMaps.byProject,
      event.projectPath ?? event.cwd ?? '未知项目',
      compactPath(event.projectPath ?? event.cwd ?? '未知项目'),
      dayKey,
      1,
    )
    addDimensionValue(
      eventMaps.byProfile,
      event.profileId ?? 'unknown-profile',
      event.profileName ?? event.profileId ?? '未知配置',
      dayKey,
      1,
    )
  }

  return {
    days: Array.from(dayKeys.values()).sort((a, b) => a.key.localeCompare(b.key)),
    tokens: finalizeDimensionMaps(tokenMaps),
    events: finalizeDimensionMaps(eventMaps),
  }
}

function emptyUsageReport(): UsageReportData {
  return {
    days: [],
    tokens: emptyMetricSet(),
    events: emptyMetricSet(),
  }
}

function emptyMetricSet(): UsageReportMetricSet {
  return {
    byProvider: [],
    byModel: [],
    byProject: [],
    byProfile: [],
  }
}

function createDimensionMaps(): UsageChartSeriesMapSet {
  return {
    byProvider: new Map<string, UsageChartSeries>(),
    byModel: new Map<string, UsageChartSeries>(),
    byProject: new Map<string, UsageChartSeries>(),
    byProfile: new Map<string, UsageChartSeries>(),
  }
}

function addDimensionValue(
  target: Map<string, UsageChartSeries>,
  key: string,
  label: string,
  dayKey: string,
  value: number,
): void {
  const series = target.get(key) ?? {
    key,
    label,
    color: CHART_COLORS[target.size % CHART_COLORS.length],
    values: new Map<string, number>(),
  }
  series.values.set(dayKey, (series.values.get(dayKey) ?? 0) + value)
  target.set(key, series)
}

function finalizeDimensionMaps(
  maps: UsageChartSeriesMapSet,
): UsageReportMetricSet {
  return {
    byProvider: finalizeSeries(maps.byProvider),
    byModel: finalizeSeries(maps.byModel),
    byProject: finalizeSeries(maps.byProject),
    byProfile: finalizeSeries(maps.byProfile),
  }
}

function finalizeSeries(
  target: Map<string, UsageChartSeries>,
): UsageChartSeries[] {
  return Array.from(target.values())
    .sort((a, b) => getSeriesTotal(b) - getSeriesTotal(a))
    .slice(0, 6)
}

function getSeriesTotal(series: UsageChartSeries): number {
  return Array.from(series.values.values()).reduce(
    (sum, value) => sum + value,
    0,
  )
}

function toRequestFilters(
  filters: UsageStatisticsFilters,
): UsageStatisticsFilters {
  return normalizeFilters({
    ...filters,
    from: dateInputToIso(filters.from ?? '', false),
    to: dateInputToIso(filters.to ?? '', true),
  })
}

function dateInputToIso(value: string, endOfDay: boolean): string {
  if (!value) {
    return ''
  }
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
}

function normalizeFilters(
  filters: UsageStatisticsFilters,
): UsageStatisticsFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value),
  ) as UsageStatisticsFilters
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return String(value)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function dateKey(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function formatDayLabel(value: string): string {
  const [, month, day] = value.split('-')
  return month && day ? `${Number(month)}/${Number(day)}` : value
}

function compactPath(value: string): string {
  const normalized = value.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 2) {
    return value
  }
  return `${parts.at(-2)}/${parts.at(-1)}`
}

function shortId(value: string): string {
  return value.length > 10 ? value.slice(0, 10) : value
}
