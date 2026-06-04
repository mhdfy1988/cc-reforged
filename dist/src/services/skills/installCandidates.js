import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { normalizeSkillPackage } from '../../skills/normalizeSkillPackage.js';
import { parseSkillFrontmatterFields } from '../../skills/skillFrontmatter.js';
import { parseFrontmatter } from '../../utils/frontmatterParser.js';
import { parseYaml } from '../../utils/yaml.js';
import { collectSkillResourceDirs } from './importDiscovery.js';
import { CCR_SKILL_IMPORT_MARKER_FILE } from './importPaths.js';
import { parseCcrSkillImportMarker } from './importSource.js';
import { listBuiltinSkillPresets, materializeBuiltinSkillPresetPackage, } from './builtinPresets.js';
import { createCcrSkillInstallManifest, parseCcrSkillInstallManifest, parseCcrSkillInstalledIndex, summarizeCcrSkillInstallManifest, } from './installManifest.js';
import { getCcrSkillInstallPaths } from './installPaths.js';
import { summarizeSecurityReportRisks } from './securityPolicy.js';
import { scanSkillPackage } from './securityScanner.js';
export async function searchSkillInstallCandidates(input = {}) {
    const query = input.query?.trim().toLowerCase() ?? '';
    const paths = getCcrSkillInstallPaths(input.configHomeDir);
    const [installedIndex, importedResult, manifestResult, builtinResult] = await Promise.all([
        readInstalledIndex(paths.installedIndexPath),
        loadImportedSkillCandidates(paths.importedRootDir),
        loadLocalManifestCandidates(paths.manifestsDir, input.configHomeDir),
        loadBuiltinPresetCandidates(input.configHomeDir),
    ]);
    const candidates = applyInstallCandidateState([
        ...importedResult.candidates,
        ...manifestResult.candidates,
        ...builtinResult.candidates,
    ].filter(candidate => query
        ? getCandidateSearchText(candidate).some(value => value.toLowerCase().includes(query))
        : true), installedIndex).sort(compareInstallCandidates);
    return {
        query,
        candidates,
        errors: [
            ...importedResult.errors,
            ...manifestResult.errors,
            ...builtinResult.errors,
        ],
        sources: [
            {
                sourceType: 'imported-skill',
                sourceLabel: '已导入 Skill',
                originPath: paths.importedRootDir,
                enabled: true,
            },
            {
                sourceType: 'local-manifest',
                sourceLabel: '本地安装清单',
                originPath: paths.manifestsDir,
                enabled: true,
            },
            {
                sourceType: 'builtin-preset',
                sourceLabel: '内置 Skill preset',
                originPath: null,
                enabled: true,
            },
        ],
    };
}
async function loadImportedSkillCandidates(importedRootDir) {
    let entries;
    try {
        entries = await readdir(importedRootDir, { withFileTypes: true });
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT') {
            return { candidates: [], errors: [] };
        }
        return {
            candidates: [],
            errors: [
                {
                    sourceType: 'imported-skill',
                    originPath: importedRootDir,
                    message: `无法读取 imported skill 目录：${formatErrorMessage(error)}`,
                },
            ],
        };
    }
    const results = await Promise.all(entries
        .filter(entry => entry.isDirectory())
        .map(entry => loadImportedSkillCandidate(join(importedRootDir, entry.name))));
    return splitCandidateResults(results);
}
async function loadImportedSkillCandidate(skillDir) {
    try {
        const marker = await readOptionalImportMarker(skillDir);
        const packagePreview = await loadSkillPackageFromDir({
            skillDir,
            originVendor: marker?.originVendor ?? 'agent-skills',
            importedFrom: marker?.sourcePath ?? skillDir,
            legacyCommand: marker?.source.kind === 'claude-command',
            risks: [],
        });
        const manifest = createCcrSkillInstallManifest({
            name: packagePreview.name,
            displayName: packagePreview.displayName,
            description: packagePreview.description,
            source: {
                kind: 'imported-skill',
                path: skillDir,
                ...(marker
                    ? { importMarkerPath: join(skillDir, CCR_SKILL_IMPORT_MARKER_FILE) }
                    : {}),
            },
            targetScope: 'user',
            defaults: {
                enabled: true,
                modelInvocable: packagePreview.invocation.modelInvocable,
                userInvocable: packagePreview.invocation.userInvocable,
            },
            trust: inferTrust(packagePreview),
            compatibility: {
                vendor: packagePreview.origin.vendor,
                convertedFromCommand: marker?.converted ?? false,
            },
        });
        const securityReport = await scanSkillPackage(packagePreview, {
            source: 'candidate',
        });
        const risks = summarizeSecurityReportRisks(securityReport);
        return createInstallCandidate({
            sourceType: 'imported-skill',
            sourceLabel: '已导入 Skill',
            originPath: skillDir,
            manifest,
            packagePreview,
            securityReport,
            trusted: !manifest.trust.thirdParty,
            risks,
        });
    }
    catch (error) {
        return {
            sourceType: 'imported-skill',
            originPath: skillDir,
            message: `无法生成 imported skill 安装候选：${formatErrorMessage(error)}`,
        };
    }
}
async function loadLocalManifestCandidates(manifestsDir, configHomeDir) {
    let entries;
    try {
        entries = await readdir(manifestsDir, { withFileTypes: true });
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT') {
            return { candidates: [], errors: [] };
        }
        return {
            candidates: [],
            errors: [
                {
                    sourceType: 'local-manifest',
                    originPath: manifestsDir,
                    message: `无法读取 skill manifest 目录：${formatErrorMessage(error)}`,
                },
            ],
        };
    }
    const results = await Promise.all(entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => loadLocalManifestCandidate(join(manifestsDir, entry.name), configHomeDir)));
    return splitCandidateResults(results);
}
async function loadLocalManifestCandidate(manifestPath, configHomeDir) {
    try {
        const manifest = parseCcrSkillInstallManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
        const { packagePreview } = await loadSkillPackageForManifest({
            manifest,
            configHomeDir,
            risks: [],
        });
        const securityReport = await scanSkillPackage(packagePreview, {
            source: 'candidate',
        });
        const risks = summarizeSecurityReportRisks(securityReport);
        return createInstallCandidate({
            sourceType: 'local-manifest',
            sourceLabel: '本地安装清单',
            originPath: manifestPath,
            manifest,
            packagePreview,
            securityReport,
            trusted: !manifest.trust.thirdParty,
            risks,
        });
    }
    catch (error) {
        return {
            sourceType: 'local-manifest',
            originPath: manifestPath,
            message: `无法生成 manifest 安装候选：${formatErrorMessage(error)}`,
        };
    }
}
async function loadBuiltinPresetCandidates(configHomeDir) {
    const results = await Promise.all(listBuiltinSkillPresets().map(preset => loadBuiltinPresetCandidate(preset, configHomeDir)));
    return splitCandidateResults(results);
}
async function loadBuiltinPresetCandidate(preset, configHomeDir) {
    const originPath = `builtin-preset:${preset.presetId}`;
    try {
        const manifest = createCcrSkillInstallManifest({
            name: preset.name,
            displayName: preset.displayName,
            description: preset.description,
            version: preset.version,
            source: {
                kind: 'builtin-preset',
                presetId: preset.presetId,
            },
            targetScope: 'user',
            defaults: {
                enabled: true,
                modelInvocable: true,
                userInvocable: true,
            },
            trust: {
                thirdParty: false,
                executableContent: false,
                networkDeclared: false,
                secretsDeclared: [],
            },
            compatibility: {
                vendor: 'ccr',
                convertedFromCommand: false,
            },
        });
        const { packagePreview } = await loadSkillPackageForManifest({
            manifest,
            configHomeDir,
            risks: [],
        });
        const securityReport = await scanSkillPackage(packagePreview, {
            source: 'candidate',
        });
        const risks = summarizeSecurityReportRisks(securityReport);
        return createInstallCandidate({
            sourceType: 'builtin-preset',
            sourceLabel: '内置 Skill preset',
            originPath,
            manifest,
            packagePreview,
            securityReport,
            trusted: true,
            risks,
        });
    }
    catch (error) {
        return {
            sourceType: 'builtin-preset',
            originPath,
            message: `无法生成 builtin preset 安装候选：${formatErrorMessage(error)}`,
        };
    }
}
async function readInstalledIndex(installedIndexPath) {
    try {
        return parseCcrSkillInstalledIndex(JSON.parse(await readFile(installedIndexPath, 'utf8')));
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT') {
            return parseCcrSkillInstalledIndex({ schemaVersion: 1 });
        }
        throw error;
    }
}
async function readOptionalImportMarker(skillDir) {
    try {
        return parseCcrSkillImportMarker(JSON.parse(await readFile(join(skillDir, CCR_SKILL_IMPORT_MARKER_FILE), 'utf8')));
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
export async function loadSkillPackageFromDir(input) {
    const skillFilePath = join(input.skillDir, 'SKILL.md');
    const rawMarkdown = await readFile(skillFilePath, 'utf8');
    const { frontmatter, content } = parseFrontmatter(rawMarkdown, skillFilePath);
    const skillName = typeof frontmatter.name === 'string' && frontmatter.name.trim()
        ? frontmatter.name.trim()
        : input.skillDir.split(/[\\/]/).pop() ?? 'skill';
    const parsed = parseSkillFrontmatterFields(frontmatter, content, skillName, 'Skill');
    const resources = await collectSkillResourceDirs(input.skillDir, input.risks);
    const openaiYaml = await readOptionalOpenAiYaml(input.skillDir, input.risks);
    return normalizeSkillPackage({
        skillName,
        markdownContent: content,
        frontmatter,
        parsed,
        source: 'imported',
        filePath: skillFilePath,
        baseDir: input.skillDir,
        resources,
        openaiYaml,
        compatibilityHints: {
            vendor: input.originVendor,
            importedFrom: input.importedFrom,
            legacyCommand: input.legacyCommand,
        },
    });
}
export async function loadSkillPackageForManifest(input) {
    const { manifest, configHomeDir, risks } = input;
    if (manifest.source.kind === 'imported-skill') {
        const marker = await readOptionalImportMarker(manifest.source.path);
        const originVendor = manifest.compatibility?.vendor ?? marker?.originVendor ?? 'agent-skills';
        const importedFrom = marker?.sourcePath ?? manifest.source.path;
        const legacyCommand = manifest.compatibility?.convertedFromCommand ??
            marker?.source.kind === 'claude-command';
        return {
            packageDir: manifest.source.path,
            packagePreview: await loadSkillPackageFromDir({
                skillDir: manifest.source.path,
                originVendor,
                importedFrom,
                legacyCommand,
                risks,
            }),
            importedFrom,
            originVendor,
            legacyCommand,
        };
    }
    if (manifest.source.kind === 'builtin-preset') {
        const materialized = await materializeBuiltinSkillPresetPackage(manifest.source.presetId, { configHomeDir });
        const importedFrom = `builtin-preset:${manifest.source.presetId}`;
        return {
            packageDir: materialized.packageDir,
            packagePreview: await loadSkillPackageFromDir({
                skillDir: materialized.packageDir,
                originVendor: manifest.compatibility?.vendor ?? 'ccr',
                importedFrom,
                legacyCommand: false,
                risks,
            }),
            importedFrom,
            originVendor: manifest.compatibility?.vendor ?? 'ccr',
            legacyCommand: false,
        };
    }
    throw new Error(`Skill install manifest source is not installable: ${manifest.source.kind}`);
}
async function readOptionalOpenAiYaml(skillDir, risks) {
    try {
        return parseYaml(await readFile(join(skillDir, 'agents', 'openai.yaml'), 'utf8'));
    }
    catch (error) {
        if (getErrorCode(error) !== 'ENOENT') {
            risks.push(`读取 agents/openai.yaml 失败：${formatErrorMessage(error)}`);
        }
        return undefined;
    }
}
function createInstallCandidate(input) {
    return {
        candidateId: `${input.sourceType}:${input.originPath ?? input.manifest.name}`,
        sourceType: input.sourceType,
        sourceLabel: input.sourceLabel,
        originPath: input.originPath,
        state: 'available',
        stateMessage: '可安装',
        duplicateGroupCount: 1,
        manifest: summarizeCcrSkillInstallManifest(input.manifest),
        manifestInput: input.manifest,
        packagePreview: input.packagePreview,
        securityReport: input.securityReport,
        displayName: input.manifest.displayName ?? input.packagePreview.displayName ?? input.manifest.name,
        description: input.manifest.description ?? input.packagePreview.description,
        trusted: input.trusted,
        risks: input.risks,
    };
}
function applyInstallCandidateState(candidates, installedIndex) {
    const installedNames = new Set(Object.values(installedIndex.installed).map(record => record.name));
    const nameCounts = new Map();
    for (const candidate of candidates) {
        nameCounts.set(candidate.manifestInput.name, (nameCounts.get(candidate.manifestInput.name) ?? 0) + 1);
    }
    return candidates.map(candidate => {
        const duplicateGroupCount = nameCounts.get(candidate.manifestInput.name) ?? 1;
        if (installedNames.has(candidate.manifestInput.name)) {
            return {
                ...candidate,
                state: 'installed',
                stateMessage: '已安装',
                duplicateGroupCount,
            };
        }
        if (duplicateGroupCount > 1) {
            return {
                ...candidate,
                state: 'duplicate-name',
                stateMessage: `存在 ${duplicateGroupCount} 个同名安装候选`,
                duplicateGroupCount,
            };
        }
        return {
            ...candidate,
            duplicateGroupCount,
        };
    });
}
function splitCandidateResults(results) {
    return {
        candidates: results.filter(isCandidate),
        errors: results.filter((result) => !isCandidate(result)),
    };
}
function isCandidate(result) {
    return 'candidateId' in result;
}
function collectPackageRisks(skillPackage) {
    const risks = [];
    const scripts = skillPackage.resources.scripts;
    if (scripts.length > 0) {
        risks.push(`包含 scripts 资源：${scripts.length} 个文件`);
    }
    const executableLike = [
        ...skillPackage.resources.scripts,
        ...skillPackage.resources.assets,
        ...skillPackage.resources.references,
    ].filter(path => /\.(?:ps1|bat|cmd|sh|js|ts|py)$/i.test(path));
    if (executableLike.length > 0) {
        risks.push(`包含可执行或脚本类文件：${executableLike.join(', ')}`);
    }
    return risks;
}
function inferTrust(skillPackage) {
    const risks = collectPackageRisks(skillPackage);
    return {
        thirdParty: true,
        executableContent: risks.length > 0,
        networkDeclared: false,
        secretsDeclared: [],
    };
}
function getCandidateSearchText(candidate) {
    return [
        candidate.manifestInput.name,
        candidate.displayName,
        candidate.description,
        candidate.sourceLabel,
        candidate.originPath ?? '',
    ];
}
function compareInstallCandidates(a, b) {
    const stateDiff = stateRank(a.state) - stateRank(b.state);
    if (stateDiff !== 0)
        return stateDiff;
    const sourceDiff = sourceRank(a.sourceType) - sourceRank(b.sourceType);
    if (sourceDiff !== 0)
        return sourceDiff;
    return a.manifestInput.name.localeCompare(b.manifestInput.name);
}
function stateRank(state) {
    switch (state) {
        case 'available':
            return 0;
        case 'duplicate-name':
            return 1;
        case 'installed':
            return 2;
        case 'invalid':
            return 3;
    }
}
function sourceRank(sourceType) {
    switch (sourceType) {
        case 'imported-skill':
            return 0;
        case 'local-manifest':
            return 1;
        case 'builtin-preset':
            return 2;
    }
}
function getErrorCode(error) {
    return typeof error === 'object' && error != null && 'code' in error
        ? error.code
        : undefined;
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=installCandidates.js.map