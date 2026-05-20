import type { DisplayEventIdentity } from './eventContract.js'
import type { JsonObject } from './displayTypes.js'
import type { ToolSnapshot } from './toolEvents.js'
import { isNullRenderingAttachmentType } from '../../../../../../src/utils/nullRenderingAttachmentTypes.js'
import type {
  CcrGeneratedArtifactSnapshot,
  CcrGeneratedArtifactStatus,
  CcrGeneratedArtifactType,
  CcrGeneratedOutputLifecycle,
  CcrGeneratedOutputOrigin,
  CcrGeneratedOutputSafety,
} from '../../../../../../src/types/contentBlocks.js'

export type FileSnapshotSource =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Glob'
  | 'Grep'
  | 'MCP'
  | 'Browser'
  | 'UserUpload'
  | 'ModelOutput'
  | 'Unknown'

export type FileSnapshotKind =
  | 'generated_file'
  | 'read_file'
  | 'edited_file'
  | 'deleted_file'
  | 'search_result'
  | 'reference'

export type PathSafety =
  | 'workspace'
  | 'outside_workspace'
  | 'remote'
  | 'unknown'

export type TextRangeSnapshot = {
  startLine?: number
  startColumn?: number
  endLine?: number
  endColumn?: number
}

export type FileSnapshot = {
  id: string
  source: FileSnapshotSource
  kind: FileSnapshotKind
  path: string
  absolutePath?: string
  workspaceRelativePath?: string
  safety: PathSafety
  mimeType?: string
  sizeBytes?: number
  range?: TextRangeSnapshot
  toolUseId?: string
  identity?: DisplayEventIdentity
  raw?: unknown
}

export type AttachmentSnapshotStatus =
  | 'selected'
  | 'ready'
  | 'uploading'
  | 'attached'
  | 'generated'
  | 'failed'
  | 'removed'

export type AttachmentSnapshot = {
  id: string
  source: 'UserUpload' | 'ToolResult' | 'MCP' | 'Browser' | 'ModelOutput'
  status: AttachmentSnapshotStatus
  name: string
  path?: string
  absolutePath?: string
  workspaceRelativePath?: string
  safety: PathSafety
  mimeType?: string
  sizeBytes?: number
  previewKind?: 'image' | 'text' | 'binary' | 'audio' | 'video' | 'unknown'
  previewDataUrl?: string
  origin?: CcrGeneratedOutputOrigin
  outputLifecycle?: CcrGeneratedOutputLifecycle
  outputSafety?: CcrGeneratedOutputSafety
  provider?: string
  model?: string
  outputId?: string
  savedPath?: string
  prompt?: string
  revisedPrompt?: string
  expiresAt?: string
  generatedArtifact?: CcrGeneratedArtifactSnapshot
  identity?: DisplayEventIdentity
  raw?: unknown
}

export type ReferenceSnapshotKind =
  | 'file'
  | 'code_range'
  | 'search_match'
  | 'url'
  | 'mcp_resource'

export type ReferenceSnapshot = {
  id: string
  source: FileSnapshotSource
  kind: ReferenceSnapshotKind
  label?: string
  path?: string
  absolutePath?: string
  workspaceRelativePath?: string
  url?: string
  safety: PathSafety
  range?: TextRangeSnapshot
  excerpt?: string
  toolUseId?: string
  identity?: DisplayEventIdentity
  raw?: unknown
}

export type FileDisplaySnapshots = {
  fileToolSnapshot?: FileToolSnapshot
  fileSnapshot?: FileSnapshot
  attachmentSnapshot?: AttachmentSnapshot
  attachmentSnapshots?: AttachmentSnapshot[]
  referenceSnapshot?: ReferenceSnapshot
}

export type FileToolOperation =
  | 'read'
  | 'write'
  | 'edit'
  | 'search'
  | 'notebook_edit'
  | 'unknown'

export type FileToolAction = 'open' | 'copyPath' | 'reveal' | 'copyReference'

