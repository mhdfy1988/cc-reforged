import type { CcrDesktopEvent } from '../../global.js'
import type { LogSnapshot } from '../../domain/displayTypes.js'

export function LogsPage(props: {
  busy: boolean
  events: CcrDesktopEvent[]
  logSnapshot: LogSnapshot | null
  onRefresh: () => void
}) {
  return (
    <section className="page-panel logs workbench-main">
      <div className="page-title">
        <div>
          <p className="eyebrow">运行日志</p>
          <h2>最近事件</h2>
          <span>{props.logSnapshot?.logDir ?? '日志目录待加载'}</span>
        </div>
        <button className="secondary" disabled={props.busy} onClick={props.onRefresh}>
          刷新日志
        </button>
      </div>
      <div className="log-files">
        {(props.logSnapshot?.files ?? []).map(file => (
          <details className="event-card" key={file.name} open={Boolean(file.content)}>
            <summary>
              <span>{file.name}</span>
              <small>{file.content ? `${file.content.length} chars` : 'empty'}</small>
            </summary>
            <pre>{file.content || '暂无日志内容'}</pre>
          </details>
        ))}
      </div>
      <div className="page-title compact">
        <div>
          <p className="eyebrow">内存事件</p>
          <h2>最近 notification</h2>
        </div>
        <span>{props.events.length} events</span>
      </div>
      {props.events.map(event => (
        <details className="event-card" key={`${event.at}-${event.type}`}>
          <summary>
            <span>{event.type}</span>
            <small>{event.at}</small>
          </summary>
          <pre>{JSON.stringify(event.payload, null, 2)}</pre>
        </details>
      ))}
    </section>
  )
}
