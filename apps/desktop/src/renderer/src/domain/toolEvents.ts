import type { JsonObject } from './displayTypes.js'
import {
  createDisplayEventIdentity,
  withContentBlock,
  type DisplayEventContractContext,
  type DisplayEventIdentity,
} from './eventContract.js'

export type ToolSnapshotKind = 'call' | 'result' | 'progress'
export type ToolCategory =
  | 'shell'
  | 'file'
  | 'mcp'
  | 'browser'
  | 'search'
  | 'control'
  | 'unknown'

export type ToolErrorClass =
  | 'permission_denied'
  | 'command_not_found'
  | 'shell_unavailable'
  | 'path_not_found'
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
    const identity = createDisplayEventIdentity(
      withContentBlock(context ?? { itemId: id }, block, contentIndex),
    )

    if (type === 'tool_use') {
      const name = getToolName(block)
      if (name === 'TodoWrite') {
        return null
      }
      const input = getJsonObject(block.input)
      const category = classifyToolCategory(name, input)
      const metadata = extractToolCallMetadata(name, category, input)

      return {
        id,
        kind: 'call',
        name,
        displayName: metadata.displayName,
        category,
        status: 'running',
        statusLabel: '执行中',
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
        raw: block,
      }
    }

    if (type === 'tool_result') {
      const resultText = stringifyToolResult(block.content)
      const category = classifyToolCategory(getToolName(block))
      const isError = Boolean(block.isError) || isFailureStatus(statusText)
      const errorClass = isError
        ? classifyToolError(resultText, category)
        : undefined
      const status = normalizeToolResultStatus(
        isError,
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
        summary: status === 'completed' ? '工具执行成功' : '工具执行失败',
        identity,
        result: block.content,
        errorClass,
        errorMessage: errorClass ? resultText : undefined,
        actionableHint: getActionableHint(errorClass),
        raw: block,
      }
    }

    if (type === 'progress') {
      const metadata = extractProgressMetadata(block.data)
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
        raw: block,
      }
    }
  }

  return null
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
  return name === 'AskUserQuestion' || name === 'TodoWrite'
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
  return ['todowrite', 'askuserquestion'].some(toolName =>
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

  if (category === 'shell') {
    return {
      displayName: name,
      summary: command ? `运行命令：${command}` : `调用命令工具：${name}`,
      description,
      target,
      command,
      cwd,
      shell: shell ?? inferShellName(name),
      provider,
      risk,
    }
  }

  if (name === 'Read') {
    return {
      displayName: '读取文件',
      summary: target ? `读取文件：${target}` : '读取文件',
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  if (name === 'Write') {
    return {
      displayName: '写入文件',
      summary: target ? `写入文件：${target}` : '写入文件',
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  if (name === 'Edit' || name === 'MultiEdit' || name === 'NotebookEdit') {
    return {
      displayName: '编辑文件',
      summary: target ? `编辑文件：${target}` : `调用工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  if (name === 'LS') {
    return {
      displayName: '列出目录',
      summary: target ? `列出目录：${target}` : '列出目录',
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  if (name === 'Glob' || name === 'Grep') {
    return {
      displayName: name === 'Glob' ? '搜索文件' : '搜索内容',
      summary: target ? `${name === 'Glob' ? '搜索文件' : '搜索内容'}：${target}` : `调用工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  if (category === 'browser') {
    return {
      displayName: '浏览器工具',
      summary: target ? `操作浏览器：${target}` : `调用浏览器工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  if (category === 'search') {
    return {
      displayName: '搜索工具',
      summary: target ? `搜索：${target}` : `调用搜索工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  if (category === 'mcp') {
    return {
      displayName: 'MCP 工具',
      summary: `调用 MCP 工具：${name}`,
      description,
      target,
      cwd,
      provider,
      risk,
    }
  }

  return {
    displayName: name,
    summary: `调用工具：${name}`,
    description,
    target,
    cwd,
    provider,
    risk,
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
    return 'cancelled'
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
    text.includes('is not recognized')
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

export function getActionableHint(errorClass?: ToolErrorClass): string | undefined {
  switch (errorClass) {
    case 'shell_unavailable':
      return '当前环境没有可用 POSIX shell。Windows 下应优先使用 PowerShell、CMD、Node 原生文件能力或高层文件工具。'
    case 'command_not_found':
      return '命令不存在或不在 PATH 中。请切换为当前平台可用命令，或改用更高层工具。'
    case 'path_not_found':
      return '目标路径不存在。请先确认工作区、相对路径和目录是否正确。'
    case 'permission_denied':
      return '权限被拒绝。请确认用户授权、文件系统权限或安全规则。'
    case 'mcp_unavailable':
      return 'MCP 服务不可用。请检查 MCP 配置、进程状态和连接方式。'
    case 'browser_unavailable':
      return '浏览器工具不可用。请检查 Playwright/浏览器运行时是否安装并可启动。'
    case 'timeout':
      return '工具执行超时。可以缩小任务范围、增加超时时间或分步执行。'
    case 'unknown_failure':
      return '工具执行失败。请展开详情查看原始错误。'
    default:
      return undefined
  }
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
  ])
  if (target) {
    return target
  }
  if (name === 'Bash' || name.toLowerCase().includes('shell')) {
    return getString(input, ['command', 'cmd'])
  }
  return undefined
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
  input: JsonObject | null,
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
