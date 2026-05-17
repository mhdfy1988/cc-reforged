import {
  SessionHistoryListParamsSchema,
  ThreadListParamsSchema,
  ThreadResumeParamsSchema,
  ThreadStartParamsSchema,
  TurnInterruptParamsSchema,
  TurnStartParamsSchema,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'
import { normalizeTurnStartInputForCurrentModel } from '../turnInput.js'
import type {
  AppServerThreadMessage,
  SessionHistoryItem,
  SessionHistoryTitleSource,
  SessionHistoryWorkspaceGroup,
  TurnStartParams,
} from '../protocol.js'
import type { LogOption } from '../../types/logs.js'
import type { Message } from '../../types/message.js'
import { getOriginalCwd } from '../../bootstrap/state.js'
import { getWorktreePaths } from '../../utils/getWorktreePaths.js'
import {
  getSessionIdFromLog,
  loadAllProjectsMessageLogsProgressive,
  loadSameRepoMessageLogsProgressive,
} from '../../utils/sessionStorage.js'
import { basename } from 'node:path'

export function handleThreadStart(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = ThreadStartParamsSchema.parse(params ?? {})
  return {
    thread: context.core.session.startThread(parsedParams),
  }
}

export function handleThreadList(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  ThreadListParamsSchema.parse(params ?? {})
  return {
    threads: context.core.session.listThreads(),
  }
}

export async function handleSessionHistoryList(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = SessionHistoryListParamsSchema.parse(params ?? {})
  const limit = parsedParams.limit ?? 50
  const cursorOffset = parseCursorOffset(parsedParams.cursor)
  const query = normalizeSearchText(parsedParams.query)
  const currentSessionIds = getCurrentSessionIds(context)
  const initialEnrichCount = Math.min(
    Math.max(cursorOffset + limit + 1, query ? 200 : limit + 1),
    500,
  )
  const result =
    parsedParams.scope === 'allProjects'
      ? await loadAllProjectsMessageLogsProgressive(undefined, initialEnrichCount)
      : await loadSameRepoMessageLogsProgressive(
          await getWorktreePaths(getOriginalCwd()).catch(() => [getOriginalCwd()]),
          undefined,
          initialEnrichCount,
        )
  const historyItems = result.logs
    .map(log => logToHistoryItem(log, currentSessionIds))
    .filter((item): item is SessionHistoryItem => item !== null)
    .filter(item => parsedParams.includeCurrent || !item.isCurrentSession)
    .filter(item => historyItemMatchesQuery(item, query))

  const pageItems = historyItems.slice(cursorOffset, cursorOffset + limit)
  const groups = groupHistoryItems(pageItems, getOriginalCwd())
  const hasMore =
    historyItems.length > cursorOffset + limit ||
    result.nextIndex < result.allStatLogs.length

  return {
    groups,
    ...(hasMore ? { nextCursor: String(cursorOffset + limit) } : {}),
  }
}

export async function handleThreadResume(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = ThreadResumeParamsSchema.parse(params)
  const thread = await context.core.session.resumeThread({
    sessionId: parsedParams.sessionId!,
    ...(parsedParams.title ? { title: parsedParams.title } : {}),
    ...(parsedParams.transcriptPath
      ? { transcriptPath: parsedParams.transcriptPath }
      : {}),
    ...(parsedParams.projectPath ? { projectPath: parsedParams.projectPath } : {}),
    ...(parsedParams.metadata ? { metadata: parsedParams.metadata } : {}),
  })
  return {
    thread,
    messages: toAppServerThreadMessages(
      context.core.session.listThreadMessages(thread.threadId),
    ),
  }
}

export function handleTurnStart(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = TurnStartParamsSchema.parse(params) as TurnStartParams
  const normalizedInput = normalizeTurnStartInputForCurrentModel({
    params: parsedParams,
    model: context.core.model,
  })
  return {
    turn: context.core.session.startTurn({
      threadId: parsedParams.threadId!,
      input: normalizedInput.input,
      ...(normalizedInput.metadata ? { metadata: normalizedInput.metadata } : {}),
    }),
  }
}

export function handleTurnInterrupt(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = TurnInterruptParamsSchema.parse(params)
  return context.core.session.interruptTurn({
    threadId: parsedParams.threadId!,
    turnId: parsedParams.turnId!,
    ...(parsedParams.reason ? { reason: parsedParams.reason } : {}),
  })
}

function toAppServerThreadMessages(messages: Message[]): AppServerThreadMessage[] {
  const unresolvedToolUseIds = collectUnresolvedToolUseIds(messages)
  const replayMessages: AppServerThreadMessage[] = []
  for (const [index, message] of messages.entries()) {
    const interruptedNotice = createInterruptedReplayNotice(
      message,
      index,
      messages,
    )
    if (interruptedNotice) {
      replayMessages.push(interruptedNotice)
      continue
    }
    const replayMessage = messageToThreadMessage(
      message,
      index,
      unresolvedToolUseIds,
    )
    if (replayMessage) {
      replayMessages.push(replayMessage)
    }
  }
  return replayMessages
}

function messageToThreadMessage(
  message: Message,
  index: number,
  unresolvedToolUseIds: Set<string>,
): AppServerThreadMessage | null {
  if (isHiddenHistoryMessage(message)) {
    return null
  }

  const text = extractMessageDisplayText(message)
  if (!text.trim()) {
    return null
  }
  const replayContent = getThreadMessageReplayContent(
    message,
    unresolvedToolUseIds,
  )

  return {
    id: typeof message.uuid === 'string' ? message.uuid : `history-${index}`,
    role: getThreadMessageRole(message),
    text: truncateThreadMessageText(text),
    status: 'completed',
    kind: message.type,
    sourceType: message.type,
    ...(replayContent !== undefined ? { content: replayContent } : {}),
    ...(typeof message.timestamp === 'string'
      ? { createdAt: message.timestamp }
      : {}),
  }
}

function isHiddenHistoryMessage(message: Message): boolean {
  return (
    ('isMeta' in message && message.isMeta === true) ||
    ('isVirtual' in message && message.isVirtual === true) ||
    isSyntheticHistoryMessage(message)
  )
}

function createInterruptedReplayNotice(
  message: Message,
  index: number,
  messages: Message[],
): AppServerThreadMessage | null {
  if (
    message.type !== 'assistant' ||
    message.isApiErrorMessage === true ||
    getSyntheticHistoryMessageText(message) !== 'No response requested.'
  ) {
    return null
  }

  const previousMessage = findPreviousVisibleHistoryMessage(messages, index)
  if (!previousMessage || previousMessage.type !== 'user') {
    return null
  }

  return {
    id:
      typeof message.uuid === 'string'
        ? `${message.uuid}-interrupted-notice`
        : `history-${index}-interrupted-notice`,
    role: 'system',
    text: '本轮已中断，未产生可恢复回复。',
    status: 'interrupted',
    kind: 'interrupted_replay_notice',
    sourceType: 'synthetic_recovery',
    content: [{ type: 'text', text: '本轮已中断，未产生可恢复回复。' }],
    ...(typeof message.timestamp === 'string'
      ? { createdAt: message.timestamp }
      : {}),
  }
}

function findPreviousVisibleHistoryMessage(
  messages: Message[],
  beforeIndex: number,
): Message | undefined {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (
      !message ||
      message.type === 'system' ||
      message.type === 'progress' ||
      isToolResultHistoryMessage(message) ||
      isHiddenHistoryMessage(message)
    ) {
      continue
    }
    return message
  }
  return undefined
}

