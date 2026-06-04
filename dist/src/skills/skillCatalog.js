import { toPromptCommand, } from './skillCommandAdapter.js';
export function createSkillCatalog(skillPackages) {
    const { packages, diagnostics: dedupeDiagnostics } = dedupeSkillPackages(skillPackages);
    const sorted = sortForPrompt(packages);
    const diagnostics = [
        ...dedupeDiagnostics,
        ...findDuplicateNameDiagnostics(sorted),
    ];
    return {
        list() {
            return [...sorted];
        },
        diagnostics() {
            return [...diagnostics];
        },
        findById(id) {
            return sorted.find(skillPackage => skillPackage.id === id);
        },
        findByName(name) {
            return sorted.find(skillPackage => skillPackage.name === name);
        },
        groupBySource() {
            const grouped = new Map();
            for (const skillPackage of sorted) {
                const values = grouped.get(skillPackage.source) ?? [];
                values.push(skillPackage);
                grouped.set(skillPackage.source, values);
            }
            return grouped;
        },
        filterModelInvocable() {
            return sorted.filter(skillPackage => skillPackage.invocation.modelInvocable);
        },
        filterUserInvocable() {
            return sorted.filter(skillPackage => skillPackage.invocation.userInvocable);
        },
        toPromptCommands(resolveOptions) {
            return sorted.map(skillPackage => toPromptCommand(skillPackage, resolveOptions(skillPackage)));
        },
    };
}
export function sortForPrompt(skillPackages) {
    return [...skillPackages].sort((a, b) => {
        const sourceRankDiff = sourceRank(a.source) - sourceRank(b.source);
        if (sourceRankDiff !== 0) {
            return sourceRankDiff;
        }
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) {
            return nameDiff;
        }
        return a.id.localeCompare(b.id);
    });
}
export function dedupeSkillPackages(skillPackages) {
    const diagnostics = [];
    const byIdentity = new Map();
    for (const skillPackage of sortForPrompt(skillPackages)) {
        const identity = skillIdentity(skillPackage);
        if (!identity) {
            byIdentity.set(`id:${skillPackage.id}`, skillPackage);
            continue;
        }
        const existing = byIdentity.get(identity);
        if (existing) {
            diagnostics.push({
                kind: 'duplicate-identity',
                identity,
                keptId: existing.id,
                skippedId: skillPackage.id,
            });
            continue;
        }
        byIdentity.set(identity, skillPackage);
    }
    return {
        packages: [...byIdentity.values()],
        diagnostics,
    };
}
function findDuplicateNameDiagnostics(skillPackages) {
    const idsByName = new Map();
    for (const skillPackage of skillPackages) {
        const ids = idsByName.get(skillPackage.name) ?? [];
        ids.push(skillPackage.id);
        idsByName.set(skillPackage.name, ids);
    }
    return [...idsByName.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([name, ids]) => ({
        kind: 'duplicate-name',
        name,
        ids,
    }));
}
function skillIdentity(skillPackage) {
    return skillPackage.bodyPath
        ? `body:${skillPackage.bodyPath}`
        : skillPackage.origin.sourcePath
            ? `source:${skillPackage.origin.sourcePath}`
            : undefined;
}
function sourceRank(source) {
    switch (source) {
        case 'project':
            return 0;
        case 'user':
            return 1;
        case 'managed':
        case 'policy':
            return 2;
        case 'plugin':
            return 3;
        case 'mcp':
            return 4;
        case 'bundled':
            return 5;
        case 'imported':
            return 6;
        case 'legacy-command':
            return 7;
    }
}
//# sourceMappingURL=skillCatalog.js.map