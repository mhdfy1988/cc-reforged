import { CoreError } from '../core/errors.js';
import { createDefaultLlmModelCapabilities } from '../services/llm/modelCapabilities.js';
export function normalizeTurnStartInputForCurrentModel(input) {
    const turnInput = input.params.input;
    const imageGenerationMetadata = normalizeImageGenerationMetadata(input.params.options?.imageGeneration, turnInput);
    if (turnInput.type === 'text') {
        return {
            input: {
                type: 'text',
                text: turnInput.text,
            },
            ...(imageGenerationMetadata
                ? { metadata: { imageGeneration: imageGenerationMetadata } }
                : {}),
        };
    }
    const requiresCapabilityCheck = turnInput.content.some(block => block.type !== 'text');
    if (!requiresCapabilityCheck) {
        return mergeNormalizedInputMetadata(normalizeContentInput(turnInput), imageGenerationMetadata);
    }
    const availability = input.model.getAvailability({});
    return mergeNormalizedInputMetadata(normalizeContentInput(turnInput, availability), imageGenerationMetadata);
}
export function normalizeContentInput(input, availability) {
    const capabilities = availability?.modelCapabilities ??
        createDefaultLlmModelCapabilities(availability?.model ?? 'unknown-model');
    const rejections = validateContentBlocks(input.content, capabilities);
    if (rejections.length > 0) {
        throw new CoreError('invalid_params', 'Current model does not support this multimodal input.', {
            provider: availability?.provider,
            profileId: availability?.profileId,
            model: availability?.model,
            unsupportedModalities: Array.from(new Set(rejections.map(rejection => rejection.type))),
            rejectedBlocks: rejections,
            modelCapabilities: summarizeCapabilities(capabilities),
        });
    }
    const text = createTextFallback(input.content);
    return {
        input: {
            type: 'content',
            text,
            content: toCoreUserContentBlocks(input.content),
        },
        metadata: createMultimodalMetadata(input.content, capabilities),
    };
}
function validateContentBlocks(blocks, capabilities) {
    const rejections = [];
    const inputModalities = new Set(capabilities.inputModalities);
    const imageBlocks = blocks.filter((block) => block.type === 'image');
    for (const [index, block] of blocks.entries()) {
        if (block.type === 'text') {
            continue;
        }
        if (!inputModalities.has(block.type)) {
            rejections.push({
                index,
                type: block.type,
                reason: 'unsupported_modality',
                ...(block.mimeType ? { mimeType: block.mimeType } : {}),
                ...(block.sizeBytes !== undefined ? { sizeBytes: block.sizeBytes } : {}),
            });
            continue;
        }
        if (block.type === 'image') {
            rejections.push(...validateImageBlock(index, block, capabilities));
        }
    }
    const maxImages = capabilities.image?.maxImages;
    if (maxImages !== undefined && imageBlocks.length > maxImages) {
        rejections.push({
            index: -1,
            type: 'image',
            reason: 'too_many_images',
        });
    }
    return rejections;
}
function validateImageBlock(index, block, capabilities) {
    const rejections = [];
    const mimeTypes = capabilities.image?.mimeTypes;
    if (block.mimeType &&
        mimeTypes?.length &&
        !mimeTypes.some(mimeType => mimeType.toLowerCase() === block.mimeType.toLowerCase())) {
        rejections.push({
            index,
            type: 'image',
            reason: 'unsupported_mime_type',
            mimeType: block.mimeType,
        });
    }
    const maxImageBytes = capabilities.image?.maxImageBytes;
    if (block.sizeBytes !== undefined &&
        maxImageBytes !== undefined &&
        block.sizeBytes > maxImageBytes) {
        rejections.push({
            index,
            type: 'image',
            reason: 'image_too_large',
            sizeBytes: block.sizeBytes,
        });
    }
    return rejections;
}
function createTextFallback(blocks) {
    const textParts = blocks
        .filter((block) => block.type === 'text')
        .map(block => block.text.trim())
        .filter(Boolean);
    const attachmentParts = blocks
        .filter((block) => block.type !== 'text')
        .map(createAttachmentSummary);
    const combined = [...textParts, ...attachmentParts].join('\n').trim();
    if (combined) {
        return combined;
    }
    return '用户发送了多模态附件；当前阶段仅完成 App Server 校验，内容块将在后续阶段进入 Core。';
}
function createAttachmentSummary(block) {
    const label = block.displayName ?? block.attachmentId ?? block.mimeType ?? '未命名附件';
    if (block.type === 'image') {
        return `[图片附件：${label}]`;
    }
    if (block.type === 'audio') {
        return `[音频附件：${label}]`;
    }
    if (block.type === 'video') {
        return `[视频附件：${label}]`;
    }
    return `[文件附件：${label}]`;
}
function toCoreUserContentBlocks(blocks) {
    return blocks.map(block => {
        if (block.type === 'text') {
            return {
                type: 'text',
                text: block.text,
            };
        }
        const coreBlock = {
            type: block.type,
        };
        if (block.attachmentId) {
            coreBlock.attachmentId = block.attachmentId;
        }
        if (block.displayName) {
            coreBlock.displayName = block.displayName;
        }
        if (block.mimeType) {
            coreBlock.mimeType = block.mimeType;
        }
        if (block.sizeBytes !== undefined) {
            coreBlock.sizeBytes = block.sizeBytes;
        }
        if (block.source) {
            coreBlock.source = { ...block.source };
        }
        return coreBlock;
    });
}
function createMultimodalMetadata(blocks, capabilities) {
    const counts = countModalities(blocks);
    return {
        multimodalInput: compactObject({
            type: 'content',
            deferred: blocks.some(block => block.type !== 'text'),
            blockCount: blocks.length,
            modalityCounts: counts,
            capabilitySource: capabilities.source,
            capabilityReason: capabilities.reason,
        }),
    };
}
function mergeNormalizedInputMetadata(input, imageGenerationMetadata) {
    if (!imageGenerationMetadata) {
        return input;
    }
    return {
        ...input,
        metadata: {
            ...(input.metadata ?? {}),
            imageGeneration: imageGenerationMetadata,
        },
    };
}
function normalizeImageGenerationMetadata(value, turnInput) {
    if (value === undefined || value === false) {
        return undefined;
    }
    if (value === true) {
        return {
            enabled: true,
            prompt: extractTurnInputText(turnInput),
        };
    }
    return compactObject({
        enabled: value.enabled !== false,
        prompt: value.prompt?.trim() || extractTurnInputText(turnInput),
        model: value.model?.trim(),
        size: value.size?.trim(),
        quality: value.quality?.trim(),
        outputFormat: value.outputFormat?.trim(),
        responseFormat: value.responseFormat,
        n: value.n,
        metadata: value.metadata,
    });
}
function extractTurnInputText(input) {
    if (input.type === 'text') {
        return input.text;
    }
    return input.content
        .filter((block) => block.type === 'text')
        .map(block => block.text)
        .join('\n');
}
function countModalities(blocks) {
    return blocks.reduce((counts, block) => {
        counts[block.type] += 1;
        return counts;
    }, { text: 0, image: 0, file: 0, audio: 0, video: 0 });
}
function summarizeCapabilities(capabilities) {
    return compactObject({
        inputModalities: [...capabilities.inputModalities],
        outputModalities: [...capabilities.outputModalities],
        tools: capabilities.tools,
        structuredOutput: capabilities.structuredOutput,
        source: capabilities.source,
        reason: capabilities.reason,
        baseSource: capabilities.baseSource,
        image: capabilities.image
            ? compactObject({
                maxImages: capabilities.image.maxImages,
                maxImageBytes: capabilities.image.maxImageBytes,
                mimeTypes: capabilities.image.mimeTypes
                    ? [...capabilities.image.mimeTypes]
                    : undefined,
            })
            : undefined,
    });
}
function compactObject(object) {
    return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
//# sourceMappingURL=turnInput.js.map