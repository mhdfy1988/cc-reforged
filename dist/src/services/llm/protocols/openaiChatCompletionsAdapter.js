import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js';
import { createCombinedAbortSignal } from '../../../utils/combinedAbortSignal.js';
import { validateLlmHistoryForProvider } from '../historyValidator.js';
import { toOpenAiImageUrl, toOpenAiVideoUrl } from '../imageContent.js';
import { isOpenAiChatToolResultProfile, resolveProviderToolProfile, } from '../toolProtocolProfile.js';
export class OpenAiChatCompletionsAdapter {
    #providerId;
    #providerLabel;
    #apiKey;
    #baseUrl;
    #defaultModel;
    #defaultReasoningEffort;
    #outputTokenParam;
    #outputTokenLimit;
    #includeStreamUsage;
    #includeTools;
    #mergeSystemMessages;
    #toolProfile;
    #missingApiKeyMessage;
    #fetchImpl;
    #resolveTemperature;
    #resolveThinking;
    constructor(options) {
        this.#providerId = options.providerId;
        this.#providerLabel = options.providerLabel;
        this.#apiKey = options.apiKey?.trim();
        this.#baseUrl = normalizeBaseUrl(options.baseUrl);
        this.#defaultModel = options.defaultModel;
        this.#defaultReasoningEffort =
            options.defaultReasoningEffort ?? 'high';
        this.#outputTokenParam = options.outputTokenParam ?? 'max_tokens';
        this.#outputTokenLimit = options.outputTokenLimit;
        this.#includeStreamUsage = options.includeStreamUsage ?? true;
        this.#includeTools = options.includeTools ?? true;
        this.#mergeSystemMessages = options.mergeSystemMessages ?? false;
        this.#toolProfile = options.toolProfile;
        this.#missingApiKeyMessage =
            options.missingApiKeyMessage ??
                `${options.providerLabel} API key is missing.`;
        this.#fetchImpl = options.fetchImpl || fetch;
        this.#resolveTemperature =
            options.resolveTemperature ??
                (({ request }) => request.temperature);
        this.#resolveThinking = options.resolveThinking ?? (() => undefined);
    }
    async generate(request) {
        const response = await this.#postChatCompletion(request, false);
        const raw = (await response.json());
        return toGenerateResponse({
            provider: this.#providerId,
            fallbackModel: request.model || this.#defaultModel,
            raw,
            emptyOutputMessage: `${this.#providerLabel} provider returned no usable content.`,
        });
    }
    async *stream(request) {
        const streamTimeoutMs = getOpenAiChatStreamTimeoutMs();
        const timeoutSignalContext = streamTimeoutMs > 0
            ? createCombinedAbortSignal(request.signal, {
                timeoutMs: streamTimeoutMs,
            })
            : null;
        const streamRequest = timeoutSignalContext
            ? { ...request, signal: timeoutSignalContext.signal }
            : request;
        try {
            const response = await this.#postChatCompletion(streamRequest, true);
            if (!response.body) {
                throw new Error(`${this.#providerLabel} streaming response did not include a body.`);
            }
            const output = [];
            const toolCalls = new Map();
            const decoder = new TextDecoder();
            let buffer = '';
            let responseId;
            let responseModel = request.model || this.#defaultModel;
            let usage;
            let stopReason = 'other';
            let thinking = '';
            let content = '';
            let thinkingStarted = false;
            let thinkingEnded = false;
            let contentIndex = 0;
            const endThinking = () => {
                if (!thinkingStarted || thinkingEnded) {
                    return null;
                }
                thinkingEnded = true;
                output.push({ type: 'thinking', thinking });
                contentIndex = 1;
                return {
                    type: 'thinking_end',
                    provider: this.#providerId,
                    model: responseModel,
                    contentIndex: 0,
                    content: thinking,
                };
            };
            for await (const chunkText of readSseChunks(response.body, decoder)) {
                buffer += chunkText;
                const lines = buffer.split(/\r?\n/u);
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) {
                        continue;
                    }
                    const data = trimmed.slice('data:'.length).trim();
                    if (!data || data === '[DONE]') {
                        continue;
                    }
                    const chunk = JSON.parse(data);
                    responseId = chunk.id || responseId;
                    responseModel = chunk.model || responseModel;
                    if (chunk.usage) {
                        usage = toLlmUsage(chunk.usage);
                    }
                    for (const choice of chunk.choices ?? []) {
                        if (choice.finish_reason) {
                            stopReason = mapStopReason(choice.finish_reason);
                        }
                        const delta = choice.delta;
                        if (!delta) {
                            continue;
                        }
                        if (delta.reasoning_content) {
                            if (!thinkingStarted) {
                                thinkingStarted = true;
                                yield {
                                    type: 'thinking_start',
                                    provider: this.#providerId,
                                    model: responseModel,
                                    contentIndex: 0,
                                };
                            }
                            thinking += delta.reasoning_content;
                            yield {
                                type: 'thinking_delta',
                                provider: this.#providerId,
                                model: responseModel,
                                contentIndex: 0,
                                delta: delta.reasoning_content,
                            };
                        }
                        if (delta.content) {
                            const thinkingEndEvent = endThinking();
                            if (thinkingEndEvent) {
                                yield thinkingEndEvent;
                            }
                            content += delta.content;
                            yield {
                                type: 'content_part',
                                provider: this.#providerId,
                                model: responseModel,
                                contentIndex,
                                part: {
                                    type: 'text',
                                    text: delta.content,
                                },
                            };
                        }
                        for (const toolCall of delta.tool_calls ?? []) {
                            const index = toolCall.index ?? toolCalls.size;
                            const draft = toolCalls.get(index) ??
                                {
                                    id: toolCall.id || `call_${index}`,
                                    name: '',
                                    argumentsText: '',
                                };
                            draft.id = toolCall.id || draft.id;
                            draft.name = toolCall.function?.name || draft.name;
                            draft.argumentsText += toolCall.function?.arguments ?? '';
                            toolCalls.set(index, draft);
                        }
                    }
                }
            }
            const thinkingEndEvent = endThinking();
            if (thinkingEndEvent) {
                yield thinkingEndEvent;
            }
            if (content) {
                output.push({ type: 'text', text: content });
            }
            let nextIndex = output.length;
            for (const draft of Array.from(toolCalls.values())) {
                const part = {
                    type: 'tool_call',
                    id: draft.id,
                    name: draft.name || 'unknown_tool',
                    input: parseToolArguments(draft.argumentsText),
                };
                output.push(part);
                yield {
                    type: 'content_part',
                    provider: this.#providerId,
                    model: responseModel,
                    contentIndex: nextIndex++,
                    part,
                };
            }
            yield {
                type: 'response_complete',
                provider: this.#providerId,
                model: responseModel,
                response: {
                    provider: this.#providerId,
                    model: responseModel,
                    output,
                    stopReason,
                    usage,
                    raw: {
                        id: responseId,
                        diagnostics: {
                            baseUrl: this.#baseUrl,
                            protocol: 'openai-chat',
                            toolCount: request.tools?.length || 0,
                        },
                    },
                },
            };
        }
        catch (error) {
            if (timeoutSignalContext &&
                timeoutSignalContext.signal.aborted &&
                !request.signal?.aborted) {
                throw new Error(`${this.#providerLabel} streaming request timed out after ${formatTimeoutDuration(streamTimeoutMs)}. The provider may still be reasoning on a large context. Try /compact or switch to a faster model and retry.`);
            }
            throw error;
        }
        finally {
            timeoutSignalContext?.cleanup();
        }
    }
    async #postChatCompletion(request, stream) {
        configureGlobalFetchDispatcher();
        const apiKey = this.#apiKey?.trim();
        if (!apiKey) {
            throw new Error(this.#missingApiKeyMessage);
        }
        const requestBody = await toRequestBody({
            request,
            defaultModel: this.#defaultModel,
            defaultReasoningEffort: this.#defaultReasoningEffort,
            outputTokenParam: this.#outputTokenParam,
            outputTokenLimit: this.#outputTokenLimit,
            includeStreamUsage: this.#includeStreamUsage,
            includeTools: this.#includeTools,
            mergeSystemMessages: this.#mergeSystemMessages,
            providerId: this.#providerId,
            toolProfile: this.#toolProfile,
            resolveTemperature: this.#resolveTemperature,
            resolveThinking: this.#resolveThinking,
            stream,
        });
        const response = await this.#fetchImpl(resolveChatCompletionsUrl(this.#baseUrl), {
            method: 'POST',
            headers: {
                authorization: `Bearer ${apiKey}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: request.signal,
        });
        if (!response.ok) {
            throw new Error(await getProviderErrorMessage(response, this.#providerLabel, {
                requestBody,
                includeRequestDiagnostics: true,
            }));
        }
        return response;
    }
}
async function toRequestBody(input) {
    const model = input.request.model?.trim() || input.defaultModel;
    const toolProfile = input.toolProfile ??
        resolveProviderToolProfile({
            providerId: input.providerId,
            apiMode: 'openai-chat',
            model,
        });
    const thinking = input.resolveThinking({
        request: input.request,
        model,
    });
    const outputTokens = resolveOutputTokens(input.request.maxOutputTokens, input.outputTokenLimit);
    const temperature = input.resolveTemperature({
        request: input.request,
        model,
    });
    return {
        model,
        messages: await toOpenAiChatMessages(input.request.messages, {
            mergeSystemMessages: input.mergeSystemMessages,
            toolProfile,
        }),
        stream: input.stream,
        ...(input.stream && input.includeStreamUsage
            ? { stream_options: { include_usage: true } }
            : {}),
        ...(typeof outputTokens === 'number'
            ? { [input.outputTokenParam]: outputTokens }
            : {}),
        ...(thinking
            ? {
                thinking: {
                    type: thinking,
                },
                reasoning_effort: resolveReasoningEffort(getMetadataReasoningEffort(input.request.metadata)) ||
                    input.defaultReasoningEffort,
            }
            : typeof temperature === 'number'
                ? { temperature }
                : {}),
        ...(input.includeTools &&
            toolProfile.toolCalling.supported &&
            input.request.tools &&
            input.request.tools.length > 0
            ? {
                tools: toOpenAiChatTools(input.request.tools),
                tool_choice: 'auto',
            }
            : {}),
    };
}
function resolveOutputTokens(maxOutputTokens, outputTokenLimit) {
    if (typeof maxOutputTokens !== 'number') {
        return undefined;
    }
    return typeof outputTokenLimit === 'number'
        ? Math.min(maxOutputTokens, outputTokenLimit)
        : maxOutputTokens;
}
async function toOpenAiChatMessages(messages, options = {}) {
    const toolProfile = options.toolProfile ??
        resolveProviderToolProfile({
            providerId: 'openai-chat-compatible',
            apiMode: 'openai-chat',
        });
    const validation = validateLlmHistoryForProvider({
        messages,
        toolProfile,
    });
    if (validation.status === 'blocked') {
        throw new Error(`OpenAI Chat Completions adapter blocked invalid history: ${validation.diagnostics
            .map(diagnostic => diagnostic.detail)
            .join('; ')}`);
    }
    messages = validation.messages;
    const mapped = [];
    const mergedSystemParts = [];
    for (const message of messages) {
        if (message.role === 'tool') {
            for (const part of message.parts) {
                if (part.type !== 'tool_result') {
                    throw new Error('OpenAI Chat Completions adapter requires tool-role messages to contain only tool_result parts.');
                }
                mapped.push({
                    role: 'tool',
                    tool_call_id: part.toolCallId,
                    content: serializeToolResult(part.result),
                });
            }
            continue;
        }
        if (message.role === 'assistant') {
            let text = '';
            let reasoning = '';
            const toolCalls = [];
            for (const part of message.parts) {
                if (part.type === 'text') {
                    text += part.text;
                    continue;
                }
                if (part.type === 'thinking' && !part.redacted) {
                    reasoning += part.thinking;
                    continue;
                }
                if (part.type === 'tool_call') {
                    toolCalls.push({
                        id: part.id,
                        type: 'function',
                        function: {
                            name: part.name,
                            arguments: JSON.stringify(toObject(part.input)),
                        },
                    });
                }
            }
            if (!text.trim() && !reasoning.trim() && toolCalls.length === 0) {
                continue;
            }
            mapped.push({
                role: 'assistant',
                content: text || null,
                ...(reasoning ? { reasoning_content: reasoning } : {}),
                ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
            });
            continue;
        }
        if (message.role === 'user') {
            const content = await toOpenAiUserContent(message.parts);
            if (!content) {
                continue;
            }
            mapped.push({
                role: 'user',
                content,
                ...(message.name?.trim() ? { name: message.name.trim() } : {}),
            });
            continue;
        }
        const content = message.parts
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
            .trim();
        if (!content) {
            continue;
        }
        if (message.role === 'system' && options.mergeSystemMessages) {
            mergedSystemParts.push(content);
            continue;
        }
        mapped.push({
            role: message.role,
            content,
            ...(message.name?.trim() ? { name: message.name.trim() } : {}),
        });
    }
    if (mergedSystemParts.length > 0) {
        mapped.unshift({
            role: 'system',
            content: mergedSystemParts.join('\n\n'),
        });
    }
    if (mapped.length === 0) {
        throw new Error('OpenAI Chat Completions adapter requires at least one usable message.');
    }
    const repaired = isOpenAiChatToolResultProfile(toolProfile)
        ? repairOpenAiToolMessageSequence(mapped)
        : mapped.filter(message => message.role !== 'tool');
    if (repaired.length === 0) {
        throw new Error('OpenAI Chat Completions adapter requires at least one usable message.');
    }
    return repaired;
}
function repairOpenAiToolMessageSequence(messages) {
    const repaired = [];
    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        const toolCalls = message.role === 'assistant' && Array.isArray(message.tool_calls)
            ? message.tool_calls
            : [];
        if (message.role !== 'assistant' || toolCalls.length === 0) {
            if (message.role !== 'tool') {
                repaired.push(message);
            }
            continue;
        }
        repaired.push(message);
        const matched = new Map();
        let cursor = index + 1;
        while (cursor < messages.length && messages[cursor].role === 'tool') {
            const toolMessage = messages[cursor];
            const toolCallId = toolMessage.tool_call_id;
            if (typeof toolCallId === 'string' &&
                toolCallId &&
                !matched.has(toolCallId)) {
                matched.set(toolCallId, toolMessage);
            }
            cursor += 1;
        }
        for (const toolCall of toolCalls) {
            repaired.push(matched.get(toolCall.id) ??
                createInterruptedToolResultMessage(toolCall));
        }
        index = cursor - 1;
    }
    return repaired;
}
function createInterruptedToolResultMessage(toolCall) {
    return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({
            status: 'error',
            code: 'TOOL_CALL_INTERRUPTED',
            message: '工具调用被中断，或历史记录中缺少对应的工具结果。CCR 已补齐占位结果以恢复会话连续性。',
            toolName: toolCall.function.name,
        }),
    };
}
async function toOpenAiUserContent(parts) {
    const contentParts = [];
    let textBuffer = '';
    let hasAttachmentPart = false;
    const flushText = () => {
        const text = textBuffer.trim();
        if (text) {
            contentParts.push({ type: 'text', text });
        }
        textBuffer = '';
    };
    for (const part of parts) {
        if (part.type === 'text') {
            textBuffer += part.text;
            continue;
        }
        if (part.type === 'image') {
            hasAttachmentPart = true;
            flushText();
            contentParts.push({
                type: 'image_url',
                image_url: {
                    url: await toOpenAiImageUrl(part),
                },
            });
            continue;
        }
        if (part.type === 'video') {
            hasAttachmentPart = true;
            flushText();
            contentParts.push({
                type: 'video_url',
                video_url: {
                    url: await toOpenAiVideoUrl(part),
                },
            });
        }
    }
    if (!hasAttachmentPart) {
        const text = textBuffer.trim();
        return text || undefined;
    }
    flushText();
    return contentParts.length > 0 ? contentParts : undefined;
}
function toOpenAiChatTools(tools) {
    return tools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        },
    }));
}
function toGenerateResponse(input) {
    const choice = input.raw.choices?.[0];
    const message = choice?.message;
    const output = [];
    const reasoning = message?.reasoning_content?.trim();
    if (reasoning) {
        output.push({ type: 'thinking', thinking: reasoning });
    }
    if (message?.content) {
        output.push({ type: 'text', text: message.content });
    }
    for (const toolCall of message?.tool_calls ?? []) {
        output.push({
            type: 'tool_call',
            id: toolCall.id,
            name: toolCall.function.name,
            input: parseToolArguments(toolCall.function.arguments),
        });
    }
    if (output.length === 0) {
        throw new Error(input.emptyOutputMessage);
    }
    return {
        provider: input.provider,
        model: input.raw.model || input.fallbackModel,
        output,
        stopReason: mapStopReason(choice?.finish_reason),
        usage: input.raw.usage ? toLlmUsage(input.raw.usage) : undefined,
        raw: input.raw,
    };
}
async function* readSseChunks(body, decoder) {
    const reader = body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            if (value) {
                yield decoder.decode(value, { stream: true });
            }
        }
        const tail = decoder.decode();
        if (tail) {
            yield tail;
        }
    }
    finally {
        reader.releaseLock();
    }
}
function parseToolArguments(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return {};
    }
    try {
        return toObject(JSON.parse(trimmed));
    }
    catch {
        return { _raw: value };
    }
}
function serializeToolResult(result) {
    if (typeof result === 'string') {
        return result;
    }
    if (result === null || result === undefined) {
        return '';
    }
    try {
        return JSON.stringify(result);
    }
    catch {
        return String(result);
    }
}
function toObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function toLlmUsage(usage) {
    return {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cacheReadInputTokens: usage.prompt_cache_hit_tokens,
        raw: usage,
    };
}
function mapStopReason(reason) {
    switch (reason) {
        case 'stop':
            return 'stop';
        case 'length':
            return 'max_tokens';
        case 'tool_calls':
            return 'tool_use';
        case 'content_filter':
            return 'error';
        default:
            return 'other';
    }
}
function normalizeBaseUrl(value) {
    return value.replace(/\/+$/u, '');
}
function resolveChatCompletionsUrl(baseUrl) {
    if (baseUrl.endsWith('/chat/completions')) {
        return baseUrl;
    }
    return `${baseUrl}/chat/completions`;
}
function resolveReasoningEffort(value) {
    if (!value) {
        return undefined;
    }
    return value === 'max' || value === 'xhigh' ? 'max' : 'high';
}
function getMetadataReasoningEffort(metadata) {
    const value = metadata?.reasoningEffort;
    return typeof value === 'string' ? value : undefined;
}
const DEFAULT_OPENAI_CHAT_STREAM_TIMEOUT_MS = 10 * 60_000;
function getOpenAiChatStreamTimeoutMs() {
    const raw = process.env.CCR_OPENAI_CHAT_STREAM_TIMEOUT_MS?.trim();
    if (!raw) {
        return DEFAULT_OPENAI_CHAT_STREAM_TIMEOUT_MS;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return DEFAULT_OPENAI_CHAT_STREAM_TIMEOUT_MS;
    }
    return parsed;
}
function formatTimeoutDuration(timeoutMs) {
    if (timeoutMs % 60_000 === 0) {
        const minutes = timeoutMs / 60_000;
        return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    if (timeoutMs % 1000 === 0) {
        const seconds = timeoutMs / 1000;
        return `${seconds} second${seconds === 1 ? '' : 's'}`;
    }
    return `${timeoutMs}ms`;
}
async function getProviderErrorMessage(response, providerLabel, options = {}) {
    const text = await response.text().catch(() => '');
    let detail = text.trim();
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed.error?.message === 'string') {
            detail = parsed.error.message;
        }
    }
    catch {
        // Preserve the raw response text when it is not JSON.
    }
    const message = `${providerLabel} API request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : '.'}`;
    if (!options.includeRequestDiagnostics || !options.requestBody) {
        return message;
    }
    return `${message}; requestDiagnostics=${JSON.stringify(toSafeRequestDiagnostics(options.requestBody))}`;
}
function toSafeRequestDiagnostics(body) {
    const messages = Array.isArray(body.messages)
        ? body.messages.filter((message) => !!message && typeof message === 'object' && !Array.isArray(message))
        : [];
    const roleCounts = {};
    let totalTextChars = 0;
    let emptyContentCount = 0;
    let nonStringContentCount = 0;
    let contentPartCount = 0;
    let imageContentPartCount = 0;
    let videoContentPartCount = 0;
    let assistantToolCallCount = 0;
    let toolMessageCount = 0;
    let reasoningContentCount = 0;
    for (const message of messages) {
        const role = typeof message.role === 'string' ? message.role : 'unknown';
        roleCounts[role] = (roleCounts[role] || 0) + 1;
        if (role === 'tool') {
            toolMessageCount += 1;
        }
        if (Array.isArray(message.tool_calls)) {
            assistantToolCallCount += message.tool_calls.length;
        }
        if (typeof message.reasoning_content === 'string') {
            reasoningContentCount += 1;
        }
        if (typeof message.content === 'string') {
            totalTextChars += message.content.length;
            if (!message.content.trim()) {
                emptyContentCount += 1;
            }
            continue;
        }
        if (Array.isArray(message.content)) {
            nonStringContentCount += 1;
            for (const part of message.content) {
                if (!part || typeof part !== 'object' || Array.isArray(part)) {
                    continue;
                }
                contentPartCount += 1;
                const type = part.type;
                if (type === 'text' &&
                    typeof part.text === 'string') {
                    totalTextChars += part.text.length;
                }
                if (type === 'image_url') {
                    imageContentPartCount += 1;
                }
                if (type === 'video_url') {
                    videoContentPartCount += 1;
                }
            }
            continue;
        }
        if (message.content === null) {
            emptyContentCount += 1;
            continue;
        }
        nonStringContentCount += 1;
    }
    return {
        keys: Object.keys(body).sort(),
        model: body.model,
        stream: body.stream,
        max_tokens: body.max_tokens,
        max_completion_tokens: body.max_completion_tokens,
        temperature: body.temperature,
        top_p: body.top_p,
        hasThinking: hasOwn(body, 'thinking'),
        reasoning_effort: body.reasoning_effort,
        hasStreamOptions: hasOwn(body, 'stream_options'),
        hasToolChoice: hasOwn(body, 'tool_choice'),
        toolCount: Array.isArray(body.tools) ? body.tools.length : 0,
        messageCount: messages.length,
        roleCounts,
        firstRoles: messages
            .slice(0, 8)
            .map(message => message.role)
            .filter(role => typeof role === 'string'),
        lastRoles: messages
            .slice(-8)
            .map(message => message.role)
            .filter(role => typeof role === 'string'),
        totalTextChars,
        emptyContentCount,
        nonStringContentCount,
        contentPartCount,
        imageContentPartCount,
        videoContentPartCount,
        assistantToolCallCount,
        toolMessageCount,
        reasoningContentCount,
    };
}
function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}
//# sourceMappingURL=openaiChatCompletionsAdapter.js.map