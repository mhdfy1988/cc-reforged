import { randomUUID } from 'node:crypto'
import type { UUID } from 'crypto'
import { dirname, isAbsolute, join, relative } from 'node:path'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import { switchSession } from '../bootstrap/state.js'
import {
  loadLlmConfig,
  type ResolvedLlmConfig,
} from '../services/llm/llmConfig.js'
import { getLlmModelCatalogEntry } from '../services/llm/modelCatalog.js'
import {
  resolveRuntimeContextBudget,
  type RuntimeContextBudget,
} from '../services/llm/contextBudget.js'
import { appendModelUsageEvent } from '../services/usage/modelUsageEvents.js'
import {
  createLlmProviderDefinition,
  getBuiltinLlmProviderDefinition,
} from '../services/llm/providerDefinitions.js'
import {
  createCoreQueryRuntime,
  runCoreQueryTurn,
  type CoreQueryRuntimeState,
  type CoreQueryTurnRunner,
} from './coreQueryTurnRunner.js'
import {
  runCoreImageGenerationTurn,
  shouldRunCoreImageGenerationTurn,
  type CoreImageGenerationTurnRunner,
} from './coreImageGenerationTurnRunner.js'
import { CoreError } from './errors.js'
import { collectContextData } from '../commands/context/context-noninteractive.js'
import { call as compactCommandCall } from '../commands/compact/compact.js'
import { buildPostCompactMessages } from '../services/compact/compact.js'
import {
  calculateTokenWarningState,
  getAutoCompactThreshold,
  getEffectiveContextWindowSize,
  isAutoCompactEnabled,
} from '../services/compact/autoCompact.js'
import {
  getSessionMemoryContent,
  getSessionMemoryStateSnapshot,
} from '../services/SessionMemory/sessionMemoryUtils.js'
import { getSessionMemoryRuntimeStatus } from '../services/SessionMemory/sessionMemory.js'
import { getStats as getContextCollapseStats, isContextCollapseEnabled } from '../services/contextCollapse/index.js'
import { asSessionId } from '../types/ids.js'
import type { LocalJSXCommandContext } from '../types/command.js'
import type { LogOption } from '../types/logs.js'
import type { Message } from '../types/message.js'
import { tokenCountWithEstimation } from '../utils/tokens.js'
import { getSessionMemoryPath } from '../utils/permissions/filesystem.js'
import { errorMessage } from '../utils/errors.js'
import { logError } from '../utils/log.js'
import { calculateKnownCostFromTokens } from '../utils/modelCost.js'
import type { ContextData } from '../utils/analyzeContext.js'
import { provisionContentReplacementState } from '../utils/toolResultStorage.js'
import { materializeConversationFromTranscript } from '../utils/conversationMaterialization.js'
import {
  createFileStateCacheWithSizeLimit,
  READ_FILE_STATE_CACHE_SIZE,
  type FileStateCache,
} from '../utils/fileStateCache.js'
import { loadConversationForResume } from '../utils/conversationRecovery.js'
import { extractReadFilesFromMessages } from '../utils/queryHelpers.js'
import {
  cleanMessagesForLogging,
  getProjectDir,
  getProjectsDir,
  flushSessionStorage,
  isChainParticipant,
  recordTranscript,
  resetSessionFilePointer,
} from '../utils/sessionStorage.js'
import type {
  CoreEventEmitter,
  CoreJsonObject,
  CoreThread,
  CoreTurn,
  CoreTurnInput,
  CoreTurnMetadata,
  CoreWorkspace,
  CoreUserContentBlock,
} from './types.js'

type ActiveTurnRuntime = {
  turnId: string
  abortController: AbortController
}

type ThreadTranscriptState = {
  sessionId: string
  transcriptPath: string
  lastRecordedLength: number
  lastParentUuid?: UUID
  firstMessageUuid?: UUID
  storageStatus: 'active' | 'disabled' | 'failed'
  lastError?: string
}

type ResumedConversation = NonNullable<
  Awaited<ReturnType<typeof loadConversationForResume>>
>

export class CoreSessionService {
  readonly #threads = new Map<string, CoreThread>()
  readonly #turns = new Map<string, CoreTurn>()
  readonly #threadMessages = new Map<string, Message[]>()
  readonly #threadReadFileStates = new Map<string, FileStateCache>()
  readonly #threadTranscriptStates = new Map<string, ThreadTranscriptState>()
  readonly #threadRuntimeStates = new Map<string, CoreQueryRuntimeState>()
  #activeTurn: ActiveTurnRuntime | null = null
  #activeTranscriptSessionId: string | null = null

  constructor(
    private readonly options: {
      emit: CoreEventEmitter
      getWorkspace: () => CoreWorkspace | null
      cancelPermissionsForTurn?: (input: {
        threadId: string
        turnId: string
        reason: string
      }) => void
      createCanUseTool: (input: {
        threadId: string
        turnId: string
      }) => CanUseToolFn
      runQueryTurn?: CoreQueryTurnRunner
      runImageGenerationTurn?: CoreImageGenerationTurnRunner
      persistTranscripts?: boolean
    },
  ) {}

