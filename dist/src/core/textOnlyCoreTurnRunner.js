import { randomUUID } from 'node:crypto';
import { queryWithLlmRuntime, } from '../services/llm/claudeApiAdapter.js';
import { loadLlmConfig } from '../services/llm/llmConfig.js';
import { getLlmRuntimeAuthStatus } from '../services/llm/runtimeStatus.js';
import { createUserMessage } from '../utils/messages.js';
import { asSystemPrompt } from '../utils/systemPromptType.js';
import { CoreError } from './errors.js';
export async function runTextOnlyCoreTurn(input) {
    const { turn, signal, emit } = input;
    const metadata = {};
    const config = loadLlmConfig();
    const authStatus = await getLlmRuntimeAuthStatus(config);
    if (!authStatus.available) {
        throw new CoreError('auth_required', authStatus.message);
    }
    const userItemId = createItemId();
    emit({
        type: 'item_started',
        item: {
            itemId: userItemId,
            threadId: turn.threadId,
            turnId: turn.turnId,
            kind: 'user_message',
            status: 'completed',
            content: [{ type: 'text', text: turn.input.text }],
        },
    });
    emit({
        type: 'item_completed',
        threadId: turn.threadId,
        turnId: turn.turnId,
        itemId: userItemId,
        status: 'completed',
    });
    const assistantItemId = createItemId();
    emit({
        type: 'item_started',
        item: {
            itemId: assistantItemId,
            threadId: turn.threadId,
            turnId: turn.turnId,
            kind: 'assistant_message',
            status: 'streaming',
            content: [],
        },
    });
    let text = '';
    for await (const event of queryWithLlmRuntime({
        messages: [
            createUserMessage({
                content: turn.input.text,
            }),
        ],
        systemPrompt: asSystemPrompt([]),
        toolSchemas: [],
        signal,
        model: turn.model,
    })) {
        if (signal.aborted) {
            throw new CoreError('turn_not_active', 'Turn was interrupted.');
        }
        if (event.type === 'stream_event' &&
            event.event.type === 'content_block_delta' &&
            event.event.delta.type === 'text_delta') {
            text += event.event.delta.text;
            emit({
                type: 'item_delta',
                threadId: turn.threadId,
                turnId: turn.turnId,
                itemId: assistantItemId,
                delta: {
                    type: 'text',
                    text: event.event.delta.text,
                },
            });
        }
        if (event.type === 'assistant' && event.isApiErrorMessage) {
            collectAssistantMetadata(metadata, event);
            throw new CoreError('internal_error', extractAssistantText(event));
        }
        if (event.type === 'stream_event') {
            collectStreamEventMetadata(metadata, event);
        }
        if (event.type === 'assistant') {
            collectAssistantMetadata(metadata, event);
        }
    }
    emit({
        type: 'item_completed',
        threadId: turn.threadId,
        turnId: turn.turnId,
        itemId: assistantItemId,
        status: 'completed',
        content: [{ type: 'text', text }],
    });
    return metadata;
}
function createItemId() {
    return `item_${randomUUID()}`;
}
function extractAssistantText(message) {
    const content = message.message.content;
    if (!Array.isArray(content)) {
        return 'Model request failed.';
    }
    const text = content
        .filter((part) => part &&
        typeof part === 'object' &&
        part.type === 'text' &&
        typeof part.text === 'string')
        .map(part => part.text)
        .join('')
        .trim();
    return text || 'Model request failed.';
}
function collectStreamEventMetadata(metadata, event) {
    if (typeof event.ttftMs === 'number') {
        metadata.timeToFirstTokenMs = event.ttftMs;
    }
    const streamEvent = event.event;
    if (!streamEvent) {
        return;
    }
    if (streamEvent.type === 'message_delta') {
        const usage = normalizeUsage(streamEvent.usage);
        if (usage) {
            metadata.usage = usage;
        }
        const delta = streamEvent.delta && typeof streamEvent.delta === 'object'
            ? streamEvent.delta
            : null;
        const stopReason = getString(delta?.stop_reason ?? delta?.stopReason);
        if (stopReason) {
            metadata.stopReason = stopReason;
        }
    }
}
function collectAssistantMetadata(metadata, message) {
    const requestId = getString(message.requestId ?? message.message.id);
    if (requestId) {
        metadata.requestId = requestId;
    }
    const model = getString(message.message.model);
    if (model) {
        metadata.model = model;
    }
    const stopReason = getString(message.message.stop_reason ?? message.message.stopReason);
    if (stopReason) {
        metadata.stopReason = stopReason;
    }
    const usage = normalizeUsage(message.message.usage);
    if (usage) {
        metadata.usage = usage;
    }
}
function normalizeUsage(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const usage = value;
    const inputTokens = getNumber(usage.input_tokens ?? usage.inputTokens);
    const outputTokens = getNumber(usage.output_tokens ?? usage.outputTokens);
    const cacheCreationInputTokens = getNumber(usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens);
    const cacheReadInputTokens = getNumber(usage.cache_read_input_tokens ?? usage.cacheReadInputTokens);
    const totalTokens = getNumber(usage.total_tokens ?? usage.totalTokens);
    const computedTotal = [
        inputTokens,
        outputTokens,
        cacheCreationInputTokens,
        cacheReadInputTokens,
    ]
        .filter((item) => typeof item === 'number')
        .reduce((sum, item) => sum + item, 0);
    return Object.fromEntries(Object.entries({
        inputTokens,
        outputTokens,
        cacheCreationInputTokens,
        cacheReadInputTokens,
        totalTokens: typeof totalTokens === 'number'
            ? totalTokens
            : computedTotal > 0
                ? computedTotal
                : undefined,
        raw: value,
    }).filter(([, nestedValue]) => nestedValue !== undefined));
}
function getString(value) {
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function getNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
//# sourceMappingURL=textOnlyCoreTurnRunner.js.map