import { basename } from 'node:path';
import { persistGeneratedArtifactFromBase64, persistGeneratedArtifactFromBytes, } from '../../../utils/generatedArtifacts.js';
export async function normalizeGeneratedImageOutputs(items, context) {
    const output = [];
    const generatedArtifacts = [];
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const outputId = getImageOutputId(item.outputId ?? context.outputId, index, items.length);
        const revisedPrompt = item.revisedPrompt;
        const prompt = context.prompt;
        if (item.base64Data) {
            const mimeType = getMimeTypeForOutputFormat(context.outputFormat);
            const artifact = await persistGeneratedArtifactFromBase64({
                ccrHome: context.ccrHome,
                sessionId: context.sessionId,
                outputId,
                mimeType,
                artifactType: 'image',
                base64Data: item.base64Data,
                provider: context.provider,
                model: context.model,
                prompt,
                revisedPrompt,
                lifecycle: 'persisted',
                safety: 'needs_review',
            });
            generatedArtifacts.push(artifact);
            output.push({
                type: 'image',
                attachmentId: outputId,
                displayName: artifact.savedPath
                    ? basename(artifact.savedPath)
                    : `${outputId}${getExtensionForOutputFormat(context.outputFormat)}`,
                mimeType,
                origin: 'model_output',
                lifecycle: 'persisted',
                safety: 'needs_review',
                provider: context.provider,
                model: context.model,
                outputId,
                savedPath: artifact.savedPath,
                prompt,
                revisedPrompt,
                generatedArtifact: artifact,
                ...(artifact.savedPath
                    ? {
                        source: {
                            kind: 'file',
                            path: artifact.savedPath,
                        },
                    }
                    : {}),
            });
            continue;
        }
        if (item.url) {
            const mimeType = getMimeTypeForOutputFormat(context.outputFormat);
            const artifact = await tryPersistGeneratedImageUrl({
                url: item.url,
                fetchImpl: context.fetchImpl,
                signal: context.signal,
                ccrHome: context.ccrHome,
                sessionId: context.sessionId,
                outputId,
                mimeType,
                provider: context.provider,
                model: context.model,
                prompt,
                revisedPrompt,
            });
            if (artifact?.savedPath) {
                generatedArtifacts.push(artifact);
                output.push({
                    type: 'image',
                    attachmentId: outputId,
                    displayName: basename(artifact.savedPath),
                    mimeType: artifact.mimeType ?? mimeType,
                    origin: 'model_output',
                    lifecycle: 'persisted',
                    safety: 'needs_review',
                    provider: context.provider,
                    model: context.model,
                    outputId,
                    savedPath: artifact.savedPath,
                    prompt,
                    revisedPrompt,
                    generatedArtifact: artifact,
                    source: {
                        kind: 'file',
                        path: artifact.savedPath,
                    },
                    raw: {
                        sourceUrl: item.url,
                    },
                });
                continue;
            }
            output.push({
                type: 'image',
                attachmentId: outputId,
                displayName: `${outputId}${getExtensionForOutputFormat(context.outputFormat)}`,
                mimeType,
                origin: 'model_output',
                lifecycle: 'temporary',
                safety: 'needs_review',
                provider: context.provider,
                model: context.model,
                outputId,
                prompt,
                revisedPrompt,
                source: {
                    kind: 'url',
                    url: item.url,
                },
            });
        }
    }
    if (output.length === 0) {
        throw new Error('Image generation returned no usable image output.');
    }
    return {
        provider: context.provider,
        model: context.model,
        output,
        generatedArtifacts,
        raw: context.raw ?? {
            imageCount: items.length,
            data: items.map(item => ({
                hasBase64: Boolean(item.base64Data),
                hasUrl: Boolean(item.url),
                revised_prompt: item.revisedPrompt,
            })),
        },
    };
}
async function tryPersistGeneratedImageUrl(input) {
    try {
        const response = await (input.fetchImpl ?? fetch)(input.url, {
            signal: input.signal,
        });
        if (!response.ok) {
            return null;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0) {
            return null;
        }
        const responseMimeType = getImageMimeTypeFromHeaders(response.headers);
        return await persistGeneratedArtifactFromBytes({
            ccrHome: input.ccrHome,
            sessionId: input.sessionId,
            outputId: input.outputId,
            mimeType: responseMimeType ?? input.mimeType,
            artifactType: 'image',
            bytes,
            provider: input.provider,
            model: input.model,
            prompt: input.prompt,
            revisedPrompt: input.revisedPrompt,
            lifecycle: 'persisted',
            safety: 'needs_review',
            raw: {
                sourceUrl: input.url,
                downloadedMimeType: responseMimeType,
            },
        });
    }
    catch {
        return null;
    }
}
function getImageMimeTypeFromHeaders(headers) {
    const contentType = headers.get('content-type')?.split(';', 1)[0]?.trim();
    return contentType?.startsWith('image/') ? contentType : undefined;
}
function getImageOutputId(requestedOutputId, index, total) {
    const base = requestedOutputId?.trim() || `generated_image_${Date.now()}`;
    return total <= 1 ? base : `${base}_${index + 1}`;
}
function getMimeTypeForOutputFormat(outputFormat) {
    switch (outputFormat?.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
            return 'image/jpeg';
        case 'webp':
            return 'image/webp';
        case 'png':
        default:
            return 'image/png';
    }
}
function getExtensionForOutputFormat(outputFormat) {
    switch (outputFormat?.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
            return '.jpg';
        case 'webp':
            return '.webp';
        case 'png':
        default:
            return '.png';
    }
}
//# sourceMappingURL=generatedImageOutputAdapter.js.map