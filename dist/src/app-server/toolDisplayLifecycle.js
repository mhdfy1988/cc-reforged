const TOOL_USE_ID_KEYS = ['id', 'toolUseId', 'toolUseID', 'tool_use_id'];
const TOOL_RESULT_SOURCE_ID_KEYS = [
    'tool_use_id',
    'toolUseId',
    'toolUseID',
    'toolCallId',
    'tool_call_id',
];
export function createToolDisplayLifecycleReducer() {
    return new ToolDisplayLifecycleReducer();
}
export class ToolDisplayLifecycleReducer {
    itemsByToolUseId = new Map();
    diagnostics = [];
    nextOrder = 0;
    accept(event) {
        if (event.kind === 'tool_use') {
            return this.acceptToolUse(event.block, event.source);
        }
        if (event.kind === 'tool_progress') {
            return this.acceptToolProgress(event.block, event.source);
        }
        return this.acceptToolResult(event.block, event.source);
    }
    acceptToolUse(block, source) {
        const toolUseId = normalizeToolUseIdFromBlock(block);
        if (!toolUseId) {
            return this.createDiagnosticItem({
                source,
                block,
                code: 'missing_tool_use_id',
                message: '工具调用缺少 tool_use.id，无法生成稳定工具展示项。',
            });
        }
        const existing = this.itemsByToolUseId.get(toolUseId);
        if (existing) {
            existing.callBlock = block;
            existing.lastSeen = source;
            if (existing.status === 'diagnostic') {
                existing.status = 'running';
            }
            return toPublicItem(existing);
        }
        const item = {
            order: this.nextOrder++,
            itemId: `tool:${toolUseId}`,
            toolUseId,
            status: 'running',
            firstSeen: source,
            lastSeen: source,
            callBlock: block,
        };
        this.itemsByToolUseId.set(toolUseId, item);
        return toPublicItem(item);
    }
    acceptToolProgress(block, source) {
        const toolUseId = normalizeToolResultSourceIdFromBlock(block);
        if (!toolUseId) {
            return this.createDiagnosticItem({
                source,
                block,
                code: 'missing_tool_progress_source_id',
                message: '工具进度缺少 tool_use_id，无法绑定回工具调用。',
            });
        }
        const existing = this.itemsByToolUseId.get(toolUseId);
        if (!existing) {
            return this.createDiagnosticItem({
                source,
                block,
                code: 'orphan_tool_progress',
                message: '工具进度引用的工具调用不存在，已作为孤立工具进度诊断。',
            });
        }
        existing.progressBlock = block;
        existing.lastSeen = source;
        if (existing.status !== 'completed' && existing.status !== 'failed') {
            existing.status = 'running';
        }
        return toPublicItem(existing);
    }
    acceptToolResult(block, source) {
        const toolUseId = normalizeToolResultSourceIdFromBlock(block);
        if (!toolUseId) {
            return this.createDiagnosticItem({
                source,
                block,
                code: 'missing_tool_result_source_id',
                message: '工具结果缺少 tool_use_id，无法绑定回工具调用。',
            });
        }
        const existing = this.itemsByToolUseId.get(toolUseId);
        if (!existing) {
            return this.createDiagnosticItem({
                source,
                block,
                code: 'orphan_tool_result',
                message: '工具结果引用的工具调用不存在，已作为孤立工具结果诊断。',
            });
        }
        existing.resultBlock = block;
        existing.lastSeen = source;
        existing.status = getToolResultStatus(block);
        return toPublicItem(existing);
    }
    getItems() {
        return [...this.itemsByToolUseId.values(), ...this.diagnostics]
            .sort((left, right) => left.order - right.order)
            .map(toPublicItem);
    }
    hasToolUseId(toolUseId) {
        return this.itemsByToolUseId.has(toolUseId);
    }
    createDiagnosticItem(input) {
        const item = {
            order: this.nextOrder++,
            itemId: createDiagnosticItemId(input.code, input.source),
            status: 'diagnostic',
            firstSeen: input.source,
            lastSeen: input.source,
            resultBlock: input.block,
            diagnostic: {
                code: input.code,
                message: input.message,
            },
        };
        this.diagnostics.push(item);
        return toPublicItem(item);
    }
}
export function normalizeToolUseIdFromBlock(block) {
    return getStringField(block, TOOL_USE_ID_KEYS);
}
export function normalizeToolResultSourceIdFromBlock(block) {
    return getStringField(block, TOOL_RESULT_SOURCE_ID_KEYS);
}
function getToolResultStatus(block) {
    if (block.is_error === true ||
        block.isError === true ||
        block.error === true ||
        block.status === 'failed') {
        return 'failed';
    }
    if (block.status === 'interrupted' || block.status === 'cancelled') {
        return 'interrupted';
    }
    return 'completed';
}
function getStringField(block, keys) {
    for (const key of keys) {
        const value = block[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}
function createDiagnosticItemId(code, source) {
    const messagePart = source.messageUuid ?? 'unknown-message';
    const contentPart = source.contentIndex === undefined ? 'unknown-content' : source.contentIndex;
    return `${code}:${messagePart}:${contentPart}`;
}
function toPublicItem(item) {
    const { order: _order, ...publicItem } = item;
    void _order;
    return { ...publicItem };
}
//# sourceMappingURL=toolDisplayLifecycle.js.map