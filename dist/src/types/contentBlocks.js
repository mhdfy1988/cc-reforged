export function normalizeCcrContentBlocks(content) {
    if (!Array.isArray(content)) {
        return content === undefined ? [] : [{ type: 'json', value: content }];
    }
    return content.map(normalizeCcrContentBlock);
}
export function normalizeCcrContentBlock(content) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
        return { type: 'json', value: content };
    }
    const block = content;
    const type = typeof block.type === 'string' ? block.type : 'json';
    if (type === 'text' || type === 'input_text' || type === 'output_text') {
        return {
            type: 'text',
            text: getString(block.text) ?? getString(block.value) ?? '',
            raw: block,
        };
    }
    if (type === 'thinking' || type === 'reasoning') {
        return {
            type: 'thinking',
            thinking: getString(block.thinking) ??
                getString(block.text) ??
                getString(block.content) ??
                '',
            signature: getString(block.signature),
            redacted: Boolean(block.redacted),
            raw: block,
        };
    }
    if (type === 'redacted_thinking') {
        return {
            type: 'thinking',
            thinking: '',
            signature: getString(block.signature),
            redacted: true,
            raw: block,
        };
    }
    if (type === 'image' || type === 'file' || type === 'audio' || type === 'video') {
        return normalizeAttachmentBlock(type, block);
    }
    if (type === 'attachment') {
        const attachment = getRecord(block.attachment);
        return attachment
            ? normalizeCcrContentBlock(attachment)
            : { type: 'json', value: block, raw: block };
    }
    if (type === 'tool_call' || type === 'tool_use') {
        return {
            type: 'tool_call',
            id: getString(block.id) ??
                getString(block.toolCallId) ??
                getString(block.tool_use_id) ??
                '',
            name: getString(block.name) ?? 'unknown_tool',
            input: block.input,
            provider: getString(block.provider),
            model: getString(block.model),
            raw: block,
        };
    }
    if (type === 'tool_result') {
        return {
            type: 'tool_result',
            toolCallId: getString(block.toolCallId) ??
                getString(block.tool_use_id) ??
                getString(block.toolUseId) ??
                '',
            toolName: getString(block.toolName) ?? getString(block.name),
            result: 'result' in block ? block.result : block.content,
            isError: Boolean(block.isError) || Boolean(block.is_error),
            raw: block,
        };
    }
    if (type === 'error') {
        return {
            type: 'error',
            message: getString(block.message) ?? getString(block.text) ?? 'Unknown error',
            category: getString(block.category),
            source: getString(block.source),
            retryable: getRetryable(block.retryable),
            raw: block,
        };
    }
    if (type === 'structured') {
        return {
            type: 'structured',
            value: 'value' in block ? block.value : block,
            label: getString(block.label),
            schema: block.schema,
            raw: block,
        };
    }
    return {
        type: 'json',
        value: 'value' in block ? block.value : block,
        label: getString(block.label),
        raw: block,
    };
}
export function cloneCcrContentSource(source) {
    return source ? { ...source } : undefined;
}
function normalizeAttachmentBlock(type, block) {
    return {
        type,
        attachmentId: getString(block.attachmentId) ?? getString(block.attachment_id),
        displayName: getString(block.displayName) ?? getString(block.display_name),
        mimeType: getString(block.mimeType) ??
            getString(block.mime_type) ??
            getString(block.mediaType),
        sizeBytes: getNumber(block.sizeBytes) ?? getNumber(block.size_bytes),
        source: getContentSource(block.source),
        previewDataUrl: getString(block.previewDataUrl) ?? getString(block.preview_data_url),
        ...(type === 'image' && getString(block.data)
            ? { data: getString(block.data) }
            : {}),
        ...(type === 'file' && getString(block.text)
            ? { text: getString(block.text) }
            : {}),
        raw: block,
    };
}
function getContentSource(value) {
    const source = getRecord(value);
    if (!source) {
        return undefined;
    }
    const kind = getString(source.kind);
    if (kind === 'file') {
        const path = getString(source.path);
        return path ? { kind, path } : undefined;
    }
    if (kind === 'url') {
        const url = getString(source.url);
        return url ? { kind, url } : undefined;
    }
    if (kind === 'contentRef') {
        const contentRef = getString(source.contentRef);
        return contentRef ? { kind, contentRef } : undefined;
    }
    return undefined;
}
function getString(value) {
    return typeof value === 'string' ? value : undefined;
}
function getNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function getRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function getRetryable(value) {
    return typeof value === 'boolean' || value === 'unknown' ? value : undefined;
}
//# sourceMappingURL=contentBlocks.js.map