function isToolResultHistoryMessage(message: Message): boolean {
  if (message.type !== 'user') {
    return false
  }
  const content = message.message?.content
  return (
    Array.isArray(content) &&
    content.some(
      block =>
        block &&
        typeof block === 'object' &&
        'type' in block &&
        block.type === 'tool_result',
    )
  )
}

function isSyntheticHistoryMessage(message: Message): boolean {
  const text = getSyntheticHistoryMessageText(message)
  return Boolean(text && SYNTHETIC_HISTORY_MESSAGES.has(text))
}

function getSyntheticHistoryMessageText(message: Message): string | undefined {
  if (message.type !== 'assistant' && message.type !== 'user') {
    return undefined
  }
  const content = message.message?.content
  return typeof content === 'string'
    ? content
    : Array.isArray(content) &&
        content.length === 1 &&
        content[0] &&
        typeof content[0] === 'object' &&
        'text' in content[0] &&
        typeof content[0].text === 'string'
      ? content[0].text
      : undefined
}

const SYNTHETIC_HISTORY_MESSAGES = new Set([
  '[Request interrupted by user]',
  '[Request interrupted by user for tool use]',
  "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.",
  "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
  'No response requested.',
])

function getThreadMessageRole(
  message: Message,
): AppServerThreadMessage['role'] {
  if (message.type === 'user') {
    return 'user'
  }
  if (message.type === 'assistant') {
    return message.isApiErrorMessage ? 'error' : 'assistant'
  }
  return 'system'
}

