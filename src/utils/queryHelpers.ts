import type { ToolUseBlock } from '@anthropic-ai/sdk/resources/index.mjs'
import last from 'lodash-es/last.js'
import {
  getSessionId,
  isSessionPersistenceDisabled,
} from 'src/bootstrap/state.js'
import type {
  SDKAssistantMessageError,
  SDKMessage,
} from 'src/entrypoints/agentSdkTypes.js'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import { runTools } from '../services/tools/toolOrchestration.js'
import { findToolByName, type Tool, type Tools } from '../Tool.js'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import type { Input as FileReadInput } from '../tools/FileReadTool/FileReadTool.js'
import {
  FILE_READ_TOOL_NAME,
  FILE_UNCHANGED_STUB,
} from '../tools/FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../tools/FileWriteTool/prompt.js'
import type { Message } from '../types/message.js'
import type { OrphanedPermission } from '../types/textInputTypes.js'
import { logForDebugging } from './debug.js'
import { isEnvTruthy } from './envUtils.js'
import { isFsInaccessible } from './errors.js'
import { getFileModificationTime, stripLineNumberPrefix } from './file.js'
import { readFileSyncWithMetadata } from './fileRead.js'
import {
  createFileStateCacheWithSizeLimit,
  type FileStateCache,
} from './fileStateCache.js'
import { isNotEmptyMessage, normalizeMessages } from './messages.js'
import { expandPath } from './path.js'
import type {
  inputSchema as permissionToolInputSchema,
  outputSchema as permissionToolOutputSchema,
} from './permissions/PermissionPromptToolResultSchema.js'
import type { ProcessUserInputContext } from './processUserInput/processUserInput.js'
import { recordTranscript } from './sessionStorage.js'

export type PermissionPromptTool = Tool<
  ReturnType<typeof permissionToolInputSchema>,
  ReturnType<typeof permissionToolOutputSchema>
>

// Small cache size for ask operations which typically access few files
// during permission prompts or limited tool operations
const ASK_READ_FILE_STATE_CACHE_SIZE = 10

type AssistantMessageView = Extract<Message, { type: 'assistant' }>
type UserMessageView = Extract<Message, { type: 'user' }>
type ConversationMessageView = AssistantMessageView | UserMessageView
type ProgressMessageView = Extract<Message, { type: 'progress' }>
type SDKAssistantMessageView = Extract<SDKMessage, { type: 'assistant' }>
type SDKUserMessageView = Extract<SDKMessage, { type: 'user' }>
type SDKToolProgressMessageView = Extract<SDKMessage, { type: 'tool_progress' }>

type AgentOrSkillProgressDataView = {
  type: 'agent_progress' | 'skill_progress'
  message: ConversationMessageView
}

