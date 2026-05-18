import { isOpenAiChatToolResultProfile } from './toolProtocolProfile.js'
import type {
  LlmMessage,
  LlmProviderToolProfile,
  LlmToolCallPart,
  LlmToolResultPart,
} from './types.js'

export type LlmHistoryValidationStatus = 'ok' | 'repaired' | 'blocked'

export type LlmHistoryValidationDiagnosticType =
  | 'missing_tool_result_repaired'
  | 'stray_tool_result_dropped'
  | 'unsupported_tool_call_blocked'

export interface LlmHistoryValidationDiagnostic {
  type: LlmHistoryValidationDiagnosticType
  messageIndex: number
  toolCallId?: string
  toolName?: string
  detail: string
}

export interface LlmHistoryValidationResult {
  status: LlmHistoryValidationStatus
  messages: readonly LlmMessage[]
  diagnostics: readonly LlmHistoryValidationDiagnostic[]
}

export function validateLlmHistoryForProvider(input: {
  messages: readonly LlmMessage[]
  toolProfile: LlmProviderToolProfile
}): LlmHistoryValidationResult {
  if (!input.toolProfile.toolCalling.supported) {
    return validateNoUnsupportedToolCalls(input.messages)
  }

  if (isOpenAiChatToolResultProfile(input.toolProfile)) {
    return validateOpenAiChatToolHistory(input.messages)
  }

  return {
    status: 'ok',
    messages: input.messages,
    diagnostics: [],
  }
}

function validateNoUnsupportedToolCalls(
  messages: readonly LlmMessage[],
): LlmHistoryValidationResult {
  const diagnostics: LlmHistoryValidationDiagnostic[] = []
  for (let index = 0; index < messages.length; index += 1) {
    for (const part of messages[index].parts) {
      if (part.type !== 'tool_call') {
        continue
      }
      diagnostics.push({
        type: 'unsupported_tool_call_blocked',
        messageIndex: index,
        toolCallId: part.id,
        toolName: part.name,
        detail:
          '当前 provider profile 不支持工具调用，不能发送包含 tool_call 的历史。',
      })
    }
  }

  return diagnostics.length > 0
    ? {
        status: 'blocked',
        messages,
        diagnostics,
      }
    : {
        status: 'ok',
        messages,
        diagnostics: [],
      }
}

function validateOpenAiChatToolHistory(
  messages: readonly LlmMessage[],
): LlmHistoryValidationResult {
  const repaired: LlmMessage[] = []
  const diagnostics: LlmHistoryValidationDiagnostic[] = []

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    const toolCalls = getToolCallParts(message)

    if (message.role !== 'assistant' || toolCalls.length === 0) {
      if (message.role === 'tool') {
        diagnostics.push({
          type: 'stray_tool_result_dropped',
          messageIndex: index,
          detail:
            'OpenAI Chat 历史中出现了没有紧跟 assistant tool_call 的 tool_result，已在发送前丢弃。',
        })
        continue
      }
      repaired.push(message)
      continue
    }

    repaired.push(message)

    const matchedToolMessages = new Map<string, LlmMessage>()
    let cursor = index + 1
    while (cursor < messages.length && messages[cursor].role === 'tool') {
      for (const part of getToolResultParts(messages[cursor])) {
        if (part.toolCallId && !matchedToolMessages.has(part.toolCallId)) {
          matchedToolMessages.set(part.toolCallId, messages[cursor])
        }
      }
      cursor += 1
    }

    for (const toolCall of toolCalls) {
      const matched = matchedToolMessages.get(toolCall.id)
      if (matched) {
        repaired.push(matched)
        continue
      }

      repaired.push(createSyntheticToolResultMessage(toolCall))
      diagnostics.push({
        type: 'missing_tool_result_repaired',
        messageIndex: index,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        detail:
          'assistant tool_call 缺少对应 tool_result，已补齐 synthetic tool_result 以恢复历史连续性。',
      })
    }

    index = cursor - 1
  }

  return {
    status: diagnostics.length > 0 ? 'repaired' : 'ok',
    messages: repaired,
    diagnostics,
  }
}

function getToolCallParts(message: LlmMessage): LlmToolCallPart[] {
  return message.parts.filter(
    (part): part is LlmToolCallPart => part.type === 'tool_call',
  )
}

function getToolResultParts(message: LlmMessage): LlmToolResultPart[] {
  return message.parts.filter(
    (part): part is LlmToolResultPart => part.type === 'tool_result',
  )
}

function createSyntheticToolResultMessage(
  toolCall: LlmToolCallPart,
): LlmMessage {
  return {
    role: 'tool',
    parts: [
      {
        type: 'tool_result',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        status: 'interrupted',
        isError: true,
        result: {
          status: 'error',
          code: 'TOOL_CALL_INTERRUPTED',
          message:
            '工具调用被中断，或历史记录中缺少对应的工具结果。CCR 已补齐占位结果以恢复会话连续性。',
          toolName: toolCall.name,
        },
      },
    ],
  }
}
