import type { JsonObject } from './displayTypes.js'
import {
  createDisplayEventIdentity,
  withContentBlock,
  type DisplayEventContractContext,
  type DisplayEventIdentity,
} from './eventContract.js'
import {
  getCcrToolDisplayMetadata,
  type CcrToolDisplayCategory,
  type CcrToolDisplayMetadata,
} from '../../../../../../src/services/tools/toolDisplayCatalog.js'

export type ToolSnapshotKind = 'call' | 'result' | 'progress'
export type ToolCategory =
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

export type ToolErrorClass =
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

export type ToolSnapshot = {
  id: string
  kind: ToolSnapshotKind
  name: string
  displayName?: string
  category: ToolCategory
  status: string
  statusLabel?: string
  summary: string
  identity?: DisplayEventIdentity
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
  errorClass?: ToolErrorClass
  errorMessage?: string
  actionableHint?: string
  detailKeys?: string[]
  showInMainTimeline?: boolean
  raw?: unknown
}

export function extractToolSnapshotFromBlocks(
  id: string,
  blocks: JsonObject[],
  statusText: string,
  context?: DisplayEventContractContext,
): ToolSnapshot | null {
  for (const [contentIndex, block] of blocks.entries()) {
    const type = typeof block.type === 'string' ? block.type : ''
    const effectiveContentIndex = context?.contentIndex ?? contentIndex
    const identity = createDisplayEventIdentity(
      withContentBlock(context ?? { itemId: id }, block, effectiveContentIndex),
    )

    if (type === 'tool_use') {
      const name = getToolName(block)
      const input = getJsonObject(block.input)
      const category = classifyToolCategory(name, input)
      const metadata = extractToolCallMetadata(name, category, input)
      const status = getToolUseDisplayStatus(block, context)
      const timing = extractToolTiming(block, input, context)

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
        description: metadata.description,
        target: metadata.target,
        command: metadata.command,
        cwd: metadata.cwd,
        shell: metadata.shell,
        provider: metadata.provider,
        risk: metadata.risk,
        detailKeys: metadata.detailKeys,
        showInMainTimeline: metadata.showInMainTimeline,
        ...timing,
        raw: block,
      }
    }

    if (type === 'tool_result') {
      const resultText = stringifyToolResult(block.content)
      const timing = extractToolTiming(
        block,
        getToolResultTimingSource(block.content),
        context,
      )
      const category = classifyToolCategory(getToolName(block))
      const isError = Boolean(block.isError) || isFailureStatus(statusText)
      const isMissingTaskOutput = isTaskNotFoundToolResult(resultText)
      const errorClass = isError || isMissingTaskOutput
        ? classifyToolError(resultText, category)
        : undefined
      const status = normalizeToolResultStatus(
        isError && !isMissingTaskOutput,
        statusText,
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
        summary: isMissingTaskOutput
          ? '任务不存在，可能是模型误调用'
          : status === 'completed' ? '工具执行成功' : '工具执行失败',
        identity,
        result: block.content,
        errorClass,
        errorMessage: isError && errorClass ? resultText : undefined,
        actionableHint: getActionableHint(errorClass),
        ...timing,
        raw: block,
      }
    }

    if (type === 'progress') {
      const metadata = extractProgressMetadata(block.data)
      const timing = extractToolTiming(block, getJsonObject(block.data), context)
      return {
        id,
        kind: 'progress',
        name: metadata.name,
        displayName: metadata.displayName,
        category: metadata.category,
        status: 'running',
        statusLabel: getToolStatusLabel('running'),
        summary: metadata.summary,
        identity,
        result: block.data,
        ...timing,
        raw: block,
      }
    }
  }

  return null
}

