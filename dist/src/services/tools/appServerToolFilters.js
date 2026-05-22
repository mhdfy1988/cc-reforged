import { filterCcrToolsByAvailability, } from './toolAvailability.js';
export function enableAppServerPlatformToolDefaults(env = process.env, platform = process.platform) {
    if (platform === 'win32' && env.CLAUDE_CODE_USE_POWERSHELL_TOOL === undefined) {
        env.CLAUDE_CODE_USE_POWERSHELL_TOOL = '1';
    }
}
export function filterAppServerPlatformTools(tools, options = {}) {
    const platform = options.platform ?? process.platform;
    const activeAgentCount = options.activeAgentCount ?? 0;
    return filterCcrToolsByAvailability(tools, {
        runtime: 'app-server',
        platform,
        activeAgentCount,
        connectedMcpServerNames: options.connectedMcpServerNames,
        mcpServerStatuses: options.mcpServerStatuses,
    });
}
//# sourceMappingURL=appServerToolFilters.js.map