type ShellProgressDataView = {
  type: 'bash_progress' | 'powershell_progress'
  elapsedTimeSeconds: number
  taskId?: string
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isContentBlockWithType(
  value: unknown,
): value is {
  type: string
} {
  return isObjectRecord(value) && typeof value.type === 'string'
}

function isAssistantMessageView(value: unknown): value is AssistantMessageView {
  return (
    isObjectRecord(value) &&
    value.type === 'assistant' &&
    isObjectRecord(value.message)
  )
}

function isUserMessageView(value: unknown): value is UserMessageView {
  return (
    isObjectRecord(value) &&
    value.type === 'user' &&
    isObjectRecord(value.message)
  )
}

function isConversationMessageView(
  value: unknown,
): value is ConversationMessageView {
  return isAssistantMessageView(value) || isUserMessageView(value)
}

function isAgentOrSkillProgressData(
  value: unknown,
): value is AgentOrSkillProgressDataView {
  if (!isObjectRecord(value)) {
    return false
  }

  if (value.type !== 'agent_progress' && value.type !== 'skill_progress') {
    return false
  }

  return isConversationMessageView(value.message)
}

function isShellProgressData(value: unknown): value is ShellProgressDataView {
  if (!isObjectRecord(value)) {
    return false
  }

  if (value.type !== 'bash_progress' && value.type !== 'powershell_progress') {
    return false
  }

  if (typeof value.elapsedTimeSeconds !== 'number') {
    return false
  }

  if (
    'taskId' in value &&
    value.taskId !== undefined &&
    typeof value.taskId !== 'string'
  ) {
    return false
  }

  return true
}

function toSDKAssistantError(
  error: unknown,
): SDKAssistantMessageError | undefined {
  switch (error) {
    case 'authentication_failed':
    case 'billing_error':
    case 'rate_limit':
    case 'invalid_request':
    case 'server_error':
    case 'unknown':
    case 'max_output_tokens':
      return error
    default:
      return undefined
  }
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getToolUseResultPayload(message: UserMessageView): unknown {
  return message.toolUseResult
}

function toSDKAssistantMessage(
  message: AssistantMessageView,
  parentToolUseID: string | null,
): SDKAssistantMessageView | null {
  const uuid = getOptionalString(message.uuid)
  if (!uuid) {
    return null
  }

  const sdkMessage: SDKAssistantMessageView = {
    type: 'assistant',
    message: message.message,
    parent_tool_use_id: parentToolUseID,
    session_id: getSessionId(),
    uuid,
  }

  const error = toSDKAssistantError(message.error)
  if (error !== undefined) {
    sdkMessage.error = error
  }

  return sdkMessage
}

function toSDKUserMessage(
  message: UserMessageView,
  parentToolUseID: string | null,
): SDKUserMessageView {
  const sdkMessage: SDKUserMessageView = {
    type: 'user',
    message: message.message,
    parent_tool_use_id: parentToolUseID,
    session_id: getSessionId(),
  }

  const uuid = getOptionalString(message.uuid)
  if (uuid) {
    sdkMessage.uuid = uuid
  }

  const timestamp = getOptionalString(message.timestamp)
  if (timestamp) {
    sdkMessage.timestamp = timestamp
  }

  if (message.isMeta === true || message.isVisibleInTranscriptOnly === true) {
    sdkMessage.isSynthetic = true
  }

  const toolUseResult = getToolUseResultPayload(message)
  if (toolUseResult !== undefined) {
    sdkMessage.tool_use_result = toolUseResult
  }

  return sdkMessage
}

function getProgressEventUuid(message: ProgressMessageView): string {
  return getOptionalString(message.uuid) ?? message.toolUseID
}

/**
 * Checks if the result should be considered successful based on the last message.
 * Returns true if:
 * - Last message is assistant with text/thinking content
 * - Last message is user with only tool_result blocks
 * - Last message is the user prompt but the API completed with end_turn
 *   (model chose to emit no content blocks)
 */
export function isResultSuccessful(
  message: Message | undefined,
  stopReason: string | null = null,
): message is Message {
  if (!message) return false

  if (message.type === 'assistant') {
    const lastContent = last(message.message.content)
    return (
      (isContentBlockWithType(lastContent) && lastContent.type === 'text') ||
      (isContentBlockWithType(lastContent) &&
        lastContent.type === 'thinking') ||
      (isContentBlockWithType(lastContent) &&
        lastContent.type === 'redacted_thinking')
    )
  }

  if (message.type === 'user') {
    // Check if all content blocks are tool_result type
    const content = message.message.content
    if (
      Array.isArray(content) &&
      content.length > 0 &&
      content.every(
        block => isContentBlockWithType(block) && block.type === 'tool_result',
      )
    ) {
      return true
    }
  }

  // Carve-out: API completed (message_delta set stop_reason) but yielded
  // no assistant content — last(messages) is still this turn's prompt.
  // claude.ts:2026 recognizes end_turn-with-zero-content-blocks as
  // legitimate and passes through without throwing. Observed on
  // task_notification drain turns: model returns stop_reason=end_turn,
  // outputTokens=4, textContentLength=0 — it saw the subagent result
  // and decided nothing needed saying. Without this, QueryEngine emits
  // error_during_execution with errors[] = the entire process's
  // accumulated logError() buffer. Covers both string-content and
  // text-block-content user prompts, and any other non-passing shape.
  return stopReason === 'end_turn'
}

// Track last sent time for tool progress messages per tool use ID
// Keep only the last 100 entries to prevent unbounded growth
const MAX_TOOL_PROGRESS_TRACKING_ENTRIES = 100
const TOOL_PROGRESS_THROTTLE_MS = 30000
const toolProgressLastSentTime = new Map<string, number>()

export function* normalizeMessage(message: Message): Generator<SDKMessage> {
  switch (message.type) {
    case 'assistant':
      for (const normalizedMessage of normalizeMessages([message])) {
        if (!isAssistantMessageView(normalizedMessage)) {
          continue
        }

        // Skip empty messages (e.g., "(no content)") that shouldn't be output to SDK
        if (!isNotEmptyMessage(normalizedMessage)) {
          continue
        }

        const sdkMessage = toSDKAssistantMessage(normalizedMessage, null)
        if (sdkMessage) {
          yield sdkMessage
        }
      }
      return
    case 'progress':
      if (isAgentOrSkillProgressData(message.data)) {
        for (const normalizedMessage of normalizeMessages([message.data.message])) {
          if (isAssistantMessageView(normalizedMessage)) {
            // Skip empty messages (e.g., "(no content)") that shouldn't be output to SDK
            if (!isNotEmptyMessage(normalizedMessage)) {
              continue
            }

            const sdkMessage = toSDKAssistantMessage(
              normalizedMessage,
              message.parentToolUseID,
            )
            if (sdkMessage) {
              yield sdkMessage
            }
            continue
          }

          if (isUserMessageView(normalizedMessage)) {
            yield toSDKUserMessage(normalizedMessage, message.parentToolUseID)
          }
        }
      } else if (isShellProgressData(message.data)) {
        // Filter bash progress to send only one per minute
        // Only emit for Claude Code Remote for now
        if (
          !isEnvTruthy(process.env.CLAUDE_CODE_REMOTE) &&
          !process.env.CLAUDE_CODE_CONTAINER_ID
        ) {
          break
        }

        // Use parentToolUseID as the key since toolUseID changes for each progress message
        const trackingKey = message.parentToolUseID
        const now = Date.now()
        const lastSent = toolProgressLastSentTime.get(trackingKey) || 0
        const timeSinceLastSent = now - lastSent

        // Send if at least 30 seconds have passed since last update
        if (timeSinceLastSent >= TOOL_PROGRESS_THROTTLE_MS) {
          // Remove oldest entry if we're at capacity (LRU eviction)
          if (
            toolProgressLastSentTime.size >= MAX_TOOL_PROGRESS_TRACKING_ENTRIES
          ) {
            const firstKey = toolProgressLastSentTime.keys().next().value
            if (firstKey !== undefined) {
              toolProgressLastSentTime.delete(firstKey)
            }
          }

          toolProgressLastSentTime.set(trackingKey, now)
          const sdkProgressMessage: SDKToolProgressMessageView = {
            type: 'tool_progress',
            tool_use_id: message.toolUseID,
            tool_name: message.data.type === 'bash_progress' ? 'Bash' : 'PowerShell',
            parent_tool_use_id: message.parentToolUseID,
            elapsed_time_seconds: message.data.elapsedTimeSeconds,
            task_id: message.data.taskId,
            session_id: getSessionId(),
            uuid: getProgressEventUuid(message),
          }

          yield sdkProgressMessage
        }
      }
      break
    case 'user':
      for (const normalizedMessage of normalizeMessages([message])) {
        if (!isUserMessageView(normalizedMessage)) {
          continue
        }
        yield toSDKUserMessage(normalizedMessage, null)
      }
      return
    default:
    // yield nothing
  }
}

export async function* handleOrphanedPermission(
  orphanedPermission: OrphanedPermission,
  tools: Tools,
  mutableMessages: Message[],
  processUserInputContext: ProcessUserInputContext,
): AsyncGenerator<SDKMessage, void, unknown> {
  const persistSession = !isSessionPersistenceDisabled()
  const { permissionResult, assistantMessage } = orphanedPermission
  const { toolUseID } = permissionResult

  if (!toolUseID) {
    logForDebugging(
      'Orphaned permission is missing toolUseID; skipping replay',
      { level: 'warn' },
    )
    return
  }

  const content = assistantMessage.message.content
  let toolUseBlock: ToolUseBlock | undefined
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use' && block.id === toolUseID) {
        toolUseBlock = block as ToolUseBlock
        break
      }
    }
  }

  if (!toolUseBlock) {
    logForDebugging(
      `Orphaned permission could not find tool_use block for ID ${toolUseID}; skipping replay`,
      { level: 'warn' },
    )
    return
  }

  const toolName = toolUseBlock.name
  const toolInput = toolUseBlock.input

  const toolDefinition = findToolByName(tools, toolName)
  if (!toolDefinition) {
    logForDebugging(
      `Orphaned permission references unknown tool ${toolName}; skipping replay`,
      { level: 'warn' },
    )
    return
  }

  // Create ToolUseBlock with the updated input if permission was allowed
  let finalInput = toolInput
  if (permissionResult.behavior === 'allow') {
    if (permissionResult.updatedInput !== undefined) {
      finalInput = permissionResult.updatedInput
    } else {
      logForDebugging(
        `Orphaned permission for ${toolName}: updatedInput is undefined, falling back to original tool input`,
        { level: 'warn' },
      )
    }
  }
  const finalToolUseBlock: ToolUseBlock = {
    ...toolUseBlock,
    input: finalInput,
  }

  const canUseTool: CanUseToolFn = async () => ({
    ...permissionResult,
    decisionReason: {
      type: 'mode',
      mode: 'default' as const,
    },
  })

  // Add the assistant message with tool_use to messages BEFORE executing
  // so the conversation history is complete (tool_use -> tool_result).
  //
  // On CCR resume, mutableMessages is seeded from the transcript and may already
  // contain this tool_use. Pushing again would make normalizeMessagesForAPI merge
  // same-ID assistants (concatenating content) and produce a duplicate tool_use
  // ID, which the API rejects with "tool_use ids must be unique".
  //
  // Check for the specific tool_use_id rather than message.id: streaming yields
  // each content block as a separate AssistantMessage sharing one message.id, so
  // a [text, tool_use] response lands as two entries. filterUnresolvedToolUses may
  // strip the tool_use entry but keep the text one; an id-based check would then
  // wrongly skip the push while runTools below still executes, orphaning the result.
  const alreadyPresent = mutableMessages.some(
    m =>
      m.type === 'assistant' &&
      Array.isArray(m.message.content) &&
      m.message.content.some(
        b => b.type === 'tool_use' && 'id' in b && b.id === toolUseID,
      ),
  )
  if (!alreadyPresent) {
    mutableMessages.push(assistantMessage)
    if (persistSession) {
      await recordTranscript(mutableMessages)
    }
  }

  let emittedAssistantMessage = false
  for (const sdkMessage of normalizeMessage(assistantMessage)) {
    emittedAssistantMessage = true
    yield sdkMessage
  }
  if (!emittedAssistantMessage) {
    logForDebugging(
      `Orphaned permission assistant message type ${assistantMessage.type} is not SDK-emittable; skipping emission`,
      { level: 'warn' },
    )
  }

  // Execute the tool - errors are handled internally by runToolUse
  for await (const update of runTools(
    [finalToolUseBlock],
    [assistantMessage],
    canUseTool,
    processUserInputContext,
  )) {
    if (update.message) {
      mutableMessages.push(update.message)
      if (persistSession) {
        await recordTranscript(mutableMessages)
      }

      let emittedUpdateMessage = false
      for (const sdkMessage of normalizeMessage(update.message)) {
        emittedUpdateMessage = true
        yield sdkMessage
      }
      if (!emittedUpdateMessage) {
        logForDebugging(
          `Orphaned permission update message type ${update.message.type} is not SDK-emittable; skipping emission`,
          { level: 'warn' },
        )
      }
    }
  }
}

