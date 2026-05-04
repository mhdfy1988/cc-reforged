import { randomUUID } from 'node:crypto'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import {
  loadLlmConfig,
  type ResolvedLlmConfig,
} from '../services/llm/llmConfig.js'
import { getLlmModelCatalogEntry } from '../services/llm/modelCatalog.js'
import {
  createLlmProviderDefinition,
  getBuiltinLlmProviderDefinition,
} from '../services/llm/providerDefinitions.js'
import { runCoreQueryTurn } from './coreQueryTurnRunner.js'
import { CoreError } from './errors.js'
import type {
  CoreEventEmitter,
  CoreJsonObject,
  CoreThread,
  CoreTurn,
  CoreTurnMetadata,
  CoreWorkspace,
} from './types.js'

type ActiveTurnRuntime = {
  turnId: string
  abortController: AbortController
}

export class CoreSessionService {
  readonly #threads = new Map<string, CoreThread>()
  readonly #turns = new Map<string, CoreTurn>()
  #activeTurn: ActiveTurnRuntime | null = null

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
    },
  ) {}

  listThreads(): CoreThread[] {
    return Array.from(this.#threads.values())
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

    this.#threads.set(thread.threadId, thread)
    this.emitLater({ type: 'thread_started', thread })
    return thread
  }

  startTurn(params: {
    threadId: string
    input: {
      type: 'text'
      text: string
    }
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
    const turn: CoreTurn = {
      turnId: createId('turn'),
      threadId: thread.threadId,
      status: 'queued',
      input: {
        type: 'text',
        text: params.input.text,
      },
      provider: config.provider,
      model: config.model,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      metadata: createInitialTurnMetadata(config),
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

  private async runTurn(
    turn: CoreTurn,
    abortController: AbortController,
  ): Promise<void> {
    const thread = this.#threads.get(turn.threadId)
    if (!thread) {
      return
    }

    try {
      turn.status = 'running'
      turn.startedAt = new Date().toISOString()
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

      const runtimeMetadata = await runCoreQueryTurn({
        turn,
        workspace,
        signal: abortController.signal,
        emit: this.options.emit,
        createCanUseTool: this.options.createCanUseTool,
      })

      if (!isTurnCancelled(turn)) {
        turn.status = 'completed'
        turn.completedAt = new Date().toISOString()
        turn.metadata = mergeTurnMetadata(turn.metadata, runtimeMetadata, {
          completedAt: turn.completedAt,
          latencyMs: computeLatencyMs(turn),
          stopReason: runtimeMetadata.stopReason ?? 'completed',
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
        turn.metadata = mergeTurnMetadata(turn.metadata, {
          completedAt: turn.completedAt,
          latencyMs: computeLatencyMs(turn),
          stopReason: 'error',
          errorKind: coreError.kind,
        })
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
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

function isTurnCancelled(turn: CoreTurn): boolean {
  return turn.status === 'cancelled'
}

function createInitialTurnMetadata(
  config: ResolvedLlmConfig,
): CoreTurnMetadata {
  return compactTurnMetadata({
    provider: config.provider,
    model: config.model,
    contextWindow: resolveContextWindow(config),
  })
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