export type FileToolSnapshot = {
  id: string
  source: FileSnapshotSource
  operation: FileToolOperation
  status: string
  summary: string
  path?: string
  absolutePath?: string
  workspaceRelativePath?: string
  safety: PathSafety
  range?: TextRangeSnapshot
  diff?: unknown
  resultText?: string
  errorClass?: ToolSnapshot['errorClass']
  actions: FileToolAction[]
  toolUseId?: string
  identity?: DisplayEventIdentity
  raw?: unknown
}

export function extractAttachmentSnapshotsFromContentBlocks(input: {
  eventId: string
  blocks: readonly JsonObject[]
  source: AttachmentSnapshot['source']
  identity?: DisplayEventIdentity
}): AttachmentSnapshot[] {
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

export function extractFileDisplaySnapshotsFromToolSnapshot(
  snapshot: ToolSnapshot,
): FileDisplaySnapshots {
  const source = getFileSnapshotSource(snapshot.name)
  if (!source) {
    return {}
  }
  const fileToolSnapshot = extractFileToolSnapshot(snapshot, source)

  if (source === 'Glob' || source === 'Grep') {
    return {
      fileToolSnapshot,
      ...extractSearchReferenceSnapshot(snapshot, source),
    }
  }

  const path = getPrimaryFilePath(snapshot)
  if (!path) {
    return fileToolSnapshot ? { fileToolSnapshot } : {}
  }

  return {
    fileToolSnapshot,
    fileSnapshot: {
      id: createSnapshotId(snapshot.id, 'file', path),
      source,
      kind: getFileSnapshotKind(snapshot, source),
      path,
      ...getPathFields(path),
      range: getTextRange(snapshot),
      toolUseId: snapshot.identity?.toolUseId,
      identity: snapshot.identity,
      raw: {
        input: snapshot.input,
        result: snapshot.result,
      },
    },
  }
}

function collectAttachmentBlocks(blocks: readonly JsonObject[]): JsonObject[] {
  const collected: JsonObject[] = []
  for (const block of blocks) {
    const type = typeof block.type === 'string' ? block.type : ''
    if (type === 'image' || type === 'file' || type === 'audio' || type === 'video') {
      collected.push(block)
      continue
    }

    if (type === 'attachment') {
      const attachment = getJsonObject(block.attachment)
      const attachmentType = getString(attachment, ['type'])
      if (
        attachment &&
        !isNullRenderingAttachmentType(attachmentType ?? 'attachment')
      ) {
        collected.push(attachment)
      }
      continue
    }

    if (type === 'tool_result' && Array.isArray(block.content)) {
      collected.push(
        ...collectAttachmentBlocks(
          block.content.filter(
            (item): item is JsonObject =>
              !!item && typeof item === 'object' && !Array.isArray(item),
          ),
        ),
      )
    }

    if (type === 'tool_result') {
      const result = getJsonObject(block.result)
      if (Array.isArray(result?.output)) {
        collected.push(
          ...collectAttachmentBlocks(
            result.output.filter(
              (item): item is JsonObject =>
                !!item && typeof item === 'object' && !Array.isArray(item),
            ),
          ),
        )
      }
    }
  }
  return collected
}

function createAttachmentSnapshotFromBlock(input: {
  block: JsonObject
  eventId: string
  index: number
  source: AttachmentSnapshot['source']
  identity?: DisplayEventIdentity
}): AttachmentSnapshot {
  const generatedArtifact = getGeneratedArtifactSnapshotFromBlock(input.block)
  const path = getAttachmentPath(input.block, generatedArtifact)
  const name = getAttachmentName(input.block, path, input.index)
  const pathFields = path ? getPathFields(path) : { safety: 'unknown' as const }
  const origin = getAttachmentOrigin(input.block)
  const source =
    origin === 'model_output' ? 'ModelOutput' : input.source
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
    outputLifecycle:
      getAttachmentLifecycle(input.block) ?? generatedArtifact?.lifecycle,
    outputSafety:
      getAttachmentOutputSafety(input.block) ?? generatedArtifact?.safety,
    provider: getString(input.block, ['provider']) ?? generatedArtifact?.provider,
    model: getString(input.block, ['model']) ?? generatedArtifact?.model,
    outputId:
      getString(input.block, ['outputId', 'output_id']) ??
      generatedArtifact?.outputId,
    savedPath:
      getString(input.block, ['savedPath', 'saved_path']) ??
      generatedArtifact?.savedPath,
    prompt: getString(input.block, ['prompt']) ?? generatedArtifact?.prompt,
    revisedPrompt:
      getString(input.block, ['revisedPrompt', 'revised_prompt']) ??
      generatedArtifact?.revisedPrompt,
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

  const lifecycle =
    getAttachmentLifecycle(explicit ?? {}) ?? getAttachmentLifecycle(block)
  const safety =
    getAttachmentOutputSafety(explicit ?? {}) ?? getAttachmentOutputSafety(block)
  const status =
    getGeneratedArtifactStatus(getString(explicit, ['status'])) ??
    (savedPath ? 'saved' : undefined) ??
    'unknown'

  return {
    id,
    type:
      getGeneratedArtifactType(getString(explicit, ['type'])) ??
      getGeneratedArtifactType(getString(block, ['type'])) ??
      'unknown',
    status,
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
    lifecycle,
    safety,
    error: getString(explicit, ['error']) ?? getString(block, ['error']),
    ...(explicit ? { raw: explicit } : {}),
  }
}

function getAttachmentPreviewKind(
  block: JsonObject,
): AttachmentSnapshot['previewKind'] {
  const type = getString(block, ['type'])
  if (type === 'image' || type === 'audio' || type === 'video') {
    return type
  }
  if (type === 'file') {
    const mimeType = getString(block, ['mimeType', 'mime_type', 'mediaType'])
    if (isTextMimeType(mimeType)) {
      return 'text'
    }
    return mimeType ? 'binary' : 'unknown'
  }
  return 'unknown'
}

function getAttachmentOrigin(
  block: JsonObject,
): AttachmentSnapshot['origin'] {
  const origin = getString(block, ['origin'])
  return isAttachmentOrigin(origin) ? origin : undefined
}

function getAttachmentLifecycle(
  block: JsonObject,
): AttachmentSnapshot['outputLifecycle'] {
  const lifecycle = getString(block, ['lifecycle'])
  return isOutputLifecycle(lifecycle) ? lifecycle : undefined
}

function getAttachmentOutputSafety(
  block: JsonObject,
): AttachmentSnapshot['outputSafety'] {
  const safety = getString(block, ['safety'])
  return isOutputSafety(safety) ? safety : undefined
}

function isAttachmentOrigin(
  value: string | undefined,
): value is NonNullable<AttachmentSnapshot['origin']> {
  return [
    'user_upload',
    'tool_result',
    'model_output',
    'mcp',
    'browser',
    'unknown',
  ].includes(value ?? '')
}

function isOutputLifecycle(
  value: string | undefined,
): value is NonNullable<AttachmentSnapshot['outputLifecycle']> {
  return [
    'inline',
    'referenced',
    'temporary',
    'persisted',
    'expired',
    'unknown',
  ].includes(value ?? '')
}

function isOutputSafety(
  value: string | undefined,
): value is NonNullable<AttachmentSnapshot['outputSafety']> {
  return ['trusted', 'needs_review', 'blocked', 'unknown'].includes(value ?? '')
}

function getGeneratedArtifactType(
  value: string | undefined,
): CcrGeneratedArtifactType | undefined {
  return ['image', 'file', 'audio', 'video', 'unknown'].includes(value ?? '')
    ? (value as CcrGeneratedArtifactType)
    : undefined
}

function getGeneratedArtifactStatus(
  value: string | undefined,
): CcrGeneratedArtifactStatus | undefined {
  return ['saving', 'saved', 'failed', 'expired', 'unknown'].includes(value ?? '')
    ? (value as CcrGeneratedArtifactStatus)
    : undefined
}

function isTextMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) {
    return false
  }
  const normalized = mimeType.toLowerCase()
  return (
    normalized.startsWith('text/') ||
    normalized === 'application/json' ||
    normalized.endsWith('+json') ||
    normalized === 'application/xml' ||
    normalized.endsWith('+xml')
  )
}

function getPathBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function extractFileToolSnapshot(
  snapshot: ToolSnapshot,
  source: FileSnapshotSource,
): FileToolSnapshot {
  const path = getPrimaryFilePath(snapshot) ?? getSearchPath(snapshot)
  const pathFields = path ? getPathFields(path) : { safety: 'unknown' as const }
  const operation = getFileToolOperation(snapshot.name, source)

  return {
    id: `${snapshot.id}:file-tool`,
    source,
    operation,
    status: snapshot.status,
    summary: getFileToolSummary(operation, snapshot.status, path),
    path,
    ...pathFields,
    range: getTextRange(snapshot),
    diff: getFileToolDiff(snapshot),
    resultText: getFileToolResultText(snapshot.result),
    errorClass: snapshot.errorClass,
    actions: getFileToolActions(pathFields.safety, operation),
    toolUseId: snapshot.identity?.toolUseId,
    identity: snapshot.identity,
    raw: {
      input: snapshot.input,
      result: snapshot.result,
    },
  }
}

function extractSearchReferenceSnapshot(
  snapshot: ToolSnapshot,
  source: 'Glob' | 'Grep',
): FileDisplaySnapshots {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const filenames = getStringArray(result, ['filenames'])
  const path =
    filenames[0] ??
    getString(input, ['path']) ??
    getString(input, ['glob']) ??
    getString(input, ['pattern'])

  if (!path) {
    return {}
  }

  return {
    referenceSnapshot: {
      id: createSnapshotId(snapshot.id, 'reference', path),
      source,
      kind: source === 'Grep' ? 'search_match' : 'file',
      label: source === 'Grep' ? getString(input, ['pattern']) : undefined,
      path,
      ...getPathFields(path),
      range: getTextRange(snapshot),
      excerpt: getString(result, ['content']),
      toolUseId: snapshot.identity?.toolUseId,
      identity: snapshot.identity,
      raw: {
        input: snapshot.input,
        result: snapshot.result,
      },
    },
  }
}

