import { normalizeToolResultSourceIdFromBlock, normalizeToolUseIdFromBlock, } from './toolDisplayLifecycle.js';
export function resolveThreadDisplayFacts(inputEvent) {
    return inputEvent.source === 'history'
        ? resolveHistoryDisplayFacts(inputEvent)
        : resolveRealtimeDisplayFacts(inputEvent);
}
export function isThreadDisplayToolLikeFact(fact) {
    return fact.factType === 'tool_lifecycle' || fact.factType === 'file';
}
export function isThreadDisplayMessageLikeFact(fact) {
    return (fact.factType === 'message' ||
        fact.factType === 'attachment' ||
        fact.factType === 'error' ||
        fact.factType === 'system');
}
export function isThreadDisplaySystemFact(fact) {
    return fact.factType === 'system';
}
export function isThreadDisplayControlFact(fact) {
    return fact.factType === 'control';
}
export function createDisplayFactMetadata(fact) {
    const metadata = {
        displayFact: compactObject({
            factType: fact.factType,
            inputSource: fact.inputSource,
            inputKind: fact.inputKind,
            sourceId: fact.sourceIdentity.sourceId,
            sourceIdentityKind: fact.sourceIdentity.kind,
            orderKey: fact.orderKey,
            contentIndex: fact.contentIndex,
            blockType: fact.primaryBlock ? getContentBlockType(fact.primaryBlock) : undefined,
            toolUseId: isThreadDisplayToolLikeFact(fact) ? fact.toolUseId : undefined,
            parentToolUseId: isThreadDisplayToolLikeFact(fact)
                ? fact.parentToolUseId
                : undefined,
            fileOperation: fact.factType === 'file' ? fact.fileOperation : undefined,
            filePath: fact.factType === 'file' ? fact.filePath : undefined,
            systemKind: fact.factType === 'system' ? fact.systemKind : undefined,
            controlKind: fact.factType === 'control' ? fact.controlKind : undefined,
            shouldRender: fact.factType === 'control' ? fact.shouldRender : undefined,
            rawType: fact.factType === 'unsupported' ? fact.rawType : undefined,
            reason: fact.factType === 'unsupported' ? fact.reason : undefined,
        }),
    };
    if (fact.primaryBlock) {
        metadata.primaryBlock = fact.primaryBlock;
    }
    if (fact.factType === 'attachment') {
        metadata.attachmentBlocks = fact.attachmentBlocks;
    }
    return metadata;
}
function resolveHistoryDisplayFacts(inputEvent) {
    if (inputEvent.payload.type === 'unsupported') {
        return [createUnsupportedFact(inputEvent)];
    }
    const message = inputEvent.message;
    const blocks = inputEvent.blocks.length
        ? inputEvent.blocks
        : getCoreJsonBlocksFromUnknownContent(message.content);
    if (!blocks.some(isToolLifecycleBlock)) {
        return [createMessageLikeFact(inputEvent, message, blocks)];
    }
    const facts = [];
    let pendingBlocks = [];
    let pendingStartIndex;
    const flushPendingBlocks = () => {
        if (pendingBlocks.length === 0) {
            return;
        }
        facts.push(createMessageLikeFact(inputEvent, {
            ...message,
            id: pendingStartIndex === undefined
                ? message.id
                : `${message.id}:content:${pendingStartIndex}`,
            content: pendingBlocks,
            text: extractDisplayText(pendingBlocks),
        }, pendingBlocks, pendingStartIndex));
        pendingBlocks = [];
        pendingStartIndex = undefined;
    };
    for (const [contentIndex, block] of blocks.entries()) {
        const blockType = getContentBlockType(block);
        if (blockType !== 'tool_use' && blockType !== 'tool_result') {
            pendingStartIndex ??= contentIndex;
            pendingBlocks.push(block);
            continue;
        }
        flushPendingBlocks();
        facts.push(createToolLikeFact(inputEvent, message, block, contentIndex));
    }
    flushPendingBlocks();
    return facts;
}
function resolveRealtimeDisplayFacts(inputEvent) {
    if (inputEvent.payload.type === 'unsupported') {
        return [createUnsupportedFact(inputEvent)];
    }
    const event = inputEvent.raw.event;
    switch (event.type) {
        case 'item_started':
            return createRealtimeItemFacts({
                inputEvent,
                event,
                itemId: event.item.itemId,
                kind: event.item.kind,
                status: event.item.status,
                blocks: getCoreJsonBlocksFromUnknownContent(event.item.content),
                createdAt: getStringField(event.item, ['startedAt', 'createdAt']),
            });
        case 'item_completed':
            return createRealtimeItemFacts({
                inputEvent,
                event,
                itemId: event.itemId,
                kind: event.kind,
                status: event.status,
                blocks: getCoreJsonBlocksFromUnknownContent(event.content),
                createdAt: event.startedAt,
            });
        case 'item_delta':
            if (isToolProgressBlock(event.delta)) {
                return [
                    createToolLikeFact(inputEvent, coreItemDeltaToThreadMessage(event), event.delta, 0, event),
                ];
            }
            return [
                createControlFact(inputEvent, {
                    itemId: event.itemId,
                    text: '模型输出增量。',
                    controlKind: event.type,
                    shouldRender: true,
                    blocks: [event.delta],
                    primaryBlock: event.delta,
                }),
            ];
        case 'turn_failed':
            return [
                {
                    ...createBaseFact(inputEvent, {
                        factType: 'error',
                        blocks: [event.error],
                        primaryBlock: event.error,
                    }),
                    factType: 'error',
                    itemId: `${event.turnId}:error`,
                    text: extractDisplayText(event.error) || '当前 turn 失败。',
                },
            ];
        case 'context_compaction_started':
        case 'context_compacted':
            return [
                {
                    ...createBaseFact(inputEvent, { factType: 'system', blocks: [] }),
                    factType: 'system',
                    itemId: event.type === 'context_compaction_started'
                        ? `${event.threadId}:context-compaction:${event.startedAt}`
                        : `${event.threadId}:context-compacted:${event.compactedAt}`,
                    text: event.type === 'context_compaction_started'
                        ? '正在压缩上下文。'
                        : '上下文已压缩。',
                    systemKind: event.type,
                },
            ];
        case 'permission_requested':
            return [
                createControlFact(inputEvent, {
                    itemId: event.request.permissionRequestId,
                    text: `权限请求：${event.request.tool.displayName ?? event.request.tool.name}`,
                    controlKind: event.type,
                    shouldRender: true,
                    blocks: [],
                }),
            ];
        case 'permission_cancelled':
            return [
                createControlFact(inputEvent, {
                    itemId: event.permissionRequestId,
                    text: '权限请求已取消。',
                    controlKind: event.type,
                    shouldRender: true,
                    blocks: [],
                }),
            ];
        case 'thread_started':
        case 'turn_started':
        case 'turn_completed':
        case 'turn_cancelled':
            return [
                createControlFact(inputEvent, {
                    itemId: inputEvent.itemId ?? inputEvent.turnId ?? inputEvent.sourceIdentity.sourceId,
                    text: event.type,
                    controlKind: event.type,
                    shouldRender: false,
                    blocks: [],
                }),
            ];
    }
}
function createRealtimeItemFacts(input) {
    const { inputEvent, event, blocks } = input;
    const message = createRealtimeThreadMessage(input);
    if (!blocks.some(isToolLifecycleBlock)) {
        return [
            createMessageLikeFact(inputEvent, message, blocks, undefined, input.itemId),
        ];
    }
    return blocks
        .map((block, contentIndex) => {
        const blockType = getContentBlockType(block);
        return isToolLifecycleBlock(block)
            ? createToolLikeFact(inputEvent, message, block, contentIndex, event)
            : null;
    })
        .filter((fact) => Boolean(fact));
}
function createMessageLikeFact(inputEvent, message, blocks, contentIndex, itemId = message.id) {
    const attachmentBlocks = blocks.filter(isAttachmentBlock);
    const base = createBaseFact(inputEvent, {
        factType: 'message',
        blocks,
        primaryBlock: blocks[0],
        contentIndex,
    });
    const sourceIndex = inputEvent.identity.sourceIndex;
    if (message.role === 'error') {
        return {
            ...base,
            factType: 'error',
            itemId,
            message,
            text: extractDisplayText(blocks) || message.text || '错误。',
        };
    }
    if (attachmentBlocks.length > 0) {
        return {
            ...base,
            factType: 'attachment',
            itemId,
            message,
            sourceIndex,
            attachmentBlocks,
        };
    }
    if (message.role === 'system' || isSystemMessageKind(message.kind)) {
        return {
            ...base,
            factType: 'system',
            itemId,
            message,
            sourceIndex,
            text: extractDisplayText(blocks) || message.text || '系统提示。',
            systemKind: message.kind,
        };
    }
    return {
        ...base,
        factType: 'message',
        itemId,
        message,
        sourceIndex,
    };
}
function createToolLikeFact(inputEvent, message, block, contentIndex, realtimeEvent) {
    const blockType = getContentBlockType(block);
    const lifecycleKind = blockType === 'tool_result'
        ? 'tool_result'
        : blockType === 'progress'
            ? 'tool_progress'
            : 'tool_use';
    const toolName = getStringField(block, ['name']);
    const toolUseId = lifecycleKind === 'tool_use'
        ? normalizeToolUseIdFromBlock(block)
        : normalizeToolResultSourceIdFromBlock(block);
    const fileOperation = getFileOperation(toolName);
    const base = {
        ...createBaseFact(inputEvent, {
            factType: fileOperation ? 'file' : 'tool_lifecycle',
            blocks: [block],
            primaryBlock: block,
            contentIndex,
        }),
        message,
        lifecycleKind,
        block,
        source: createToolLifecycleSource(inputEvent, message, contentIndex, realtimeEvent),
        toolName,
        toolUseId,
        parentToolUseId: lifecycleKind === 'tool_result' || lifecycleKind === 'tool_progress'
            ? normalizeToolResultSourceIdFromBlock(block)
            : undefined,
        ...(realtimeEvent &&
            'completedAt' in realtimeEvent &&
            realtimeEvent.completedAt
            ? { completedAt: realtimeEvent.completedAt }
            : {}),
        ...(realtimeEvent &&
            'durationMs' in realtimeEvent &&
            typeof realtimeEvent.durationMs === 'number'
            ? { durationMs: realtimeEvent.durationMs }
            : {}),
    };
    if (!fileOperation) {
        return {
            ...base,
            factType: 'tool_lifecycle',
        };
    }
    return {
        ...base,
        factType: 'file',
        fileOperation,
        ...(getPrimaryFilePathFromBlock(block)
            ? { filePath: getPrimaryFilePathFromBlock(block) }
            : {}),
    };
}
function createUnsupportedFact(inputEvent) {
    const payload = inputEvent.payload.type === 'unsupported'
        ? inputEvent.payload
        : {
            rawType: inputEvent.kind,
            reason: 'unsupported display input',
        };
    return {
        ...createBaseFact(inputEvent, { factType: 'unsupported', blocks: [] }),
        factType: 'unsupported',
        itemId: `diagnostic:${inputEvent.sourceIdentity.sourceId}`,
        rawType: payload.rawType,
        reason: payload.reason,
    };
}
function createControlFact(inputEvent, input) {
    return {
        ...createBaseFact(inputEvent, {
            factType: 'control',
            blocks: input.blocks,
            primaryBlock: input.primaryBlock,
        }),
        factType: 'control',
        itemId: input.itemId,
        text: input.text,
        controlKind: input.controlKind,
        shouldRender: input.shouldRender,
    };
}
function createBaseFact(inputEvent, input) {
    return {
        factType: input.factType,
        inputSource: inputEvent.source,
        inputKind: inputEvent.kind,
        threadId: inputEvent.threadId,
        ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
        orderKey: inputEvent.orderKey,
        sourceIdentity: inputEvent.sourceIdentity,
        identity: inputEvent.identity,
        blocks: input.blocks,
        ...(input.primaryBlock ? { primaryBlock: input.primaryBlock } : {}),
        ...(input.contentIndex !== undefined ? { contentIndex: input.contentIndex } : {}),
    };
}
function createToolLifecycleSource(inputEvent, message, contentIndex, realtimeEvent) {
    const sourceIndex = inputEvent.identity.sourceIndex;
    const createdAt = realtimeEvent && 'item' in realtimeEvent
        ? getStringField(realtimeEvent.item, ['startedAt', 'createdAt'])
        : realtimeEvent && 'completedAt' in realtimeEvent
            ? realtimeEvent.startedAt ?? realtimeEvent.completedAt
            : realtimeEvent && realtimeEvent.type === 'item_delta'
                ? getStringField(realtimeEvent, ['timestamp'])
                : message.createdAt;
    return {
        threadId: inputEvent.threadId,
        ...(inputEvent.sessionId ? { sessionId: inputEvent.sessionId } : {}),
        ...('turnId' in inputEvent && inputEvent.turnId
            ? { turnId: inputEvent.turnId }
            : {}),
        messageUuid: message.id,
        ...(sourceIndex !== undefined ? { rawIndex: sourceIndex } : {}),
        ...(sourceIndex !== undefined ? { materializedIndex: sourceIndex } : {}),
        contentIndex,
        ...(createdAt ? { createdAt } : {}),
    };
}
function createRealtimeThreadMessage(input) {
    return {
        id: input.itemId,
        role: getThreadMessageRoleFromKind(input.kind),
        text: extractDisplayText(input.blocks),
        status: input.status,
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        content: input.blocks,
    };
}
function coreItemDeltaToThreadMessage(event) {
    return {
        id: event.itemId,
        role: 'assistant',
        text: extractDisplayText([event.delta]),
        status: 'running',
        kind: 'tool_progress',
        content: [event.delta],
    };
}
function getThreadMessageRoleFromKind(kind) {
    if (kind === 'tool_result' || kind === 'user_message') {
        return 'user';
    }
    if (kind?.includes('system')) {
        return 'system';
    }
    if (kind?.includes('error')) {
        return 'error';
    }
    return 'assistant';
}
function isSystemMessageKind(kind) {
    return Boolean(kind &&
        (kind.includes('system') ||
            kind.includes('compact') ||
            kind.includes('context_compact')));
}
function isToolLifecycleBlock(block) {
    const type = getContentBlockType(block);
    return type === 'tool_use' || type === 'tool_result' || type === 'progress';
}
function isToolProgressBlock(block) {
    return getContentBlockType(block) === 'progress';
}
function isAttachmentBlock(block) {
    const type = getContentBlockType(block);
    return (type === 'attachment' ||
        type === 'image' ||
        type === 'file' ||
        type === 'audio' ||
        type === 'video');
}
function getFileOperation(toolName) {
    switch (toolName) {
        case 'Read':
            return 'read';
        case 'Write':
            return 'write';
        case 'Edit':
        case 'MultiEdit':
            return 'edit';
        case 'NotebookEdit':
            return 'notebook_edit';
        case 'Glob':
        case 'Grep':
            return 'search';
        default:
            return undefined;
    }
}
function getPrimaryFilePathFromBlock(block) {
    const input = getJsonObject(block.input);
    const result = getJsonObject(block.result);
    return (getStringField(input, ['file_path', 'filePath', 'path']) ??
        getStringField(input, ['notebook_path', 'notebookPath']) ??
        getStringField(result, ['filePath', 'path']) ??
        getStringField(result, ['notebookPath', 'notebook_path']));
}
function getCoreJsonBlocksFromUnknownContent(content) {
    return Array.isArray(content) ? content.filter(isCoreJsonObject) : [];
}
function isCoreJsonObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function getJsonObject(value) {
    return isCoreJsonObject(value) ? value : undefined;
}
function getContentBlockType(block) {
    return typeof block.type === 'string' ? block.type : '';
}
function getStringField(input, keys) {
    if (!input) {
        return undefined;
    }
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}
function extractDisplayText(value, depth = 0) {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (!value || depth > 4) {
        return '';
    }
    if (Array.isArray(value)) {
        return value
            .map(item => extractDisplayText(item, depth + 1))
            .filter(Boolean)
            .join('\n')
            .trim();
    }
    if (typeof value === 'object') {
        const object = value;
        for (const key of ['text', 'summary', 'message', 'content', 'value']) {
            const rendered = extractDisplayText(object[key], depth + 1);
            if (rendered) {
                return rendered;
            }
        }
    }
    return '';
}
function compactObject(object) {
    return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
//# sourceMappingURL=threadDisplayFacts.js.map