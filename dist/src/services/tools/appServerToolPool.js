import { assembleToolPool } from '../../tools.js';
import { enableAppServerPlatformToolDefaults, filterAppServerPlatformTools, } from './appServerToolFilters.js';
export function buildAppServerToolPool(options) {
    enableAppServerPlatformToolDefaults();
    return filterAppServerPlatformTools(assembleToolPool(options.permissionContext, options.mcpTools), options);
}
//# sourceMappingURL=appServerToolPool.js.map