// Create a function to extract read files from messages
export function extractReadFilesFromMessages(
  messages: Message[],
  cwd: string,
  maxSize: number = ASK_READ_FILE_STATE_CACHE_SIZE,
): FileStateCache {
  const cache = createFileStateCacheWithSizeLimit(maxSize)

  // First pass: find all FileReadTool/FileWriteTool/FileEditTool uses in assistant messages
  const fileReadToolUseIds = new Map<string, string>() // toolUseId -> filePath
  const fileWriteToolUseIds = new Map<
    string,
    { filePath: string; content: string }
  >() // toolUseId -> { filePath, content }
  const fileEditToolUseIds = new Map<string, string>() // toolUseId -> filePath

  for (const message of messages) {
    if (
      message.type === 'assistant' &&
      Array.isArray(message.message.content)
    ) {
      for (const content of message.message.content) {
        if (
          content.type === 'tool_use' &&
          content.name === FILE_READ_TOOL_NAME
        ) {
          // Extract file_path from the tool use input
          const input = content.input as FileReadInput | undefined
          // Ranged reads are not added to the cache.
          if (
            input?.file_path &&
            input?.offset === undefined &&
            input?.limit === undefined
          ) {
            // Normalize to absolute path for consistent cache lookups
            const absolutePath = expandPath(input.file_path, cwd)
            fileReadToolUseIds.set(content.id, absolutePath)
          }
        } else if (
          content.type === 'tool_use' &&
          content.name === FILE_WRITE_TOOL_NAME
        ) {
          // Extract file_path and content from the Write tool use input
          const input = content.input as
            | { file_path?: string; content?: string }
            | undefined
          if (input?.file_path && input?.content) {
            // Normalize to absolute path for consistent cache lookups
            const absolutePath = expandPath(input.file_path, cwd)
            fileWriteToolUseIds.set(content.id, {
              filePath: absolutePath,
              content: input.content,
            })
          }
        } else if (
          content.type === 'tool_use' &&
          content.name === FILE_EDIT_TOOL_NAME
        ) {
          // Edit's input has old_string/new_string, not the resulting content.
          // Track the path so the second pass can read current disk state.
          const input = content.input as { file_path?: string } | undefined
          if (input?.file_path) {
            const absolutePath = expandPath(input.file_path, cwd)
            fileEditToolUseIds.set(content.id, absolutePath)
          }
        }
      }
    }
  }

  // Second pass: find corresponding tool results and extract content
  for (const message of messages) {
    if (message.type === 'user' && Array.isArray(message.message.content)) {
      for (const content of message.message.content) {
        if (content.type === 'tool_result' && content.tool_use_id) {
          // Handle Read tool results
          const readFilePath = fileReadToolUseIds.get(content.tool_use_id)
          if (
            readFilePath &&
            typeof content.content === 'string' &&
            // Dedup stubs contain no file content — the earlier real Read
            // already cached it. Chronological last-wins would otherwise
            // overwrite the real entry with stub text.
            !content.content.startsWith(FILE_UNCHANGED_STUB)
          ) {
            // Remove system-reminder blocks from the content
            const processedContent = content.content.replace(
              /<system-reminder>[\s\S]*?<\/system-reminder>/g,
              '',
            )

            // Extract the actual file content from the tool result
            // Tool results for text files contain line numbers, we need to strip those
            const fileContent = processedContent
              .split('\n')
              .map(stripLineNumberPrefix)
              .join('\n')
              .trim()

            // Cache the file content with the message timestamp
            if (message.timestamp) {
              const timestamp = new Date(message.timestamp).getTime()
              cache.set(readFilePath, {
                content: fileContent,
                timestamp,
                offset: undefined,
                limit: undefined,
              })
            }
          }

          // Handle Write tool results - use content from the tool input
          const writeToolData = fileWriteToolUseIds.get(content.tool_use_id)
          if (writeToolData && message.timestamp) {
            const timestamp = new Date(message.timestamp).getTime()
            cache.set(writeToolData.filePath, {
              content: writeToolData.content,
              timestamp,
              offset: undefined,
              limit: undefined,
            })
          }

          // Handle Edit tool results — post-edit content isn't in the
          // tool_use input (only old_string/new_string) nor fully in the
          // result (only a snippet). Read from disk now, using actual mtime
          // so getChangedFiles's mtime check passes on the next turn.
          //
          // Callers seed the cache once at process start (print.ts --resume,
          // Cowork cold-restart per turn), so disk content at extraction time
          // IS the post-edit state. No dedup: processing every Edit preserves
          // last-wins semantics when Read/Write interleave (Edit→Read→Edit).
          const editFilePath = fileEditToolUseIds.get(content.tool_use_id)
          if (editFilePath && content.is_error !== true) {
            try {
              const { content: diskContent } =
                readFileSyncWithMetadata(editFilePath)
              cache.set(editFilePath, {
                content: diskContent,
                timestamp: getFileModificationTime(editFilePath),
                offset: undefined,
                limit: undefined,
              })
            } catch (e: unknown) {
              if (!isFsInaccessible(e)) {
                throw e
              }
              // File deleted or inaccessible since the Edit — skip
            }
          }
        }
      }
    }
  }

  return cache
}

