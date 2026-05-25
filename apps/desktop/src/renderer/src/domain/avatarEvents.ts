import type { DisplayEvent } from './displayEvents.js'
import type { FileToolOperation } from './fileEvents.js'
import type { ToolCategory, ToolSnapshot } from './toolEvents.js'

export type AvatarTone =
  | 'user'
  | 'assistant'
  | 'system'
  | 'compact'
  | 'thinking'
  | 'shell'
  | 'file'
  | 'web'
  | 'search'
  | 'mcp'
  | 'agent'
  | 'media'
  | 'permission'
  | 'control'
  | 'danger'
  | 'muted'

export type MessageAvatarDescriptor = {
  icon?: AvatarIconName
  label: string
  tone: AvatarTone
  title: string
  status?: 'running' | 'failed' | 'waiting'
}

export type AvatarIconName =
  | 'archive'
  | 'bot'
  | 'brain'
  | 'circleHelp'
  | 'cog'
  | 'file'
  | 'fileEdit'
  | 'filePlus'
  | 'fileSearch'
  | 'globe'
  | 'image'
  | 'info'
  | 'listTodo'
  | 'paperclip'
  | 'plug'
  | 'search'
  | 'shield'
  | 'sliders'
  | 'terminal'
  | 'triangleAlert'

export type MessageAvatarRuntime = {
  model?: string
  provider?: string
}

export function resolveMessageAvatar(
  event: DisplayEvent,
  runtime: MessageAvatarRuntime = {},
): MessageAvatarDescriptor {
  if (event.type === 'assistant_message') {
    return withStatusTone(resolveAssistantAvatar(runtime), event)
  }

  if (event.type === 'tool_call' || event.type === 'tool_result') {
    return withStatusTone(resolveToolAvatar(event), event)
  }

  if (
    event.type === 'file_change' ||
    event.type === 'file_reference' ||
    event.type === 'attachment'
  ) {
    return withStatusTone(resolveFileEventAvatar(event), event)
  }

  if (event.type === 'system_notice') {
    return withStatusTone(resolveSystemNoticeAvatar(event), event)
  }

  if (event.type === 'user_message') {
    return withStatusTone({ label: '我', tone: 'user', title: '用户消息' }, event)
  }

  if (event.type === 'thinking_summary') {
    return withStatusTone({ icon: 'brain', label: '思', tone: 'thinking', title: '思考摘要' }, event)
  }

  if (event.type === 'permission_request') {
    return withStatusTone({ icon: 'shield', label: '权', tone: 'permission', title: '权限请求' }, event)
  }

  if (event.type === 'todo_list') {
    return withStatusTone({ icon: 'listTodo', label: '待', tone: 'control', title: '任务列表' }, event)
  }

  if (event.type === 'error') {
    return { icon: 'triangleAlert', label: '!', tone: 'danger', title: '错误', status: 'failed' }
  }

  return withStatusTone(
    {
      icon: 'circleHelp',
      label: '?',
      tone: 'muted',
      title: `未知消息类型：${event.type}`,
    },
    event,
  )
}

function resolveAssistantAvatar(
  runtime: MessageAvatarRuntime,
): MessageAvatarDescriptor {
  const model = runtime.model?.trim()
  const provider = runtime.provider?.trim()
  const source = `${provider ?? ''} ${model ?? ''}`.toLowerCase()
  const title = [
    provider ? `Provider: ${provider}` : undefined,
    model ? `Model: ${model}` : undefined,
  ]
    .filter(Boolean)
    .join(' / ') || '助手'

  if (source.includes('kimi')) {
    return { label: 'K', tone: 'assistant', title }
  }
  if (source.includes('codex')) {
    return { label: 'C', tone: 'assistant', title }
  }
  if (source.includes('gpt') || source.includes('openai')) {
    return { label: 'O', tone: 'assistant', title }
  }
  if (source.includes('claude') || source.includes('anthropic')) {
    return { label: 'A', tone: 'assistant', title }
  }
  if (source.includes('glm')) {
    return { label: 'G', tone: 'assistant', title }
  }
  if (source.includes('deepseek')) {
    return { label: 'D', tone: 'assistant', title }
  }
  return { icon: 'bot', label: 'AI', tone: 'assistant', title }
}

function resolveToolAvatar(event: DisplayEvent): MessageAvatarDescriptor {
  const snapshot = event.toolSnapshot
  if (!snapshot) {
    return { icon: 'circleHelp', label: '工', tone: 'muted', title: '工具事件' }
  }

  if (snapshot.errorMessage || isFailureStatus(snapshot.status)) {
    return {
      ...resolveToolCategoryAvatar(snapshot.category, snapshot, event),
      status: 'failed',
    }
  }

  return resolveToolCategoryAvatar(snapshot.category, snapshot, event)
}

