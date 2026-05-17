import { readFile } from 'node:fs/promises';
const DEFAULT_IMAGE_MIME_TYPE = 'image/png';
export function normalizeImageMimeType(value) {
    const mimeType = value?.trim().toLowerCase();
    return mimeType?.startsWith('image/') ? mimeType : DEFAULT_IMAGE_MIME_TYPE;
}
export async function toOpenAiImageUrl(part) {
    if (part.source?.kind === 'url') {
        return part.source.url;
    }
    const { mediaType, data } = await readImageAsBase64(part);
    return `data:${mediaType};base64,${data}`;
}
export async function toAnthropicImageSource(part) {
    if (part.source?.kind === 'url') {
        return {
            type: 'url',
            url: part.source.url,
        };
    }
    const { mediaType, data } = await readImageAsBase64(part);
    return {
        type: 'base64',
        media_type: mediaType,
        data,
    };
}
export async function toBase64ImageContent(part) {
    return readImageAsBase64(part);
}
async function readImageAsBase64(part) {
    const mediaType = normalizeImageMimeType(part.mimeType);
    if (typeof part.data === 'string' && part.data.trim()) {
        return {
            mediaType,
            data: part.data.trim(),
        };
    }
    if (part.source?.kind === 'file') {
        const buffer = await readFile(part.source.path);
        return {
            mediaType,
            data: buffer.toString('base64'),
        };
    }
    if (part.source?.kind === 'contentRef') {
        throw new Error(`Image contentRef '${part.source.contentRef}' is not resolvable by provider adapters yet.`);
    }
    throw new Error(`Image '${part.displayName ?? part.attachmentId ?? 'attachment'}' has no readable source.`);
}
//# sourceMappingURL=imageContent.js.map