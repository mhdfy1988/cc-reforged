import { isEnvDefinedFalsy } from '../../utils/envUtils.js';
import { TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../utils/errors.js';
import { maybeResizeAndDownsampleImageBuffer } from '../../utils/imageResizer.js';
import { logMCPError } from '../../utils/log.js';
import { getBinaryBlobSavedMessage, getFormatDescription, getLargeOutputInstructions, persistBinaryContent, } from '../../utils/mcpOutputStorage.js';
import { getContentSizeEstimate, mcpContentNeedsTruncation, truncateMcpContentIfNeeded, } from '../../utils/mcpValidation.js';
import { isPersistError, persistToolResult } from '../../utils/toolResultStorage.js';
import { logEvent, } from '../analytics/index.js';
import { normalizeNameForMCP } from './normalization.js';
import { jsonStringify } from '../../utils/slowOperations.js';
const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
]);
export async function transformResultContent(resultContent, serverName) {
    switch (resultContent.type) {
        case 'text':
            return [
                {
                    type: 'text',
                    text: resultContent.text,
                },
            ];
        case 'audio': {
            const audioData = resultContent;
            return await persistBlobToTextBlock(Buffer.from(audioData.data, 'base64'), audioData.mimeType, serverName, `[Audio from ${serverName}] `);
        }
        case 'image': {
            const imageBuffer = Buffer.from(String(resultContent.data), 'base64');
            const ext = resultContent.mimeType?.split('/')[1] || 'png';
            const resized = await maybeResizeAndDownsampleImageBuffer(imageBuffer, imageBuffer.length, ext);
            return [
                {
                    type: 'image',
                    source: {
                        data: resized.buffer.toString('base64'),
                        media_type: `image/${resized.mediaType}`,
                        type: 'base64',
                    },
                },
            ];
        }
        case 'resource': {
            const resource = resultContent.resource;
            const prefix = `[Resource from ${serverName} at ${resource.uri}] `;
            if ('text' in resource) {
                return [
                    {
                        type: 'text',
                        text: `${prefix}${resource.text}`,
                    },
                ];
            }
            else if ('blob' in resource) {
                const isImage = IMAGE_MIME_TYPES.has(resource.mimeType ?? '');
                if (isImage) {
                    const imageBuffer = Buffer.from(resource.blob, 'base64');
                    const ext = resource.mimeType?.split('/')[1] || 'png';
                    const resized = await maybeResizeAndDownsampleImageBuffer(imageBuffer, imageBuffer.length, ext);
                    const content = [];
                    if (prefix) {
                        content.push({
                            type: 'text',
                            text: prefix,
                        });
                    }
                    content.push({
                        type: 'image',
                        source: {
                            data: resized.buffer.toString('base64'),
                            media_type: `image/${resized.mediaType}`,
                            type: 'base64',
                        },
                    });
                    return content;
                }
                else {
                    return await persistBlobToTextBlock(Buffer.from(resource.blob, 'base64'), resource.mimeType, serverName, prefix);
                }
            }
            return [];
        }
        case 'resource_link': {
            const resourceLink = resultContent;
            let text = `[Resource link: ${resourceLink.name}] ${resourceLink.uri}`;
            if (resourceLink.description) {
                text += ` (${resourceLink.description})`;
            }
            return [
                {
                    type: 'text',
                    text,
                },
            ];
        }
        default:
            return [];
    }
}
async function persistBlobToTextBlock(bytes, mimeType, serverName, sourceDescription) {
    const persistId = `mcp-${normalizeNameForMCP(serverName)}-blob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await persistBinaryContent(bytes, mimeType, persistId);
    if ('error' in result) {
        return [
            {
                type: 'text',
                text: `${sourceDescription}Binary content (${mimeType || 'unknown type'}, ${bytes.length} bytes) could not be saved to disk: ${result.error}`,
            },
        ];
    }
    return [
        {
            type: 'text',
            text: getBinaryBlobSavedMessage(result.filepath, mimeType, result.size, sourceDescription),
        },
    ];
}
export function inferCompactSchema(value, depth = 2) {
    if (value === null)
        return 'null';
    if (Array.isArray(value)) {
        if (value.length === 0)
            return '[]';
        return `[${inferCompactSchema(value[0], depth - 1)}]`;
    }
    if (typeof value === 'object') {
        if (depth <= 0)
            return '{...}';
        const entries = Object.entries(value).slice(0, 10);
        const props = entries.map(([k, v]) => `${k}: ${inferCompactSchema(v, depth - 1)}`);
        const suffix = Object.keys(value).length > 10 ? ', ...' : '';
        return `{${props.join(', ')}${suffix}}`;
    }
    return typeof value;
}
export async function transformMCPResult(result, tool, name) {
    if (result && typeof result === 'object') {
        if ('toolResult' in result) {
            return {
                content: String(result.toolResult),
                type: 'toolResult',
            };
        }
        if ('structuredContent' in result &&
            result.structuredContent !== undefined) {
            return {
                content: jsonStringify(result.structuredContent),
                type: 'structuredContent',
                schema: inferCompactSchema(result.structuredContent),
            };
        }
        if ('content' in result && Array.isArray(result.content)) {
            const transformedContent = (await Promise.all(result.content.map(item => transformResultContent(item, name)))).flat();
            return {
                content: transformedContent,
                type: 'contentArray',
                schema: inferCompactSchema(transformedContent),
            };
        }
    }
    const errorMessage = `MCP server "${name}" tool "${tool}": unexpected response format`;
    logMCPError(name, errorMessage);
    throw new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(errorMessage, 'MCP tool unexpected response format');
}
export function contentContainsImages(content) {
    if (!content || typeof content === 'string') {
        return false;
    }
    return content.some(block => block.type === 'image');
}
export async function processMCPResult(result, tool, name) {
    const { content, type, schema } = await transformMCPResult(result, tool, name);
    if (name === 'ide') {
        return content;
    }
    if (!(await mcpContentNeedsTruncation(content))) {
        return content;
    }
    const sizeEstimateTokens = getContentSizeEstimate(content);
    if (isEnvDefinedFalsy(process.env.ENABLE_MCP_LARGE_OUTPUT_FILES)) {
        logEvent('tengu_mcp_large_result_handled', {
            outcome: 'truncated',
            reason: 'env_disabled',
            sizeEstimateTokens,
        });
        return await truncateMcpContentIfNeeded(content);
    }
    if (!content) {
        return content;
    }
    if (contentContainsImages(content)) {
        logEvent('tengu_mcp_large_result_handled', {
            outcome: 'truncated',
            reason: 'contains_images',
            sizeEstimateTokens,
        });
        return await truncateMcpContentIfNeeded(content);
    }
    const timestamp = Date.now();
    const persistId = `mcp-${normalizeNameForMCP(name)}-${normalizeNameForMCP(tool)}-${timestamp}`;
    const contentStr = typeof content === 'string' ? content : jsonStringify(content, null, 2);
    const persistResult = await persistToolResult(contentStr, persistId);
    if (isPersistError(persistResult)) {
        const contentLength = contentStr.length;
        logEvent('tengu_mcp_large_result_handled', {
            outcome: 'truncated',
            reason: 'persist_failed',
            sizeEstimateTokens,
        });
        return `Error: result (${contentLength.toLocaleString()} characters) exceeds maximum allowed tokens. Failed to save output to file: ${persistResult.error}. If this MCP server provides pagination or filtering tools, use them to retrieve specific portions of the data.`;
    }
    logEvent('tengu_mcp_large_result_handled', {
        outcome: 'persisted',
        reason: 'file_saved',
        sizeEstimateTokens,
        persistedSizeChars: persistResult.originalSize,
    });
    const formatDescription = getFormatDescription(type, schema);
    return getLargeOutputInstructions(persistResult.filepath, persistResult.originalSize, formatDescription);
}
//# sourceMappingURL=resultProcessing.js.map