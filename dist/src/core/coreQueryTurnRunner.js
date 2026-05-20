import { randomUUID } from 'node:crypto';
import { getSystemPrompt } from '../constants/prompts.js';
import { APP_SERVER_QUERY_SOURCE } from '../constants/querySource.js';
import { getSystemContext, getUserContext } from '../context.js';
import { query } from '../query.js';
import { shouldUseBuiltinLlmRuntime } from '../services/llm/claudeApiAdapter.js';
import { loadLlmConfig } from '../services/llm/llmConfig.js';
import { getLlmRuntimeAuthStatus } from '../services/llm/runtimeStatus.js';
import { getDefaultAppState } from '../state/AppStateStore.js';
import { assembleToolPool } from '../tools.js';
import { createUserMessage } from '../utils/messages.js';
import { initialPermissionModeFromCLI, initializeToolPermissionContext, } from '../utils/permissions/permissionSetup.js';
import { setCwd } from '../utils/Shell.js';
import { asSystemPrompt } from '../utils/systemPromptType.js';
import { shouldEnableThinkingByDefault } from '../utils/thinking.js';
import { CoreError } from './errors.js';
export const runCoreQueryTurn = async (input) => {
    const { turn, workspace, signal, emit, createCanUseTool, historyMessages, recordMessage, } = input;
    const runtimeMetadata = {};
    const authStatus = await getLlmRuntimeAuthStatus();
    if (!authStatus.available) {
        throw new CoreError('auth_required', authStatus.message);
    }
    setCwd(workspace.path);
    const userMessage = createUserMessage({
        content: createQueryUserMessageContent(turn),
    });
    const messagesForQuery = [...historyMessages, userMessage];
    await recordMessage(userMessage);
    emitCompletedItem(emit, {
        itemId: createItemId(),
        threadId: turn.threadId,
        turnId: turn.turnId,
        kind: 'user_message',
        content: renderUserMessageContent(turn),
    });
    const runtime = createCoreQueryRuntime({
        turn,
        messages: messagesForQuery,
        readFileState: input.readFileState,
        runtimeState: input.runtimeState,
        toolPermissionContext: await createAppServerToolPermissionContext(),
    });
    const defaultSystemPrompt = await getSystemPrompt(runtime.toolUseContext.options.tools, turn.model, Array.from(runtime.getAppState().toolPermissionContext.additionalWorkingDirectories.keys()), runtime.toolUseContext.options.mcpClients);
    const systemPrompt = asSystemPrompt([
        ...defaultSystemPrompt,
        ...getAppServerPlatformToolInstructions(),
        ...getAppServerLanguageInstructions(turn.input.text),
    ]);
    let assistantStream = null;
    let hasStreamedAssistantContent = false;
    const abortRuntime = () => {
        if (!runtime.toolUseContext.abortController.signal.aborted) {
            runtime.toolUseContext.abortController.abort(signal.reason ?? 'interrupted');
        }
    };
    if (signal.aborted) {
        abortRuntime();
    }
    else {
        signal.addEventListener('abort', abortRuntime, { once: true });
    }
    try {
        for await (const event of query({
            messages: messagesForQuery,
            systemPrompt,
            userContext: await getUserContext(),
            systemContext: await getSystemContext(),
            canUseTool: createCanUseTool({
                threadId: turn.threadId,
                turnId: turn.turnId,
            }),
            toolUseContext: runtime.toolUseContext,
            querySource: APP_SERVER_QUERY_SOURCE,
        })) {
            if (signal.aborted) {
                throw new CoreError('turn_not_active', 'Turn was interrupted.');
            }
            if (event.type === 'stream_event') {
                collectStreamEventMetadata(runtimeMetadata, event);
                const handledStream = handleStreamEvent({
                    event,
                    stream: assistantStream,
                    emit,
                    turn,
                });
                assistantStream = handledStream.stream;
                hasStreamedAssistantContent ||= handledStream.streamed;
                continue;
            }
            if (isCoreHistoryMessage(event)) {
                await recordMessage(event);
            }
            if (event.type === 'assistant' && event.isApiErrorMessage) {
                collectAssistantMetadata(runtimeMetadata, event);
                throw new CoreError('internal_error', extractAssistantText(event));
            }
            if (event.type === 'assistant' && assistantStream) {
                collectAssistantMetadata(runtimeMetadata, event);
                emit({
                    type: 'item_completed',
                    threadId: turn.threadId,
                    turnId: turn.turnId,
                    itemId: assistantStream.itemId,
                    status: 'completed',
                    content: contentFromAssistantStream(assistantStream),
                });
                assistantStream = null;
                hasStreamedAssistantContent = true;
                const content = nonStreamedAssistantContent(event);
                if (content.length > 0) {
                    emitCompletedItem(emit, {
                        itemId: createItemId(),
                        threadId: turn.threadId,
                        turnId: turn.turnId,
                        kind: messageKind(event),
                        content,
                    });
                }
                continue;
            }
            if (event.type === 'assistant' && hasStreamedAssistantContent) {
                collectAssistantMetadata(runtimeMetadata, event);
                const content = nonStreamedAssistantContent(event);
                if (content.length > 0) {
                    emitCompletedItem(emit, {
                        itemId: createItemId(),
                        threadId: turn.threadId,
                        turnId: turn.turnId,
                        kind: messageKind(event),
                        content,
                    });
                }
                continue;
            }
            if (isCoreRenderableMessage(event)) {
                if (event.type === 'assistant') {
                    collectAssistantMetadata(runtimeMetadata, event);
                }
                emitMessageItem(emit, turn, event);
            }
        }
        if (assistantStream) {
            emit({
                type: 'item_completed',
                threadId: turn.threadId,
                turnId: turn.turnId,
                itemId: assistantStream.itemId,
                status: 'completed',
                content: contentFromAssistantStream(assistantStream),
            });
        }
    }
    finally {
        signal.removeEventListener('abort', abortRuntime);
    }
    return runtimeMetadata;
};
function collectStreamEventMetadata(metadata, event) {
    if (typeof event.ttftMs === 'number') {
        metadata.timeToFirstTokenMs = event.ttftMs;
    }
    const streamEvent = event.event;
    if (streamEvent.type === 'message_start') {
        const message = getObjectRecord(streamEvent.message);
        const model = getString(message?.model);
        if (model) {
            metadata.model = model;
        }
        const requestId = getString(message?.id);
        if (requestId) {
            metadata.requestId = requestId;
        }
        const usage = normalizeUsage(message?.usage);
        if (usage) {
            metadata.usage = usage;
        }
    }
    if (streamEvent.type === 'message_delta') {
        const usage = normalizeUsage(streamEvent.usage);
        if (usage) {
            metadata.usage = usage;
        }
        const delta = getObjectRecord(streamEvent.delta);
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
    const usage = getObjectRecord(value);
    if (!usage) {
        return undefined;
    }
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
    return compactUsage({
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
    });
}
function compactUsage(usage) {
    return Object.fromEntries(Object.entries(usage).filter(([, value]) => value !== undefined));
}
function getObjectRecord(value) {
    return value && typeof value === 'object'
        ? value
        : null;
}
function getString(value) {
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function getNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
export function createCoreQueryRuntime(input) {
    enableAppServerPlatformToolDefaults();
    let appState = {
        ...getDefaultAppState(),
        ...(input.toolPermissionContext
            ? { toolPermissionContext: input.toolPermissionContext }
            : {}),
    };
    const getAppState = () => appState;
    const setAppState = (updater) => {
        appState = updater(appState);
    };
    let inProgressToolUseIDs = new Set();
    let responseLength = 0;
    const computeTools = () => filterAppServerPlatformTools(assembleToolPool(appState.toolPermissionContext, appState.mcp.tools), appState);
    const toolUseContext = {
        abortController: new AbortController(),
        options: {
            commands: appState.mcp.commands,
            tools: computeTools(),
            debug: false,
            verbose: false,
            mainLoopModel: input.turn.model,
            thinkingConfig: shouldEnableThinkingByDefault() !== false
                ? { type: 'adaptive' }
                : { type: 'disabled' },
            mcpClients: appState.mcp.clients,
            mcpResources: appState.mcp.resources,
            isNonInteractiveSession: false,
            agentDefinitions: appState.agentDefinitions,
            querySource: APP_SERVER_QUERY_SOURCE,
            refreshTools: computeTools,
        },
        getAppState,
        setAppState,
        messages: [...input.messages],
        readFileState: input.readFileState,
        nestedMemoryAttachmentTriggers: input.runtimeState?.nestedMemoryAttachmentTriggers,
        loadedNestedMemoryPaths: input.runtimeState?.loadedNestedMemoryPaths,
        dynamicSkillDirTriggers: input.runtimeState?.dynamicSkillDirTriggers,
        discoveredSkillNames: input.runtimeState?.discoveredSkillNames,
        contentReplacementState: input.runtimeState?.contentReplacementState,
        setInProgressToolUseIDs: updater => {
            inProgressToolUseIDs = updater(inProgressToolUseIDs);
        },
        setResponseLength: updater => {
            responseLength = updater(responseLength);
        },
        updateFileHistoryState: updater => {
            setAppState(prev => ({
                ...prev,
                fileHistory: updater(prev.fileHistory),
            }));
        },
        updateAttributionState: updater => {
            setAppState(prev => ({
                ...prev,
                attribution: updater(prev.attribution),
            }));
        },
    };
    return { toolUseContext, getAppState };
}
async function createAppServerToolPermissionContext() {
    const { mode } = initialPermissionModeFromCLI({
        permissionModeCli: undefined,
        dangerouslySkipPermissions: false,
    });
    const { toolPermissionContext } = await initializeToolPermissionContext({
        allowedToolsCli: [],
        disallowedToolsCli: [],
        permissionMode: mode,
        allowDangerouslySkipPermissions: false,
        addDirs: [],
    });
    return toolPermissionContext;
}
function getAppServerLanguageInstructions(userText) {
    if (!/[\u3400-\u9fff]/u.test(userText)) {
        return [];
    }
    return [
        [
            '当前用户主要使用中文。',
            '所有面向用户可见的输出都必须优先使用中文，包括阶段性说明、思考摘要、工具调用说明、工具结果解释和最终回答。',
            '工具或系统返回的原始内容可以保留原文，但你对这些内容的解释、总结和下一步说明必须使用中文。',
        ].join(' '),
    ];
}
function getAppServerPlatformToolInstructions() {
    if (process.platform !== 'win32') {
        return [];
    }
    return [
        [
            '当前 App Server 运行在 Windows 环境。',
            '处理本地文件和目录时，优先使用 Read、Write、Edit、Glob、Grep 等高层工具；不要默认依赖 bash、zsh、ls、find、grep 这类 POSIX shell 命令。',
            '如果必须执行命令，优先选择当前平台可用的 PowerShell / CMD 语义，例如 Get-ChildItem、Select-String、npm.cmd、npx.cmd；不要把 PowerShell 命令放进 Bash 工具。',
            '目录查看可以使用 PowerShell 的 Get-ChildItem；文件搜索和文件读取优先回退到 Glob、Grep、Read 等高层工具。',
        ].join(' '),
    ];
}
function enableAppServerPlatformToolDefaults() {
    if (process.platform === 'win32' &&
        process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL === undefined) {
        process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL = '1';
    }
}
function filterAppServerPlatformTools(tools, appState) {
    if (process.platform !== 'win32') {
        return tools;
    }
    return tools.filter(tool => {
        // App Server 当前没有为 Windows 提供可用的 POSIX shell 运行环境。
        // Windows 下默认启用 PowerShellTool，并移除 Bash，避免模型把
        // Get-ChildItem/dir 这类 Windows 命令错误地交给 Bash 执行。
        if (tool.name === 'Bash') {
            return false;
        }
        // App Server 还没有像 TUI 那样加载内置/自定义 agent definitions。
        // 没有可用 agent 时继续暴露 AgentTool，只会让模型绕路调用失败。
        if (tool.name === 'Agent' &&
            appState.agentDefinitions.activeAgents.length === 0) {
            return false;
        }
        return true;
    });
}
function handleStreamEvent(input) {
    const { event, emit, turn } = input;
    const streamEvent = event.event;
    let stream = input.stream;
    let streamed = false;
    const startStream = (input) => {
        if (stream) {
            emit({
                type: 'item_completed',
                threadId: turn.threadId,
                turnId: turn.turnId,
                itemId: stream.itemId,
                status: 'completed',
                content: contentFromAssistantStream(stream),
            });
        }
        stream = {
            itemId: createItemId(),
            text: input.initialText ?? '',
            kind: input.kind,
            blockType: input.blockType,
        };
        emit({
            type: 'item_started',
            item: {
                itemId: stream.itemId,
                threadId: turn.threadId,
                turnId: turn.turnId,
                kind: stream.kind,
                status: 'streaming',
                content: [],
            },
        });
        streamed = true;
    };
    if (streamEvent.type === 'content_block_start') {
        if (streamEvent.content_block.type === 'text') {
            startStream({
                kind: 'assistant_message',
                blockType: 'text',
            });
        }
        if (streamEvent.content_block.type === 'thinking') {
            startStream({
                kind: 'assistant_thinking',
                blockType: 'thinking',
                initialText: typeof streamEvent.content_block.thinking === 'string'
                    ? streamEvent.content_block.thinking
                    : '',
            });
        }
        if (streamEvent.content_block.type === 'redacted_thinking') {
            startStream({
                kind: 'assistant_thinking',
                blockType: 'redacted_thinking',
                initialText: typeof streamEvent.content_block.data === 'string'
                    ? streamEvent.content_block.data
                    : '',
            });
        }
    }
    if (streamEvent.type === 'content_block_delta' &&
        (streamEvent.delta.type === 'text_delta' ||
            streamEvent.delta.type === 'thinking_delta')) {
        const isThinking = streamEvent.delta.type === 'thinking_delta';
        const deltaText = isThinking
            ? streamEvent.delta.thinking
            : streamEvent.delta.text;
        if (!stream) {
            startStream({
                kind: isThinking ? 'assistant_thinking' : 'assistant_message',
                blockType: isThinking ? 'thinking' : 'text',
            });
        }
        stream.text += deltaText;
        emit({
            type: 'item_delta',
            threadId: turn.threadId,
            turnId: turn.turnId,
            itemId: stream.itemId,
            delta: isThinking
                ? {
                    type: 'thinking',
                    thinking: deltaText,
                }
                : {
                    type: 'text',
                    text: deltaText,
                },
        });
        streamed = true;
    }
    if (streamEvent.type === 'content_block_stop' && stream) {
        emit({
            type: 'item_completed',
            threadId: turn.threadId,
            turnId: turn.turnId,
            itemId: stream.itemId,
            status: 'completed',
            content: contentFromAssistantStream(stream),
        });
        stream = null;
        streamed = true;
    }
    return { stream, streamed };
}
function emitMessageItem(emit, turn, message) {
    emitCompletedItem(emit, {
        itemId: createItemId(),
        threadId: turn.threadId,
        turnId: turn.turnId,
        kind: messageKind(message),
        content: contentFromMessage(message),
    });
}
function emitCompletedItem(emit, item) {
    emit({
        type: 'item_started',
        item: {
            ...item,
            status: 'completed',
        },
    });
    emit({
        type: 'item_completed',
        threadId: item.threadId,
        turnId: item.turnId,
        itemId: item.itemId,
        status: 'completed',
        content: item.content,
    });
}
function isCoreRenderableMessage(event) {
    return Boolean(event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type !== 'stream_event' &&
        event.type !== 'stream_request_start' &&
        event.type !== 'tombstone');
}
function isCoreHistoryMessage(event) {
    return isCoreRenderableMessage(event);
}
function messageKind(message) {
    switch (message.type) {
        case 'assistant':
            return 'assistant_message';
        case 'user':
            return hasToolResult(message.message.content) ? 'tool_result' : 'user_message';
        case 'progress':
            return 'tool_progress';
        case 'system':
            return 'system_message';
        case 'attachment':
            return 'attachment';
        case 'tool_use_summary':
            return 'tool_use_summary';
    }
}
function contentFromMessage(message) {
    switch (message.type) {
        case 'assistant':
            return contentBlocks(message.message.content);
        case 'user':
            return contentBlocks(message.message.content, getDisplayToolResult(message.toolUseResult));
        case 'system':
            return [
                {
                    type: 'text',
                    text: Array.isArray(message.content)
                        ? message.content.join('\n')
                        : message.content ?? '',
                    ...(message.subtype ? { subtype: message.subtype } : {}),
                    ...(message.level ? { level: message.level } : {}),
                },
            ];
        case 'progress':
            return [
                {
                    type: 'progress',
                    toolUseId: message.toolUseID,
                    parentToolUseId: message.parentToolUseID,
                    data: message.data,
                },
            ];
        case 'attachment':
            return [{ type: 'attachment', attachment: message.attachment }];
        case 'tool_use_summary':
            return [
                {
                    type: 'tool_use_summary',
                    summary: message.summary,
                    precedingToolUseIds: message.precedingToolUseIds,
                },
            ];
    }
}
function contentBlocks(content, displayToolResult) {
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }
    if (!Array.isArray(content)) {
        return [{ type: 'json', value: content }];
    }
    return content.map(block => {
        if (!block || typeof block !== 'object') {
            return { type: 'json', value: block };
        }
        if ('type' in block && block.type === 'text' && 'text' in block) {
            return { type: 'text', text: block.text };
        }
        if ('type' in block && block.type === 'thinking') {
            return {
                type: 'thinking',
                thinking: 'thinking' in block ? block.thinking : '',
                signature: 'signature' in block ? block.signature : undefined,
            };
        }
        if ('type' in block && block.type === 'redacted_thinking') {
            return {
                type: 'redacted_thinking',
                data: 'data' in block ? block.data : undefined,
            };
        }
        if ('type' in block && block.type === 'tool_use') {
            return {
                type: 'tool_use',
                id: 'id' in block ? block.id : undefined,
                name: 'name' in block ? block.name : undefined,
                input: 'input' in block ? block.input : undefined,
            };
        }
        if ('type' in block && block.type === 'tool_result') {
            return {
                type: 'tool_result',
                toolUseId: 'tool_use_id' in block ? block.tool_use_id : undefined,
                isError: 'is_error' in block ? block.is_error : undefined,
                content: 'content' in block ? block.content : undefined,
                ...(displayToolResult ? { result: displayToolResult } : {}),
            };
        }
        if ('type' in block &&
            (block.type === 'image' ||
                block.type === 'file' ||
                block.type === 'audio' ||
                block.type === 'video')) {
            return { ...block, type: String(block.type) };
        }
        return { type: String('type' in block ? block.type : 'json'), value: block };
    });
}
function getDisplayToolResult(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const object = value;
    const output = object.output;
    if (Array.isArray(output) &&
        output.some(block => block &&
            typeof block === 'object' &&
            !Array.isArray(block) &&
            'type' in block &&
            block.type === 'image')) {
        return object;
    }
    return undefined;
}
function contentFromAssistantStream(stream) {
    if (stream.blockType === 'text') {
        return [{ type: 'text', text: stream.text }];
    }
    if (stream.blockType === 'redacted_thinking') {
        return [
            {
                type: 'redacted_thinking',
                ...(stream.text ? { data: stream.text } : {}),
            },
        ];
    }
    return [{ type: 'thinking', thinking: stream.text }];
}
function nonStreamedAssistantContent(message) {
    return contentFromMessage(message).filter(block => {
        const type = block.type;
        return (type !== 'text' &&
            type !== 'thinking' &&
            type !== 'redacted_thinking');
    });
}
function hasToolResult(content) {
    return (Array.isArray(content) &&
        content.some(block => block &&
            typeof block === 'object' &&
            'type' in block &&
            block.type === 'tool_result'));
}
function createItemId() {
    return `item_${randomUUID()}`;
}
function renderUserMessageContent(turn) {
    if (turn.input.type === 'text') {
        return [{ type: 'text', text: turn.input.text }];
    }
    return turn.input.content.map(block => ({ ...block }));
}
function createQueryUserMessageContent(turn) {
    if (turn.input.type !== 'content' ||
        !shouldUseBuiltinLlmRuntime(loadLlmConfig())) {
        return turn.input.text;
    }
    return turn.input.content.map(block => ({ ...block }));
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
//# sourceMappingURL=coreQueryTurnRunner.js.map