import { useState, type ReactNode } from 'react'
import {
  AttachmentImagePreview,
  getAttachmentActionPath,
  getAttachmentDisplayPath,
  getAttachmentMeta,
  isRemotePath,
} from './AttachmentImagePreview.js'
import { MessageContent } from './MessageContent.js'
import { displayEventToChatMessage, type DisplayEvent } from '../../domain/displayEvents.js'
import type { AttachmentSnapshot } from '../../domain/fileEvents.js'

export function MessageFrame(props: {
  label: string
  event: DisplayEvent
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
      <b>{props.label}</b>
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
        await window.ccr.openPath(localPath)
        setActionState({ id: snapshot.id, action, label: '已打开' })
      }
      if (action === 'reveal' && localPath) {
        await window.ccr.showItemInFolder(localPath)
        setActionState({ id: snapshot.id, action, label: '已定位' })
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
          return (
            <div
              className={`message-attachment-chip ${
                snapshot.previewKind === 'image' ? 'is-image' : ''
              }`}
              key={snapshot.id}
            >
              <AttachmentImagePreview snapshot={snapshot} />
              <span className="message-attachment-main">
                <strong title={snapshot.name}>{snapshot.name}</strong>
                <small title={path}>{getAttachmentMeta(snapshot, path)}</small>
              </span>
              <span className="message-attachment-actions">
                <AttachmentActionButton
                  action="open"
                  disabled={!localActionPath}
                  label={getActionButtonLabel(actionState, snapshot.id, 'open', '打开')}
                  onRun={() => void runAttachmentAction(snapshot, 'open')}
                  title={localActionPath ? '打开文件' : '暂无可打开路径'}
                />
                <AttachmentActionButton
                  action="reveal"
                  disabled={!localActionPath}
                  label={getActionButtonLabel(actionState, snapshot.id, 'reveal', '定位')}
                  onRun={() => void runAttachmentAction(snapshot, 'reveal')}
                  title={localActionPath ? '在文件夹中显示' : '暂无可定位路径'}
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
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

type AttachmentAction = 'open' | 'reveal' | 'save' | 'copy'

function AttachmentActionButton(props: {
  action: AttachmentAction
  disabled: boolean
  label: string
  onRun: () => void
  title: string
}) {
  return (
    <button
      className={`message-attachment-action action-${props.action}`}
      disabled={props.disabled}
      onClick={props.onRun}
      title={props.title}
      type="button"
    >
      {props.label}
    </button>
  )
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
