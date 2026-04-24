import type { BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages/messages.mjs'
import type { Tools } from '../Tool.js'
import type {
  NormalizedMessage,
  ProgressMessage,
} from '../types/message.js'

export type MessageWithoutProgress = Exclude<NormalizedMessage, ProgressMessage>

type LocalRenderableInputMessage =
  | Extract<MessageWithoutProgress, { type: 'assistant' }>
  | Extract<MessageWithoutProgress, { type: 'user' }>
  | Extract<MessageWithoutProgress, { type: 'system' }>
  | Extract<MessageWithoutProgress, { type: 'attachment' }>
  | Extract<MessageWithoutProgress, { type: 'tool_use_summary' }>
type LocalAssistantMessage = Extract<LocalRenderableInputMessage, { type: 'assistant' }>
type LocalUserMessage = Extract<LocalRenderableInputMessage, { type: 'user' }>
type LocalToolUseMessage = LocalAssistantMessage & {
  message: {
    id: string
    content: [BetaToolUseBlock, ...unknown[]]
  }
}

type LocalGroupedToolUseMessage = {
  type: 'grouped_tool_use'
  toolName: string
  messages: LocalToolUseMessage[]
  results: LocalUserMessage[]
  displayMessage: LocalToolUseMessage
  uuid?: string
  timestamp?: string
  messageId: string
}

type GroupingOutputMessage = LocalRenderableInputMessage | LocalGroupedToolUseMessage

export type GroupingResult = {
  messages: GroupingOutputMessage[]
}

// Cache the set of tool names that support grouped rendering, keyed by the
// tools array reference. The tools array is stable across renders (only
// replaced on MCP connect/disconnect), so this avoids rebuilding the set on
// every call. WeakMap lets old entries be GC'd when the array is replaced.
const GROUPING_CACHE = new WeakMap<Tools, Set<string>>()

function getToolsWithGrouping(tools: Tools): Set<string> {
  let cached = GROUPING_CACHE.get(tools)
  if (!cached) {
    cached = new Set(tools.filter(t => t.renderGroupedToolUse).map(t => t.name))
    GROUPING_CACHE.set(tools, cached)
  }
  return cached
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRenderableInputMessage(
  msg: MessageWithoutProgress,
): msg is LocalRenderableInputMessage {
  return (
    msg.type === 'assistant' ||
    msg.type === 'user' ||
    msg.type === 'system' ||
    msg.type === 'attachment' ||
    msg.type === 'tool_use_summary'
  )
}

function isToolUseBlock(value: unknown): value is BetaToolUseBlock {
  return (
    isObjectRecord(value) &&
    value.type === 'tool_use' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    'input' in value
  )
}

function isToolResultBlock(value: unknown): value is ToolResultBlockParam {
  return (
    isObjectRecord(value) &&
    value.type === 'tool_result' &&
    typeof value.tool_use_id === 'string'
  )
}

function isToolUseMessage(msg: LocalRenderableInputMessage): msg is LocalToolUseMessage {
  return (
    msg.type === 'assistant' &&
    isObjectRecord(msg.message) &&
    typeof msg.message.id === 'string' &&
    Array.isArray(msg.message.content) &&
    msg.message.content.length > 0 &&
    isToolUseBlock(msg.message.content[0])
  )
}

function getToolUseInfo(
  msg: LocalToolUseMessage,
): { messageId: string; toolUseId: string; toolName: string } {
  const content = msg.message.content[0]
  return {
    messageId: msg.message.id,
    toolUseId: content.id,
    toolName: content.name,
  }
}

/**
 * Groups tool uses by message.id (same API response) if the tool supports grouped rendering.
 * Only groups 2+ tools of the same type from the same message.
 * Also collects corresponding tool_results and attaches them to the grouped message.
 * When verbose is true, skips grouping so messages render at original positions.
 */
export function applyGrouping(
  messages: MessageWithoutProgress[],
  tools: Tools,
  verbose: boolean = false,
): GroupingResult {
  const renderableMessages = messages.filter(isRenderableInputMessage)

  // In verbose mode, don't group - each message renders at its original position
  if (verbose) {
    return {
      messages: renderableMessages,
    }
  }
  const toolsWithGrouping = getToolsWithGrouping(tools)

  // First pass: group tool uses by message.id + tool name
  const groups = new Map<string, LocalToolUseMessage[]>()

  for (const msg of renderableMessages) {
    if (isToolUseMessage(msg)) {
      const info = getToolUseInfo(msg)
      if (!toolsWithGrouping.has(info.toolName)) {
        continue
      }
      const key = `${info.messageId}:${info.toolName}`
      const group = groups.get(key) ?? []
      group.push(msg)
      groups.set(key, group)
    }
  }

  // Identify valid groups (2+ items) and collect their tool use IDs
  const validGroups = new Map<string, LocalToolUseMessage[]>()
  const groupedToolUseIds = new Set<string>()

  for (const [key, group] of groups) {
    if (group.length >= 2) {
      validGroups.set(key, group)
      for (const msg of group) {
        const info = getToolUseInfo(msg)
        if (info) {
          groupedToolUseIds.add(info.toolUseId)
        }
      }
    }
  }

  // Collect result messages for grouped tool_uses
  // Map from tool_use_id to the user message containing that result
  const resultsByToolUseId = new Map<string, LocalUserMessage>()

  for (const msg of renderableMessages) {
    if (msg.type === 'user') {
      for (const content of msg.message.content) {
        if (isToolResultBlock(content) && groupedToolUseIds.has(content.tool_use_id)) {
          resultsByToolUseId.set(content.tool_use_id, msg)
        }
      }
    }
  }

  // Second pass: build output, emitting each group only once
  const result: GroupingOutputMessage[] = []
  const emittedGroups = new Set<string>()

  for (const msg of renderableMessages) {
    if (isToolUseMessage(msg)) {
      const info = getToolUseInfo(msg)
      const key = `${info.messageId}:${info.toolName}`
      const group = validGroups.get(key)

      if (group) {
        if (!emittedGroups.has(key)) {
          emittedGroups.add(key)
          const firstMsg = group[0]!

          // Collect results for this group
          const results: LocalUserMessage[] = []
          for (const assistantMsg of group) {
            const toolUseId = assistantMsg.message.content[0].id
            const resultMsg = resultsByToolUseId.get(toolUseId)
            if (resultMsg) {
              results.push(resultMsg)
            }
          }

          const groupedMessage: LocalGroupedToolUseMessage = {
            type: 'grouped_tool_use',
            toolName: info.toolName,
            messages: group,
            results,
            displayMessage: firstMsg,
            uuid: `grouped-${firstMsg.uuid}`,
            timestamp: firstMsg.timestamp,
            messageId: info.messageId,
          }
          result.push(groupedMessage)
        }
        continue
      }
    }

    // Skip user messages whose tool_results are all grouped
    if (msg.type === 'user') {
      const toolResults = msg.message.content.filter(
        isToolResultBlock,
      )
      if (toolResults.length > 0) {
        const allGrouped = toolResults.every(tr =>
          groupedToolUseIds.has(tr.tool_use_id),
        )
        if (allGrouped) {
          continue
        }
      }
    }

    result.push(msg)
  }

  return { messages: result }
}
