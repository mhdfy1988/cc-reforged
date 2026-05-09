import { useState } from 'react'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  AttachmentSnapshot,
  FileSnapshot,
  FileToolAction,
  FileToolOperation,
  FileToolSnapshot,
  ReferenceSnapshot,
} from '../../domain/fileEvents.js'

type FileCardSnapshot =
  | { type: 'file'; value: FileSnapshot }
  | { type: 'reference'; value: ReferenceSnapshot }
  | { type: 'attachment'; value: AttachmentSnapshot }

export function FileCard(props: { event: DisplayEvent }) {
  const snapshot = getPrimarySnapshot(props.event)
  if (!snapshot) {
    return null
  }

  return (
    <div className="message system file-card">
      <b>{getAvatarText(snapshot)}</b>
      <FileSnapshotPanel event={props.event} />
    </div>
  )
}

export function FileSnapshotPanel(props: {
  event: DisplayEvent
  variant?: 'default' | 'compact'
}) {
  const snapshot = getPrimarySnapshot(props.event)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  if (!snapshot) {
    return null
  }

  const title = getSnapshotTitle(snapshot)
  const path = getDisplayPath(snapshot)
  const absolutePath = getAbsolutePath(snapshot)
  const workspaceRelativePath = getWorkspaceRelativePath(snapshot)
  const safety = getSafety(snapshot)
  const referenceText = getReferenceText(snapshot)
  const excerpt = getExcerpt(snapshot)
  const actionPath = getActionPath(snapshot)
  const variant = props.variant ?? 'default'
  const fileToolSnapshot = props.event.fileToolSnapshot
  const compactActions = getCompactActions(fileToolSnapshot, {
    actionPath,
    referenceText,
  })

  async function runAction(action: 'open' | 'copyPath' | 'copyReference' | 'reveal') {
    try {
      if (action === 'open' && actionPath) {
        await window.ccr.openPath(actionPath)
        setActionStatus('已请求打开')
      }
      if (action === 'reveal' && actionPath) {
        await window.ccr.showItemInFolder(actionPath)
        setActionStatus('已请求定位')
      }
      if (action === 'copyPath' && actionPath) {
        await window.ccr.copyText(actionPath)
        setActionStatus('已复制路径')
      }
      if (action === 'copyReference' && referenceText) {
        await window.ccr.copyText(referenceText)
        setActionStatus('已复制引用')
      }
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : '操作失败')
    }
  }

  if (variant === 'compact') {
    return (
      <div className="file-card-body file-card-body-compact">
        <div className="file-card-compact-row">
          <div className="file-card-compact-main">
            <strong>
              {getCompactActionText(snapshot, props.event, fileToolSnapshot)}
            </strong>
            <p className="file-card-path" title={path}>
              {path}
            </p>
          </div>
          <div className="file-card-actions file-card-actions-compact">
            {compactActions.map(action => (
              <button
                disabled={isActionDisabled(action, { actionPath, referenceText })}
                key={action}
                onClick={() => void runAction(action)}
                type="button"
              >
                {getActionLabel(action)}
              </button>
            ))}
          </div>
        </div>
        {safety === 'outside_workspace' ? (
          <p className="file-card-warning">
            该路径可能位于工作区外，后续打开前需要二次确认。
          </p>
        ) : null}
        {excerpt ? <p className="file-card-excerpt">{excerpt}</p> : null}
        {actionStatus ? (
          <p className="file-card-action-status">{actionStatus}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="file-card-body">
      <div className="file-card-head">
        <strong>{title}</strong>
        <span>{getSource(snapshot)}</span>
        <span className={`file-safety file-safety-${safety}`}>
          {getSafetyText(safety)}
        </span>
      </div>
      <p className="file-card-path" title={path}>
        {path}
      </p>
      <div className="file-card-meta">
        {referenceText ? <span>引用：{referenceText}</span> : null}
        {workspaceRelativePath ? (
          <span>工作区：{workspaceRelativePath}</span>
        ) : null}
        {absolutePath ? <span>绝对路径：{absolutePath}</span> : null}
        {getMimeType(snapshot) ? <span>类型：{getMimeType(snapshot)}</span> : null}
        {getRangeText(snapshot) ? <span>{getRangeText(snapshot)}</span> : null}
      </div>
      {safety === 'outside_workspace' ? (
        <p className="file-card-warning">
          该路径可能位于工作区外，后续打开前需要二次确认。
        </p>
      ) : null}
      {excerpt ? <p className="file-card-excerpt">{excerpt}</p> : null}
      <div className="file-card-actions">
        <button
          disabled={!actionPath}
          onClick={() => void runAction('open')}
          type="button"
        >
          打开
        </button>
        <button
          disabled={!actionPath}
          onClick={() => void runAction('copyPath')}
          type="button"
        >
          复制路径
        </button>
        {referenceText ? (
          <button onClick={() => void runAction('copyReference')} type="button">
            复制引用
          </button>
        ) : null}
        <button
          disabled={!actionPath}
          onClick={() => void runAction('reveal')}
          type="button"
        >
          定位
        </button>
      </div>
      {actionStatus ? <p className="file-card-action-status">{actionStatus}</p> : null}
    </div>
  )
}

function getPrimarySnapshot(event: DisplayEvent): FileCardSnapshot | null {
  if (event.fileSnapshot) {
    return { type: 'file', value: event.fileSnapshot }
  }
  if (event.referenceSnapshot) {
    return { type: 'reference', value: event.referenceSnapshot }
  }
  if (event.attachmentSnapshot) {
    return { type: 'attachment', value: event.attachmentSnapshot }
  }
  return null
}

function getAvatarText(snapshot: FileCardSnapshot): string {
  if (snapshot.type === 'attachment') {
    return '+'
  }
  if (snapshot.type === 'reference') {
    return '@'
  }
  return 'F'
}

function getSnapshotTitle(snapshot: FileCardSnapshot): string {
  if (snapshot.type === 'attachment') {
    return `附件：${snapshot.value.name}`
  }
  if (snapshot.type === 'reference') {
    return snapshot.value.label
      ? `引用：${snapshot.value.label}`
      : '文件引用'
  }

  switch (snapshot.value.kind) {
    case 'generated_file':
      return '生成文件'
    case 'read_file':
      return '读取文件'
    case 'edited_file':
      return '编辑文件'
    case 'deleted_file':
      return '删除文件'
    case 'search_result':
      return '搜索结果'
    default:
      return '文件'
  }
}

function getCompactActionText(
  snapshot: FileCardSnapshot,
  event: DisplayEvent,
  fileToolSnapshot?: FileToolSnapshot,
): string {
  if (fileToolSnapshot) {
    return getFileToolStatusText(
      fileToolSnapshot.operation,
      fileToolSnapshot.status,
    )
  }

  if (snapshot.type === 'attachment') {
    return '附件'
  }
  if (snapshot.type === 'reference') {
    return snapshot.value.kind === 'search_match' ? '搜索命中' : '文件引用'
  }

  const status = event.toolSnapshot?.status ?? event.status
  const statusPrefix = getCompactStatusPrefix(status)
  switch (snapshot.value.kind) {
    case 'generated_file':
      return `${statusPrefix}写入`
    case 'read_file':
      return `${statusPrefix}读取`
    case 'edited_file':
      return `${statusPrefix}编辑`
    case 'deleted_file':
      return `${statusPrefix}删除`
    case 'search_result':
      return '搜索结果'
    default:
      return '文件'
  }
}

function getFileToolStatusText(
  operation: FileToolOperation,
  status: string | undefined,
): string {
  const action = getFileToolActionText(operation)
  if (
    status === 'failed' ||
    status === 'timeout' ||
    status === 'denied' ||
    status === 'cancelled'
  ) {
    return `${action}失败`
  }
  if (
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending' ||
    status === 'waiting_permission'
  ) {
    return `正在${action}`
  }
  return `已${action}`
}

function getFileToolActionText(operation: FileToolOperation): string {
  switch (operation) {
    case 'read':
      return '读取'
    case 'write':
      return '写入'
    case 'edit':
    case 'notebook_edit':
      return '编辑'
    case 'search':
      return '搜索'
    default:
      return '处理'
  }
}

function getCompactStatusPrefix(status: string | undefined): string {
  if (
    status === 'failed' ||
    status === 'timeout' ||
    status === 'denied' ||
    status === 'cancelled'
  ) {
    return ''
  }
  if (
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending' ||
    status === 'waiting_permission'
  ) {
    return '正在'
  }
  return '已'
}

function getCompactActions(
  fileToolSnapshot: FileToolSnapshot | undefined,
  context: { actionPath?: string; referenceText?: string },
): FileToolAction[] {
  const sourceActions =
    fileToolSnapshot?.actions.length && fileToolSnapshot.actions.length > 0
      ? fileToolSnapshot.actions
      : (['open', 'copyPath', 'reveal'] satisfies FileToolAction[])

  return sourceActions.filter(action => {
    if (action === 'copyReference') {
      return Boolean(context.referenceText)
    }
    return action === 'copyPath' || Boolean(context.actionPath)
  })
}

function isActionDisabled(
  action: FileToolAction,
  context: { actionPath?: string; referenceText?: string },
): boolean {
  if (action === 'copyReference') {
    return !context.referenceText
  }
  if (action === 'copyPath') {
    return !context.actionPath
  }
  return !context.actionPath
}

function getActionLabel(action: FileToolAction): string {
  switch (action) {
    case 'open':
      return '打开'
    case 'copyPath':
      return '复制路径'
    case 'reveal':
      return '定位'
    case 'copyReference':
      return '复制引用'
  }
}

function getDisplayPath(snapshot: FileCardSnapshot): string {
  if (snapshot.type === 'attachment') {
    return snapshot.value.path ?? snapshot.value.name
  }
  if (snapshot.type === 'reference') {
    return snapshot.value.path ?? snapshot.value.url ?? snapshot.value.label ?? '未知引用'
  }
  return snapshot.value.path
}

function getAbsolutePath(snapshot: FileCardSnapshot): string | undefined {
  return snapshot.value.absolutePath
}

function getWorkspaceRelativePath(snapshot: FileCardSnapshot): string | undefined {
  return snapshot.value.workspaceRelativePath
}

function getSafety(snapshot: FileCardSnapshot): string {
  return snapshot.value.safety
}

function getSource(snapshot: FileCardSnapshot): string {
  return snapshot.value.source
}

function getMimeType(snapshot: FileCardSnapshot): string | undefined {
  if (snapshot.type === 'reference') {
    return undefined
  }
  return snapshot.value.mimeType
}

function getRangeText(snapshot: FileCardSnapshot): string | undefined {
  if (snapshot.type === 'attachment') {
    return undefined
  }

  const range = snapshot.value.range
  if (!range?.startLine) {
    return undefined
  }

  const endLine =
    range.endLine && range.endLine !== range.startLine
      ? `-${range.endLine}`
      : ''
  return `行：${range.startLine}${endLine}`
}

function getReferenceText(snapshot: FileCardSnapshot): string | undefined {
  if (snapshot.type !== 'reference') {
    return undefined
  }

  const path = snapshot.value.path ?? snapshot.value.url
  if (!path) {
    return undefined
  }

  const range = snapshot.value.range
  if (!range?.startLine) {
    return path
  }

  const column = range.startColumn ? `:${range.startColumn}` : ''
  return `${path}:${range.startLine}${column}`
}

function getExcerpt(snapshot: FileCardSnapshot): string | undefined {
  if (snapshot.type !== 'reference') {
    return undefined
  }
  return snapshot.value.excerpt
}

function getActionPath(snapshot: FileCardSnapshot): string | undefined {
  if (snapshot.type === 'reference' && snapshot.value.url) {
    return undefined
  }

  if (snapshot.type === 'attachment') {
    return snapshot.value.absolutePath ?? snapshot.value.path
  }

  return snapshot.value.absolutePath ?? snapshot.value.path
}

function getSafetyText(safety: string): string {
  switch (safety) {
    case 'workspace':
      return '工作区内'
    case 'outside_workspace':
      return '工作区外'
    case 'remote':
      return '远程资源'
    default:
      return '待确认'
  }
}
