import type { ToolPermissionContext, Tools } from '../../Tool.js'
import { assembleToolPool } from '../../tools.js'
import {
  enableAppServerPlatformToolDefaults,
  filterAppServerPlatformTools,
  type AppServerPlatformToolFilterOptions,
} from './appServerToolFilters.js'

export type AppServerToolPoolOptions = AppServerPlatformToolFilterOptions & {
  permissionContext: ToolPermissionContext
  mcpTools: Tools
}

export function buildAppServerToolPool(
  options: AppServerToolPoolOptions,
): Tools {
  enableAppServerPlatformToolDefaults()
  return filterAppServerPlatformTools(
    assembleToolPool(options.permissionContext, options.mcpTools),
    options,
  )
}
