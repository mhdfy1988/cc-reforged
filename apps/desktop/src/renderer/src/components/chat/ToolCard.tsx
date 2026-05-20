import { MessageAttachmentStrip, MessageFrame } from './MessageFrame.js'
import { FileSnapshotPanel } from './FileCard.js'
import { ShellPermissionInlinePanel } from './ShellPermissionCard.js'
import { ToolPermissionInlinePanel } from './ToolPermissionInlinePanel.js'
import { RawDataBlock } from '../common/RawDataBlock.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

type ToolDetailBlockView = {
  kind:
    | 'input'
    | 'fileTool'
    | 'file'
    | 'reference'
    | 'attachment'
    | 'attachments'
    | 'result'
    | 'error'
  title: string
  value: unknown
}

export function ToolCard(props: {
  event: DisplayEvent
  permission?: PermissionCard
  onRespondPermission?: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  const snapshot = props.event.toolSnapshot
  if (!snapshot) {
    return <MessageFrame label="i" event={props.event} />
  }

  const hasFileSnapshot = Boolean(
    props.event.fileSnapshot ||
      props.event.referenceSnapshot ||
      props.event.attachmentSnapshot,
  )
  const useCompactFileLayout = snapshot.category === 'file' && hasFileSnapshot
  const detailBlocks = createToolDetailBlocks(snapshot, props.event)
  const hasDetail = detailBlocks.length > 0
  const metaItems = getToolMetaItems(snapshot, {
    hideTarget: useCompactFileLayout,
  })
  const hints = getToolHints(snapshot)
  const inlinePermission =
    props.permission && props.onRespondPermission
      ? props.permission
      : undefined
  const showToolStatus = !inlinePermission

  return (
    <div
      className={`message system tool-event tool-card ${
        useCompactFileLayout ? 'tool-card-file-compact' : ''
      }`}
    >
      <b>i</b>
      <div className="tool-card-body">
        <div className="tool-card-head">
          <strong>{snapshot.displayName ?? snapshot.name}</strong>
          {useCompactFileLayout ? null : (
            <span>{getCategoryText(snapshot.category)}</span>
          )}
        </div>
        {useCompactFileLayout ? null : (
          <p className="tool-card-summary" title={snapshot.summary}>
            {snapshot.summary}
          </p>
        )}
        {metaItems.length ? (
          <div className="tool-card-meta">
            {metaItems.map(item => (
              <span key={item.label}>
                {item.label}：{item.value}
              </span>
            ))}
          </div>
        ) : null}
        {hints.map(hint => (
          <p className="tool-card-hint" key={hint}>
            {hint}
          </p>
        ))}
        {inlinePermission ? (
          isShellPermission(inlinePermission) ? (
            <ShellPermissionInlinePanel
              compact
              permission={inlinePermission}
              onRespond={props.onRespondPermission}
            />
          ) : (
            <ToolPermissionInlinePanel
              permission={inlinePermission}
              onRespond={props.onRespondPermission}
            />
          )
        ) : null}
        {props.event.fileSnapshot ||
        props.event.referenceSnapshot ||
        props.event.attachmentSnapshot ? (
          <FileSnapshotPanel
            event={props.event}
            variant={useCompactFileLayout ? 'compact' : 'default'}
          />
        ) : null}
        {props.event.attachmentSnapshots?.length ? (
          <MessageAttachmentStrip attachments={props.event.attachmentSnapshots} />
        ) : null}
        {hasDetail ? (
          <details>
            <summary>查看详情</summary>
            {detailBlocks.map(block => (
              <ToolDetailBlock key={getToolDetailBlockKey(block)} block={block} />
            ))}
          </details>
        ) : null}
        {showToolStatus ? (
          <div className="tool-card-status-row">
            <StatusBadge label={snapshot.statusLabel} status={snapshot.status} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function isShellPermission(permission: PermissionCard): boolean {
  return (
    permission.interactionKind === 'shell_permission' ||
    permission.toolName === 'Bash' ||
    permission.toolName === 'PowerShell'
  )
}

function createToolDetailBlocks(
  snapshot: NonNullable<DisplayEvent['toolSnapshot']>,
  event: DisplayEvent,
): ToolDetailBlockView[] {
  const blocks: ToolDetailBlockView[] = []
  const resultText =
    snapshot.result === undefined ? null : formatToolDetail(snapshot.result)
  const errorText =
    snapshot.errorMessage === undefined
      ? null
      : formatToolDetail(snapshot.errorMessage)

  if (snapshot.input !== undefined) {
    blocks.push({ kind: 'input', title: '调用参数', value: snapshot.input })
  }

  if (event.fileToolSnapshot) {
    blocks.push({
      kind: 'fileTool',
      title: '文件工具信息',
      value: event.fileToolSnapshot,
    })
  }

  if (event.fileSnapshot) {
    blocks.push({ kind: 'file', title: '文件信息', value: event.fileSnapshot })
  }

  if (event.referenceSnapshot) {
    blocks.push({
      kind: 'reference',
      title: '引用信息',
      value: event.referenceSnapshot,
    })
  }

  if (event.attachmentSnapshot) {
    blocks.push({
      kind: 'attachment',
      title: '附件信息',
      value: event.attachmentSnapshot,
    })
  }

  if (event.attachmentSnapshots?.length) {
    blocks.push({
      kind: 'attachments',
      title: '附件列表',
      value: event.attachmentSnapshots,
    })
  }

  if (snapshot.result !== undefined) {
    blocks.push({ kind: 'result', title: '执行结果', value: snapshot.result })
  }

  if (
    snapshot.errorMessage !== undefined &&
    !isDuplicateErrorDetail(resultText, errorText)
  ) {
    blocks.push({ kind: 'error', title: '错误详情', value: snapshot.errorMessage })
  }

  return blocks
}

function isDuplicateErrorDetail(
  resultText: string | null,
  errorText: string | null,
): boolean {
  const normalizedError = normalizeDetailText(errorText)
  if (!normalizedError) {
    return true
  }

  const normalizedResult = normalizeDetailText(resultText)
  if (!normalizedResult) {
    return false
  }

  if (normalizedResult === normalizedError) {
    return true
  }

  const resultLines = new Set(normalizedResult.split('\n'))
  const errorLines = normalizedError.split('\n')
  return errorLines.every(line => resultLines.has(line))
}

function ToolDetailBlock(props: { block: ToolDetailBlockView }) {
  return (
    <section className="tool-card-detail-block">
      <h4>{props.block.title}</h4>
      <RawDataBlock text={formatToolDetailBlock(props.block)} />
    </section>
  )
}

function getToolDetailBlockKey(block: ToolDetailBlockView): string {
  return block.title
}

function StatusBadge(props: { label?: string; status: string }) {
  const isRunning = isRunningStatus(props.status)
  return (
    <span
      className={`tool-status-badge ${
        isRunning ? 'is-running' : getStatusClassName(props.status)
      }`}
    >
      {isRunning ? <i aria-hidden="true" /> : null}
      {props.label ?? getStatusText(props.status)}
    </span>
  )
}

function getStatusText(status: string): string {
  if (status === 'failed') {
    return '失败'
  }
  if (status === 'completed') {
    return '成功'
  }
  if (status === 'denied') {
    return '已拒绝'
  }
  if (status === 'interrupted') {
    return '已中断'
  }
  if (status === 'cancelled') {
    return '已取消'
  }
  if (status === 'waiting_permission') {
    return '等待权限'
  }
  if (status === 'timeout') {
    return '已超时'
  }
  if (isRunningStatus(status)) {
    return '执行中'
  }
  return status
}

function isRunningStatus(status: string): boolean {
  return (
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending' ||
    status === 'waiting_permission'
  )
}

function getStatusClassName(status: string): string {
  if (
    status === 'failed' ||
    status === 'denied' ||
    status === 'interrupted' ||
    status === 'cancelled' ||
    status === 'timeout'
  ) {
    return 'is-failed'
  }
  if (status === 'completed') {
    return 'is-success'
  }
  return 'is-neutral'
}

function getCategoryText(category: string): string {
  switch (category) {
    case 'shell':
      return '命令'
    case 'file':
      return '文件'
    case 'mcp':
      return 'MCP'
    case 'browser':
      return '浏览器'
    case 'search':
      return '搜索'
    case 'control':
      return '控制'
    default:
      return '工具'
  }
}

export function getToolMetaItems(
  snapshot: NonNullable<DisplayEvent['toolSnapshot']>,
  options: { hideTarget?: boolean } = {},
) {
  return [
    shouldShowCommandMeta(snapshot)
      ? { label: '命令', value: snapshot.command }
      : null,
    shouldShowTargetMeta(snapshot, options)
      ? { label: '目标', value: snapshot.target }
      : null,
    snapshot.cwd ? { label: '工作目录', value: snapshot.cwd } : null,
    snapshot.risk ? { label: '风险', value: snapshot.risk } : null,
    snapshot.errorClass ? { label: '错误类型', value: snapshot.errorClass } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>
}

function shouldShowTargetMeta(
  snapshot: NonNullable<DisplayEvent['toolSnapshot']>,
  options: { hideTarget?: boolean },
): snapshot is NonNullable<DisplayEvent['toolSnapshot']> & { target: string } {
  if (options.hideTarget || !snapshot.target) {
    return false
  }
  if (snapshot.target === snapshot.command) {
    return false
  }
  return !snapshot.summary.includes(snapshot.target)
}

function getToolHints(
  snapshot: NonNullable<DisplayEvent['toolSnapshot']>,
): string[] {
  const hints = [
    snapshot.actionableHint,
    getShellDialectHint(snapshot),
  ].filter(Boolean) as string[]
  return Array.from(new Set(hints))
}

function getShellDialectHint(
  snapshot: NonNullable<DisplayEvent['toolSnapshot']>,
): string | undefined {
  if (snapshot.category !== 'shell') {
    return undefined
  }

  const shell = (snapshot.shell ?? '').toLowerCase()
  const toolName = snapshot.name.toLowerCase()
  const command = snapshot.command ?? ''
  const isBashLike =
    toolName === 'bash' || shell.includes('bash') || shell.includes('posix')

  if (!isBashLike) {
    return undefined
  }

  if (looksLikePowerShellCommand(command)) {
    return '这条命令看起来像 PowerShell，但当前工具是 Bash/POSIX。Windows 下应改用 PowerShell、CMD、Node 原生文件能力或高层文件工具。'
  }

  if (snapshot.errorClass === 'shell_unavailable') {
    return undefined
  }

  return '当前工具是 Bash/POSIX。Windows 本机如果没有 Bash，不需要为了 ls 强行安装 Bash，应优先改用 PowerShell、CMD、Node 原生文件能力或高层文件工具。'
}

function looksLikePowerShellCommand(command: string): boolean {
  const normalized = command.trim()
  return (
    /^(Get|Set|New|Remove|Test|Select|Where|ForEach)-[A-Z]/.test(normalized) ||
    normalized.includes('ForEach-Object') ||
    normalized.includes('Select-Object') ||
    normalized.includes('$_.') ||
    normalized.startsWith('$')
  )
}

function shouldShowCommandMeta(
  snapshot: NonNullable<DisplayEvent['toolSnapshot']>,
): snapshot is NonNullable<DisplayEvent['toolSnapshot']> & { command: string } {
  if (!snapshot.command) {
    return false
  }
  return !snapshot.summary.includes(snapshot.command)
}

function formatToolDetail(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail
  }
  try {
    return JSON.stringify(detail, null, 2)
  } catch {
    return String(detail)
  }
}

function formatToolDetailBlock(block: ToolDetailBlockView): string {
  if (block.kind === 'result') {
    return formatToolResultDetail(block.value)
  }

  if (
    block.kind === 'fileTool' ||
    block.kind === 'file' ||
    block.kind === 'reference' ||
    block.kind === 'attachment' ||
    block.kind === 'attachments'
  ) {
    return formatToolDetail(sanitizeSnapshotDetail(block.value))
  }

  return formatToolDetail(block.value)
}

function formatToolResultDetail(value: unknown): string {
  const fileContent = extractFileContent(value)
  if (fileContent !== undefined) {
    return fileContent
  }

  return formatToolDetail(value)
}

function extractFileContent(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const text = value
      .map(item => extractFileContent(item))
      .filter((item): item is string => item !== undefined)
      .join('\n')
    return text || undefined
  }

  if (!value || typeof value !== 'object') {
    return undefined
  }

  const object = value as Record<string, unknown>
  const file = toRecord(object.file)
  const nestedContent = file?.content
  if (typeof nestedContent === 'string') {
    return nestedContent
  }

  if (typeof object.content === 'string') {
    return object.content
  }

  if (typeof object.text === 'string') {
    return object.text
  }

  return undefined
}

function sanitizeSnapshotDetail(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeSnapshotDetail(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const object = value as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(object)) {
    if (shouldHideSnapshotDetailKey(key)) {
      continue
    }
    if (nestedValue === undefined) {
      continue
    }
    sanitized[key] = sanitizeSnapshotDetail(nestedValue)
  }
  return sanitized
}

function shouldHideSnapshotDetailKey(key: string): boolean {
  return (
    key === 'raw' ||
    key === 'identity' ||
    key === 'id' ||
    key === 'toolUseId' ||
    key === 'resultText' ||
    key === 'diff' ||
    key === 'actions'
  )
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizeDetailText(value: string | null): string {
  if (!value) {
    return ''
  }

  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}
