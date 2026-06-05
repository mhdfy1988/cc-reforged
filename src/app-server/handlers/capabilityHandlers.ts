import { CapabilitiesListParamsSchema } from '../protocol.js'
import type { AppServerContext } from '../router.js'

type CapabilityCore = AppServerContext['core']['capabilities']

export async function handleCapabilitiesList(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = CapabilitiesListParamsSchema.parse(
    params ?? {},
  ) as Parameters<CapabilityCore['list']>[0]
  return context.core.capabilities.list({
    ...parsedParams,
    cwd: parsedParams.cwd ?? process.cwd(),
    configHomeDir: parsedParams.configHomeDir ?? context.ccrHome,
  })
}
