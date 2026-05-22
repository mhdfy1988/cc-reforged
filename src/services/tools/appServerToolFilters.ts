import type { Tools } from '../../Tool.js'
import {
  filterCcrToolsByAvailability,
  type CcrMcpServerAvailabilityStatus,
} from './toolAvailability.js'

export type AppServerPlatformToolFilterOptions = {
  platform?: NodeJS.Platform
  activeAgentCount?: number
  connectedMcpServerNames?: readonly string[]
  mcpServerStatuses?: Readonly<Record<string, CcrMcpServerAvailabilityStatus>>
}

export function enableAppServerPlatformToolDefaults(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform === 'win32' && env.CLAUDE_CODE_USE_POWERSHELL_TOOL === undefined) {
    env.CLAUDE_CODE_USE_POWERSHELL_TOOL = '1'
  }
}

export function filterAppServerPlatformTools(
  tools: Tools,
  options: AppServerPlatformToolFilterOptions = {},
): Tools {
  const platform = options.platform ?? process.platform
  const activeAgentCount = options.activeAgentCount ?? 0

  return filterCcrToolsByAvailability(tools, {
    runtime: 'app-server',
    platform,
    activeAgentCount,
    connectedMcpServerNames: options.connectedMcpServerNames,
    mcpServerStatuses: options.mcpServerStatuses,
  })
}
