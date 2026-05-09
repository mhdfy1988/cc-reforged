import { useRef, useState } from 'react'

type ComposerAttachmentDraft = {
  id: string
  name: string
  sizeBytes: number
  mimeType: string
}

export function Composer(props: {
  activeTurnId: string | null
  busy: boolean
  canInterruptTurn: boolean
  prompt: string
  onChangePrompt: (prompt: string) => void
  onInterrupt: () => void
  onSend: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [attachments, setAttachments] = useState<ComposerAttachmentDraft[]>([])

  function handleFilesSelected(files: FileList | null): void {
    if (!files?.length) {
      return
    }

    setAttachments(
      Array.from(files).map(file => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
      })),
    )
  }

  return (
    <footer className="composer">
      {attachments.length ? (
        <div className="composer-attachments">
          {attachments.map(attachment => (
            <span key={attachment.id} title={attachment.mimeType}>
              {attachment.name}
              <small>{formatBytes(attachment.sizeBytes)}</small>
            </span>
          ))}
          <em>附件暂不随消息发送</em>
        </div>
      ) : null}
      <div className="composer-input-row">
        <button
          className="plus"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          +
        </button>
        <input
          ref={fileInputRef}
          className="composer-file-input"
          multiple
          onChange={event => handleFilesSelected(event.currentTarget.files)}
          type="file"
        />
        <input
          value={props.prompt}
          onChange={event => props.onChangePrompt(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && props.prompt.trim()) {
              props.onSend()
            }
          }}
          placeholder="输入任务，按 Enter 发送..."
        />
        {props.activeTurnId ? (
          <button
            className="send stop"
            disabled={props.busy || !props.canInterruptTurn}
            onClick={props.onInterrupt}
          >
            停止
          </button>
        ) : (
          <button
            className="send"
            disabled={props.busy || !props.prompt.trim()}
            onClick={props.onSend}
          >
            发送
          </button>
        )}
      </div>
    </footer>
  )
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