  listThreads(): CoreThread[] {
    return dedupeThreadsBySession(Array.from(this.#threads.values())).map(
      thread => ({
        ...thread,
        metadata: {
          ...thread.metadata,
          ...this.createContextMetadata(thread.threadId),
        },
      }),
    )
  }

  listThreadMessages(threadId: string): Message[] {
    return [...this.getThreadMessages(threadId)]
  }

  renameThreadBySessionId(sessionId: string, title: string): CoreThread | null {
    const thread = this.findThreadBySessionId(sessionId)
    if (!thread) {
      return null
    }
    const normalizedTitle = normalizeThreadTitle(title)
    if (!normalizedTitle) {
      return null
    }
    thread.title = normalizedTitle
    thread.updatedAt = new Date().toISOString()
    return thread
  }

  startThread(params: {
    title?: string
    metadata?: CoreJsonObject
  }): CoreThread {
    const workspace = this.options.getWorkspace()
    if (!workspace?.trusted) {
      throw new CoreError('workspace_not_open', 'Workspace is not open.')
    }

    const now = new Date().toISOString()
    const thread: CoreThread = {
      threadId: createId('thread'),
      workspacePath: workspace.path,
      title: params.title ?? 'New thread',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      activeTurnId: null,
      metadata: params.metadata ?? {},
    }
    const transcriptState = this.createThreadTranscriptState(workspace.path)
    thread.metadata = {
      ...thread.metadata,
      sessionId: transcriptState.sessionId,
      sessionStoragePath: redactTranscriptPath(transcriptState.transcriptPath),
      sessionStorageStatus: transcriptState.storageStatus,
    }

    this.#threads.set(thread.threadId, thread)
    this.#threadMessages.set(thread.threadId, [])
    this.#threadReadFileStates.set(
      thread.threadId,
      createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE),
    )
    this.#threadTranscriptStates.set(thread.threadId, transcriptState)
    this.#threadRuntimeStates.set(thread.threadId, createThreadRuntimeState())
    this.markCurrentThread(thread.threadId)
    this.emitLater({ type: 'thread_started', thread })
    return thread
  }

  async resumeThread(params: {
    sessionId: string
    title?: string
    transcriptPath?: string
    projectPath?: string
    metadata?: CoreJsonObject
  }): Promise<CoreThread> {
    const workspace = this.options.getWorkspace()
    if (!workspace?.trusted) {
      throw new CoreError('workspace_not_open', 'Workspace is not open.')
    }

    const resumed = await this.loadThreadResume(params, workspace.path)
    const existingThread = this.findThreadBySessionId(params.sessionId)
    if (existingThread) {
      if (resumed?.messages.length && resumed.sessionId) {
        this.hydrateExistingThreadFromResume(
          existingThread,
          resumed,
          params,
          workspace.path,
        )
      }
      this.markCurrentThread(existingThread.threadId)
      return existingThread
    }

    if (!resumed?.messages.length || !resumed.sessionId) {
      throw new CoreError('thread_not_found', 'Session transcript not found.')
    }

    const now = new Date().toISOString()
    const transcriptPath = this.getResumeTranscriptPath(
      resumed,
      params,
      workspace.path,
    )
    const transcriptState: ThreadTranscriptState = {
      sessionId: resumed.sessionId,
      transcriptPath,
      lastRecordedLength: resumed.messages.length,
      lastParentUuid: getLastPersistedParentUuid(resumed.messages),
      firstMessageUuid: getFirstMessageUuid(resumed.messages),
      storageStatus:
        this.options.persistTranscripts === false ? 'disabled' : 'active',
    }
    const derivedTitle = deriveThreadTitleFromMessages(resumed.messages)
    const requestedTitle = normalizeThreadTitle(params.title)
    const title =
      (requestedTitle && !isGenericThreadTitle(requestedTitle)
        ? requestedTitle
        : undefined) ??
      normalizeThreadTitle(resumed.customTitle) ??
      derivedTitle ??
      normalizeThreadTitle(resumed.agentName) ??
      requestedTitle ??
      'Resumed thread'
    const thread: CoreThread = {
      threadId: createId('thread'),
      workspacePath: workspace.path,
      title,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      activeTurnId: null,
      metadata: {
        ...(params.metadata ?? {}),
        resumedFromSessionId: resumed.sessionId,
        derivedTitle,
        sessionId: resumed.sessionId,
        sessionStoragePath: redactTranscriptPath(transcriptPath),
        sessionStorageStatus: transcriptState.storageStatus,
      },
    }

    this.#threads.set(thread.threadId, thread)
    this.#threadMessages.set(thread.threadId, [...resumed.messages])
    this.#threadReadFileStates.set(
      thread.threadId,
      extractReadFilesFromMessages(
        resumed.messages,
        workspace.path,
        READ_FILE_STATE_CACHE_SIZE,
      ),
    )
    this.#threadTranscriptStates.set(thread.threadId, transcriptState)
    this.#threadRuntimeStates.set(
      thread.threadId,
      createThreadRuntimeState(resumed.messages),
    )
    this.markCurrentThread(thread.threadId)
    this.emitLater({ type: 'thread_started', thread })
    return thread
  }

  findThreadBySessionId(sessionId: string): CoreThread | null {
    for (const thread of this.#threads.values()) {
      const metadataSessionId = getThreadMetadataString(thread, 'sessionId')
      const resumedFromSessionId = getThreadMetadataString(
        thread,
        'resumedFromSessionId',
      )
      if (metadataSessionId === sessionId || resumedFromSessionId === sessionId) {
        return thread
      }
    }
    return null
  }

  startTurn(params: {
    threadId: string
    input: CoreTurnInput
    metadata?: CoreTurnMetadata
  }): CoreTurn {
    const thread = this.#threads.get(params.threadId)
    if (!thread) {
      throw new CoreError('thread_not_found', 'Thread not found.')
    }
    if (this.#activeTurn) {
      throw new CoreError(
        'operation_in_progress',
        'Operation is already in progress.',
      )
    }

    const config = loadLlmConfig()
    const now = new Date().toISOString()
    this.markCurrentThread(thread.threadId)
    const derivedTitle = deriveThreadTitleFromText(params.input.text)
    if (derivedTitle && isGenericThreadTitle(thread.title)) {
      thread.title = derivedTitle
      thread.metadata = {
        ...thread.metadata,
        derivedTitle,
      }
    }
    const turn: CoreTurn = {
      turnId: createId('turn'),
      threadId: thread.threadId,
      status: 'queued',
      input: cloneCoreTurnInput(params.input),
      provider: config.provider,
      model: config.model,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      metadata: mergeTurnMetadata(
        createInitialTurnMetadata(config),
        params.metadata,
      ),
    }

    this.#turns.set(turn.turnId, turn)
    thread.activeTurnId = turn.turnId
    thread.updatedAt = now

    const abortController = new AbortController()
    this.#activeTurn = {
      turnId: turn.turnId,
      abortController,
    }

    setTimeout(() => {
      void this.runTurn(turn, abortController)
    }, 0)

    return turn
  }

  interruptTurn(input: {
    threadId: string
    turnId: string
    reason?: string
  }): { accepted: boolean } {
    const thread = this.#threads.get(input.threadId)
    if (!thread) {
      throw new CoreError('thread_not_found', 'Thread not found.')
    }
    const turn = this.#turns.get(input.turnId)
    if (!turn) {
      throw new CoreError('turn_not_found', 'Turn not found.')
    }
    if (!this.#activeTurn || this.#activeTurn.turnId !== input.turnId) {
      throw new CoreError('turn_not_active', 'Turn is not active.')
    }

    this.#activeTurn.abortController.abort(input.reason ?? 'interrupted')
    this.options.cancelPermissionsForTurn?.({
      threadId: thread.threadId,
      turnId: turn.turnId,
      reason: input.reason ?? 'interrupted',
    })
    turn.status = 'cancelled'
    turn.completedAt = new Date().toISOString()
    turn.metadata = mergeTurnMetadata(turn.metadata, {
      completedAt: turn.completedAt,
      latencyMs: computeLatencyMs(turn),
      stopReason: input.reason ?? 'interrupted',
    })
    thread.activeTurnId = null
    this.#activeTurn = null
    this.emitLater({
      type: 'turn_cancelled',
      threadId: thread.threadId,
      turnId: turn.turnId,
      reason: input.reason ?? 'interrupted',
      metadata: turn.metadata,
    })

    return { accepted: true }
  }

  getContextStatus(params: { threadId?: string } = {}): CoreJsonObject {
    const thread = this.resolveThread(params.threadId, { allowMissing: true })
    if (!thread) {
      return {
        available: false,
        reason: 'thread_not_started',
      }
    }

    const messages = this.getThreadMessages(thread.threadId)
    const latestTurn = this.getLatestTurnForThread(thread.threadId)
    const metadata = this.createContextMetadata(thread.threadId)
    const runtimeState = this.getThreadRuntimeState(thread.threadId)
    const estimatedTokens = tokenCountWithEstimation(messages)
    const config = loadLlmConfig()
    const model =
      latestTurn?.metadata.requestedModel ??
      latestTurn?.metadata.model ??
      latestTurn?.model ??
      config.model
    const contextBudget = resolveRuntimeContextBudget({ config, model })

    return compactObject({
      available: true,
      threadId: thread.threadId,
      activeTurnId: thread.activeTurnId,
      provider: latestTurn?.metadata.provider ?? latestTurn?.provider,
      providerDisplayName: latestTurn?.metadata.providerDisplayName,
      profileId: latestTurn?.metadata.profileId,
      profileName: latestTurn?.metadata.profileName,
      apiMode: latestTurn?.metadata.apiMode,
      authStrategy: latestTurn?.metadata.authStrategy,
      model,
      contextWindow:
        latestTurn?.metadata.contextWindow ?? contextBudget.totalContextWindow,
      contextBudget: toCoreContextBudget(contextBudget),
      estimatedTokens,
      usage: latestTurn?.metadata.usage,
      messageCount: metadata.messageCount,
      lastMessageTypes: metadata.lastMessageTypes,
      compactBoundaryCount: metadata.compactBoundaryCount,
      readFileStateSize: metadata.readFileStateSize,
      sessionId: metadata.sessionId,
      sessionStoragePath: metadata.sessionStoragePath,
      sessionStorageStatus: metadata.sessionStorageStatus,
      contentReplacement: {
        enabled: runtimeState.contentReplacementState !== undefined,
        seenCount: runtimeState.contentReplacementState?.seenIds.size ?? 0,
        replacementCount:
          runtimeState.contentReplacementState?.replacements.size ?? 0,
      },
      memoryAttachments: {
        nestedTriggerCount: runtimeState.nestedMemoryAttachmentTriggers.size,
        loadedNestedMemoryPathCount: runtimeState.loadedNestedMemoryPaths.size,
        dynamicSkillTriggerCount: runtimeState.dynamicSkillDirTriggers.size,
        discoveredSkillCount: runtimeState.discoveredSkillNames.size,
      },
    })
  }

  getCompactStatus(params: { threadId?: string } = {}): CoreJsonObject {
    const thread = this.resolveThread(params.threadId, { allowMissing: true })
    if (!thread) {
      return {
        available: false,
        reason: 'thread_not_started',
      }
    }

    const messages = this.getThreadMessages(thread.threadId)
    const latestTurn = this.getLatestTurnForThread(thread.threadId)
    const config = loadLlmConfig()
    const model =
      latestTurn?.metadata.requestedModel ??
      latestTurn?.metadata.model ??
      latestTurn?.model ??
      config.model
    const contextBudget = resolveRuntimeContextBudget({ config, model })
    const estimatedTokens = tokenCountWithEstimation(messages)
    const autoCompactEnabled = isAutoCompactEnabled()
    const autoCompactThreshold = getAutoCompactThreshold(model, { config })
    const effectiveContextWindow = getEffectiveContextWindowSize(model, { config })
    const warning = calculateTokenWarningState(estimatedTokens, model, {
      config,
    })
    const contextCollapseEnabled = isContextCollapseEnabled()
    const contextCollapseStats = getContextCollapseStats()

    return compactObject({
      available: true,
      threadId: thread.threadId,
      model,
      estimatedTokens,
      contextWindow: contextBudget.totalContextWindow,
      contextBudget: toCoreContextBudget(contextBudget),
      effectiveContextWindow,
      autoCompactEnabled,
      autoCompactThreshold,
      distanceToAutoCompact: autoCompactThreshold - estimatedTokens,
      warning,
      contextCollapse: {
        enabled: contextCollapseEnabled,
        stats: contextCollapseStats,
      },
      compactBoundaryCount: messages.filter(isCompactBoundaryMessage).length,
      lastCompactBoundaryAt: getLastCompactBoundaryTimestamp(messages),
    })
  }

  async getMemorySessionStatus(
    params: { threadId?: string } = {},
  ): Promise<CoreJsonObject> {
    const thread = this.resolveThread(params.threadId, { allowMissing: true })
    const sessionMemoryState = getSessionMemoryStateSnapshot()
    const runtimeStatus = getSessionMemoryRuntimeStatus()
    const memoryPath = getSessionMemoryPath()
    let contentLength: number | undefined
    let loadError: string | undefined
    try {
      contentLength = (await getSessionMemoryContent())?.length ?? 0
    } catch (error) {
      loadError = errorMessage(error)
    }

    return compactObject({
      available: true,
      threadId: thread?.threadId,
      hookRegistered: runtimeStatus.hookRegistered,
      autoCompactEnabled: runtimeStatus.autoCompactEnabled,
      gateEnabled: runtimeStatus.gateEnabled,
      remoteMode: runtimeStatus.remoteMode,
      config: sessionMemoryState.config,
      initialized: sessionMemoryState.initialized,
      extraction: sessionMemoryState.extraction,
      tokensAtLastExtraction: sessionMemoryState.tokensAtLastExtraction,
      lastSummarizedMessageId: sessionMemoryState.lastSummarizedMessageId,
      memoryPath: redactProjectStatePath(memoryPath),
      contentLength,
      loadError,
      sessionId: thread?.metadata.sessionId,
      sessionStoragePath: thread?.metadata.sessionStoragePath,
      sessionStorageStatus: thread?.metadata.sessionStorageStatus,
    })
  }

  async getContextAnalysis(
    params: { threadId?: string } = {},
  ): Promise<CoreJsonObject> {
    const thread = this.resolveThread(params.threadId, { allowMissing: true })
    if (!thread) {
      return {
        available: false,
        reason: 'thread_not_started',
      }
    }

    const messages = this.getThreadMessages(thread.threadId)
    const readFileState = this.getThreadReadFileState(thread.threadId)
    const runtimeState = this.getThreadRuntimeState(thread.threadId)
    const runtime = createCoreQueryRuntime({
      turn: this.createSyntheticTurn(thread),
      messages,
      readFileState,
      runtimeState,
    })

    try {
      const data = await collectContextData({
        messages,
        getAppState: runtime.getAppState,
        options: {
          mainLoopModel: runtime.toolUseContext.options.mainLoopModel,
          tools: runtime.toolUseContext.options.tools,
          agentDefinitions: runtime.toolUseContext.options.agentDefinitions,
          customSystemPrompt: runtime.toolUseContext.options.customSystemPrompt,
          appendSystemPrompt: runtime.toolUseContext.options.appendSystemPrompt,
        },
      })
      return {
        available: true,
        threadId: thread.threadId,
        analysis: sanitizeContextAnalysis(data),
      }
    } catch (error) {
      return {
        available: false,
        threadId: thread.threadId,
        reason: 'analysis_failed',
        error: errorMessage(error),
      }
    } finally {
      runtime.toolUseContext.abortController.abort('context_analysis_complete')
    }
  }

  async runCompact(params: {
    threadId: string
    instruction?: string
  }): Promise<CoreJsonObject> {
    const thread = this.resolveThread(params.threadId)
    if (thread.activeTurnId) {
      throw new CoreError(
        'operation_in_progress',
        'Cannot compact while a turn is running.',
      )
    }

    const messages = this.getThreadMessages(thread.threadId)
    const readFileState = this.getThreadReadFileState(thread.threadId)
    const runtimeState = this.getThreadRuntimeState(thread.threadId)
    const runtime = createCoreQueryRuntime({
      turn: this.createSyntheticTurn(thread),
      messages,
      readFileState,
      runtimeState,
    })

    try {
      const startedAt = new Date().toISOString()
      this.options.emit({
        type: 'context_compaction_started',
        threadId: thread.threadId,
        startedAt,
        trigger: 'manual',
        metadata: this.createContextMetadata(thread.threadId),
      })

      const commandContext: LocalJSXCommandContext = {
        ...runtime.toolUseContext,
        setMessages: updater => {
          const nextMessages = updater(this.getThreadMessages(thread.threadId))
          this.#threadMessages.set(thread.threadId, nextMessages)
        },
        options: {
          ...runtime.toolUseContext.options,
          ideInstallationStatus: null,
          theme: 'dark',
        },
        onChangeAPIKey: () => undefined,
      }
      const result = await compactCommandCall(params.instruction ?? '', commandContext)
      if (result.type !== 'compact') {
        throw new CoreError('internal_error', 'Compact did not return a compact result.')
      }

      const postCompactMessages = buildPostCompactMessages(result.compactionResult)
      const preCompactMessages = [...this.getThreadMessages(thread.threadId)]
      this.#threadMessages.set(thread.threadId, postCompactMessages)
      const persisted = await this.persistThreadMessages(thread.threadId)
      if (!persisted) {
        this.#threadMessages.set(thread.threadId, preCompactMessages)
        throw new CoreError(
          'compact_failed',
          this.getThreadTranscriptPersistError(thread.threadId),
        )
      }
      // recordTranscript queues JSONL writes. Flush before reading the
      // transcript back, otherwise the live context can be restored from the
      // pre-compact file snapshot and keep showing the old token count.
      await flushSessionStorage()
      const materializationStatus =
        await this.refreshThreadContextFromMaterializedTranscript(thread)
      const metadata = this.createContextMetadata(thread.threadId)
      thread.updatedAt = new Date().toISOString()
      this.options.emit({
        type: 'context_compacted',
        threadId: thread.threadId,
        compactedAt: thread.updatedAt,
        metadata,
        result: {
          preCompactTokenCount: result.compactionResult.preCompactTokenCount,
          postCompactTokenCount: result.compactionResult.postCompactTokenCount,
          truePostCompactTokenCount:
            result.compactionResult.truePostCompactTokenCount,
          summaryMessageCount: result.compactionResult.summaryMessages.length,
          attachmentCount: result.compactionResult.attachments.length,
          hookResultCount: result.compactionResult.hookResults.length,
          userDisplayMessage: result.compactionResult.userDisplayMessage,
        },
      })

      return {
        compacted: true,
        threadId: thread.threadId,
        messageCount: this.getThreadMessages(thread.threadId).length,
        materializationStatus,
        metadata,
        displayText: result.displayText,
      }
    } catch (error) {
      if (error instanceof CoreError) {
        throw error
      }
      throw new CoreError('compact_failed', errorMessage(error))
    }
  }

  private async runTurn(
    turn: CoreTurn,
    abortController: AbortController,
  ): Promise<void> {
    const thread = this.#threads.get(turn.threadId)
    if (!thread) {
      return
    }
    const threadMessages = this.getThreadMessages(thread.threadId)
    const readFileState = this.getThreadReadFileState(thread.threadId)
    const runtimeState = this.getThreadRuntimeState(thread.threadId)

    try {
      turn.status = 'running'
      turn.startedAt = new Date().toISOString()
      turn.metadata = mergeTurnMetadata(
        turn.metadata,
        this.createContextMetadata(thread.threadId),
      )
      thread.updatedAt = turn.startedAt
      this.options.emit({
        type: 'turn_started',
        threadId: turn.threadId,
        turnId: turn.turnId,
        provider: turn.provider,
        model: turn.model,
        metadata: mergeTurnMetadata(turn.metadata, {
          startedAt: turn.startedAt,
        }),
      })

      const workspace = this.options.getWorkspace()
      if (!workspace) {
        throw new CoreError('workspace_not_open', 'Workspace is not open.')
      }

      const runtimeMetadata = shouldRunCoreImageGenerationTurn(turn.metadata)
        ? await (this.options.runImageGenerationTurn ??
            runCoreImageGenerationTurn)({
            turn,
            workspace,
            signal: abortController.signal,
            emit: this.options.emit,
            recordMessage: message => {
              return this.recordThreadMessage(thread.threadId, message)
            },
          })
        : await (this.options.runQueryTurn ?? runCoreQueryTurn)({
            turn,
            workspace,
            signal: abortController.signal,
            emit: this.options.emit,
            historyMessages: threadMessages,
            readFileState,
            runtimeState,
            recordMessage: message => {
              return this.recordThreadMessage(thread.threadId, message)
            },
            createCanUseTool: this.options.createCanUseTool,
          })

      if (!isTurnCancelled(turn)) {
        turn.status = 'completed'
        turn.completedAt = new Date().toISOString()
        turn.metadata = mergeTurnMetadata(
          turn.metadata,
          runtimeMetadata,
          this.createContextMetadata(thread.threadId),
          {
            completedAt: turn.completedAt,
            latencyMs: computeLatencyMs(turn),
            stopReason: runtimeMetadata.stopReason ?? 'completed',
          },
        )
        recordCoreModelUsageEvent({
          turn,
          thread,
          workspace,
        })
        thread.activeTurnId = null
        this.options.emit({
          type: 'turn_completed',
          threadId: turn.threadId,
          turnId: turn.turnId,
          metadata: turn.metadata,
        })
      }
    } catch (error) {
      if (!isTurnCancelled(turn)) {
        const coreError =
          error instanceof CoreError
            ? error
            : new CoreError(
                'internal_error',
                error instanceof Error ? error.message : String(error),
              )
        turn.status = 'failed'
        turn.completedAt = new Date().toISOString()
        turn.error = {
          kind: coreError.kind,
          message: coreError.message,
        }
        turn.metadata = mergeTurnMetadata(
          turn.metadata,
          this.createContextMetadata(thread.threadId),
          {
            completedAt: turn.completedAt,
            latencyMs: computeLatencyMs(turn),
            stopReason: 'error',
            errorKind: coreError.kind,
          },
        )
        thread.activeTurnId = null
        this.options.emit({
          type: 'turn_failed',
          threadId: turn.threadId,
          turnId: turn.turnId,
          error: turn.error,
          metadata: turn.metadata,
        })
      }
    } finally {
      if (this.#activeTurn?.turnId === turn.turnId) {
        this.#activeTurn = null
      }
      this.options.cancelPermissionsForTurn?.({
        threadId: turn.threadId,
        turnId: turn.turnId,
        reason: turn.status,
      })
      thread.updatedAt = new Date().toISOString()
    }
  }

  private emitLater(event: Parameters<CoreEventEmitter>[0]): void {
    setTimeout(() => this.options.emit(event), 0)
  }

  private getThreadMessages(threadId: string): Message[] {
    let messages = this.#threadMessages.get(threadId)
    if (!messages) {
      messages = []
      this.#threadMessages.set(threadId, messages)
    }
    return messages
  }

  private getThreadReadFileState(threadId: string): FileStateCache {
    let readFileState = this.#threadReadFileStates.get(threadId)
    if (!readFileState) {
      readFileState = createFileStateCacheWithSizeLimit(
        READ_FILE_STATE_CACHE_SIZE,
      )
      this.#threadReadFileStates.set(threadId, readFileState)
    }
    return readFileState
  }

  private getThreadRuntimeState(threadId: string): CoreQueryRuntimeState {
    let runtimeState = this.#threadRuntimeStates.get(threadId)
    if (!runtimeState) {
      runtimeState = createThreadRuntimeState(this.getThreadMessages(threadId))
      this.#threadRuntimeStates.set(threadId, runtimeState)
    }
    return runtimeState
  }

  private resolveThread(
    threadId?: string,
    options: { allowMissing?: boolean } = {},
  ): CoreThread | null {
    const thread = threadId
      ? this.#threads.get(threadId)
      : Array.from(this.#threads.values()).at(-1)
    if (!thread && !options.allowMissing) {
      throw new CoreError('thread_not_found', 'Thread not found.')
    }
    return thread ?? null
  }

  private getLatestTurnForThread(threadId: string): CoreTurn | undefined {
    return Array.from(this.#turns.values())
      .filter(turn => turn.threadId === threadId)
      .at(-1)
  }

  private createSyntheticTurn(thread: CoreThread): CoreTurn {
    const config = loadLlmConfig()
    const latestTurn = this.getLatestTurnForThread(thread.threadId)
    return {
      turnId: latestTurn?.turnId ?? createId('turn_context'),
      threadId: thread.threadId,
      status: latestTurn?.status ?? 'completed',
      input: {
        type: 'text',
        text: '',
      },
      provider: latestTurn?.provider ?? config.provider,
      model: latestTurn?.metadata.model ?? latestTurn?.model ?? config.model,
      createdAt: latestTurn?.createdAt ?? thread.createdAt,
      startedAt: latestTurn?.startedAt ?? null,
      completedAt: latestTurn?.completedAt ?? null,
      error: latestTurn?.error ?? null,
      metadata: mergeTurnMetadata(
        createInitialTurnMetadata(config),
        latestTurn?.metadata,
      ),
    }
  }

  private async recordThreadMessage(
    threadId: string,
    message: Message,
  ): Promise<void> {
    const messages = this.getThreadMessages(threadId)
    messages.push(message)
    const persisted = await this.persistThreadMessages(threadId)
    if (message.type === 'system' && message.subtype === 'compact_boundary') {
      if (!persisted) {
        return
      }
      const boundaryIndex = messages.length - 1
      if (boundaryIndex > 0) {
        messages.splice(0, boundaryIndex)
      }
      const metadata = this.createContextMetadata(threadId)
      this.options.emit({
        type: 'context_compacted',
        threadId,
        compactedAt:
          typeof message.timestamp === 'string'
            ? message.timestamp
            : new Date().toISOString(),
        metadata,
        result: sanitizeCompactBoundaryMessage(message),
      })
    }
  }

  private createContextMetadata(threadId: string): CoreTurnMetadata {
    const messages = this.getThreadMessages(threadId)
    const readFileState = this.getThreadReadFileState(threadId)
    const transcriptState = this.getThreadTranscriptState(threadId)
    const firstUserMessagePreview = getFirstUserMessagePreview(messages)
    return {
      messageCount: messages.length,
      lastMessageTypes: messages.slice(-8).map(messageToContextType),
      compactBoundaryCount: messages.filter(isCompactBoundaryMessage).length,
      readFileStateSize: readFileState.size,
      derivedTitle: deriveThreadTitleFromText(firstUserMessagePreview),
      firstUserMessagePreview,
      sessionId: transcriptState?.sessionId,
      sessionStoragePath: transcriptState
        ? redactTranscriptPath(transcriptState.transcriptPath)
        : undefined,
      sessionStorageStatus: transcriptState?.storageStatus,
    }
  }

  private createThreadTranscriptState(workspacePath: string): ThreadTranscriptState {
    const sessionId = randomUUID()
    return {
      sessionId,
      transcriptPath: join(getProjectDir(workspacePath), `${sessionId}.jsonl`),
      lastRecordedLength: 0,
      storageStatus:
        this.options.persistTranscripts === false ? 'disabled' : 'active',
    }
  }

  private async loadThreadResume(
    params: {
      sessionId: string
      transcriptPath?: string
      projectPath?: string
    },
    workspacePath: string,
  ): Promise<ResumedConversation | null> {
    return loadConversationForResume(
      params.transcriptPath
        ? createLiteLogForTranscriptResume({
            sessionId: params.sessionId,
            transcriptPath: params.transcriptPath,
            projectPath: params.projectPath ?? workspacePath,
          })
        : params.sessionId,
      undefined,
    )
  }

  private getResumeTranscriptPath(
    resumed: ResumedConversation,
    params: {
      transcriptPath?: string
      projectPath?: string
    },
    workspacePath: string,
  ): string {
    return (
      resumed.fullPath ??
      params.transcriptPath ??
      join(
        getProjectDir(params.projectPath ?? workspacePath),
        `${resumed.sessionId}.jsonl`,
      )
    )
  }

  private hydrateExistingThreadFromResume(
    thread: CoreThread,
    resumed: ResumedConversation,
    params: {
      transcriptPath?: string
      projectPath?: string
      metadata?: CoreJsonObject
    },
    workspacePath: string,
  ): void {
    const currentMessages = this.getThreadMessages(thread.threadId)
    const currentTranscriptState = this.getThreadTranscriptState(thread.threadId)
    const transcriptPath = this.getResumeTranscriptPath(
      resumed,
      params,
      workspacePath,
    )
    const resumedLastParentUuid = getLastPersistedParentUuid(resumed.messages)
    const transcriptState: ThreadTranscriptState = {
      sessionId: resumed.sessionId,
      transcriptPath,
      lastRecordedLength: Math.max(
        currentMessages.length,
        resumed.messages.length,
      ),
      lastParentUuid: resumedLastParentUuid,
      firstMessageUuid: getFirstMessageUuid(resumed.messages),
      storageStatus:
        this.options.persistTranscripts === false ? 'disabled' : 'active',
    }

    thread.metadata = {
      ...thread.metadata,
      ...(params.metadata ?? {}),
      resumedFromSessionId: resumed.sessionId,
      sessionId: resumed.sessionId,
      sessionStoragePath: redactTranscriptPath(transcriptPath),
      sessionStorageStatus: transcriptState.storageStatus,
    }
    this.#threadTranscriptStates.set(thread.threadId, transcriptState)

    const hasNewTranscriptTip =
      resumedLastParentUuid !== undefined &&
      resumedLastParentUuid !== currentTranscriptState?.lastParentUuid
    if (
      resumed.messages.length <= currentMessages.length &&
      !hasNewTranscriptTip
    ) {
      return
    }

    const derivedTitle = deriveThreadTitleFromMessages(resumed.messages)
    thread.metadata = {
      ...thread.metadata,
      derivedTitle,
    }
    if (isGenericThreadTitle(thread.title)) {
      thread.title =
        normalizeThreadTitle(resumed.customTitle) ??
        derivedTitle ??
        normalizeThreadTitle(resumed.agentName) ??
        thread.title
    }
    thread.updatedAt = new Date().toISOString()
    this.#threadMessages.set(thread.threadId, [...resumed.messages])
    this.#threadReadFileStates.set(
      thread.threadId,
      extractReadFilesFromMessages(
        resumed.messages,
        workspacePath,
        READ_FILE_STATE_CACHE_SIZE,
      ),
    )
    this.#threadRuntimeStates.set(
      thread.threadId,
      createThreadRuntimeState(resumed.messages),
    )
  }

  private getThreadTranscriptState(
    threadId: string,
  ): ThreadTranscriptState | undefined {
    return this.#threadTranscriptStates.get(threadId)
  }

  private async persistThreadMessages(threadId: string): Promise<boolean> {
    const transcriptState = this.getThreadTranscriptState(threadId)
    if (!transcriptState) {
      return true
    }
    if (this.options.persistTranscripts === false) {
      transcriptState.storageStatus = 'disabled'
      return true
    }

    const messages = this.getThreadMessages(threadId)
    if (messages.length === 0) {
      return true
    }

    const currentFirstUuid = getFirstMessageUuid(messages)
    const previousLength = transcriptState.lastRecordedLength
    const wasFirstRecord = transcriptState.firstMessageUuid === undefined
    const isIncremental =
      currentFirstUuid !== undefined &&
      !wasFirstRecord &&
      currentFirstUuid === transcriptState.firstMessageUuid &&
      previousLength <= messages.length
    const isSameHeadShrink =
      currentFirstUuid !== undefined &&
      !wasFirstRecord &&
      currentFirstUuid === transcriptState.firstMessageUuid &&
      previousLength > messages.length
    const startIndex = isIncremental ? previousLength : 0
    if (startIndex === messages.length) {
      return true
    }

    const slice = startIndex === 0 ? messages : messages.slice(startIndex)
    const parentHint = isIncremental
      ? transcriptState.lastParentUuid
      : undefined

    try {
      await this.activateTranscriptSession(transcriptState)
      const lastRecordedUuid = await recordTranscript(
        slice,
        {},
        parentHint,
        messages,
      )
      if (lastRecordedUuid && !isIncremental) {
        transcriptState.lastParentUuid = lastRecordedUuid
      }
      if (isIncremental || wasFirstRecord || isSameHeadShrink) {
        const last = cleanMessagesForLogging(slice, messages).findLast(
          isChainParticipant,
        )
        if (last) {
          transcriptState.lastParentUuid = last.uuid as UUID
        }
      }
      transcriptState.lastRecordedLength = messages.length
      transcriptState.firstMessageUuid = currentFirstUuid
      transcriptState.storageStatus = 'active'
      transcriptState.lastError = undefined
      return true
    } catch (error) {
      transcriptState.storageStatus = 'failed'
      transcriptState.lastError =
        error instanceof Error ? error.message : String(error)
      return false
    }
  }

  private async refreshThreadContextFromMaterializedTranscript(
    thread: CoreThread,
  ): Promise<CoreJsonObject> {
    const transcriptState = this.getThreadTranscriptState(thread.threadId)
    if (!transcriptState || this.options.persistTranscripts === false) {
      return { status: 'skipped', reason: 'transcript_not_active' }
    }

    try {
      const materialized = await materializeConversationFromTranscript(
        transcriptState.transcriptPath,
      )
      if (materialized.status !== 'ok') {
        const codes = materialized.diagnostics
          .filter(diagnostic => diagnostic.level === 'error')
          .map(diagnostic => diagnostic.code)
        throw new Error(
          `history materialization failed: ${codes.join(', ') || 'unknown'}`,
        )
      }

      const materializedMessages = [
        ...materialized.currentContextMessages,
      ] as Message[]
      this.#threadMessages.set(thread.threadId, materializedMessages)
      this.#threadReadFileStates.set(
        thread.threadId,
        extractReadFilesFromMessages(
          materializedMessages,
          thread.workspacePath,
          READ_FILE_STATE_CACHE_SIZE,
        ),
      )
      this.#threadRuntimeStates.set(
        thread.threadId,
        createThreadRuntimeState(materializedMessages),
      )
      transcriptState.lastRecordedLength = materializedMessages.length
      transcriptState.firstMessageUuid = getFirstMessageUuid(materializedMessages)
      transcriptState.lastParentUuid =
        getLastPersistedParentUuid(materializedMessages)
      transcriptState.storageStatus = 'active'
      transcriptState.lastError = undefined

      return {
        status: 'ok',
        messageCount: materializedMessages.length,
        rawTranscriptEvents: materialized.rawTranscriptEvents,
        coreContextMessages: materialized.coreContextMessages,
      }
    } catch (error) {
      transcriptState.storageStatus = 'failed'
      transcriptState.lastError = errorMessage(error)
      return {
        status: 'failed',
        error: transcriptState.lastError,
      }
    }
  }

  private getThreadTranscriptPersistError(threadId: string): string {
    const transcriptState = this.getThreadTranscriptState(threadId)
    return transcriptState?.lastError ?? 'Transcript persistence failed.'
  }

  private async activateTranscriptSession(
    transcriptState: ThreadTranscriptState,
  ): Promise<void> {
    if (this.#activeTranscriptSessionId === transcriptState.sessionId) {
      return
    }
    switchSession(
      asSessionId(transcriptState.sessionId),
      dirname(transcriptState.transcriptPath),
    )
    await resetSessionFilePointer()
    this.#activeTranscriptSessionId = transcriptState.sessionId
  }

  private markCurrentThread(threadId: string): void {
    for (const thread of this.#threads.values()) {
      thread.status = thread.threadId === threadId ? 'active' : 'closed'
    }
  }
}

