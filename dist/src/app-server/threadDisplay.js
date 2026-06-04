import { projectThreadDisplayItem } from '../display/threadDisplayProjection.js';
import { assertThreadDisplayProjection } from '../display/threadDisplayProjectionSchema.js';
import { createDisplayFactMetadata, isThreadDisplayControlFact, isThreadDisplayMessageLikeFact, isThreadDisplaySystemFact, isThreadDisplayToolLikeFact, resolveThreadDisplayFacts, } from './threadDisplayFacts.js';
import { materializeGeneratedOutputImageBlocks } from './threadDisplayGeneratedOutputMaterializer.js';
import { appServerThreadMessagesToDisplayReducerInputEvents, assertThreadDisplayHistoryInputEvent, assertThreadDisplayRealtimeInputEvent, coreTurnEventToDisplayReducerInputEvent, } from './threadDisplayInputEvent.js';
import { createToolDisplayLifecycleReducer, normalizeToolUseIdFromBlock, } from './toolDisplayLifecycle.js';
const activeContextCompactionItemIds = new Map();
const liveThreadDisplayReducers = new Map();
function createEmptyThreadDisplayReducerState() {
    return {
        orderedItemIds: [],
        itemsById: new Map(),
        orderKeysByItemId: new Map(),
        displayIdBySourceIdentity: new Map(),
        toolLifecycleByToolUseId: new Map(),
        diagnostics: [],
        counts: {},
    };
}
export function buildThreadDisplaySnapshot(input) {
    const reducer = createThreadDisplayReducer({
        threadId: input.threadId,
        sessionId: input.sessionId,
    });
    const inputEvents = appServerThreadMessagesToDisplayReducerInputEvents(input.messages, {
        threadId: input.threadId,
        sessionId: input.sessionId,
    });
    return reducer.acceptMany(inputEvents).toSnapshot({
        source: input.source,
        rawTranscriptEvents: input.rawTranscriptEvents ?? input.messages.length,
        coreContextMessages: input.coreContextMessages ?? input.messages.length,
        canonicalLeafUuid: input.canonicalLeafUuid,
        diagnostics: input.diagnostics,
    });
}
export class ThreadDisplayReducer {
    context;
    toolLifecycle = createToolDisplayLifecycleReducer();
    state = createEmptyThreadDisplayReducerState();
    pendingPatchOperations = [];
    constructor(context) {
        this.context = context;
    }
    acceptMany(inputEvents) {
        this.resetState();
        this.toolLifecycle = createToolDisplayLifecycleReducer();
        for (const rawInputEvent of inputEvents) {
            const inputEvent = assertThreadDisplayHistoryInputEvent(rawInputEvent, 'ThreadDisplayReducer.acceptMany');
            this.recordInputDiagnostics(inputEvent);
            this.acceptHistoryInputEvent(inputEvent);
        }
        return this;
    }
    acceptOne(inputEvent) {
        const checkedInputEvent = assertThreadDisplayRealtimeInputEvent(inputEvent, 'ThreadDisplayReducer.acceptOne');
        this.recordInputDiagnostics(checkedInputEvent);
        const operations = this.acceptRealtimeInputEvent(checkedInputEvent);
        this.pendingPatchOperations.push(...operations);
        return this;
    }
    toSnapshotItems() {
        this.refreshStateCounts();
        return this.state.orderedItemIds
            .map(itemId => this.state.itemsById.get(itemId))
            .filter((item) => Boolean(item));
    }
    toSnapshot(input) {
        const items = this.toSnapshotItems();
        const diagnostics = [
            ...(input.diagnostics ?? []),
            ...this.getDiagnostics(),
            ...createProjectionProtocolDiagnostics(items, {
                source: input.source,
                owner: 'snapshot',
            }),
        ];
        const projectedDisplayItems = items.length;
        const visibleTimelineItems = countVisibleThreadDisplayItems(items);
        const hiddenDisplayItems = Math.max(0, projectedDisplayItems - visibleTimelineItems);
        const rawTranscriptEvents = input.rawTranscriptEvents ?? projectedDisplayItems;
        const filteredTranscriptEvents = Math.max(0, rawTranscriptEvents - projectedDisplayItems);
        return {
            threadId: this.context.threadId,
            ...(this.context.sessionId ? { sessionId: this.context.sessionId } : {}),
            source: input.source,
            generatedAt: new Date().toISOString(),
            ...(input.canonicalLeafUuid
                ? { canonicalLeafUuid: input.canonicalLeafUuid }
                : {}),
            items,
            counts: {
                rawTranscriptEvents,
                coreContextMessages: input.coreContextMessages ?? projectedDisplayItems,
                projectedDisplayItems,
                visibleTimelineItems,
                hiddenDisplayItems,
                filteredTranscriptEvents,
                hiddenTimelineItems: hiddenDisplayItems + filteredTranscriptEvents,
            },
            ...(diagnostics.length ? { diagnostics } : {}),
        };
    }
    consumePatchOperations() {
        const operations = this.pendingPatchOperations;
        this.pendingPatchOperations = [];
        return operations;
    }
    getDiagnostics() {
        return [...this.state.diagnostics];
    }
    recordInputDiagnostics(inputEvent) {
        for (const diagnostic of inputEvent.diagnostics) {
            this.state.diagnostics.push(threadDisplayInputDiagnosticToDisplayDiagnostic(diagnostic, inputEvent));
        }
    }
    acceptHistoryInputEvent(inputEvent) {
        for (const fact of resolveThreadDisplayFacts(inputEvent)) {
            this.acceptDisplayFact(fact, inputEvent);
        }
    }
    acceptDisplayFact(fact, inputEvent) {
        if (isThreadDisplayToolLikeFact(fact)) {
            return this.acceptToolLikeDisplayFact(fact, inputEvent);
        }
        if (isThreadDisplayMessageLikeFact(fact)) {
            const item = createMessageLikeDisplayItem(fact);
            if (!item.projection) {
                return null;
            }
            this.appendStateItem(item, inputEvent);
            return { op: 'append_item', item };
        }
        if (fact.factType === 'unsupported') {
            const item = createInputDiagnosticDisplayItem(inputEvent, fact);
            this.appendStateItem(item, inputEvent);
            return { op: 'append_item', item };
        }
        return null;
    }
    acceptToolLikeDisplayFact(fact, inputEvent) {
        const toolUseId = fact.toolUseId ?? normalizeToolUseIdFromBlock(fact.block);
        const hadToolUseId = Boolean(toolUseId && this.toolLifecycle.hasToolUseId(toolUseId));
        const existingToolItemId = toolUseId
            ? this.state.toolLifecycleByToolUseId.get(toolUseId)
            : undefined;
        const parentToolItemId = fact.parentToolUseId
            ? this.state.toolLifecycleByToolUseId.get(fact.parentToolUseId)
            : undefined;
        const existingItemId = parentToolItemId ?? (hadToolUseId ? existingToolItemId : undefined);
        const existingItem = existingItemId
            ? this.state.itemsById.get(existingItemId)
            : undefined;
        const state = this.toolLifecycle.accept({
            kind: fact.lifecycleKind,
            block: fact.block,
            source: fact.source,
        });
        const item = createToolLifecycleDisplayItem(fact.message, state, fact.identity.sourceIndex, existingItem, createToolLikeDisplayFactMetadata(fact, existingItem));
        if (existingItem) {
            this.replaceStateItem(item, inputEvent);
        }
        else {
            this.appendStateItem(item, inputEvent);
        }
        if (state.toolUseId) {
            this.state.toolLifecycleByToolUseId.set(state.toolUseId, item.id);
        }
        if (state.diagnostic) {
            return { op: 'append_item', item };
        }
        if (fact.lifecycleKind === 'tool_progress') {
            return { op: 'update_item', itemId: item.id, item };
        }
        if (fact.lifecycleKind === 'tool_result') {
            return {
                op: 'complete_item',
                itemId: item.id,
                status: state.status,
                item,
            };
        }
        if (existingItem || hadToolUseId) {
            return { op: 'update_item', itemId: item.id, item };
        }
        return { op: 'append_item', item };
    }
    resetState() {
        this.state = createEmptyThreadDisplayReducerState();
        this.pendingPatchOperations = [];
    }
    appendStateItem(item, inputEvent) {
        this.upsertStateItem(item, inputEvent);
    }
    replaceStateItem(item, inputEvent) {
        this.upsertStateItem(item, inputEvent);
    }
    upsertStateItem(item, inputEvent) {
        const itemId = item.id;
        const existed = this.state.itemsById.has(itemId);
        this.state.itemsById.set(itemId, item);
        if (!existed) {
            this.insertOrderedItemId(itemId, inputEvent.orderKey);
        }
        this.state.orderKeysByItemId.set(itemId, inputEvent.orderKey);
        this.bindSourceIdentityToItem(inputEvent.sourceIdentity, item);
        this.refreshStateCounts();
    }
    insertOrderedItemId(itemId, orderKey) {
        if (this.state.orderedItemIds.includes(itemId)) {
            return;
        }
        const insertAt = this.state.orderedItemIds.findIndex(existingItemId => {
            const existingOrderKey = this.state.orderKeysByItemId.get(existingItemId);
            return existingOrderKey
                ? compareThreadDisplayOrderKeys(orderKey, existingOrderKey) < 0
                : false;
        });
        if (insertAt === -1) {
            this.state.orderedItemIds.push(itemId);
            return;
        }
        this.state.orderedItemIds.splice(insertAt, 0, itemId);
    }
    bindSourceIdentityToItem(sourceIdentity, item) {
        const sourceToolUseId = sourceIdentity.kind === 'tool' ? sourceIdentity.toolUseId : undefined;
        const itemToolUseId = item.identity?.toolUseId;
        if (sourceIdentity.kind !== 'tool' ||
            !sourceToolUseId ||
            !itemToolUseId ||
            sourceToolUseId === itemToolUseId) {
            this.state.displayIdBySourceIdentity.set(getSourceIdentityKey(sourceIdentity), item.id);
        }
        if (itemToolUseId) {
            this.state.toolLifecycleByToolUseId.set(itemToolUseId, item.id);
        }
    }
    updateStateItem(itemId, patch) {
        const existingItem = this.state.itemsById.get(itemId);
        if (!existingItem) {
            return false;
        }
        this.state.itemsById.set(itemId, {
            ...existingItem,
            ...patch,
            identity: patch.identity ?? existingItem.identity,
            metadata: {
                ...(existingItem.metadata ?? {}),
                ...(patch.metadata ?? {}),
            },
        });
        this.refreshStateCounts();
        return true;
    }
    removeStateItem(itemId) {
        this.state.itemsById.delete(itemId);
        this.state.orderKeysByItemId.delete(itemId);
        this.state.orderedItemIds = this.state.orderedItemIds.filter(existingItemId => existingItemId !== itemId);
        for (const [key, displayItemId] of [
            ...this.state.displayIdBySourceIdentity.entries(),
        ]) {
            if (displayItemId === itemId) {
                this.state.displayIdBySourceIdentity.delete(key);
            }
        }
        for (const [toolUseId, displayItemId] of [
            ...this.state.toolLifecycleByToolUseId.entries(),
        ]) {
            if (displayItemId === itemId) {
                this.state.toolLifecycleByToolUseId.delete(toolUseId);
            }
        }
        this.refreshStateCounts();
    }
    refreshStateCounts() {
        const projectedDisplayItems = this.state.itemsById.size;
        const visibleTimelineItems = countVisibleThreadDisplayItems(this.state.orderedItemIds
            .map(itemId => this.state.itemsById.get(itemId))
            .filter((item) => Boolean(item)));
        this.state.counts = {
            ...this.state.counts,
            projectedDisplayItems,
            visibleTimelineItems,
            hiddenDisplayItems: Math.max(0, projectedDisplayItems - visibleTimelineItems),
        };
    }
    appendStateItemPatch(item, inputEvent) {
        this.appendStateItem(item, inputEvent);
        return { op: 'append_item', item };
    }
    completeStateItemPatch(itemId, status, item, inputEvent) {
        if (item) {
            this.replaceStateItem(item, inputEvent);
            return {
                op: 'complete_item',
                itemId,
                ...(status ? { status } : {}),
                item,
            };
        }
        if (this.updateStateItem(itemId, { status })) {
            return {
                op: 'complete_item',
                itemId,
                ...(status ? { status } : {}),
            };
        }
        return this.appendStateTargetDiagnosticPatch(inputEvent, itemId, 'complete_item');
    }
    updateStateItemPatch(itemId, item, inputEvent) {
        if (!this.updateStateItem(itemId, item)) {
            return this.appendStateTargetDiagnosticPatch(inputEvent, itemId, 'update_item');
        }
        return { op: 'update_item', itemId, item };
    }
    upsertStreamingDeltaPatch(itemId, item, inputEvent) {
        if (!this.updateStateItem(itemId, item)) {
            this.appendStateItem(createProjectedDisplayItem({
                id: itemId,
                type: item.type ?? 'assistant_message',
                text: item.text ?? '',
                ...(item.status ? { status: item.status } : {}),
                identity: {
                    threadId: inputEvent.threadId,
                    ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
                    ...(inputEvent.turnId ? { turnId: inputEvent.turnId } : {}),
                    itemId,
                },
                content: typeof item.text === 'string'
                    ? [{ type: 'text', text: item.text }]
                    : undefined,
                metadata: item.metadata,
            }), inputEvent);
        }
        return { op: 'update_item', itemId, item };
    }
    appendStateTargetDiagnosticPatch(inputEvent, targetItemId, operation) {
        const fact = resolveThreadDisplayFacts(inputEvent)[0];
        const diagnostic = {
            level: 'error',
            code: 'thread_display_orphan_state_update',
            message: `展示状态更新找不到目标项：${targetItemId}`,
            details: {
                operation,
                targetItemId,
                source: inputEvent.source,
                inputKind: inputEvent.kind,
                sourceIdentityKind: inputEvent.sourceIdentity.kind,
                sourceId: inputEvent.sourceIdentity.sourceId,
            },
        };
        this.state.diagnostics.push(diagnostic);
        const item = createStateDiagnosticDisplayItem(inputEvent, diagnostic, fact);
        this.appendStateItem(item, inputEvent);
        return { op: 'append_item', item };
    }
    acceptRealtimeInputEvent(inputEvent) {
        const event = inputEvent.raw.event;
        const facts = resolveThreadDisplayFacts(inputEvent);
        const firstFact = facts[0];
        if (inputEvent.payload.type === 'unsupported') {
            return facts
                .map(fact => this.acceptDisplayFact(fact, inputEvent))
                .filter((operation) => operation !== null);
        }
        switch (event.type) {
            case 'item_started':
                {
                    const toolOperations = facts
                        .filter(isThreadDisplayToolLikeFact)
                        .map(fact => this.acceptDisplayFact(fact, inputEvent))
                        .filter((operation) => operation !== null);
                    if (toolOperations.length > 0) {
                        return toolOperations;
                    }
                    const item = coreItemToThreadDisplayItem(event.item, facts.find(isThreadDisplayMessageLikeFact));
                    return item.projection ? [this.appendStateItemPatch(item, inputEvent)] : [];
                }
            case 'item_delta':
                if (isThinkingContentBlock(event.delta)) {
                    return [];
                }
                {
                    const toolOperations = facts
                        .filter(isThreadDisplayToolLikeFact)
                        .map(fact => this.acceptDisplayFact(fact, inputEvent))
                        .filter((operation) => operation !== null);
                    if (toolOperations.length > 0) {
                        return toolOperations;
                    }
                }
                {
                    const operation = this.upsertStreamingDeltaPatch(event.itemId, {
                        type: getThreadDisplayItemTypeFromDelta(event.delta),
                        status: 'streaming',
                        text: getCoreDeltaDisplayText(event.delta),
                        metadata: {
                            coreEventType: event.type,
                            deltaMode: 'append_text',
                            delta: event.delta,
                            ...(firstFact ? createDisplayFactMetadata(firstFact) : {}),
                        },
                    }, inputEvent);
                    return operation ? [operation] : [];
                }
            case 'item_completed':
                {
                    const toolFacts = facts.filter(isThreadDisplayToolLikeFact);
                    if (toolFacts.length > 0) {
                        const toolOperations = toolFacts
                            .filter(fact => {
                            if (fact.lifecycleKind !== 'tool_use') {
                                return true;
                            }
                            const toolUseId = fact.toolUseId ?? normalizeToolUseIdFromBlock(fact.block);
                            return !toolUseId || !this.toolLifecycle.hasToolUseId(toolUseId);
                        })
                            .map(fact => this.acceptDisplayFact(fact, inputEvent))
                            .filter((operation) => operation !== null);
                        return toolOperations;
                    }
                    const item = completedCoreItemToThreadDisplayItem(event, facts.find(isThreadDisplayMessageLikeFact));
                    return item?.projection
                        ? [
                            this.completeStateItemPatch(event.itemId, event.status, item, inputEvent),
                        ].filter((operation) => operation !== null)
                        : [];
                }
            case 'turn_failed':
                return [
                    this.appendStateItemPatch(createProjectedDisplayItem({
                        id: `${event.turnId}:error`,
                        type: 'error',
                        text: extractDisplayText(event.error) || '当前 turn 失败。',
                        status: 'failed',
                        identity: {
                            threadId: event.threadId,
                            turnId: event.turnId,
                            itemId: `${event.turnId}:error`,
                        },
                        content: event.error,
                        metadata: {
                            coreEventType: event.type,
                            ...(event.metadata ?? {}),
                            ...(firstFact ? createDisplayFactMetadata(firstFact) : {}),
                        },
                    }), inputEvent),
                ];
            case 'context_compaction_started':
                return [
                    this.appendStateItemPatch(createContextCompactionStartedItem(event, facts.find(isThreadDisplaySystemFact)), inputEvent),
                ];
            case 'context_compacted':
                {
                    const itemId = getContextCompactedDisplayItemId(event);
                    const operation = this.completeStateItemPatch(itemId, 'completed', createContextCompactedItem(event, itemId, facts.find(isThreadDisplaySystemFact)), inputEvent);
                    return operation ? [operation] : [];
                }
            case 'permission_requested':
                {
                    const controlFact = facts.find(isThreadDisplayControlFact);
                    return [
                        this.appendStateItemPatch(createPermissionRequestedItem(event, controlFact), inputEvent),
                    ];
                }
            case 'permission_cancelled':
                {
                    const controlFact = facts.find(isThreadDisplayControlFact);
                    const operation = this.updateStateItemPatch(controlFact?.itemId ?? event.permissionRequestId, {
                        status: 'cancelled',
                        metadata: {
                            coreEventType: event.type,
                            reason: event.reason,
                            ...(controlFact ? createDisplayFactMetadata(controlFact) : {}),
                        },
                    }, inputEvent);
                    return operation ? [operation] : [];
                }
            case 'thread_started':
            case 'turn_started':
            case 'turn_completed':
            case 'turn_cancelled':
                return [];
        }
    }
}
export function createThreadDisplayReducer(context) {
    return new ThreadDisplayReducer(context);
}
function compareThreadDisplayOrderKeys(left, right) {
    if (left.source !== right.source) {
        return left.source === 'history' ? -1 : 1;
    }
    if (left.ordinal !== right.ordinal) {
        return left.ordinal - right.ordinal;
    }
    const leftTimestamp = left.timestamp ?? '';
    const rightTimestamp = right.timestamp ?? '';
    if (leftTimestamp !== rightTimestamp) {
        return leftTimestamp.localeCompare(rightTimestamp);
    }
    return (left.itemId ?? '').localeCompare(right.itemId ?? '');
}
function getSourceIdentityKey(sourceIdentity) {
    return `${sourceIdentity.kind}:${sourceIdentity.sourceId}`;
}
function threadDisplayInputDiagnosticToDisplayDiagnostic(diagnostic, inputEvent) {
    return {
        level: 'error',
        code: diagnostic.code,
        message: diagnostic.message,
        details: {
            ...(diagnostic.details ?? {}),
            source: inputEvent.source,
            payloadType: inputEvent.payload.type,
            sourceIdentityKind: inputEvent.sourceIdentity.kind,
            sourceId: inputEvent.sourceIdentity.sourceId,
        },
    };
}
function createInputDiagnosticDisplayItem(inputEvent, fact) {
    const diagnostic = inputEvent.diagnostics[0] ??
        {
            code: 'thread_display_input_diagnostic',
            message: '展示输入协议诊断。',
        };
    const displayDiagnostic = threadDisplayInputDiagnosticToDisplayDiagnostic(diagnostic, inputEvent);
    const itemId = `diagnostic:${inputEvent.sourceIdentity.sourceId}`;
    const text = `展示协议错误（protocol error）：${displayDiagnostic.message}`;
    return createProjectedDisplayItem({
        id: itemId,
        type: 'error',
        text,
        status: 'diagnostic',
        sourceKind: 'thread_display_input_diagnostic',
        identity: {
            threadId: inputEvent.threadId,
            ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
            ...('turnId' in inputEvent && inputEvent.turnId
                ? { turnId: inputEvent.turnId }
                : {}),
            itemId,
        },
        content: [{ type: 'text', text }],
        metadata: {
            inputDiagnostic: displayDiagnostic,
            orderKey: inputEvent.orderKey,
            sourceIdentity: inputEvent.sourceIdentity,
            ...(fact ? createDisplayFactMetadata(fact) : {}),
        },
    });
}
function createStateDiagnosticDisplayItem(inputEvent, diagnostic, fact) {
    const itemId = `diagnostic:${inputEvent.sourceIdentity.sourceId}:state`;
    const text = `展示状态诊断：${diagnostic.message}`;
    return createProjectedDisplayItem({
        id: itemId,
        type: 'error',
        text,
        status: 'diagnostic',
        sourceKind: 'thread_display_state_diagnostic',
        identity: {
            threadId: inputEvent.threadId,
            ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
            ...(inputEvent.turnId ? { turnId: inputEvent.turnId } : {}),
            itemId,
        },
        content: [{ type: 'text', text }],
        metadata: {
            stateDiagnostic: diagnostic,
            orderKey: inputEvent.orderKey,
            sourceIdentity: inputEvent.sourceIdentity,
            ...(fact ? createDisplayFactMetadata(fact) : {}),
        },
    });
}
function createToolLikeDisplayFactMetadata(fact, existingItem) {
    const metadata = createDisplayFactMetadata(fact);
    const existingDisplayFact = getMetadataObject(existingItem?.metadata, 'displayFact');
    if (fact.lifecycleKind !== 'tool_use' &&
        existingDisplayFact?.factType === 'file') {
        metadata.displayFact = {
            ...existingDisplayFact,
            inputKind: fact.inputKind,
            orderKey: fact.orderKey,
            contentIndex: fact.contentIndex,
            parentToolUseId: fact.parentToolUseId,
        };
    }
    if (fact.completedAt) {
        metadata.completedAt = fact.completedAt;
    }
    if (fact.durationMs !== undefined) {
        metadata.durationMs = fact.durationMs;
    }
    return metadata;
}
function createDisplayFactMetadataWithoutContent(fact) {
    const metadata = createDisplayFactMetadata(fact);
    delete metadata.primaryBlock;
    delete metadata.attachmentBlocks;
    return metadata;
}
function getMetadataObject(metadata, key) {
    const value = metadata?.[key];
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function createMessageLikeDisplayItem(fact) {
    const fallbackText = fact.factType === 'error' || fact.factType === 'system'
        ? fact.text
        : extractDisplayText(fact.blocks);
    const message = fact.message ??
        {
            id: fact.itemId,
            role: fact.factType === 'error' ? 'error' : 'system',
            text: fallbackText,
            content: fact.blocks,
        };
    return threadMessageToDisplayItem(message, {
        threadId: fact.threadId,
        ...(fact.sessionId ? { sessionId: fact.sessionId } : {}),
        sourceIndex: fact.identity.sourceIndex ?? 0,
        ...(fact.contentIndex !== undefined ? { contentIndex: fact.contentIndex } : {}),
        displayFact: fact,
    });
}
function createToolLifecycleDisplayItem(message, state, fallbackSourceIndex, existingItem, extraMetadata) {
    const isDiagnostic = Boolean(state.diagnostic);
    const content = isDiagnostic
        ? [{ type: 'text', text: state.diagnostic?.message ?? '工具结果诊断。' }]
        : createToolLifecycleItemContent(state);
    const primaryBlock = !isDiagnostic && isCoreJsonObject(content[0]) ? content[0] : undefined;
    const sourceIndex = state.firstSeen.rawIndex ?? fallbackSourceIndex;
    const contentIndex = state.firstSeen.contentIndex;
    const itemId = existingItem?.id ?? state.itemId;
    const startedAt = state.firstSeen.createdAt ?? existingItem?.createdAt ?? message.createdAt;
    const lifecycleMetadata = createToolLifecycleTimingMetadata(state, startedAt, extraMetadata);
    return createProjectedDisplayItem({
        base: existingItem,
        id: itemId,
        type: isDiagnostic
            ? 'error'
            : getSpecificThreadDisplayItemTypeFromUnknownContent(content) ??
                'tool_call',
        text: state.diagnostic?.message ?? extractDisplayText(content),
        status: state.status,
        sourceKind: state.diagnostic ? 'tool_result_diagnostic' : 'tool_lifecycle',
        ...(startedAt ? { createdAt: startedAt } : {}),
        identity: {
            ...(existingItem?.identity ?? {}),
            threadId: state.firstSeen.threadId,
            ...(state.firstSeen.sessionId
                ? { sessionId: state.firstSeen.sessionId }
                : {}),
            ...(state.firstSeen.turnId ? { turnId: state.firstSeen.turnId } : {}),
            itemId,
            messageUuid: state.firstSeen.messageUuid ?? message.id,
            ...(state.firstSeen.parentUuid !== undefined
                ? { parentUuid: state.firstSeen.parentUuid }
                : {}),
            ...(state.toolUseId ? { toolUseId: state.toolUseId } : {}),
            ...(sourceIndex !== undefined
                ? {
                    sourceIndex,
                    rawIndex: sourceIndex,
                }
                : {}),
            ...(state.firstSeen.materializedIndex !== undefined ||
                sourceIndex !== undefined
                ? {
                    materializedIndex: state.firstSeen.materializedIndex ?? sourceIndex,
                }
                : {}),
            ...(contentIndex !== undefined ? { contentIndex } : {}),
        },
        content,
        metadata: {
            ...(existingItem?.metadata ?? {}),
            role: message.role,
            sourceType: message.sourceType,
            ...lifecycleMetadata,
            toolLifecycle: state,
            ...(!isDiagnostic && primaryBlock ? { primaryBlock } : {}),
        },
    });
}
function createToolLifecycleTimingMetadata(state, startedAt, extraMetadata) {
    const metadata = { ...(extraMetadata ?? {}) };
    const completedAt = getStringValue(extraMetadata, ['completedAt', 'completed_at']);
    const durationMs = startedAt && completedAt
        ? undefined
        : getNumberValue(extraMetadata, [
            'durationMs',
            'duration_ms',
            'elapsedTimeMs',
            'elapsed_ms',
        ]);
    if (startedAt && completedAt) {
        delete metadata.durationMs;
        delete metadata.duration_ms;
        delete metadata.elapsedTimeMs;
        delete metadata.elapsed_ms;
    }
    return {
        ...metadata,
        ...(startedAt ? { startedAt } : {}),
        ...(state.lastSeen.createdAt ? { lastSeenAt: state.lastSeen.createdAt } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
    };
}
function createToolLifecycleItemContent(state) {
    if (state.callBlock) {
        const completedAt = getStringValue(state.resultBlock, [
            'completedAt',
            'completed_at',
            'endedAt',
            'ended_at',
            'endTime',
            'end_time',
        ]);
        const durationMs = getNumberValue(state.resultBlock, [
            'durationMs',
            'duration_ms',
            'elapsedTimeMs',
            'elapsed_ms',
        ]);
        return [
            {
                ...state.callBlock,
                historyStatus: state.status,
                status: state.status,
                ...(state.progressBlock ? { progress: state.progressBlock } : {}),
                ...(state.resultBlock
                    ? { result: createToolUseDisplayResult(state.resultBlock) }
                    : {}),
                ...(completedAt ? { completedAt } : {}),
                ...(durationMs !== undefined ? { durationMs } : {}),
            },
        ];
    }
    return state.resultBlock ? [state.resultBlock] : [];
}
function createToolUseDisplayResult(resultBlock) {
    const displayOutput = getGeneratedOutputBlocksFromToolResult(resultBlock);
    if (displayOutput.length === 0) {
        return resultBlock.content;
    }
    const content = resultBlock.content;
    if (Array.isArray(content)) {
        return appendMissingGeneratedOutputBlocks(content, displayOutput);
    }
    if (typeof content === 'string' && content.trim()) {
        return [{ type: 'text', text: content }, ...displayOutput];
    }
    return displayOutput;
}
function getGeneratedOutputBlocksFromToolResult(resultBlock) {
    const result = isCoreJsonObject(resultBlock.result) ? resultBlock.result : undefined;
    const output = Array.isArray(result?.output) ? result.output : [];
    return output.filter((block) => isCoreJsonObject(block) && isGeneratedAttachmentBlock(block));
}
function appendMissingGeneratedOutputBlocks(content, output) {
    const existingIds = new Set(content
        .filter(isCoreJsonObject)
        .map(getGeneratedOutputBlockKey)
        .filter((key) => Boolean(key)));
    const missingOutput = output.filter(block => {
        const key = getGeneratedOutputBlockKey(block);
        return !key || !existingIds.has(key);
    });
    return missingOutput.length > 0 ? [...content, ...missingOutput] : [...content];
}
function isGeneratedAttachmentBlock(block) {
    return (block.type === 'image' ||
        block.type === 'file' ||
        block.type === 'audio' ||
        block.type === 'video');
}
function getGeneratedOutputBlockKey(block) {
    return getStringValue(block, ['outputId', 'attachmentId', 'savedPath']);
}
function getMessageJsonBlocks(message) {
    if (!Array.isArray(message.content)) {
        return [];
    }
    return message.content.filter(isCoreJsonObject);
}
function countVisibleThreadDisplayItems(items) {
    return items.filter(item => item.timelineHidden !== true).length;
}
function threadMessageToDisplayItem(message, context) {
    const content = sanitizeThreadDisplayContent(message.content, {
        materializeGeneratedOutputImages: message.role === 'assistant',
    });
    if (isThinkingOnlyContent(message.content) &&
        message.role === 'assistant') {
        return createReasoningOnlyNoticeItem({
            id: message.id,
            text: message.text,
            status: message.status,
            sourceKind: message.kind,
            createdAt: message.createdAt,
            identity: {
                threadId: context.threadId,
                ...(context.sessionId ? { sessionId: context.sessionId } : {}),
                itemId: message.id,
                messageUuid: message.id,
                sourceIndex: context.sourceIndex,
                rawIndex: context.sourceIndex,
                materializedIndex: context.sourceIndex,
                ...(context.contentIndex !== undefined
                    ? { contentIndex: context.contentIndex }
                    : {}),
            },
            metadata: {
                role: message.role,
                ...(message.sourceType ? { sourceType: message.sourceType } : {}),
                ...(context.displayFact
                    ? createDisplayFactMetadataWithoutContent(context.displayFact)
                    : {}),
            },
        });
    }
    return createProjectedDisplayItem({
        id: message.id,
        type: getThreadDisplayItemType({
            ...message,
            ...(content !== undefined ? { content } : {}),
        }),
        text: extractDisplayText(content ?? message.text),
        ...(message.status ? { status: message.status } : {}),
        ...(message.kind ? { sourceKind: message.kind } : {}),
        ...(message.createdAt ? { createdAt: message.createdAt } : {}),
        identity: {
            threadId: context.threadId,
            ...(context.sessionId ? { sessionId: context.sessionId } : {}),
            itemId: message.id,
            messageUuid: message.id,
            sourceIndex: context.sourceIndex,
            rawIndex: context.sourceIndex,
            materializedIndex: context.sourceIndex,
            ...(context.contentIndex !== undefined
                ? { contentIndex: context.contentIndex }
                : {}),
        },
        ...(content !== undefined ? { content } : {}),
        metadata: {
            role: message.role,
            ...(message.sourceType ? { sourceType: message.sourceType } : {}),
            ...(context.displayFact ? createDisplayFactMetadata(context.displayFact) : {}),
        },
    });
}
function getThreadDisplayItemType(message) {
    const contentType = getSpecificThreadDisplayItemTypeFromUnknownContent(message.content);
    if (contentType) {
        return contentType;
    }
    if (message.role === 'user') {
        return 'user_message';
    }
    if (message.role === 'assistant') {
        return 'assistant_message';
    }
    if (message.role === 'error') {
        return 'error';
    }
    if (message.kind === 'thinking-event') {
        return 'thinking_summary';
    }
    if (message.kind === 'tool-event') {
        return 'tool_result';
    }
    return 'system_notice';
}
function getSpecificThreadDisplayItemTypeFromUnknownContent(content) {
    if (!Array.isArray(content)) {
        return undefined;
    }
    const blocks = content.filter(isCoreJsonObject);
    const type = getThreadDisplayItemTypeFromContent(blocks);
    return type === 'assistant_message' ? undefined : type;
}
export function coreEventToThreadDisplayPatch(event) {
    const inputEvent = coreTurnEventToDisplayReducerInputEvent(event);
    const threadId = inputEvent.threadId;
    if (!threadId) {
        return null;
    }
    if (event.type === 'thread_started') {
        clearLiveThreadDisplayReducersForThread(event.thread.threadId);
        return null;
    }
    const reducer = getLiveThreadDisplayReducer(inputEvent);
    const operations = reducer.acceptOne(inputEvent).consumePatchOperations();
    if (event.type === 'turn_completed' ||
        event.type === 'turn_failed' ||
        event.type === 'turn_cancelled') {
        clearLiveThreadDisplayReducer(threadId, event.turnId);
    }
    if (operations.length === 0) {
        return null;
    }
    return {
        threadId,
        generatedAt: new Date().toISOString(),
        operations,
        ...createPatchDiagnostics(operations),
    };
}
function createPatchDiagnostics(operations) {
    const items = operations.flatMap(operation => {
        if (operation.op === 'append_item' || operation.op === 'replace_active_stream') {
            return operation.item ? [operation.item] : [];
        }
        if (operation.op === 'complete_item') {
            return operation.item ? [operation.item] : [];
        }
        if (operation.op === 'update_item') {
            return operation.item.id && operation.item.type && operation.item.text !== undefined
                ? [operation.item]
                : [];
        }
        return [];
    });
    const diagnostics = createProjectionProtocolDiagnostics(items, {
        source: 'live',
        owner: 'patch',
    });
    return diagnostics.length ? { diagnostics } : {};
}
function createProjectionProtocolDiagnostics(items, context) {
    return items
        .filter(item => !item.projection)
        .map(item => ({
        level: 'error',
        code: 'thread_display_item_missing_projection',
        message: `ThreadDisplay ${context.owner} item is missing projection.`,
        details: summarizeProjectionProtocolItem(item, context),
    }));
}
function summarizeProjectionProtocolItem(item, context) {
    const metadata = item.metadata ?? {};
    return compactJsonObject({
        owner: context.owner,
        source: context.source,
        itemId: item.id,
        itemType: item.type,
        sourceKind: item.sourceKind,
        status: item.status,
        createdAt: item.createdAt,
        hasContent: item.content !== undefined,
        hasProjection: Boolean(item.projection),
        textPreview: item.text.slice(0, 240),
        identity: item.identity,
        coreEventType: typeof metadata.coreEventType === 'string'
            ? metadata.coreEventType
            : undefined,
        displayReason: typeof metadata.displayReason === 'string'
            ? metadata.displayReason
            : undefined,
        metadataKeys: Object.keys(metadata),
        contentShape: summarizeContentShape(item.content),
    });
}
function summarizeContentShape(content) {
    if (Array.isArray(content)) {
        return {
            kind: 'array',
            length: content.length,
            firstType: isCoreJsonObject(content[0]) ? content[0].type : undefined,
        };
    }
    return {
        kind: content === undefined ? 'undefined' : typeof content,
    };
}
function getLiveThreadDisplayReducer(inputEvent) {
    const key = getLiveThreadDisplayReducerKey(inputEvent);
    let reducer = liveThreadDisplayReducers.get(key);
    if (!reducer) {
        reducer = createThreadDisplayReducer({
            threadId: inputEvent.threadId,
            ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
        });
        liveThreadDisplayReducers.set(key, reducer);
    }
    return reducer;
}
function clearLiveThreadDisplayReducer(threadId, turnId) {
    liveThreadDisplayReducers.delete(`${threadId}:${turnId}`);
}
function clearLiveThreadDisplayReducersForThread(threadId) {
    const prefix = `${threadId}:`;
    for (const key of liveThreadDisplayReducers.keys()) {
        if (key.startsWith(prefix)) {
            liveThreadDisplayReducers.delete(key);
        }
    }
}
function getLiveThreadDisplayReducerKey(inputEvent) {
    return `${inputEvent.threadId}:${inputEvent.turnId ?? '__thread__'}`;
}
function getCoreJsonBlocksFromUnknownContent(content) {
    return Array.isArray(content) ? content.filter(isCoreJsonObject) : [];
}
function coreItemToThreadDisplayItem(item, fact) {
    const content = sanitizeThreadDisplayContent(item.content, {
        materializeGeneratedOutputImages: item.kind === 'assistant_message',
    });
    if (isThinkingOnlyContent(item.content) && item.kind === 'assistant_message') {
        return createReasoningOnlyNoticeItem({
            id: item.itemId,
            text: extractDisplayText(item.content),
            status: item.status,
            sourceKind: item.kind,
            createdAt: getStringField(item, ['startedAt', 'createdAt']),
            identity: {
                threadId: item.threadId,
                turnId: item.turnId,
                itemId: item.itemId,
                toolUseId: getStringField(item, ['toolUseId', 'toolUseID', 'tool_use_id']),
            },
            metadata: {
                coreEventType: 'item_started',
                ...(fact ? createDisplayFactMetadataWithoutContent(fact) : {}),
            },
        });
    }
    return createProjectedDisplayItem({
        id: item.itemId,
        type: getThreadDisplayItemTypeFromKind(item.kind),
        text: extractDisplayText(content ?? item.text ?? item.summary),
        status: item.status,
        sourceKind: item.kind,
        createdAt: getStringField(item, ['startedAt', 'createdAt']),
        identity: {
            threadId: item.threadId,
            turnId: item.turnId,
            itemId: item.itemId,
            toolUseId: getStringField(item, ['toolUseId', 'toolUseID', 'tool_use_id']),
        },
        ...(content !== undefined ? { content } : {}),
        metadata: {
            coreEventType: 'item_started',
            ...(fact ? createDisplayFactMetadata(fact) : {}),
        },
    });
}
function completedCoreItemToThreadDisplayItem(event, fact) {
    const contentBlocks = getCoreJsonBlocksFromUnknownContent(event.content);
    const content = sanitizeCoreJsonBlocks(contentBlocks, {
        materializeGeneratedOutputImages: event.kind === 'assistant_message',
    });
    if (isThinkingOnlyContent(event.content) && event.kind === 'assistant_message') {
        return createReasoningOnlyNoticeItem({
            id: event.itemId,
            text: extractDisplayText(event.content),
            status: event.status,
            sourceKind: event.kind,
            createdAt: event.startedAt,
            identity: {
                threadId: event.threadId,
                turnId: event.turnId,
                itemId: event.itemId,
                toolUseId: getToolUseIdFromContent(event.content),
            },
            metadata: {
                coreEventType: event.type,
                ...(event.completedAt ? { completedAt: event.completedAt } : {}),
                ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
                ...(fact ? createDisplayFactMetadataWithoutContent(fact) : {}),
            },
        });
    }
    const type = getCompletedThreadDisplayItemType({
        ...event,
        content: content ?? [],
    });
    if (!type) {
        return null;
    }
    return createProjectedDisplayItem({
        id: event.itemId,
        type,
        text: extractDisplayText(content),
        status: event.status,
        ...(event.kind ? { sourceKind: event.kind } : {}),
        createdAt: event.startedAt,
        identity: {
            threadId: event.threadId,
            turnId: event.turnId,
            itemId: event.itemId,
            toolUseId: getToolUseIdFromContent(content),
        },
        ...(content !== undefined ? { content } : {}),
        metadata: {
            coreEventType: event.type,
            ...(event.completedAt ? { completedAt: event.completedAt } : {}),
            ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
            ...(fact ? createDisplayFactMetadata(fact) : {}),
        },
    });
}
function createProjectedDisplayItem(input) {
    return withThreadDisplayProjection({
        ...(input.base ?? {}),
        id: input.id,
        type: input.type,
        text: input.text,
        ...(input.status ? { status: input.status } : {}),
        ...(input.sourceKind ? { sourceKind: input.sourceKind } : {}),
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        ...(input.timelineHidden !== undefined
            ? { timelineHidden: input.timelineHidden }
            : {}),
        ...(input.identity ? { identity: input.identity } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
    });
}
function getCompletedThreadDisplayItemType(event) {
    if (event.kind) {
        return getThreadDisplayItemTypeFromKind(event.kind);
    }
    const type = getThreadDisplayItemTypeFromContent(event.content);
    return type === 'assistant_message' ? undefined : type;
}
function sanitizeThreadDisplayContent(content, options = {}) {
    if (!Array.isArray(content)) {
        return content;
    }
    return sanitizeCoreJsonBlocks(content.filter(isCoreJsonObject), options);
}
function sanitizeCoreJsonBlocks(content, options = {}) {
    const displayBlocks = content.filter(block => !isThinkingContentBlock(block));
    if (displayBlocks.length === 0) {
        return undefined;
    }
    return options.materializeGeneratedOutputImages
        ? materializeGeneratedOutputImageBlocks(displayBlocks)
        : displayBlocks;
}
function isThinkingOnlyContent(content) {
    return (Array.isArray(content) &&
        content.length > 0 &&
        content.every(isThinkingContentBlock));
}
function isThinkingContentBlock(block) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
        return false;
    }
    const type = block.type;
    return (type === 'thinking' ||
        type === 'redacted_thinking' ||
        type === 'reasoning' ||
        type === 'thinking_summary' ||
        type === 'reasoning_summary' ||
        type === 'summary_text');
}
function createReasoningOnlyNoticeItem(input) {
    return createProjectedDisplayItem({
        id: input.id,
        type: 'system_notice',
        text: '模型只返回了推理内容，未返回最终回复。',
        timelineHidden: true,
        ...(input.status ? { status: input.status } : {}),
        ...(input.sourceKind ? { sourceKind: input.sourceKind } : {}),
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        ...(input.identity ? { identity: input.identity } : {}),
        metadata: {
            ...(input.metadata ?? {}),
            displayReason: 'reasoning_only_without_final_response',
        },
    });
}
function withThreadDisplayProjection(item) {
    const projection = projectThreadDisplayItem(item);
    const validatedProjection = projection
        ? assertThreadDisplayProjection(projection, `ThreadDisplayItem ${item.id}`)
        : undefined;
    const timelineHidden = item.timelineHidden ?? validatedProjection?.event?.timelineHidden;
    return {
        ...item,
        ...(timelineHidden !== undefined ? { timelineHidden } : {}),
        ...(validatedProjection ? { projection: validatedProjection } : {}),
    };
}
function getCoreEventThreadId(event) {
    switch (event.type) {
        case 'thread_started':
            return event.thread.threadId;
        case 'item_started':
            return event.item.threadId;
        case 'permission_requested':
            return event.request.threadId;
        case 'item_delta':
        case 'item_completed':
        case 'turn_started':
        case 'turn_completed':
        case 'turn_failed':
        case 'turn_cancelled':
        case 'context_compaction_started':
        case 'context_compacted':
        case 'permission_cancelled':
            return event.threadId;
    }
}
function createContextCompactionStartedItem(event, fact) {
    const itemId = getContextCompactionStartedDisplayItemId(event);
    activeContextCompactionItemIds.set(event.threadId, itemId);
    const text = event.trigger === 'auto'
        ? '正在自动压缩上下文，完成后会继续当前任务。'
        : '正在压缩上下文，完成后会刷新当前会话上下文。';
    const compactSnapshot = compactJsonObject({
        status: 'running',
        trigger: event.trigger,
        startedAt: event.startedAt,
    });
    return createProjectedDisplayItem({
        id: itemId,
        type: 'system_notice',
        text,
        status: 'running',
        sourceKind: 'context_compaction',
        createdAt: event.startedAt,
        identity: {
            threadId: event.threadId,
            ...(event.turnId ? { turnId: event.turnId } : {}),
            itemId,
        },
        content: [{ type: 'text', text }],
        metadata: compactJsonObject({
            coreEventType: event.type,
            compactSnapshot,
            ...(fact ? createDisplayFactMetadata(fact) : {}),
        }),
    });
}
function createContextCompactedItem(event, itemId, fact) {
    const compactSnapshot = createContextCompactSnapshot(event);
    const text = formatContextCompactedText(compactSnapshot);
    return createProjectedDisplayItem({
        id: itemId,
        type: 'system_notice',
        text,
        status: 'completed',
        sourceKind: 'context_compaction',
        createdAt: event.compactedAt,
        identity: {
            threadId: event.threadId,
            itemId,
        },
        content: [{ type: 'text', text }],
        metadata: compactJsonObject({
            coreEventType: event.type,
            compactSnapshot,
            compactResult: event.result,
            ...(fact ? createDisplayFactMetadata(fact) : {}),
        }),
    });
}
function createPermissionRequestedItem(event, fact) {
    return createProjectedDisplayItem({
        id: fact?.itemId ?? event.request.permissionRequestId,
        type: 'permission_request',
        text: fact?.text ??
            `权限请求：${event.request.tool.displayName ?? event.request.tool.name}`,
        status: 'pending',
        createdAt: event.request.createdAt,
        identity: {
            threadId: event.request.threadId,
            turnId: event.request.turnId,
            itemId: fact?.itemId ?? event.request.permissionRequestId,
            toolUseId: event.request.toolUseId,
        },
        content: event.request,
        metadata: {
            coreEventType: event.type,
            ...(fact ? createDisplayFactMetadata(fact) : {}),
        },
    });
}
function getContextCompactionStartedDisplayItemId(event) {
    return `${event.threadId}:context-compaction:${event.startedAt}`;
}
function getContextCompactedDisplayItemId(event) {
    const activeItemId = activeContextCompactionItemIds.get(event.threadId);
    if (activeItemId) {
        activeContextCompactionItemIds.delete(event.threadId);
        return activeItemId;
    }
    return `${event.threadId}:context-compacted:${event.compactedAt}`;
}
function createContextCompactSnapshot(event) {
    const result = event.result;
    const trigger = getStringValue(result, ['trigger']);
    return compactJsonObject({
        status: 'completed',
        trigger: trigger === 'auto' || trigger === 'manual' ? trigger : undefined,
        completedAt: event.compactedAt,
        preCompactTokenCount: getNumberValue(result, [
            'preCompactTokenCount',
            'preTokens',
        ]),
        postCompactTokenCount: getNumberValue(result, [
            'postCompactTokenCount',
            'postTokens',
        ]),
        truePostCompactTokenCount: getNumberValue(result, [
            'truePostCompactTokenCount',
            'truePostTokens',
        ]),
        summaryMessageCount: getNumberValue(result, [
            'summaryMessageCount',
            'messagesSummarized',
        ]),
        attachmentCount: getNumberValue(result, ['attachmentCount']),
        hookResultCount: getNumberValue(result, ['hookResultCount']),
    });
}
function formatContextCompactedText(snapshot) {
    const preTokens = getNumberValue(snapshot, ['preCompactTokenCount']);
    const postTokens = getNumberValue(snapshot, ['truePostCompactTokenCount']) ??
        getNumberValue(snapshot, ['postCompactTokenCount']);
    const summaryCount = getNumberValue(snapshot, ['summaryMessageCount']);
    const attachmentCount = getNumberValue(snapshot, ['attachmentCount']);
    const details = [
        preTokens !== undefined && postTokens !== undefined
            ? `${formatCompactNumber(preTokens)} -> ${formatCompactNumber(postTokens)} token`
            : undefined,
        summaryCount !== undefined ? `摘要 ${formatCompactNumber(summaryCount)} 条` : undefined,
        attachmentCount !== undefined
            ? `附件 ${formatCompactNumber(attachmentCount)} 个`
            : undefined,
    ].filter(Boolean);
    return details.length > 0
        ? `上下文已压缩：${details.join('，')}。`
        : '上下文已压缩，运行状态已刷新。';
}
function getNumberValue(input, keys) {
    if (!input) {
        return undefined;
    }
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }
    return undefined;
}
function getStringValue(input, keys) {
    if (!input) {
        return undefined;
    }
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }
    return undefined;
}
function formatCompactNumber(value) {
    return new Intl.NumberFormat('en-US').format(value);
}
function compactJsonObject(object) {
    return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
function getThreadDisplayItemTypeFromKind(kind) {
    if (kind === 'user_message') {
        return 'user_message';
    }
    if (kind === 'assistant_message') {
        return 'assistant_message';
    }
    if (kind === 'thinking_summary' ||
        kind === 'reasoning_summary' ||
        kind === 'summary_text' ||
        kind === 'assistant_thinking') {
        return 'thinking_summary';
    }
    if (kind.includes('tool') || kind === 'assistant') {
        return 'tool_call';
    }
    return 'system_notice';
}
function getThreadDisplayItemTypeFromContent(content) {
    const firstType = getFirstContentBlockType(content);
    if (firstType === 'tool_use') {
        if (isFileMutationToolUseContent(content)) {
            return 'file_change';
        }
        return 'tool_call';
    }
    if (firstType === 'tool_result') {
        return 'tool_result';
    }
    if (firstType === 'thinking' ||
        firstType === 'redacted_thinking' ||
        firstType === 'reasoning') {
        return 'thinking_summary';
    }
    return 'assistant_message';
}
function getThreadDisplayItemTypeFromDelta(delta) {
    const type = typeof delta.type === 'string' ? delta.type : '';
    if (type === 'thinking' ||
        type === 'thinking_summary' ||
        type === 'redacted_thinking' ||
        type === 'reasoning' ||
        type === 'reasoning_summary' ||
        type === 'summary_text') {
        return 'thinking_summary';
    }
    return 'assistant_message';
}
function isFileMutationToolUseContent(content) {
    const firstBlock = content?.[0];
    if (!firstBlock || firstBlock.type !== 'tool_use') {
        return false;
    }
    const name = typeof firstBlock.name === 'string' ? firstBlock.name : '';
    return (name === 'Write' ||
        name === 'Edit' ||
        name === 'MultiEdit' ||
        name === 'NotebookEdit' ||
        name === 'FileWrite' ||
        name === 'FileEdit');
}
function getFirstContentBlockType(content) {
    const firstBlock = content?.[0];
    return firstBlock && typeof firstBlock.type === 'string'
        ? firstBlock.type
        : undefined;
}
function getCoreDeltaDisplayText(delta) {
    for (const key of ['text', 'thinking', 'summary']) {
        const value = delta[key];
        if (typeof value === 'string') {
            return value;
        }
    }
    return extractDisplayText(delta.text ?? delta.thinking ?? delta.summary);
}
function getToolUseIdFromContent(content) {
    for (const block of content ?? []) {
        const id = getStringField(block, [
            'id',
            'toolUseId',
            'toolUseID',
            'tool_use_id',
            'parentToolUseId',
            'parentToolUseID',
            'parent_tool_use_id',
        ]);
        if (id) {
            return id;
        }
    }
    return undefined;
}
function extractDisplayText(value, depth = 0) {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (!value || depth > 2) {
        return '';
    }
    if (Array.isArray(value)) {
        return value
            .map(item => extractDisplayText(item, depth + 1))
            .filter(Boolean)
            .join('\n')
            .trim();
    }
    const object = value;
    const parts = [];
    for (const key of [
        'text',
        'content',
        'summary',
        'message',
        'output',
        'result',
        'error',
    ]) {
        const text = extractDisplayText(object[key], depth + 1);
        if (text) {
            parts.push(text);
        }
    }
    return parts.join('\n').trim();
}
function getStringField(value, keys) {
    for (const key of keys) {
        const field = value[key];
        if (typeof field === 'string' && field.trim()) {
            return field;
        }
    }
    return undefined;
}
function isCoreJsonObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
//# sourceMappingURL=threadDisplay.js.map