/**
 * Extract the top-level CLI tools used in BashTool calls from message history.
 * Returns a deduplicated set of command names (e.g. 'vercel', 'aws', 'git').
 */
export function extractBashToolsFromMessages(messages: Message[]): Set<string> {
  const tools = new Set<string>()
  for (const message of messages) {
    if (
      message.type === 'assistant' &&
      Array.isArray(message.message.content)
    ) {
      for (const content of message.message.content) {
        if (content.type === 'tool_use' && content.name === BASH_TOOL_NAME) {
          const { input } = content
          if (
            typeof input !== 'object' ||
            input === null ||
            !('command' in input)
          )
            continue
          const cmd = extractCliName(
            typeof input.command === 'string' ? input.command : undefined,
          )
          if (cmd) {
            tools.add(cmd)
          }
        }
      }
    }
  }
  return tools
}

const STRIPPED_COMMANDS = new Set(['sudo'])

/**
 * Extract the actual CLI name from a bash command string, skipping
 * env var assignments (e.g. `FOO=bar vercel` → `vercel`) and prefixes
 * in STRIPPED_COMMANDS.
 */
function extractCliName(command: string | undefined): string | undefined {
  if (!command) return undefined
  const tokens = command.trim().split(/\s+/)
  for (const token of tokens) {
    if (/^[A-Za-z_]\w*=/.test(token)) continue
    if (STRIPPED_COMMANDS.has(token)) continue
    return token
  }
  return undefined
}
