import {
  normalizeCcrContentBlocks,
  type CcrContentBlock,
  type CcrGeneratedArtifactSnapshot,
  type CcrGeneratedArtifactStatus,
  type CcrGeneratedArtifactType,
  type CcrGeneratedOutputLifecycle,
  type CcrGeneratedOutputOrigin,
  type CcrGeneratedOutputSafety,
} from '../types/contentBlocks.js'
import {
  createCcrErrorSnapshot,
  type CcrErrorSnapshot,
} from '../types/errorSnapshot.js'
import {
  isNullRenderingAttachmentType,
  isNullRenderingAttachmentValue,
} from '../utils/nullRenderingAttachmentTypes.js'
import {
  getCcrToolDisplayMetadata,
  type CcrToolDisplayCategory,
  type CcrToolDisplayMetadata,
} from '../services/tools/toolDisplayCatalog.js'

export type ThreadDisplayProjectionInput = {
  id: string
  type: string
  text: string
  status?: string
  sourceKind?: string
  createdAt?: string
  timelineHidden?: boolean
  identity?: {
    threadId?: string
    sessionId?: string
    turnId?: string
    itemId?: string
    messageUuid?: string
    parentUuid?: string | null
    toolUseId?: string
    parentToolUseId?: string
    sourceIndex?: number
    rawIndex?: number
    materializedIndex?: number
    contentIndex?: number
  }
  content?: unknown
  metadata?: Record<string, unknown>
}

export type ThreadDisplayProjection = {
  version: 1
  event?: ThreadDisplayProjectedEvent
}

export type ThreadDisplayProjectedEvent = {
  type: string
  text: string
  status?: string
  sourceKind?: string
  timelineHidden?: boolean
  identity?: ThreadDisplayProjectionIdentity
  todoSnapshot?: ThreadDisplayTodoSnapshot
  toolSnapshot?: ThreadDisplayToolSnapshot
  fileToolSnapshot?: ThreadDisplayFileToolSnapshot
  fileSnapshot?: ThreadDisplayFileSnapshot
  attachmentSnapshot?: ThreadDisplayAttachmentSnapshot
  attachmentSnapshots?: ThreadDisplayAttachmentSnapshot[]
  referenceSnapshot?: ThreadDisplayReferenceSnapshot
  compactSnapshot?: ThreadDisplayCompactSnapshot
  contentBlocks?: CcrContentBlock[]
  errorSnapshot?: CcrErrorSnapshot
}

export type ThreadDisplayCompactSnapshot = {
  status?: string
  trigger?: string
  startedAt?: string
  completedAt?: string
  preCompactTokenCount?: number
  postCompactTokenCount?: number
  truePostCompactTokenCount?: number
  summaryMessageCount?: number
  attachmentCount?: number
  hookResultCount?: number
}

export type ThreadDisplayProjectionIdentity = {
  itemId: string
  threadId?: string
  turnId?: string
  sourceIndex?: number
  rawIndex?: number
  materializedIndex?: number
  contentIndex?: number
  toolUseId?: string
  parentToolUseId?: string
  requestId?: string
  provider?: string
  model?: string
  missingFields: string[]
  raw: {
    item?: JsonObject
    block?: JsonObject
  }
}

export type ThreadDisplayTodoSnapshot = {
  id: string
  title: string
  items: Array<{
    content: string
    status: string
    activeForm?: string
  }>
  identity?: ThreadDisplayProjectionIdentity
  raw: unknown
}

export type ThreadDisplayToolSnapshot = {
  id: string
  kind: 'call' | 'result' | 'progress'
  name: string
  displayName?: string
  category:
    | 'shell'
    | 'file'
    | 'mcp'
    | 'browser'
    | 'search'
    | 'web'
    | 'agent'
    | 'media'
    | 'internal'
    | 'control'
    | 'unknown'
  status: string
  statusLabel?: string
  summary: string
  identity?: ThreadDisplayProjectionIdentity
  input?: unknown
  result?: unknown
  description?: string
  target?: string
  command?: string
  cwd?: string
  shell?: string
  provider?: string
  risk?: string
  permissionRequestId?: string
  durationMs?: number
  startedAt?: string
  completedAt?: string
  errorClass?:
    | 'permission_denied'
    | 'command_not_found'
    | 'shell_unavailable'
    | 'path_not_found'
    | 'task_not_found'
    | 'file_too_large'
    | 'mcp_unavailable'
    | 'browser_unavailable'
    | 'timeout'
    | 'unknown_failure'
  errorMessage?: string
  actionableHint?: string
  detailKeys?: string[]
  showInMainTimeline?: boolean
  raw?: unknown
}

export type ThreadDisplayFileSnapshot = {
  id: string
  source: FileSnapshotSource
  kind: 'generated_file' | 'read_file' | 'edited_file' | 'deleted_file' | 'search_result' | 'reference'
  path: string
  absolutePath?: string
  workspaceRelativePath?: string
  safety: PathSafety
  range?: TextRangeSnapshot
  toolUseId?: string
  identity?: ThreadDisplayProjectionIdentity
  raw?: unknown
}

export type ThreadDisplayAttachmentSnapshot = {
  id: string
  source: 'UserUpload' | 'ToolResult' | 'MCP' | 'Browser' | 'ModelOutput'
  status: 'selected' | 'ready' | 'uploading' | 'attached' | 'generated' | 'failed' | 'removed'
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
  identity?: ThreadDisplayProjectionIdentity
  raw?: unknown
}

export type ThreadDisplayReferenceSnapshot = {
  id: string
  source: FileSnapshotSource
  kind: 'file' | 'code_range' | 'search_match' | 'url' | 'mcp_resource'
  label?: string
  path?: string
  absolutePath?: string
  workspaceRelativePath?: string
  url?: string
  safety: PathSafety
  range?: TextRangeSnapshot
  excerpt?: string
  toolUseId?: string
  identity?: ThreadDisplayProjectionIdentity
  raw?: unknown
}

export type ThreadDisplayFileToolSnapshot = {
  id: string
  source: FileSnapshotSource
  operation: 'read' | 'write' | 'edit' | 'search' | 'notebook_edit' | 'unknown'
  status: string
  summary: string
  path?: string
  absolutePath?: string
  workspaceRelativePath?: string
  safety: PathSafety
  range?: TextRangeSnapshot
  diff?: unknown
  resultText?: string
  errorClass?: ThreadDisplayToolSnapshot['errorClass']
  actions: Array<'open' | 'copyPath' | 'reveal' | 'copyReference'>
  toolUseId?: string
  identity?: ThreadDisplayProjectionIdentity
  raw?: unknown
}

