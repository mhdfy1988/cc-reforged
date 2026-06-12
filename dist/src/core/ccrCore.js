import { getCoreAuthStatus, loginCoreAuth } from './authCore.js';
import { listCoreCapabilities, listCoreCapabilityManagement, } from './capabilityCore.js';
import { getCoreConfigSnapshot } from './configCore.js';
import { addCoreMcpServer, applyCoreMcpAdopt, applyCoreMcpInstall, inspectCoreMcpServer, listCoreMcpServers, listCoreMcpInstalls, planCoreMcpAdopt, planCoreMcpInstall, repairCoreMcpInstalledServer, removeCoreMcpServer, restartCoreMcpServer, saveCoreMcpInstallManifest, searchCoreMcpInstallCandidates, setCoreMcpServerEnabled, testCoreMcpServer, uninstallCoreMcpInstalledServer, updateCoreMcpServer, } from './mcpCore.js';
import { copyCoreModelProfile, deleteCoreModelProfile, getCoreModelAvailability, listCoreModelProfiles, listCoreModels, saveCoreModelProfile, setCoreModel, setCoreModelProfile, testCoreModelConnection, updateCoreModelCredential, } from './modelCore.js';
import { CorePermissionService } from './permissionCore.js';
import { CoreSessionService } from './sessionCore.js';
import { applyCoreSkillImport, applyCoreSkillInstall, inspectCoreSkill, listCoreSkillInstalls, planCoreSkillImport, planCoreSkillInstall, repairCoreSkill, saveCoreSkillInstallManifest, searchCoreSkillInstallCandidates, setCoreSkillEnabled, setCoreSkillInvocation, uninstallCoreSkill, } from './skillCore.js';
import { CoreWorkspaceService } from './workspaceCore.js';
import { AppCapabilityRegistry } from '../services/capabilities/appCapabilityRegistry.js';
import { CorePluginService } from './pluginCore.js';
import { PluginAppRegistrationAdapter, projectPluginAppRelations, } from '../services/plugins/pluginAppRelations.js';
export function createCcrCore(options = {}) {
    const emit = options.emit ?? (() => { });
    const workspace = new CoreWorkspaceService();
    const permission = new CorePermissionService({ emit });
    const session = new CoreSessionService({
        emit,
        getWorkspace: () => workspace.getWorkspace(),
        cancelPermissionsForTurn: input => permission.cancelForTurn(input),
        createCanUseTool: input => permission.createCanUseTool(input),
    });
    const appCapabilityRegistry = new AppCapabilityRegistry();
    const pluginAppRegistration = new PluginAppRegistrationAdapter(appCapabilityRegistry);
    const plugins = new CorePluginService({
        ...(options.pluginActionExecutor
            ? { executor: options.pluginActionExecutor }
            : {}),
        ...(options.pluginRuntimeHostAdapterFactory
            ? {
                runtimeHostAdapterFactory: options.pluginRuntimeHostAdapterFactory,
            }
            : {}),
    });
    const withRegisteredApps = (params = {}) => {
        if (params.apps !== undefined) {
            appCapabilityRegistry.replace(params.apps);
        }
        return {
            ...params,
            apps: appCapabilityRegistry.getSnapshot().apps,
        };
    };
    return {
        config: {
            getSnapshot: getCoreConfigSnapshot,
        },
        auth: {
            getStatus: getCoreAuthStatus,
            login: loginCoreAuth,
        },
        capabilities: {
            list: (params = {}) => listCoreCapabilities(withRegisteredApps(params)),
            listManagement: (params = {}) => listCoreCapabilityManagement(withRegisteredApps(params)),
            apps: {
                register: appCapabilityRegistry.register.bind(appCapabilityRegistry),
                getSnapshot: appCapabilityRegistry.getSnapshot.bind(appCapabilityRegistry),
                clear: appCapabilityRegistry.clear.bind(appCapabilityRegistry),
            },
        },
        model: {
            getAvailability: getCoreModelAvailability,
            listProfiles: listCoreModelProfiles,
            listModels: listCoreModels,
            copyProfile: copyCoreModelProfile,
            deleteProfile: deleteCoreModelProfile,
            saveProfile: saveCoreModelProfile,
            setModel: setCoreModel,
            setProfile: setCoreModelProfile,
            testConnection: testCoreModelConnection,
            updateCredential: updateCoreModelCredential,
        },
        mcp: {
            addServer: addCoreMcpServer,
            inspectServer: inspectCoreMcpServer,
            listServers: listCoreMcpServers,
            removeServer: removeCoreMcpServer,
            restartServer: restartCoreMcpServer,
            searchInstallCandidates: searchCoreMcpInstallCandidates,
            setServerEnabled: setCoreMcpServerEnabled,
            testServer: testCoreMcpServer,
            planAdopt: planCoreMcpAdopt,
            applyAdopt: applyCoreMcpAdopt,
            planInstall: planCoreMcpInstall,
            applyInstall: applyCoreMcpInstall,
            saveInstallManifest: saveCoreMcpInstallManifest,
            listInstalls: listCoreMcpInstalls,
            repairInstalledServer: repairCoreMcpInstalledServer,
            uninstallInstalledServer: uninstallCoreMcpInstalledServer,
            updateServer: updateCoreMcpServer,
        },
        skills: {
            applyImport: applyCoreSkillImport,
            applyInstall: applyCoreSkillInstall,
            inspect: inspectCoreSkill,
            listInstalls: listCoreSkillInstalls,
            planImport: planCoreSkillImport,
            planInstall: planCoreSkillInstall,
            repair: repairCoreSkill,
            saveInstallManifest: saveCoreSkillInstallManifest,
            searchInstallCandidates: searchCoreSkillInstallCandidates,
            setEnabled: setCoreSkillEnabled,
            setInvocation: setCoreSkillInvocation,
            uninstall: uninstallCoreSkill,
        },
        plugins: {
            listCatalog: plugins.listCatalog.bind(plugins),
            listMarketplaces: plugins.listMarketplaces.bind(plugins),
            addMarketplace: plugins.addMarketplace.bind(plugins),
            removeMarketplace: plugins.removeMarketplace.bind(plugins),
            refreshMarketplace: plugins.refreshMarketplace.bind(plugins),
            importLocal: plugins.importLocal.bind(plugins),
            inspect: plugins.inspect.bind(plugins),
            planAction: plugins.plan.bind(plugins),
            applyAction: plugins.apply.bind(plugins),
            getOperation: plugins.getOperation.bind(plugins),
            cancelOperation: plugins.cancelOperation.bind(plugins),
            activateRuntime: plugins.activateRuntime.bind(plugins),
            getRuntimeSnapshot: plugins.getRuntimeSnapshot.bind(plugins),
            inspectConfiguration: plugins.inspectConfiguration.bind(plugins),
            saveConfiguration: plugins.saveConfiguration.bind(plugins),
            deleteConfiguration: plugins.deleteConfiguration.bind(plugins),
            registerProvidedApps: async (pluginId, apps, context) => {
                const record = await plugins.inspect(pluginId, context);
                if (!record) {
                    throw Object.assign(new Error(`Plugin was not found: ${pluginId}.`), { code: 'plugin-not-found' });
                }
                return pluginAppRegistration.registerProvidedApps(record, apps);
            },
            unregisterProvidedApps: (pluginId) => pluginAppRegistration.unregisterProvidedApps(pluginId),
            listAppRelations: async (pluginId, context) => {
                const record = await plugins.inspect(pluginId, context);
                if (!record) {
                    throw Object.assign(new Error(`Plugin was not found: ${pluginId}.`), { code: 'plugin-not-found' });
                }
                return projectPluginAppRelations(record, appCapabilityRegistry.getSnapshot());
            },
            getActionServiceForTests: plugins.getActionServiceForTests.bind(plugins),
        },
        workspace,
        permission,
        session,
    };
}
//# sourceMappingURL=ccrCore.js.map