function extractMessageDisplayText(message: Message): string {
  switch (message.type) {
    case 'user':
    case 'assistant':
      return extractContentDisplayText(message.message?.content)
    case 'system':
      return extractContentDisplayText(message.content)
    case 'attachment':
      return extractAttachmentDisplayText(message.attachment)
    case 'progress':
      return extractContentDisplayText(message.data)
    case 'tool_use_summary':
      return message.summary
  }
}

function extractContentDisplayText(value: unknown): string {
  if (typeof value === 'string') {
    return stripSystemReminders(value)
  }
  if (Array.isArray(value)) {
    return value
      .map(extractContentBlockDisplayText)
      .filter(Boolean)
      .join('\n')
      .trim()
  }
  return extractUnknownDisplayText(value)
}

function getThreadMessageReplayContent(
  message: Message,
  unresolvedToolUseIds: Set<string>,
): unknown {
  switch (message.type) {
    case 'user':
      return message.message?.content
    case 'assistant':
      return annotateUnresolvedToolUseBlocks(
        message.message?.content,
        unresolvedToolUseIds,
      )
    case 'system':
      return message.content
    case 'attachment':
      return [{ type: 'attachment', attachment: message.attachment }]
    case 'progress':
      return [
        {
          type: 'progress',
          data: message.data,
          toolUseId: message.toolUseID,
          toolUseID: message.toolUseID,
          tool_use_id: message.toolUseID,
          parentToolUseId: message.parentToolUseID,
          parentToolUseID: message.parentToolUseID,
          parent_tool_use_id: message.parentToolUseID,
        },
      ]
    case 'tool_use_summary':
      return [{ type: 'tool_use_summary', summary: message.summary }]
  }
}

function collectUnresolvedToolUseIds(messages: Message[]): Set<string> {
  const toolUseIds = new Set<string>()
  const toolResultIds = new Set<string>()

  for (const message of messages) {
    for (const block of getMessageContentBlocks(message)) {
      const type = getContentBlockType(block)
      if (type === 'tool_use') {
        const toolUseId = getToolUseBlockId(block)
        if (toolUseId) {
          toolUseIds.add(toolUseId)
        }
      }
      if (type === 'tool_result') {
        const toolUseId = getToolResultBlockToolUseId(block)
        if (toolUseId) {
          toolResultIds.add(toolUseId)
        }
      }
    }
  }

  for (const toolUseId of toolResultIds) {
    toolUseIds.delete(toolUseId)
  }
  return toolUseIds
}

function annotateUnresolvedToolUseBlocks(
  content: unknown,
  unresolvedToolUseIds: Set<string>,
): unknown {
  if (!Array.isArray(content) || unresolvedToolUseIds.size === 0) {
    return content
  }

  let changed = false
  const annotated = content.map(block => {
    if (!isRecord(block) || getContentBlockType(block) !== 'tool_use') {
      return block
    }
    const toolUseId = getToolUseBlockId(block)
    if (!toolUseId || !unresolvedToolUseIds.has(toolUseId)) {
      return block
    }
    changed = true
    return {
      ...block,
      status: 'interrupted',
      historyStatus: 'interrupted',
      statusText: 'interrupted',
      interruptedReason: 'missing_tool_result_on_history_replay',
    }
  })

  return changed ? annotated : content
}

function getMessageContentBlocks(message: Message): Record<string, unknown>[] {
  const content =
    message.type === 'assistant' || message.type === 'user'
      ? message.message?.content
      : message.type === 'system'
        ? message.content
        : undefined
  if (!Array.isArray(content)) {
    return []
  }
  return content.filter(isRecord)
}

