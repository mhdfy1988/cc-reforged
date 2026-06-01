import { TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../utils/errors.js'

export function isFileUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  try {
    return new URL(value).protocol === 'file:'
  } catch {
    return false
  }
}

export function getBlockedFileUrlForMcpTool(
  tool: string,
  args: Record<string, unknown>,
): string | undefined {
  const normalizedTool = tool.toLowerCase()
  if (!normalizedTool.includes('browser_navigate')) {
    return undefined
  }
  return isFileUrl(args.url) ? args.url : undefined
}

export function createMcpFileUrlBlockedError(
  tool: string,
  url: string,
): TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(
    `MCP tool "${tool}" cannot open file:// URLs. Start a local HTTP server for this file and navigate to a localhost URL instead. Blocked URL: ${url}`,
    'MCP file URL blocked before tool call',
  )
}
