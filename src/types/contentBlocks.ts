export type CcrContentSource =
  | {
      kind: 'file'
      path: string
    }
  | {
      kind: 'url'
      url: string
    }
  | {
      kind: 'contentRef'
      contentRef: string
    }

export type CcrContentBlockType =
  | 'text'
  | 'thinking'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'tool_call'
  | 'tool_result'
  | 'json'
  | 'structured'
  | 'error'

export interface CcrContentBlockBase {
  type: CcrContentBlockType
  raw?: unknown
  [key: string]: unknown
}

export interface CcrTextContentBlock extends CcrContentBlockBase {
  type: 'text'
  text: string
}

export interface CcrThinkingContentBlock extends CcrContentBlockBase {
  type: 'thinking'
  thinking: string
  signature?: string
  redacted?: boolean
}

export interface CcrAttachmentContentBlockBase {
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: CcrContentSource
  previewDataUrl?: string
}

export interface CcrImageContentBlock
  extends CcrContentBlockBase,
    CcrAttachmentContentBlockBase {
  type: 'image'
  data?: string
}

export interface CcrFileContentBlock
  extends CcrContentBlockBase,
    CcrAttachmentContentBlockBase {
  type: 'file'
  text?: string
}

export interface CcrAudioContentBlock
  extends CcrContentBlockBase,
    CcrAttachmentContentBlockBase {
  type: 'audio'
}

export interface CcrVideoContentBlock
  extends CcrContentBlockBase,
    CcrAttachmentContentBlockBase {
  type: 'video'
}

export interface CcrToolCallContentBlock extends CcrContentBlockBase {
  type: 'tool_call'
  id: string
  name: string
  input: unknown
  provider?: string
  model?: string
}

export interface CcrToolResultContentBlock extends CcrContentBlockBase {
  type: 'tool_result'
  toolCallId: string
  toolName?: string
  status?:
    | 'success'
    | 'error'
    | 'validation_error'
    | 'permission_denied'
    | 'interrupted'
  result?: unknown
  isError?: boolean
  error?: {
    code: string
    message: string
    missingFields?: readonly string[]
    rawInput?: unknown
  }
}

export interface CcrJsonContentBlock extends CcrContentBlockBase {
  type: 'json'
  value: unknown
  label?: string
}

export interface CcrStructuredContentBlock extends CcrContentBlockBase {
  type: 'structured'
  value: unknown
  label?: string
  schema?: unknown
}

export interface CcrErrorContentBlock extends CcrContentBlockBase {
  type: 'error'
  message: string
  category?: string
  source?: string
  retryable?: boolean | 'unknown'
}

export type CcrAttachmentContentBlock =
  | CcrImageContentBlock
  | CcrFileContentBlock
  | CcrAudioContentBlock
  | CcrVideoContentBlock

export type CcrUserContentBlock =
  | CcrTextContentBlock
  | CcrAttachmentContentBlock

export type CcrLlmContentBlock =
  | CcrTextContentBlock
  | CcrThinkingContentBlock
  | CcrImageContentBlock
  | CcrToolCallContentBlock
  | CcrToolResultContentBlock

export type CcrContentBlock =
  | CcrTextContentBlock
  | CcrThinkingContentBlock
  | CcrAttachmentContentBlock
  | CcrToolCallContentBlock
  | CcrToolResultContentBlock
  | CcrJsonContentBlock
  | CcrStructuredContentBlock
  | CcrErrorContentBlock

export function normalizeCcrContentBlocks(content: unknown): CcrContentBlock[] {
  if (!Array.isArray(content)) {
    return content === undefined ? [] : [{ type: 'json', value: content }]
  }

  return content.map(normalizeCcrContentBlock)
}

