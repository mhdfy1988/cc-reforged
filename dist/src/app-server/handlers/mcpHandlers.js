import { McpAddParamsSchema, McpDisableParamsSchema, McpEnableParamsSchema, McpInstallAdoptApplyParamsSchema, McpInstallAdoptPlanParamsSchema, McpInstallApplyParamsSchema, McpInstallListParamsSchema, McpInstallPlanParamsSchema, McpInstallRepairParamsSchema, McpInstallSearchParamsSchema, McpInstallUninstallParamsSchema, McpInspectParamsSchema, McpListParamsSchema, McpRemoveParamsSchema, McpRestartParamsSchema, McpTestParamsSchema, McpUpdateParamsSchema, } from '../protocol.js';
export async function handleMcpList(context, params) {
    const parsedParams = McpListParamsSchema.parse(params ?? {});
    return context.core.mcp.listServers({
        includeDisabled: parsedParams.includeDisabled,
    });
}
export function handleMcpInspect(context, params) {
    const parsedParams = McpInspectParamsSchema.parse(params);
    return context.core.mcp.inspectServer(parsedParams);
}
export async function handleMcpAdd(context, params) {
    const parsedParams = McpAddParamsSchema.parse(params);
    return context.core.mcp.addServer(parsedParams);
}
export async function handleMcpUpdate(context, params) {
    const parsedParams = McpUpdateParamsSchema.parse(params);
    return context.core.mcp.updateServer(parsedParams);
}
export async function handleMcpRemove(context, params) {
    const parsedParams = McpRemoveParamsSchema.parse(params);
    return context.core.mcp.removeServer(parsedParams);
}
export function handleMcpEnable(context, params) {
    const parsedParams = McpEnableParamsSchema.parse(params);
    return context.core.mcp.setServerEnabled({
        name: parsedParams.name,
        enabled: true,
    });
}
export function handleMcpDisable(context, params) {
    const parsedParams = McpDisableParamsSchema.parse(params);
    return context.core.mcp.setServerEnabled({
        name: parsedParams.name,
        enabled: false,
    });
}
export function handleMcpRestart(context, params) {
    const parsedParams = McpRestartParamsSchema.parse(params);
    return context.core.mcp.restartServer(parsedParams);
}
export async function handleMcpTest(context, params) {
    const parsedParams = McpTestParamsSchema.parse(params);
    return context.core.mcp.testServer(parsedParams);
}
export async function handleMcpInstallSearch(context, params) {
    const parsedParams = McpInstallSearchParamsSchema.parse(params ?? {});
    return context.core.mcp.searchInstallCandidates(parsedParams);
}
export function handleMcpInstallPlan(context, params) {
    const parsedParams = McpInstallPlanParamsSchema.parse(params);
    return context.core.mcp.planInstall(parsedParams);
}
export async function handleMcpInstallApply(context, params) {
    const parsedParams = McpInstallApplyParamsSchema.parse(params);
    return context.core.mcp.applyInstall(parsedParams);
}
export async function handleMcpInstallAdoptPlan(context, params) {
    const parsedParams = McpInstallAdoptPlanParamsSchema.parse(params);
    return context.core.mcp.planAdopt(parsedParams);
}
export async function handleMcpInstallAdoptApply(context, params) {
    const parsedParams = McpInstallAdoptApplyParamsSchema.parse(params);
    return context.core.mcp.applyAdopt(parsedParams);
}
export async function handleMcpInstallList(context, params) {
    McpInstallListParamsSchema.parse(params ?? {});
    return context.core.mcp.listInstalls();
}
export async function handleMcpInstallUninstall(context, params) {
    const parsedParams = McpInstallUninstallParamsSchema.parse(params);
    return context.core.mcp.uninstallInstalledServer(parsedParams);
}
export async function handleMcpInstallRepair(context, params) {
    const parsedParams = McpInstallRepairParamsSchema.parse(params);
    return context.core.mcp.repairInstalledServer(parsedParams);
}
//# sourceMappingURL=mcpHandlers.js.map