import type {
  CcrGeneratedArtifactSnapshot,
  CcrGeneratedArtifactStatus,
  CcrGeneratedArtifactType,
} from '../types/contentBlocks.js'
import {
  isNullRenderingAttachmentValue,
} from '../utils/nullRenderingAttachmentTypes.js'
import type {
  ThreadDisplayAttachmentSnapshot,
  ThreadDisplayFileSnapshot,
  ThreadDisplayProjectionIdentity,
} from './threadDisplayProjection.js'

type JsonObject = Record<string, unknown>
type PathSafety = 'workspace' | 'outside_workspace' | 'remote' | 'unknown'

export function extractAttachmentSnapshotsFromContentBlocks(input: {
  eventId: string
  blocks: readonly JsonObject[]
  source: ThreadDisplayAttachmentSnapshot['source']
  identity?: ThreadDisplayProjectionIdentity
}): ThreadDisplayAttachmentSnapshot[] {
  const attachmentBlocks = collectAttachmentBlocks(input.blocks)
  return attachmentBlocks.map((block, index) =>
    createAttachmentSnapshotFromBlock({
      block,
      eventId: input.eventId,
      index,
      source: input.source,
      identity: input.identity,
    }),
  )
}

export function removeGeneratedOutputImagePathsFromMessageText(
  text: string,
  attachmentSnapshots: readonly ThreadDisplayAttachmentSnapshot[],
): string {
  if (!text || attachmentSnapshots.length === 0) {
    return text
  }
  const generatedImagePathKeys = new Set(
    attachmentSnapshots
      .filter(
        attachment =>
          attachment.source === 'ModelOutput' &&
          attachment.previewKind === 'image' &&
          attachment.path,
      )
      .map(attachment => normalizePathKey(attachment.path ?? '')),
  )
  if (generatedImagePathKeys.size === 0) {
    return text
  }

  return text
    .split(/\r?\n/)
    .map(line =>
      extractGeneratedOutputImagePaths(line).some(path =>
        generatedImagePathKeys.has(normalizePathKey(path)),
      )
        ? removeGeneratedOutputImagePathText(line, generatedImagePathKeys)
        : line,
    )
    .filter(line => line.trim())
    .join('\n')
    .trim()
}

export function removeUserUploadImagePlaceholderFromMessageText(
  text: string,
  attachmentSnapshots: readonly ThreadDisplayAttachmentSnapshot[],
): string {
  if (!text || attachmentSnapshots.length === 0) {
    return text
  }
  const hasUserImageAttachment = attachmentSnapshots.some(
    attachment =>
      attachment.source === 'UserUpload' && attachment.previewKind === 'image',
  )
  if (!hasUserImageAttachment) {
    return text
  }
  return text
    .split(/\r?\n/)
    .filter(line => line.trim() !== '[图片]')
    .join('\n')
    .trim()
}

export function isModelOutputAttachmentBlock(block: JsonObject): boolean {
  const type = getString(block, ['type']) ?? ''
  if (type === 'image' || type === 'file' || type === 'audio' || type === 'video') {
    return getAttachmentOrigin(block) === 'model_output'
  }
  if (type !== 'attachment') {
    return false
  }
  const attachment = getJsonObject(block.attachment)
  return Boolean(attachment && isModelOutputAttachmentBlock(attachment))
}

export function formatAttachmentSummary(value: unknown): string {
  if (isNullRenderingAttachmentValue(value)) {
    return ''
  }
  const attachment = getJsonObject(value)
  if (!attachment) {
    return '附件'
  }
  const nestedFile = getJsonObject(attachment.file)
  const label =
    getString(attachment, [
      'displayPath',
      'displayName',
      'name',
      'fileName',
      'filename',
      'path',
      'absolutePath',
    ]) ?? getString(nestedFile, ['filePath', 'path'])
  return label ? `附件：${label}` : '附件'
}

export function formatAttachmentContentBlock(block: JsonObject): string {
  const type = getString(block, ['type']) ?? ''
  return `${getAttachmentTypeText(type)}：${getAttachmentName(block, undefined, 0)}`
}

