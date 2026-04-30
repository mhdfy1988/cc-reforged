import { randomUUID } from 'node:crypto';
import { queryWithLlmRuntime, } from '../services/llm/claudeApiAdapter.js';
import { loadLlmConfig } from '../services/llm/llmConfig.js';
import { getLlmRuntimeAuthStatus } from '../services/llm/runtimeStatus.js';
import { createUserMessage } from '../utils/messages.js';
import { asSystemPrompt } from '../utils/systemPromptType.js';
import { CoreError } from './errors.js';
export async function runTextOnlyCoreTurn(input) {
    const { turn, signal, emit } = input;
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
            throw new CoreError('internal_error', extractAssistantText(event));
        }
    }
    emit({
        type: 'item_completed',
        itemId: assistantItemId,
        status: 'completed',
        content: [{ type: 'text', text }],
    });
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
//# sourceMappingURL=textOnlyCoreTurnRunner.js.map