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
  const filterOptions = useMemo(
    () => buildFilterOptions(props.stats),
    [props.stats],
  )

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
    void props.onRefresh(normalizeFilters(filters))
  }

  function clearFilters(): void {
    setFilters({})
    void props.onRefresh({})
  }

  return (
    <section className="page-panel usage-page workbench-main">
      <header className="usage-title">
        <div>
          <p className="eyebrow">使用统计</p>
          <h2>Token 与成本</h2>
          <span>{props.stats?.usageEventsDir ?? 'usage-events 待加载'}</span>
        </div>
        <div className="usage-title-actions">
          <button className="secondary" disabled={props.busy} onClick={refreshWithFilters}>
            刷新统计
          </button>
        </div>
      </header>

      <div className="usage-filters" aria-label="使用统计过滤器">
        <label>
          <span>开始</span>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={event => updateFilter('from', dateInputToIso(event.target.value, false))}
          />
        </label>
        <label>
          <span>结束</span>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={event => updateFilter('to', dateInputToIso(event.target.value, true))}
          />
        </label>
        <FilterSelect
          label="Provider"
          options={filterOptions.providers}
          value={filters.provider}
          onChange={value => updateFilter('provider', value)}
        />
        <FilterSelect
          label="Profile"
          options={filterOptions.profiles}
          value={filters.profileId}
          onChange={value => updateFilter('profileId', value)}
        />
        <FilterSelect
          label="Model"
          options={filterOptions.models}
          value={filters.model}
          onChange={value => updateFilter('model', value)}
        />
        <FilterSelect
          label="Project"
          options={filterOptions.projects}
          value={filters.projectPath}
          onChange={value => updateFilter('projectPath', value)}
        />
        <label>
          <span>Session</span>
          <input
            placeholder="sessionId"
            value={filters.sessionId ?? ''}
            onChange={event => updateFilter('sessionId', event.target.value)}
          />
        </label>
        <label>
          <span>Thread</span>
          <input
            placeholder="threadId"
            value={filters.threadId ?? ''}
            onChange={event => updateFilter('threadId', event.target.value)}
          />
        </label>
        <button className="secondary" disabled={props.busy} onClick={clearFilters}>
          清空
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

          <div className="usage-grid">
            <section className="usage-panel">
              <div className="usage-panel-head">
                <strong>Provider</strong>
                <span>{props.stats.byProvider.length} 项</span>
              </div>
              <GroupTable groups={props.stats.byProvider} />
            </section>
            <section className="usage-panel">
              <div className="usage-panel-head">
                <strong>Model</strong>
                <span>{props.stats.byModel.length} 项</span>
              </div>
              <GroupTable groups={props.stats.byModel} />
            </section>
            <section className="usage-panel">
              <div className="usage-panel-head">
                <strong>Project</strong>
                <span>{props.stats.byProject.length} 项</span>
              </div>
              <GroupTable groups={props.stats.byProject} compact />
            </section>
            <section className="usage-panel">
              <div className="usage-panel-head">
                <strong>Profile</strong>
                <span>{props.stats.byProfile.length} 项</span>
              </div>
              <GroupTable groups={props.stats.byProfile} />
            </section>
          </div>

          <div className="usage-detail-grid">
            <section className="usage-panel usage-events-panel">
              <div className="usage-panel-head">
                <strong>调用明细</strong>
                <span>{props.stats.events.length} 条</span>
              </div>
              <div className="usage-event-list">
                {props.stats.events.length === 0 ? (
                  <div className="usage-empty compact">当前筛选无调用记录</div>
                ) : (
                  props.stats.events.map(event => (
                    <button
                      className={`usage-event-row ${
                        event.eventId === selectedEvent?.eventId ? 'active' : ''
                      }`}
                      key={event.eventId}
                      type="button"
                      onClick={() => setSelectedEventId(event.eventId)}
                    >
                      <span>
                        <strong>{event.model}</strong>
                        <small>
                          {formatDateTime(event.timestamp)} ·{' '}
                          {event.providerDisplayName ?? event.provider}
                        </small>
                      </span>
                      <em>{formatTokens(event.totalTokens)}</em>
                      <CostBadge event={event} />
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
        </>
      )}
    </section>
  )
}

function FilterSelect(props: {
  label: string
  options: Array<{ value: string; label: string }>
  value?: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span>{props.label}</span>
      <select
        value={props.value ?? ''}
        onChange={event => props.onChange(event.target.value)}
      >
        <option value="">全部</option>
        {props.options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SummaryTile(props: { title: string; group: UsageStatisticsGroup }) {
  return (
    <div className="usage-summary-tile">
      <span>{props.title}</span>
      <strong>{formatTokens(props.group.totalTokens)}</strong>
      <small>
        {props.group.eventCount} 次 · {formatCostGroup(props.group)}
      </small>
    </div>
  )
}

function GroupTable(props: {
  groups: UsageStatisticsGroup[]
  compact?: boolean
}) {
  if (props.groups.length === 0) {
    return <div className="usage-empty compact">暂无数据</div>
  }
  return (
    <div className="usage-table">
      {props.groups.slice(0, 8).map(group => (
        <div className="usage-table-row" key={group.key}>
          <span title={group.label}>{props.compact ? compactPath(group.label) : group.label}</span>
          <strong>{formatTokens(group.totalTokens)}</strong>
          <em>{formatCostGroup(group)}</em>
        </div>
      ))}
    </div>
  )
}

function CostBadge(props: { event: UsageStatisticsEvent }) {
  if (props.event.costStatus !== 'calculated') {
    return <span className="usage-cost-badge unknown">未知</span>
  }
  return <span className="usage-cost-badge">{formatUsd(props.event.costUSD ?? 0)}</span>
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
    ['Cost', event.costStatus === 'calculated' ? formatUsd(event.costUSD ?? 0) : '未知'],
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

function buildFilterOptions(stats: UsageStatisticsState | null): {
  providers: Array<{ value: string; label: string }>
  profiles: Array<{ value: string; label: string }>
  models: Array<{ value: string; label: string }>
  projects: Array<{ value: string; label: string }>
} {
  return {
    providers: (stats?.byProvider ?? []).map(group => ({
      value: group.key,
      label: group.label,
    })),
    profiles: (stats?.byProfile ?? []).map(group => ({
      value: group.key,
      label: group.label,
    })),
    models: (stats?.byModel ?? []).map(group => ({
      value: group.key,
      label: group.label,
    })),
    projects: (stats?.byProject ?? []).map(group => ({
      value: group.key,
      label: compactPath(group.label),
    })),
  }
}

function normalizeFilters(
  filters: UsageStatisticsFilters,
): UsageStatisticsFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value),
  ) as UsageStatisticsFilters
}

function dateInputToIso(value: string, endOfDay: boolean): string {
  if (!value) {
    return ''
  }
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
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

function formatUsd(value: number): string {
  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`
}

function formatCostGroup(group: UsageStatisticsGroup): string {
  const known = formatUsd(group.knownCostUSD)
  return group.unknownCostEvents > 0
    ? `${known} · ${group.unknownCostEvents} 未知`
    : known
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return value
  }
  return date.toLocaleString()
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