function extractToolTiming(
  block: JsonObject,
  nested: JsonObject | null,
  context: DisplayEventContractContext | undefined,
): Pick<ToolSnapshot, 'durationMs' | 'startedAt' | 'completedAt'> {
  const explicitDurationMs =
    getNumber(block, ['durationMs', 'duration_ms', 'elapsedTimeMs', 'elapsed_ms']) ??
    getNumber(nested, ['durationMs', 'duration_ms', 'elapsedTimeMs', 'elapsed_ms']) ??
    getNumber(context?.item, [
      'durationMs',
      'duration_ms',
      'elapsedTimeMs',
      'elapsed_ms',
    ]) ??
    getNumber(context?.params, [
      'durationMs',
      'duration_ms',
      'elapsedTimeMs',
      'elapsed_ms',
    ])
  const startedAt =
    getString(block, ['startedAt', 'started_at', 'startTime', 'start_time']) ??
    getString(nested, ['startedAt', 'started_at', 'startTime', 'start_time']) ??
    getString(context?.item, ['startedAt', 'started_at', 'startTime', 'start_time']) ??
    getString(context?.params, ['startedAt', 'started_at', 'startTime', 'start_time'])
  const completedAt =
    getString(block, [
      'completedAt',
      'completed_at',
      'endedAt',
      'ended_at',
      'endTime',
      'end_time',
    ]) ??
    getString(nested, [
      'completedAt',
      'completed_at',
      'endedAt',
      'ended_at',
      'endTime',
      'end_time',
    ]) ??
    getString(context?.item, [
      'completedAt',
      'completed_at',
      'endedAt',
      'ended_at',
      'endTime',
      'end_time',
    ]) ??
    getString(context?.params, [
      'completedAt',
      'completed_at',
      'endedAt',
      'ended_at',
      'endTime',
      'end_time',
    ])

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
  if (!Number.isFinite(startedMs) || !Number.isFinite(completedMs)) {
    return undefined
  }
  return Math.max(0, completedMs - startedMs)
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

function isHistoryReplayContext(
  context: DisplayEventContractContext | undefined,
): boolean {
  return context?.params?.source === 'history'
}

function getToolUseDisplayStatus(
  block: JsonObject,
  context: DisplayEventContractContext | undefined,
): string {
  const explicitStatus = normalizeToolUseStatus(
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
  return isHistoryReplayContext(context) ? 'completed' : 'running'
}

function normalizeToolUseStatus(status: string | undefined): string | undefined {
  if (!status) {
    return undefined
  }
  const normalized = status.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  if (normalized.includes('interrupt')) {
    return 'interrupted'
  }
  if (normalized.includes('cancel')) {
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
  if (
    normalized === 'running' ||
    normalized === 'streaming' ||
    normalized === 'pending' ||
    normalized === 'waiting_permission'
  ) {
    return normalized
  }
  return status
}

function extractProgressMetadata(data: unknown): Pick<
  ToolSnapshot,
  'name' | 'displayName' | 'category' | 'summary'
> {
  const value = getJsonObject(data)
  const progressType = getString(value, ['type'])
  if (progressType === 'powershell_progress') {
    return {
      name: 'PowerShell',
      displayName: 'PowerShell',
      category: 'shell',
      summary: 'PowerShell 正在执行',
    }
  }
  if (progressType === 'bash_progress') {
    return {
      name: 'Bash',
      displayName: 'Bash',
      category: 'shell',
      summary: 'Bash 正在执行',
    }
  }
  if (progressType === 'mcp_progress') {
    const serverName = getString(value, ['serverName', 'server_name'])
    const toolName = getString(value, ['toolName', 'tool_name'])
    const status = getString(value, ['status'])
    const displayName = formatMcpToolDisplayName(serverName, toolName)
    return {
      name: serverName && toolName ? `mcp__${serverName}__${toolName}` : 'MCP',
      displayName,
      category: 'mcp',
      summary: status ? `${displayName}：${status}` : `${displayName} 正在执行`,
    }
  }
  return {
    name: '工具进度',
    displayName: '工具进度',
    category: 'unknown',
    summary: '工具正在执行',
  }
}

function getToolName(block: JsonObject): string {
  return typeof block.name === 'string' && block.name.trim()
    ? block.name
    : '未知工具'
}

export function isControlToolName(name: string): boolean {
  return (
    name === 'AskUserQuestion' ||
    name === 'TodoWrite' ||
    name === 'EnterPlanMode' ||
    name === 'ExitPlanMode' ||
    name === 'ExitPlanModeV2'
  )
}

export function isControlToolInvocation(
  name: string,
  input?: JsonObject | null,
): boolean {
  if (isControlToolName(name)) {
    return true
  }

  const normalized = name.toLowerCase()
  if (
    !normalized.includes('search') &&
    !normalized.includes('select') &&
    !normalized.includes('tool')
  ) {
    return false
  }

  const searchableText = `${name} ${stringifyControlToolInput(input)}`.toLowerCase()
  return [
    'todowrite',
    'askuserquestion',
    'enterplanmode',
    'exitplanmode',
    'exitplanmodev2',
  ].some(toolName =>
    searchableText.includes(toolName.toLowerCase()),
  )
}

export function isControlToolResultText(value: unknown): boolean {
  const text = stringifyToolResult(value).toLowerCase()
  if (!text.trim()) {
    return true
  }
  return (
    text.includes('todos have been modified successfully') ||
    text.includes('continue to use the todo list') ||
    text.includes('tool execution successful')
  )
}

function classifyToolCategory(
  name: string,
  input?: JsonObject | null,
): ToolCategory {
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
): ToolCategory | undefined {
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

function extractToolCallMetadata(
  name: string,
  category: ToolCategory,
  input: JsonObject | null,
): Pick<
  ToolSnapshot,
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
  const cwd = getString(input, [
    'cwd',
    'workdir',
    'workingDirectory',
    'working_directory',
  ])
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

  if (name === 'GenerateImage') {
    return {
      displayName: registryDisplayName ?? '生成图片',
      summary: target ? `生成图片：${target}` : '生成图片',
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

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

  if (name === 'Read') {
    return {
      displayName: registryDisplayName ?? '读取文件',
      summary: target ? `读取文件：${target}` : '读取文件',
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (name === 'Write') {
    return {
      displayName: registryDisplayName ?? '写入文件',
      summary: target ? `写入文件：${target}` : '写入文件',
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (name === 'Edit' || name === 'MultiEdit' || name === 'NotebookEdit') {
    return {
      displayName: registryDisplayName ?? '编辑文件',
      summary: target ? `编辑文件：${target}` : `调用工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (name === 'LS') {
    return {
      displayName: registryDisplayName ?? '列出目录',
      summary: target ? `列出目录：${target}` : '列出目录',
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (name === 'Glob' || name === 'Grep') {
    const summaryLabel = name === 'Glob' ? '搜索文件' : '搜索内容'
    return {
      displayName: registryDisplayName ?? summaryLabel,
      summary: target ? `${summaryLabel}：${target}` : `调用工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (category === 'browser') {
    return {
      displayName: registryDisplayName ?? '浏览器工具',
      summary: target ? `操作浏览器：${target}` : `调用浏览器工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (category === 'search') {
    return {
      displayName: registryDisplayName ?? '搜索工具',
      summary: target ? `搜索：${target}` : `调用搜索工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (name === 'TodoWrite') {
    return {
      displayName: registryDisplayName ?? 'TodoWrite',
      summary: '更新待办列表',
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  if (category === 'mcp') {
    const mcpLabel = getMcpToolDisplayName(name)
    const displayName = registryDisplayName ?? mcpLabel ?? 'MCP 工具'
    return {
      displayName,
      summary: target ? `${displayName}：${target}` : `调用 ${displayName}`,
      description,
      target,
      cwd,
      provider,
      risk,
      detailKeys,
      showInMainTimeline,
    }
  }

  return {
    displayName: registryDisplayName ?? name,
    summary: registrySummary ?? `调用工具：${name}`,
    description,
    target,
    cwd,
    provider,
    risk,
    detailKeys,
    showInMainTimeline,
  }
}

function getToolShowInMainTimeline(
  metadata: CcrToolDisplayMetadata | undefined,
): boolean | undefined {
  if (!metadata) {
    return undefined
  }
  return metadata.showInMainTimeline ?? (
    metadata.category !== 'control' && metadata.category !== 'internal'
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

  if (!fields.length) {
    return undefined
  }

  return `${displayName ?? metadata.displayName}：${fields.join(' · ')}`
}

function formatSummaryField(key: string, value: unknown): string | undefined {
  const formattedValue = formatSummaryValue(value)
  if (!formattedValue) {
    return undefined
  }
  return `${getSummaryFieldLabel(key)}=${formattedValue}`
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

function getSummaryFieldLabel(key: string): string {
  switch (key) {
    case 'task_id':
      return '任务'
    case 'description':
      return '说明'
    case 'prompt':
      return '提示'
    case 'subagent_type':
      return '类型'
    case 'command':
      return '命令'
    case 'pattern':
      return '模式'
    case 'path':
      return '路径'
    case 'glob':
      return '范围'
    case 'file_path':
      return '文件'
    case 'notebook_path':
      return 'Notebook'
    case 'cell_id':
      return '单元格'
    case 'url':
      return '网址'
    case 'query':
      return '查询'
    case 'question':
      return '问题'
    case 'skill':
      return '技能'
    case 'size':
      return '尺寸'
    case 'output_format':
      return '格式'
    case 'todos':
      return '待办'
    default:
      return key
  }
}

function normalizeToolResultStatus(
  isError: boolean,
  statusText: string,
  resultText: string,
  errorClass?: ToolErrorClass,
): string {
  const normalized = statusText.toLowerCase()
  const result = resultText.toLowerCase()
  if (normalized.includes('cancel') || normalized.includes('interrupt')) {
    return normalized.includes('interrupt') ? 'interrupted' : 'cancelled'
  }
  if (normalized.includes('timeout') || result.includes('timed out')) {
    return 'timeout'
  }
  if (normalized.includes('denied')) {
    return 'denied'
  }
  if (
    result.includes('user denied') ||
    result.includes('permission denied by user') ||
    result.includes('denied by user')
  ) {
    return 'denied'
  }
  if (isError || errorClass) {
    return 'failed'
  }
  return normalized && normalized !== 'success' ? statusText : 'completed'
}

function isFailureStatus(statusText: string): boolean {
  const normalized = statusText.toLowerCase()
  return (
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'timeout' ||
    normalized === 'interrupted' ||
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'denied'
  )
}

function classifyToolError(
  resultText: string,
  category: ToolCategory,
): ToolErrorClass | undefined {
  const text = resultText.toLowerCase()
  if (!text.trim()) {
    return undefined
  }
  if (
    text.includes('no suitable shell found') ||
    text.includes('posix shell environment') ||
    text.includes('valid shell installed')
  ) {
    return 'shell_unavailable'
  }
  if (
    text.includes('command not found') ||
    text.includes('not recognized as an internal') ||
    text.includes('is not recognized') ||
    isSpawnExecutableMissing(text)
  ) {
    return 'command_not_found'
  }
  if (
    text.includes('cannot find path') ||
    text.includes('no such file or directory') ||
    text.includes('enoent') ||
    text.includes('path does not exist')
  ) {
    return 'path_not_found'
  }
  if (
    text.includes('no task found with id') ||
    text.includes('<retrieval_status>not_found</retrieval_status>')
  ) {
    return 'task_not_found'
  }
  if (
    category === 'file' &&
    (text.includes('exceeds maximum allowed size') ||
      text.includes('exceeds maximum allowed tokens')) &&
    (text.includes('offset') || text.includes('limit') || text.includes('search'))
  ) {
    return 'file_too_large'
  }
  if (
    text.includes('permission denied') ||
    text.includes('access is denied') ||
    text.includes('not permitted') ||
    text.includes('denied by user') ||
    text.includes('user denied')
  ) {
    return 'permission_denied'
  }
  if (text.includes('timed out') || text.includes('timeout')) {
    return 'timeout'
  }
  if (
    category === 'mcp' &&
    (text.includes('offline') ||
      text.includes('not available') ||
      text.includes('connection refused'))
  ) {
    return 'mcp_unavailable'
  }
  if (
    category === 'browser' &&
    (text.includes('browser') || text.includes('playwright')) &&
    (text.includes('not installed') || text.includes('failed'))
  ) {
    return 'browser_unavailable'
  }
  return 'unknown_failure'
}

function isSpawnExecutableMissing(text: string): boolean {
  return /\bspawn\s+.+\s+enoent\b/.test(text)
}

export function getActionableHint(errorClass?: ToolErrorClass): string | undefined {
  switch (errorClass) {
    case 'shell_unavailable':
      return '当前环境没有可用 POSIX shell。Windows 下不需要为了 ls 强行安装 Bash，应优先使用 PowerShell、CMD、Node 原生文件能力或高层文件工具。'
    case 'command_not_found':
      return '命令或工具依赖不存在。请确认命令/PATH 是否可用，或检查打包产物里的工具二进制是否存在。'
    case 'path_not_found':
      return '目标路径不存在。请先确认工作区、相对路径和目录是否正确。'
    case 'task_not_found':
      return '任务不存在或已清理。这通常是模型误用了 TaskOutput：只能使用后台任务返回的真实 task_id，不能自己编。'
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

function isTaskNotFoundToolResult(text: string): boolean {
  const normalized = text.toLowerCase()
  return (
    normalized.includes('no task found with id') ||
    normalized.includes('<retrieval_status>not_found</retrieval_status>')
  )
}

export function getToolStatusLabel(status: string): string {
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

function getToolTarget(name: string, input: JsonObject | null): string | undefined {
  if (!input) {
    return undefined
  }
  const target = getString(input, [
    'file_path',
    'filePath',
    'path',
    'url',
    'pattern',
    'query',
    'prompt',
  ])
  if (target) {
    return target
  }
  if (name === 'Bash' || name.toLowerCase().includes('shell')) {
    return getString(input, ['command', 'cmd'])
  }
  return undefined
}

function getMcpToolDisplayName(name: string): string | undefined {
  const identity = parseMcpToolName(name)
  if (!identity) {
    return undefined
  }
  return formatMcpToolDisplayName(identity.serverName, identity.toolName)
}

function formatMcpToolDisplayName(
  serverName: string | undefined,
  toolName: string | undefined,
): string {
  if (serverName && toolName) {
    return `MCP ${serverName} / ${toolName}`
  }
  if (serverName) {
    return `MCP ${serverName}`
  }
  return 'MCP 工具'
}

function parseMcpToolName(
  name: string,
): { serverName: string; toolName?: string } | undefined {
  const parts = name.split('__')
  if (parts[0] !== 'mcp' || parts.length < 2) {
    return undefined
  }
  const serverName = parts[1]?.trim()
  if (!serverName) {
    return undefined
  }
  const toolName = parts.slice(2).join('__').trim()
  return {
    serverName,
    ...(toolName ? { toolName } : {}),
  }
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

function stringifyControlToolInput(input: JsonObject | null | undefined): string {
  if (!input) {
    return ''
  }

  try {
    return JSON.stringify(input)
  } catch {
    return Object.values(input).map(String).join(' ')
  }
}
