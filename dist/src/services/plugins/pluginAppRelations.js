export function projectPluginAppRelations(record, registry) {
    const appsById = new Map(registry.apps.map(app => [app.id, app]));
    return record.appRelations.map(relation => {
        const app = appsById.get(relation.appId);
        const owner = app?.parentPluginId ?? app?.pluginId;
        return {
            ...relation,
            state: app ? appState(app) : 'unregistered',
            ownedByPlugin: relation.relation === 'provides' && owner === record.pluginId,
            registered: app !== undefined,
        };
    });
}
export class PluginAppRegistrationAdapter {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    registerProvidedApps(record, apps) {
        const provided = new Map(record.appRelations
            .filter(relation => relation.relation === 'provides')
            .map(relation => [relation.appId, relation]));
        const registrations = apps.map(app => {
            if (!provided.has(app.id)) {
                throw relationError('plugin-app-relation-not-provides', `Plugin ${record.pluginId} does not provide App ${app.id}.`);
            }
            const claimedOwner = app.parentPluginId ?? app.pluginId;
            if (claimedOwner && claimedOwner !== record.pluginId) {
                throw relationError('plugin-app-owner-mismatch', `App ${app.id} registration owner does not match ${record.pluginId}.`);
            }
            return {
                ...app,
                pluginId: record.pluginId,
                parentPluginId: record.pluginId,
            };
        });
        return this.registry.upsert(registrations);
    }
    unregisterProvidedApps(pluginId) {
        return this.registry.removeOwnedBy(pluginId);
    }
}
function appState(app) {
    if (app.authStatus === 'disabled' || app.enabled === false) {
        return 'disabled';
    }
    if (app.authStatus === 'connected' || app.connected === true) {
        return 'connected';
    }
    if (app.authStatus === 'needs-auth')
        return 'needs-auth';
    return 'disconnected';
}
function relationError(code, message) {
    return Object.assign(new Error(message), { code });
}
//# sourceMappingURL=pluginAppRelations.js.map