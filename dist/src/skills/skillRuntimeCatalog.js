let lastSkillRuntimeCatalogDiagnostics = [];
export function createSkillRuntimeCatalog(commands) {
    const ranked = commands
        .filter(command => command.type === 'prompt')
        .map((command, index) => ({
        command,
        index,
        rank: getSkillRuntimePriority(command),
    }))
        .sort(compareRankedCommands);
    const diagnostics = [];
    const keptByName = new Map();
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
    }
    lastSkillRuntimeCatalogDiagnostics = diagnostics;
    return {
        commands: [...keptByName.values()].sort(compareRankedCommands).map(item => item.command),
        diagnostics,
    };
}
export function getLastSkillRuntimeCatalogDiagnostics() {
    return [...lastSkillRuntimeCatalogDiagnostics];
}
export function createSkillRuntimeCapabilityCatalog(input) {
    const catalog = createSkillRuntimeCatalog(input.commands);
    const keptNames = new Set(catalog.commands.map(command => command.name));
    const diagnosticsBySkippedName = new Map();
    for (const diagnostic of catalog.diagnostics) {
        const list = diagnosticsBySkippedName.get(diagnostic.skipped.name) ?? [];
        list.push(diagnostic.message);
        diagnosticsBySkippedName.set(diagnostic.skipped.name, list);
    }
    const installedByName = new Map((input.installed ?? []).map(inspection => [inspection.name, inspection]));
    const capabilities = [];
    const seenCapabilityIds = new Set();
    for (const command of input.commands.filter(command => command.type === 'prompt')) {
        const installed = installedByName.get(command.name);
        const runtimeVisible = keptNames.has(command.name);
        const capability = commandToCapability({
            command,
            installedRef: installed?.lockKey ?? null,
            runtimeVisible,
            diagnostics: diagnosticsBySkippedName.get(command.name) ?? [],
        });
        const id = `${capability.name}\0${capability.sourceKind}\0${capability.loadedFrom}\0${capability.installedRef ?? ''}`;
        if (seenCapabilityIds.has(id)) {
            continue;
        }
        seenCapabilityIds.add(id);
        capabilities.push(capability);
    }
    for (const inspection of input.installed ?? []) {
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
        diagnostics: catalog.diagnostics,
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
    const enabled = command.isEnabled?.() ?? true;
    const sourceKind = getCapabilitySourceKind(command);
    return {
        schemaVersion: 1,
        name: command.name,
        displayName: command.userFacingName?.() ?? command.name,
        description: command.description,
        sourceKind,
        sourceLabel: toSourceLabel(command),
        loadedFrom: command.loadedFrom ?? 'unknown',
        installedRef: input.installedRef,
        modelInvocable: !command.disableModelInvocation,
        userInvocable: command.userInvocable !== false,
        enabled,
        runtimeVisible: input.runtimeVisible && enabled,
        hiddenReason: input.runtimeVisible
            ? enabled
                ? null
                : 'disabled'
            : 'duplicate-name',
        diagnostics: input.diagnostics,
    };
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
    return `${getCommandSource(command)}/${command.loadedFrom ?? 'unknown'}`;
}
function getCommandSource(command) {
    return command.type === 'prompt' ? String(command.source) : 'non-prompt';
}
//# sourceMappingURL=skillRuntimeCatalog.js.map