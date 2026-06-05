import { listExtensionCapabilities } from '../services/capabilities/capabilityService.js'

export type CoreCapabilityListParams = {
  cwd?: string
  configHomeDir?: string
}

export async function listCoreCapabilities(
  params: CoreCapabilityListParams = {},
): Promise<Record<string, unknown>> {
  return listExtensionCapabilities(params)
}