type JsonObject = Record<string, unknown>
type FileSnapshotSource =
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
type PathSafety = 'workspace' | 'outside_workspace' | 'remote' | 'unknown'
type TextRangeSnapshot = {
  startLine?: number
  startColumn?: number
  endLine?: number
  endColumn?: number
}

const SYNTHETIC_MESSAGE_TEXT = new Set([
  '[Request interrupted by user]',
  '[Request interrupted by user for tool use]',
  "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.",
  "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
  'No response requested.',
])

export function projectThreadDisplayItem(
  item: ThreadDisplayProjectionInput,
): ThreadDisplayProjection | undefined {
  const content =
    typeof item.content === 'string'
      ? [{ type: 'text', text: item.content }]
      : item.content !== undefined || !item.text.trim()
        ? item.content
        : [{ type: 'text', text: item.text }]
  const blocks = normalizeJsonBlocks(content)
  const contentBlocks = normalizeCcrContentBlocks(content)
  const identity = createProjectionIdentity(item)
  const compactSnapshot = getCompactSnapshot(item.metadata)

  if (isRawThinkingOnly(blocks) && item.type === 'assistant_message') {
    return {
      version: 1,
      event: {
        type: 'system_notice',
        text: '模型只返回了推理内容，未返回最终回复。',
        status: item.status,
        sourceKind: item.sourceKind,
        timelineHidden: true,
        identity,
        contentBlocks,
      },
    }
  }

  if (
    (isRawThinkingOnly(blocks) && item.type !== 'thinking_summary') ||
    isSyntheticMessageOnly(blocks)
  ) {
    return undefined
  }

  if (item.type === 'user_message' || item.sourceKind === 'user_message') {
    const text = getUserText(blocks) || item.text
    const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
      eventId: item.id,
      blocks,
      source: 'UserUpload',
      identity,
    })
    const displayText = removeUserUploadImagePlaceholderFromMessageText(
      text,
      attachmentSnapshots,
    )
    return {
      version: 1,
      event: {
        type: 'user_message',
        text: displayText,
        status: item.status ?? 'completed',
        sourceKind: item.sourceKind ?? 'user_message',
        identity,
        attachmentSnapshots:
          attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
        contentBlocks,
      },
    }
  }

  const todoSnapshot = extractTodoOverlaySnapshotFromBlocks(item.id, blocks, item)
  if (todoSnapshot) {
    return {
      version: 1,
      event: {
        type: 'todo_list',
        text: `TodoWrite 已更新 ${todoSnapshot.items.length} 个任务。`,
        status: item.status ?? 'completed',
        sourceKind: item.sourceKind,
        timelineHidden: item.timelineHidden,
        identity,
        todoSnapshot,
        contentBlocks,
      },
    }
  }

  const toolSnapshot = extractToolSnapshotFromBlocks(item.id, blocks, item)
  if (toolSnapshot) {
    const fileDisplaySnapshots =
      extractFileDisplaySnapshotsFromToolSnapshot(toolSnapshot)
    const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
      eventId: item.id,
      blocks,
      source: 'ToolResult',
      identity,
    })
    return {
      version: 1,
      event: {
        type: toolSnapshot.kind === 'call' ? 'tool_call' : 'tool_result',
        text: toolSnapshot.summary,
        status: item.status ?? toolSnapshot.status,
        sourceKind: item.sourceKind,
        timelineHidden:
          item.timelineHidden ?? shouldHideToolFromTimeline(toolSnapshot),
        identity,
        toolSnapshot,
        ...fileDisplaySnapshots,
        attachmentSnapshots:
          attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
        contentBlocks,
        errorSnapshot: toolSnapshot.errorMessage
          ? createCcrErrorSnapshot({
              message: toolSnapshot.errorMessage,
              source: 'tool',
              category: 'tool_error',
              turnId: identity.turnId,
              toolUseId: identity.toolUseId,
              safeDetails: {
                toolName: toolSnapshot.name,
                errorClass: toolSnapshot.errorClass,
                status: toolSnapshot.status,
              },
            })
          : undefined,
      },
    }
  }

  if (item.type === 'error') {
    const errorSnapshot = createCcrErrorSnapshot({
      message: item.text || stringifyToolResult(item.content),
      source: 'app_server',
      safeDetails: {
        itemId: item.id,
        threadId: item.identity?.threadId,
        turnId: item.identity?.turnId,
      },
    })
    return {
      version: 1,
      event: {
        type: 'error',
        text: item.text || errorSnapshot.message,
        status: item.status ?? 'failed',
        sourceKind: item.sourceKind,
        timelineHidden: item.timelineHidden,
        identity,
        contentBlocks,
        errorSnapshot,
      },
    }
  }

  const attachmentSnapshots = extractAttachmentSnapshotsFromContentBlocks({
    eventId: item.id,
    blocks,
    source: item.type === 'assistant_message' ? 'ModelOutput' : 'ToolResult',
    identity,
  })
  const messageText = removeGeneratedOutputImagePathsFromMessageText(
    getMessageText(item, blocks),
    attachmentSnapshots,
  )
  if (!messageText.trim() && attachmentSnapshots.length === 0) {
    return undefined
  }

  return {
    version: 1,
    event: {
      type: getMessageProjectionType(item),
      text: messageText,
      status: item.status,
      sourceKind: item.sourceKind,
      timelineHidden: item.timelineHidden,
      identity,
      attachmentSnapshots:
        attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
      ...(compactSnapshot ? { compactSnapshot } : {}),
      contentBlocks,
    },
  }
}

function getCompactSnapshot(
  metadata: Record<string, unknown> | undefined,
): ThreadDisplayCompactSnapshot | undefined {
  const snapshot = getJsonObject(metadata?.compactSnapshot)
  if (!snapshot) {
    return undefined
  }

  return {
    status: getString(snapshot, ['status']),
    trigger: getString(snapshot, ['trigger']),
    startedAt: getString(snapshot, ['startedAt']),
    completedAt: getString(snapshot, ['completedAt']),
    preCompactTokenCount: getNumber(snapshot, ['preCompactTokenCount']),
    postCompactTokenCount: getNumber(snapshot, ['postCompactTokenCount']),
    truePostCompactTokenCount: getNumber(snapshot, [
      'truePostCompactTokenCount',
    ]),
    summaryMessageCount: getNumber(snapshot, ['summaryMessageCount']),
    attachmentCount: getNumber(snapshot, ['attachmentCount']),
    hookResultCount: getNumber(snapshot, ['hookResultCount']),
  }
}

