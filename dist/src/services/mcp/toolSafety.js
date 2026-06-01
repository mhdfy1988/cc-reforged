import { TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../utils/errors.js';
export function isFileUrl(value) {
    if (typeof value !== 'string') {
        return false;
    }
    try {
        return new URL(value).protocol === 'file:';
    }
    catch {
        return false;
    }
}
export function getBlockedFileUrlForMcpTool(tool, args) {
    const normalizedTool = tool.toLowerCase();
    if (!normalizedTool.includes('browser_navigate')) {
        return undefined;
    }
    return isFileUrl(args.url) ? args.url : undefined;
}
export function createMcpFileUrlBlockedError(tool, url) {
    return new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(`MCP tool "${tool}" cannot open file:// URLs. Start a local HTTP server for this file and navigate to a localhost URL instead. Blocked URL: ${url}`, 'MCP file URL blocked before tool call');
}
//# sourceMappingURL=toolSafety.js.map