function getContentBlockType(block: Record<string, unknown>): string {
  return typeof block.type === 'string' ? block.type : ''
}

function getToolUseBlockId(block: Record<string, unknown>): string | undefined {
  return getStringField(block, ['id', 'toolUseId', 'toolUseID', 'tool_use_id'])
}

function getToolResultBlockToolUseId(
  block: Record<string, unknown>,
): string | undefined {
  return getStringField(block, [
    'tool_use_id',
    'toolUseId',
    'toolUseID',
    'toolCallId',
    'tool_call_id',
  ])
}

function getStringField(
  block: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = block[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function extractContentBlockDisplayText(block: unknown): string {
  if (!block || typeof block !== 'object') {
    return extractUnknownDisplayText(block)
  }
  const object = block as Record<string, unknown>
  const type = typeof object.type === 'string' ? object.type : ''
  if (isTextLikeContentBlockType(type)) {
    return extractContentDisplayText(object.text)
  }
  if (type === 'tool_use') {
    const name = typeof object.name === 'string' ? object.name : '工具'
    const input = extractUnknownDisplayText(object.input)
    return input ? `工具调用：${name}\n${input}` : `工具调用：${name}`
  }
  if (type === 'tool_result') {
    const result = extractUnknownDisplayText(object.content)
    return result ? `工具结果：\n${result}` : '工具结果'
  }
  if (type === 'image' || type === 'image_url' || type === 'input_image') {
    return '[图片]'
  }
  if (type === 'file' || type === 'input_file') {
    return '[文件]'
  }
  if (type === 'audio' || type === 'input_audio') {
    return '[音频]'
  }
  if (
    type === 'thinking' ||
    type === 'redacted_thinking' ||
    type === 'reasoning'
  ) {
    return ''
  }
  return extractUnknownDisplayText(object.text ?? object.content ?? object)
}

function isTextLikeContentBlockType(type: string): boolean {
  return type === 'text' || type === 'input_text' || type === 'output_text'
}

function extractAttachmentDisplayText(attachment: unknown): string {
  if (!attachment || typeof attachment !== 'object') {
    return ''
  }
  const object = attachment as Record<string, unknown>
  const type = typeof object.type === 'string' ? object.type : 'attachment'
  const text = extractUnknownDisplayText(
    object.content ?? object.prompt ?? object.text ?? object.path,
  )
  return text ? `附件：${type}\n${text}` : `附件：${type}`
}

function extractUnknownDisplayText(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    return stripSystemReminders(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (!value || depth > 2) {
    return ''
  }
  if (Array.isArray(value)) {
    return value
      .map(item => extractUnknownDisplayText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
  }

  const object = value as Record<string, unknown>
  const preferredKeys = [
    'text',
    'content',
    'output',
    'result',
    'message',
    'stdout',
    'stderr',
    'command',
    'pattern',
    'file_path',
    'path',
    'prompt',
    'query',
    'url',
  ]
  const parts: string[] = []
  for (const key of preferredKeys) {
    const text = extractUnknownDisplayText(object[key], depth + 1)
    if (text) {
      parts.push(text)
    }
  }
  return parts.join('\n')
}

function stripSystemReminders(value: string): string {
  let text = value
  let open = text.indexOf('<system-reminder>')
  while (open >= 0) {
    const close = text.indexOf('</system-reminder>', open)
    if (close < 0) {
      break
    }
    text =
      text.slice(0, open) + text.slice(close + '</system-reminder>'.length)
    open = text.indexOf('<system-reminder>')
  }
  return text.trim()
}

function truncateThreadMessageText(text: string): string {
  const normalized = text.trim()
  const maxLength = 12000
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}\n\n[历史消息过长，已截断显示]`
    : normalized
}

function logToHistoryItem(
  log: LogOption,
  currentSessionIds: Set<string>,
): SessionHistoryItem | null {
  const sessionId = getSessionIdFromLog(log) ?? extractSessionIdFromPath(log.fullPath)
  if (!sessionId) {
    return null
  }

  const titleParts = selectHistoryTitle(log, sessionId)
  const isCurrentSession = currentSessionIds.has(sessionId)
  const firstPrompt = normalizeTitle(log.firstPrompt)
  return {
    sessionId,
    threadId: `history_${sessionId}`,
    title: titleParts.title,
    titleSource: titleParts.source,
    ...(firstPrompt ? { firstPrompt } : {}),
    ...(titleParts.source === 'lastPrompt' && firstPrompt
      ? { lastPrompt: firstPrompt }
      : {}),
    ...(normalizeTitle(log.summary) ? { summary: normalizeTitle(log.summary) } : {}),
    createdAt: log.created.toISOString(),
    updatedAt: log.modified.toISOString(),
    messageCount: log.messageCount,
    ...(log.projectPath ? { projectPath: log.projectPath } : {}),
    ...(log.fullPath ? { transcriptPath: log.fullPath } : {}),
    isCurrentSession,
    status: isCurrentSession ? 'current' : 'closed',
  }
}

function selectHistoryTitle(log: LogOption, sessionId: string): {
  title: string
  source: SessionHistoryTitleSource
} {
  const customTitle = normalizeTitle(log.customTitle)
  if (customTitle) {
    return { title: customTitle, source: 'customTitle' }
  }

  const prompt = normalizeTitle(log.firstPrompt)
  if (prompt) {
    return { title: prompt, source: 'firstPrompt' }
  }

  return {
    title: `未命名会话 ${shortSessionId(sessionId)}`,
    source: 'fallback',
  }
}

function normalizeTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const title = value.replace(/\s+/g, ' ').trim()
  if (!title || title === '(session)') {
    return undefined
  }
  return title.length > 40 ? `${title.slice(0, 39)}…` : title
}

function normalizeSearchText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function historyItemMatchesQuery(
  item: SessionHistoryItem,
  query: string,
): boolean {
  if (!query) {
    return true
  }
  return [
    item.title,
    item.firstPrompt,
    item.lastPrompt,
    item.summary,
    item.sessionId,
    item.projectPath,
    item.transcriptPath,
  ]
    .filter((value): value is string => typeof value === 'string')
    .some(value => value.toLowerCase().includes(query))
}

function groupHistoryItems(
  items: SessionHistoryItem[],
  currentWorkspacePath: string,
): SessionHistoryWorkspaceGroup[] {
  const byWorkspace = new Map<string, SessionHistoryItem[]>()
  for (const item of items) {
    const workspacePath = item.projectPath ?? '未知工作区'
    const group = byWorkspace.get(workspacePath)
    if (group) {
      group.push(item)
    } else {
      byWorkspace.set(workspacePath, [item])
    }
  }

  return [...byWorkspace.entries()]
    .map(([workspacePath, sessions]) => {
      sessions.sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      )
      return {
        workspacePath,
        workspaceName: getWorkspaceName(workspacePath),
        isCurrentWorkspace: pathsEqual(workspacePath, currentWorkspacePath),
        updatedAt: sessions[0]?.updatedAt ?? new Date(0).toISOString(),
        sessionCount: sessions.length,
        sessions,
      }
    })
    .sort((left, right) => {
      if (left.isCurrentWorkspace !== right.isCurrentWorkspace) {
        return left.isCurrentWorkspace ? -1 : 1
      }
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    })
}

function getCurrentSessionIds(context: AppServerContext): Set<string> {
  const ids = new Set<string>()
  for (const thread of context.core.session.listThreads()) {
    if (thread.status !== 'active') {
      continue
    }
    for (const key of ['sessionId', 'resumedFromSessionId']) {
      const value = thread.metadata[key]
      if (typeof value === 'string' && value.trim()) {
        ids.add(value)
      }
    }
  }
  return ids
}

function getWorkspaceName(workspacePath: string): string {
  if (workspacePath === '未知工作区') {
    return workspacePath
  }
  return basename(workspacePath) || workspacePath
}

function pathsEqual(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}

function parseCursorOffset(cursor: string | undefined): number {
  if (!cursor) {
    return 0
  }
  const offset = Number.parseInt(cursor, 10)
  return Number.isFinite(offset) && offset > 0 ? offset : 0
}

function shortSessionId(sessionId: string): string {
  return sessionId.length > 10 ? sessionId.slice(0, 10) : sessionId
}

function extractSessionIdFromPath(path: string | undefined): string | undefined {
  const match = path?.match(/([^\\/]+)\.jsonl$/)
  return match?.[1]
}
