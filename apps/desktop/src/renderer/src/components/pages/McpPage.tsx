export function McpPage(props: {
  busy: boolean
  mcp: unknown
  onRefresh: () => void
}) {
  return (
    <section className="page-panel workbench-main">
      <div className="page-title">
        <div>
          <p className="eyebrow">MCP 管理</p>
          <h2>当前 MCP 配置</h2>
        </div>
        <button className="secondary" disabled={props.busy} onClick={props.onRefresh}>
          刷新 MCP
        </button>
      </div>
      <pre>{JSON.stringify(props.mcp ?? { servers: [], errors: [] }, null, 2)}</pre>
    </section>
  )
}
