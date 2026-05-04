import type { PageId } from '../../domain/displayTypes.js'

export function Sidebar(props: {
  appServerStatus: string | undefined
  page: PageId
  onChangePage: (page: PageId) => void
}) {
  return (
    <aside className="sidebar">
      <nav className="nav">
        <button
          className={`nav-item ${props.page === 'chat' ? 'active' : ''}`}
          onClick={() => props.onChangePage('chat')}
        >
          聊天
        </button>
        <button
          className={`nav-item ${props.page === 'mcp' ? 'active' : ''}`}
          onClick={() => props.onChangePage('mcp')}
        >
          MCP
        </button>
        <button
          className={`nav-item ${props.page === 'settings' ? 'active' : ''}`}
          onClick={() => props.onChangePage('settings')}
        >
          设置
        </button>
        <button
          className={`nav-item ${props.page === 'logs' ? 'active' : ''}`}
          onClick={() => props.onChangePage('logs')}
        >
          日志
        </button>
      </nav>
      <div className="core-pill">
        <span className={props.appServerStatus === 'ready' ? 'dot ok' : 'dot warn'} />
        {props.appServerStatus ?? 'starting'}
      </div>
    </aside>
  )
}
