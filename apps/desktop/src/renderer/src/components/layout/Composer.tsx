import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type MouseEvent,
} from 'react'
import type { LlmModelCapabilities } from '../../domain/displayTypes.js'

type AttachmentModality = 'image' | 'file' | 'audio'

type AttachmentPolicy = 'sendable' | 'convertible' | 'preview_only' | 'blocked'

type ComposerAttachmentSource =
  | {
      kind: 'file'
      path: string
    }
  | {
      kind: 'contentRef'
      contentRef: string
    }

type ComposerAttachmentDraft = {
  id: string
  name: string
  path?: string
  sizeBytes: number
  mimeType: string
  modality: AttachmentModality
  source?: ComposerAttachmentSource
  attachmentId?: string
  previewDataUrl?: string
  previewText?: string
  textContent?: string
  sendMode?: 'image' | 'text' | 'metadata'
  prepareStatus?: 'preparing' | 'ready' | 'error'
  prepareError?: string
  safety?: 'workspace' | 'outside_workspace'
}

type ComposerAttachmentCandidate = ComposerAttachmentDraft & {
  data?: ArrayBuffer
}

type AttachmentStatus = {
  label: string
  detail: string
  policy: AttachmentPolicy
}

type ComposerEditMenuState = {
  x: number
  y: number
  selectionStart: number
  selectionEnd: number
  hasSelection: boolean
  hasText: boolean
  status?: string
}

export type ComposerPrepareAttachmentInput = {
  id: string
  name: string
  path?: string
  data?: ArrayBuffer
  mimeType: string
  sizeBytes: number
  modality: AttachmentModality
}

export type ComposerPreparedAttachment = {
  id: string
  attachmentId?: string
  displayName: string
  mimeType: string
  sizeBytes: number
  modality: AttachmentModality
  source?: ComposerAttachmentSource
  previewDataUrl?: string
  previewText?: string
  textContent?: string
  sendMode?: 'image' | 'text' | 'metadata'
  safety?: 'workspace' | 'outside_workspace'
  status: 'ready' | 'rejected'
  error?: string
}

export type ComposerSubmitAttachment =
  | {
      type: 'image'
      attachmentId: string
      displayName: string
      mimeType: string
      sizeBytes: number
      source: ComposerAttachmentSource
      previewDataUrl?: string
    }
  | {
      type: 'text'
      attachmentId: string
      displayName: string
      mimeType: string
      sizeBytes: number
      source: ComposerAttachmentSource
      text: string
    }

export type ComposerSubmitInput = {
  attachments: ComposerSubmitAttachment[]
}

