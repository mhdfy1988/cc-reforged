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
    const generatedArtifact = getGeneratedArtifactSnapshot(type, block);
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
        origin: getGeneratedOutputOrigin(block.origin),
        lifecycle: getGeneratedOutputLifecycle(block.lifecycle),
        safety: getGeneratedOutputSafety(block.safety),
        provider: getString(block.provider),
        model: getString(block.model),
        outputId: getString(block.outputId) ?? getString(block.output_id),
        savedPath: getString(block.savedPath) ??
            getString(block.saved_path) ??
            generatedArtifact?.savedPath,
        prompt: getString(block.prompt),
        revisedPrompt: getString(block.revisedPrompt) ?? getString(block.revised_prompt),
        expiresAt: getString(block.expiresAt) ?? getString(block.expires_at),
        generatedArtifact,
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
    if (kind === 'providerFile') {
        const provider = getString(source.provider);
        const fileId = getString(source.fileId) ?? getString(source.file_id);
        return provider && fileId
            ? {
                kind,
                provider,
                fileId,
                ...(getString(source.url) ? { url: getString(source.url) } : {}),
                ...(getString(source.expiresAt) || getString(source.expires_at)
                    ? {
                        expiresAt: getString(source.expiresAt) ?? getString(source.expires_at),
                    }
                    : {}),
            }
            : undefined;
    }
    return undefined;
}
function getGeneratedArtifactSnapshot(type, block) {
    const explicit = getRecord(block.generatedArtifact) ?? getRecord(block.generated_artifact);
    const shouldInfer = getGeneratedOutputOrigin(block.origin) === 'model_output' ||
        Boolean(getString(block.savedPath) ?? getString(block.saved_path)) ||
        Boolean(getString(block.outputId) ?? getString(block.output_id));
    const source = explicit ?? (shouldInfer ? block : undefined);
    if (!source) {
        return undefined;
    }
    const savedPath = getString(source.savedPath) ??
        getString(source.saved_path) ??
        getString(block.savedPath) ??
        getString(block.saved_path);
    const outputId = getString(source.outputId) ??
        getString(source.output_id) ??
        getString(block.outputId) ??
        getString(block.output_id);
    const id = getString(source.id) ??
        getString(source.artifactId) ??
        getString(source.artifact_id) ??
        outputId ??
        getString(block.attachmentId) ??
        getString(block.attachment_id);
    if (!id) {
        return undefined;
    }
    const status = getGeneratedArtifactStatus(source.status) ??
        (savedPath ? 'saved' : getGeneratedArtifactStatus(block.status)) ??
        'unknown';
    return {
        id,
        type: getGeneratedArtifactType(source.type) ??
            getGeneratedArtifactType(block.type) ??
            type,
        status,
        savedPath,
        mimeType: getString(source.mimeType) ??
            getString(source.mime_type) ??
            getString(source.mediaType) ??
            getString(block.mimeType) ??
            getString(block.mime_type) ??
            getString(block.mediaType),
        provider: getString(source.provider) ?? getString(block.provider),
        model: getString(source.model) ?? getString(block.model),
        outputId,
        prompt: getString(source.prompt) ?? getString(block.prompt),
        revisedPrompt: getString(source.revisedPrompt) ??
            getString(source.revised_prompt) ??
            getString(block.revisedPrompt) ??
            getString(block.revised_prompt),
        lifecycle: getGeneratedOutputLifecycle(source.lifecycle) ??
            getGeneratedOutputLifecycle(block.lifecycle),
        safety: getGeneratedOutputSafety(source.safety) ??
            getGeneratedOutputSafety(block.safety),
        error: getString(source.error) ?? getString(block.error),
        ...(explicit ? { raw: explicit } : {}),
    };
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
function getGeneratedOutputOrigin(value) {
    return isOneOf(value, [
        'user_upload',
        'tool_result',
        'model_output',
        'mcp',
        'browser',
        'unknown',
    ]);
}
function getGeneratedOutputLifecycle(value) {
    return isOneOf(value, [
        'inline',
        'referenced',
        'temporary',
        'persisted',
        'expired',
        'unknown',
    ]);
}
function getGeneratedOutputSafety(value) {
    return isOneOf(value, ['trusted', 'needs_review', 'blocked', 'unknown']);
}
function getGeneratedArtifactType(value) {
    return isOneOf(value, ['image', 'file', 'audio', 'video', 'unknown']);
}
function getGeneratedArtifactStatus(value) {
    return isOneOf(value, ['saving', 'saved', 'failed', 'expired', 'unknown']);
}
function isOneOf(value, options) {
    return typeof value === 'string' && options.includes(value)
        ? value
        : undefined;
}
function getRetryable(value) {
    return typeof value === 'boolean' || value === 'unknown' ? value : undefined;
}
//# sourceMappingURL=contentBlocks.js.map