function normalizeJsonBlocks(content: unknown): JsonObject[] {
  if (!Array.isArray(content)) {
    return content === undefined ? [] : [{ type: 'json', value: content }]
  }
  return content.map(block =>
    block && typeof block === 'object' && !Array.isArray(block)
      ? (block as JsonObject)
      : { type: 'json', value: block },
  )
}

function createProjectionIdentity(
  item: ThreadDisplayProjectionInput,
  block?: JsonObject,
  contentIndex?: number,
): ThreadDisplayProjectionIdentity {
  const threadId = item.identity?.threadId ?? getString(block, ['threadId'])
  const turnId = item.identity?.turnId ?? getString(block, ['turnId'])
  const toolUseId =
    getString(block, ['id', 'toolUseId', 'toolUseID', 'tool_use_id']) ??
    item.identity?.toolUseId
  const parentToolUseId =
    getString(block, [
      'parentToolUseId',
      'parentToolUseID',
      'parent_tool_use_id',
    ]) ?? item.identity?.parentToolUseId

  const identity: ThreadDisplayProjectionIdentity = {
    itemId: item.identity?.itemId ?? item.id,
    threadId,
    turnId,
    sourceIndex: item.identity?.sourceIndex,
    rawIndex: item.identity?.rawIndex,
    materializedIndex: item.identity?.materializedIndex,
    contentIndex: item.identity?.contentIndex ?? contentIndex,
    toolUseId,
    parentToolUseId,
    provider: getString(item.metadata, ['provider']),
    model: getString(item.metadata, ['model']),
    missingFields: [],
    raw: {
      item: item as unknown as JsonObject,
      block,
    },
  }
  identity.missingFields = ['threadId', 'turnId'].filter(
    field => !identity[field as 'threadId' | 'turnId'],
  )
  return identity
}

function getUserText(blocks: JsonObject[]): string {
  return blocks.map(getHistoryUserTextBlockValue).filter(Boolean).join('\n\n')
}

function getHistoryUserTextBlockValue(block: JsonObject): string {
  const type = getString(block, ['type']) ?? ''
  if (
    (type === 'text' || type === 'input_text' || type === 'output_text') &&
    typeof block.text === 'string'
  ) {
    return block.text.trim()
  }
  if (type === 'json' && typeof block.value === 'string') {
    return block.value.trim()
  }
  return ''
}

function getMessageProjectionType(item: ThreadDisplayProjectionInput): string {
  if (item.type === 'thinking_summary') {
    return 'thinking_summary'
  }
  if (item.type === 'error') {
    return 'error'
  }
  if (item.type === 'assistant_message') {
    return 'assistant_message'
  }
  return item.type || 'system_notice'
}

function getMessageText(
  item: ThreadDisplayProjectionInput,
  blocks: JsonObject[],
): string {
  const rendered = blocks.map(formatContentBlock).filter(Boolean).join('\n\n')
  if (!rendered && blocks.some(isModelOutputAttachmentBlock)) {
    return ''
  }
  return rendered || item.text
}

