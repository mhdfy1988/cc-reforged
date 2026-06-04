import { useState, type ReactNode } from 'react'
import {
  AttachmentImagePreview,
  getAttachmentActionPath,
  getAttachmentDisplayPath,
  getAttachmentMeta,
  isRemotePath,
} from './AttachmentImagePreview.js'
import { MessageAvatar } from './MessageAvatar.js'
import { MessageContent } from './MessageContent.js'
import type { MessageAvatarRuntime } from '../../domain/avatarEvents.js'
import { displayEventToChatMessage, type DisplayEvent } from '../../domain/displayEvents.js'
import type { AttachmentSnapshot } from '../../domain/fileEvents.js'

export function MessageFrame(props: {
  label?: string
  event: DisplayEvent
  avatarRuntime?: MessageAvatarRuntime
  compactCarryover?: boolean
  children?: ReactNode
}) {
  const message = displayEventToChatMessage(props.event)
  const hideCompactAttachmentNoticeText =
    Boolean(props.compactCarryover) &&
    isAttachmentNoticeText(message.text) &&
    Boolean(props.event.attachmentSnapshots?.length)
  const hideEmptyAttachmentText =
    !message.text.trim() && Boolean(props.event.attachmentSnapshots?.length)
  const hideMessageText =
    hideCompactAttachmentNoticeText || hideEmptyAttachmentText

  return (
    <div className={`message ${message.role} ${message.kind ?? ''}`}>
      {props.label ? (
        <b className="message-avatar">
          <span>{props.label}</span>
        </b>
      ) : (
        <MessageAvatar event={props.event} runtime={props.avatarRuntime} />
      )}
      <div className="message-body">
        {hideMessageText ? null : <MessageContent message={message} />}
        <MessageAttachmentStrip
          attachments={props.event.attachmentSnapshots}
          compactCarryover={props.compactCarryover}
        />
        {props.children}
      </div>
    </div>
  )
}

