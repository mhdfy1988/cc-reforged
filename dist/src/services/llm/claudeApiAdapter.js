import { createDefaultLlmRuntime } from './defaultRuntime.js';
import { loadLlmConfig } from './llmConfig.js';
import { errorMessage } from '../../utils/errors.js';
import { createAssistantAPIErrorMessage, createAssistantMessage, } from '../../utils/messages.js';
import { getDefaultSonnetModel } from '../../utils/model/model.js';
export function shouldUseBuiltinLlmRuntime(config = loadLlmConfig()) {
    return config.provider.trim() !== 'anthropic';
}
export function buildLlmQueryRequest(params) {
    const config = params.config ?? loadLlmConfig();
    return {
        provider: config.provider,
        model: resolveRuntimeRequestModel(params.model, config),
        ...(config.currentProfileId ? { profileId: config.currentProfileId } : {}),
        messages: [
            ...toSystemMessages(params.systemPrompt),
            ...params.messages.flatMap(message => toLlmMessages(message)),
        ],
        ...(params.toolSchemas.length > 0
            ? { tools: toLlmToolDefinitions(params.toolSchemas) }
            : {}),
        ...(typeof params.maxOutputTokens === 'number'
            ? { maxOutputTokens: params.maxOutputTokens }
            : {}),
        ...(typeof params.temperature === 'number'
            ? { temperature: params.temperature }
            : {}),
        metadata: {
            ...(resolveReasoningEffort(params.reasoningEffort)
                ? { reasoningEffort: resolveReasoningEffort(params.reasoningEffort) }
                : {}),
        },
        signal: params.signal,
    };
}
function resolveRuntimeRequestModel(model, config) {
    const requestedModel = model.trim();
    if (config.provider === 'anthropic') {
        return requestedModel || config.model;
    }
    // 非 Anthropic provider 不能继承旧 Claude 默认模型；否则无参 `ccr -p`
    // 会把 claude-sonnet-* 误传给 Codex/OpenAI provider。
    if (!requestedModel || requestedModel === getDefaultSonnetModel()) {
        return config.model;
    }
    return requestedModel;
}
export async function* queryWithLlmRuntime(params) {
    const request = buildLlmQueryRequest(params);
    const runtime = params.runtime ?? createDefaultLlmRuntime();
    try {
        let blockIndex = 0;
        let openTextBlockIndex = null;
        const nextBlockIndex = (contentIndex) => {
            if (typeof contentIndex === 'number') {
                blockIndex = Math.max(blockIndex, contentIndex + 1);
                return contentIndex;
            }
            const index = blockIndex;
            blockIndex += 1;
            return index;
        };
        const currentBlockIndex = (contentIndex) => typeof contentIndex === 'number' ? contentIndex : Math.max(blockIndex - 1, 0);
        const closeOpenTextBlock = () => {
            if (openTextBlockIndex === null) {
                return [];
            }
            openTextBlockIndex = null;
            return [
                {
                    type: 'stream_event',
                    event: {
                        type: 'content_block_stop',
                    },
                },
            ];
        };
        const openTextBlock = (index) => {
            if (openTextBlockIndex === index) {
                return [];
            }
            const events = closeOpenTextBlock();
            openTextBlockIndex = index;
            events.push({
                type: 'stream_event',
                event: {
                    type: 'content_block_start',
                    index,
                    content_block: {
                        type: 'text',
                    },
                },
            });
            return events;
        };
        for await (const event of runtime.stream(request)) {
            switch (event.type) {
                case 'response_start':
                    yield {
                        type: 'stream_event',
                        event: {
                            type: 'message_start',
                            message: {
                                role: 'assistant',
                                model: request.model,
                            },
                        },
                    };
                    break;
                case 'content_part':
                    {
                        const index = nextBlockIndex(event.contentIndex);
                        if (event.part.type === 'text') {
                            for (const streamEvent of openTextBlock(index)) {
                                yield streamEvent;
                            }
                            yield {
                                type: 'stream_event',
                                event: {
                                    type: 'content_block_delta',
                                    index,
                                    delta: {
                                        type: 'text_delta',
                                        text: event.part.text,
                                    },
                                },
                            };
                            break;
                        }
                        for (const streamEvent of closeOpenTextBlock()) {
                            yield streamEvent;
                        }
                        for (const streamEvent of toStreamEvents(event.part, index)) {
                            yield streamEvent;
                        }
                    }
                    break;
                case 'thinking_start':
                    for (const streamEvent of closeOpenTextBlock()) {
                        yield streamEvent;
                    }
                    yield {
                        type: 'stream_event',
                        event: {
                            type: 'content_block_start',
                            index: nextBlockIndex(event.contentIndex),
                            content_block: {
                                type: 'thinking',
                            },
                        },
                    };
                    break;
                case 'thinking_delta':
                    yield {
                        type: 'stream_event',
                        event: {
                            type: 'content_block_delta',
                            index: currentBlockIndex(event.contentIndex),
                            delta: {
                                type: 'thinking_delta',
                                thinking: event.delta,
                            },
                        },
                    };
                    break;
                case 'thinking_end':
                    yield {
                        type: 'stream_event',
                        event: {
                            type: 'content_block_stop',
                        },
                    };
                    break;
                case 'response_complete':
                    for (const streamEvent of closeOpenTextBlock()) {
                        yield streamEvent;
                    }
                    yield {
                        type: 'stream_event',
                        event: {
                            type: 'message_delta',
                            usage: toAssistantUsage(event.response.usage),
                        },
                    };
                    yield {
                        type: 'stream_event',
                        event: {
                            type: 'message_stop',
                        },
                    };
                    yield toAssistantMessage(event.response);
                    return;
                case 'response_error':
                    throw normalizeError(event.error);
            }
        }
    }
    catch (error) {
        yield createAssistantAPIErrorMessage({
            content: `[Builtin LLM Runtime] ${errorMessage(normalizeError(error))}`,
            apiError: 'unknown',
        });
    }
}
function toSystemMessages(systemPrompt) {
    return systemPrompt
        .map(text => text.trim())
        .filter(Boolean)
        .map(text => ({
        role: 'system',
        parts: [{ type: 'text', text }],
    }));
}
function toLlmMessages(message) {
    if (message.type === 'assistant') {
        const parts = toAssistantParts(message);
        return parts.length > 0 ? [{ role: 'assistant', parts }] : [];
    }
    const content = message.message.content;
    if (typeof content === 'string') {
        const text = content.trim();
        return text
            ? [{ role: 'user', parts: [{ type: 'text', text }] }]
            : [];
    }
    const userParts = [];
    const toolParts = [];
    for (const block of content) {
        if (!block || typeof block !== 'object') {
            continue;
        }
        if (block.type === 'text' && typeof block.text === 'string') {
            const text = block.text.trim();
            if (text) {
                userParts.push({ type: 'text', text });
            }
            continue;
        }
        if (isToolResultBlock(block)) {
            toolParts.push({
                type: 'tool_result',
                toolCallId: block.tool_use_id,
                result: normalizeToolResultContent(block.content),
                ...(typeof block.is_error === 'boolean'
                    ? { isError: block.is_error }
                    : {}),
            });
            continue;
        }
        throw new Error(`Builtin LLM runtime currently does not support user content block type '${String(block.type)}'.`);
    }
    const mapped = [];
    if (userParts.length > 0) {
        mapped.push({ role: 'user', parts: userParts });
    }
    if (toolParts.length > 0) {
        mapped.push({ role: 'tool', parts: toolParts });
    }
    return mapped;
}
function toAssistantParts(message) {
    const content = message.message.content;
    if (!Array.isArray(content)) {
        return [];
    }
    const parts = [];
    for (const block of content) {
        if (!block || typeof block !== 'object') {
            continue;
        }
        if (block.type === 'text' && typeof block.text === 'string') {
            const text = block.text.trim();
            if (text) {
                parts.push({ type: 'text', text });
            }
            continue;
        }
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
            const thinking = block.thinking.trim();
            if (thinking) {
                parts.push({
                    type: 'thinking',
                    thinking,
                    ...(typeof block.signature === 'string'
                        ? { signature: block.signature }
                        : {}),
                });
            }
            continue;
        }
        if (block.type === 'redacted_thinking') {
            parts.push({
                type: 'thinking',
                thinking: '',
                redacted: true,
                ...(typeof block.data === 'string' ? { signature: block.data } : {}),
            });
            continue;
        }
        if (block.type === 'tool_use' &&
            typeof block.id === 'string' &&
            typeof block.name === 'string') {
            parts.push({
                type: 'tool_call',
                id: block.id,
                name: block.name,
                input: block.input && typeof block.input === 'object' ? block.input : {},
            });
        }
    }
    return parts;
}
function toLlmToolDefinitions(toolSchemas) {
    return toolSchemas.flatMap(toolSchema => {
        if (typeof toolSchema !== 'object' ||
            toolSchema === null ||
            !('name' in toolSchema) ||
            !('description' in toolSchema) ||
            !('input_schema' in toolSchema)) {
            return [];
        }
        const name = toolSchema.name;
        const description = toolSchema.description;
        const inputSchema = toolSchema.input_schema;
        if (typeof name !== 'string' ||
            typeof description !== 'string' ||
            !inputSchema ||
            typeof inputSchema !== 'object' ||
            Array.isArray(inputSchema)) {
            return [];
        }
        return [
            {
                name,
                description,
                inputSchema: inputSchema,
            },
        ];
    });
}
function toStreamEvents(part, index) {
    if (part.type === 'text') {
        return [
            {
                type: 'stream_event',
                event: {
                    type: 'content_block_start',
                    index,
                    content_block: {
                        type: 'text',
                    },
                },
            },
            {
                type: 'stream_event',
                event: {
                    type: 'content_block_delta',
                    index,
                    delta: {
                        type: 'text_delta',
                        text: part.text,
                    },
                },
            },
            {
                type: 'stream_event',
                event: {
                    type: 'content_block_stop',
                },
            },
        ];
    }
    if (part.type === 'thinking') {
        return [
            {
                type: 'stream_event',
                event: {
                    type: 'content_block_start',
                    index,
                    content_block: part.redacted
                        ? {
                            type: 'redacted_thinking',
                            ...(part.signature ? { data: part.signature } : {}),
                        }
                        : {
                            type: 'thinking',
                            ...(part.signature ? { signature: part.signature } : {}),
                        },
                },
            },
            ...(part.redacted
                ? []
                : [
                    {
                        type: 'stream_event',
                        event: {
                            type: 'content_block_delta',
                            index,
                            delta: {
                                type: 'thinking_delta',
                                thinking: part.thinking,
                            },
                        },
                    },
                ]),
            {
                type: 'stream_event',
                event: {
                    type: 'content_block_stop',
                },
            },
        ];
    }
    if (part.type === 'tool_call') {
        return [
            {
                type: 'stream_event',
                event: {
                    type: 'content_block_start',
                    index,
                    content_block: {
                        type: 'tool_use',
                        id: part.id,
                        name: part.name,
                        input: part.input,
                    },
                },
            },
            {
                type: 'stream_event',
                event: {
                    type: 'content_block_stop',
                },
            },
        ];
    }
    return [];
}
function toAssistantMessage(response) {
    const assistant = createAssistantMessage({
        content: toAssistantContentBlocks(response.output),
        usage: toAssistantUsage(response.usage),
    });
    assistant.message.model = response.model;
    assistant.message.stop_reason = mapStopReason(response.stopReason);
    const requestId = extractRequestId(response);
    if (requestId) {
        assistant.requestId = requestId;
        assistant.message.id = requestId;
    }
    return assistant;
}
function toAssistantContentBlocks(output) {
    const contentBlocks = [];
    for (const part of output) {
        if (part.type === 'text') {
            contentBlocks.push({
                type: 'text',
                text: part.text,
            });
            continue;
        }
        if (part.type === 'thinking') {
            if (part.redacted) {
                contentBlocks.push({
                    type: 'redacted_thinking',
                    data: part.signature ?? part.thinking,
                });
                continue;
            }
            contentBlocks.push({
                type: 'thinking',
                thinking: part.thinking,
                signature: part.signature ?? '',
            });
            continue;
        }
        if (part.type === 'tool_call') {
            contentBlocks.push({
                type: 'tool_use',
                id: part.id,
                name: part.name,
                input: part.input && typeof part.input === 'object' ? part.input : {},
            });
        }
    }
    return contentBlocks;
}
function toAssistantUsage(usage) {
    return {
        input_tokens: usage?.inputTokens ?? 0,
        output_tokens: usage?.outputTokens ?? 0,
        cache_creation_input_tokens: usage?.cacheCreationInputTokens ?? 0,
        cache_read_input_tokens: usage?.cacheReadInputTokens ?? 0,
        server_tool_use: { web_search_requests: 0 },
        service_tier: null,
        cache_creation: {
            ephemeral_1h_input_tokens: 0,
            ephemeral_5m_input_tokens: 0,
        },
    };
}
function mapStopReason(stopReason) {
    switch (stopReason) {
        case 'tool_use':
            return 'tool_use';
        case 'max_tokens':
            return 'max_tokens';
        default:
            return 'end_turn';
    }
}
function extractRequestId(response) {
    const raw = response.raw;
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    if ('message' in raw && raw.message && typeof raw.message === 'object') {
        const id = raw.message.id;
        if (typeof id === 'string' && id.trim()) {
            return id;
        }
    }
    const directId = raw.id;
    return typeof directId === 'string' && directId.trim()
        ? directId
        : undefined;
}
function isToolResultBlock(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'tool_result' &&
        'tool_use_id' in value &&
        typeof value.tool_use_id === 'string');
}
function normalizeToolResultContent(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return content;
    }
    const text = content
        .filter((block) => typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string')
        .map(block => block.text)
        .join('')
        .trim();
    return text || content;
}
function resolveReasoningEffort(value) {
    return value === 'low' || value === 'medium' || value === 'high'
        ? value
        : undefined;
}
function normalizeError(error) {
    return error instanceof Error ? error : new Error(String(error));
}
//# sourceMappingURL=claudeApiAdapter.js.map