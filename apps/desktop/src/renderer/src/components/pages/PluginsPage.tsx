import type {
  CapabilityManagementItem,
  CapabilityManagementState,
} from '../../domain/displayTypes.js'

export function PluginsPage(props: {
  busy: boolean
  management: CapabilityManagementState | null
  onRefresh: () => void
}) {
  const management = props.management
  const plugins = management?.plugins ?? []

  return (
    <section className="page-panel plugins-page">
      <header className="models-page-title">
        <div>
          <h2>插件与能力</h2>
          <span>
            {management?.summary.plugins ?? 0} 个插件 ·{' '}
            {management?.summary.total ?? 0} 个能力 ·{' '}
            {management?.summary.runtimeVisible ?? 0} 个运行时可见
          </span>
        </div>
        <div className="models-title-actions">
          <button
            className="ghost-action"
            disabled={props.busy}
            type="button"
            onClick={props.onRefresh}
          >
            刷新
          </button>
        </div>
      </header>

      <div className="capability-summary-grid">
        <CapabilitySummary label="Skill" value={management?.summary.skills ?? 0} />
        <CapabilitySummary label="MCP" value={management?.summary.mcp ?? 0} />
        <CapabilitySummary
          label="运行时可见"
          value={management?.summary.runtimeVisible ?? 0}
        />
        <CapabilitySummary
          label="需处理"
          value={management?.summary.needsAttention ?? 0}
        />
      </div>

      <div className="plugin-bundle-list">
        {plugins.length > 0 ? (
          plugins.map(plugin => (
            <PluginBundle
              capabilities={management?.capabilities ?? []}
              key={plugin.capabilityId}
              plugin={plugin}
            />
          ))
        ) : (
          <div className="models-empty">暂无插件能力。</div>
        )}
      </div>
    </section>
  )
}

function CapabilitySummary(props: {
  label: string
  value: number
}) {
  return (
    <div className="capability-summary-item">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function PluginBundle(props: {
  capabilities: CapabilityManagementItem[]
  plugin: CapabilityManagementState['plugins'][number]
}) {
  const plugin = props.plugin
  const children = plugin.impact.childCapabilityIds
    .map(capabilityId =>
      props.capabilities.find(
        capability => capability.capabilityId === capabilityId,
      ),
    )
    .filter((capability): capability is CapabilityManagementItem =>
      Boolean(capability),
    )

  return (
    <section className="models-section plugin-bundle">
      <div className="models-section-head">
        <div>
          <h3>{plugin.displayName}</h3>
          <span>{plugin.source.pluginId ?? plugin.name}</span>
        </div>
        <div className="mcp-tags">
          <small className={plugin.state.enabled ? 'success' : 'warning'}>
            {plugin.state.enabled ? '已启用' : '已停用'}
          </small>
          <small>{children.length} 个子能力</small>
        </div>
      </div>

      {children.length > 0 ? (
        <div className="plugin-capability-list">
          {children.map(capability => (
            <div
              className="plugin-capability-item"
              key={capability.capabilityId}
            >
              <span>
                <strong>{capability.displayName}</strong>
                <em>{formatCapabilityRelation(capability)}</em>
              </span>
              <div className="mcp-tags">
                <small>{formatCapabilityKind(capability.kind)}</small>
                <small
                  className={
                    capability.state.runtimeVisible ? 'success' : 'warning'
                  }
                >
                  {capability.state.runtimeVisible ? '可见' : '隐藏'}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="models-empty">暂无子能力。</div>
      )}
    </section>
  )
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
