import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { InstalledPluginsFileSchema, InstalledPluginsFileSchemaV2, } from '../../utils/plugins/schemas.js';
import { atomicWriteJson, readJsonOrNull } from './pluginPersistence.js';
/**
 * Transactional writers only persist V2. Reads remain compatible with V1,
 * while the first write performs an explicit, request-scoped migration.
 */
export async function readPluginRegistryV2ForWrite(path) {
    const legacyV2Path = join(dirname(path), 'installed_plugins_v2.json');
    const legacyV2 = await readJsonOrNull(legacyV2Path);
    if (legacyV2 !== null) {
        const migrated = InstalledPluginsFileSchemaV2().parse(legacyV2);
        await atomicWriteJson(path, migrated);
        await rm(legacyV2Path, { force: true });
        return migrated;
    }
    const raw = await readJsonOrNull(path);
    if (raw === null)
        return { version: 2, plugins: {} };
    const parsed = InstalledPluginsFileSchema().parse(raw);
    if (parsed.version === 2)
        return parsed;
    const migrated = {
        version: 2,
        plugins: Object.fromEntries(Object.entries(parsed.plugins).map(([pluginId, entry]) => [
            pluginId,
            [
                {
                    scope: 'user',
                    installPath: entry.installPath,
                    version: entry.version,
                    installedAt: entry.installedAt,
                    ...(entry.lastUpdated
                        ? { lastUpdated: entry.lastUpdated }
                        : {}),
                    ...(entry.gitCommitSha
                        ? { gitCommitSha: entry.gitCommitSha }
                        : {}),
                },
            ],
        ])),
    };
    InstalledPluginsFileSchemaV2().parse(migrated);
    await atomicWriteJson(path, migrated);
    return migrated;
}
//# sourceMappingURL=pluginRegistryCompatibility.js.map