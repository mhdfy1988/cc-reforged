import { useEffect, useState, type ReactNode } from 'react'
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

  return (
    <div className={`message ${message.role} ${message.kind ?? ''}`}>
      <b>{props.label}</b>
      <div className="message-body">
        {hideCompactAttachmentNoticeText ? null : (
          <MessageContent message={message} />
        )}
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
  const [preview, setPreview] = useState<ImagePreviewState | null>(null)
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
              <AttachmentPreview
                snapshot={snapshot}
                onOpen={imagePreview => setPreview(imagePreview)}
              />
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
      {preview ? (
        <ImagePreviewDialog
          preview={preview}
          onClose={() => setPreview(null)}
        />
      ) : null}
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

type ImagePreviewState = {
  name: string
  meta: string
  src: string
  path?: string
}

function AttachmentPreview(props: {
  snapshot: AttachmentSnapshot
  onOpen: (preview: ImagePreviewState) => void
}) {
  const snapshot = props.snapshot
  const [previewDataUrl, setPreviewDataUrl] = useState(
    snapshot.previewDataUrl ?? '',
  )

  useEffect(() => {
    let cancelled = false
    setPreviewDataUrl(snapshot.previewDataUrl ?? '')
    if (snapshot.previewKind !== 'image' || snapshot.previewDataUrl) {
      return () => {
        cancelled = true
      }
    }

    const path = getAttachmentActionPath(snapshot)
    if (!path) {
      return () => {
        cancelled = true
      }
    }

    void window.ccr
      .getImagePreview({ path })
      .then(result => {
        if (!cancelled && result.previewDataUrl) {
          setPreviewDataUrl(result.previewDataUrl)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [snapshot])

  if (snapshot.previewKind === 'image' && previewDataUrl) {
    const path = getAttachmentDisplayPath(snapshot)
    const actionPath = getAttachmentActionPath(snapshot)
    return (
      <button
        aria-label={`查看图片 ${snapshot.name}`}
        className="message-attachment-preview"
        onClick={() =>
          props.onOpen({
            name: snapshot.name,
            meta: getAttachmentMeta(snapshot, path),
            src: previewDataUrl,
            path:
              actionPath && !isRemotePath(actionPath) ? actionPath : undefined,
          })
        }
        title="查看图片"
        type="button"
      >
        <img alt="" src={previewDataUrl} />
      </button>
    )
  }

  return (
    <span className="message-attachment-kind">
      {getAttachmentKindLabel(snapshot)}
    </span>
  )
}

function ImagePreviewDialog(props: {
  preview: ImagePreviewState
  onClose: () => void
}) {
  const [src, setSrc] = useState(props.preview.src)
  const [loadingLarge, setLoadingLarge] = useState(Boolean(props.preview.path))

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        props.onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [props])

  useEffect(() => {
    let cancelled = false
    setSrc(props.preview.src)
    if (!props.preview.path) {
      setLoadingLarge(false)
      return () => {
        cancelled = true
      }
    }

    setLoadingLarge(true)
    void window.ccr
      .getImagePreview({ path: props.preview.path, maxEdge: 1600 })
      .then(result => {
        if (!cancelled && result.previewDataUrl) {
          setSrc(result.previewDataUrl)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoadingLarge(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [props.preview])

  return (
    <div
      aria-label="图片预览"
      aria-modal="true"
      className="image-preview-backdrop"
      onClick={props.onClose}
      role="dialog"
    >
      <section
        className={`image-preview-dialog ${loadingLarge ? 'is-loading' : ''}`}
        onClick={event => event.stopPropagation()}
      >
        <button
          aria-label="关闭图片预览"
          className="image-preview-close"
          onClick={props.onClose}
          title="关闭"
          type="button"
        >
          ×
        </button>
        {loadingLarge ? <span className="image-preview-loading">加载中</span> : null}
        <img alt={props.preview.name} src={src} />
      </section>
    </div>
  )
}

function getAttachmentKindLabel(snapshot: AttachmentSnapshot): string {
  switch (snapshot.previewKind) {
    case 'image':
      return '图'
    case 'text':
      return '文'
    case 'audio':
      return '音'
    case 'video':
      return '视'
    case 'binary':
      return '件'
    default:
      return '附'
  }
}

function getAttachmentDisplayPath(snapshot: AttachmentSnapshot): string {
  return (
    snapshot.savedPath ??
    snapshot.workspaceRelativePath ??
    snapshot.path ??
    snapshot.absolutePath ??
    snapshot.name
  )
}

function getAttachmentActionPath(snapshot: AttachmentSnapshot): string | undefined {
  if (snapshot.savedPath) {
    return snapshot.savedPath
  }
  if (snapshot.safety === 'remote') {
    return snapshot.path
  }
  return snapshot.absolutePath ?? snapshot.path ?? snapshot.workspaceRelativePath
}

function isRemotePath(path: string): boolean {
  return /^https?:\/\//i.test(path)
}

function getAttachmentMeta(
  snapshot: AttachmentSnapshot,
  path: string,
): string {
  const parts = [
    snapshot.source === 'ModelOutput' ? '模型生成' : undefined,
    snapshot.mimeType,
    typeof snapshot.sizeBytes === 'number'
      ? formatBytes(snapshot.sizeBytes)
      : undefined,
    snapshot.provider,
    snapshot.model,
    getOutputLifecycleLabel(snapshot.outputLifecycle),
    getOutputSafetyLabel(snapshot.outputSafety),
    path !== snapshot.name ? path : undefined,
  ].filter(Boolean)
  return parts.join(' · ')
}

function getOutputLifecycleLabel(
  lifecycle: AttachmentSnapshot['outputLifecycle'],
): string | undefined {
  switch (lifecycle) {
    case 'inline':
      return '内联'
    case 'referenced':
      return '引用'
    case 'temporary':
      return '临时'
    case 'persisted':
      return '已持久化'
    case 'expired':
      return '已过期'
    default:
      return undefined
  }
}

function getOutputSafetyLabel(
  safety: AttachmentSnapshot['outputSafety'],
): string | undefined {
  switch (safety) {
    case 'trusted':
      return '已信任'
    case 'needs_review':
      return '需确认'
    case 'blocked':
      return '已拦截'
    default:
      return undefined
  }
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function isAttachmentNoticeText(value: string): boolean {
  const normalized = value.trim()
  return normalized.startsWith('附件：') || normalized.startsWith('Attachment:')
}
