import { normalizeCcrContentBlocks, } from '../types/contentBlocks.js';
import { isNullRenderingAttachmentType, isNullRenderingAttachmentValue, } from '../utils/nullRenderingAttachmentTypes.js';
import { extractAttachmentSnapshotsFromContentBlocks as projectAttachmentSnapshotsFromContentBlocks, formatAttachmentContentBlock as formatProjectedAttachmentContentBlock, formatAttachmentSummary as formatProjectedAttachmentSummary, isModelOutputAttachmentBlock as isProjectedModelOutputAttachmentBlock, removeGeneratedOutputImagePathsFromMessageText as removeProjectedGeneratedOutputImagePaths, removeUserUploadImagePlaceholderFromMessageText as removeProjectedUserUploadImagePlaceholder, } from './threadDisplayAttachmentProjector.js';
import { createAppServerErrorSnapshot, createToolErrorSnapshot, } from './threadDisplayErrorProjector.js';
import { extractFileDisplaySnapshotsFromToolSnapshot } from './threadDisplayFileProjector.js';
import { createProjectionIdentityFromItem, selectConfirmedProjectionBlock, } from './threadDisplayProjectorFacts.js';
import { extractToolSnapshotFromBlocks, shouldHideToolFromTimeline, } from './threadDisplayToolProjector.js';
const SYNTHETIC_MESSAGE_TEXT = new Set([
    '[Request interrupted by user]',
    '[Request interrupted by user for tool use]',
    "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.",
    "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
    'No response requested.',
]);
export function projectThreadDisplayItem(item) {
    const content = typeof item.content === 'string'
        ? [{ type: 'text', text: item.content }]
        : item.content !== undefined || !item.text.trim()
            ? item.content
            : [{ type: 'text', text: item.text }];
    const blocks = normalizeJsonBlocks(content);
    const contentBlocks = normalizeCcrContentBlocks(content);
    const identity = createProjectionIdentityFromItem(item);
    const compactSnapshot = getCompactSnapshot(item.metadata);
    if (isRawThinkingOnly(blocks) && item.type === 'assistant_message') {
        return {
            version: 1,
            event: {
                type: 'system_notice',
                text: '模型只返回了推理内容，未返回最终回复。',
                status: item.status,
                sourceKind: item.sourceKind,
                timelineHidden: true,
                identity,
                contentBlocks,
            },
        };
    }
    if ((isRawThinkingOnly(blocks) && item.type !== 'thinking_summary') ||
        isSyntheticMessageOnly(blocks)) {
        return undefined;
    }
    if (item.type === 'user_message' || item.sourceKind === 'user_message') {
        const text = getUserText(blocks) || item.text;
        const attachmentBlocks = getDisplayFactScopedBlocks(item, ['attachment']) ?? blocks;
        const attachmentSnapshots = projectAttachmentSnapshotsFromContentBlocks({
            eventId: item.id,
            blocks: attachmentBlocks,
            source: 'UserUpload',
            identity,
        });
        const displayText = removeProjectedUserUploadImagePlaceholder(text, attachmentSnapshots);
        return {
            version: 1,
            event: {
                type: 'user_message',
                text: displayText,
                status: item.status ?? 'completed',
                sourceKind: item.sourceKind ?? 'user_message',
                identity,
                attachmentSnapshots: attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
                contentBlocks,
            },
        };
    }
    const toolFactBlocks = getDisplayFactScopedBlocks(item, [
        'tool_lifecycle',
        'file',
    ]);
    const todoSnapshot = extractTodoOverlaySnapshotFromBlocks(item.id, toolFactBlocks ?? blocks, item);
    if (todoSnapshot) {
        return {
            version: 1,
            event: {
                type: 'todo_list',
                text: `TodoWrite 已更新 ${todoSnapshot.items.length} 个任务。`,
                status: item.status ?? 'completed',
                sourceKind: item.sourceKind,
                timelineHidden: item.timelineHidden,
                identity,
                todoSnapshot,
                contentBlocks,
            },
        };
    }
    if (item.type === 'error') {
        const errorSnapshot = createAppServerErrorSnapshot({
            message: item.text || stringifyToolResult(item.content),
            itemId: item.id,
            threadId: item.identity?.threadId,
            turnId: item.identity?.turnId,
        });
        return {
            version: 1,
            event: {
                type: 'error',
                text: item.text || errorSnapshot.message,
                status: item.status ?? 'failed',
                sourceKind: item.sourceKind,
                timelineHidden: item.timelineHidden,
                identity,
                contentBlocks,
                errorSnapshot,
            },
        };
    }
    const toolSnapshot = extractToolSnapshotFromBlocks(item.id, toolFactBlocks ?? blocks, item);
    if (toolSnapshot) {
        const fileDisplaySnapshots = extractFileDisplaySnapshotsFromToolSnapshot(toolSnapshot);
        const attachmentSnapshots = projectAttachmentSnapshotsFromContentBlocks({
            eventId: item.id,
            blocks: toolFactBlocks ?? blocks,
            source: 'ToolResult',
            identity,
        });
        return {
            version: 1,
            event: {
                type: toolSnapshot.kind === 'call' ? 'tool_call' : 'tool_result',
                text: toolSnapshot.summary,
                status: item.status ?? toolSnapshot.status,
                sourceKind: item.sourceKind,
                timelineHidden: item.timelineHidden ?? shouldHideToolFromTimeline(toolSnapshot),
                identity,
                toolSnapshot,
                ...fileDisplaySnapshots,
                attachmentSnapshots: attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
                contentBlocks,
                errorSnapshot: toolSnapshot.errorMessage
                    ? createToolErrorSnapshot({
                        message: toolSnapshot.errorMessage,
                        identity,
                        toolName: toolSnapshot.name,
                        errorClass: toolSnapshot.errorClass,
                        status: toolSnapshot.status,
                    })
                    : undefined,
            },
        };
    }
    const attachmentBlocks = getDisplayFactScopedBlocks(item, ['attachment']) ?? blocks;
    const attachmentSnapshots = projectAttachmentSnapshotsFromContentBlocks({
        eventId: item.id,
        blocks: attachmentBlocks,
        source: item.type === 'assistant_message' ? 'ModelOutput' : 'ToolResult',
        identity,
    });
    const messageText = removeProjectedGeneratedOutputImagePaths(getMessageText(item, blocks), attachmentSnapshots);
    if (!messageText.trim() && attachmentSnapshots.length === 0) {
        return undefined;
    }
    return {
        version: 1,
        event: {
            type: getMessageProjectionType(item),
            text: messageText,
            status: item.status,
            sourceKind: item.sourceKind,
            timelineHidden: item.timelineHidden,
            identity,
            attachmentSnapshots: attachmentSnapshots.length > 0 ? attachmentSnapshots : undefined,
            ...(compactSnapshot ? { compactSnapshot } : {}),
            contentBlocks,
        },
    };
}
function getDisplayFactScopedBlocks(item, factTypes) {
    if (item.type === 'error' &&
        (factTypes.includes('tool_lifecycle') || factTypes.includes('file'))) {
        return null;
    }
    const displayFact = getDisplayFactMetadata(item.metadata);
    const factType = getString(displayFact, ['factType']);
    if (!factType || !factTypes.includes(factType)) {
        return null;
    }
    const attachmentBlocks = getJsonObjectArray(item.metadata?.attachmentBlocks);
    if (factType === 'attachment' && attachmentBlocks.length > 0) {
        return attachmentBlocks;
    }
    const primaryBlock = getJsonObject(item.metadata?.primaryBlock);
    return primaryBlock ? [primaryBlock] : null;
}
function getDisplayFactMetadata(metadata) {
    return getJsonObject(metadata?.displayFact);
}
function getJsonObjectArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(getJsonObject(item)))
        : [];
}
function getCompactSnapshot(metadata) {
    const snapshot = getJsonObject(metadata?.compactSnapshot);
    if (!snapshot) {
        return undefined;
    }
    return {
        status: getString(snapshot, ['status']),
        trigger: getString(snapshot, ['trigger']),
        startedAt: getString(snapshot, ['startedAt']),
        completedAt: getString(snapshot, ['completedAt']),
        preCompactTokenCount: getNumber(snapshot, ['preCompactTokenCount']),
        postCompactTokenCount: getNumber(snapshot, ['postCompactTokenCount']),
        truePostCompactTokenCount: getNumber(snapshot, [
            'truePostCompactTokenCount',
        ]),
        summaryMessageCount: getNumber(snapshot, ['summaryMessageCount']),
        attachmentCount: getNumber(snapshot, ['attachmentCount']),
        hookResultCount: getNumber(snapshot, ['hookResultCount']),
    };
}
function normalizeJsonBlocks(content) {
    if (!Array.isArray(content)) {
        return content === undefined ? [] : [{ type: 'json', value: content }];
    }
    return content.map(block => block && typeof block === 'object' && !Array.isArray(block)
        ? block
        : { type: 'json', value: block });
}
function getUserText(blocks) {
    return blocks.map(getHistoryUserTextBlockValue).filter(Boolean).join('\n\n');
}
function getHistoryUserTextBlockValue(block) {
    const type = getString(block, ['type']) ?? '';
    if ((type === 'text' || type === 'input_text' || type === 'output_text') &&
        typeof block.text === 'string') {
        return block.text.trim();
    }
    if (type === 'json' && typeof block.value === 'string') {
        return block.value.trim();
    }
    return '';
}
function getMessageProjectionType(item) {
    if (item.type === 'thinking_summary') {
        return 'thinking_summary';
    }
    if (item.type === 'error') {
        return 'error';
    }
    if (item.type === 'assistant_message') {
        return 'assistant_message';
    }
    return item.type || 'system_notice';
}
function getMessageText(item, blocks) {
    const rendered = blocks.map(formatContentBlock).filter(Boolean).join('\n\n');
    if (!rendered && blocks.some(isProjectedModelOutputAttachmentBlock)) {
        return '';
    }
    return rendered || item.text;
}
function formatContentBlock(block) {
    const type = getString(block, ['type']) ?? 'json';
    if (isNullRenderingContentBlock(block, type)) {
        return '';
    }
    if (type === 'text' || type === 'input_text' || type === 'output_text') {
        return getString(block, ['text']) ?? '';
    }
    if (type === 'thinking') {
        return ['思考', limitMessageText(getString(block, ['thinking']) ?? '')]
            .filter(Boolean)
            .join('\n');
    }
    if (type === 'redacted_thinking') {
        return '思考\n思考内容已由模型服务隐藏。';
    }
    if (type === 'tool_use') {
        return [`调用工具：${getToolName(block)}`, formatJsonBlock(block.input)]
            .filter(Boolean)
            .join('\n');
    }
    if (type === 'tool_result') {
        const title = block.isError ? '工具结果：失败' : '工具结果：成功';
        return [title, stringifyToolResult(block.content)].filter(Boolean).join('\n');
    }
    if (type === 'attachment') {
        return formatProjectedAttachmentSummary(block.attachment);
    }
    if (type === 'image' || type === 'file' || type === 'audio' || type === 'video') {
        if (block.origin === 'model_output') {
            return '';
        }
        return formatProjectedAttachmentContentBlock(block);
    }
    return 'value' in block ? formatUnknownValue(block.value) : formatJsonBlock(block);
}
function isNullRenderingContentBlock(block, type) {
    if (isNullRenderingAttachmentType(type)) {
        return true;
    }
    if (type !== 'attachment') {
        return false;
    }
    return isNullRenderingAttachmentValue(block.attachment);
}
function isRawThinkingOnly(blocks) {
    return (blocks.length > 0 &&
        blocks.every(block => block.type === 'thinking' ||
            block.type === 'redacted_thinking' ||
            block.type === 'reasoning'));
}
function isSyntheticMessageOnly(blocks) {
    if (blocks.length !== 1) {
        return false;
    }
    const block = blocks[0];
    const type = getString(block, ['type']) ?? '';
    const text = (type === 'text' || type === 'input_text' || type === 'output_text') &&
        typeof block.text === 'string'
        ? block.text
        : type === 'json' && typeof block.value === 'string'
            ? block.value
            : undefined;
    return Boolean(text && SYNTHETIC_MESSAGE_TEXT.has(text));
}
function extractTodoOverlaySnapshotFromBlocks(id, blocks, item) {
    const primary = selectConfirmedProjectionBlock(blocks, item, block => block.type === 'tool_use' && getToolName(block) === 'TodoWrite');
    if (!primary) {
        return null;
    }
    const input = getJsonObject(primary.block.input);
    const todos = input?.todos;
    if (!Array.isArray(todos)) {
        return null;
    }
    const items = todos
        .map(value => {
        const object = getJsonObject(value);
        const content = getString(object, ['content']);
        if (!content) {
            return null;
        }
        return {
            content,
            status: getString(object, ['status']) ?? 'pending',
            ...(getString(object, ['activeForm'])
                ? { activeForm: getString(object, ['activeForm']) }
                : {}),
        };
    })
        .filter((value) => Boolean(value));
    return items.length
        ? {
            id,
            title: 'TodoWrite',
            items,
            identity: createProjectionIdentityFromItem(item, primary.block, primary.contentIndex),
            raw: input,
        }
        : null;
}
function formatUnknownValue(value) {
    if (typeof value === 'string') {
        return limitMessageText(value);
    }
    return formatJsonBlock(value);
}
function formatJsonBlock(value) {
    if (value === undefined) {
        return '';
    }
    try {
        const json = JSON.stringify(value, null, 2);
        return json ? `\`\`\`json\n${limitMessageText(json)}\n\`\`\`` : '';
    }
    catch {
        return String(value);
    }
}
function stringifyToolResult(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(stringifyToolResult).filter(Boolean).join('\n');
    }
    if (value && typeof value === 'object') {
        const object = value;
        if (typeof object.text === 'string') {
            return object.text;
        }
        try {
            return JSON.stringify(value);
        }
        catch {
            return String(value);
        }
    }
    return value === undefined ? '' : String(value);
}
function limitMessageText(text) {
    const maxLength = 4_000;
    return text.length <= maxLength
        ? text
        : `${text.slice(0, maxLength)}\n... 已截断 ${text.length - maxLength} 字符`;
}
function getToolName(block) {
    return getString(block, ['name']) ?? '未知工具';
}
function getJsonObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function getString(input, keys) {
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
function getNumber(input, keys) {
    if (!input) {
        return undefined;
    }
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim()) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }
    return undefined;
}
function isOneOf(value, options) {
    return value && options.includes(value) ? value : undefined;
}
//# sourceMappingURL=threadDisplayProjection.js.map