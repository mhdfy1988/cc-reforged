import { listCapabilityManagementProjection, listExtensionCapabilities, } from '../services/capabilities/capabilityService.js';
import { loadCcrMcpRuntimeSnapshot, } from '../services/mcp/runtimeSnapshot.js';
import { buildAppServerToolPool } from '../services/tools/appServerToolPool.js';
import { getEmptyToolPermissionContext } from '../Tool.js';
import { getClaudeConfigHomeDir } from '../utils/envUtils.js';
import { pathsEqual } from '../utils/file.js';
import { listCoreMcpServers } from './mcpCore.js';
import { resolve } from 'node:path';
import { createPluginDomainSession } from '../services/plugins/pluginDomainSession.js';
import { PluginInspector } from '../services/plugins/pluginInspector.js';
export async function listCoreCapabilities(params = {}) {
    return listExtensionCapabilities(await createCapabilityProviderContext(params));
}
export async function listCoreCapabilityManagement(params = {}) {
    return listCapabilityManagementProjection(await createCapabilityProviderContext(params));
}
async function createCapabilityProviderContext(params) {
    const capabilityEnvironment = await createCapabilityRuntimeEnvironment(params);
    const { mcpRuntime } = capabilityEnvironment;
    const mcpServerStatuses = Object.fromEntries(mcpRuntime.clients.map(client => [
        client.name,
        client.type === 'failed'
            ? { state: client.type, error: client.error }
            : client.type,
    ]));
    return {
        capabilityEnvironment,
        cwd: capabilityEnvironment.request.cwd,
        configHomeDir: capabilityEnvironment.request.configHomeDir,
        mcpConfig: capabilityEnvironment.mcpConfig,
        mcp: mcpRuntime,
        mcpCommands: mcpRuntime.commands,
        mcpResources: mcpRuntime.resources,
        loadedPlugins: capabilityEnvironment.plugins.plugins,
        pluginLoadErrors: capabilityEnvironment.plugins.errors,
        apps: capabilityEnvironment.apps,
        runtime: 'app-server',
        activeAgentCount: capabilityEnvironment.activeAgentCount,
        ...(capabilityEnvironment.platform
            ? { platform: capabilityEnvironment.platform }
            : {}),
        connectedMcpServerNames: capabilityEnvironment.connectedMcpServerNames,
        mcpServerStatuses,
        tools: capabilityEnvironment.tools,
    };
}
async function createCapabilityRuntimeEnvironment(params) {
    const cwd = resolve(params.cwd ?? process.cwd());
    const workspaceRoot = resolve(params.workspaceRoot ?? cwd);
    const configHomeDir = resolve(params.configHomeDir ?? getClaudeConfigHomeDir());
    const activeConfigHomeDir = resolve(getClaudeConfigHomeDir());
    const usesActiveConfigHome = pathsEqual(configHomeDir, activeConfigHomeDir);
    const pluginCatalog = params.pluginSnapshot === undefined
        ? await new PluginInspector().listCatalog(createPluginDomainSession({
            workspaceRoot,
            currentCwd: cwd,
            configHomeDir,
            runtimeInstanceId: params.runtimeInstanceId ?? 'app-server',
            ...(params.requestId ? { requestId: params.requestId } : {}),
            environment: process.env,
        }))
        : undefined;
    const pluginSnapshot = params.pluginSnapshot ??
        {
            plugins: pluginCatalog?.loadedPlugins ?? [],
            errors: [],
        };
    const mcpRuntime = params.mcpRuntime ??
        (usesActiveConfigHome
            ? await loadCcrMcpRuntimeSnapshot('capability-catalog')
            : createEmptyMcpRuntimeSnapshot());
    const mcpConfig = params.mcpConfig ??
        (await listCoreMcpServers({
            includeDisabled: true,
            cwd,
            configHomeDir,
            pluginSnapshot,
        }));
    const connectedMcpServerNames = mcpRuntime.clients
        .filter(client => client.type === 'connected')
        .map(client => client.name);
    const mcpServerStatuses = Object.fromEntries(mcpRuntime.clients.map(client => [
        client.name,
        client.type === 'failed'
            ? { state: client.type, error: client.error }
            : client.type,
    ]));
    const activeAgentCount = params.activeAgentCount ?? 0;
    const tools = buildAppServerToolPool({
        permissionContext: params.toolPermissionContext ?? getEmptyToolPermissionContext(),
        mcpTools: mcpRuntime.tools,
        activeAgentCount,
        connectedMcpServerNames,
        mcpServerStatuses,
        ...(params.platform ? { platform: params.platform } : {}),
    });
    return {
        schemaVersion: 1,
        request: {
            cwd,
            configHomeDir,
        },
        mcpConfig,
        mcpRuntime,
        plugins: pluginSnapshot,
        ...(pluginCatalog ? { pluginCatalog } : {}),
        apps: params.apps ?? [],
        tools,
        activeAgentCount,
        ...(params.platform ? { platform: params.platform } : {}),
        connectedMcpServerNames,
        mcpServerStatuses,
    };
}
function createEmptyMcpRuntimeSnapshot() {
    return {
        clients: [],
        tools: [],
        commands: [],
        resources: {},
    };
}
//# sourceMappingURL=capabilityCore.js.map