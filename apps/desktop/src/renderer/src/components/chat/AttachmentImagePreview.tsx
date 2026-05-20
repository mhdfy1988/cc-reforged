import { useEffect, useState, type ReactNode } from 'react'
import type { AttachmentSnapshot } from '../../domain/fileEvents.js'

type ImagePreviewState = {
  name: string
  src: string
  path?: string
}

export function AttachmentImagePreview(props: {
  snapshot: AttachmentSnapshot
  className?: string
  fallback?: ReactNode
}) {
  const [preview, setPreview] = useState<ImagePreviewState | null>(null)
  const snapshot = props.snapshot

  return (
    <>
      <AttachmentImagePreviewButton
        className={props.className}
        fallback={props.fallback}
        onOpen={setPreview}
        snapshot={snapshot}
      />
      {preview ? (
        <ImagePreviewDialog
          preview={preview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  )
}

function AttachmentImagePreviewButton(props: {
  snapshot: AttachmentSnapshot
  className?: string
  fallback?: ReactNode
  onOpen: (preview: ImagePreviewState) => void
}) {
  const snapshot = props.snapshot
  const [previewSrc, setPreviewSrc] = useState(() =>
    getAttachmentImagePreviewSrc(snapshot),
  )

  useEffect(() => {
    let cancelled = false
    const initialSrc = getAttachmentImagePreviewSrc(snapshot)
    setPreviewSrc(initialSrc)

    if (snapshot.previewKind !== 'image' || initialSrc) {
      return () => {
        cancelled = true
      }
    }

    const actionPath = getAttachmentActionPath(snapshot)
    const localPath =
      actionPath && !isRemotePath(actionPath) ? actionPath : undefined
    if (!localPath) {
      return () => {
        cancelled = true
      }
    }

    void window.ccr
      .getImagePreview({ path: localPath })
      .then(result => {
        if (!cancelled && result.previewDataUrl) {
          setPreviewSrc(result.previewDataUrl)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [snapshot])

  if (snapshot.previewKind !== 'image' || !previewSrc) {
    return props.fallback ?? <AttachmentKindBadge snapshot={snapshot} />
  }

  const actionPath = getAttachmentActionPath(snapshot)
  const localPath =
    actionPath && !isRemotePath(actionPath) ? actionPath : undefined
  const className = ['message-attachment-preview', props.className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      aria-label={`查看图片 ${snapshot.name}`}
      className={className}
      onClick={() =>
        props.onOpen({
          name: snapshot.name,
          src: previewSrc,
          path: localPath,
        })
      }
      title="查看图片"
      type="button"
    >
      <img alt="" src={previewSrc} />
    </button>
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

export function AttachmentKindBadge(props: { snapshot: AttachmentSnapshot }) {
  return (
    <span className="message-attachment-kind">
      {getAttachmentKindLabel(props.snapshot)}
    </span>
  )
}

export function getAttachmentDisplayPath(snapshot: AttachmentSnapshot): string {
  return (
    snapshot.savedPath ??
    snapshot.workspaceRelativePath ??
    snapshot.path ??
    snapshot.absolutePath ??
    snapshot.name
  )
}

export function getAttachmentActionPath(
  snapshot: AttachmentSnapshot,
): string | undefined {
  if (snapshot.savedPath) {
    return snapshot.savedPath
  }
  if (snapshot.safety === 'remote') {
    return snapshot.path
  }
  return snapshot.absolutePath ?? snapshot.path ?? snapshot.workspaceRelativePath
}

export function getAttachmentMeta(
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

export function isRemotePath(path: string): boolean {
  return /^https?:\/\//i.test(path)
}

export function getAttachmentImagePreviewSrc(
  snapshot: AttachmentSnapshot,
): string {
  if (snapshot.previewDataUrl) {
    return snapshot.previewDataUrl
  }
  const actionPath = getAttachmentActionPath(snapshot)
  return actionPath && isRemotePath(actionPath) ? actionPath : ''
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
