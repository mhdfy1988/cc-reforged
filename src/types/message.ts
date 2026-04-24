import type { UUID } from 'crypto'

import type { PermissionMode } from './permissions.js'
import type { Attachment } from '../utils/attachments.js'

export type MessageOrigin = {
  kind?: 'task-notification' | 'coordinator' | 'channel' | 'human' | string
  server?: string
  [key: string]: unknown
}

type MessageContentBlock = {
  type: string
  [key: string]: unknown
}

type MessageEnvelope = {
  content: any
  id?: string
  model?: string
  context_management?: unknown
  role?: string
  [key: string]: unknown
}

type BaseMessage = {
  type: string
  timestamp?: string
  uuid?: string
  [key: string]: unknown
}

export type AssistantMessage<TContent = any> = BaseMessage & {
  type: 'assistant'
  message: MessageEnvelope & {
    content: TContent
  }
  isMeta?: boolean
  isVirtual?: boolean
  requestId?: string
  error?: unknown
  errorDetails?: string
  isApiErrorMessage?: boolean
  apiError?: string
  advisorModel?: string
}

export type NormalizedAssistantMessage<TContent = any> = AssistantMessage<TContent>

export type UserMessage = BaseMessage & {
  type: 'user'
  message: MessageEnvelope
  isMeta?: boolean
  isVisibleInTranscriptOnly?: boolean
  isVirtual?: boolean
  isCompactSummary?: boolean
  toolUseResult?: unknown
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
  imagePasteIds?: number[]
  sourceToolAssistantUUID?: UUID
  sourceToolUseID?: string
  permissionMode?: PermissionMode
  summarizeMetadata?: {
    messagesSummarized: number
    userContext?: string
    direction?: PartialCompactDirection
  }
  origin?: MessageOrigin
}

export type NormalizedUserMessage = UserMessage

export type SystemMessageLevel = 'info' | 'warning' | 'error' | 'debug' | string

export type SystemMessage = Omit<BaseMessage, 'message'> & {
  type: 'system'
  subtype?: string
  level?: SystemMessageLevel
  content?: string | string[]
  isMeta?: boolean
  toolUseID?: string
  preventContinuation?: boolean
}

export type SystemInformationalMessage = SystemMessage
export type SystemAPIErrorMessage = SystemMessage
export type SystemCompactBoundaryMessage = SystemMessage
export type SystemMicrocompactBoundaryMessage = SystemMessage
export type SystemStatusMessage = SystemMessage
export type SystemBridgeStatusMessage = SystemMessage
export type SystemAwaySummaryMessage = SystemMessage
export type SystemLocalCommandMessage = SystemMessage
export type SystemMemorySavedMessage = SystemMessage
export type SystemPermissionRetryMessage = SystemMessage
export type SystemScheduledTaskFireMessage = SystemMessage
export type SystemStopHookSummaryMessage = SystemMessage
export type SystemTurnDurationMessage = SystemMessage
export type SystemAgentsKilledMessage = SystemMessage
export type SystemApiMetricsMessage = SystemMessage
export type SystemThinkingMessage = SystemMessage

export type AttachmentMessage = Omit<BaseMessage, 'message'> & {
  type: 'attachment'
  attachment?: Attachment
}

export type ProgressMessage<P = unknown> = Omit<BaseMessage, 'message'> & {
  type: 'progress'
  data: P
  toolUseID: string
  parentToolUseID: string
}

export type PartialCompactDirection = 'from' | 'to' | 'around' | string

export type CollapsedReadSearchGroup = Record<string, unknown>
export type GroupedToolUseMessage = Record<string, unknown>
export type ToolUseSummaryMessage = Omit<BaseMessage, 'message'> & {
  type: 'tool_use_summary'
  summary: string
  precedingToolUseIds: string[]
}
export type TombstoneMessage = Omit<BaseMessage, 'message'> & {
  type: 'tombstone'
  message: Message
}

export type RequestStartEvent = {
  type: 'stream_request_start'
  [key: string]: unknown
}

type StreamMessageStartEvent = {
  type: 'message_start'
  [key: string]: unknown
}

type StreamMessageStopEvent = {
  type: 'message_stop'
  [key: string]: unknown
}

type StreamContentBlockStartEvent = {
  type: 'content_block_start'
  index: number
  content_block:
    | { type: 'thinking'; [key: string]: unknown }
    | { type: 'redacted_thinking'; [key: string]: unknown }
    | { type: 'text'; [key: string]: unknown }
    | {
        type: 'tool_use'
        id: string
        name: string
        input: unknown
        [key: string]: unknown
      }
    | { type: 'server_tool_use'; [key: string]: unknown }
    | { type: 'web_search_tool_result'; [key: string]: unknown }
    | { type: 'code_execution_tool_result'; [key: string]: unknown }
    | { type: 'mcp_tool_use'; [key: string]: unknown }
    | { type: 'mcp_tool_result'; [key: string]: unknown }
    | { type: 'container_upload'; [key: string]: unknown }
    | { type: 'web_fetch_tool_result'; [key: string]: unknown }
    | { type: 'bash_code_execution_tool_result'; [key: string]: unknown }
    | { type: 'text_editor_code_execution_tool_result'; [key: string]: unknown }
    | { type: 'tool_search_tool_result'; [key: string]: unknown }
    | { type: 'compaction'; [key: string]: unknown }
  [key: string]: unknown
}

type StreamContentBlockDeltaEvent = {
  type: 'content_block_delta'
  index: number
  delta:
    | { type: 'text_delta'; text: string; [key: string]: unknown }
    | {
        type: 'input_json_delta'
        partial_json: string
        [key: string]: unknown
      }
    | { type: 'thinking_delta'; thinking: string; [key: string]: unknown }
    | { type: 'signature_delta'; [key: string]: unknown }
  [key: string]: unknown
}

type StreamContentBlockStopEvent = {
  type: 'content_block_stop'
  [key: string]: unknown
}

type StreamMessageDeltaEvent = {
  type: 'message_delta'
  [key: string]: unknown
}

export type StreamEvent = {
  type: 'stream_event'
  event:
    | StreamMessageStartEvent
    | StreamMessageStopEvent
    | StreamContentBlockStartEvent
    | StreamContentBlockDeltaEvent
    | StreamContentBlockStopEvent
    | StreamMessageDeltaEvent
  ttftMs?: number
  [key: string]: unknown
}

export type Message =
  | AssistantMessage
  | UserMessage
  | SystemMessage
  | AttachmentMessage
  | ProgressMessage
  | ToolUseSummaryMessage

export type NormalizedMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | SystemMessage
  | AttachmentMessage
  | ProgressMessage
  | ToolUseSummaryMessage
  | TombstoneMessage
  | RequestStartEvent
  | StreamEvent

export type RenderableMessage = Message

export type StopHookInfo = {
  command: string
  promptText?: string
  durationMs?: number
  [key: string]: unknown
}

export type SystemMessageLike =
  | SystemMessage
  | SystemInformationalMessage
  | SystemAPIErrorMessage
  | SystemCompactBoundaryMessage
  | SystemMicrocompactBoundaryMessage
  | SystemBridgeStatusMessage
  | SystemAwaySummaryMessage
  | SystemLocalCommandMessage
  | SystemMemorySavedMessage
  | SystemPermissionRetryMessage
  | SystemScheduledTaskFireMessage
  | SystemStopHookSummaryMessage
  | SystemTurnDurationMessage
  | SystemAgentsKilledMessage
  | SystemApiMetricsMessage
  | SystemThinkingMessage
