import { normalizePluginId } from './pluginIdentityResolver.js';
import { createExtensionCapabilityId } from './capabilityIdentity.js';
export function createAppCapabilityProvider(input = {}) {
    return {
        id: 'apps',
        listCapabilities(context) {
            const apps = context.capabilityEnvironment?.apps ??
                context.apps ??
                input.apps ??
                [];
            return listAppCapabilities(apps);
        },
    };
}
export function listAppCapabilities(apps = []) {
    return apps.map(toExtensionCapability);
}
function toExtensionCapability(app) {
    const enabled = app.authStatus === 'disabled' ? false : app.enabled !== false;
    const connected = app.authStatus === 'connected' ? true : app.connected === true;
    const available = enabled && connected;
    const pluginId = normalizePluginId(app.parentPluginId ?? app.pluginId);
    const status = enabled ? (connected ? 'enabled' : 'needs-auth') : 'disabled';
    return {
        schemaVersion: 1,
        id: createExtensionCapabilityId({
            kind: 'app',
            sourceKind: 'app',
            name: app.id,
            sourceRef: app.sourceLabel,
            pluginId,
            appId: app.id,
        }),
        name: app.id,
        displayName: app.name,
        description: app.description ?? '',
        kind: 'app',
        source: {
            kind: 'app',
            label: app.sourceLabel ?? 'app connector',
            ref: app.id,
            appId: app.id,
            ...(pluginId ? { pluginId } : {}),
        },
        state: {
            installed: true,
            enabled,
            available,
            runtimeVisible: false,
            status,
        },
        invocation: {
            modelInvocable: false,
            userInvocable: false,
            toolInvocable: false,
        },
        relations: {
            ...(pluginId ? { parentPluginId: pluginId } : {}),
        },
        diagnostics: available
            ? []
            : [
                {
                    kind: 'availability',
                    severity: enabled ? 'warning' : 'info',
                    code: enabled ? 'app-needs-auth' : 'app-disabled',
                    message: enabled
                        ? `App connector ${app.id} needs authentication.`
                        : `App connector ${app.id} is disabled.`,
                },
            ],
        metadata: {
            ...(app.metadata ?? {}),
            connected,
            authStatus: app.authStatus ?? (connected ? 'connected' : status),
            ...(app.providedToolIds
                ? { providedToolIds: [...app.providedToolIds] }
                : {}),
            ...(app.providedMcpServerNames
                ? { providedMcpServerNames: [...app.providedMcpServerNames] }
                : {}),
            ...(app.providedSkillIds
                ? { providedSkillIds: [...app.providedSkillIds] }
                : {}),
        },
    };
}
//# sourceMappingURL=appCapabilityProvider.js.map