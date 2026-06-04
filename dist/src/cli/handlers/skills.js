import { readFile } from 'fs/promises';
import { applyCoreSkillImport, applyCoreSkillInstall, inspectCoreSkill, listCoreSkillInstalls, planCoreSkillImport, planCoreSkillInstall, repairCoreSkill, searchCoreSkillInstallCandidates, uninstallCoreSkill, } from '../../core/skillCore.js';
import { cliError, cliOk } from '../exit.js';
function formatJson(value) {
    return JSON.stringify(value, null, 2);
}
function getRecord(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} must be an object.`);
    }
    return value;
}
function getConfirmationToken(plan) {
    const confirmation = getRecord(getRecord(plan, 'plan').confirmation, 'confirmation');
    const token = confirmation.token;
    if (typeof token !== 'string' || token.length === 0) {
        throw new Error('Skill plan did not return a confirmation token.');
    }
    return token;
}
function getSkillScope(scope) {
    if (scope === undefined || scope === 'user') {
        return 'user';
    }
    if (scope === 'project') {
        return 'project';
    }
    return cliError(`Skill install scope must be user or project. Got "${scope}".`);
}
function asCandidateArray(result) {
    return Array.isArray(result.candidates)
        ? result.candidates.filter((candidate) => candidate !== null &&
            typeof candidate === 'object' &&
            !Array.isArray(candidate))
        : [];
}
function getCandidateName(candidate) {
    const manifestInput = getRecord(candidate.manifestInput, 'candidate.manifestInput');
    return typeof manifestInput.name === 'string' ? manifestInput.name : '';
}
async function getInstallCandidateByName(name) {
    const result = (await searchCoreSkillInstallCandidates({ query: name }));
    const candidates = asCandidateArray(result);
    return (candidates.find(candidate => getCandidateName(candidate) === name) ??
        candidates.find(candidate => candidate.candidateId === name) ??
        candidates[0] ??
        null);
}
async function readManifestFile(manifestPath) {
    try {
        return JSON.parse(await readFile(manifestPath, 'utf8'));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return cliError(`Failed to read skill manifest "${manifestPath}": ${message}`);
    }
}
function formatSearchLines(result) {
    const candidates = asCandidateArray(result);
    if (candidates.length === 0) {
        return `No Skill install candidates found for "${String(result.query ?? '')}".`;
    }
    return candidates
        .map(candidate => {
        const risks = Array.isArray(candidate.risks) ? candidate.risks.length : 0;
        return [
            String(candidate.displayName ?? getCandidateName(candidate)),
            `name=${getCandidateName(candidate)}`,
            `source=${String(candidate.sourceType ?? 'unknown')}`,
            `state=${String(candidate.state ?? 'unknown')}`,
            `risks=${risks}`,
        ].join(' | ');
    })
        .join('\n');
}
function formatStatusLines(result) {
    const installed = Array.isArray(result.installed) ? result.installed : [];
    if (installed.length === 0) {
        return 'No Skill installs found.';
    }
    return installed
        .map(item => {
        const record = getRecord(item, 'installed item');
        return [
            String(record.name ?? 'unknown'),
            `scope=${String(record.scope ?? 'unknown')}`,
            `status=${String(record.status ?? 'unknown')}`,
        ].join(' | ');
    })
        .join('\n');
}
function formatDryRun(kind, subject, plan) {
    return [
        `${kind} plan for ${subject}:`,
        formatJson(plan),
        '',
        'No changes were written. Re-run with --yes to apply this plan.',
    ].join('\n');
}
export async function skillSearchHandler(query = '', options = {}) {
    const result = (await searchCoreSkillInstallCandidates({ query }));
    return cliOk(options.json ? formatJson(result) : formatSearchLines(result));
}
export async function skillStatusHandler(options = {}) {
    const status = (await listCoreSkillInstalls());
    return cliOk(options.json ? formatJson(status) : formatStatusLines(status));
}
export async function skillInspectHandler(skillRef, options = {}) {
    const inspection = (await inspectCoreSkill({ skillRef }));
    if (inspection.found === false) {
        return cliError(`Skill install record was not found: ${skillRef}`);
    }
    return cliOk(options.json ? formatJson(inspection) : formatJson(inspection));
}
export async function skillImportHandler(options) {
    if (!options.kind) {
        return cliError('Skill import requires --kind.');
    }
    if (!options.path) {
        return cliError('Skill import requires --path.');
    }
    const source = {
        kind: options.kind,
        path: options.path,
    };
    const plan = await planCoreSkillImport({ source });
    if (!options.yes) {
        const output = options.json
            ? formatJson({ dryRun: true, plan })
            : formatDryRun('Import', options.path, plan);
        return cliOk(output);
    }
    const result = await applyCoreSkillImport({
        source,
        confirmed: true,
        confirmationToken: getConfirmationToken(plan),
    });
    return cliOk(formatJson(result));
}
export async function skillInstallHandler(candidateName, options) {
    let manifest;
    let subject;
    if (options.manifest) {
        manifest = await readManifestFile(options.manifest);
        subject = options.manifest;
    }
    else {
        if (!candidateName) {
            return cliError('Skill install requires a candidate name or --manifest.');
        }
        const candidate = await getInstallCandidateByName(candidateName);
        if (!candidate) {
            return cliError(`No Skill install candidate found for "${candidateName}".`);
        }
        manifest = getRecord(candidate.manifestInput, 'candidate.manifestInput');
        subject = getCandidateName(candidate) || candidateName;
    }
    const scope = getSkillScope(options.scope);
    const plan = await planCoreSkillInstall({
        manifest,
        scope,
        force: Boolean(options.force),
    });
    if (!options.yes) {
        const output = options.json
            ? formatJson({ dryRun: true, plan })
            : formatDryRun('Install', subject, plan);
        return cliOk(output);
    }
    const result = await applyCoreSkillInstall({
        manifest,
        scope,
        force: Boolean(options.force),
        confirmed: true,
        confirmationToken: getConfirmationToken(plan),
    });
    return cliOk(formatJson(result));
}
export async function skillUninstallHandler(skillRef, options) {
    if (!options.yes) {
        const inspection = await inspectCoreSkill({ skillRef });
        if (inspection.found === false) {
            return cliError(`Skill install record was not found: ${skillRef}`);
        }
        const output = options.json
            ? formatJson({ dryRun: true, action: 'uninstall', inspection })
            : `No changes were written. Re-run with --yes to uninstall "${skillRef}".`;
        return cliOk(output);
    }
    const result = await uninstallCoreSkill({
        skillRef,
        confirmed: true,
    });
    return cliOk(formatJson(result));
}
export async function skillRepairHandler(skillRef, options) {
    if (!options.yes) {
        const inspection = await inspectCoreSkill({ skillRef });
        if (inspection.found === false) {
            return cliError(`Skill install record was not found: ${skillRef}`);
        }
        const output = options.json
            ? formatJson({ dryRun: true, action: 'repair', inspection })
            : `No changes were written. Re-run with --yes to repair "${skillRef}".`;
        return cliOk(output);
    }
    const result = await repairCoreSkill({
        skillRef,
        confirmed: true,
    });
    return cliOk(formatJson(result));
}
//# sourceMappingURL=skills.js.map