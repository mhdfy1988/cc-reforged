import { ChatTimeline } from '../chat/ChatTimeline.js'
import { Composer } from '../layout/Composer.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  PermissionCard,
  TurnRuntimeMetadata,
} from '../../domain/displayTypes.js'
import type { TodoOverlaySnapshot } from '../../domain/todoEvents.js'

export function ChatPage(props: {
  activeTurnId: string | null
  busy: boolean
  canInterruptTurn: boolean
  events: DisplayEvent[]
  permissions: PermissionCard[]
  prompt: string
  threadTitle: string | undefined
  turnMetadata: TurnRuntimeMetadata | null
  todoOverlay: TodoOverlaySnapshot | null
  onChangePrompt: (prompt: string) => void
  onInterrupt: () => void
  onRespondPermission: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
  ) => Promise<void>
  onSend: () => void
  onStartThread: () => void
}) {
  return (
    <>
      <section className="workbench-main">
        <div className="workbench-head">
          <div className="session-meta">{props.threadTitle ?? '当前会话'}</div>
          <div className="head-actions">
            <TurnRuntimeDetails metadata={props.turnMetadata} />
            <button
              className="head-btn"
              disabled={props.busy}
              onClick={props.onStartThread}
            >
              新建会话
            </button>
          </div>
        </div>

        <ChatTimeline
          activeTurnId={props.activeTurnId}
          canInterruptTurn={props.canInterruptTurn}
          events={props.events}
          permissions={props.permissions}
          todoOverlay={props.todoOverlay}
          onRespondPermission={props.onRespondPermission}
        />
      </section>

      <Composer
        activeTurnId={props.activeTurnId}
        busy={props.busy}
        canInterruptTurn={props.canInterruptTurn}
        prompt={props.prompt}
        onChangePrompt={props.onChangePrompt}
        onInterrupt={props.onInterrupt}
        onSend={props.onSend}
      />
    </>
  )
}

function TurnRuntimeDetails(props: {
  metadata: TurnRuntimeMetadata | null
}) {
  const metadata = props.metadata
  if (!metadata) {
    return null
  }

  return (
    <details className="turn-runtime-details">
      <summary>运行详情</summary>
      <dl>
        <div>
          <dt>状态</dt>
          <dd>{metadata.status ?? '未知'}</dd>
        </div>
        <div>
          <dt>模型</dt>
          <dd>{metadata.model ?? '未知'}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>
            {formatNumber(metadata.usage?.totalTokens)} /{' '}
            {formatNumber(metadata.contextWindow)}
          </dd>
        </div>
        <div>
          <dt>耗时</dt>
          <dd>{formatDuration(metadata.latencyMs)}</dd>
        </div>
        <div>
          <dt>停止原因</dt>
          <dd>{metadata.stopReason ?? '未知'}</dd>
        </div>
        <div>
          <dt>请求 ID</dt>
          <dd>{metadata.requestId ?? '未返回'}</dd>
        </div>
      </dl>
    </details>
  )
}

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('zh-CN')
    : '未知'
}

function formatDuration(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '未知'
  }
  if (value < 1000) {
    return `${value}ms`
  }
  return `${(value / 1000).toFixed(1)}s`
}