export function Composer(props: {
  activeTurnId: string | null
  busy: boolean
  canInterruptTurn: boolean
  modelCapabilities?: LlmModelCapabilities | null
  prompt: string
  onChangePrompt: (prompt: string) => void
  onInterrupt: () => void
  onPrepareAttachments: (
    attachments: ComposerPrepareAttachmentInput[],
  ) => Promise<ComposerPreparedAttachment[]>
  onSend: (input?: ComposerSubmitInput) => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const promptInputRef = useRef<HTMLInputElement | null>(null)
  const [attachments, setAttachments] = useState<ComposerAttachmentDraft[]>([])
  const [editMenu, setEditMenu] = useState<ComposerEditMenuState | null>(null)
  const imageCount = attachments.filter(
    attachment => attachment.modality === 'image',
  ).length
  const attachmentStatuses = attachments.map(attachment => ({
    attachment,
    status: getAttachmentStatus({
      attachment,
      capabilities: props.modelCapabilities,
      imageCount,
    }),
  }))
  const submitDisabledReason = getSubmitDisabledReason({
    activeTurnId: props.activeTurnId,
    attachments: attachmentStatuses,
    busy: props.busy,
    prompt: props.prompt,
  })

  useEffect(() => {
    if (!editMenu) {
      return
    }

    const close = () => setEditMenu(null)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [editMenu])

  function handleFilesSelected(
    files: FileList | null,
    input: HTMLInputElement,
  ): void {
    if (!files?.length) {
      return
    }

    void addAttachmentFiles(Array.from(files), 'picker')
    input.value = ''
  }

  async function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
  ): Promise<void> {
    const files = getClipboardFiles(event.clipboardData)
    if (files.length === 0) {
      return
    }
    event.preventDefault()
    await addAttachmentFiles(files, 'paste')
  }

  function openEditMenu(event: MouseEvent<HTMLInputElement>): void {
    const input = event.currentTarget
    const selectionStart = input.selectionStart ?? 0
    const selectionEnd = input.selectionEnd ?? selectionStart
    event.preventDefault()
    event.stopPropagation()
    input.focus()
    setEditMenu({
      x: clampComposerMenuX(event.clientX),
      y: clampComposerMenuY(event.clientY),
      selectionStart,
      selectionEnd,
      hasSelection: selectionEnd > selectionStart,
      hasText: input.value.length > 0,
    })
  }

  function selectAllPromptText(): void {
    const input = promptInputRef.current
    if (!input || !props.prompt) {
      return
    }
    input.focus()
    input.select()
    setEditMenu(current =>
      current
        ? {
            ...current,
            selectionStart: 0,
            selectionEnd: props.prompt.length,
            hasSelection: props.prompt.length > 0,
            status: '已全选',
          }
        : current,
    )
  }

  async function copyPromptSelection(): Promise<void> {
    if (!editMenu?.hasSelection) {
      return
    }
    const selectedText = props.prompt.slice(
      editMenu.selectionStart,
      editMenu.selectionEnd,
    )
    if (!selectedText) {
      return
    }
    try {
      await window.ccr.copyText(selectedText)
      setEditMenu({ ...editMenu, status: '已复制' })
      window.setTimeout(() => setEditMenu(null), 560)
    } catch (error) {
      setEditMenu({
        ...editMenu,
        status: error instanceof Error ? error.message : '复制失败',
      })
    }
  }

  async function cutPromptSelection(): Promise<void> {
    if (!editMenu?.hasSelection) {
      return
    }
    const selectedText = props.prompt.slice(
      editMenu.selectionStart,
      editMenu.selectionEnd,
    )
    if (!selectedText) {
      return
    }
    try {
      await window.ccr.copyText(selectedText)
      replacePromptSelection('', editMenu.selectionStart, editMenu.selectionEnd)
      setEditMenu(null)
    } catch (error) {
      setEditMenu({
        ...editMenu,
        status: error instanceof Error ? error.message : '剪切失败',
      })
    }
  }

  async function pastePromptText(): Promise<void> {
    if (!editMenu) {
      return
    }
    try {
      const text = await window.ccr.readClipboardText()
      if (!text) {
        setEditMenu({ ...editMenu, status: '剪贴板为空' })
        return
      }
      replacePromptSelection(text, editMenu.selectionStart, editMenu.selectionEnd)
      setEditMenu(null)
    } catch (error) {
      setEditMenu({
        ...editMenu,
        status: error instanceof Error ? error.message : '粘贴失败',
      })
    }
  }

  function replacePromptSelection(
    replacement: string,
    selectionStart: number,
    selectionEnd: number,
  ): void {
    const before = props.prompt.slice(0, selectionStart)
    const after = props.prompt.slice(selectionEnd)
    const nextPrompt = `${before}${replacement}${after}`
    const nextCaret = before.length + replacement.length
    props.onChangePrompt(nextPrompt)
    window.requestAnimationFrame(() => {
      const input = promptInputRef.current
      if (!input) {
        return
      }
      input.focus()
      input.setSelectionRange(nextCaret, nextCaret)
    })
  }

  async function addAttachmentFiles(
    files: readonly File[],
    source: 'picker' | 'paste',
  ): Promise<void> {
    const drafts = await Promise.all(
      files.map((file, index) => createAttachmentCandidate(file, source, index)),
    )
    addAttachmentDrafts(drafts)
  }

  function addAttachmentDrafts(
    drafts: readonly ComposerAttachmentCandidate[],
  ): void {
    const visibleDrafts = drafts.map(toVisibleAttachmentDraft)
    setAttachments(current => {
      const next = [...current]
      for (const draft of visibleDrafts) {
        if (!next.some(attachment => attachment.id === draft.id)) {
          next.push(draft)
        }
      }
      return next
    })
    void prepareAttachmentDrafts(drafts)
  }

  async function prepareAttachmentDrafts(
    drafts: readonly ComposerAttachmentCandidate[],
  ): Promise<void> {
    const candidates = drafts.filter(
      attachment =>
        attachment.modality === 'image' ||
        (attachment.modality === 'file' && isTextLikeFile(attachment)),
    )
    if (candidates.length === 0) {
      return
    }

    const candidateIds = new Set(candidates.map(attachment => attachment.id))
    setAttachments(current =>
      current.map(attachment =>
        candidateIds.has(attachment.id)
          ? { ...attachment, prepareStatus: 'preparing', prepareError: undefined }
          : attachment,
      ),
    )

    try {
      const prepared = await props.onPrepareAttachments(
        candidates.map(attachment => ({
          id: attachment.id,
          name: attachment.name,
          ...(attachment.path ? { path: attachment.path } : {}),
          ...(attachment.data ? { data: attachment.data } : {}),
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          modality: attachment.modality,
        })),
      )
      const byId = new Map(prepared.map(attachment => [attachment.id, attachment]))
      setAttachments(current =>
        current.map(attachment => {
          const next = byId.get(attachment.id)
          if (!next) {
            return attachment
          }
          if (next.status === 'rejected') {
            return {
              ...attachment,
              mimeType: next.mimeType,
              sizeBytes: next.sizeBytes,
              prepareStatus: 'error',
              prepareError: next.error ?? '图片读取失败。',
            }
          }
          return {
            ...attachment,
            attachmentId: next.attachmentId,
            mimeType: next.mimeType,
            sizeBytes: next.sizeBytes,
            source: next.source,
            previewDataUrl: next.previewDataUrl,
            previewText: next.previewText,
            textContent: next.textContent,
            sendMode: next.sendMode,
            safety: next.safety,
            prepareStatus: 'ready',
            prepareError: undefined,
          }
        }),
      )
    } catch (error) {
      setAttachments(current =>
        current.map(attachment =>
          candidateIds.has(attachment.id)
            ? {
                ...attachment,
                prepareStatus: 'error',
                prepareError:
                  error instanceof Error ? error.message : '图片读取失败。',
              }
            : attachment,
        ),
      )
    }
  }

  function removeAttachment(id: string): void {
    setAttachments(current =>
      current.filter(attachment => attachment.id !== id),
    )
  }

  async function submit(): Promise<void> {
    if (submitDisabledReason) {
      return
    }

    const submitAttachments = toSubmitAttachments(attachmentStatuses)
    const sentIds = new Set(
      attachmentStatuses
        .filter(
          ({ attachment, status }) =>
            (attachment.modality === 'image' ||
              attachment.sendMode === 'text') &&
            status.policy === 'sendable',
        )
        .map(({ attachment }) => attachment.id),
    )
    await props.onSend({ attachments: submitAttachments })
    if (sentIds.size > 0) {
      setAttachments(current =>
        current.filter(attachment => !sentIds.has(attachment.id)),
      )
    }
  }

  return (
    <footer className="composer">
      {attachments.length ? (
        <div className="composer-attachments">
          {attachmentStatuses.map(({ attachment, status }) => (
            <span
              className={`composer-attachment-chip is-${status.policy}`}
              key={attachment.id}
              title={`${attachment.mimeType} · ${status.detail}`}
            >
              {attachment.previewDataUrl ? (
                <img
                  alt=""
                  className="composer-attachment-preview"
                  src={attachment.previewDataUrl}
                />
              ) : (
                <strong>{getModalityLabel(attachment.modality)}</strong>
              )}
              <b>{attachment.name}</b>
              <small>{formatBytes(attachment.sizeBytes)}</small>
              <em>{status.label}</em>
              <button
                aria-label={`移除附件 ${attachment.name}`}
                onClick={() => removeAttachment(attachment.id)}
                title="移除附件"
                type="button"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="composer-input-row">
        <button
          className="plus"
          aria-label="添加附件"
          onClick={() => fileInputRef.current?.click()}
          title="添加附件"
          type="button"
        >
          +
        </button>
        <input
          ref={fileInputRef}
          className="composer-file-input"
          multiple
          onChange={event =>
            handleFilesSelected(event.currentTarget.files, event.currentTarget)
          }
          type="file"
        />
        <input
          ref={promptInputRef}
          value={props.prompt}
          onChange={event => props.onChangePrompt(event.target.value)}
          onContextMenu={openEditMenu}
          onKeyDown={event => {
            if (event.key === 'Enter' && !submitDisabledReason) {
              void submit()
            }
          }}
          onPaste={event => void handlePaste(event)}
          placeholder="输入任务，按 Enter 发送..."
        />
        {editMenu ? (
          <div
            className="composer-edit-menu"
            onClick={event => event.stopPropagation()}
            onContextMenu={event => event.preventDefault()}
            style={{ left: editMenu.x, top: editMenu.y }}
          >
            {editMenu.status ? (
              <span className="composer-edit-menu-status">{editMenu.status}</span>
            ) : null}
            <button
              disabled={!editMenu.hasText}
              onClick={selectAllPromptText}
              type="button"
            >
              全选
            </button>
            <button
              disabled={!editMenu.hasSelection}
              onClick={() => void cutPromptSelection()}
              type="button"
            >
              剪切
            </button>
            <button
              disabled={!editMenu.hasSelection}
              onClick={() => void copyPromptSelection()}
              type="button"
            >
              复制
            </button>
            <button onClick={() => void pastePromptText()} type="button">
              粘贴
            </button>
          </div>
        ) : null}
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
            disabled={Boolean(submitDisabledReason)}
            onClick={() => void submit()}
            title={submitDisabledReason ?? '发送'}
          >
            发送
          </button>
        )}
      </div>
    </footer>
  )
}

function getClipboardFiles(data: DataTransfer): File[] {
  const files = Array.from(data.files ?? [])
  if (files.length > 0) {
    return files
  }

  return Array.from(data.items ?? [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}

function clampComposerMenuX(value: number): number {
  const width = 132
  return Math.max(8, Math.min(value, window.innerWidth - width - 8))
}

function clampComposerMenuY(value: number): number {
  const height = 168
  return Math.max(8, Math.min(value, window.innerHeight - height - 8))
}

async function createAttachmentCandidate(
  file: File,
  source: 'picker' | 'paste',
  index: number,
): Promise<ComposerAttachmentCandidate> {
  const path = getFileSystemPath(file)
  const fallbackName = createFallbackAttachmentName(file, source, index)
  const name = file.name?.trim() || fallbackName
  const mimeType = file.type || inferMimeTypeFromName(name)
  const modality = classifyAttachment(mimeType, name)
  return {
    id: createAttachmentId({
      file,
      index,
      name,
      path,
      source,
    }),
    name,
    ...(path ? { path } : {}),
    ...(!path && modality === 'image'
      ? { data: await file.arrayBuffer() }
      : {}),
    sizeBytes: file.size,
    mimeType,
    modality,
  }
}

function toVisibleAttachmentDraft(
  draft: ComposerAttachmentCandidate,
): ComposerAttachmentDraft {
  const { data: _data, ...visibleDraft } = draft
  return visibleDraft
}

function getAttachmentStatus(input: {
  attachment: ComposerAttachmentDraft
  capabilities?: LlmModelCapabilities | null
  imageCount: number
}): AttachmentStatus {
  const capabilities = input.capabilities
  const modalities = new Set(capabilities?.inputModalities ?? ['text'])
  const attachment = input.attachment

  if (attachment.modality === 'image') {
    if (!modalities.has('image')) {
      return {
        label: '不支持',
        detail: '当前模型未声明图片输入能力。',
        policy: 'blocked',
      }
    }
    if (attachment.prepareStatus === 'preparing') {
      return {
        label: '读取中',
        detail: '正在由 Desktop main 准备图片。',
        policy: 'blocked',
      }
    }
    if (attachment.prepareStatus === 'error') {
      return {
        label: '读取失败',
        detail: attachment.prepareError ?? '图片读取失败。',
        policy: 'blocked',
      }
    }
    if (!attachment.source || !attachment.attachmentId) {
      return {
        label: '待准备',
        detail: '图片尚未完成安全读取。',
        policy: 'blocked',
      }
    }

    const image = capabilities?.image
    if (
      image?.maxImages !== undefined &&
      input.imageCount > image.maxImages
    ) {
      return {
        label: '数量超限',
        detail: `当前模型最多支持 ${image.maxImages} 张图片。`,
        policy: 'blocked',
      }
    }
    if (
      image?.maxImageBytes !== undefined &&
      attachment.sizeBytes > image.maxImageBytes
    ) {
      return {
        label: '过大',
        detail: `当前模型图片上限为 ${formatBytes(image.maxImageBytes)}。`,
        policy: 'blocked',
      }
    }
    if (
      image?.mimeTypes?.length &&
      !image.mimeTypes.some(
        mimeType => mimeType.toLowerCase() === attachment.mimeType.toLowerCase(),
      )
    ) {
      return {
        label: '需转换',
        detail: '当前模型未声明支持该图片格式。',
        policy: 'convertible',
      }
    }
    return {
      label: '可发送',
      detail: '当前模型声明支持图片输入，会随消息进入 turn/start。',
      policy: 'sendable',
    }
  }

  if (attachment.modality === 'audio') {
    return modalities.has('audio')
      ? {
          label: '可发送',
          detail: '当前模型声明支持音频输入。',
          policy: 'sendable',
        }
      : {
          label: '仅预览',
          detail: '当前模型未声明音频输入能力。',
          policy: 'preview_only',
        }
  }

  if (isTextLikeFile(attachment)) {
    if (attachment.prepareStatus === 'preparing') {
      return {
        label: '读取中',
        detail: '正在由 Desktop main 准备文本文件。',
        policy: 'blocked',
      }
    }
    if (attachment.prepareStatus === 'error') {
      return {
        label: '读取失败',
        detail: attachment.prepareError ?? '文本文件读取失败。',
        policy: 'preview_only',
      }
    }
    if (attachment.sendMode === 'metadata') {
      return {
        label: '仅元信息',
        detail: attachment.prepareError ?? '文件过大，当前不随消息发送。',
        policy: 'preview_only',
      }
    }
    if (attachment.sendMode === 'text' && attachment.textContent) {
      return {
        label: '可发送',
        detail: '小文本文件会作为文本进入上下文。',
        policy: 'sendable',
      }
    }
    return {
      label: '待准备',
      detail: '文本文件尚未完成安全读取。',
      policy: 'blocked',
    }
  }

  if (modalities.has('file')) {
    return {
      label: '仅预览',
      detail: '原生文件输入映射留给后续 provider adapter。',
      policy: 'preview_only',
    }
  }

  return {
    label: '仅预览',
    detail: '当前阶段只保留文件元信息。',
    policy: 'preview_only',
  }
}

function classifyAttachment(mimeType: string, name: string): AttachmentModality {
  if (mimeType.startsWith('image/') || isImageFileName(name)) {
    return 'image'
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio'
  }
  return 'file'
}

function toSubmitAttachments(
  attachments: Array<{
    attachment: ComposerAttachmentDraft
    status: AttachmentStatus
  }>,
): ComposerSubmitAttachment[] {
  return attachments
    .flatMap(({ attachment, status }): ComposerSubmitAttachment[] => {
      if (
        status.policy !== 'sendable' ||
        !attachment.source ||
        !attachment.attachmentId
      ) {
        return []
      }
      if (attachment.modality === 'image') {
        return [
          {
            type: 'image',
            attachmentId: attachment.attachmentId,
            displayName: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            source: attachment.source,
            previewDataUrl: attachment.previewDataUrl,
          },
        ]
      }
      if (attachment.sendMode === 'text' && attachment.textContent) {
        return [
          {
            type: 'text',
            attachmentId: attachment.attachmentId,
            displayName: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            source: attachment.source,
            text: attachment.textContent,
          },
        ]
      }
      return []
    })
}

function getSubmitDisabledReason(input: {
  activeTurnId: string | null
  attachments: Array<{
    attachment: ComposerAttachmentDraft
    status: AttachmentStatus
  }>
  busy: boolean
  prompt: string
}): string | null {
  if (input.busy) {
    return '当前正在处理其他操作。'
  }
  if (input.activeTurnId) {
    return '当前 turn 运行中。'
  }

  const blockingAttachment = input.attachments.find(
    ({ attachment, status }) =>
      attachment.modality === 'image'
        ? status.policy !== 'sendable'
        : isTextLikeFile(attachment) && status.policy === 'blocked',
  )
  if (blockingAttachment) {
    return blockingAttachment.status.detail
  }

  const hasSendableAttachment = input.attachments.some(
    ({ status }) => status.policy === 'sendable',
  )
  if (!input.prompt.trim() && !hasSendableAttachment) {
    return '请输入任务或添加可发送附件。'
  }
  return null
}

function isTextLikeFile(attachment: ComposerAttachmentDraft): boolean {
  return isTextLikeMimeOrName(attachment.mimeType, attachment.name)
}

function isTextLikeMimeOrName(mimeType: string, name: string): boolean {
  if (
    mimeType.startsWith('text/') ||
    [
      'application/json',
      'application/x-ndjson',
      'application/xml',
      'application/yaml',
      'application/javascript',
      'application/typescript',
    ].includes(mimeType)
  ) {
    return true
  }

  return /\.(txt|md|markdown|json|jsonl|yaml|yml|xml|csv|ts|tsx|js|jsx|py|java|go|rs|cs|cpp|c|h|hpp|sql|toml|ini|env|log)$/i.test(
    name,
  )
}

function isImageFileName(name: string): boolean {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(name)
}

function getFileSystemPath(file: File): string | undefined {
  const path = (file as File & { path?: unknown }).path
  return typeof path === 'string' && path.trim() ? path : undefined
}

function createAttachmentId(input: {
  file: File
  index: number
  name: string
  path: string | undefined
  source: 'picker' | 'paste'
}): string {
  if (input.path) {
    return `${input.path}-${input.file.size}-${input.file.lastModified}`
  }
  return `${input.source}-${Date.now()}-${input.index}-${input.name}-${input.file.size}`
}

function createFallbackAttachmentName(
  file: File,
  source: 'picker' | 'paste',
  index: number,
): string {
  const extension = extensionFromMimeType(file.type)
  return source === 'paste'
    ? `clipboard-${index + 1}${extension}`
    : `attachment-${index + 1}${extension}`
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/png') {
    return '.png'
  }
  if (mimeType === 'image/jpeg') {
    return '.jpg'
  }
  if (mimeType === 'image/webp') {
    return '.webp'
  }
  if (mimeType === 'image/gif') {
    return '.gif'
  }
  if (mimeType.startsWith('text/')) {
    return '.txt'
  }
  return ''
}

function inferMimeTypeFromName(name: string): string {
  if (/\.png$/i.test(name)) {
    return 'image/png'
  }
  if (/\.(jpg|jpeg)$/i.test(name)) {
    return 'image/jpeg'
  }
  if (/\.webp$/i.test(name)) {
    return 'image/webp'
  }
  if (/\.gif$/i.test(name)) {
    return 'image/gif'
  }
  return 'application/octet-stream'
}

function getModalityLabel(modality: AttachmentModality): string {
  if (modality === 'image') {
    return '图'
  }
  if (modality === 'audio') {
    return '音'
  }
  return '文'
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
