import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { getClaudeConfigHomeDir } from './envUtils.js';
export const GENERATED_OUTPUTS_DIR = 'generated_outputs';
export function getGeneratedArtifactPath(input) {
    const extension = getArtifactExtension(input.mimeType, input.artifactType);
    return join(input.ccrHome ?? getClaudeConfigHomeDir(), GENERATED_OUTPUTS_DIR, sanitizePathComponent(input.sessionId), `${sanitizePathComponent(input.outputId)}${extension}`);
}
export async function persistGeneratedArtifactFromBase64(input) {
    return persistGeneratedArtifactFromBytes({
        ...input,
        bytes: Buffer.from(stripDataUrlPrefix(input.base64Data), 'base64'),
    });
}
export async function persistGeneratedArtifactFromBytes(input) {
    const savedPath = getGeneratedArtifactPath(input);
    await mkdir(dirname(savedPath), { recursive: true });
    await writeFile(savedPath, input.bytes);
    return {
        id: input.outputId,
        type: input.artifactType ?? inferArtifactType(input.mimeType),
        status: 'saved',
        savedPath,
        mimeType: input.mimeType,
        provider: input.provider,
        model: input.model,
        outputId: input.outputId,
        prompt: input.prompt,
        revisedPrompt: input.revisedPrompt,
        lifecycle: input.lifecycle ?? 'persisted',
        safety: input.safety ?? 'needs_review',
        raw: input.raw,
    };
}
export function sanitizeGeneratedArtifactsForResume(value) {
    return sanitizeGeneratedArtifactValue(value);
}
export function prepareGeneratedImageCallForModelReplay(call, options) {
    if (options.includeResult) {
        return { ...call };
    }
    return {
        ...call,
        result: '',
    };
}
export function shouldIncludeGeneratedImageResultForReplay(input) {
    const outputModalities = input.outputModalities ?? input.capabilities?.outputModalities ?? [];
    return outputModalities.includes('image');
}
function sanitizeGeneratedArtifactValue(value) {
    if (Array.isArray(value)) {
        return value.map(sanitizeGeneratedArtifactValue);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const object = value;
    const sanitized = {};
    const generatedLike = isGeneratedArtifactLike(object);
    for (const [key, nestedValue] of Object.entries(object)) {
        if (shouldDropGeneratedPayloadField(key, nestedValue, generatedLike)) {
            continue;
        }
        if (generatedLike && key === 'result') {
            sanitized[key] = '';
            continue;
        }
        sanitized[key] = sanitizeGeneratedArtifactValue(nestedValue);
    }
    return sanitized;
}
function isGeneratedArtifactLike(object) {
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
function shouldDropGeneratedPayloadField(key, value, generatedLike) {
    if (key === 'previewDataUrl' ||
        key === 'preview_data_url' ||
        key === 'thumbnailDataUrl' ||
        key === 'thumbnail_data_url') {
        return true;
    }
    if (!generatedLike) {
        return false;
    }
    return ((key === 'data' && isLargeInlinePayload(value)) ||
        (key === 'image_url' && isLargeInlinePayload(value)) ||
        (key === 'imageUrl' && isLargeInlinePayload(value)));
}
function isLargeInlinePayload(value) {
    return (typeof value === 'string' &&
        (/^data:/i.test(value) || value.length > 4096));
}
function stripDataUrlPrefix(value) {
    const commaIndex = value.indexOf(',');
    return /^data:/i.test(value) && commaIndex >= 0
        ? value.slice(commaIndex + 1)
        : value;
}
function getArtifactExtension(mimeType, artifactType) {
    const normalized = mimeType?.toLowerCase().trim();
    if (normalized === 'image/png') {
        return '.png';
    }
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
        return '.jpg';
    }
    if (normalized === 'image/webp') {
        return '.webp';
    }
    if (normalized === 'image/gif') {
        return '.gif';
    }
    if (normalized === 'audio/mpeg') {
        return '.mp3';
    }
    if (normalized === 'audio/wav') {
        return '.wav';
    }
    if (normalized === 'application/pdf') {
        return '.pdf';
    }
    if (normalized === 'text/plain') {
        return '.txt';
    }
    if (normalized === 'application/json') {
        return '.json';
    }
    if (normalized && extname(normalized)) {
        return extname(normalized);
    }
    switch (artifactType) {
        case 'image':
            return '.png';
        case 'audio':
            return '.bin';
        case 'video':
            return '.bin';
        case 'file':
        case 'unknown':
        default:
            return '.bin';
    }
}
function inferArtifactType(mimeType) {
    const normalized = mimeType?.toLowerCase().trim() ?? '';
    if (normalized.startsWith('image/')) {
        return 'image';
    }
    if (normalized.startsWith('audio/')) {
        return 'audio';
    }
    if (normalized.startsWith('video/')) {
        return 'video';
    }
    return 'file';
}
function sanitizePathComponent(value) {
    const sanitized = value
        .normalize('NFC')
        .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_')
        .replace(/^\.+$/, '_')
        .slice(0, 120);
    return sanitized || 'artifact';
}
//# sourceMappingURL=generatedArtifacts.js.map