function resolveToolCategoryAvatar(
  category: ToolCategory,
  snapshot: ToolSnapshot,
  event: DisplayEvent,
): MessageAvatarDescriptor {
  if (category === 'file') {
    return resolveFileOperationAvatar(
      event.fileToolSnapshot?.operation,
      snapshot.displayName ?? snapshot.name,
    )
  }

  switch (category) {
    case 'shell':
      return { icon: 'terminal', label: '终', tone: 'shell', title: snapshot.displayName ?? '命令工具' }
    case 'mcp':
      return { icon: 'plug', label: '插', tone: 'mcp', title: snapshot.displayName ?? 'MCP 工具' }
    case 'browser':
      return { icon: 'globe', label: '览', tone: 'web', title: snapshot.displayName ?? '浏览器工具' }
    case 'search':
      return { icon: 'search', label: '搜', tone: 'search', title: snapshot.displayName ?? '搜索工具' }
    case 'web':
      return { icon: 'globe', label: '网', tone: 'web', title: snapshot.displayName ?? '网页工具' }
    case 'agent':
      return { icon: 'bot', label: '代', tone: 'agent', title: snapshot.displayName ?? 'Agent 工具' }
    case 'media':
      return { icon: 'image', label: '图', tone: 'media', title: snapshot.displayName ?? '媒体工具' }
    case 'internal':
      return { icon: 'cog', label: '内', tone: 'muted', title: snapshot.displayName ?? '内部工具' }
    case 'control':
      return { icon: 'sliders', label: '控', tone: 'control', title: snapshot.displayName ?? '控制工具' }
    case 'unknown':
      return {
        icon: 'circleHelp',
        label: '?',
        tone: 'muted',
        title: `未知工具分类：${snapshot.name}`,
      }
    default:
      return {
        icon: 'circleHelp',
        label: '?',
        tone: 'muted',
        title: `未知工具分类：${category}`,
      }
  }
}

function resolveFileEventAvatar(event: DisplayEvent): MessageAvatarDescriptor {
  if (event.type === 'attachment') {
    const imageAttachment =
      event.attachmentSnapshot?.previewKind === 'image' ||
      event.attachmentSnapshots?.some(snapshot => snapshot.previewKind === 'image')
    return imageAttachment
      ? { icon: 'image', label: '图', tone: 'media', title: '图片附件' }
      : { icon: 'paperclip', label: '附', tone: 'file', title: '附件' }
  }

  if (event.type === 'file_reference') {
    return { icon: 'fileSearch', label: '引', tone: 'file', title: '文件引用' }
  }

  return resolveFileOperationAvatar(event.fileToolSnapshot?.operation, '文件事件')
}

function resolveFileOperationAvatar(
  operation: FileToolOperation | undefined,
  fallbackTitle: string,
): MessageAvatarDescriptor {
  switch (operation) {
    case 'read':
      return { icon: 'file', label: '读', tone: 'file', title: '读取文件' }
    case 'write':
      return { icon: 'filePlus', label: '写', tone: 'file', title: '写入文件' }
    case 'edit':
      return { icon: 'fileEdit', label: '编', tone: 'file', title: '编辑文件' }
    case 'search':
      return { icon: 'fileSearch', label: '搜', tone: 'search', title: '搜索文件' }
    case 'notebook_edit':
      return { icon: 'fileEdit', label: '本', tone: 'file', title: '编辑 Notebook' }
    case 'unknown':
      return { icon: 'file', label: '文', tone: 'file', title: '文件操作' }
    default:
      return { icon: 'file', label: '文', tone: 'file', title: fallbackTitle }
  }
}

function resolveSystemNoticeAvatar(event: DisplayEvent): MessageAvatarDescriptor {
  const text = event.text.trim().toLowerCase()
  if (
    event.compactSnapshot ||
    event.sourceKind === 'context_compaction' ||
    text.includes('compact') ||
    text.includes('压缩')
  ) {
    return { icon: 'archive', label: '归', tone: 'compact', title: '上下文压缩' }
  }
  if (text.includes('恢复历史会话') || text.includes('history')) {
    return { icon: 'archive', label: '历', tone: 'compact', title: '历史恢复' }
  }
  return { icon: 'info', label: 'i', tone: 'system', title: '系统提示' }
}

function withStatusTone(
  descriptor: MessageAvatarDescriptor,
  event: DisplayEvent,
): MessageAvatarDescriptor {
  if (event.status && isFailureStatus(event.status)) {
    return { ...descriptor, tone: 'danger', status: 'failed' }
  }
  if (isWaitingStatus(event.status)) {
    return { ...descriptor, status: 'waiting' }
  }
  if (isRunningStatus(event.status)) {
    return { ...descriptor, status: 'running' }
  }
  return descriptor
}

function isRunningStatus(status: string | undefined): boolean {
  return (
    status === 'running' ||
    status === 'streaming' ||
    status === 'pending' ||
    status === 'preparing'
  )
}

function isWaitingStatus(status: string | undefined): boolean {
  return status === 'waiting_permission'
}

function isFailureStatus(status: string | undefined): boolean {
  return (
    status === 'failed' ||
    status === 'denied' ||
    status === 'interrupted' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'timeout'
  )
}
