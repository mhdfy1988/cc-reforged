export type CcrToolDisplayCategory =
  | 'file'
  | 'runtime'
  | 'web'
  | 'agent'
  | 'media'
  | 'mcp'
  | 'control'
  | 'internal'

export type CcrToolSourceKind =
  | 'builtin'
  | 'mcp'
  | 'provider'
  | 'skill'
  | 'plugin'
  | 'dynamic'

export type CcrToolDisplayMetadata = {
  displayName: string
  category: CcrToolDisplayCategory
  sourceKind?: CcrToolSourceKind
  showInMainTimeline?: boolean
  summaryKeys?: string[]
  detailKeys?: string[]
}

export const CORE_TOOL_DISPLAY_CATALOG: Record<string, CcrToolDisplayMetadata> = {
  Agent: {
    displayName: '子代理任务',
    category: 'agent',
    summaryKeys: ['description', 'prompt', 'subagent_type'],
    detailKeys: ['description', 'subagent_type', 'prompt'],
  },
  TaskOutput: {
    displayName: '后台任务输出',
    category: 'agent',
    summaryKeys: ['task_id'],
    detailKeys: ['task_id', 'block', 'timeout'],
  },
  Bash: {
    displayName: 'Bash 命令',
    category: 'runtime',
    summaryKeys: ['command'],
    detailKeys: ['command', 'description', 'timeout'],
  },
  PowerShell: {
    displayName: 'PowerShell 命令',
    category: 'runtime',
    summaryKeys: ['command'],
    detailKeys: ['command', 'description', 'timeout'],
  },
  Glob: {
    displayName: '文件匹配',
    category: 'file',
    summaryKeys: ['pattern', 'path'],
    detailKeys: ['pattern', 'path'],
  },
  Grep: {
    displayName: '内容搜索',
    category: 'file',
    summaryKeys: ['pattern', 'path', 'glob'],
    detailKeys: ['pattern', 'path', 'glob', 'output_mode', 'head_limit'],
  },
  Read: {
    displayName: '读取文件',
    category: 'file',
    summaryKeys: ['file_path', 'offset', 'limit'],
    detailKeys: ['file_path', 'offset', 'limit'],
  },
  Edit: {
    displayName: '编辑文件',
    category: 'file',
    summaryKeys: ['file_path'],
    detailKeys: ['file_path', 'replace_all'],
  },
  Write: {
    displayName: '写入文件',
    category: 'file',
    summaryKeys: ['file_path'],
    detailKeys: ['file_path'],
  },
  NotebookEdit: {
    displayName: '编辑 Notebook',
    category: 'file',
    summaryKeys: ['notebook_path', 'cell_id'],
    detailKeys: ['notebook_path', 'cell_id', 'edit_mode'],
  },
  TodoWrite: {
    displayName: '更新待办',
    category: 'control',
    showInMainTimeline: false,
    summaryKeys: ['todos'],
    detailKeys: ['todos'],
  },
  GenerateImage: {
    displayName: '生成图片',
    category: 'media',
    sourceKind: 'provider',
    summaryKeys: ['prompt', 'size', 'output_format'],
    detailKeys: ['prompt', 'size', 'output_format', 'provider', 'model'],
  },
  WebFetch: {
    displayName: '读取网页',
    category: 'web',
    summaryKeys: ['url', 'prompt'],
    detailKeys: ['url', 'prompt'],
  },
  WebSearch: {
    displayName: '网页搜索',
    category: 'web',
    summaryKeys: ['query'],
    detailKeys: ['query', 'allowed_domains', 'blocked_domains'],
  },
  ToolSearch: {
    displayName: '工具搜索',
    category: 'internal',
    showInMainTimeline: false,
    summaryKeys: ['query'],
    detailKeys: ['query', 'limit'],
  },
  ExitPlanMode: {
    displayName: '退出计划模式',
    category: 'control',
    summaryKeys: ['plan'],
    detailKeys: ['plan'],
  },
  EnterPlanMode: {
    displayName: '进入计划模式',
    category: 'control',
    showInMainTimeline: false,
  },
  AskUserQuestion: {
    displayName: '询问用户',
    category: 'control',
    summaryKeys: ['question'],
    detailKeys: ['question', 'questions'],
  },
  Skill: {
    displayName: '技能',
    category: 'agent',
    summaryKeys: ['skill'],
    detailKeys: ['skill'],
  },
  Config: {
    displayName: '配置',
    category: 'control',
    showInMainTimeline: false,
  },
  LSP: {
    displayName: '语言服务',
    category: 'runtime',
  },
  REPL: {
    displayName: 'REPL',
    category: 'runtime',
  },
  ListMcpResourcesTool: {
    displayName: '列出 MCP 资源',
    category: 'internal',
    showInMainTimeline: false,
  },
  ReadMcpResourceTool: {
    displayName: '读取 MCP 资源',
    category: 'internal',
    showInMainTimeline: false,
  },
  SendUserMessage: {
    displayName: '发送用户消息',
    category: 'agent',
    showInMainTimeline: false,
  },
  TestingPermission: {
    displayName: '权限测试',
    category: 'internal',
    showInMainTimeline: false,
  },
}

const CASE_INSENSITIVE_INDEX = new Map(
  Object.keys(CORE_TOOL_DISPLAY_CATALOG).map(name => [name.toLowerCase(), name]),
)

export function getCcrToolDisplayMetadata(
  name: string | null | undefined,
): CcrToolDisplayMetadata | undefined {
  const normalizedName = name?.trim()
  if (!normalizedName) {
    return undefined
  }
  const direct = CORE_TOOL_DISPLAY_CATALOG[normalizedName]
  if (direct) {
    return direct
  }
  const canonicalName = CASE_INSENSITIVE_INDEX.get(normalizedName.toLowerCase())
  if (canonicalName) {
    return CORE_TOOL_DISPLAY_CATALOG[canonicalName]
  }
  return getDynamicMcpToolDisplayMetadata(normalizedName)
}

function getDynamicMcpToolDisplayMetadata(
  name: string,
): CcrToolDisplayMetadata | undefined {
  const identity = parseMcpToolName(name)
  if (!identity) {
    return undefined
  }
  return {
    displayName: identity.toolName
      ? `MCP ${identity.serverName} / ${identity.toolName}`
      : `MCP ${identity.serverName}`,
    category: 'mcp',
    sourceKind: 'mcp',
  }
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
