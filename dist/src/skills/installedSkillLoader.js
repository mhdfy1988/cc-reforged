import { listInstalledSkillPackageInspections, } from '../services/skills/installedPackageInspection.js';
import { parseCcrSkillPackage } from './packageSchema.js';
import { evaluateInstalledSkillActivation, } from './skillActivationPolicy.js';
export async function loadInstalledSkillRuntimePackages(options = {}) {
    const inspectionResult = await listInstalledSkillPackageInspections(options);
    const entries = [];
    const diagnostics = [];
    for (const inspection of inspectionResult.installed) {
        const activation = evaluateInstalledSkillActivation(inspection);
        diagnostics.push(...activation.diagnostics);
        if (!activation.runtimeVisible || !inspection.package) {
            continue;
        }
        entries.push({
            package: applyRuntimeActivation(inspection.package, inspection, activation),
            inspection,
            activation,
        });
    }
    return {
        schemaVersion: 1,
        entries,
        inspections: inspectionResult.installed,
        diagnostics,
        summary: inspectionResult.summary,
    };
}
function applyRuntimeActivation(skillPackage, inspection, activation) {
    const warnings = [
        ...skillPackage.compatibility.warnings,
        ...activation.diagnostics.map(diagnostic => diagnostic.message),
    ];
    return parseCcrSkillPackage({
        ...skillPackage,
        id: `managed:${inspection.installedRecord.lockKey}:${inspection.installedRecord.skillFilePath}`,
        source: 'managed',
        bodyPath: inspection.installedRecord.skillFilePath,
        baseDir: inspection.installedRecord.packageDir,
        origin: {
            ...skillPackage.origin,
            sourcePath: inspection.installedRecord.skillFilePath,
            importedFrom: getInstalledSourcePath(inspection.installedRecord),
        },
        invocation: {
            ...skillPackage.invocation,
            modelInvocable: activation.modelInvocable,
            userInvocable: activation.userInvocable,
        },
        compatibility: {
            ...skillPackage.compatibility,
            warnings,
        },
    });
}
function getInstalledSourcePath(record) {
    if (record.manifest.source.kind === 'imported-skill') {
        return record.manifest.source.path;
    }
    if (record.manifest.source.kind === 'local-manifest') {
        return record.manifest.source.path;
    }
    if (record.manifest.source.kind === 'builtin-preset') {
        return `builtin-preset:${record.manifest.source.presetId}`;
    }
    return record.packageDir;
}
//# sourceMappingURL=installedSkillLoader.js.map