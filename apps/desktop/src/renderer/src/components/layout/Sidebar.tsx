import type { PageId } from '../../domain/displayTypes.js'

type NavIconName = 'chat' | 'models' | 'mcp' | 'logs' | 'settings'

export function Sidebar(props: {
  page: PageId
  onChangePage: (page: PageId) => void
}) {
  return (
    <aside className="sidebar">
      <nav className="nav">
        <button
          className={`nav-item ${props.page === 'chat' ? 'active' : ''}`}
          title="聊天"
          onClick={() => props.onChangePage('chat')}
        >
          <NavIcon name="chat" />
          <span className="nav-label">聊天</span>
        </button>
        <button
          className={`nav-item ${props.page === 'models' ? 'active' : ''}`}
          title="模型与供应商"
          onClick={() => props.onChangePage('models')}
        >
          <NavIcon name="models" />
          <span className="nav-label">模型</span>
        </button>
        <button
          className={`nav-item ${props.page === 'mcp' ? 'active' : ''}`}
          title="MCP"
          onClick={() => props.onChangePage('mcp')}
        >
          <NavIcon name="mcp" />
          <span className="nav-label">MCP</span>
        </button>
        <button
          className={`nav-item ${props.page === 'logs' ? 'active' : ''}`}
          title="日志"
          onClick={() => props.onChangePage('logs')}
        >
          <NavIcon name="logs" />
          <span className="nav-label">日志</span>
        </button>
      </nav>
      <nav className="nav sidebar-footer" aria-label="设置">
        <button
          className={`nav-item ${props.page === 'settings' ? 'active' : ''}`}
          title="设置"
          onClick={() => props.onChangePage('settings')}
        >
          <NavIcon name="settings" />
          <span className="nav-label">设置</span>
        </button>
      </nav>
    </aside>
  )
}

function NavIcon(props: { name: NavIconName }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.name === 'chat' ? (
        <>
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.9 8.9 0 0 1-3.9-.9L3 21l1.9-5.1a8.4 8.4 0 0 1-.9-3.9A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z" />
        </>
      ) : null}
      {props.name === 'models' ? (
        <>
          <path d="M12 3 4.8 7.1v8.2L12 19.5l7.2-4.2V7.1Z" />
          <path d="M12 11.3 4.9 7.2" />
          <path d="m12 11.3 7.1-4.1" />
          <path d="M12 11.3v8" />
          <path d="M7.2 15.8 12 18.6l4.8-2.8" />
        </>
      ) : null}
      {props.name === 'mcp' ? (
        <>
          <path d="m12 2.8 7.2 4.1v8.2L12 19.2l-7.2-4.1V6.9L12 2.8Z" />
          <path d="M12 11.2 4.9 7.1" />
          <path d="m12 11.2 7.1-4.1" />
          <path d="M12 11.2v8" />
        </>
      ) : null}
      {props.name === 'logs' ? (
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </>
      ) : null}
      {props.name === 'settings' ? (
        <>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2.1 2.1 0 0 1-3 3l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7V21a2.1 2.1 0 0 1-4.2 0v-.2a1.8 1.8 0 0 0-1.2-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 2 13.3H2a2.1 2.1 0 0 1 0-4.2h.2a1.8 1.8 0 0 0 1.7-1.2 1.8 1.8 0 0 0-.4-2l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7V1.5a2.1 2.1 0 0 1 4.2 0v.2a1.8 1.8 0 0 0 1.2 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.2a2.1 2.1 0 0 1 0 4.2h-.2a1.8 1.8 0 0 0-1.9 1.7Z" />
        </>
      ) : null}
    </svg>
  )
}
