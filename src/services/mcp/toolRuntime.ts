import { TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../utils/errors.js'

const DEFAULT_MCP_TOOL_TIMEOUT_MS = 100_000_000

export function getMcpToolTimeoutMs(
  envValue = process.env.MCP_TOOL_TIMEOUT,
): number {
  return parseInt(envValue || '', 10) || DEFAULT_MCP_TOOL_TIMEOUT_MS
}

export function createMcpToolTimeoutError(params: {
  serverName: string
  toolName: string
  timeoutMs: number
}): TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(
    `MCP server "${params.serverName}" tool "${params.toolName}" timed out after ${Math.floor(params.timeoutMs / 1000)}s`,
    'MCP tool timeout',
  )
}

export function formatMcpToolDuration(elapsedMs: number): string {
  return elapsedMs < 1000
    ? `${elapsedMs}ms`
    : elapsedMs < 60000
      ? `${Math.floor(elapsedMs / 1000)}s`
      : `${Math.floor(elapsedMs / 60000)}m ${Math.floor((elapsedMs % 60000) / 1000)}s`
}

export function getMcpToolResultErrorDetails(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return 'Unknown error'
  }
  if (
    'content' in result &&
    Array.isArray(result.content) &&
    result.content.length > 0
  ) {
    const firstContent = result.content[0]
    if (
      firstContent &&
      typeof firstContent === 'object' &&
      'text' in firstContent &&
      typeof firstContent.text === 'string'
    ) {
      return firstContent.text
    }
  }
  if ('error' in result) {
    return String(result.error)
  }
  return 'Unknown error'
}

export function isMcpConnectionClosedOnHttp(params: {
  error: Error
  configType: string
}): boolean {
  return (
    'code' in params.error &&
    (params.error as Error & { code?: number }).code === -32000 &&
    params.error.message.includes('Connection closed') &&
    (params.configType === 'http' || params.configType === 'claudeai-proxy')
  )
}