function cloneCoreTurnInput(input: CoreTurnInput): CoreTurnInput {
  if (input.type === 'text') {
    return {
      type: 'text',
      text: input.text,
    }
  }

  return {
    type: 'content',
    text: input.text,
    content: input.content.map(cloneCoreUserContentBlock),
  }
}

function cloneCoreUserContentBlock(
  block: CoreUserContentBlock,
): CoreUserContentBlock {
  if (block.type === 'text') {
    return {
      type: 'text',
      text: block.text,
    }
  }

  const cloned: Extract<
    CoreUserContentBlock,
    { type: 'image' | 'file' | 'audio' | 'video' }
  > = {
    type: block.type,
  }
  if (block.attachmentId) {
    cloned.attachmentId = block.attachmentId
  }
  if (block.displayName) {
    cloned.displayName = block.displayName
  }
  if (block.mimeType) {
    cloned.mimeType = block.mimeType
  }
  if (block.sizeBytes !== undefined) {
    cloned.sizeBytes = block.sizeBytes
  }
  if (block.source) {
    cloned.source = { ...block.source }
  }
  return cloned
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

function createLiteLogForTranscriptResume(input: {
  sessionId: string
  transcriptPath: string
  projectPath: string
}): LogOption {
  const now = new Date()
  return {
    date: now.toISOString(),
    messages: [],
    isLite: true,
    fullPath: input.transcriptPath,
    value: 0,
    created: now,
    modified: now,
    firstPrompt: '',
    messageCount: 0,
    isSidechain: false,
    sessionId: input.sessionId,
    projectPath: input.projectPath,
  }
}

function createThreadRuntimeState(
  messages?: Message[],
): CoreQueryRuntimeState {
  return {
    nestedMemoryAttachmentTriggers: new Set(),
    loadedNestedMemoryPaths: new Set(),
    dynamicSkillDirTriggers: new Set(),
    discoveredSkillNames: new Set(),
    contentReplacementState: provisionContentReplacementState(messages),
  }
}

function isTurnCancelled(turn: CoreTurn): boolean {
  return turn.status === 'cancelled'
}

function recordCoreModelUsageEvent(input: {
  turn: CoreTurn
  thread: CoreThread
  workspace: CoreWorkspace
}): void {
  const { turn, thread, workspace } = input
  const usage = turn.metadata.usage
  if (!usage) {
    logUsageEventSkip('missing_usage', turn)
    return
  }
  const contextBudget = parseRuntimeContextBudget(turn.metadata.contextBudget)
  if (!contextBudget) {
    logUsageEventSkip('missing_context_budget', turn)
    return
  }
  const model = turn.metadata.model ?? turn.model
  const tokens = {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadInputTokens: usage.cacheReadInputTokens ?? 0,
    cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
  }
  const totalTokens =
    usage.totalTokens ??
    tokens.inputTokens +
      tokens.outputTokens +
      tokens.cacheReadInputTokens +
      tokens.cacheCreationInputTokens
  const costUSD = calculateKnownCostFromTokens(model, tokens)

  appendModelUsageEvent({
    provider: turn.metadata.provider ?? turn.provider,
    providerDisplayName: turn.metadata.providerDisplayName,
    profileId: turn.metadata.profileId,
    profileName: turn.metadata.profileName,
    model,
    requestedModel: turn.metadata.requestedModel,
    contextBudget,
    usage: {
      ...tokens,
      totalTokens,
    },
    ...(costUSD !== undefined
      ? {
          costUSD,
          costStatus: 'calculated' as const,
        }
      : {
          costStatus: 'unavailable' as const,
          costUnavailableReason: 'model_pricing_not_configured',
        }),
    sessionId: asString(thread.metadata.sessionId),
    threadId: thread.threadId,
    turnId: turn.turnId,
    requestId: turn.metadata.requestId,
    cwd: workspace.path,
    projectPath: workspace.path,
    source: 'core',
    timestamp: turn.completedAt ?? undefined,
  })
}

function logUsageEventSkip(reason: string, turn: CoreTurn): void {
  logError(
    new Error(
      [
        'Skipped ModelUsageEvent write.',
        `reason=${reason}`,
        `threadId=${turn.threadId}`,
        `turnId=${turn.turnId}`,
        `model=${turn.metadata.model ?? turn.model}`,
        `requestId=${turn.metadata.requestId ?? ''}`,
      ].join(' '),
    ),
  )
}

function parseRuntimeContextBudget(
  value: CoreJsonObject | undefined,
): RuntimeContextBudget | null {
  if (!value) {
    return null
  }
  const providerId = asString(value.providerId)
  const model = asString(value.model)
  const source = asString(value.source)
  const totalContextWindow = asNumber(value.totalContextWindow)
  const maxOutputTokens = asNumber(value.maxOutputTokens)
  const reservedOutputTokens = asNumber(value.reservedOutputTokens)
  const effectiveInputWindow = asNumber(value.effectiveInputWindow)
  const autoCompactThreshold = asNumber(value.autoCompactThreshold)
  const warningThreshold = asNumber(value.warningThreshold)
  const errorThreshold = asNumber(value.errorThreshold)
  const blockingLimit = asNumber(value.blockingLimit)
  if (
    !providerId ||
    !model ||
    !source ||
    totalContextWindow === undefined ||
    maxOutputTokens === undefined ||
    reservedOutputTokens === undefined ||
    effectiveInputWindow === undefined ||
    autoCompactThreshold === undefined ||
    warningThreshold === undefined ||
    errorThreshold === undefined ||
    blockingLimit === undefined
  ) {
    return null
  }
  return {
    providerId,
    ...(asString(value.profileId)
      ? { profileId: asString(value.profileId) }
      : {}),
    model,
    totalContextWindow,
    maxOutputTokens,
    reservedOutputTokens,
    effectiveInputWindow,
    autoCompactThreshold,
    warningThreshold,
    errorThreshold,
    blockingLimit,
    source: source as RuntimeContextBudget['source'],
  }
}

function createInitialTurnMetadata(
  config: ResolvedLlmConfig,
): CoreTurnMetadata {
  const profile = config.profiles[config.currentProfileId]
  const providerConfig = config.providers[config.provider]
  const builtinProvider = getBuiltinLlmProviderDefinition(config.provider)
  return compactTurnMetadata({
    provider: config.provider,
    providerDisplayName:
      builtinProvider?.displayName ??
      providerConfig?.displayName ??
      config.provider,
    profileId: profile?.id ?? config.currentProfileId,
    profileName: profile?.name,
    apiMode: profile?.apiMode ?? providerConfig?.apiMode,
    authStrategy: profile?.authStrategy ?? providerConfig?.authStrategy,
    model: config.model,
    requestedModel: config.model,
    contextWindow: resolveContextWindow(config),
    contextBudget: toCoreContextBudget(resolveRuntimeContextBudget({ config })),
  })
}

function toCoreContextBudget(
  budget: RuntimeContextBudget,
): Record<string, unknown> {
  return {
    providerId: budget.providerId,
    ...(budget.profileId ? { profileId: budget.profileId } : {}),
    model: budget.model,
    totalContextWindow: budget.totalContextWindow,
    maxOutputTokens: budget.maxOutputTokens,
    reservedOutputTokens: budget.reservedOutputTokens,
    effectiveInputWindow: budget.effectiveInputWindow,
    autoCompactThreshold: budget.autoCompactThreshold,
    warningThreshold: budget.warningThreshold,
    errorThreshold: budget.errorThreshold,
    blockingLimit: budget.blockingLimit,
    source: budget.source,
  }
}

function resolveContextWindow(config: ResolvedLlmConfig): number | undefined {
  try {
    const providerConfig = config.providers[config.provider]
    const providerDefinition =
      getBuiltinLlmProviderDefinition(config.provider) ??
      createLlmProviderDefinition({
        id: config.provider,
        displayName: providerConfig?.displayName ?? config.provider,
        apiMode: providerConfig?.apiMode ?? 'custom',
        authStrategy: providerConfig?.authStrategy ?? 'unknown',
        capabilities: {
          streaming: providerConfig?.supportsStreaming,
          tools: providerConfig?.supportsTools,
          reasoning: providerConfig?.supportsReasoning,
          usage: providerConfig?.supportsUsage,
        },
      })
    return getLlmModelCatalogEntry({
      providerId: config.provider,
      model: config.model,
      providerDefinition,
    }).contextWindow
  } catch {
    return undefined
  }
}

function mergeTurnMetadata(
  ...metadataList: Array<CoreTurnMetadata | undefined>
): CoreTurnMetadata {
  return compactTurnMetadata(Object.assign({}, ...metadataList))
}

function compactTurnMetadata(metadata: CoreTurnMetadata): CoreTurnMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as CoreTurnMetadata
}

