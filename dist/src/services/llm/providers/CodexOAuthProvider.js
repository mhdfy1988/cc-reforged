import { complete as piComplete, getModel as piGetModel, stream as piStream, } from '@mariozechner/pi-ai';
import { getLlmProviderConfig, loadLlmConfig } from '../llmConfig.js';
import { getLlmModelCatalogEntry } from '../modelCatalog.js';
import { getBuiltinLlmProviderDefinition } from '../providerDefinitions.js';
import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js';
import { toBase64ImageContent } from '../imageContent.js';
import { CodexOAuthImageGenerationAdapter } from '../protocols/codexOAuthImageGenerationAdapter.js';
import { CodexOAuthSession, } from '../sessions/CodexOAuthSession.js';
import { createDefaultCodexOAuthSession } from '../sessions/defaultCodexOAuthSession.js';
const DEFAULT_BASE_URL = 'https://chatgpt.com/backend-api';
const DEFAULT_MODEL = 'gpt-5.4';
const DEFAULT_TRANSPORT = 'sse';
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant. Reply clearly and concisely.';
const EMPTY_PI_USAGE = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
    },
};
export class CodexOAuthProvider {
    name = 'codex-oauth';
    definition = getBuiltinLlmProviderDefinition(this.name);
    supportsStreaming = true;
    #session;
    #baseUrl;
    #defaultModel;
    #defaultReasoningEffort;
    #defaultTransport;
    #defaultSystemPrompt;
    #completeImpl;
    #streamImpl;
    #getModelImpl;
    #fetchImpl;
    #hasCustomSession;
    constructor(options = {}) {
        const config = getLlmProviderConfig('codex-oauth');
        this.#hasCustomSession = Boolean(options.session || options.sessionOptions);
        this.#session =
            options.session ||
                (options.sessionOptions
                    ? new CodexOAuthSession(options.sessionOptions)
                    : createDefaultCodexOAuthSession());
        this.#baseUrl = normalizeBaseUrl(options.baseUrl || config?.baseUrl || DEFAULT_BASE_URL);
        this.#defaultModel =
            options.defaultModel?.trim() || config?.defaultModel || DEFAULT_MODEL;
        this.#defaultReasoningEffort = normalizeReasoningEffort(options.defaultReasoningEffort || config?.reasoningEffort);
        this.#defaultTransport =
            (options.defaultTransport ||
                normalizeTransport(config?.transport) ||
                DEFAULT_TRANSPORT);
        this.#defaultSystemPrompt =
            options.defaultSystemPrompt?.trim() ||
                config?.systemPrompt ||
                DEFAULT_SYSTEM_PROMPT;
        this.#completeImpl = options.completeImpl || piComplete;
        this.#streamImpl = options.streamImpl || piStream;
        this.#getModelImpl = options.getModelImpl || piGetModel;
        this.#fetchImpl = options.fetchImpl || fetch;
    }
    async getAvailability() {
        return this.#session.getAvailability();
    }
    async generateImage(request) {
        configureGlobalFetchDispatcher();
        const profile = getCodexProfileForRequest(request.profileId);
        const session = request.profileId && !this.#hasCustomSession
            ? createDefaultCodexOAuthSession({ profileId: request.profileId })
            : this.#session;
        const credential = await session.getValidCredential();
        const baseUrl = normalizeBaseUrl(profile?.baseUrl || this.#baseUrl);
        const model = request.model?.trim() || profile?.defaultModel || this.#defaultModel;
        const adapter = new CodexOAuthImageGenerationAdapter({
            providerId: this.name,
            providerLabel: 'Codex OAuth',
            credential,
            baseUrl,
            defaultModel: model,
            systemPrompt: this.#defaultSystemPrompt,
            fetchImpl: this.#fetchImpl,
        });
        return adapter.generateImage({
            ...request,
            model,
        });
    }
    async generate(request) {
        const prepared = await this.#prepareRequest(request);
        try {
            return await this.#generatePrepared(request, prepared);
        }
        catch (error) {
            const refreshed = await this.#refreshPreparedRequestAfterAuthFailure(error, prepared, request);
            if (!refreshed) {
                throw error;
            }
            return this.#generatePrepared(request, refreshed);
        }
    }
    async #generatePrepared(request, prepared) {
        const message = await this.#completeImpl(resolvePiAiModel({
            model: prepared.model,
            baseUrl: prepared.baseUrl,
            getModelImpl: this.#getModelImpl,
        }), prepared.context, prepared.options);
        return toGenerateResponse({
            provider: this.name,
            model: prepared.model,
            message,
            diagnostics: {
                baseUrl: prepared.baseUrl,
                transport: this.#defaultTransport,
                systemPrompt: prepared.systemPrompt,
                accountId: prepared.credential.accountId,
                reasoningEffort: prepared.reasoningEffort,
                toolCount: request.tools?.length || 0,
            },
        });
    }
    async *stream(request) {
        const prepared = await this.#prepareRequest(request);
        let yieldedEvent = false;
        try {
            for await (const event of this.#streamPrepared(request, prepared)) {
                yieldedEvent = true;
                yield event;
            }
            return;
        }
        catch (error) {
            if (yieldedEvent) {
                throw error;
            }
            const refreshed = await this.#refreshPreparedRequestAfterAuthFailure(error, prepared, request);
            if (!refreshed) {
                throw error;
            }
            for await (const event of this.#streamPrepared(request, refreshed)) {
                yield event;
            }
        }
    }
    async *#streamPrepared(request, prepared) {
        const messageStream = this.#streamImpl(resolvePiAiModel({
            model: prepared.model,
            baseUrl: prepared.baseUrl,
            getModelImpl: this.#getModelImpl,
        }), prepared.context, prepared.options);
        for await (const event of messageStream) {
            const mappedEvent = mapStreamingEvent({
                event,
                provider: this.name,
                model: prepared.model,
            });
            if (mappedEvent) {
                yield mappedEvent;
            }
        }
        const finalMessage = await messageStream.result();
        const response = toGenerateResponse({
            provider: this.name,
            model: prepared.model,
            message: finalMessage,
            diagnostics: {
                baseUrl: prepared.baseUrl,
                transport: this.#defaultTransport,
                systemPrompt: prepared.systemPrompt,
                accountId: prepared.credential.accountId,
                reasoningEffort: prepared.reasoningEffort,
                toolCount: request.tools?.length || 0,
            },
        });
        yield {
            type: 'response_complete',
            provider: this.name,
            model: prepared.model,
            response,
        };
    }
    async #prepareRequest(request, override = {}) {
        configureGlobalFetchDispatcher();
        const profile = getCodexProfileForRequest(request.profileId);
        const session = override.session ||
            (request.profileId && !this.#hasCustomSession
                ? createDefaultCodexOAuthSession({ profileId: request.profileId })
                : this.#session);
        const credential = override.credential ?? await session.getValidCredential();
        const baseUrl = normalizeBaseUrl(profile?.baseUrl || this.#baseUrl);
        const model = request.model?.trim() || profile?.defaultModel || this.#defaultModel;
        const reasoningEffort = normalizeReasoningEffort(getReasoningEffort(request.metadata) || this.#defaultReasoningEffort);
        const systemPrompt = resolveSystemPrompt(request.messages, this.#defaultSystemPrompt);
        const context = {
            systemPrompt,
            messages: await toPiAiMessages(request.messages, model),
            ...(request.tools && request.tools.length > 0
                ? { tools: toPiAiTools(request.tools) }
                : {}),
        };
        const options = {
            apiKey: credential.access,
            transport: this.#defaultTransport,
            signal: request.signal,
            ...(typeof request.maxOutputTokens === 'number'
                ? { maxTokens: request.maxOutputTokens }
                : {}),
            ...(typeof request.temperature === 'number'
                ? { temperature: request.temperature }
                : {}),
            ...(request.metadata ? { metadata: { ...request.metadata } } : {}),
            reasoningEffort,
        };
        return {
            session,
            credential,
            baseUrl,
            model,
            reasoningEffort,
            systemPrompt,
            context,
            options,
        };
    }
    async #refreshPreparedRequestAfterAuthFailure(error, prepared, request) {
        if (!isCodexOAuthInvalidatedTokenError(error) ||
            !canRefreshCodexCredential(prepared.session, prepared.credential)) {
            return null;
        }
        const refreshed = await prepared.session.refreshCredential(prepared.credential);
        await prepared.session.saveCredential(refreshed).catch(() => undefined);
        return this.#prepareRequest(request, {
            session: prepared.session,
            credential: refreshed,
        });
    }
}
function normalizeReasoningEffort(value) {
    return value === 'medium' || value === 'high' ? value : 'low';
}
function getCodexProfileForRequest(profileId) {
    const normalizedProfileId = profileId?.trim();
    if (!normalizedProfileId) {
        return undefined;
    }
    const profile = loadLlmConfig().profiles[normalizedProfileId];
    return profile?.providerType === 'codex-oauth' ? profile : undefined;
}
function normalizeTransport(value) {
    return value === 'auto' || value === 'sse' || value === 'websocket'
        ? value
        : null;
}
function normalizeBaseUrl(value) {
    return value.replace(/\/+$/u, '');
}
function getReasoningEffort(metadata) {
    if (!metadata) {
        return undefined;
    }
    const value = metadata.reasoningEffort;
    return typeof value === 'string' ? value : undefined;
}
function resolveSystemPrompt(messages, defaultSystemPrompt) {
    const textBlocks = messages
        .filter(message => message.role === 'system')
        .flatMap(message => message.parts
        .filter(part => part.type === 'text')
        .map(part => part.text.trim())
        .filter(Boolean));
    return textBlocks.length > 0
        ? textBlocks.join('\n\n')
        : defaultSystemPrompt;
}
async function toPiAiMessages(messages, model) {
    const mapped = [];
    let timestamp = Date.now();
    for (const message of messages) {
        if (message.role === 'system') {
            continue;
        }
        switch (message.role) {
            case 'user': {
                const content = await toPiAiUserContent(message.parts);
                if (!content) {
                    continue;
                }
                mapped.push({
                    role: 'user',
                    content,
                    timestamp: timestamp++,
                });
                break;
            }
            case 'assistant': {
                const content = toPiAiAssistantContent(message.parts);
                if (content.length === 0) {
                    continue;
                }
                mapped.push({
                    role: 'assistant',
                    content,
                    api: 'openai-codex-responses',
                    provider: 'openai-codex',
                    model,
                    usage: EMPTY_PI_USAGE,
                    stopReason: 'stop',
                    timestamp: timestamp++,
                });
                break;
            }
            case 'tool': {
                const toolResults = message.parts.filter((part) => part.type === 'tool_result');
                if (toolResults.length !== message.parts.length) {
                    throw new Error('CodexOAuthProvider P7 requires tool-role messages to contain only tool_result parts.');
                }
                for (const part of toolResults) {
                    mapped.push({
                        role: 'toolResult',
                        toolCallId: part.toolCallId,
                        toolName: part.toolName?.trim() || message.name?.trim() || 'unknown_tool',
                        content: [
                            {
                                type: 'text',
                                text: serializeToolResult(part.result),
                            },
                        ],
                        isError: part.isError ?? false,
                        timestamp: timestamp++,
                    });
                }
                break;
            }
            default:
                throw new Error(`CodexOAuthProvider does not support message role '${String(message.role)}'.`);
        }
    }
    if (mapped.length === 0) {
        throw new Error('CodexOAuthProvider requires at least one usable message.');
    }
    return mapped;
}
async function toPiAiUserContent(parts) {
    const hasImagePart = parts.some(part => part.type === 'image');
    if (!hasImagePart) {
        const textContent = textPartsToString(parts, 'user');
        return textContent || null;
    }
    const mapped = [];
    for (const part of parts) {
        if (part.type === 'text') {
            const text = part.text.trim();
            if (text) {
                mapped.push({
                    type: 'text',
                    text,
                });
            }
            continue;
        }
        if (part.type === 'image') {
            const { mediaType, data } = await toBase64ImageContent(part);
            mapped.push({
                type: 'image',
                data,
                mimeType: mediaType,
            });
            continue;
        }
        throw new Error('CodexOAuthProvider user messages only support text and image parts.');
    }
    return mapped.length > 0 ? mapped : null;
}
function textPartsToString(parts, role) {
    const textParts = parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('')
        .trim();
    const hasUnsupportedPart = parts.some(part => part.type !== 'text');
    if (!textParts && hasUnsupportedPart) {
        throw new Error(`CodexOAuthProvider only supports text-only ${role} content when flattening to a single text block.`);
    }
    if (hasUnsupportedPart) {
        throw new Error(`CodexOAuthProvider only supports text-only ${role} content when flattening to a single text block.`);
    }
    return textParts;
}
function toPiAiAssistantContent(parts) {
    const mapped = [];
    for (const part of parts) {
        if (part.type === 'text') {
            const text = part.text.trim();
            if (!text) {
                continue;
            }
            mapped.push({
                type: 'text',
                text,
            });
            continue;
        }
        if (part.type === 'tool_call') {
            mapped.push({
                type: 'toolCall',
                id: part.id,
                name: part.name,
                arguments: toRecord(part.input, 'tool_call input'),
            });
            continue;
        }
        if (part.type === 'thinking') {
            const thinking = part.thinking.trim();
            if (!thinking && !part.redacted) {
                continue;
            }
            mapped.push({
                type: 'thinking',
                thinking,
                ...(part.signature ? { thinkingSignature: part.signature } : {}),
                ...(part.redacted ? { redacted: true } : {}),
            });
            continue;
        }
        throw new Error('CodexOAuthProvider assistant messages only support text, thinking, and tool_call parts.');
    }
    return mapped;
}
function toPiAiTools(tools) {
    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
    }));
}
function toRecord(value, label) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    throw new Error(`CodexOAuthProvider requires ${label} to be an object.`);
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
function resolvePiAiModel(input) {
    const catalogInput = getCodexOAuthModelInput(input.model);
    try {
        const resolved = input.getModelImpl('openai-codex', input.model);
        return {
            ...resolved,
            id: resolved.id || input.model,
            name: resolved.name || input.model,
            api: 'openai-codex-responses',
            provider: 'openai-codex',
            baseUrl: input.baseUrl,
            input: mergePiAiModelInput(resolved.input, catalogInput),
        };
    }
    catch {
        return {
            id: input.model,
            name: input.model,
            api: 'openai-codex-responses',
            provider: 'openai-codex',
            baseUrl: input.baseUrl,
            reasoning: true,
            input: catalogInput,
            cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
            },
            contextWindow: 200000,
            maxTokens: 32000,
        };
    }
}
function getCodexOAuthModelInput(model) {
    const providerDefinition = getBuiltinLlmProviderDefinition('codex-oauth');
    if (!providerDefinition) {
        return ['text'];
    }
    const catalogEntry = getLlmModelCatalogEntry({
        providerId: 'codex-oauth',
        model,
        providerDefinition,
    });
    const modalities = catalogEntry.inputModalities.filter((modality) => modality === 'text' || modality === 'image');
    return modalities.length > 0 ? modalities : ['text'];
}
function mergePiAiModelInput(resolvedInput, catalogInput) {
    return Array.from(new Set([...(resolvedInput ?? []), ...catalogInput]));
}
function toGenerateResponse(input) {
    const output = extractAssistantContentParts(input.message);
    if (output.length === 0) {
        const errorMessage = extractMessageError(input.message);
        if (errorMessage) {
            throw new Error(errorMessage);
        }
        throw new Error('Codex OAuth provider returned no usable content.');
    }
    return {
        provider: input.provider,
        model: input.model,
        output,
        stopReason: mapStopReason(input.message.stopReason),
        usage: toLlmUsage(input.message.usage),
        raw: {
            message: input.message,
            diagnostics: input.diagnostics,
        },
    };
}
function extractAssistantContentParts(message) {
    const mapped = [];
    for (const item of message.content) {
        if (item.type === 'text') {
            mapped.push({
                type: 'text',
                text: item.text,
            });
            continue;
        }
        if (item.type === 'toolCall') {
            mapped.push({
                type: 'tool_call',
                id: item.id,
                name: item.name,
                input: item.arguments,
            });
            continue;
        }
        if (item.type === 'thinking') {
            mapped.push({
                type: 'thinking',
                thinking: item.thinking,
                ...(item.thinkingSignature
                    ? { signature: item.thinkingSignature }
                    : {}),
                ...(item.redacted ? { redacted: true } : {}),
            });
        }
    }
    return mapped;
}
function toLlmUsage(usage) {
    if (!usage) {
        return undefined;
    }
    return {
        inputTokens: usage.input,
        outputTokens: usage.output,
        totalTokens: usage.totalTokens,
        cacheCreationInputTokens: usage.cacheWrite,
        cacheReadInputTokens: usage.cacheRead,
        raw: usage,
    };
}
function mapStopReason(stopReason) {
    if (stopReason === 'error') {
        return 'error';
    }
    if (stopReason === 'aborted') {
        return 'cancelled';
    }
    if (stopReason === 'length') {
        return 'max_tokens';
    }
    if (stopReason === 'toolUse') {
        return 'tool_use';
    }
    if (stopReason === 'stop') {
        return 'stop';
    }
    return 'other';
}
function extractMessageError(message) {
    if (message.stopReason !== 'error' && message.stopReason !== 'aborted') {
        return null;
    }
    return message.errorMessage?.trim() || 'Codex OAuth request failed.';
}
function isCodexOAuthInvalidatedTokenError(error) {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : '';
    const normalized = message.toLowerCase();
    return (normalized.includes('authentication token has been invalidated') ||
        normalized.includes('could not validate your token') ||
        normalized.includes('token_expired'));
}
function canRefreshCodexCredential(session, credential) {
    return (Boolean(credential.refresh?.trim()) &&
        typeof session.refreshCredential === 'function');
}
function mapStreamingEvent(input) {
    switch (input.event.type) {
        case 'text_delta':
            return {
                type: 'content_part',
                provider: input.provider,
                model: input.model,
                contentIndex: input.event.contentIndex ?? 0,
                part: {
                    type: 'text',
                    text: input.event.delta,
                },
            };
        case 'thinking_start':
            return {
                type: 'thinking_start',
                provider: input.provider,
                model: input.model,
                contentIndex: input.event.contentIndex ?? 0,
            };
        case 'thinking_delta':
            return {
                type: 'thinking_delta',
                provider: input.provider,
                model: input.model,
                contentIndex: input.event.contentIndex ?? 0,
                delta: input.event.delta,
            };
        case 'thinking_end':
            return {
                type: 'thinking_end',
                provider: input.provider,
                model: input.model,
                contentIndex: input.event.contentIndex ?? 0,
                content: input.event.content,
            };
        case 'toolcall_end':
            return {
                type: 'content_part',
                provider: input.provider,
                model: input.model,
                contentIndex: input.event.contentIndex,
                part: {
                    type: 'tool_call',
                    id: input.event.toolCall.id,
                    name: input.event.toolCall.name,
                    input: input.event.toolCall.arguments,
                },
            };
        case 'error':
            throw new Error(extractMessageError(input.event.error));
        default:
            return null;
    }
}
//# sourceMappingURL=CodexOAuthProvider.js.map