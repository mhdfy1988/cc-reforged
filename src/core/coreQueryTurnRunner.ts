import { randomUUID } from 'node:crypto'
import { getSystemPrompt } from '../constants/prompts.js'
import { getSystemContext, getUserContext } from '../context.js'
import { query } from '../query.js'
import { getLlmRuntimeAuthStatus } from '../services/llm/runtimeStatus.js'
import { getDefaultAppState, type AppState } from '../state/AppStateStore.js'
import type { ToolUseContext } from '../Tool.js'
import { assembleToolPool } from '../tools.js'
import type { AttributionState } from '../utils/commitAttribution.js'
import { createFileStateCacheWithSizeLimit } from '../utils/fileStateCache.js'
import type { FileHistoryState } from '../utils/fileHistory.js'
import { createUserMessage } from '../utils/messages.js'
import { setCwd } from '../utils/Shell.js'
import { asSystemPrompt } from '../utils/systemPromptType.js'
import { shouldEnableThinkingByDefault } from '../utils/thinking.js'
import { CoreError } from './errors.js'
import type {
  CoreEventEmitter,
  CoreJsonObject,
  CoreTurn,
  CoreWorkspace,
} from './types.js'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import type {
  AssistantMessage,
  Message,
  StreamEvent,
} from '../types/message.js'

export async function runCoreQueryTurn(input: {
  turn: CoreTurn
  workspace: CoreWorkspace
  signal: AbortSignal
  emit: CoreEventEmitter
  createCanUseTool: (input: {
    threadId: string
    turnId: string
  }) => CanUseToolFn
}): Promise<void> {
  const { turn, workspace, signal, emit, createCanUseTool } = input
  const authStatus = await getLlmRuntimeAuthStatus()
  if (!authStatus.available) {
    throw new CoreError('auth_required', authStatus.message)
  }

  setCwd(workspace.path)

  const userMessage = createUserMessage({ content: turn.input.text })
  emitCompletedItem(emit, {
    itemId: createItemId(),
    threadId: turn.threadId,
    turnId: turn.turnId,
    kind: 'user_message',
    content: [{ type: 'text', text: turn.input.text }],
  })

  const runtime = createCoreQueryRuntime({
    turn,
  })

  const defaultSystemPrompt = await getSystemPrompt(
    runtime.toolUseContext.options.tools,
    turn.model,
    Array.from(
      runtime.getAppState().toolPermissionContext.additionalWorkingDirectories.keys(),
    ),
    runtime.toolUseContext.options.mcpClients,
  )

  const systemPrompt = asSystemPrompt(defaultSystemPrompt)
  let assistantStream: {
    itemId: string
    text: string
  } | null = null

  const abortRuntime = () => {
    if (!runtime.toolUseContext.abortController.signal.aborted) {
      runtime.toolUseContext.abortController.abort(
        signal.reason ?? 'interrupted',
      )
    }
  }
  if (signal.aborted) {
    abortRuntime()
  } else {
    signal.addEventListener('abort', abortRuntime, { once: true })
  }

  try {
    for await (const event of query({
      messages: [userMessage],
      systemPrompt,
      userContext: await getUserContext(),
      systemContext: await getSystemContext(),
      canUseTool: createCanUseTool({
        threadId: turn.threadId,
        turnId: turn.turnId,
      }),
      toolUseContext: runtime.toolUseContext,
      querySource: 'app-server',
    })) {
      if (signal.aborted) {
        throw new CoreError('turn_not_active', 'Turn was interrupted.')
      }

      if (event.type === 'stream_event') {
        assistantStream = handleStreamEvent({
          event,
          stream: assistantStream,
          emit,
          turn,
        })
        continue
      }

      if (event.type === 'assistant' && event.isApiErrorMessage) {
        throw new CoreError('internal_error', extractAssistantText(event))
      }

      if (event.type === 'assistant' && assistantStream) {
        emit({
          type: 'item_completed',
          itemId: assistantStream.itemId,
          status: 'completed',
          content: contentFromMessage(event),
        })
        assistantStream = null
        continue
      }

      if (isCoreRenderableMessage(event)) {
        emitMessageItem(emit, turn, event)
      }
    }

    if (assistantStream) {
      emit({
        type: 'item_completed',
        itemId: assistantStream.itemId,
        status: 'completed',
        content: [{ type: 'text', text: assistantStream.text }],
      })
    }
  } finally {
    signal.removeEventListener('abort', abortRuntime)
  }
}