export function MessageAttachmentStrip(props: {
  attachments?: readonly AttachmentSnapshot[]
  compactCarryover?: boolean
}) {
  const [actionState, setActionState] = useState<{
    id: string
    action: AttachmentAction
    label: string
  } | null>(null)
  if (!props.attachments?.length) {
    return null
  }

  async function runAttachmentAction(
    snapshot: AttachmentSnapshot,
    action: AttachmentAction,
  ): Promise<void> {
    if (action === 'diagnostic') {
      await copyAttachmentDiagnostic(snapshot, action)
      return
    }

    const path = getAttachmentActionPath(snapshot)
    const localPath = path && !isRemotePath(path) ? path : undefined
    if (action !== 'copy' && !localPath) {
      return
    }
    if (action === 'copy' && !path) {
      return
    }

    try {
      if (action === 'open' && localPath) {
        try {
          await window.ccr.openPath(localPath)
          setActionState({ id: snapshot.id, action, label: '已打开' })
        } catch {
          await window.ccr.showItemInFolder(localPath)
          setActionState({ id: snapshot.id, action, label: '已定位' })
        }
      }
      if (action === 'save' && localPath) {
        await window.ccr.savePathAs(localPath)
        setActionState({ id: snapshot.id, action, label: '已另存' })
      }
      if (action === 'copy' && path) {
        await window.ccr.copyText(path)
        setActionState({ id: snapshot.id, action, label: '已复制' })
      }
    } catch (error) {
      setActionState({
        id: snapshot.id,
        action,
        label: error instanceof Error ? error.message : '操作失败',
      })
    }
  }

  async function copyAttachmentDiagnostic(
    snapshot: AttachmentSnapshot,
    action: AttachmentAction,
  ): Promise<void> {
    try {
      await window.ccr.copyText(createAttachmentDiagnosticPayload(snapshot))
      setActionState({ id: snapshot.id, action, label: '已复制' })
    } catch (error) {
      setActionState({
        id: snapshot.id,
        action,
        label: error instanceof Error ? error.message : '复制失败',
      })
    }
  }

  return (
    <>
      <div className="message-attachments">
        {props.compactCarryover ? (
          <div className="message-attachment-context">
            <strong>压缩恢复附件</strong>
            <span>这些文件由系统在会话压缩后自动保留，用于延续上下文。</span>
          </div>
        ) : null}
        {props.attachments.map(snapshot => {
          const path = getAttachmentDisplayPath(snapshot)
          const actionPath = getAttachmentActionPath(snapshot)
          const localActionPath =
            actionPath && !isRemotePath(actionPath) ? actionPath : undefined
          const diagnosticSummary = getAttachmentDiagnosticSummary(snapshot)
          const meta = diagnosticSummary
            ? [diagnosticSummary, getAttachmentMeta(snapshot, path)]
                .filter(Boolean)
                .join(' · ')
            : getAttachmentMeta(snapshot, path)
          const displayName = getAttachmentDisplayName(snapshot)
          return (
            <div
              className={`message-attachment-chip ${
                snapshot.previewKind === 'image' ? 'is-image' : ''
              } ${snapshot.diagnostic ? 'has-diagnostic' : ''}`}
              key={snapshot.id}
            >
              <AttachmentImagePreview snapshot={snapshot} />
              <span className="message-attachment-main">
                <strong title={snapshot.name}>{displayName}</strong>
                <small title={meta || path}>{meta}</small>
              </span>
              <span className="message-attachment-actions">
                <AttachmentActionButton
                  action="open"
                  disabled={!localActionPath}
                  label={getActionButtonLabel(actionState, snapshot.id, 'open', '打开')}
                  onRun={() => void runAttachmentAction(snapshot, 'open')}
                  title={localActionPath ? '打开文件，失败时定位' : '暂无可打开路径'}
                />
                <AttachmentActionButton
                  action="save"
                  disabled={!localActionPath}
                  label={getActionButtonLabel(actionState, snapshot.id, 'save', '另存')}
                  onRun={() => void runAttachmentAction(snapshot, 'save')}
                  title={localActionPath ? '另存为' : '暂无可另存路径'}
                />
                <AttachmentActionButton
                  action="copy"
                  disabled={!actionPath}
                  label={getActionButtonLabel(actionState, snapshot.id, 'copy', '复制')}
                  onRun={() => void runAttachmentAction(snapshot, 'copy')}
                  title={actionPath ? '复制路径' : '暂无可复制路径'}
                />
                {snapshot.diagnostic ? (
                  <AttachmentActionButton
                    action="diagnostic"
                    disabled={false}
                    label={getActionButtonLabel(
                      actionState,
                      snapshot.id,
                      'diagnostic',
                      '诊断',
                    )}
                    onRun={() => void runAttachmentAction(snapshot, 'diagnostic')}
                    title="复制附件诊断"
                  />
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

type AttachmentAction = 'open' | 'save' | 'copy' | 'diagnostic'

function AttachmentActionButton(props: {
  action: AttachmentAction
  disabled: boolean
  label: string
  onRun: () => void
  title: string
}) {
  const title = isAttachmentActionStateLabel(props.label)
    ? props.label
    : props.title
  return (
    <button
      className={`message-attachment-action action-${props.action}`}
      disabled={props.disabled}
      onClick={props.onRun}
      aria-label={props.title}
      title={title}
      type="button"
    >
      <AttachmentActionIcon action={props.action} />
    </button>
  )
}

function isAttachmentActionStateLabel(label: string): boolean {
  return label.startsWith('已') || label.includes('失败')
}

function AttachmentActionIcon(props: { action: AttachmentAction }) {
  switch (props.action) {
    case 'open':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 17 17 7" />
          <path d="M9 7h8v8" />
          <path d="M6 5h7" />
          <path d="M5 6v12h12v-7" />
        </svg>
      )
    case 'save':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      )
    case 'copy':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect height="11" rx="2" width="11" x="8" y="5" />
          <rect height="11" rx="2" width="11" x="5" y="8" />
        </svg>
      )
    case 'diagnostic':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
      )
    default:
      return null
  }
}

function getActionButtonLabel(
  state: { id: string; action: AttachmentAction; label: string } | null,
  id: string,
  action: AttachmentAction,
  fallback: string,
): string {
  return state?.id === id && state.action === action ? state.label : fallback
}

function isAttachmentNoticeText(value: string): boolean {
  const normalized = value.trim()
  return normalized.startsWith('附件：') || normalized.startsWith('Attachment:')
}

function getAttachmentDisplayName(snapshot: AttachmentSnapshot): string {
  if (
    snapshot.diagnostic?.missingFields.includes(
      'displayName/name/filename/file.path',
    ) &&
    /^附件 \d+$/u.test(snapshot.name)
  ) {
    return '附件信息不完整'
  }
  return snapshot.name
}

function getAttachmentDiagnosticSummary(
  snapshot: AttachmentSnapshot,
): string | undefined {
  const diagnostic = snapshot.diagnostic
  if (!diagnostic) {
    return undefined
  }
  return [
    `原因：${diagnostic.reason}`,
    `来源：${getAttachmentSourceLabel(diagnostic.source)}`,
    diagnostic.rawType ? `原始类型：${diagnostic.rawType}` : undefined,
    diagnostic.missingFields.length
      ? `缺少字段：${diagnostic.missingFields.join(', ')}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

function createAttachmentDiagnosticPayload(snapshot: AttachmentSnapshot): string {
  return JSON.stringify(
    {
      reason: snapshot.diagnostic?.reason ?? '附件诊断信息缺失。',
      attachment: {
        id: snapshot.id,
        name: snapshot.name,
        displayName: getAttachmentDisplayName(snapshot),
        source: snapshot.source,
        status: snapshot.status,
        previewKind: snapshot.previewKind,
        path: snapshot.path,
        savedPath: snapshot.savedPath,
        absolutePath: snapshot.absolutePath,
        workspaceRelativePath: snapshot.workspaceRelativePath,
        mimeType: snapshot.mimeType,
        origin: snapshot.origin,
        outputId: snapshot.outputId,
        provider: snapshot.provider,
        model: snapshot.model,
        diagnostic: snapshot.diagnostic,
        identity: snapshot.identity,
      },
    },
    null,
    2,
  )
}

function getAttachmentSourceLabel(
  source: AttachmentSnapshot['source'],
): string {
  switch (source) {
    case 'UserUpload':
      return '用户上传'
    case 'ToolResult':
      return '工具结果'
    case 'MCP':
      return 'MCP'
    case 'Browser':
      return '浏览器'
    case 'ModelOutput':
      return '模型输出'
    default:
      return source
  }
}
