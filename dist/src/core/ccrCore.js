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
        workspace,
        permission,
        session,
    };
}
//# sourceMappingURL=ccrCore.js.map