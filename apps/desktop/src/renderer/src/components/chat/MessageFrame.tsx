import { useEffect, useState } from 'react'
import { MessageContent } from './MessageContent.js'
import { displayEventToChatMessage, type DisplayEvent } from '../../domain/displayEvents.js'
import type { AttachmentSnapshot } from '../../domain/fileEvents.js'

export function MessageFrame(props: {
  label: string
  event: DisplayEvent
}) {
  const message = displayEventToChatMessage(props.event)

  return (
    <div className={`message ${message.role} ${message.kind ?? ''}`}>
      <b>{props.label}</b>
      <div className="message-body">
        <MessageContent message={message} />
        <MessageAttachmentStrip attachments={props.event.attachmentSnapshots} />
      </div>
    </div>
  )
}

export function MessageAttachmentStrip(props: {
  attachments?: readonly AttachmentSnapshot[]
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImagePreviewState | null>(null)
  if (!props.attachments?.length) {
    return null
  }

  async function copyPath(snapshot: AttachmentSnapshot): Promise<void> {
    const path = getAttachmentActionPath(snapshot)
    if (!path) {
      return
    }
    await window.ccr.copyText(path)
    setCopiedId(snapshot.id)
  }

  return (
    <>
      <div className="message-attachments">
        {props.attachments.map(snapshot => {
          const path = getAttachmentDisplayPath(snapshot)
          const actionPath = getAttachmentActionPath(snapshot)
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
              <button
                className="message-attachment-copy"
                disabled={!actionPath}
                onClick={() => void copyPath(snapshot)}
                title={actionPath ? '复制路径' : '暂无可复制路径'}
                type="button"
              >
                {copiedId === snapshot.id ? '已复制' : '复制'}
              </button>
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
    snapshot.workspaceRelativePath ??
    snapshot.path ??
    snapshot.absolutePath ??
    snapshot.name
  )
}

function getAttachmentActionPath(snapshot: AttachmentSnapshot): string | undefined {
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
    snapshot.mimeType,
    typeof snapshot.sizeBytes === 'number'
      ? formatBytes(snapshot.sizeBytes)
      : undefined,
    path !== snapshot.name ? path : undefined,
  ].filter(Boolean)
  return parts.join(' · ')
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
