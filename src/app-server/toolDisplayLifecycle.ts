export type ToolDisplayLifecycleSource = {
  threadId?: string
  sessionId?: string
  turnId?: string
  messageUuid?: string
  parentUuid?: string | null
  rawIndex?: number
  materializedIndex?: number
  contentIndex?: number
  createdAt?: string
}

export type ToolDisplayLifecycleEvent =
  | {
      kind: 'tool_use'
      block: Record<string, unknown>
      source: ToolDisplayLifecycleSource
    }
  | {
      kind: 'tool_progress'
      block: Record<string, unknown>
      source: ToolDisplayLifecycleSource
    }
  | {
      kind: 'tool_result'
      block: Record<string, unknown>
      source: ToolDisplayLifecycleSource
    }

export type ToolDisplayLifecycleItem = {
  itemId: string
  toolUseId?: string
  status: 'running' | 'completed' | 'failed' | 'interrupted' | 'diagnostic'
  firstSeen: ToolDisplayLifecycleSource
  lastSeen: ToolDisplayLifecycleSource
  callBlock?: Record<string, unknown>
  progressBlock?: Record<string, unknown>
  resultBlock?: Record<string, unknown>
  diagnostic?: {
    code: string
    message: string
  }
}

type ToolDisplayLifecycleItemInternal = ToolDisplayLifecycleItem & {
  order: number
}

const TOOL_USE_ID_KEYS = ['id', 'toolUseId', 'toolUseID', 'tool_use_id']

const TOOL_RESULT_SOURCE_ID_KEYS = [
  'tool_use_id',
  'toolUseId',
  'toolUseID',
  'toolCallId',
  'tool_call_id',
]

export function createToolDisplayLifecycleReducer(): ToolDisplayLifecycleReducer {
  return new ToolDisplayLifecycleReducer()
}

export class ToolDisplayLifecycleReducer {
  private readonly itemsByToolUseId = new Map<
    string,
    ToolDisplayLifecycleItemInternal
  >()
  private readonly diagnostics: ToolDisplayLifecycleItemInternal[] = []
  private nextOrder = 0

  accept(event: ToolDisplayLifecycleEvent): ToolDisplayLifecycleItem {
    if (event.kind === 'tool_use') {
      return this.acceptToolUse(event.block, event.source)
    }
    if (event.kind === 'tool_progress') {
      return this.acceptToolProgress(event.block, event.source)
    }
    return this.acceptToolResult(event.block, event.source)
  }

  acceptToolUse(
    block: Record<string, unknown>,
    source: ToolDisplayLifecycleSource,
  ): ToolDisplayLifecycleItem {
    const toolUseId = normalizeToolUseIdFromBlock(block)
    if (!toolUseId) {
      return this.createDiagnosticItem({
        source,
        block,
        code: 'missing_tool_use_id',
        message: '工具调用缺少 tool_use.id，无法生成稳定工具展示项。',
      })
    }

    const existing = this.itemsByToolUseId.get(toolUseId)
    if (existing) {
      existing.callBlock = block
      existing.lastSeen = source
      if (existing.status === 'diagnostic') {
        existing.status = 'running'
      }
      return toPublicItem(existing)
    }

    const item: ToolDisplayLifecycleItemInternal = {
      order: this.nextOrder++,
      itemId: `tool:${toolUseId}`,
      toolUseId,
      status: 'running',
      firstSeen: source,
      lastSeen: source,
      callBlock: block,
    }
    this.itemsByToolUseId.set(toolUseId, item)
    return toPublicItem(item)
  }

  acceptToolProgress(
    block: Record<string, unknown>,
    source: ToolDisplayLifecycleSource,
  ): ToolDisplayLifecycleItem {
    const toolUseId = normalizeToolResultSourceIdFromBlock(block)
    if (!toolUseId) {
      return this.createDiagnosticItem({
        source,
        block,
        code: 'missing_tool_progress_source_id',
        message: '工具进度缺少 tool_use_id，无法绑定回工具调用。',
      })
    }

    const existing = this.itemsByToolUseId.get(toolUseId)
    if (!existing) {
      return this.createDiagnosticItem({
        source,
        block,
        code: 'orphan_tool_progress',
        message: '工具进度引用的工具调用不存在，已作为孤立工具进度诊断。',
      })
    }

    existing.progressBlock = block
    existing.lastSeen = source
    if (existing.status !== 'completed' && existing.status !== 'failed') {
      existing.status = 'running'
    }
    return toPublicItem(existing)
  }

  acceptToolResult(
    block: Record<string, unknown>,
    source: ToolDisplayLifecycleSource,
  ): ToolDisplayLifecycleItem {
    const toolUseId = normalizeToolResultSourceIdFromBlock(block)
    if (!toolUseId) {
      return this.createDiagnosticItem({
        source,
        block,
        code: 'missing_tool_result_source_id',
        message: '工具结果缺少 tool_use_id，无法绑定回工具调用。',
      })
    }

    const existing = this.itemsByToolUseId.get(toolUseId)
    if (!existing) {
      return this.createDiagnosticItem({
        source,
        block,
        code: 'orphan_tool_result',
        message: '工具结果引用的工具调用不存在，已作为孤立工具结果诊断。',
      })
    }

    existing.resultBlock = block
    existing.lastSeen = source
    existing.status = getToolResultStatus(block)
    return toPublicItem(existing)
  }

  getItems(): ToolDisplayLifecycleItem[] {
    return [...this.itemsByToolUseId.values(), ...this.diagnostics]
      .sort((left, right) => left.order - right.order)
      .map(toPublicItem)
  }

  hasToolUseId(toolUseId: string): boolean {
    return this.itemsByToolUseId.has(toolUseId)
  }

  private createDiagnosticItem(input: {
    source: ToolDisplayLifecycleSource
    block: Record<string, unknown>
    code: string
    message: string
  }): ToolDisplayLifecycleItem {
    const item: ToolDisplayLifecycleItemInternal = {
      order: this.nextOrder++,
      itemId: createDiagnosticItemId(input.code, input.source),
      status: 'diagnostic',
      firstSeen: input.source,
      lastSeen: input.source,
      resultBlock: input.block,
      diagnostic: {
        code: input.code,
        message: input.message,
      },
    }
    this.diagnostics.push(item)
    return toPublicItem(item)
  }
}

export function normalizeToolUseIdFromBlock(
  block: Record<string, unknown>,
): string | undefined {
  return getStringField(block, TOOL_USE_ID_KEYS)
}

export function normalizeToolResultSourceIdFromBlock(
  block: Record<string, unknown>,
): string | undefined {
  return getStringField(block, TOOL_RESULT_SOURCE_ID_KEYS)
}

function getToolResultStatus(
  block: Record<string, unknown>,
): ToolDisplayLifecycleItem['status'] {
  if (
    block.is_error === true ||
    block.isError === true ||
    block.error === true ||
    block.status === 'failed'
  ) {
    return 'failed'
  }
  if (block.status === 'interrupted' || block.status === 'cancelled') {
    return 'interrupted'
  }
  return 'completed'
}

function getStringField(
  block: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = block[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function createDiagnosticItemId(
  code: string,
  source: ToolDisplayLifecycleSource,
): string {
  const messagePart = source.messageUuid ?? 'unknown-message'
  const contentPart =
    source.contentIndex === undefined ? 'unknown-content' : source.contentIndex
  return `${code}:${messagePart}:${contentPart}`
}

function toPublicItem(
  item: ToolDisplayLifecycleItemInternal,
): ToolDisplayLifecycleItem {
  const { order: _order, ...publicItem } = item
  void _order
  return { ...publicItem }
}
