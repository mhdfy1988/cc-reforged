import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep as pathSep } from 'node:path';
import { jsonStringify } from '../../utils/slowOperations.js';
import { getCcrSkillInstallPaths } from './installPaths.js';
import { BUILTIN_SKILL_PRESETS } from './builtinPresetDefinitions/registry.js';
export function listBuiltinSkillPresets() {
    return [...BUILTIN_SKILL_PRESETS];
}
export function getBuiltinSkillPreset(presetId) {
    return (BUILTIN_SKILL_PRESETS.find(preset => preset.presetId === presetId) ?? null);
}
export async function materializeBuiltinSkillPresetPackage(presetId, options = {}) {
    const preset = getBuiltinSkillPreset(presetId);
    if (!preset) {
        throw new Error(`Unknown builtin skill preset: ${presetId}`);
    }
    const packageDir = getBuiltinSkillPresetPackageDir(presetId, options);
    await rm(packageDir, { recursive: true, force: true });
    await writePresetFiles(packageDir, preset.files);
    await writeFile(join(packageDir, '.ccr-builtin-skill-preset.json'), `${jsonStringify({
        schemaVersion: 1,
        presetId: preset.presetId,
        name: preset.name,
        version: preset.version,
    }, null, 2)}\n`, 'utf8');
    return { preset, packageDir };
}
function getBuiltinSkillPresetPackageDir(presetId, options) {
    return join(getCcrSkillInstallPaths(options.configHomeDir).cacheDir, 'builtin-presets', sanitizePresetId(presetId));
}
async function writePresetFiles(packageDir, files) {
    await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
        const target = resolvePresetFilePath(packageDir, relativePath);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
    }));
}
function resolvePresetFilePath(packageDir, relativePath) {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    if (normalizedPath.startsWith('/') ||
        /^[a-zA-Z]:/u.test(normalizedPath) ||
        normalizedPath.split('/').some(part => part === '..' || part === '')) {
        throw new Error(`Builtin skill preset file path is unsafe: ${relativePath}`);
    }
    const target = resolve(packageDir, ...normalizedPath.split('/'));
    if (!isPathInside(packageDir, target)) {
        throw new Error(`Builtin skill preset file escapes package dir: ${relativePath}`);
    }
    return target;
}
function isPathInside(root, target) {
    const normalizedRoot = resolve(root).toLowerCase();
    const normalizedTarget = resolve(target).toLowerCase();
    return (normalizedTarget === normalizedRoot ||
        normalizedTarget.startsWith(`${normalizedRoot}${pathSep}`));
}
function sanitizePresetId(presetId) {
    return presetId.replace(/[^a-zA-Z0-9._-]+/g, '-');
}
//# sourceMappingURL=builtinPresets.js.map