function getFileSnapshotSource(name: string): FileSnapshotSource | null {
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'Glob':
    case 'Grep':
      return name
    case 'NotebookEdit':
      return 'Edit'
    default:
      return null
  }
}

function getFileSnapshotKind(
  snapshot: ToolSnapshot,
  source: FileSnapshotSource,
): FileSnapshotKind {
  if (source === 'Read') {
    return 'read_file'
  }
  if (source === 'Edit' || source === 'MultiEdit') {
    return 'edited_file'
  }
  if (source === 'Write') {
    const resultType = getString(getJsonObject(snapshot.result), ['type'])
    return resultType === 'update' ? 'edited_file' : 'generated_file'
  }
  return 'reference'
}

function getFileToolOperation(
  name: string,
  source: FileSnapshotSource,
): FileToolOperation {
  if (source === 'Read') {
    return 'read'
  }
  if (source === 'Write') {
    return 'write'
  }
  if (name === 'NotebookEdit') {
    return 'notebook_edit'
  }
  if (source === 'Edit' || source === 'MultiEdit') {
    return 'edit'
  }
  if (source === 'Glob' || source === 'Grep') {
    return 'search'
  }
  return 'unknown'
}

function getFileToolSummary(
  operation: FileToolOperation,
  status: string,
  path: string | undefined,
): string {
  const target = path ?? '未知路径'
  if (isFailureStatus(status)) {
    return `${getFileOperationText(operation)}失败：${target}`
  }
  if (isRunningStatus(status)) {
    return `正在${getFileOperationText(operation)}：${target}`
  }
  return `${getFileOperationText(operation)}：${target}`
}

function getFileOperationText(operation: FileToolOperation): string {
  switch (operation) {
    case 'read':
      return '读取文件'
    case 'write':
      return '写入文件'
    case 'edit':
      return '编辑文件'
    case 'notebook_edit':
      return '编辑 Notebook'
    case 'search':
      return '搜索文件'
    default:
      return '文件操作'
  }
}