const GENERATED_OUTPUT_IMAGE_PATH_PATTERN =
  /[A-Za-z]:\\[^\r\n`"<>|]*?\.ccr\\generated_outputs\\[^\r\n`"<>|]*?\.(?:png|jpe?g|webp|gif)/gi

function collectAttachmentBlocks(blocks: readonly JsonObject[]): JsonObject[] {
  const collected: JsonObject[] = []
  for (const block of blocks) {
    const type = getString(block, ['type']) ?? ''
    if (type === 'image' || type === 'file' || type === 'audio' || type === 'video') {
      collected.push(block)
      continue
    }
    if (type === 'attachment') {
      const attachment = getJsonObject(block.attachment)
      if (attachment && !isNullRenderingAttachmentValue(attachment)) {
        collected.push(attachment)
      }
      continue
    }
    if (type === 'tool_result' && Array.isArray(block.content)) {
      collected.push(
        ...collectAttachmentBlocks(
          block.content.filter(isJsonObject),
        ),
      )
    }
    if (type === 'tool_result') {
      const result = getJsonObject(block.result)
      if (Array.isArray(result?.output)) {
        collected.push(
          ...collectAttachmentBlocks(result.output.filter(isJsonObject)),
        )
      }
    }
    if (type === 'tool_use' && Array.isArray(block.result)) {
      collected.push(
        ...collectAttachmentBlocks(block.result.filter(isJsonObject)),
      )
    }
    if (type === 'tool_use') {
      const result = getJsonObject(block.result)
      if (Array.isArray(result?.output)) {
        collected.push(
          ...collectAttachmentBlocks(result.output.filter(isJsonObject)),
        )
      }
    }
  }
  return collected
}

function extractGeneratedOutputImagePaths(text: string): string[] {
  return Array.from(text.matchAll(GENERATED_OUTPUT_IMAGE_PATH_PATTERN), match =>
    match[0].trim(),
  )
}

function removeGeneratedOutputImagePathText(
  line: string,
  generatedImagePathKeys: ReadonlySet<string>,
): string {
  let cleaned = line
  for (const path of extractGeneratedOutputImagePaths(line)) {
    if (generatedImagePathKeys.has(normalizePathKey(path))) {
      cleaned = cleaned.replace(path, '')
    }
  }
  return cleaned.replace(/[`"'：:\-\s]+$/u, '').trim()
}

function createAttachmentSnapshotFromBlock(input: {
  block: JsonObject
  eventId: string
  index: number
  source: ThreadDisplayAttachmentSnapshot['source']
  identity?: ThreadDisplayProjectionIdentity
}): ThreadDisplayAttachmentSnapshot {
  const generatedArtifact = getGeneratedArtifactSnapshotFromBlock(input.block)
  const path = getAttachmentPath(input.block, generatedArtifact)
  const name = getAttachmentName(input.block, path, input.index)
  const pathFields = path ? getPathFields(path) : { safety: 'unknown' as const }
  const origin = getAttachmentOrigin(input.block)
  const source = origin === 'model_output' ? 'ModelOutput' : input.source
  return {
    id: getAttachmentId(input.block, input.eventId, input.index),
    source,
    status: source === 'ModelOutput' ? 'generated' : 'attached',
    name,
    path,
    ...pathFields,
    mimeType: getString(input.block, ['mimeType', 'mime_type', 'mediaType']),
    sizeBytes: getNumber(input.block, ['sizeBytes', 'size_bytes']),
    previewKind: getAttachmentPreviewKind(input.block),
    previewDataUrl: getString(input.block, [
      'previewDataUrl',
      'preview_data_url',
      'thumbnailDataUrl',
      'thumbnail_data_url',
    ]),
    origin,
    outputLifecycle: getAttachmentLifecycle(input.block) ?? generatedArtifact?.lifecycle,
    outputSafety: getAttachmentOutputSafety(input.block) ?? generatedArtifact?.safety,
    provider: getString(input.block, ['provider']) ?? generatedArtifact?.provider,
    model: getString(input.block, ['model']) ?? generatedArtifact?.model,
    outputId: getString(input.block, ['outputId', 'output_id']) ?? generatedArtifact?.outputId,
    savedPath: getString(input.block, ['savedPath', 'saved_path']) ?? generatedArtifact?.savedPath,
    prompt: getString(input.block, ['prompt']) ?? generatedArtifact?.prompt,
    revisedPrompt: getString(input.block, ['revisedPrompt', 'revised_prompt']) ?? generatedArtifact?.revisedPrompt,
    expiresAt: getString(input.block, ['expiresAt', 'expires_at']),
    generatedArtifact,
    identity: input.identity,
    raw: input.block,
  }
}

function getAttachmentId(
  block: JsonObject,
  eventId: string,
  index: number,
): string {
  return (
    getString(block, ['attachmentId', 'attachment_id', 'id']) ??
    `${eventId}:attachment:${index}`
  )
}

function getAttachmentName(
  block: JsonObject,
  path: string | undefined,
  index: number,
): string {
  const nestedFile = getJsonObject(block.file)
  return (
    getString(block, [
      'displayPath',
      'displayName',
      'display_name',
      'name',
      'filename',
      'fileName',
    ]) ??
    getString(nestedFile, ['displayPath', 'filePath', 'path']) ??
    (path ? getPathBasename(path) : undefined) ??
    `附件 ${index + 1}`
  )
}

function getAttachmentPath(
  block: JsonObject,
  generatedArtifact?: CcrGeneratedArtifactSnapshot,
): string | undefined {
  const source = getJsonObject(block.source)
  const nestedFile = getJsonObject(block.file)
  return (
    getString(block, ['savedPath', 'saved_path']) ??
    generatedArtifact?.savedPath ??
    (source?.kind === 'file' ? getString(source, ['path']) : undefined) ??
    (source?.kind === 'url' ? getString(source, ['url']) : undefined) ??
    (source?.kind === 'providerFile' ? getString(source, ['url']) : undefined) ??
    getString(block, ['path', 'absolutePath', 'url']) ??
    getString(nestedFile, ['filePath', 'path'])
  )
}

function getGeneratedArtifactSnapshotFromBlock(
  block: JsonObject,
): CcrGeneratedArtifactSnapshot | undefined {
  const explicit =
    getJsonObject(block.generatedArtifact) ?? getJsonObject(block.generated_artifact)
  const savedPath =
    getString(explicit, ['savedPath', 'saved_path']) ??
    getString(block, ['savedPath', 'saved_path'])
  const outputId =
    getString(explicit, ['outputId', 'output_id']) ??
    getString(block, ['outputId', 'output_id'])
  const id =
    getString(explicit, ['id', 'artifactId', 'artifact_id']) ??
    outputId ??
    getString(block, ['attachmentId', 'attachment_id', 'id'])
  if (!id) {
    return undefined
  }
  return {
    id,
    type:
      getGeneratedArtifactType(getString(explicit, ['type'])) ??
      getGeneratedArtifactType(getString(block, ['type'])) ??
      'unknown',
    status:
      getGeneratedArtifactStatus(getString(explicit, ['status'])) ??
      (savedPath ? 'saved' : undefined) ??
      'unknown',
    savedPath,
    mimeType:
      getString(explicit, ['mimeType', 'mime_type', 'mediaType']) ??
      getString(block, ['mimeType', 'mime_type', 'mediaType']),
    provider: getString(explicit, ['provider']) ?? getString(block, ['provider']),
    model: getString(explicit, ['model']) ?? getString(block, ['model']),
    outputId,
    prompt: getString(explicit, ['prompt']) ?? getString(block, ['prompt']),
    revisedPrompt:
      getString(explicit, ['revisedPrompt', 'revised_prompt']) ??
      getString(block, ['revisedPrompt', 'revised_prompt']),
    lifecycle:
      getAttachmentLifecycle(explicit ?? {}) ?? getAttachmentLifecycle(block),
    safety:
      getAttachmentOutputSafety(explicit ?? {}) ??
      getAttachmentOutputSafety(block),
    error: getString(explicit, ['error']) ?? getString(block, ['error']),
    ...(explicit ? { raw: explicit } : {}),
  }
}

function getAttachmentPreviewKind(
  block: JsonObject,
): ThreadDisplayAttachmentSnapshot['previewKind'] {
  const type = getString(block, ['type'])
  if (type === 'image' || type === 'audio' || type === 'video') {
    return type
  }
  if (type === 'file') {
    const mimeType = getString(block, ['mimeType', 'mime_type', 'mediaType'])
    if (mimeType?.startsWith('text/') || mimeType === 'application/json') {
      return 'text'
    }
    return mimeType ? 'binary' : 'unknown'
  }
  return 'unknown'
}

function getAttachmentOrigin(
  block: JsonObject,
): ThreadDisplayAttachmentSnapshot['origin'] {
  return isOneOf(getString(block, ['origin']), [
    'user_upload',
    'tool_result',
    'model_output',
    'mcp',
    'browser',
    'unknown',
  ])
}

function getAttachmentLifecycle(
  block: JsonObject,
): ThreadDisplayAttachmentSnapshot['outputLifecycle'] {
  return isOneOf(getString(block, ['lifecycle']), [
    'inline',
    'referenced',
    'temporary',
    'persisted',
    'expired',
    'unknown',
  ])
}

function getAttachmentOutputSafety(
  block: JsonObject,
): ThreadDisplayAttachmentSnapshot['outputSafety'] {
  return isOneOf(getString(block, ['safety']), [
    'trusted',
    'needs_review',
    'blocked',
    'unknown',
  ])
}

function getGeneratedArtifactType(
  value: string | undefined,
): CcrGeneratedArtifactType | undefined {
  return isOneOf(value, ['image', 'file', 'audio', 'video', 'unknown'])
}

function getGeneratedArtifactStatus(
  value: string | undefined,
): CcrGeneratedArtifactStatus | undefined {
  return isOneOf(value, ['saving', 'saved', 'failed', 'expired', 'unknown'])
}

function getPathFields(
  path: string,
): Pick<ThreadDisplayFileSnapshot, 'absolutePath' | 'workspaceRelativePath' | 'safety'> {
  const safety = getPathSafety(path)
  return {
    absolutePath: isAbsolutePath(path) ? path : undefined,
    workspaceRelativePath: safety === 'workspace' ? path : undefined,
    safety,
  }
}

function getPathSafety(path: string): PathSafety {
  if (/^https?:\/\//i.test(path)) {
    return 'remote'
  }
  if (path === '..' || path.startsWith('..\\') || path.startsWith('../')) {
    return 'outside_workspace'
  }
  if (path.includes('\\..\\') || path.includes('/../')) {
    return 'outside_workspace'
  }
  if (isAbsolutePath(path)) {
    return 'unknown'
  }
  return 'workspace'
}

function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/')
}

function getPathBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function normalizePathKey(path: string): string {
  return path.replace(/\//g, '\\').toLowerCase()
}

function getAttachmentTypeText(type: string): string {
  switch (type) {
    case 'image':
      return '图片'
    case 'audio':
      return '音频'
    case 'video':
      return '视频'
    case 'file':
      return '文件'
    default:
      return '附件'
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getJsonObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null
}

function getString(
  input: JsonObject | null | undefined,
  keys: string[],
): string | undefined {
  if (!input) {
    return undefined
  }
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function getNumber(
  input: JsonObject | null | undefined,
  keys: string[],
): number | undefined {
  if (!input) {
    return undefined
  }
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return undefined
}

function isOneOf<T extends string>(
  value: string | undefined,
  options: readonly T[],
): T | undefined {
  return value && options.includes(value as T) ? (value as T) : undefined
}
