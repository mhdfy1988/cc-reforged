import { WorkspaceOpenParamsSchema } from '../protocol.js'
import type { AppServerContext } from '../router.js'

export async function handleWorkspaceOpen(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = WorkspaceOpenParamsSchema.parse(params)
  const workspace = await context.core.workspace.openWorkspace({
    path: parsedParams.path!,
    trust: parsedParams.trust!,
  })

  return {
    workspace,
  }
}
