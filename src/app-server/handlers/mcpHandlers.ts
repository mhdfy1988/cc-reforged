import { McpListParamsSchema } from '../protocol.js'
import type { AppServerContext } from '../router.js'

export async function handleMcpList(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpListParamsSchema.parse(params ?? {})
  return context.core.mcp.listServers({
    includeDisabled: parsedParams.includeDisabled,
  })
}
