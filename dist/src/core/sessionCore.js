import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { switchSession } from '../bootstrap/state.js';
import { loadLlmConfig, } from '../services/llm/llmConfig.js';
import { getLlmModelCatalogEntry } from '../services/llm/modelCatalog.js';
import { createLlmProviderDefinition, getBuiltinLlmProviderDefinition, } from '../services/llm/providerDefinitions.js';
import { createCoreQueryRuntime, runCoreQueryTurn, } from './coreQueryTurnRunner.js';
import { runCoreImageGenerationTurn, shouldRunCoreImageGenerationTurn, } from './coreImageGenerationTurnRunner.js';
import { CoreError } from './errors.js';
import { collectContextData } from '../commands/context/context-noninteractive.js';
import { call as compactCommandCall } from '../commands/compact/compact.js';
import { buildPostCompactMessages } from '../services/compact/compact.js';
import { calculateTokenWarningState, getAutoCompactThreshold, getEffectiveContextWindowSize, isAutoCompactEnabled, } from '../services/compact/autoCompact.js';
import { getSessionMemoryContent, getSessionMemoryStateSnapshot, } from '../services/SessionMemory/sessionMemoryUtils.js';
import { getSessionMemoryRuntimeStatus } from '../services/SessionMemory/sessionMemory.js';
import { getStats as getContextCollapseStats, isContextCollapseEnabled } from '../services/contextCollapse/index.js';
import { asSessionId } from '../types/ids.js';
import { tokenCountWithEstimation } from '../utils/tokens.js';
import { getSessionMemoryPath } from '../utils/permissions/filesystem.js';
import { errorMessage } from '../utils/errors.js';
import { provisionContentReplacementState } from '../utils/toolResultStorage.js';
import { createFileStateCacheWithSizeLimit, READ_FILE_STATE_CACHE_SIZE, } from '../utils/fileStateCache.js';
import { loadConversationForResume } from '../utils/conversationRecovery.js';
import { extractReadFilesFromMessages } from '../utils/queryHelpers.js';
import { cleanMessagesForLogging, getProjectDir, getProjectsDir, isChainParticipant, recordTranscript, resetSessionFilePointer, } from '../utils/sessionStorage.js';
export class CoreSessionService {
    options;
    #threads = new Map();
    #turns = new Map();
    #threadMessages = new Map();
    #threadReadFileStates = new Map();
    #threadTranscriptStates = new Map();
    #threadRuntimeStates = new Map();
    #activeTurn = null;
    #activeTranscriptSessionId = null;
    constructor(options) {
        this.options = options;
    }
    listThreads() {
        return dedupeThreadsBySession(Array.from(this.#threads.values())).map(thread => ({
            ...thread,
            metadata: {
                ...thread.metadata,
                ...this.createContextMetadata(thread.threadId),
            },
        }));
    }
    listThreadMessages(threadId) {
        return [...this.getThreadMessages(threadId)];
    }
    startThread(params) {
        const workspace = this.options.getWorkspace();
        if (!workspace?.trusted) {
            throw new CoreError('workspace_not_open', 'Workspace is not open.');
        }
        const now = new Date().toISOString();
        const thread = {
            threadId: createId('thread'),
            workspacePath: workspace.path,
            title: params.title ?? 'New thread',
            status: 'active',
            createdAt: now,
            updatedAt: now,
            activeTurnId: null,
            metadata: params.metadata ?? {},
        };
        const transcriptState = this.createThreadTranscriptState(workspace.path);
        thread.metadata = {
            ...thread.metadata,
            sessionId: transcriptState.sessionId,
            sessionStoragePath: redactTranscriptPath(transcriptState.transcriptPath),
            sessionStorageStatus: transcriptState.storageStatus,
        };
        this.#threads.set(thread.threadId, thread);
        this.#threadMessages.set(thread.threadId, []);
        this.#threadReadFileStates.set(thread.threadId, createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE));
        this.#threadTranscriptStates.set(thread.threadId, transcriptState);
        this.#threadRuntimeStates.set(thread.threadId, createThreadRuntimeState());
        this.markCurrentThread(thread.threadId);
        this.emitLater({ type: 'thread_started', thread });
        return thread;
    }
    async resumeThread(params) {
        const workspace = this.options.getWorkspace();
        if (!workspace?.trusted) {
            throw new CoreError('workspace_not_open', 'Workspace is not open.');
        }
        const existingThread = this.findThreadBySessionId(params.sessionId);
        if (existingThread) {
            this.markCurrentThread(existingThread.threadId);
            return existingThread;
        }
        const resumed = await loadConversationForResume(params.transcriptPath
            ? createLiteLogForTranscriptResume({
                sessionId: params.sessionId,
                transcriptPath: params.transcriptPath,
                projectPath: params.projectPath ?? workspace.path,
            })
            : params.sessionId, undefined);
        if (!resumed?.messages.length || !resumed.sessionId) {
            throw new CoreError('thread_not_found', 'Session transcript not found.');
        }
        const now = new Date().toISOString();
        const transcriptPath = resumed.fullPath ??
            params.transcriptPath ??
            join(getProjectDir(params.projectPath ?? workspace.path), `${resumed.sessionId}.jsonl`);
        const transcriptState = {
            sessionId: resumed.sessionId,
            transcriptPath,
            lastRecordedLength: resumed.messages.length,
            lastParentUuid: getLastPersistedParentUuid(resumed.messages),
            firstMessageUuid: getFirstMessageUuid(resumed.messages),
            storageStatus: this.options.persistTranscripts === false ? 'disabled' : 'active',
        };
        const derivedTitle = deriveThreadTitleFromMessages(resumed.messages);
        const requestedTitle = normalizeThreadTitle(params.title);
        const title = (requestedTitle && !isGenericThreadTitle(requestedTitle)
            ? requestedTitle
            : undefined) ??
            normalizeThreadTitle(resumed.customTitle) ??
            derivedTitle ??
            normalizeThreadTitle(resumed.agentName) ??
            requestedTitle ??
            'Resumed thread';
        const thread = {
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
        };
        this.#threads.set(thread.threadId, thread);
        this.#threadMessages.set(thread.threadId, [...resumed.messages]);
        this.#threadReadFileStates.set(thread.threadId, extractReadFilesFromMessages(resumed.messages, workspace.path, READ_FILE_STATE_CACHE_SIZE));
        this.#threadTranscriptStates.set(thread.threadId, transcriptState);
        this.#threadRuntimeStates.set(thread.threadId, createThreadRuntimeState(resumed.messages));
        this.markCurrentThread(thread.threadId);
        this.emitLater({ type: 'thread_started', thread });
        return thread;
    }
    findThreadBySessionId(sessionId) {
        for (const thread of this.#threads.values()) {
            const metadataSessionId = getThreadMetadataString(thread, 'sessionId');
            const resumedFromSessionId = getThreadMetadataString(thread, 'resumedFromSessionId');
            if (metadataSessionId === sessionId || resumedFromSessionId === sessionId) {
                return thread;
            }
        }
        return null;
    }
    startTurn(params) {
        const thread = this.#threads.get(params.threadId);
        if (!thread) {
            throw new CoreError('thread_not_found', 'Thread not found.');
        }
        if (this.#activeTurn) {
            throw new CoreError('operation_in_progress', 'Operation is already in progress.');
        }
        const config = loadLlmConfig();
        const now = new Date().toISOString();
        this.markCurrentThread(thread.threadId);
        const derivedTitle = deriveThreadTitleFromText(params.input.text);
        if (derivedTitle && isGenericThreadTitle(thread.title)) {
            thread.title = derivedTitle;
            thread.metadata = {
                ...thread.metadata,
                derivedTitle,
            };
        }
        const turn = {
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
            metadata: mergeTurnMetadata(createInitialTurnMetadata(config), params.metadata),
        };
        this.#turns.set(turn.turnId, turn);
        thread.activeTurnId = turn.turnId;
        thread.updatedAt = now;
        const abortController = new AbortController();
        this.#activeTurn = {
            turnId: turn.turnId,
            abortController,
        };
        setTimeout(() => {
            void this.runTurn(turn, abortController);
        }, 0);
        return turn;
    }
    interruptTurn(input) {
        const thread = this.#threads.get(input.threadId);
        if (!thread) {
            throw new CoreError('thread_not_found', 'Thread not found.');
        }
        const turn = this.#turns.get(input.turnId);
        if (!turn) {
            throw new CoreError('turn_not_found', 'Turn not found.');
        }
        if (!this.#activeTurn || this.#activeTurn.turnId !== input.turnId) {
            throw new CoreError('turn_not_active', 'Turn is not active.');
        }
        this.#activeTurn.abortController.abort(input.reason ?? 'interrupted');
        this.options.cancelPermissionsForTurn?.({
            threadId: thread.threadId,
            turnId: turn.turnId,
            reason: input.reason ?? 'interrupted',
        });
        turn.status = 'cancelled';
        turn.completedAt = new Date().toISOString();
        turn.metadata = mergeTurnMetadata(turn.metadata, {
            completedAt: turn.completedAt,
            latencyMs: computeLatencyMs(turn),
            stopReason: input.reason ?? 'interrupted',
        });
        thread.activeTurnId = null;
        this.#activeTurn = null;
        this.emitLater({
            type: 'turn_cancelled',
            threadId: thread.threadId,
            turnId: turn.turnId,
            reason: input.reason ?? 'interrupted',
            metadata: turn.metadata,
        });
        return { accepted: true };
    }
    getContextStatus(params = {}) {
        const thread = this.resolveThread(params.threadId, { allowMissing: true });
        if (!thread) {
            return {
                available: false,
                reason: 'thread_not_started',
            };
        }
        const messages = this.getThreadMessages(thread.threadId);
        const latestTurn = this.getLatestTurnForThread(thread.threadId);
        const metadata = this.createContextMetadata(thread.threadId);
        const runtimeState = this.getThreadRuntimeState(thread.threadId);
        const estimatedTokens = tokenCountWithEstimation(messages);
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
            model: latestTurn?.metadata.requestedModel ??
                latestTurn?.metadata.model ??
                latestTurn?.model,
            contextWindow: latestTurn?.metadata.contextWindow,
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
                replacementCount: runtimeState.contentReplacementState?.replacements.size ?? 0,
            },
            memoryAttachments: {
                nestedTriggerCount: runtimeState.nestedMemoryAttachmentTriggers.size,
                loadedNestedMemoryPathCount: runtimeState.loadedNestedMemoryPaths.size,
                dynamicSkillTriggerCount: runtimeState.dynamicSkillDirTriggers.size,
                discoveredSkillCount: runtimeState.discoveredSkillNames.size,
            },
        });
    }
    getCompactStatus(params = {}) {
        const thread = this.resolveThread(params.threadId, { allowMissing: true });
        if (!thread) {
            return {
                available: false,
                reason: 'thread_not_started',
            };
        }
        const messages = this.getThreadMessages(thread.threadId);
        const latestTurn = this.getLatestTurnForThread(thread.threadId);
        const model = latestTurn?.metadata.requestedModel ??
            latestTurn?.metadata.model ??
            latestTurn?.model ??
            loadLlmConfig().model;
        const estimatedTokens = tokenCountWithEstimation(messages);
        const autoCompactEnabled = isAutoCompactEnabled();
        const autoCompactThreshold = getAutoCompactThreshold(model);
        const effectiveContextWindow = getEffectiveContextWindowSize(model);
        const warning = calculateTokenWarningState(estimatedTokens, model);
        const contextCollapseEnabled = isContextCollapseEnabled();
        const contextCollapseStats = getContextCollapseStats();
        return compactObject({
            available: true,
            threadId: thread.threadId,
            model,
            estimatedTokens,
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
        });
    }
    async getMemorySessionStatus(params = {}) {
        const thread = this.resolveThread(params.threadId, { allowMissing: true });
        const sessionMemoryState = getSessionMemoryStateSnapshot();
        const runtimeStatus = getSessionMemoryRuntimeStatus();
        const memoryPath = getSessionMemoryPath();
        let contentLength;
        let loadError;
        try {
            contentLength = (await getSessionMemoryContent())?.length ?? 0;
        }
        catch (error) {
            loadError = errorMessage(error);
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
        });
    }
    async getContextAnalysis(params = {}) {
        const thread = this.resolveThread(params.threadId, { allowMissing: true });
        if (!thread) {
            return {
                available: false,
                reason: 'thread_not_started',
            };
        }
        const messages = this.getThreadMessages(thread.threadId);
        const readFileState = this.getThreadReadFileState(thread.threadId);
        const runtimeState = this.getThreadRuntimeState(thread.threadId);
        const runtime = createCoreQueryRuntime({
            turn: this.createSyntheticTurn(thread),
            messages,
            readFileState,
            runtimeState,
        });
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
            });
            return {
                available: true,
                threadId: thread.threadId,
                analysis: sanitizeContextAnalysis(data),
            };
        }
        catch (error) {
            return {
                available: false,
                threadId: thread.threadId,
                reason: 'analysis_failed',
                error: errorMessage(error),
            };
        }
        finally {
            runtime.toolUseContext.abortController.abort('context_analysis_complete');
        }
    }
    async runCompact(params) {
        const thread = this.resolveThread(params.threadId);
        if (thread.activeTurnId) {
            throw new CoreError('operation_in_progress', 'Cannot compact while a turn is running.');
        }
        const messages = this.getThreadMessages(thread.threadId);
        const readFileState = this.getThreadReadFileState(thread.threadId);
        const runtimeState = this.getThreadRuntimeState(thread.threadId);
        const runtime = createCoreQueryRuntime({
            turn: this.createSyntheticTurn(thread),
            messages,
            readFileState,
            runtimeState,
        });
        try {
            const commandContext = {
                ...runtime.toolUseContext,
                setMessages: updater => {
                    const nextMessages = updater(this.getThreadMessages(thread.threadId));
                    this.#threadMessages.set(thread.threadId, nextMessages);
                },
                options: {
                    ...runtime.toolUseContext.options,
                    ideInstallationStatus: null,
                    theme: 'dark',
                },
                onChangeAPIKey: () => undefined,
            };
            const result = await compactCommandCall(params.instruction ?? '', commandContext);
            if (result.type !== 'compact') {
                throw new CoreError('internal_error', 'Compact did not return a compact result.');
            }
            const postCompactMessages = buildPostCompactMessages(result.compactionResult);
            this.#threadMessages.set(thread.threadId, postCompactMessages);
            await this.persistThreadMessages(thread.threadId);
            const metadata = this.createContextMetadata(thread.threadId);
            thread.updatedAt = new Date().toISOString();
            this.options.emit({
                type: 'context_compacted',
                threadId: thread.threadId,
                compactedAt: thread.updatedAt,
                metadata,
                result: {
                    preCompactTokenCount: result.compactionResult.preCompactTokenCount,
                    postCompactTokenCount: result.compactionResult.postCompactTokenCount,
                    truePostCompactTokenCount: result.compactionResult.truePostCompactTokenCount,
                    summaryMessageCount: result.compactionResult.summaryMessages.length,
                    attachmentCount: result.compactionResult.attachments.length,
                    hookResultCount: result.compactionResult.hookResults.length,
                    userDisplayMessage: result.compactionResult.userDisplayMessage,
                },
            });
            return {
                compacted: true,
                threadId: thread.threadId,
                messageCount: postCompactMessages.length,
                metadata,
                displayText: result.displayText,
            };
        }
        catch (error) {
            if (error instanceof CoreError) {
                throw error;
            }
            throw new CoreError('compact_failed', errorMessage(error));
        }
    }
    async runTurn(turn, abortController) {
        const thread = this.#threads.get(turn.threadId);
        if (!thread) {
            return;
        }
        const threadMessages = this.getThreadMessages(thread.threadId);
        const readFileState = this.getThreadReadFileState(thread.threadId);
        const runtimeState = this.getThreadRuntimeState(thread.threadId);
        try {
            turn.status = 'running';
            turn.startedAt = new Date().toISOString();
            turn.metadata = mergeTurnMetadata(turn.metadata, this.createContextMetadata(thread.threadId));
            thread.updatedAt = turn.startedAt;
            this.options.emit({
                type: 'turn_started',
                threadId: turn.threadId,
                turnId: turn.turnId,
                provider: turn.provider,
                model: turn.model,
                metadata: mergeTurnMetadata(turn.metadata, {
                    startedAt: turn.startedAt,
                }),
            });
            const workspace = this.options.getWorkspace();
            if (!workspace) {
                throw new CoreError('workspace_not_open', 'Workspace is not open.');
            }
            const runtimeMetadata = shouldRunCoreImageGenerationTurn(turn.metadata)
                ? await (this.options.runImageGenerationTurn ??
                    runCoreImageGenerationTurn)({
                    turn,
                    workspace,
                    signal: abortController.signal,
                    emit: this.options.emit,
                    recordMessage: message => {
                        return this.recordThreadMessage(thread.threadId, message);
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
                        return this.recordThreadMessage(thread.threadId, message);
                    },
                    createCanUseTool: this.options.createCanUseTool,
                });
            if (!isTurnCancelled(turn)) {
                turn.status = 'completed';
                turn.completedAt = new Date().toISOString();
                turn.metadata = mergeTurnMetadata(turn.metadata, runtimeMetadata, this.createContextMetadata(thread.threadId), {
                    completedAt: turn.completedAt,
                    latencyMs: computeLatencyMs(turn),
                    stopReason: runtimeMetadata.stopReason ?? 'completed',
                });
                thread.activeTurnId = null;
                this.options.emit({
                    type: 'turn_completed',
                    threadId: turn.threadId,
                    turnId: turn.turnId,
                    metadata: turn.metadata,
                });
            }
        }
        catch (error) {
            if (!isTurnCancelled(turn)) {
                const coreError = error instanceof CoreError
                    ? error
                    : new CoreError('internal_error', error instanceof Error ? error.message : String(error));
                turn.status = 'failed';
                turn.completedAt = new Date().toISOString();
                turn.error = {
                    kind: coreError.kind,
                    message: coreError.message,
                };
                turn.metadata = mergeTurnMetadata(turn.metadata, this.createContextMetadata(thread.threadId), {
                    completedAt: turn.completedAt,
                    latencyMs: computeLatencyMs(turn),
                    stopReason: 'error',
                    errorKind: coreError.kind,
                });
                thread.activeTurnId = null;
                this.options.emit({
                    type: 'turn_failed',
                    threadId: turn.threadId,
                    turnId: turn.turnId,
                    error: turn.error,
                    metadata: turn.metadata,
                });
            }
        }
        finally {
            if (this.#activeTurn?.turnId === turn.turnId) {
                this.#activeTurn = null;
            }
            this.options.cancelPermissionsForTurn?.({
                threadId: turn.threadId,
                turnId: turn.turnId,
                reason: turn.status,
            });
            thread.updatedAt = new Date().toISOString();
        }
    }
    emitLater(event) {
        setTimeout(() => this.options.emit(event), 0);
    }
    getThreadMessages(threadId) {
        let messages = this.#threadMessages.get(threadId);
        if (!messages) {
            messages = [];
            this.#threadMessages.set(threadId, messages);
        }
        return messages;
    }
    getThreadReadFileState(threadId) {
        let readFileState = this.#threadReadFileStates.get(threadId);
        if (!readFileState) {
            readFileState = createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE);
            this.#threadReadFileStates.set(threadId, readFileState);
        }
        return readFileState;
    }
    getThreadRuntimeState(threadId) {
        let runtimeState = this.#threadRuntimeStates.get(threadId);
        if (!runtimeState) {
            runtimeState = createThreadRuntimeState(this.getThreadMessages(threadId));
            this.#threadRuntimeStates.set(threadId, runtimeState);
        }
        return runtimeState;
    }
    resolveThread(threadId, options = {}) {
        const thread = threadId
            ? this.#threads.get(threadId)
            : Array.from(this.#threads.values()).at(-1);
        if (!thread && !options.allowMissing) {
            throw new CoreError('thread_not_found', 'Thread not found.');
        }
        return thread ?? null;
    }
    getLatestTurnForThread(threadId) {
        return Array.from(this.#turns.values())
            .filter(turn => turn.threadId === threadId)
            .at(-1);
    }
    createSyntheticTurn(thread) {
        const config = loadLlmConfig();
        const latestTurn = this.getLatestTurnForThread(thread.threadId);
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
            metadata: mergeTurnMetadata(createInitialTurnMetadata(config), latestTurn?.metadata),
        };
    }
    async recordThreadMessage(threadId, message) {
        const messages = this.getThreadMessages(threadId);
        messages.push(message);
        await this.persistThreadMessages(threadId);
        if (message.type === 'system' && message.subtype === 'compact_boundary') {
            const boundaryIndex = messages.length - 1;
            if (boundaryIndex > 0) {
                messages.splice(0, boundaryIndex);
            }
            const metadata = this.createContextMetadata(threadId);
            this.options.emit({
                type: 'context_compacted',
                threadId,
                compactedAt: typeof message.timestamp === 'string'
                    ? message.timestamp
                    : new Date().toISOString(),
                metadata,
                result: sanitizeCompactBoundaryMessage(message),
            });
        }
    }
    createContextMetadata(threadId) {
        const messages = this.getThreadMessages(threadId);
        const readFileState = this.getThreadReadFileState(threadId);
        const transcriptState = this.getThreadTranscriptState(threadId);
        const firstUserMessagePreview = getFirstUserMessagePreview(messages);
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
        };
    }
    createThreadTranscriptState(workspacePath) {
        const sessionId = randomUUID();
        return {
            sessionId,
            transcriptPath: join(getProjectDir(workspacePath), `${sessionId}.jsonl`),
            lastRecordedLength: 0,
            storageStatus: this.options.persistTranscripts === false ? 'disabled' : 'active',
        };
    }
    getThreadTranscriptState(threadId) {
        return this.#threadTranscriptStates.get(threadId);
    }
    async persistThreadMessages(threadId) {
        const transcriptState = this.getThreadTranscriptState(threadId);
        if (!transcriptState) {
            return;
        }
        if (this.options.persistTranscripts === false) {
            transcriptState.storageStatus = 'disabled';
            return;
        }
        const messages = this.getThreadMessages(threadId);
        if (messages.length === 0) {
            return;
        }
        const currentFirstUuid = getFirstMessageUuid(messages);
        const previousLength = transcriptState.lastRecordedLength;
        const wasFirstRecord = transcriptState.firstMessageUuid === undefined;
        const isIncremental = currentFirstUuid !== undefined &&
            !wasFirstRecord &&
            currentFirstUuid === transcriptState.firstMessageUuid &&
            previousLength <= messages.length;
        const isSameHeadShrink = currentFirstUuid !== undefined &&
            !wasFirstRecord &&
            currentFirstUuid === transcriptState.firstMessageUuid &&
            previousLength > messages.length;
        const startIndex = isIncremental ? previousLength : 0;
        if (startIndex === messages.length) {
            return;
        }
        const slice = startIndex === 0 ? messages : messages.slice(startIndex);
        const parentHint = isIncremental
            ? transcriptState.lastParentUuid
            : undefined;
        try {
            await this.activateTranscriptSession(transcriptState);
            const lastRecordedUuid = await recordTranscript(slice, {}, parentHint, messages);
            if (lastRecordedUuid && !isIncremental) {
                transcriptState.lastParentUuid = lastRecordedUuid;
            }
            if (isIncremental || wasFirstRecord || isSameHeadShrink) {
                const last = cleanMessagesForLogging(slice, messages).findLast(isChainParticipant);
                if (last) {
                    transcriptState.lastParentUuid = last.uuid;
                }
            }
            transcriptState.lastRecordedLength = messages.length;
            transcriptState.firstMessageUuid = currentFirstUuid;
            transcriptState.storageStatus = 'active';
            transcriptState.lastError = undefined;
        }
        catch (error) {
            transcriptState.storageStatus = 'failed';
            transcriptState.lastError =
                error instanceof Error ? error.message : String(error);
        }
    }
    async activateTranscriptSession(transcriptState) {
        if (this.#activeTranscriptSessionId === transcriptState.sessionId) {
            return;
        }
        switchSession(asSessionId(transcriptState.sessionId), dirname(transcriptState.transcriptPath));
        await resetSessionFilePointer();
        this.#activeTranscriptSessionId = transcriptState.sessionId;
    }
    markCurrentThread(threadId) {
        for (const thread of this.#threads.values()) {
            thread.status = thread.threadId === threadId ? 'active' : 'closed';
        }
    }
}
function cloneCoreTurnInput(input) {
    if (input.type === 'text') {
        return {
            type: 'text',
            text: input.text,
        };
    }
    return {
        type: 'content',
        text: input.text,
        content: input.content.map(cloneCoreUserContentBlock),
    };
}
function cloneCoreUserContentBlock(block) {
    if (block.type === 'text') {
        return {
            type: 'text',
            text: block.text,
        };
    }
    const cloned = {
        type: block.type,
    };
    if (block.attachmentId) {
        cloned.attachmentId = block.attachmentId;
    }
    if (block.displayName) {
        cloned.displayName = block.displayName;
    }
    if (block.mimeType) {
        cloned.mimeType = block.mimeType;
    }
    if (block.sizeBytes !== undefined) {
        cloned.sizeBytes = block.sizeBytes;
    }
    if (block.source) {
        cloned.source = { ...block.source };
    }
    return cloned;
}
function createId(prefix) {
    return `${prefix}_${randomUUID()}`;
}
function createLiteLogForTranscriptResume(input) {
    const now = new Date();
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
    };
}
function createThreadRuntimeState(messages) {
    return {
        nestedMemoryAttachmentTriggers: new Set(),
        loadedNestedMemoryPaths: new Set(),
        dynamicSkillDirTriggers: new Set(),
        discoveredSkillNames: new Set(),
        contentReplacementState: provisionContentReplacementState(messages),
    };
}
function isTurnCancelled(turn) {
    return turn.status === 'cancelled';
}
function createInitialTurnMetadata(config) {
    const profile = config.profiles[config.currentProfileId];
    const providerConfig = config.providers[config.provider];
    const builtinProvider = getBuiltinLlmProviderDefinition(config.provider);
    return compactTurnMetadata({
        provider: config.provider,
        providerDisplayName: builtinProvider?.displayName ??
            providerConfig?.displayName ??
            config.provider,
        profileId: profile?.id ?? config.currentProfileId,
        profileName: profile?.name,
        apiMode: profile?.apiMode ?? providerConfig?.apiMode,
        authStrategy: profile?.authStrategy ?? providerConfig?.authStrategy,
        model: config.model,
        requestedModel: config.model,
        contextWindow: resolveContextWindow(config),
    });
}
function resolveContextWindow(config) {
    try {
        const providerConfig = config.providers[config.provider];
        const providerDefinition = getBuiltinLlmProviderDefinition(config.provider) ??
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
            });
        return getLlmModelCatalogEntry({
            providerId: config.provider,
            model: config.model,
            providerDefinition,
        }).contextWindow;
    }
    catch {
        return undefined;
    }
}
function mergeTurnMetadata(...metadataList) {
    return compactTurnMetadata(Object.assign({}, ...metadataList));
}
function compactTurnMetadata(metadata) {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}
function computeLatencyMs(turn) {
    if (!turn.startedAt || !turn.completedAt) {
        return undefined;
    }
    const startedAt = Date.parse(turn.startedAt);
    const completedAt = Date.parse(turn.completedAt);
    if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
        return undefined;
    }
    return Math.max(0, completedAt - startedAt);
}
function messageToContextType(message) {
    if (message.type === 'user' && hasToolResult(message.message.content)) {
        return 'tool_result';
    }
    if (message.type === 'system' && message.subtype) {
        return `system:${message.subtype}`;
    }
    return message.type;
}
function deriveThreadTitleFromMessages(messages) {
    return deriveThreadTitleFromText(getFirstUserMessagePreview(messages));
}
function getFirstUserMessagePreview(messages) {
    for (const message of messages) {
        if (message.type !== 'user' || message.isMeta || message.isVirtual) {
            continue;
        }
        const text = extractMessageText(message.message.content);
        if (text) {
            return truncateTitle(text, 80);
        }
    }
    return undefined;
}
function deriveThreadTitleFromText(text) {
    if (typeof text !== 'string') {
        return undefined;
    }
    const normalized = normalizeThreadTitle(text);
    if (!normalized) {
        return undefined;
    }
    return truncateTitle(normalized, 32);
}
function normalizeThreadTitle(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized || undefined;
}
function truncateTitle(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
function isGenericThreadTitle(title) {
    return (title === 'CCR Desktop 会话' ||
        title === 'New thread' ||
        title === 'Resumed thread' ||
        title.startsWith('CCR Desktop 会话 '));
}
function extractMessageText(content) {
    if (typeof content === 'string') {
        return normalizeThreadTitle(content);
    }
    if (!Array.isArray(content)) {
        return undefined;
    }
    const text = content
        .map(block => {
        if (!block || typeof block !== 'object') {
            return '';
        }
        const textValue = block.text;
        if (typeof textValue === 'string') {
            return textValue;
        }
        const contentValue = block.content;
        return typeof contentValue === 'string' ? contentValue : '';
    })
        .filter(Boolean)
        .join(' ');
    return normalizeThreadTitle(text);
}
function hasToolResult(content) {
    return (Array.isArray(content) &&
        content.some(block => block &&
            typeof block === 'object' &&
            'type' in block &&
            block.type === 'tool_result'));
}
function isCompactBoundaryMessage(message) {
    return message.type === 'system' && message.subtype === 'compact_boundary';
}
function getLastCompactBoundaryTimestamp(messages) {
    return messages.findLast(isCompactBoundaryMessage)?.timestamp;
}
function getFirstMessageUuid(messages) {
    return messages[0]?.uuid;
}
function getLastPersistedParentUuid(messages) {
    const last = cleanMessagesForLogging([...messages], messages).findLast(isChainParticipant);
    return last?.uuid;
}
function redactTranscriptPath(transcriptPath) {
    return redactProjectStatePath(transcriptPath);
}
function redactProjectStatePath(statePath) {
    const relativePath = relative(getProjectsDir(), statePath);
    if (relativePath &&
        !relativePath.startsWith('..') &&
        !isAbsolute(relativePath)) {
        return `projects/${relativePath}`;
    }
    if (relativePath === '') {
        return 'projects';
    }
    return '[outside-project-state]';
}
function sanitizeContextAnalysis(data) {
    const messageBreakdown = data.messageBreakdown;
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
        categories: data.categories.map(category => compactObject({
            name: category.name,
            tokens: category.tokens,
            color: category.color,
            isDeferred: category.isDeferred,
        })),
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
                attachmentsByType: messageBreakdown.attachmentsByType.map(attachment => ({
                    name: attachment.name,
                    tokens: attachment.tokens,
                })),
            }
            : undefined,
    });
}
function sanitizeCompactBoundaryMessage(message) {
    const compactMetadata = typeof message.compactMetadata ===
        'object' &&
        message.compactMetadata !== null
        ? message.compactMetadata
        : undefined;
    return compactObject({
        trigger: asString(compactMetadata?.trigger),
        preTokens: asNumber(compactMetadata?.preTokens),
        messagesSummarized: asNumber(compactMetadata?.messagesSummarized),
        postTokens: asNumber(compactMetadata?.postTokens),
        truePostTokens: asNumber(compactMetadata?.truePostTokens),
        preservedSegment: compactMetadata?.preservedSegment !== undefined
            ? { available: true }
            : undefined,
    });
}
function asString(value) {
    return typeof value === 'string' ? value : undefined;
}
function asNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function sumTokens(items) {
    if (!items) {
        return undefined;
    }
    return items.reduce((total, item) => total + item.tokens, 0);
}
function dedupeThreadsBySession(threads) {
    const bySessionId = new Map();
    const withoutSessionId = [];
    for (const thread of threads) {
        const sessionId = getThreadMetadataString(thread, 'sessionId') ??
            getThreadMetadataString(thread, 'resumedFromSessionId');
        if (!sessionId) {
            withoutSessionId.push(thread);
            continue;
        }
        const existing = bySessionId.get(sessionId);
        if (!existing || compareThreadUpdatedAt(thread, existing) > 0) {
            bySessionId.set(sessionId, thread);
        }
    }
    return [...bySessionId.values(), ...withoutSessionId].sort((left, right) => compareThreadUpdatedAt(right, left));
}
function getThreadMetadataString(thread, key) {
    const value = thread.metadata[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function compareThreadUpdatedAt(left, right) {
    return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
}
function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined));
}
//# sourceMappingURL=sessionCore.js.map