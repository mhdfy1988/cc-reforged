import { useMemo, useState } from 'react'
import type { CapabilityManagementState } from '../../domain/displayTypes.js'
import {
  CapabilityDirectory,
  type CapabilityFilter,
  SearchGlyph,
  hasActionableDiagnostic,
  matchesCapabilityFilter,
  matchesCapabilitySearch,
} from './CapabilityCatalogParts.js'

export function CapabilitiesPage(props: {
  busy: boolean
  management: CapabilityManagementState | null
  onRefresh: () => void
}) {
  const capabilities = props.management?.capabilities ?? []
  const runtimeVisible = capabilities.filter(
    capability => capability.state.runtimeVisible,
  ).length
  const needsAttention = capabilities.filter(hasActionableDiagnostic).length
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CapabilityFilter>('all')
  const normalizedQuery = query.trim().toLocaleLowerCase()

  const filteredCapabilities = useMemo(
    () =>
      capabilities.filter(
        capability =>
          matchesCapabilitySearch(capability, normalizedQuery) &&
          matchesCapabilityFilter(capability, filter),
      ),
    [capabilities, filter, normalizedQuery],
  )

  return (
    <section className="page-panel plugins-page capability-page workbench-main">
      <header className="plugin-market-topbar">
        <div className="plugin-market-heading">
          <h2>能力目录</h2>
          <span>
            {capabilities.length} 个能力 · {runtimeVisible} 个运行时可见
            {needsAttention > 0 ? ` · ${needsAttention} 个需处理` : ''}
          </span>
        </div>
        <button
          className="ghost-action"
          disabled={props.busy}
          type="button"
          onClick={props.onRefresh}
        >
          刷新
        </button>
      </header>

      <CapabilityDirectory
        capabilities={capabilities}
        filteredCapabilities={filteredCapabilities}
        controls={
          <>
            <label className="plugin-market-search">
              <SearchGlyph />
              <input
                placeholder="搜索能力"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </label>
            <select
              className="plugin-market-filter"
              value={filter}
              onChange={event =>
                setFilter(event.target.value as CapabilityFilter)
              }
            >
              <option value="all">全部</option>
              <option value="runtime">运行时可见</option>
              <option value="attention">需处理</option>
              <option value="hidden">隐藏</option>
            </select>
          </>
        }
      />
    </section>
  )
}