function computeLatencyMs(turn: CoreTurn): number | undefined {
  if (!turn.startedAt || !turn.completedAt) {
    return undefined
  }
  const startedAt = Date.parse(turn.startedAt)
  const completedAt = Date.parse(turn.completedAt)
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
    return undefined
  }
  return Math.max(0, completedAt - startedAt)
}

function messageToContextType(message: Message): string {
  if (message.type === 'user' && hasToolResult(message.message.content)) {
    return 'tool_result'
  }
  if (message.type === 'system' && message.subtype) {
    return `system:${message.subtype}`
  }
  return message.type
}

function deriveThreadTitleFromMessages(
  messages: readonly Message[],
): string | undefined {
  return deriveThreadTitleFromText(getFirstUserMessagePreview(messages))
}

function getFirstUserMessagePreview(
  messages: readonly Message[],
): string | undefined {
  for (const message of messages) {
    if (message.type !== 'user' || message.isMeta || message.isVirtual) {
      continue
    }
    const text = extractMessageText(message.message.content)
    if (text) {
      return truncateTitle(text, 80)
    }
  }
  return undefined
}

function deriveThreadTitleFromText(text: unknown): string | undefined {
  if (typeof text !== 'string') {
    return undefined
  }
  const normalized = normalizeThreadTitle(text)
  if (!normalized) {
    return undefined
  }
  return truncateTitle(normalized, 32)
}

function normalizeThreadTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || undefined
}

function truncateTitle(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function isGenericThreadTitle(title: string): boolean {
  return (
    title === 'CCR Desktop 会话' ||
    title === 'CCR 会话' ||
    title === 'New thread' ||
    title === 'Resumed thread' ||
    title.startsWith('CCR Desktop 会话 ')
  )
}

function extractMessageText(content: unknown): string | undefined {
  if (typeof content === 'string') {
    return normalizeThreadTitle(content)
  }
  if (!Array.isArray(content)) {
    return undefined
  }

  const text = content
    .map(block => {
      if (!block || typeof block !== 'object') {
        return ''
      }
      const textValue = (block as { text?: unknown }).text
      if (typeof textValue === 'string') {
        return textValue
      }
      const contentValue = (block as { content?: unknown }).content
      return typeof contentValue === 'string' ? contentValue : ''
    })
    .filter(Boolean)
    .join(' ')
  return normalizeThreadTitle(text)
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

function isCompactBoundaryMessage(message: Message): boolean {
  return message.type === 'system' && message.subtype === 'compact_boundary'
}

function getLastCompactBoundaryTimestamp(
  messages: readonly Message[],
): string | undefined {
  return messages.findLast(isCompactBoundaryMessage)?.timestamp as
    | string
    | undefined
}

function getFirstMessageUuid(messages: readonly Message[]): UUID | undefined {
  return messages[0]?.uuid as UUID | undefined
}

function getLastPersistedParentUuid(
  messages: readonly Message[],
): UUID | undefined {
  const last = cleanMessagesForLogging([...messages], messages).findLast(
    isChainParticipant,
  )
  return last?.uuid as UUID | undefined
}

function redactTranscriptPath(transcriptPath: string): string {
  return redactProjectStatePath(transcriptPath)
}

function redactProjectStatePath(statePath: string): string {
  const relativePath = relative(getProjectsDir(), statePath)
  if (
    relativePath &&
    !relativePath.startsWith('..') &&
    !isAbsolute(relativePath)
  ) {
    return `projects/${relativePath}`
  }
  if (relativePath === '') {
    return 'projects'
  }
  return '[outside-project-state]'
}

function sanitizeContextAnalysis(data: ContextData): CoreJsonObject {
  const messageBreakdown = data.messageBreakdown
  return compactObject({
    model: data.model,
    totalTokens: data.totalTokens,
    maxTokens: data.maxTokens,
    rawMaxTokens: data.rawMaxTokens,
    percentage: data.percentage,
    autoCompactThreshold: data.autoCompactThreshold,
    isAutoCompactEnabled: data.isAutoCompactEnabled,
    apiUsage: data.apiUsage
      ? {
          inputTokens: data.apiUsage.input_tokens,
          outputTokens: data.apiUsage.output_tokens,
          cacheCreationInputTokens: data.apiUsage.cache_creation_input_tokens,
          cacheReadInputTokens: data.apiUsage.cache_read_input_tokens,
        }
      : undefined,
    categories: data.categories.map(category =>
      compactObject({
        name: category.name,
        tokens: category.tokens,
        color: category.color,
        isDeferred: category.isDeferred,
      }),
    ),
    counts: compactObject({
      memoryFileCount: data.memoryFiles.length,
      mcpToolCount: data.mcpTools.length,
      loadedMcpToolCount: data.mcpTools.filter(tool => tool.isLoaded).length,
      agentCount: data.agents.length,
      slashCommandCount: data.slashCommands?.totalCommands,
      includedSlashCommandCount: data.slashCommands?.includedCommands,
      skillCount: data.skills?.totalSkills,
      includedSkillCount: data.skills?.includedSkills,
      deferredBuiltinToolCount: data.deferredBuiltinTools?.length,
      systemToolCount: data.systemTools?.length,
      systemPromptSectionCount: data.systemPromptSections?.length,
    }),
    tokenBreakdown: compactObject({
      memoryFiles: sumTokens(data.memoryFiles),
      mcpTools: sumTokens(data.mcpTools),
      agents: sumTokens(data.agents),
      slashCommands: data.slashCommands?.tokens,
      skills: data.skills?.tokens,
      deferredBuiltinTools: sumTokens(data.deferredBuiltinTools),
      systemTools: sumTokens(data.systemTools),
      systemPromptSections: sumTokens(data.systemPromptSections),
      toolCalls: messageBreakdown?.toolCallTokens,
      toolResults: messageBreakdown?.toolResultTokens,
      attachments: messageBreakdown?.attachmentTokens,
      assistantMessages: messageBreakdown?.assistantMessageTokens,
      userMessages: messageBreakdown?.userMessageTokens,
    }),
    messageBreakdown: messageBreakdown
      ? {
          toolCallTokens: messageBreakdown.toolCallTokens,
          toolResultTokens: messageBreakdown.toolResultTokens,
          attachmentTokens: messageBreakdown.attachmentTokens,
          assistantMessageTokens: messageBreakdown.assistantMessageTokens,
          userMessageTokens: messageBreakdown.userMessageTokens,
          toolCallsByType: messageBreakdown.toolCallsByType.map(tool => ({
            name: tool.name,
            callTokens: tool.callTokens,
            resultTokens: tool.resultTokens,
          })),
          attachmentsByType: messageBreakdown.attachmentsByType.map(
            attachment => ({
              name: attachment.name,
              tokens: attachment.tokens,
            }),
          ),
        }
      : undefined,
  })
}

function sanitizeCompactBoundaryMessage(message: Message): CoreJsonObject {
  const compactMetadata =
    typeof (message as { compactMetadata?: unknown }).compactMetadata ===
      'object' &&
    (message as { compactMetadata?: unknown }).compactMetadata !== null
      ? ((message as { compactMetadata?: unknown }).compactMetadata as Record<
          string,
          unknown
        >)
      : undefined

  return compactObject({
    trigger: asString(compactMetadata?.trigger),
    preTokens: asNumber(compactMetadata?.preTokens),
    messagesSummarized: asNumber(compactMetadata?.messagesSummarized),
    postTokens: asNumber(compactMetadata?.postTokens),
    truePostTokens: asNumber(compactMetadata?.truePostTokens),
    preservedSegment:
      compactMetadata?.preservedSegment !== undefined
        ? { available: true }
        : undefined,
  })
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function sumTokens(items?: readonly { tokens: number }[]): number | undefined {
  if (!items) {
    return undefined
  }
  return items.reduce((total, item) => total + item.tokens, 0)
}

function dedupeThreadsBySession(threads: CoreThread[]): CoreThread[] {
  const bySessionId = new Map<string, CoreThread>()
  const withoutSessionId: CoreThread[] = []

  for (const thread of threads) {
    const sessionId =
      getThreadMetadataString(thread, 'sessionId') ??
      getThreadMetadataString(thread, 'resumedFromSessionId')
    if (!sessionId) {
      withoutSessionId.push(thread)
      continue
    }

    const existing = bySessionId.get(sessionId)
    if (!existing || compareThreadUpdatedAt(thread, existing) > 0) {
      bySessionId.set(sessionId, thread)
    }
  }

  return [...bySessionId.values(), ...withoutSessionId].sort(
    (left, right) => compareThreadUpdatedAt(right, left),
  )
}

function getThreadMetadataString(
  thread: CoreThread,
  key: string,
): string | undefined {
  const value = thread.metadata[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function compareThreadUpdatedAt(left: CoreThread, right: CoreThread): number {
  return Date.parse(left.updatedAt) - Date.parse(right.updatedAt)
}

function compactObject<T extends CoreJsonObject>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
  ) as T
}