function removeGeneratedOutputImagePathsFromMessageText(
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

  const cleanedLines = text
    .split(/\r?\n/)
    .map(line =>
      extractGeneratedOutputImagePaths(line).some(path =>
        generatedImagePathKeys.has(normalizePathKey(path)),
      )
        ? removeGeneratedOutputImagePathText(line, generatedImagePathKeys)
        : line,
    )
    .filter(line => line.trim())

  return cleanedLines.join('\n').trim().replace(/[：:\-\s]+$/u, '')
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

function removeUserUploadImagePlaceholderFromMessageText(
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

function isModelOutputAttachmentBlock(block: JsonObject): boolean {
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

function formatContentBlock(block: JsonObject): string {
  const type = getString(block, ['type']) ?? 'json'
  if (isNullRenderingContentBlock(block, type)) {
    return ''
  }
  if (type === 'text' || type === 'input_text' || type === 'output_text') {
    return getString(block, ['text']) ?? ''
  }
  if (type === 'thinking') {
    return ['思考', limitMessageText(getString(block, ['thinking']) ?? '')]
      .filter(Boolean)
      .join('\n')
  }
  if (type === 'redacted_thinking') {
    return '思考\n思考内容已由模型服务隐藏。'
  }
  if (type === 'tool_use') {
    return [`调用工具：${getToolName(block)}`, formatJsonBlock(block.input)]
      .filter(Boolean)
      .join('\n')
  }
  if (type === 'tool_result') {
    const title = block.isError ? '工具结果：失败' : '工具结果：成功'
    return [title, stringifyToolResult(block.content)].filter(Boolean).join('\n')
  }
  if (type === 'attachment') {
    return formatAttachmentSummary(block.attachment)
  }
  if (type === 'image' || type === 'file' || type === 'audio' || type === 'video') {
    if (block.origin === 'model_output') {
      return ''
    }
    return `${getAttachmentTypeText(type)}：${getAttachmentName(block, undefined, 0)}`
  }
  return 'value' in block ? formatUnknownValue(block.value) : formatJsonBlock(block)
}

function isNullRenderingContentBlock(block: JsonObject, type: string): boolean {
  if (isNullRenderingAttachmentType(type)) {
    return true
  }
  if (type !== 'attachment') {
    return false
  }
  return isNullRenderingAttachmentValue(block.attachment)
}

function isRawThinkingOnly(blocks: Array<{ type?: unknown }>): boolean {
  return (
    blocks.length > 0 &&
    blocks.every(
      block =>
        block.type === 'thinking' ||
        block.type === 'redacted_thinking' ||
        block.type === 'reasoning',
    )
  )
}

function isSyntheticMessageOnly(blocks: JsonObject[]): boolean {
  if (blocks.length !== 1) {
    return false
  }
  const block = blocks[0]
  const type = getString(block, ['type']) ?? ''
  const text =
    (type === 'text' || type === 'input_text' || type === 'output_text') &&
    typeof block.text === 'string'
      ? block.text
      : type === 'json' && typeof block.value === 'string'
        ? block.value
        : undefined
  return Boolean(text && SYNTHETIC_MESSAGE_TEXT.has(text))
}

function extractTodoOverlaySnapshotFromBlocks(
  id: string,
  blocks: JsonObject[],
  item: ThreadDisplayProjectionInput,
): ThreadDisplayTodoSnapshot | null {
  const primary = getPrimaryProjectionBlock(
    blocks,
    item,
    block => block.type === 'tool_use' && getToolName(block) === 'TodoWrite',
  )
  if (!primary) {
    return null
  }

  const input = getJsonObject(primary.block.input)
  const todos = input?.todos
  if (!Array.isArray(todos)) {
    return null
  }
  const items = todos
    .map(value => {
      const object = getJsonObject(value)
      const content = getString(object, ['content'])
      if (!content) {
        return null
      }
      return {
        content,
        status: getString(object, ['status']) ?? 'pending',
        ...(getString(object, ['activeForm'])
          ? { activeForm: getString(object, ['activeForm']) }
          : {}),
      }
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
  return items.length
    ? {
        id,
        title: 'TodoWrite',
        items,
        identity: createProjectionIdentity(item, primary.block, primary.contentIndex),
        raw: input,
      }
    : null
}

function extractToolSnapshotFromBlocks(
  id: string,
  blocks: JsonObject[],
  item: ThreadDisplayProjectionInput,
): ThreadDisplayToolSnapshot | null {
  const primary = getPrimaryProjectionBlock(blocks, item, isToolProjectionBlock)
  if (!primary) {
    return null
  }

  const block = primary.block
  const type = getString(block, ['type']) ?? ''
  const identity = createProjectionIdentity(item, block, primary.contentIndex)
  if (type === 'tool_use') {
    const name = getToolName(block)
    const input = getJsonObject(block.input)
    const category = classifyToolCategory(name, input)
    const metadata = extractToolCallMetadata(name, category, input)
    const status = getToolUseDisplayStatus(block, item)
    const result = getToolUseEmbeddedResult(block)
    const resultText = stringifyToolResult(result)
    const isError = Boolean(block.isError) || isFailureStatus(status)
    const errorClass =
      isError && resultText ? classifyToolError(resultText, category) : undefined
    return {
      id,
      kind: 'call',
      name,
      displayName: metadata.displayName,
      category,
      status,
      statusLabel: getToolStatusLabel(status),
      summary: metadata.summary,
      identity,
      input: block.input,
      ...(result !== undefined ? { result } : {}),
      description: metadata.description,
      target: metadata.target,
      command: metadata.command,
      cwd: metadata.cwd,
      shell: metadata.shell,
      provider: metadata.provider,
      risk: metadata.risk,
      errorClass,
      errorMessage: isError && errorClass ? resultText : undefined,
      actionableHint: getActionableHint(errorClass),
      detailKeys: metadata.detailKeys,
      showInMainTimeline: metadata.showInMainTimeline,
      ...extractToolTiming(block, getToolResultTimingSource(result) ?? input, item),
      raw: block,
    }
  }
  if (type === 'tool_result') {
    const resultText = stringifyToolResult(block.content)
    const category = classifyToolCategory(getToolName(block))
    const isError = Boolean(block.isError) || isFailureStatus(item.status ?? '')
    const errorClass = isError ? classifyToolError(resultText, category) : undefined
    const status = normalizeToolResultStatus(
      isError,
      item.status ?? 'completed',
      resultText,
      errorClass,
    )
    return {
      id,
      kind: 'result',
      name: '工具结果',
      category,
      status,
      statusLabel: getToolStatusLabel(status),
      summary: status === 'completed' ? '工具执行成功' : '工具执行失败',
      identity,
      result: block.content,
      errorClass,
      errorMessage: isError && errorClass ? resultText : undefined,
      actionableHint: getActionableHint(errorClass),
      ...extractToolTiming(block, getToolResultTimingSource(block.content), item),
      raw: block,
    }
  }
  if (type === 'progress') {
    return {
      id,
      kind: 'progress',
      name: '工具进度',
      displayName: '工具进度',
      category: 'unknown',
      status: 'running',
      statusLabel: getToolStatusLabel('running'),
      summary: '工具正在执行',
      identity,
      result: block.data,
      ...extractToolTiming(block, getJsonObject(block.data), item),
      raw: block,
    }
  }
  return null
}

function getPrimaryProjectionBlock(
  blocks: JsonObject[],
  item: ThreadDisplayProjectionInput,
  predicate: (block: JsonObject) => boolean,
): { block: JsonObject; contentIndex: number } | null {
  const identityIndex = item.identity?.contentIndex
  const identityBlock =
    identityIndex !== undefined ? blocks[identityIndex] : undefined
  if (identityIndex !== undefined && identityBlock && predicate(identityBlock)) {
    return {
      block: identityBlock,
      contentIndex: identityIndex,
    }
  }

  if (blocks.length === 1 && predicate(blocks[0])) {
    return {
      block: blocks[0],
      contentIndex: identityIndex ?? 0,
    }
  }

  const primaryBlock = getJsonObject(item.metadata?.primaryBlock)
  if (primaryBlock && predicate(primaryBlock)) {
    return {
      block: primaryBlock,
      contentIndex: identityIndex ?? 0,
    }
  }

  for (const [contentIndex, block] of blocks.entries()) {
    if (predicate(block)) {
      return { block, contentIndex }
    }
  }
  return null
}

function isToolProjectionBlock(block: JsonObject): boolean {
  const type = getString(block, ['type']) ?? ''
  return type === 'tool_use' || type === 'tool_result' || type === 'progress'
}

function getToolUseEmbeddedResult(block: JsonObject): unknown {
  return 'result' in block ? block.result : undefined
}

function getToolUseDisplayStatus(
  block: JsonObject,
  item: ThreadDisplayProjectionInput,
): string {
  const explicitStatus = normalizeToolStatus(
    getString(block, [
      'status',
      'historyStatus',
      'history_status',
      'statusText',
      'status_text',
    ]),
  )
  if (explicitStatus) {
    return explicitStatus
  }
  return item.status === 'completed' || item.status === 'failed'
    ? item.status
    : 'running'
}

function normalizeToolStatus(status: string | undefined): string | undefined {
  if (!status?.trim()) {
    return undefined
  }
  const normalized = status.trim().toLowerCase()
  if (normalized.includes('interrupt') || normalized.includes('cancel')) {
    return 'interrupted'
  }
  if (normalized.includes('timeout')) {
    return 'timeout'
  }
  if (normalized.includes('denied')) {
    return 'denied'
  }
  if (normalized.includes('fail') || normalized.includes('error')) {
    return 'failed'
  }
  if (normalized.includes('complete') || normalized.includes('success')) {
    return 'completed'
  }
  return status
}

function extractToolCallMetadata(
  name: string,
  category: ThreadDisplayToolSnapshot['category'],
  input: JsonObject | null,
): Pick<
  ThreadDisplayToolSnapshot,
  | 'displayName'
  | 'summary'
  | 'description'
  | 'target'
  | 'command'
  | 'cwd'
  | 'shell'
  | 'provider'
  | 'risk'
  | 'detailKeys'
  | 'showInMainTimeline'
> {
  const command = getString(input, ['command', 'cmd', 'script'])
  const cwd = getString(input, ['cwd', 'workdir', 'workingDirectory', 'working_directory'])
  const shell = getString(input, ['shell', 'shellName', 'provider'])
  const description = getString(input, ['description', 'summary'])
  const target = getToolTarget(name, input)
  const risk = getString(input, ['risk', 'riskLevel', 'risk_level'])
  const provider = getString(input, ['provider'])
  const registryMetadata = getCcrToolDisplayMetadata(name)
  const registryDisplayName = registryMetadata?.displayName
  const registrySummary = buildRegistrySummary(
    registryMetadata,
    registryDisplayName,
    input,
  )
  const detailKeys = registryMetadata?.detailKeys
  const showInMainTimeline = getToolShowInMainTimeline(registryMetadata)

  if (category === 'shell') {
    return {
      displayName: registryDisplayName ?? name,
      summary: command ? `运行命令：${command}` : `调用命令工具：${name}`,
      description,
      target,
      command,
      cwd,
      shell: shell ?? inferShellName(name),
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  const displayName =
    registryDisplayName ??
    ({
      Read: '读取文件',
      Write: '写入文件',
      Edit: '编辑文件',
      MultiEdit: '编辑文件',
      NotebookEdit: '编辑 Notebook',
      LS: '列出目录',
      Glob: '搜索文件',
      Grep: '搜索内容',
      TodoWrite: 'TodoWrite',
    }[name] ?? name)
  const defaultSummary =
    registrySummary ??
    (target
      ? `${displayName}：${target}`
      : name === 'TodoWrite'
        ? '更新待办列表'
        : `调用工具：${name}`)

  return {
    displayName,
    summary: defaultSummary,
    description,
    target,
    command,
    cwd,
    shell,
    provider,
    risk,
    detailKeys,
    showInMainTimeline,
  }
}

function classifyToolCategory(
  name: string,
  input?: JsonObject | null,
): ThreadDisplayToolSnapshot['category'] {
  const registryCategory = mapRegistryCategoryToToolCategory(
    getCcrToolDisplayMetadata(name)?.category,
  )
  if (registryCategory) {
    return registryCategory
  }
  const normalized = name.toLowerCase()
  if (isControlToolInvocation(name, input)) {
    return 'control'
  }
  if (
    normalized === 'bash' ||
    normalized.includes('shell') ||
    normalized.includes('powershell') ||
    normalized.includes('cmd')
  ) {
    return 'shell'
  }
  if (
    normalized === 'ls' ||
    normalized === 'glob' ||
    normalized === 'grep' ||
    normalized.includes('read') ||
    normalized.includes('write') ||
    normalized.includes('edit')
  ) {
    return 'file'
  }
  if (normalized.includes('mcp') || normalized.startsWith('mcp__')) {
    return 'mcp'
  }
  if (normalized.includes('browser') || normalized.includes('playwright')) {
    return 'browser'
  }
  if (normalized.includes('search') || normalized.includes('fetch')) {
    return 'search'
  }
  return 'unknown'
}

function mapRegistryCategoryToToolCategory(
  category: CcrToolDisplayCategory | undefined,
): ThreadDisplayToolSnapshot['category'] | undefined {
  switch (category) {
    case 'file':
      return 'file'
    case 'runtime':
      return 'shell'
    case 'mcp':
      return 'mcp'
    case 'web':
      return 'web'
    case 'control':
      return 'control'
    case 'agent':
      return 'agent'
    case 'media':
      return 'media'
    case 'internal':
      return 'internal'
    default:
      return undefined
  }
}

function isControlToolInvocation(
  name: string,
  input?: JsonObject | null,
): boolean {
  if (
    name === 'AskUserQuestion' ||
    name === 'TodoWrite' ||
    name === 'EnterPlanMode' ||
    name === 'ExitPlanMode' ||
    name === 'ExitPlanModeV2'
  ) {
    return true
  }
  const normalized = `${name} ${input ? JSON.stringify(input) : ''}`.toLowerCase()
  return [
    'todowrite',
    'askuserquestion',
    'enterplanmode',
    'exitplanmode',
    'exitplanmodev2',
  ].some(toolName => normalized.includes(toolName.toLowerCase()))
}

function getToolShowInMainTimeline(
  metadata: CcrToolDisplayMetadata | undefined,
): boolean | undefined {
  if (!metadata) {
    return undefined
  }
  return (
    metadata.showInMainTimeline ??
    (metadata.category !== 'control' && metadata.category !== 'internal')
  )
}

function buildRegistrySummary(
  metadata: CcrToolDisplayMetadata | undefined,
  displayName: string | undefined,
  input: JsonObject | null,
): string | undefined {
  if (!metadata?.summaryKeys?.length || !input) {
    return undefined
  }
  const fields = metadata.summaryKeys
    .map(key => formatSummaryField(key, input[key]))
    .filter((item): item is string => Boolean(item))
  return fields.length ? `${displayName ?? metadata.displayName}：${fields.join(' · ')}` : undefined
}

function formatSummaryField(key: string, value: unknown): string | undefined {
  const formattedValue = formatSummaryValue(value)
  return formattedValue ? `${key}=${formattedValue}` : undefined
}

function formatSummaryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return truncateSummaryText(value.trim())
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} 项` : undefined
  }
  if (value && typeof value === 'object') {
    try {
      return truncateSummaryText(JSON.stringify(value))
    } catch {
      return truncateSummaryText(String(value))
    }
  }
  return undefined
}

function truncateSummaryText(value: string): string | undefined {
  if (!value) {
    return undefined
  }
  return value.length > 120 ? `${value.slice(0, 117)}...` : value
}

function getToolTarget(name: string, input: JsonObject | null): string | undefined {
  if (!input) {
    return undefined
  }
  return (
    getString(input, ['file_path', 'filePath', 'path', 'url', 'pattern', 'query', 'prompt']) ??
    (name === 'Bash' || name.toLowerCase().includes('shell')
      ? getString(input, ['command', 'cmd'])
      : undefined)
  )
}

function inferShellName(name: string): string | undefined {
  const normalized = name.toLowerCase()
  if (normalized === 'bash') {
    return 'bash/posix'
  }
  if (normalized.includes('powershell')) {
    return 'powershell'
  }
  if (normalized.includes('cmd')) {
    return 'cmd'
  }
  return undefined
}

function extractToolTiming(
  block: JsonObject,
  nested: JsonObject | null,
  item: ThreadDisplayProjectionInput,
): Pick<ThreadDisplayToolSnapshot, 'durationMs' | 'startedAt' | 'completedAt'> {
  const explicitDurationMs =
    getNumber(block, ['durationMs', 'duration_ms', 'elapsedTimeMs', 'elapsed_ms']) ??
    getNumber(nested, ['durationMs', 'duration_ms', 'elapsedTimeMs', 'elapsed_ms']) ??
    getNumber(item.metadata, ['durationMs', 'duration_ms', 'elapsedTimeMs', 'elapsed_ms'])
  const startedAt =
    getString(block, ['startedAt', 'started_at', 'startTime', 'start_time']) ??
    getString(nested, ['startedAt', 'started_at', 'startTime', 'start_time']) ??
    getString(item.metadata, ['startedAt', 'started_at', 'startTime', 'start_time']) ??
    item.createdAt
  const completedAt =
    getString(block, ['completedAt', 'completed_at', 'endedAt', 'ended_at', 'endTime', 'end_time']) ??
    getString(nested, ['completedAt', 'completed_at', 'endedAt', 'ended_at', 'endTime', 'end_time']) ??
    getString(item.metadata, ['completedAt', 'completed_at'])
  const durationMs =
    explicitDurationMs ?? inferDurationMsFromTimestamps(startedAt, completedAt)
  return {
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
  }
}

function inferDurationMsFromTimestamps(
  startedAt: string | undefined,
  completedAt: string | undefined,
): number | undefined {
  if (!startedAt || !completedAt) {
    return undefined
  }
  const startedMs = Date.parse(startedAt)
  const completedMs = Date.parse(completedAt)
  return Number.isFinite(startedMs) && Number.isFinite(completedMs)
    ? Math.max(0, completedMs - startedMs)
    : undefined
}

function getToolResultTimingSource(value: unknown): JsonObject | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const source = getToolResultTimingSource(item)
      if (source) {
        return source
      }
    }
    return null
  }
  return getJsonObject(value)
}

function normalizeToolResultStatus(
  isError: boolean,
  statusText: string,
  resultText: string,
  errorClass?: ThreadDisplayToolSnapshot['errorClass'],
): string {
  const normalized = statusText.toLowerCase()
  const result = resultText.toLowerCase()
  if (normalized.includes('cancel') || normalized.includes('interrupt')) {
    return normalized.includes('interrupt') ? 'interrupted' : 'cancelled'
  }
  if (normalized.includes('timeout') || result.includes('timed out')) {
    return 'timeout'
  }
  if (normalized.includes('denied') || result.includes('denied by user')) {
    return 'denied'
  }
  if (isError || errorClass) {
    return 'failed'
  }
  return normalized && normalized !== 'success' ? statusText : 'completed'
}

function isFailureStatus(statusText: string): boolean {
  const normalized = statusText.toLowerCase()
  return ['failed', 'error', 'timeout', 'interrupted', 'cancelled', 'canceled', 'denied'].includes(normalized)
}

function classifyToolError(
  resultText: string,
  category: ThreadDisplayToolSnapshot['category'],
): ThreadDisplayToolSnapshot['errorClass'] | undefined {
  const text = resultText.toLowerCase()
  if (!text.trim()) {
    return undefined
  }
  if (text.includes('no suitable shell') || text.includes('posix shell')) {
    return 'shell_unavailable'
  }
  if (text.includes('command not found') || text.includes('is not recognized') || /\bspawn\s+.+\s+enoent\b/.test(text)) {
    return 'command_not_found'
  }
  if (text.includes('cannot find path') || text.includes('no such file') || text.includes('enoent')) {
    return 'path_not_found'
  }
  if (text.includes('no task found with id') || text.includes('<retrieval_status>not_found</retrieval_status>')) {
    return 'task_not_found'
  }
  if (category === 'file' && text.includes('exceeds maximum allowed')) {
    return 'file_too_large'
  }
  if (text.includes('permission denied') || text.includes('access is denied') || text.includes('user denied')) {
    return 'permission_denied'
  }
  if (text.includes('timed out') || text.includes('timeout')) {
    return 'timeout'
  }
  if (category === 'mcp' && (text.includes('offline') || text.includes('connection refused'))) {
    return 'mcp_unavailable'
  }
  if (category === 'browser' && text.includes('browser') && text.includes('failed')) {
    return 'browser_unavailable'
  }
  return 'unknown_failure'
}

function getActionableHint(
  errorClass?: ThreadDisplayToolSnapshot['errorClass'],
): string | undefined {
  switch (errorClass) {
    case 'shell_unavailable':
      return '当前环境没有可用 POSIX shell。Windows 下应优先使用 PowerShell、CMD、Node 原生文件能力或高层文件工具。'
    case 'command_not_found':
      return '命令或工具依赖不存在。请确认命令/PATH 是否可用，或检查打包产物里的工具二进制是否存在。'
    case 'path_not_found':
      return '目标路径不存在。请先确认工作区、相对路径和目录是否正确。'
    case 'task_not_found':
      return '任务不存在或已清理。这通常是模型误用了 TaskOutput：只能使用后台任务返回的真实 task_id。'
    case 'file_too_large':
      return '文件超过单次读取上限。请改用 offset/limit 分段读取，或先搜索关键词定位目标内容。'
    case 'permission_denied':
      return '权限被拒绝。请确认用户授权、文件系统权限或安全规则。'
    case 'mcp_unavailable':
      return 'MCP 服务不可用。请检查 MCP 配置、进程状态和连接方式。'
    case 'browser_unavailable':
      return '浏览器工具不可用。请检查 Playwright/浏览器运行时是否安装并可启动。'
    case 'timeout':
      return '工具执行超时。可以缩小任务范围、增加超时时间或分步执行。'
    case 'unknown_failure':
      return '工具执行失败，原始错误已在卡片结果中展示。'
    default:
      return undefined
  }
}

function getToolStatusLabel(status: string): string {
  switch (status) {
    case 'preparing':
      return '准备中'
    case 'waiting_permission':
      return '等待权限'
    case 'running':
    case 'streaming':
    case 'pending':
      return '执行中'
    case 'completed':
      return '成功'
    case 'failed':
      return '失败'
    case 'denied':
      return '已拒绝'
    case 'interrupted':
      return '已中断'
    case 'cancelled':
      return '已取消'
    case 'timeout':
      return '已超时'
    default:
      return status
  }
}

function shouldHideToolFromTimeline(snapshot: ThreadDisplayToolSnapshot): boolean {
  if (snapshot.status === 'failed') {
    return false
  }
  if (snapshot.kind === 'call' && snapshot.showInMainTimeline === false) {
    return true
  }
  return (
    (snapshot.kind === 'call' &&
      (snapshot.category === 'control' || isControlToolInvocation(snapshot.name))) ||
    isInternalPlanDraftWrite(snapshot)
  )
}

function isInternalPlanDraftWrite(snapshot: ThreadDisplayToolSnapshot): boolean {
  if (snapshot.kind !== 'call' || snapshot.name !== 'Write') {
    return false
  }
  const path = getToolPath(snapshot)
  return Boolean(path && /(?:^|\/)\.ccr\/plans\/[^/]+\.md$/i.test(path.replace(/\\/g, '/')))
}

function getToolPath(snapshot: ThreadDisplayToolSnapshot): string | undefined {
  if (typeof snapshot.target === 'string' && snapshot.target.trim()) {
    return snapshot.target
  }
  const input = getJsonObject(snapshot.input)
  return getString(input, ['file_path', 'filePath', 'path'])
}

function extractFileDisplaySnapshotsFromToolSnapshot(
  snapshot: ThreadDisplayToolSnapshot,
): Pick<
  ThreadDisplayProjectedEvent,
  'fileToolSnapshot' | 'fileSnapshot' | 'referenceSnapshot'
> {
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
    return { fileToolSnapshot }
  }
  return {
    fileToolSnapshot,
    fileSnapshot: {
      id: createSnapshotId(snapshot.id, 'file', path),
      source,
      kind: getFileSnapshotKind(source),
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

function extractFileToolSnapshot(
  snapshot: ThreadDisplayToolSnapshot,
  source: FileSnapshotSource,
): ThreadDisplayFileToolSnapshot {
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
    actions: getFileToolActions(pathFields.safety, operation, path),
    toolUseId: snapshot.identity?.toolUseId,
    identity: snapshot.identity,
    raw: {
      input: snapshot.input,
      result: snapshot.result,
    },
  }
}

function extractSearchReferenceSnapshot(
  snapshot: ThreadDisplayToolSnapshot,
  source: 'Glob' | 'Grep',
): Pick<ThreadDisplayProjectedEvent, 'referenceSnapshot'> {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const filenames = getStringArray(result, ['filenames'])
  const path =
    filenames[0] ??
    getString(input, ['path']) ??
    getString(input, ['glob']) ??
    getString(input, ['pattern'])
  return path
    ? {
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
    : {}
}

function getFileSnapshotKind(
  source: FileSnapshotSource,
): ThreadDisplayFileSnapshot['kind'] {
  if (source === 'Read') {
    return 'read_file'
  }
  if (source === 'Edit' || source === 'MultiEdit') {
    return 'edited_file'
  }
  if (source === 'Write') {
    return 'generated_file'
  }
  return 'reference'
}

function getFileToolOperation(
  name: string,
  source: FileSnapshotSource,
): ThreadDisplayFileToolSnapshot['operation'] {
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
  operation: ThreadDisplayFileToolSnapshot['operation'],
  status: string,
  path: string | undefined,
): string {
  const target = path ?? '未知路径'
  if (isFailureStatus(status)) {
    return `${getFileOperationText(operation)}失败：${target}`
  }
  if (['running', 'streaming', 'pending', 'waiting_permission'].includes(status)) {
    return `正在${getFileOperationText(operation)}：${target}`
  }
  return `${getFileOperationText(operation)}：${target}`
}

function getFileOperationText(
  operation: ThreadDisplayFileToolSnapshot['operation'],
): string {
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

function getPrimaryFilePath(
  snapshot: ThreadDisplayToolSnapshot,
): string | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  return (
    getString(input, ['file_path', 'filePath', 'path']) ??
    getString(input, ['notebook_path', 'notebookPath']) ??
    getString(result, ['filePath', 'path']) ??
    getString(result, ['notebookPath', 'notebook_path']) ??
    getString(getJsonObject(result?.file), ['filePath', 'path'])
  )
}

function getSearchPath(snapshot: ThreadDisplayToolSnapshot): string | undefined {
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

function getTextRange(
  snapshot: ThreadDisplayToolSnapshot,
): TextRangeSnapshot | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const startLine = getNumber(result, ['startLine']) ?? getNumber(input, ['offset'])
  const startColumn = getNumber(result, ['startColumn'])
  const endLine =
    getNumber(result, ['endLine']) ??
    inferEndLine(startLine, getNumber(result, ['numLines']))
  const endColumn = getNumber(result, ['endColumn'])
  const range = { startLine, startColumn, endLine, endColumn }
  return Object.values(range).some(value => value !== undefined) ? range : undefined
}

function inferEndLine(
  startLine: number | undefined,
  numLines: number | undefined,
): number | undefined {
  return startLine === undefined || numLines === undefined || numLines <= 0
    ? undefined
    : startLine + numLines - 1
}

function getFileToolDiff(snapshot: ThreadDisplayToolSnapshot): unknown {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  if (result && ('diff' in result || 'edits' in result)) {
    return { diff: result.diff, edits: result.edits }
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
  const text = stringifyToolResult(value).trim()
  return text || undefined
}

function getFileToolActions(
  safety: PathSafety,
  operation: ThreadDisplayFileToolSnapshot['operation'],
  path?: string,
): ThreadDisplayFileToolSnapshot['actions'] {
  if (safety === 'remote' || operation === 'unknown') {
    return []
  }
  if (operation === 'search' && isGlobPatternPath(path)) {
    return ['copyReference']
  }
  const actions: ThreadDisplayFileToolSnapshot['actions'] = ['copyPath']
  if (safety !== 'unknown' && !isGlobPatternPath(path)) {
    actions.unshift('open')
    actions.push('reveal')
  }
  if (operation === 'search') {
    actions.push('copyReference')
  }
  return actions
}

function isGlobPatternPath(path: string | undefined): boolean {
  return Boolean(path && /[*?[\]{}]/.test(path))
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

function createSnapshotId(
  eventId: string,
  kind: 'file' | 'reference',
  path: string,
): string {
  const normalizedPath = path.replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80)
  return `${eventId}:${kind}:${normalizedPath || 'unknown'}`
}

function extractAttachmentSnapshotsFromContentBlocks(input: {
  eventId: string
  blocks: readonly JsonObject[]
  source: ThreadDisplayAttachmentSnapshot['source']
  identity?: ThreadDisplayProjectionIdentity
}): ThreadDisplayAttachmentSnapshot[] {
  const attachmentBlocks = collectAttachmentBlocks(input.blocks)
  if (input.source === 'ModelOutput') {
    attachmentBlocks.push(
      ...collectGeneratedOutputImagePathBlocks(input.blocks, attachmentBlocks),
    )
  }
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
          block.content.filter(
            (item): item is JsonObject =>
              Boolean(item && typeof item === 'object' && !Array.isArray(item)),
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
                Boolean(item && typeof item === 'object' && !Array.isArray(item)),
            ),
          ),
        )
      }
    }
    if (type === 'tool_use' && Array.isArray(block.result)) {
      collected.push(
        ...collectAttachmentBlocks(
          block.result.filter(
            (item): item is JsonObject =>
              Boolean(item && typeof item === 'object' && !Array.isArray(item)),
          ),
        ),
      )
    }
    if (type === 'tool_use') {
      const result = getJsonObject(block.result)
      if (Array.isArray(result?.output)) {
        collected.push(
          ...collectAttachmentBlocks(
            result.output.filter(
              (item): item is JsonObject =>
                Boolean(item && typeof item === 'object' && !Array.isArray(item)),
            ),
          ),
        )
      }
    }
  }
  return collected
}

function collectGeneratedOutputImagePathBlocks(
  blocks: readonly JsonObject[],
  existingBlocks: readonly JsonObject[],
): JsonObject[] {
  const existingPaths = new Set(
    existingBlocks
      .map(block => getAttachmentPath(block, getGeneratedArtifactSnapshotFromBlock(block)))
      .filter((path): path is string => Boolean(path))
      .map(normalizePathKey),
  )
  const generatedBlocks: JsonObject[] = []
  for (const block of blocks) {
    const type = getString(block, ['type'])
    if (type !== 'text') {
      continue
    }
    const text = getString(block, ['text'])
    if (!text) {
      continue
    }
    for (const path of extractGeneratedOutputImagePaths(text)) {
      const key = normalizePathKey(path)
      if (existingPaths.has(key)) {
        continue
      }
      existingPaths.add(key)
      generatedBlocks.push(createGeneratedOutputImageBlockFromPath(path))
    }
  }
  return generatedBlocks
}

function extractGeneratedOutputImagePaths(text: string): string[] {
  return Array.from(text.matchAll(GENERATED_OUTPUT_IMAGE_PATH_PATTERN), match =>
    match[0].trim(),
  )
}

function createGeneratedOutputImageBlockFromPath(path: string): JsonObject {
  const displayName = getPathBasename(path)
  const outputId = displayName.replace(/\.[^.]+$/, '')
  return {
    type: 'image',
    attachmentId: outputId,
    displayName,
    mimeType: getImageMimeTypeFromPath(path),
    origin: 'model_output',
    lifecycle: 'persisted',
    safety: 'needs_review',
    outputId,
    savedPath: path,
    generatedArtifact: {
      id: outputId,
      type: 'image',
      status: 'saved',
      savedPath: path,
      mimeType: getImageMimeTypeFromPath(path),
      outputId,
      lifecycle: 'persisted',
      safety: 'needs_review',
    },
    source: {
      kind: 'file',
      path,
    },
  }
}

function getImageMimeTypeFromPath(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp'
  }
  if (lower.endsWith('.gif')) {
    return 'image/gif'
  }
  return 'image/png'
}

function normalizePathKey(path: string): string {
  return path.replace(/\//g, '\\').toLowerCase()
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

function getPathBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function formatAttachmentSummary(value: unknown): string {
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

function formatUnknownValue(value: unknown): string {
  if (typeof value === 'string') {
    return limitMessageText(value)
  }
  return formatJsonBlock(value)
}

function formatJsonBlock(value: unknown): string {
  if (value === undefined) {
    return ''
  }
  try {
    const json = JSON.stringify(value, null, 2)
    return json ? `\`\`\`json\n${limitMessageText(json)}\n\`\`\`` : ''
  } catch {
    return String(value)
  }
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(stringifyToolResult).filter(Boolean).join('\n')
  }
  if (value && typeof value === 'object') {
    const object = value as JsonObject
    if (typeof object.text === 'string') {
      return object.text
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return value === undefined ? '' : String(value)
}

function limitMessageText(text: string): string {
  const maxLength = 4_000
  return text.length <= maxLength
    ? text
    : `${text.slice(0, maxLength)}\n... 已截断 ${text.length - maxLength} 字符`
}

function getToolName(block: JsonObject): string {
  return getString(block, ['name']) ?? '未知工具'
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
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
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

function isOneOf<T extends string>(
  value: string | undefined,
  options: readonly T[],
): T | undefined {
  return value && options.includes(value as T) ? (value as T) : undefined
}
