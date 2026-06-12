import type { ReactNode } from 'react'
import type { CapabilityManagementItem } from '../../domain/displayTypes.js'

export type CapabilityFilter = 'all' | 'runtime' | 'attention' | 'hidden'

export function CapabilityDirectory(props: {
  capabilities: CapabilityManagementItem[]
  filteredCapabilities: CapabilityManagementItem[]
  controls?: ReactNode
}) {
  return (
    <section className="capability-directory-panel">
      {props.controls ? (
        <div className="capability-directory-controls">{props.controls}</div>
      ) : null}
      {props.filteredCapabilities.length > 0 ? (
        <div className="capability-directory-list">
          {props.filteredCapabilities.map(capability => (
            <CapabilityRow
              capability={capability}
              key={capability.capabilityId}
            />
          ))}
        </div>
      ) : (
        <div className="models-empty">没有匹配能力。</div>
      )}
    </section>
  )
}

export function CapabilityRow(props: {
  capability: CapabilityManagementItem
}) {
  return (
    <div className="capability-directory-row">
      <CapabilityAvatar capability={props.capability} />
      <span>
        <strong>{props.capability.displayName}</strong>
        <em>{formatCapabilityRelation(props.capability)}</em>
      </span>
      <div className="mcp-tags">
        <small>{formatCapabilityKind(props.capability.kind)}</small>
        <StatusPill capability={props.capability} />
      </div>
    </div>
  )
}

export function CapabilityMetric(props: {
  label: string
  value: number
}) {
  return (
    <div className="plugin-detail-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

export function CapabilityAvatar(props: {
  capability: CapabilityManagementItem
  large?: boolean
}) {
  return (
    <span
      className={`capability-avatar ${props.large ? 'large' : ''}`}
      aria-hidden="true"
    >
      {formatCapabilityInitial(props.capability)}
    </span>
  )
}

export function StatusPill(props: { capability: CapabilityManagementItem }) {
  const status = getCapabilityStatusText(props.capability)
  return <small className={status.className}>{status.label}</small>
}

export function SearchGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="m20 20-4.2-4.2m1.2-4.8a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export function hasActionableDiagnostic(
  capability: CapabilityManagementItem,
): boolean {
  return capability.diagnostics.some(diagnostic => diagnostic.severity !== 'info')
}

export function matchesCapabilitySearch(
  capability: CapabilityManagementItem,
  query: string,
): boolean {
  if (!query) return true
  return [
    capability.displayName,
    capability.name,
    capability.description,
    capability.source.label,
    capability.source.pluginId,
    capability.relations.parentPluginId,
    capability.relations.parentMcpServerName,
  ]
    .filter(Boolean)
    .some(value => value!.toLocaleLowerCase().includes(query))
}

export function matchesCapabilityFilter(
  capability: CapabilityManagementItem,
  filter: CapabilityFilter,
): boolean {
  switch (filter) {
    case 'runtime':
      return capability.state.runtimeVisible
    case 'attention':
      return hasActionableDiagnostic(capability)
    case 'hidden':
      return !capability.state.runtimeVisible
    case 'all':
    default:
      return true
  }
}

function getCapabilityStatusText(capability: CapabilityManagementItem): {
  className: string
  label: string
} {
  if (hasActionableDiagnostic(capability)) {
    return { className: 'warning', label: '需处理' }
  }
  if (!capability.state.enabled) {
    return { className: 'warning', label: '已停用' }
  }
  if (capability.state.runtimeVisible) {
    return { className: 'success', label: '可见' }
  }
  if (!capability.state.available) {
    return { className: 'warning', label: '不可用' }
  }
  return { className: '', label: '已启用' }
}

function formatCapabilityInitial(capability: CapabilityManagementItem): string {
  const labels: Record<CapabilityManagementItem['kind'], string> = {
    skill: 'S',
    'mcp-server': 'M',
    'mcp-tool': 'T',
    'mcp-resource': 'R',
    'mcp-prompt': 'P',
    tool: 'T',
    command: 'C',
    plugin: 'P',
    app: 'A',
  }
  return labels[capability.kind]
}

function formatCapabilityRelation(
  capability: CapabilityManagementItem,
): string {
  const parent = capability.relations.parentMcpServerName
  const hidden = capability.hiddenReasons.join('、')
  return [
    parent ? `MCP ${parent}` : capability.source.label,
    hidden || capability.description,
  ]
    .filter(Boolean)
    .join(' · ')
}

function formatCapabilityKind(
  kind: CapabilityManagementItem['kind'],
): string {
  const labels: Record<CapabilityManagementItem['kind'], string> = {
    skill: 'Skill',
    'mcp-server': 'MCP Server',
    'mcp-tool': 'MCP Tool',
    'mcp-resource': 'MCP Resource',
    'mcp-prompt': 'MCP Prompt',
    tool: 'Tool',
    command: 'Command',
    plugin: 'Plugin',
    app: 'App',
  }
  return labels[kind]
}