function isFailureStatus(status: string): boolean {
  return (
    status === 'failed' ||
    status === 'timeout' ||
    status === 'denied' ||
    status === 'cancelled'
  )
}

function isRunningStatus(status: string): boolean {
  return (
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending' ||
    status === 'waiting_permission'
  )
}

function getPrimaryFilePath(snapshot: ToolSnapshot): string | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  return (
    getString(input, ['file_path', 'filePath', 'path']) ??
    getString(input, ['notebook_path', 'notebookPath']) ??
    getString(result, ['filePath', 'path']) ??
    getString(result, ['notebookPath', 'notebook_path']) ??
    getNestedFilePath(result)
  )
}

function getSearchPath(snapshot: ToolSnapshot): string | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const filenames = getStringArray(result, ['filenames'])
  return (
    filenames[0] ??
    getString(input, ['path']) ??
    getString(input, ['glob']) ??
    getString(input, ['pattern'])
  )
}

function getNestedFilePath(result: JsonObject | null): string | undefined {
  const file = getJsonObject(result?.file)
  return getString(file, ['filePath', 'path'])
}

function getTextRange(snapshot: ToolSnapshot): TextRangeSnapshot | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const startLine = getNumber(result, ['startLine']) ?? getNumber(input, ['offset'])
  const startColumn = getNumber(result, ['startColumn'])
  const endLine =
    getNumber(result, ['endLine']) ??
    inferEndLine(startLine, getNumber(result, ['numLines']))
  const endColumn = getNumber(result, ['endColumn'])
  const range = {
    startLine,
    startColumn,
    endLine,
    endColumn,
  }
  return Object.values(range).some(value => value !== undefined) ? range : undefined
}

function getFileToolDiff(snapshot: ToolSnapshot): unknown {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  if (!input && !result) {
    return undefined
  }

  if (result && ('diff' in result || 'edits' in result)) {
    return {
      diff: result.diff,
      edits: result.edits,
    }
  }

  if (input && ('old_string' in input || 'new_string' in input || 'edits' in input)) {
    return {
      oldString: input.old_string,
      newString: input.new_string,
      edits: input.edits,
    }
  }

  return undefined
}

function getFileToolResultText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (Array.isArray(value)) {
    const text = value
      .map(item => getFileToolResultText(item))
      .filter(Boolean)
      .join('\n')
    return text || undefined
  }
  if (value && typeof value === 'object') {
    const object = value as JsonObject
    if (typeof object.text === 'string' && object.text.trim()) {
      return object.text
    }
    return undefined
  }
  return undefined
}

function getFileToolActions(
  safety: PathSafety,
  operation: FileToolOperation,
): FileToolAction[] {
  if (safety === 'remote' || operation === 'unknown') {
    return []
  }

  const actions: FileToolAction[] = ['copyPath']
  if (safety !== 'unknown') {
    actions.unshift('open')
    actions.push('reveal')
  }
  if (operation === 'search') {
    actions.push('copyReference')
  }
  return actions
}

function inferEndLine(
  startLine: number | undefined,
  numLines: number | undefined,
): number | undefined {
  if (startLine === undefined || numLines === undefined || numLines <= 0) {
    return undefined
  }
  return startLine + numLines - 1
}

function getPathFields(path: string): Pick<
  FileSnapshot,
  'absolutePath' | 'workspaceRelativePath' | 'safety'
> {
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

function createSnapshotId(
  eventId: string,
  kind: 'file' | 'reference',
  path: string,
): string {
  const normalizedPath = path.replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80)
  return `${eventId}:${kind}:${normalizedPath || 'unknown'}`
}

function getJsonObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null
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
  }
  return undefined
}

function getStringArray(
  input: JsonObject | null | undefined,
  keys: string[],
): string[] {
  if (!input) {
    return []
  }
  for (const key of keys) {
    const value = input[key]
    if (Array.isArray(value)) {
      return value.filter(
        (nestedValue): nestedValue is string =>
          typeof nestedValue === 'string' && Boolean(nestedValue.trim()),
      )
    }
  }
  return []
}