function createCoreQueryRuntime(input: {
  turn: CoreTurn
}): {
  toolUseContext: ToolUseContext
  getAppState: () => AppState
} {
  let appState = getDefaultAppState()
  const getAppState = () => appState
  const setAppState = (updater: (prev: AppState) => AppState) => {
    appState = updater(appState)
  }

  let inProgressToolUseIDs = new Set<string>()
  let responseLength = 0
  const computeTools = () =>
    assembleToolPool(appState.toolPermissionContext, appState.mcp.tools)

  const toolUseContext: ToolUseContext = {
    abortController: new AbortController(),
    options: {
      commands: appState.mcp.commands,
      tools: computeTools(),
      debug: false,
      verbose: false,
      mainLoopModel: input.turn.model,
      thinkingConfig:
        shouldEnableThinkingByDefault() !== false
          ? { type: 'adaptive' }
          : { type: 'disabled' },
      mcpClients: appState.mcp.clients,
      mcpResources: appState.mcp.resources,
      isNonInteractiveSession: false,
      agentDefinitions: appState.agentDefinitions,
      refreshTools: computeTools,
    },
    getAppState,
    setAppState,
    messages: [],
    readFileState: createFileStateCacheWithSizeLimit(100),
    setInProgressToolUseIDs: updater => {
      inProgressToolUseIDs = updater(inProgressToolUseIDs)
    },
    setResponseLength: updater => {
      responseLength = updater(responseLength)
    },
    updateFileHistoryState: updater => {
      setAppState(prev => ({
        ...prev,
        fileHistory: updater(prev.fileHistory as FileHistoryState),
      }))
    },
    updateAttributionState: updater => {
      setAppState(prev => ({
        ...prev,
        attribution: updater(prev.attribution as AttributionState),
      }))
    },
  }

  return { toolUseContext, getAppState }
}

function handleStreamEvent(input: {
  event: StreamEvent
  stream: { itemId: string; text: string } | null
  emit: CoreEventEmitter
  turn: CoreTurn
}): { itemId: string; text: string } | null {
  const { event, emit, turn } = input
  const streamEvent = event.event
  let stream = input.stream

  if (streamEvent.type === 'message_start' && !stream) {
    stream = {
      itemId: createItemId(),
      text: '',
    }
    emit({
      type: 'item_started',
      item: {
        itemId: stream.itemId,
        threadId: turn.threadId,
        turnId: turn.turnId,
        kind: 'assistant_message',
        status: 'streaming',
        content: [],
      },
    })
  }

  if (
    streamEvent.type === 'content_block_delta' &&
    streamEvent.delta.type === 'text_delta'
  ) {
    if (!stream) {
      stream = {
        itemId: createItemId(),
        text: '',
      }
      emit({
        type: 'item_started',
        item: {
          itemId: stream.itemId,
          threadId: turn.threadId,
          turnId: turn.turnId,
          kind: 'assistant_message',
          status: 'streaming',
          content: [],
        },
      })
    }
    stream.text += streamEvent.delta.text
    emit({
      type: 'item_delta',
      threadId: turn.threadId,
      turnId: turn.turnId,
      itemId: stream.itemId,
      delta: {
        type: 'text',
        text: streamEvent.delta.text,
      },
    })
  }

  return stream
}

