import { resolveCommandPluginId } from '../services/capabilities/pluginIdentityResolver.js';
import { getSkillCommandAdapterKind, isUserInvocableSkillCommandCandidate, resolveSkillCommandRuntimeVisibility, } from './skillCommandRuntimeVisibility.js';
let lastSkillRuntimeCatalogDiagnostics = [];
export function createSkillRuntimeCatalog(commands) {
    const result = buildSkillRuntimeCatalog(commands);
    lastSkillRuntimeCatalogDiagnostics = result.catalog.diagnostics;
    return result.catalog;
}
function buildSkillRuntimeCatalog(commands) {
    const ranked = commands
        .filter(command => getSkillCommandAdapterKind(command) !== null)
        .map((command, index) => ({
        command,
        index,
        rank: getSkillRuntimePriority(command),
    }))
        .sort(compareRankedCommands);
    const diagnostics = [];
    const keptByName = new Map();
    const diagnosticsBySkippedCommand = new Map();
    for (const item of ranked) {
        const existing = keptByName.get(item.command.name);
        if (!existing) {
            keptByName.set(item.command.name, item);
            continue;
        }
        diagnostics.push({
            kind: 'duplicate-name',
            name: item.command.name,
            kept: toCommandRef(existing),
            skipped: toCommandRef(item),
            message: `Skill '${item.command.name}' from ${toSourceLabel(item.command)} was hidden because ${toSourceLabel(existing.command)} has higher runtime priority.`,
        });
        const list = diagnosticsBySkippedCommand.get(item.command) ?? [];
        list.push(diagnostics[diagnostics.length - 1].message);
        diagnosticsBySkippedCommand.set(item.command, list);
    }
    const keptCommands = new Set([...keptByName.values()].map(item => item.command));
    return {
        catalog: {
            commands: [...keptByName.values()]
                .sort(compareRankedCommands)
                .map(item => item.command),
            diagnostics,
        },
        keptCommands,
        diagnosticsBySkippedCommand,
    };
}
export function getLastSkillRuntimeCatalogDiagnostics() {
    return [...lastSkillRuntimeCatalogDiagnostics];
}
export function listUserInvocableSkillCommands(commands) {
    return createSkillRuntimeCatalog(commands).commands.filter(isUserInvocableSkillCommandCandidate);
}
export function createSkillRuntimeCapabilityCatalog(input) {
    const runtimeCatalog = buildSkillRuntimeCatalog(input.commands);
    lastSkillRuntimeCatalogDiagnostics = runtimeCatalog.catalog.diagnostics;
    const installedByRef = new Map((input.installed ?? []).map(inspection => [inspection.lockKey, inspection]));
    const capabilities = [];
    const seenCapabilityIds = new Set();
    const attachedInstalledRefs = new Set();
    for (const command of input.commands.filter(command => getSkillCommandAdapterKind(command) !== null)) {
        const commandInstalledRef = getCommandInstalledRef(command);
        const installed = commandInstalledRef
            ? installedByRef.get(commandInstalledRef)
            : undefined;
        const runtimeVisible = runtimeCatalog.keptCommands.has(command);
        if (installed) {
            attachedInstalledRefs.add(installed.lockKey);
        }
        const capability = commandToCapability({
            command,
            installedRef: installed?.lockKey ?? null,
            runtimeVisible,
            diagnostics: runtimeCatalog.diagnosticsBySkippedCommand.get(command) ?? [],
        });
        const id = `${capability.name}\0${capability.sourceKind}\0${capability.loadedFrom}\0${capability.parentPluginId ?? ''}\0${capability.parentMcpServerName ?? ''}\0${capability.installedRef ?? ''}`;
        if (seenCapabilityIds.has(id)) {
            continue;
        }
        seenCapabilityIds.add(id);
        capabilities.push(capability);
    }
    for (const inspection of input.installed ?? []) {
        if (attachedInstalledRefs.has(inspection.lockKey)) {
            continue;
        }
        const id = `${inspection.name}\0managed-installed\0managed\0${inspection.lockKey}`;
        if (seenCapabilityIds.has(id)) {
            continue;
        }
        capabilities.push({
            schemaVersion: 1,
            name: inspection.name,
            displayName: inspection.name,
            description: inspection.statusMessage,
            sourceKind: 'managed-installed',
            sourceLabel: 'CCR installed package',
            loadedFrom: 'managed',
            installedRef: inspection.lockKey,
            parentPluginId: null,
            parentMcpServerName: null,
            modelInvocable: inspection.installedRecord.modelInvocable,
            userInvocable: inspection.installedRecord.userInvocable,
            enabled: inspection.installedRecord.enabled,
            runtimeVisible: inspection.status === 'installed',
            hiddenReason: inspection.status === 'installed' ? null : `inspection:${inspection.status}`,
            diagnostics: inspection.status === 'installed' ? [] : [inspection.statusMessage],
        });
        seenCapabilityIds.add(id);
    }
    return {
        schemaVersion: 1,
        capabilities: capabilities.sort(compareCapabilities),
        diagnostics: runtimeCatalog.catalog.diagnostics,
    };
}
export function getSkillRuntimePriority(command) {
    if (command.type !== 'prompt') {
        return 100;
    }
    if (command.loadedFrom === 'dynamic') {
        return 6;
    }
    if (command.loadedFrom === 'commands_DEPRECATED') {
        return 8;
    }
    if (command.source === 'policySettings') {
        return 0;
    }
    if (command.source === 'projectSettings' ||
        command.source === 'localSettings' ||
        command.source === 'flagSettings') {
        return 1;
    }
    if (command.source === 'userSettings' && command.loadedFrom !== 'managed') {
        return 2;
    }
    if (command.loadedFrom === 'managed') {
        return 3;
    }
    if (command.loadedFrom === 'plugin' || command.source === 'plugin') {
        return 4;
    }
    if (command.loadedFrom === 'bundled' || command.source === 'bundled') {
        return 5;
    }
    if (command.loadedFrom === 'mcp' || command.source === 'mcp') {
        return 7;
    }
    return 9;
}
function commandToCapability(input) {
    const command = input.command;
    if (command.type !== 'prompt') {
        throw new Error(`Expected prompt Skill command, received ${command.type}.`);
    }
    const runtimeCapability = resolveSkillCommandRuntimeVisibility(command);
    const enabled = runtimeCapability.state.enabled;
    const sourceKind = getCapabilitySourceKind(command);
    const parentPluginId = getCommandPluginId(command);
    const parentMcpServerName = command.mcpServerName ?? null;
    return {
        schemaVersion: 1,
        name: command.name,
        displayName: command.userFacingName?.() ?? command.name,
        description: command.description,
        sourceKind,
        sourceLabel: toSourceLabel(command),
        loadedFrom: command.loadedFrom ?? 'unknown',
        installedRef: input.installedRef,
        parentPluginId,
        parentMcpServerName,
        modelInvocable: runtimeCapability.invocation.modelInvocable,
        userInvocable: runtimeCapability.invocation.userInvocable,
        enabled,
        runtimeVisible: input.runtimeVisible && runtimeCapability.state.runtimeVisible,
        hiddenReason: input.runtimeVisible
            ? runtimeCapability.state.runtimeVisible
                ? null
                : (runtimeCapability.state.hiddenReasons?.[0] ?? 'disabled')
            : 'duplicate-name',
        diagnostics: input.diagnostics,
    };
}
function getCommandInstalledRef(command) {
    if (command.type !== 'prompt')
        return null;
    if (command.loadedFrom !== 'managed')
        return null;
    return typeof command.installedSkillRef === 'string' &&
        command.installedSkillRef.trim().length > 0
        ? command.installedSkillRef
        : null;
}
function getCapabilitySourceKind(command) {
    if (command.type !== 'prompt')
        return 'unknown';
    if (command.loadedFrom === 'managed')
        return 'managed-installed';
    if (command.loadedFrom === 'dynamic')
        return 'dynamic';
    if (command.loadedFrom === 'bundled')
        return 'bundled';
    if (command.loadedFrom === 'mcp' || command.source === 'mcp')
        return 'mcp';
    if (command.loadedFrom === 'commands_DEPRECATED')
        return 'legacy-command';
    if (command.loadedFrom === 'plugin' || command.source === 'plugin') {
        return command.pluginInfo ? 'plugin' : 'builtin-plugin';
    }
    if (command.source === 'policySettings')
        return 'policy';
    if (command.source === 'userSettings')
        return 'user';
    if (command.source === 'projectSettings' ||
        command.source === 'localSettings' ||
        command.source === 'flagSettings') {
        return 'project';
    }
    return 'unknown';
}
function compareCapabilities(a, b) {
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0)
        return nameDiff;
    return a.sourceKind.localeCompare(b.sourceKind);
}
function compareRankedCommands(a, b) {
    const rankDiff = a.rank - b.rank;
    if (rankDiff !== 0) {
        return rankDiff;
    }
    return a.index - b.index;
}
function toCommandRef(item) {
    return {
        name: item.command.name,
        source: getCommandSource(item.command),
        loadedFrom: item.command.loadedFrom ?? 'unknown',
        rank: item.rank,
    };
}
function toSourceLabel(command) {
    const pluginId = getCommandPluginId(command);
    if (pluginId) {
        return `${pluginId}/${command.loadedFrom ?? 'plugin'}`;
    }
    return `${getCommandSource(command)}/${command.loadedFrom ?? 'unknown'}`;
}
function getCommandSource(command) {
    return command.type === 'prompt' ? String(command.source) : 'non-prompt';
}
function getCommandPluginId(command) {
    if (command.type !== 'prompt')
        return null;
    return resolveCommandPluginId(command) ?? null;
}
//# sourceMappingURL=skillRuntimeCatalog.js.map