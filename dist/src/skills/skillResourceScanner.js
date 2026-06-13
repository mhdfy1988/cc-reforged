import { join } from 'path';
export function createEmptySkillResources() {
    return {
        scripts: [],
        references: [],
        assets: [],
    };
}
export function normalizeSkillResources(input) {
    if (!input) {
        return createEmptySkillResources();
    }
    return {
        scripts: normalizeResourceList(input.scripts),
        references: normalizeResourceList(input.references),
        assets: normalizeResourceList(input.assets),
    };
}
function normalizeResourceList(values) {
    return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))];
}
export async function collectSkillResourceDirsFromFs(skillDir, readdir, onWarning) {
    const result = {
        scripts: [],
        references: [],
        assets: [],
    };
    await Promise.all(['scripts', 'references', 'assets'].map(async (key) => {
        const dir = join(skillDir, key);
        try {
            result[key] = (await collectRelativeFiles(readdir, dir, key)).sort();
        }
        catch (error) {
            if (getErrorCode(error) !== 'ENOENT') {
                onWarning?.({ key, dir, error });
            }
        }
    }));
    return result;
}
async function collectRelativeFiles(readdir, absoluteDir, relativeDir) {
    const entries = await readdir(absoluteDir);
    const files = await Promise.all(entries.map(async (entry) => {
        const absolutePath = join(absoluteDir, entry.name);
        const relativePath = join(relativeDir, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            return collectRelativeFiles(readdir, absolutePath, relativePath);
        }
        if (entry.isFile()) {
            return [relativePath];
        }
        return [];
    }));
    return files.flat();
}
function getErrorCode(error) {
    return typeof error === 'object' && error != null && 'code' in error
        ? error.code
        : undefined;
}
//# sourceMappingURL=skillResourceScanner.js.map