function emitMessageItem(
  emit: CoreEventEmitter,
  turn: CoreTurn,
  message: Message,
): void {
  emitCompletedItem(emit, {
    itemId: createItemId(),
    threadId: turn.threadId,
    turnId: turn.turnId,
    kind: messageKind(message),
    content: contentFromMessage(message),
  })
}

function emitCompletedItem(
  emit: CoreEventEmitter,
  item: {
    itemId: string
    threadId: string
    turnId: string
    kind: string
    content: readonly CoreJsonObject[]
  },
): void {
  emit({
    type: 'item_started',
    item: {
      ...item,
      status: 'completed',
    },
  })
  emit({
    type: 'item_completed',
    itemId: item.itemId,
    status: 'completed',
    content: item.content,
  })
}

function isCoreRenderableMessage(event: unknown): event is Message {
  return Boolean(
    event &&
      typeof event === 'object' &&
      'type' in event &&
      event.type !== 'stream_event' &&
      event.type !== 'stream_request_start' &&
      event.type !== 'tombstone',
  )
}

function messageKind(message: Message): string {
  switch (message.type) {
    case 'assistant':
      return 'assistant_message'
    case 'user':
      return hasToolResult(message.message.content) ? 'tool_result' : 'user_message'
    case 'progress':
      return 'tool_progress'
    case 'system':
      return 'system_message'
    case 'attachment':
      return 'attachment'
    case 'tool_use_summary':
      return 'tool_use_summary'
  }
}

function contentFromMessage(message: Message): CoreJsonObject[] {
  switch (message.type) {
    case 'assistant':
    case 'user':
      return contentBlocks(message.message.content)
    case 'system':
      return [
        {
          type: 'text',
          text: Array.isArray(message.content)
            ? message.content.join('\n')
            : message.content ?? '',
          ...(message.subtype ? { subtype: message.subtype } : {}),
          ...(message.level ? { level: message.level } : {}),
        },
      ]
    case 'progress':
      return [
        {
          type: 'progress',
          toolUseId: message.toolUseID,
          parentToolUseId: message.parentToolUseID,
          data: message.data,
        },
      ]
    case 'attachment':
      return [{ type: 'attachment', attachment: message.attachment }]
    case 'tool_use_summary':
      return [
        {
          type: 'tool_use_summary',
          summary: message.summary,
          precedingToolUseIds: message.precedingToolUseIds,
        },
      ]
  }
}

function contentBlocks(content: unknown): CoreJsonObject[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  if (!Array.isArray(content)) {
    return [{ type: 'json', value: content }]
  }
  return content.map(block => {
    if (!block || typeof block !== 'object') {
      return { type: 'json', value: block }
    }
    if ('type' in block && block.type === 'text' && 'text' in block) {
      return { type: 'text', text: block.text }
    }
    if ('type' in block && block.type === 'tool_use') {
      return {
        type: 'tool_use',
        id: 'id' in block ? block.id : undefined,
        name: 'name' in block ? block.name : undefined,
        input: 'input' in block ? block.input : undefined,
      }
    }
    if ('type' in block && block.type === 'tool_result') {
      return {
        type: 'tool_result',
        toolUseId: 'tool_use_id' in block ? block.tool_use_id : undefined,
        isError: 'is_error' in block ? block.is_error : undefined,
        content: 'content' in block ? block.content : undefined,
      }
    }
    return { type: String('type' in block ? block.type : 'json'), value: block }
  })
}

function hasToolResult(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.some(
      block =>
        block &&
        typeof block === 'object' &&
        'type' in block &&
        block.type === 'tool_result',
    )
  )
}

function createItemId(): string {
  return `item_${randomUUID()}`
}

function extractAssistantText(message: AssistantMessage): string {
  const content = message.message.content
  if (!Array.isArray(content)) {
    return 'Model request failed.'
  }
  const text = content
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part &&
        typeof part === 'object' &&
        part.type === 'text' &&
        typeof part.text === 'string',
    )
    .map(part => part.text)
    .join('')
    .trim()
  return text || 'Model request failed.'
}
