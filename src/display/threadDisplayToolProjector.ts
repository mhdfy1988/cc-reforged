import {
  getCcrToolDisplayMetadata,
  type CcrToolDisplayCategory,
  type CcrToolDisplayMetadata,
} from '../services/tools/toolDisplayCatalog.js'
import type {
  ThreadDisplayProjectionInput,
  ThreadDisplayToolSnapshot,
} from './threadDisplayProjection.js'
import {
  createProjectionIdentityFromItem,
  selectConfirmedProjectionBlock,
  type JsonObject,
} from './threadDisplayProjectorFacts.js'

export function extractToolSnapshotFromBlocks(
  id: string,
  blocks: JsonObject[],
  item: ThreadDisplayProjectionInput,
): ThreadDisplayToolSnapshot | null {
  const primary = selectConfirmedProjectionBlock(
    blocks,
    item,
    isToolProjectionBlock,
  )
  if (!primary) {
    return null
  }

  const block = primary.block
  const type = getString(block, ['type']) ?? ''
  const identity = createProjectionIdentityFromItem(
    item,
    block,
    primary.contentIndex,
  )
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

export function shouldHideToolFromTimeline(snapshot: ThreadDisplayToolSnapshot): boolean {
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

function stringifyToolResult(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(stringifyToolResult).filter(Boolean).join('\n')
  }
  if (value && typeof value === 'object') {
    const object = value as JsonObject
    const text = getString(object, ['text', 'content', 'message', 'output', 'stderr', 'stdout'])
    if (text) {
      return text
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return value === undefined || value === null ? '' : String(value)
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
  }
  return undefined
}