export function normalizeCcrContentBlock(content: unknown): CcrContentBlock {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return { type: 'json', value: content }
  }

  const block = content as Record<string, unknown>
  const type = typeof block.type === 'string' ? block.type : 'json'

  if (type === 'text' || type === 'input_text' || type === 'output_text') {
    return {
      type: 'text',
      text: getString(block.text) ?? getString(block.value) ?? '',
      raw: block,
    }
  }

  if (type === 'thinking' || type === 'reasoning') {
    return {
      type: 'thinking',
      thinking:
        getString(block.thinking) ??
        getString(block.text) ??
        getString(block.content) ??
        '',
      signature: getString(block.signature),
      redacted: Boolean(block.redacted),
      raw: block,
    }
  }

  if (type === 'redacted_thinking') {
    return {
      type: 'thinking',
      thinking: '',
      signature: getString(block.signature),
      redacted: true,
      raw: block,
    }
  }

  if (type === 'image' || type === 'file' || type === 'audio' || type === 'video') {
    return normalizeAttachmentBlock(type, block)
  }

  if (type === 'attachment') {
    const attachment = getRecord(block.attachment)
    return attachment
      ? normalizeCcrContentBlock(attachment)
      : { type: 'json', value: block, raw: block }
  }

  if (type === 'tool_call' || type === 'tool_use') {
    return {
      type: 'tool_call',
      id:
        getString(block.id) ??
        getString(block.toolCallId) ??
        getString(block.tool_use_id) ??
        '',
      name: getString(block.name) ?? 'unknown_tool',
      input: block.input,
      provider: getString(block.provider),
      model: getString(block.model),
      raw: block,
    }
  }

  if (type === 'tool_result') {
    return {
      type: 'tool_result',
      toolCallId:
        getString(block.toolCallId) ??
        getString(block.tool_use_id) ??
        getString(block.toolUseId) ??
        '',
      toolName: getString(block.toolName) ?? getString(block.name),
      result: 'result' in block ? block.result : block.content,
      isError: Boolean(block.isError) || Boolean(block.is_error),
      raw: block,
    }
  }

  if (type === 'error') {
    return {
      type: 'error',
      message: getString(block.message) ?? getString(block.text) ?? 'Unknown error',
      category: getString(block.category),
      source: getString(block.source),
      retryable: getRetryable(block.retryable),
      raw: block,
    }
  }

  if (type === 'structured') {
    return {
      type: 'structured',
      value: 'value' in block ? block.value : block,
      label: getString(block.label),
      schema: block.schema,
      raw: block,
    }
  }

  return {
    type: 'json',
    value: 'value' in block ? block.value : block,
    label: getString(block.label),
    raw: block,
  }
}

export function cloneCcrContentSource(
  source: CcrContentSource | undefined,
): CcrContentSource | undefined {
  return source ? { ...source } : undefined
}

function normalizeAttachmentBlock(
  type: 'image' | 'file' | 'audio' | 'video',
  block: Record<string, unknown>,
): CcrAttachmentContentBlock {
  return {
    type,
    attachmentId: getString(block.attachmentId) ?? getString(block.attachment_id),
    displayName: getString(block.displayName) ?? getString(block.display_name),
    mimeType:
      getString(block.mimeType) ??
      getString(block.mime_type) ??
      getString(block.mediaType),
    sizeBytes: getNumber(block.sizeBytes) ?? getNumber(block.size_bytes),
    source: getContentSource(block.source),
    previewDataUrl:
      getString(block.previewDataUrl) ?? getString(block.preview_data_url),
    ...(type === 'image' && getString(block.data)
      ? { data: getString(block.data) }
      : {}),
    ...(type === 'file' && getString(block.text)
      ? { text: getString(block.text) }
      : {}),
    raw: block,
  } as CcrAttachmentContentBlock
}

function getContentSource(value: unknown): CcrContentSource | undefined {
  const source = getRecord(value)
  if (!source) {
    return undefined
  }
  const kind = getString(source.kind)
  if (kind === 'file') {
    const path = getString(source.path)
    return path ? { kind, path } : undefined
  }
  if (kind === 'url') {
    const url = getString(source.url)
    return url ? { kind, url } : undefined
  }
  if (kind === 'contentRef') {
    const contentRef = getString(source.contentRef)
    return contentRef ? { kind, contentRef } : undefined
  }
  return undefined
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function getRetryable(value: unknown): boolean | 'unknown' | undefined {
  return typeof value === 'boolean' || value === 'unknown' ? value : undefined
}
