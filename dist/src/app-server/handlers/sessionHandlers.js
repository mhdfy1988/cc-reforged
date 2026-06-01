import { SessionHistoryListParamsSchema, SessionHistoryRenameParamsSchema, ThreadListParamsSchema, ThreadMessagesListParamsSchema, ThreadResumeParamsSchema, ThreadStartParamsSchema, TurnInterruptParamsSchema, TurnStartParamsSchema, } from '../protocol.js';
import { normalizeTurnStartInputForCurrentModel } from '../turnInput.js';
import { buildThreadDisplaySnapshot } from '../threadDisplay.js';
import { enrichToolResultReplayContentWithGeneratedOutputs, } from '../threadReplayContent.js';
import { getOriginalCwd } from '../../bootstrap/state.js';
import { getWorktreePaths } from '../../utils/getWorktreePaths.js';
import { getSessionIdFromLog, loadAllProjectsMessageLogsProgressive, loadSameRepoMessageLogsProgressive, saveCustomTitle, } from '../../utils/sessionStorage.js';
import { materializeConversationFromTranscript } from '../../utils/conversationMaterialization.js';
import { sanitizeGeneratedArtifactsForResume } from '../../utils/generatedArtifacts.js';
import { basename } from 'node:path';
export function handleThreadStart(context, params) {
    const parsedParams = ThreadStartParamsSchema.parse(params ?? {});
    return {
        thread: context.core.session.startThread(parsedParams),
    };
}
export function handleThreadList(context, params) {
    ThreadListParamsSchema.parse(params ?? {});
    return {
        threads: context.core.session.listThreads(),
    };
}
export function handleThreadMessagesList(context, params) {
    const parsedParams = ThreadMessagesListParamsSchema.parse(params);
    const messages = toAppServerThreadMessages(context.core.session.listThreadMessages(parsedParams.threadId));
    return {
        messages,
        messagesSemantics: 'current_context_compat',
        displaySnapshot: buildThreadDisplaySnapshot({
            threadId: parsedParams.threadId,
            source: 'thread',
            messages,
            rawTranscriptEvents: messages.length,
            coreContextMessages: messages.length,
        }),
    };
}
export async function handleSessionHistoryList(context, params) {
    const parsedParams = SessionHistoryListParamsSchema.parse(params ?? {});
    const limit = parsedParams.limit ?? 50;
    const cursorOffset = parseCursorOffset(parsedParams.cursor);
    const query = normalizeSearchText(parsedParams.query);
    const currentSessions = getCurrentSessionStatuses(context);
    const initialEnrichCount = Math.min(Math.max(cursorOffset + limit + 1, query ? 200 : limit + 1), 500);
    const result = parsedParams.scope === 'allProjects'
        ? await loadAllProjectsMessageLogsProgressive(undefined, initialEnrichCount)
        : await loadSameRepoMessageLogsProgressive(await getWorktreePaths(getOriginalCwd()).catch(() => [getOriginalCwd()]), undefined, initialEnrichCount);
    const historyItems = result.logs
        .map(log => logToHistoryItem(log, currentSessions))
        .filter((item) => item !== null)
        .filter(item => parsedParams.includeCurrent || !item.isCurrentSession)
        .filter(item => historyItemMatchesQuery(item, query));
    const pageItems = historyItems.slice(cursorOffset, cursorOffset + limit);
    const groups = groupHistoryItems(pageItems, getOriginalCwd());
    const hasMore = historyItems.length > cursorOffset + limit ||
        result.nextIndex < result.allStatLogs.length;
    return {
        groups,
        ...(hasMore ? { nextCursor: String(cursorOffset + limit) } : {}),
    };
}
export async function handleSessionHistoryRename(context, params) {
    const parsedParams = SessionHistoryRenameParamsSchema.parse(params);
    await saveCustomTitle(parsedParams.sessionId, parsedParams.title, parsedParams.transcriptPath);
    context.core.session.renameThreadBySessionId(parsedParams.sessionId, parsedParams.title);
    return {
        sessionId: parsedParams.sessionId,
        title: parsedParams.title,
    };
}
export async function handleThreadResume(context, params) {
    const parsedParams = ThreadResumeParamsSchema.parse(params);
    const thread = await context.core.session.resumeThread({
        sessionId: parsedParams.sessionId,
        ...(parsedParams.title ? { title: parsedParams.title } : {}),
        ...(parsedParams.transcriptPath
            ? { transcriptPath: parsedParams.transcriptPath }
            : {}),
        ...(parsedParams.projectPath ? { projectPath: parsedParams.projectPath } : {}),
        ...(parsedParams.metadata ? { metadata: parsedParams.metadata } : {}),
    });
    const fallbackMessages = context.core.session.listThreadMessages(thread.threadId);
    const replayPayload = await loadThreadResumeReplayPayload(parsedParams.transcriptPath, fallbackMessages);
    const messages = toAppServerThreadMessages(replayPayload.messages);
    return {
        thread,
        messages,
        messagesSemantics: replayPayload.messagesSemantics,
        displaySnapshot: buildThreadDisplaySnapshot({
            threadId: thread.threadId,
            sessionId: parsedParams.sessionId,
            source: 'history',
            messages,
            rawTranscriptEvents: replayPayload.rawTranscriptEvents,
            coreContextMessages: replayPayload.coreContextMessages,
            canonicalLeafUuid: replayPayload.canonicalLeafUuid,
            diagnostics: replayPayload.diagnostics,
        }),
    };
}
export function handleTurnStart(context, params) {
    const parsedParams = TurnStartParamsSchema.parse(params);
    const normalizedInput = normalizeTurnStartInputForCurrentModel({
        params: parsedParams,
        model: context.core.model,
    });
    return {
        turn: context.core.session.startTurn({
            threadId: parsedParams.threadId,
            input: normalizedInput.input,
            ...(normalizedInput.metadata ? { metadata: normalizedInput.metadata } : {}),
        }),
    };
}
export function handleTurnInterrupt(context, params) {
    const parsedParams = TurnInterruptParamsSchema.parse(params);
    return context.core.session.interruptTurn({
        threadId: parsedParams.threadId,
        turnId: parsedParams.turnId,
        ...(parsedParams.reason ? { reason: parsedParams.reason } : {}),
    });
}
async function loadThreadResumeReplayPayload(transcriptPath, fallbackMessages) {
    if (!transcriptPath) {
        return createFallbackReplayPayload(fallbackMessages);
    }
    try {
        const materialized = await materializeConversationFromTranscript(transcriptPath);
        const diagnostics = [...materialized.diagnostics];
        if (materialized.status !== 'ok') {
            diagnostics.push({
                level: 'error',
                code: 'history_materialization_failed',
                message: '历史 transcript 当前上下文物化失败；展示仍使用 transcript 原始投影。',
                details: {
                    displaySource: 'transcript_display_replay',
                },
            });
        }
        const replayMessages = materialized.displayReplayEvents.length > 0
            ? materialized.displayReplayEvents
            : fallbackMessages;
        return {
            messages: replayMessages,
            messagesSemantics: materialized.displayReplayEvents.length > 0
                ? 'display_replay_compat'
                : 'current_context_compat',
            rawTranscriptEvents: materialized.rawTranscriptEvents,
            coreContextMessages: materialized.coreContextMessages,
            canonicalLeafUuid: materialized.status === 'ok' ? materialized.canonicalLeafUuid : undefined,
            diagnostics,
        };
    }
    catch {
        return createFallbackReplayPayload(fallbackMessages, {
            level: 'error',
            code: 'history_materialization_load_failed',
            message: '读取历史 transcript 物化结果失败；仅展示 Core 当前消息。',
            details: {
                fallbackSource: 'core_current_thread',
            },
        });
    }
}
function createFallbackReplayPayload(messages, diagnostic) {
    return {
        messages,
        messagesSemantics: 'current_context_compat',
        rawTranscriptEvents: messages.length,
        coreContextMessages: messages.length,
        diagnostics: diagnostic ? [diagnostic] : [],
    };
}
function toAppServerThreadMessages(messages) {
    const unresolvedToolUseIds = collectUnresolvedToolUseIds(messages);
    const replayMessages = [];
    for (const [index, message] of messages.entries()) {
        const compactNotice = createCompactBoundaryReplayNotice(message, index);
        if (compactNotice) {
            replayMessages.push(compactNotice);
            continue;
        }
        const interruptedNotice = createInterruptedReplayNotice(message, index, messages);
        if (interruptedNotice) {
            replayMessages.push(interruptedNotice);
            continue;
        }
        const replayMessage = messageToThreadMessage(message, index, unresolvedToolUseIds);
        if (replayMessage) {
            replayMessages.push(replayMessage);
        }
    }
    return replayMessages;
}
function messageToThreadMessage(message, index, unresolvedToolUseIds) {
    if (isHiddenHistoryMessage(message)) {
        return null;
    }
    const text = extractMessageDisplayText(message);
    if (!text.trim()) {
        return null;
    }
    const replayContent = getThreadMessageReplayContent(message, unresolvedToolUseIds);
    return {
        id: typeof message.uuid === 'string' ? message.uuid : `history-${index}`,
        role: getThreadMessageRole(message),
        text: truncateThreadMessageText(text),
        status: 'completed',
        kind: message.type,
        sourceType: message.type,
        ...(replayContent !== undefined ? { content: replayContent } : {}),
        ...(typeof message.timestamp === 'string'
            ? { createdAt: message.timestamp }
            : {}),
    };
}
function isHiddenHistoryMessage(message) {
    return (('isMeta' in message && message.isMeta === true) ||
        ('isVisibleInTranscriptOnly' in message &&
            message.isVisibleInTranscriptOnly === true) ||
        ('isVirtual' in message && message.isVirtual === true) ||
        isCompactSummaryHistoryMessage(message) ||
        isSyntheticHistoryMessage(message));
}
function isCompactBoundaryHistoryMessage(message) {
    return (message.type === 'system' &&
        (message.subtype === 'compact_boundary' ||
            message.subtype === 'microcompact_boundary'));
}
function isCompactSummaryHistoryMessage(message) {
    if (message.type !== 'user') {
        return false;
    }
    if (message.isCompactSummary === true) {
        return true;
    }
    const text = getSyntheticHistoryMessageText(message);
    return Boolean(text &&
        COMPACT_SUMMARY_PREFIXES.some(prefix => text.startsWith(prefix)));
}
function createCompactBoundaryReplayNotice(message, index) {
    if (!isCompactBoundaryHistoryMessage(message)) {
        return null;
    }
    const text = '上下文已压缩。';
    const sourceType = typeof message.subtype === 'string' ? message.subtype : 'compact_boundary';
    return {
        id: typeof message.uuid === 'string'
            ? `${message.uuid}-compact-notice`
            : `history-${index}-compact-notice`,
        role: 'system',
        text,
        status: 'completed',
        kind: 'context_compaction',
        sourceType,
        content: [{ type: 'text', text }],
        ...(typeof message.timestamp === 'string'
            ? { createdAt: message.timestamp }
            : {}),
    };
}
function createInterruptedReplayNotice(message, index, messages) {
    if (message.type !== 'assistant' ||
        message.isApiErrorMessage === true ||
        getSyntheticHistoryMessageText(message) !== 'No response requested.') {
        return null;
    }
    const previousMessage = findPreviousVisibleHistoryMessage(messages, index);
    if (!previousMessage || previousMessage.type !== 'user') {
        return null;
    }
    return {
        id: typeof message.uuid === 'string'
            ? `${message.uuid}-interrupted-notice`
            : `history-${index}-interrupted-notice`,
        role: 'system',
        text: '本轮已中断，未产生可恢复回复。',
        status: 'interrupted',
        kind: 'interrupted_replay_notice',
        sourceType: 'synthetic_recovery',
        content: [{ type: 'text', text: '本轮已中断，未产生可恢复回复。' }],
        ...(typeof message.timestamp === 'string'
            ? { createdAt: message.timestamp }
            : {}),
    };
}
function findPreviousVisibleHistoryMessage(messages, beforeIndex) {
    for (let index = beforeIndex - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message ||
            message.type === 'system' ||
            message.type === 'progress' ||
            isToolResultHistoryMessage(message) ||
            isHiddenHistoryMessage(message)) {
            continue;
        }
        return message;
    }
    return undefined;
}
function isToolResultHistoryMessage(message) {
    if (message.type !== 'user') {
        return false;
    }
    const content = message.message?.content;
    return (Array.isArray(content) &&
        content.some(block => block &&
            typeof block === 'object' &&
            'type' in block &&
            block.type === 'tool_result'));
}
function isSyntheticHistoryMessage(message) {
    const text = getSyntheticHistoryMessageText(message);
    return Boolean(text && SYNTHETIC_HISTORY_MESSAGES.has(text));
}
function getSyntheticHistoryMessageText(message) {
    if (message.type === 'system') {
        return getSingleSyntheticText(message.content);
    }
    if (message.type !== 'assistant' && message.type !== 'user') {
        return undefined;
    }
    return getSingleSyntheticText(message.message?.content);
}
function getSingleSyntheticText(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content) || content.length !== 1) {
        return undefined;
    }
    const [block] = content;
    if (typeof block === 'string') {
        return block;
    }
    return block &&
        typeof block === 'object' &&
        'text' in block &&
        typeof block.text === 'string'
        ? block.text
        : undefined;
}
const SYNTHETIC_HISTORY_MESSAGES = new Set([
    '[Request interrupted by user]',
    '[Request interrupted by user for tool use]',
    "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.",
    "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
    'No response requested.',
]);
const COMPACT_SUMMARY_PREFIXES = [
    'This session is being continued from a previous conversation that ran out of context.',
];
function getThreadMessageRole(message) {
    if (message.type === 'user') {
        return 'user';
    }
    if (message.type === 'assistant') {
        return message.isApiErrorMessage ? 'error' : 'assistant';
    }
    return 'system';
}
function extractMessageDisplayText(message) {
    switch (message.type) {
        case 'user':
        case 'assistant':
            return extractContentDisplayText(message.message?.content);
        case 'system':
            return extractContentDisplayText(message.content);
        case 'attachment':
            return extractAttachmentDisplayText(message.attachment);
        case 'progress':
            return extractContentDisplayText(message.data);
        case 'tool_use_summary':
            return message.summary;
    }
}
function extractContentDisplayText(value) {
    if (typeof value === 'string') {
        return stripSystemReminders(value);
    }
    if (Array.isArray(value)) {
        return value
            .map(extractContentBlockDisplayText)
            .filter(Boolean)
            .join('\n')
            .trim();
    }
    return extractUnknownDisplayText(value);
}
function getThreadMessageReplayContent(message, unresolvedToolUseIds) {
    switch (message.type) {
        case 'user':
            return sanitizeGeneratedArtifactsForResume(enrichToolResultReplayContentWithGeneratedOutputs(message.message?.content, message.toolUseResult));
        case 'assistant':
            return sanitizeGeneratedArtifactsForResume(annotateUnresolvedToolUseBlocks(message.message?.content, unresolvedToolUseIds));
        case 'system':
            return sanitizeGeneratedArtifactsForResume(message.content);
        case 'attachment':
            return sanitizeGeneratedArtifactsForResume([
                { type: 'attachment', attachment: message.attachment },
            ]);
        case 'progress':
            return sanitizeGeneratedArtifactsForResume([
                {
                    type: 'progress',
                    data: message.data,
                    toolUseId: message.toolUseID,
                    toolUseID: message.toolUseID,
                    tool_use_id: message.toolUseID,
                    parentToolUseId: message.parentToolUseID,
                    parentToolUseID: message.parentToolUseID,
                    parent_tool_use_id: message.parentToolUseID,
                },
            ]);
        case 'tool_use_summary':
            return [{ type: 'tool_use_summary', summary: message.summary }];
    }
}
function collectUnresolvedToolUseIds(messages) {
    const toolUseIds = new Set();
    const toolResultIds = new Set();
    for (const message of messages) {
        for (const block of getMessageContentBlocks(message)) {
            const type = getContentBlockType(block);
            if (type === 'tool_use') {
                const toolUseId = getToolUseBlockId(block);
                if (toolUseId) {
                    toolUseIds.add(toolUseId);
                }
            }
            if (type === 'tool_result') {
                const toolUseId = getToolResultBlockToolUseId(block);
                if (toolUseId) {
                    toolResultIds.add(toolUseId);
                }
            }
        }
    }
    for (const toolUseId of toolResultIds) {
        toolUseIds.delete(toolUseId);
    }
    return toolUseIds;
}
function annotateUnresolvedToolUseBlocks(content, unresolvedToolUseIds) {
    if (!Array.isArray(content) || unresolvedToolUseIds.size === 0) {
        return content;
    }
    let changed = false;
    const annotated = content.map(block => {
        if (!isRecord(block) || getContentBlockType(block) !== 'tool_use') {
            return block;
        }
        const toolUseId = getToolUseBlockId(block);
        if (!toolUseId || !unresolvedToolUseIds.has(toolUseId)) {
            return block;
        }
        changed = true;
        return {
            ...block,
            status: 'interrupted',
            historyStatus: 'interrupted',
            statusText: 'interrupted',
            interruptedReason: 'missing_tool_result_on_history_replay',
        };
    });
    return changed ? annotated : content;
}
function getMessageContentBlocks(message) {
    const content = message.type === 'assistant' || message.type === 'user'
        ? message.message?.content
        : message.type === 'system'
            ? message.content
            : undefined;
    if (!Array.isArray(content)) {
        return [];
    }
    return content.filter(isRecord);
}
function getContentBlockType(block) {
    return typeof block.type === 'string' ? block.type : '';
}
function getToolUseBlockId(block) {
    return getStringField(block, ['id', 'toolUseId', 'toolUseID', 'tool_use_id']);
}
function getToolResultBlockToolUseId(block) {
    return getStringField(block, [
        'tool_use_id',
        'toolUseId',
        'toolUseID',
        'toolCallId',
        'tool_call_id',
    ]);
}
function getStringField(block, keys) {
    for (const key of keys) {
        const value = block[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }
    return undefined;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function extractContentBlockDisplayText(block) {
    if (!block || typeof block !== 'object') {
        return extractUnknownDisplayText(block);
    }
    const object = block;
    const type = typeof object.type === 'string' ? object.type : '';
    if (isTextLikeContentBlockType(type)) {
        return extractContentDisplayText(object.text);
    }
    if (type === 'tool_use') {
        const name = typeof object.name === 'string' ? object.name : '工具';
        const input = extractUnknownDisplayText(object.input);
        return input ? `工具调用：${name}\n${input}` : `工具调用：${name}`;
    }
    if (type === 'tool_result') {
        const result = extractUnknownDisplayText(object.content);
        return result ? `工具结果：\n${result}` : '工具结果';
    }
    if (type === 'image' || type === 'image_url' || type === 'input_image') {
        return '[图片]';
    }
    if (type === 'file' || type === 'input_file') {
        return '[文件]';
    }
    if (type === 'audio' || type === 'input_audio') {
        return '[音频]';
    }
    if (type === 'video' || type === 'video_url' || type === 'input_video') {
        return '[视频]';
    }
    if (type === 'image_generation_call') {
        return getGeneratedArtifactDisplayText(object);
    }
    if (type === 'thinking' ||
        type === 'redacted_thinking' ||
        type === 'reasoning') {
        return '';
    }
    return extractUnknownDisplayText(object.text ?? object.content ?? object);
}
function isTextLikeContentBlockType(type) {
    return type === 'text' || type === 'input_text' || type === 'output_text';
}
function extractAttachmentDisplayText(attachment) {
    if (!attachment || typeof attachment !== 'object') {
        return '';
    }
    const object = attachment;
    const type = typeof object.type === 'string' ? object.type : 'attachment';
    const text = extractUnknownDisplayText(object.content ?? object.prompt ?? object.text ?? object.path);
    return text ? `附件：${type}\n${text}` : `附件：${type}`;
}
function extractUnknownDisplayText(value, depth = 0) {
    if (typeof value === 'string') {
        return stripSystemReminders(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (!value || depth > 2) {
        return '';
    }
    if (Array.isArray(value)) {
        return value
            .map(item => extractUnknownDisplayText(item, depth + 1))
            .filter(Boolean)
            .join('\n');
    }
    const object = value;
    if (isGeneratedArtifactSummaryObject(object)) {
        return getGeneratedArtifactDisplayText(object);
    }
    const preferredKeys = [
        'text',
        'content',
        'output',
        'result',
        'message',
        'stdout',
        'stderr',
        'command',
        'pattern',
        'file_path',
        'path',
        'prompt',
        'query',
        'url',
    ];
    const parts = [];
    for (const key of preferredKeys) {
        const text = extractUnknownDisplayText(object[key], depth + 1);
        if (text) {
            parts.push(text);
        }
    }
    return parts.join('\n');
}
function isGeneratedArtifactSummaryObject(object) {
    const type = typeof object.type === 'string' ? object.type : '';
    const kind = typeof object.kind === 'string' ? object.kind : '';
    const origin = typeof object.origin === 'string' ? object.origin : '';
    return (type === 'image_generation_call' ||
        kind === 'image_generation_call' ||
        origin === 'model_output' ||
        Boolean(object.generatedArtifact) ||
        Boolean(object.generated_artifact) ||
        Boolean(object.savedPath) ||
        Boolean(object.saved_path));
}
function getGeneratedArtifactDisplayText(object) {
    const savedPath = typeof object.savedPath === 'string'
        ? object.savedPath
        : typeof object.saved_path === 'string'
            ? object.saved_path
            : undefined;
    if (savedPath) {
        return `生成物：${savedPath}`;
    }
    const id = typeof object.id === 'string'
        ? object.id
        : typeof object.outputId === 'string'
            ? object.outputId
            : typeof object.output_id === 'string'
                ? object.output_id
                : undefined;
    return id ? `生成物：${id}` : '生成物';
}
function stripSystemReminders(value) {
    let text = value;
    let open = text.indexOf('<system-reminder>');
    while (open >= 0) {
        const close = text.indexOf('</system-reminder>', open);
        if (close < 0) {
            break;
        }
        text =
            text.slice(0, open) + text.slice(close + '</system-reminder>'.length);
        open = text.indexOf('<system-reminder>');
    }
    return text.trim();
}
function truncateThreadMessageText(text) {
    const normalized = text.trim();
    const maxLength = 12000;
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength).trim()}\n\n[历史消息过长，已截断显示]`
        : normalized;
}
function logToHistoryItem(log, currentSessions) {
    const sessionId = getSessionIdFromLog(log) ?? extractSessionIdFromPath(log.fullPath);
    if (!sessionId) {
        return null;
    }
    const titleParts = selectHistoryTitle(log, sessionId);
    const currentSession = currentSessions.get(sessionId);
    const isCurrentSession = Boolean(currentSession);
    const activeTurnId = currentSession?.activeTurnId ?? null;
    const firstPrompt = normalizeTitle(log.firstPrompt);
    const lastPrompt = normalizeTitle(log.lastPrompt);
    return {
        sessionId,
        threadId: `history_${sessionId}`,
        title: titleParts.title,
        titleSource: titleParts.source,
        ...(firstPrompt ? { firstPrompt } : {}),
        ...(lastPrompt ? { lastPrompt } : {}),
        ...(normalizeTitle(log.summary) ? { summary: normalizeTitle(log.summary) } : {}),
        createdAt: log.created.toISOString(),
        updatedAt: log.modified.toISOString(),
        messageCount: log.messageCount,
        ...(log.projectPath ? { projectPath: log.projectPath } : {}),
        ...(log.fullPath ? { transcriptPath: log.fullPath } : {}),
        isCurrentSession,
        ...(isCurrentSession ? { activeTurnId } : {}),
        status: activeTurnId ? 'running' : isCurrentSession ? 'current' : 'closed',
    };
}
function selectHistoryTitle(log, sessionId) {
    const customTitle = normalizeTitle(log.customTitle);
    if (customTitle) {
        return { title: customTitle, source: 'customTitle' };
    }
    const prompt = normalizeTitle(log.firstPrompt);
    if (prompt) {
        return { title: prompt, source: 'firstPrompt' };
    }
    return {
        title: `未命名会话 ${shortSessionId(sessionId)}`,
        source: 'fallback',
    };
}
function normalizeTitle(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const title = value.replace(/\s+/g, ' ').trim();
    if (!title || title === '(session)') {
        return undefined;
    }
    return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}
function normalizeSearchText(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function historyItemMatchesQuery(item, query) {
    if (!query) {
        return true;
    }
    return [
        item.title,
        item.firstPrompt,
        item.lastPrompt,
        item.summary,
        item.sessionId,
        item.projectPath,
        item.transcriptPath,
    ]
        .filter((value) => typeof value === 'string')
        .some(value => value.toLowerCase().includes(query));
}
function groupHistoryItems(items, currentWorkspacePath) {
    const byWorkspace = new Map();
    for (const item of items) {
        const workspacePath = item.projectPath ?? '未知工作区';
        const group = byWorkspace.get(workspacePath);
        if (group) {
            group.push(item);
        }
        else {
            byWorkspace.set(workspacePath, [item]);
        }
    }
    return [...byWorkspace.entries()]
        .map(([workspacePath, sessions]) => {
        sessions.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
        return {
            workspacePath,
            workspaceName: getWorkspaceName(workspacePath),
            isCurrentWorkspace: pathsEqual(workspacePath, currentWorkspacePath),
            updatedAt: sessions[0]?.updatedAt ?? new Date(0).toISOString(),
            sessionCount: sessions.length,
            sessions,
        };
    })
        .sort((left, right) => {
        if (left.isCurrentWorkspace !== right.isCurrentWorkspace) {
            return left.isCurrentWorkspace ? -1 : 1;
        }
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
}
function getCurrentSessionStatuses(context) {
    const sessions = new Map();
    for (const thread of context.core.session.listThreads()) {
        if (thread.status !== 'active') {
            continue;
        }
        for (const key of ['sessionId', 'resumedFromSessionId']) {
            const value = thread.metadata[key];
            if (typeof value === 'string' && value.trim()) {
                sessions.set(value, { activeTurnId: thread.activeTurnId ?? null });
            }
        }
    }
    return sessions;
}
function getWorkspaceName(workspacePath) {
    if (workspacePath === '未知工作区') {
        return workspacePath;
    }
    return basename(workspacePath) || workspacePath;
}
function pathsEqual(left, right) {
    return process.platform === 'win32'
        ? left.toLowerCase() === right.toLowerCase()
        : left === right;
}
function parseCursorOffset(cursor) {
    if (!cursor) {
        return 0;
    }
    const offset = Number.parseInt(cursor, 10);
    return Number.isFinite(offset) && offset > 0 ? offset : 0;
}
function shortSessionId(sessionId) {
    return sessionId.length > 10 ? sessionId.slice(0, 10) : sessionId;
}
function extractSessionIdFromPath(path) {
    const match = path?.match(/([^\\/]+)\.jsonl$/);
    return match?.[1];
}
//# sourceMappingURL=sessionHandlers.js.map