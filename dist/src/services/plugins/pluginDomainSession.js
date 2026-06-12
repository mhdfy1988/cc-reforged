import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { InstalledPluginsFileSchema, KnownMarketplacesFileSchema, PluginMarketplaceSchema, } from '../../utils/plugins/schemas.js';
import { createPluginFromPath } from '../../utils/plugins/pluginLoader.js';
import { atomicWriteJson } from './pluginPersistence.js';
export function createPluginDomainSession(options) {
    const context = {
        workspaceRoot: resolve(options.workspaceRoot),
        currentCwd: resolve(options.currentCwd ?? options.workspaceRoot),
        configHomeDir: resolve(options.configHomeDir),
        runtimeInstanceId: options.runtimeInstanceId,
        requestId: options.requestId ?? randomUUID(),
        environment: Object.freeze({ ...(options.environment ?? {}) }),
    };
    const paths = createPluginPathResolver(context);
    const settings = options.repositories?.settings ??
        createFilePluginSettingsRepository(paths);
    const installations = options.repositories?.installations ??
        createFilePluginInstallationRepository(paths);
    const marketplaces = options.repositories?.marketplaces ??
        createFilePluginMarketplaceRepository(paths);
    const packages = options.repositories?.packages ?? createFilePluginPackageRepository();
    return {
        context,
        cacheKey: [
            context.configHomeDir,
            context.workspaceRoot,
            context.runtimeInstanceId,
            context.requestId,
        ].join('::'),
        paths,
        settings: memoizeRepository(settings),
        installations: memoizeRepository(installations),
        marketplaces: memoizeRepository(marketplaces),
        packages,
        options: options.repositories?.options ??
            createFilePluginOptionsRepository(paths),
        secrets: options.repositories?.secrets ??
            createFilePluginSecretRepository(paths),
        runtime: memoizeRepository(options.repositories?.runtime ??
            (options.runtimeActivations || options.runtimePlugins
                ? {
                    async read() {
                        return {
                            activations: [...(options.runtimeActivations ?? [])],
                            loadedPlugins: [...(options.runtimePlugins ?? [])],
                        };
                    },
                }
                : createFilePluginRuntimeSnapshotReader(paths))),
        retention: memoizeRepository(options.repositories?.retention ??
            createFilePluginRollbackRetentionRepository(paths)),
    };
}
export function createPluginPathResolver(context) {
    const pluginsRootDir = join(context.configHomeDir, 'plugins');
    return {
        pluginsRootDir,
        installedRegistryPath: join(pluginsRootDir, 'installed_plugins.json'),
        knownMarketplacesPath: join(pluginsRootDir, 'known_marketplaces.json'),
        marketplacesCacheDir: join(pluginsRootDir, 'marketplaces'),
        packageCacheDir: join(pluginsRootDir, 'cache'),
        operationStoreDir: join(pluginsRootDir, 'operations'),
        journalDir: join(pluginsRootDir, 'journals'),
        lockDir: join(pluginsRootDir, 'locks'),
        stagingDir: join(pluginsRootDir, 'staging'),
        retentionPath: join(pluginsRootDir, 'retention.json'),
        runtimeSnapshotPath: join(pluginsRootDir, 'runtime', `${createHash('sha256')
            .update(context.runtimeInstanceId)
            .digest('hex')
            .slice(0, 24)}.json`),
        userSettingsPath: join(context.configHomeDir, 'settings.json'),
        managedSettingsPath: resolveManagedSettingsPath(context),
        projectSettingsPath: join(context.workspaceRoot, '.ccr', 'settings.json'),
        localSettingsPath: join(context.workspaceRoot, '.ccr', 'settings.local.json'),
        credentialsPath: join(context.configHomeDir, '.credentials.json'),
    };
}
function createFilePluginRuntimeSnapshotReader(paths) {
    return {
        async read() {
            if (!existsSync(paths.runtimeSnapshotPath)) {
                return { activations: [], loadedPlugins: [] };
            }
            try {
                const parsed = JSON.parse(await readFile(paths.runtimeSnapshotPath, 'utf8'));
                return {
                    activations: Array.isArray(parsed.activations)
                        ? parsed.activations
                        : [],
                    loadedPlugins: Array.isArray(parsed.loadedPlugins)
                        ? parsed.loadedPlugins
                        : [],
                };
            }
            catch {
                return { activations: [], loadedPlugins: [] };
            }
        },
    };
}
function createFilePluginRollbackRetentionRepository(paths) {
    return {
        async read() {
            if (!existsSync(paths.retentionPath)) {
                return { schemaVersion: 1, records: [] };
            }
            try {
                const parsed = JSON.parse(await readFile(paths.retentionPath, 'utf8'));
                return {
                    schemaVersion: 1,
                    records: Array.isArray(parsed.records)
                        ? parsed.records.filter(isRollbackVersion)
                        : [],
                };
            }
            catch {
                return { schemaVersion: 1, records: [] };
            }
        },
    };
}
function isRollbackVersion(value) {
    if (!value || typeof value !== 'object')
        return false;
    const record = value;
    return (typeof record.retentionId === 'string' &&
        typeof record.pluginId === 'string' &&
        typeof record.version === 'string' &&
        typeof record.packagePath === 'string' &&
        (record.reason === 'update' || record.reason === 'rollback') &&
        typeof record.operationId === 'string' &&
        typeof record.createdAt === 'string' &&
        typeof record.expiresAt === 'string');
}
export function createCurrentProcessPluginDomainSession(options) {
    return createPluginDomainSession({
        ...options,
        runtimeInstanceId: options.runtimeInstanceId ?? 'current-process',
        environment: process.env,
    });
}
function createFilePluginSettingsRepository(paths) {
    return {
        async read() {
            const entries = await Promise.all([
                readSettingsEntry('managed', paths.managedSettingsPath),
                readSettingsEntry('user', paths.userSettingsPath),
                readSettingsEntry('project', paths.projectSettingsPath),
                readSettingsEntry('local', paths.localSettingsPath),
            ]);
            return {
                entries,
                diagnostics: entries.flatMap(entry => entry.diagnostics),
            };
        },
    };
}
function createFilePluginOptionsRepository(paths) {
    const readLayers = async (pluginId) => {
        const layers = [];
        for (const [scope, path] of [
            ['user', paths.userSettingsPath],
            ['project', paths.projectSettingsPath],
            ['local', paths.localSettingsPath],
        ]) {
            if (!existsSync(path)) {
                layers.push({ scope, path, values: {} });
                continue;
            }
            try {
                const raw = JSON.parse(await readFile(path, 'utf8'));
                layers.push({
                    scope,
                    path,
                    values: raw.pluginConfigs?.[pluginId]?.options ?? {},
                });
            }
            catch {
                layers.push({ scope, path, values: {} });
            }
        }
        return layers;
    };
    return {
        async read(pluginId) {
            const values = {};
            for (const layer of await readLayers(pluginId)) {
                Object.assign(values, layer.values);
            }
            return values;
        },
        readLayers,
        async write(identity, values) {
            const path = configurationSettingsPath(paths, identity);
            const current = (await readJsonObject(path)) ?? {};
            const pluginConfigs = asRecord(current.pluginConfigs);
            const pluginConfig = asRecord(pluginConfigs[identity.pluginId]);
            const options = {
                ...asRecord(pluginConfig.options),
                ...values,
            };
            await atomicWriteJson(path, {
                ...current,
                pluginConfigs: {
                    ...pluginConfigs,
                    [identity.pluginId]: {
                        ...pluginConfig,
                        options,
                    },
                },
            });
        },
        async delete(identity) {
            const path = configurationSettingsPath(paths, identity);
            const current = await readJsonObject(path);
            if (!current)
                return;
            const pluginConfigs = asRecord(current.pluginConfigs);
            if (!(identity.pluginId in pluginConfigs))
                return;
            const nextPluginConfigs = { ...pluginConfigs };
            delete nextPluginConfigs[identity.pluginId];
            await atomicWriteJson(path, {
                ...current,
                ...(Object.keys(nextPluginConfigs).length > 0
                    ? { pluginConfigs: nextPluginConfigs }
                    : { pluginConfigs: undefined }),
            });
        },
    };
}
function createFilePluginSecretRepository(paths) {
    return {
        async hasSecrets(pluginId) {
            if (!existsSync(paths.credentialsPath))
                return false;
            try {
                const raw = JSON.parse(await readFile(paths.credentialsPath, 'utf8'));
                const prefix = `${pluginId}/`;
                return Object.keys(raw.pluginSecrets ?? {}).some(key => key === pluginId || key.startsWith(prefix));
            }
            catch {
                return false;
            }
        },
        async inspect(identity) {
            const storageKey = pluginSecretStorageKey(identity);
            try {
                const raw = await readCredentialFile(paths.credentialsPath);
                const secrets = asRecord(asRecord(raw).pluginSecrets);
                const values = asRecord(secrets[storageKey]);
                return {
                    configured: Object.keys(values).length > 0,
                    keyCount: Object.keys(values).length,
                    storageKey,
                    storagePath: paths.credentialsPath,
                };
            }
            catch (error) {
                return {
                    configured: false,
                    keyCount: 0,
                    storageKey,
                    storagePath: paths.credentialsPath,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        },
        async write(identity, values) {
            const storageKey = pluginSecretStorageKey(identity);
            const raw = await readCredentialFile(paths.credentialsPath);
            const current = asRecord(raw);
            const pluginSecrets = asRecord(current.pluginSecrets);
            const existing = asRecord(pluginSecrets[storageKey]);
            const nonEmptyValues = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
            await atomicWriteJson(paths.credentialsPath, {
                ...current,
                pluginSecrets: {
                    ...pluginSecrets,
                    [storageKey]: {
                        ...existing,
                        ...nonEmptyValues,
                    },
                },
            });
            await chmod(paths.credentialsPath, 0o600);
        },
        async delete(identity) {
            const storageKey = pluginSecretStorageKey(identity);
            const raw = await readCredentialFile(paths.credentialsPath);
            const current = asRecord(raw);
            const pluginSecrets = asRecord(current.pluginSecrets);
            if (!(storageKey in pluginSecrets))
                return;
            const nextPluginSecrets = { ...pluginSecrets };
            delete nextPluginSecrets[storageKey];
            await atomicWriteJson(paths.credentialsPath, {
                ...current,
                ...(Object.keys(nextPluginSecrets).length > 0
                    ? { pluginSecrets: nextPluginSecrets }
                    : { pluginSecrets: undefined }),
            });
            await chmod(paths.credentialsPath, 0o600);
        },
    };
}
function configurationSettingsPath(paths, identity) {
    switch (identity.scope) {
        case 'user':
            return paths.userSettingsPath;
        case 'project':
            return paths.projectSettingsPath;
        case 'local':
            return paths.localSettingsPath;
    }
}
function pluginSecretStorageKey(identity) {
    if (identity.scope === 'user')
        return identity.pluginId;
    const workspaceRoot = identity.workspaceRoot;
    if (!workspaceRoot) {
        throw Object.assign(new Error(`${identity.scope} Plugin secret identity requires workspaceRoot.`), { code: 'plugin-config-workspace-required' });
    }
    const workspaceKey = createHash('sha256')
        .update(resolve(workspaceRoot))
        .digest('hex')
        .slice(0, 16);
    return `${identity.pluginId}/${identity.scope}/${workspaceKey}`;
}
async function readCredentialFile(path) {
    if (!existsSync(path))
        return {};
    return JSON.parse(await readFile(path, 'utf8'));
}
async function readJsonObject(path) {
    if (!existsSync(path))
        return null;
    return JSON.parse(await readFile(path, 'utf8'));
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function createFilePluginInstallationRepository(paths) {
    return {
        async read() {
            if (!existsSync(paths.installedRegistryPath)) {
                return { schemaVersion: null, entries: [], diagnostics: [] };
            }
            try {
                const raw = JSON.parse(await readFile(paths.installedRegistryPath, 'utf8'));
                const parsed = InstalledPluginsFileSchema().parse(raw);
                if (parsed.version === 1) {
                    return {
                        schemaVersion: 1,
                        entries: Object.entries(parsed.plugins).map(([pluginId, entry]) => ({
                            pluginId,
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
                        })),
                        diagnostics: [
                            diagnostic({
                                severity: 'warning',
                                code: 'plugin-install-registry-v1',
                                message: 'Plugin 安装记录仍为 V1；查询已兼容读取，但写操作应先完成显式迁移。',
                                layer: 'installation',
                                path: paths.installedRegistryPath,
                            }),
                        ],
                    };
                }
                return {
                    schemaVersion: 2,
                    entries: Object.entries(parsed.plugins).flatMap(([pluginId, installations]) => installations.map((entry) => ({
                        pluginId,
                        scope: entry.scope,
                        ...(entry.projectPath
                            ? { projectPath: resolve(entry.projectPath) }
                            : {}),
                        installPath: resolve(entry.installPath),
                        ...(entry.version ? { version: entry.version } : {}),
                        ...(entry.installedAt
                            ? { installedAt: entry.installedAt }
                            : {}),
                        ...(entry.lastUpdated
                            ? { lastUpdated: entry.lastUpdated }
                            : {}),
                        ...(entry.gitCommitSha
                            ? { gitCommitSha: entry.gitCommitSha }
                            : {}),
                    }))),
                    diagnostics: [],
                };
            }
            catch (error) {
                return {
                    schemaVersion: null,
                    entries: [],
                    diagnostics: [
                        diagnostic({
                            severity: 'error',
                            code: 'plugin-install-registry-invalid',
                            message: errorMessage(error),
                            layer: 'installation',
                            path: paths.installedRegistryPath,
                        }),
                    ],
                };
            }
        },
    };
}
function createFilePluginMarketplaceRepository(paths) {
    return {
        async read() {
            if (!existsSync(paths.knownMarketplacesPath)) {
                return { sources: [], candidates: [], diagnostics: [] };
            }
            const sources = [];
            const candidates = [];
            const diagnostics = [];
            try {
                const known = KnownMarketplacesFileSchema().parse(JSON.parse(await readFile(paths.knownMarketplacesPath, 'utf8')));
                const declarations = await readMarketplaceDeclarations(paths);
                for (const [sourceId, entry] of Object.entries(known)) {
                    const sourceDiagnostics = [];
                    const marketplacePath = await resolveMarketplaceManifestPath(entry.installLocation);
                    if (!marketplacePath) {
                        const missingDiagnostic = diagnostic({
                            severity: 'warning',
                            code: 'plugin-marketplace-cache-missing',
                            message: `Marketplace ${sourceId} 的本地清单不存在。`,
                            layer: 'marketplace',
                            path: entry.installLocation,
                        });
                        sourceDiagnostics.push(missingDiagnostic);
                        diagnostics.push(missingDiagnostic);
                        sources.push(marketplaceSourceRecord({
                            name: sourceId,
                            entry: { ...entry, source: entry.source },
                            declaredScopes: declarations.get(sourceId) ?? [],
                            state: 'missing',
                            diagnostics: sourceDiagnostics,
                        }));
                        continue;
                    }
                    try {
                        const marketplace = PluginMarketplaceSchema().parse(JSON.parse(await readFile(marketplacePath, 'utf8')));
                        for (const plugin of marketplace.plugins) {
                            candidates.push({
                                pluginId: `${plugin.name}@${sourceId}`,
                                sourceId,
                                sourceKind: 'marketplace',
                                ...(plugin.version ? { version: plugin.version } : {}),
                                manifest: plugin,
                                marketplacePath,
                                marketplaceRoot: entry.installLocation,
                                source: plugin.source,
                                strict: plugin.strict,
                                ...(marketplace.allowCrossMarketplaceDependenciesOn
                                    ? {
                                        allowCrossMarketplaceDependenciesOn: [
                                            ...marketplace.allowCrossMarketplaceDependenciesOn,
                                        ],
                                    }
                                    : {}),
                            });
                        }
                        sources.push(marketplaceSourceRecord({
                            name: sourceId,
                            entry: { ...entry, source: entry.source },
                            declaredScopes: declarations.get(sourceId) ?? [],
                            state: 'available',
                            candidateCount: marketplace.plugins.length,
                            diagnostics: sourceDiagnostics,
                        }));
                    }
                    catch (error) {
                        const invalidDiagnostic = diagnostic({
                            severity: 'error',
                            code: 'plugin-marketplace-invalid',
                            message: errorMessage(error),
                            layer: 'marketplace',
                            path: marketplacePath,
                        });
                        sourceDiagnostics.push(invalidDiagnostic);
                        diagnostics.push(invalidDiagnostic);
                        sources.push(marketplaceSourceRecord({
                            name: sourceId,
                            entry: { ...entry, source: entry.source },
                            declaredScopes: declarations.get(sourceId) ?? [],
                            state: 'invalid',
                            diagnostics: sourceDiagnostics,
                        }));
                    }
                }
            }
            catch (error) {
                diagnostics.push(diagnostic({
                    severity: 'error',
                    code: 'plugin-known-marketplaces-invalid',
                    message: errorMessage(error),
                    layer: 'marketplace',
                    path: paths.knownMarketplacesPath,
                }));
            }
            return { sources, candidates, diagnostics };
        },
    };
}
function marketplaceSourceRecord(input) {
    return {
        name: input.name,
        source: input.entry.source,
        installLocation: input.entry.installLocation,
        lastUpdated: input.entry.lastUpdated,
        autoUpdate: input.entry.autoUpdate === true,
        candidateCount: input.candidateCount ?? 0,
        declaredScopes: input.declaredScopes,
        state: input.state,
        diagnostics: input.diagnostics,
    };
}
async function readMarketplaceDeclarations(paths) {
    const declarations = new Map();
    for (const [scope, path] of [
        ['user', paths.userSettingsPath],
        ['project', paths.projectSettingsPath],
        ['local', paths.localSettingsPath],
    ]) {
        const settings = await readJsonObject(path);
        const entries = asRecord(settings?.extraKnownMarketplaces);
        for (const name of Object.keys(entries)) {
            const scopes = declarations.get(name) ?? [];
            scopes.push(scope);
            declarations.set(name, scopes);
        }
    }
    return declarations;
}
function createFilePluginPackageRepository() {
    return {
        async inspect(entry) {
            const diagnostics = [];
            try {
                const packageStat = await stat(entry.installPath);
                if (!packageStat.isDirectory()) {
                    return {
                        materialization: 'invalid',
                        diagnostics: [
                            diagnostic({
                                severity: 'error',
                                code: 'plugin-package-not-directory',
                                message: 'Plugin 安装路径不是目录。',
                                layer: 'package',
                                pluginId: entry.pluginId,
                                path: entry.installPath,
                            }),
                        ],
                    };
                }
                const loaded = await createPluginFromPath(entry.installPath, entry.pluginId, true, pluginName(entry.pluginId));
                const materialization = entry.version &&
                    loaded.plugin.manifest.version &&
                    entry.version !== loaded.plugin.manifest.version
                    ? 'drifted'
                    : 'present';
                diagnostics.push(...loaded.errors.map(error => diagnostic({
                    severity: 'warning',
                    code: `plugin-load-${error.type}`,
                    message: summarizeLoadError(error),
                    layer: 'package',
                    pluginId: entry.pluginId,
                    path: entry.installPath,
                })));
                return {
                    materialization,
                    manifest: loaded.plugin.manifest,
                    loadedPlugin: {
                        ...loaded.plugin,
                        source: entry.pluginId,
                        repository: entry.pluginId,
                    },
                    diagnostics,
                };
            }
            catch (error) {
                if (!existsSync(entry.installPath)) {
                    return {
                        materialization: 'missing',
                        diagnostics: [
                            diagnostic({
                                severity: 'error',
                                code: 'plugin-package-missing',
                                message: 'Plugin 安装记录存在，但包目录不存在。',
                                layer: 'package',
                                pluginId: entry.pluginId,
                                path: entry.installPath,
                            }),
                        ],
                    };
                }
                return {
                    materialization: 'invalid',
                    diagnostics: [
                        diagnostic({
                            severity: 'error',
                            code: 'plugin-package-invalid',
                            message: errorMessage(error),
                            layer: 'package',
                            pluginId: entry.pluginId,
                            path: entry.installPath,
                        }),
                    ],
                };
            }
        },
    };
}
async function readSettingsEntry(scope, path) {
    if (!path || !existsSync(path)) {
        return { scope, path, enabledPlugins: {}, diagnostics: [] };
    }
    try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        return {
            scope,
            path,
            enabledPlugins: parseEnabledPlugins(raw.enabledPlugins),
            diagnostics: [],
        };
    }
    catch (error) {
        return {
            scope,
            path,
            enabledPlugins: {},
            diagnostics: [
                diagnostic({
                    severity: 'error',
                    code: 'plugin-settings-invalid',
                    message: errorMessage(error),
                    layer: 'settings',
                    path,
                }),
            ],
        };
    }
}
function parseEnabledPlugins(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    return Object.fromEntries(Object.entries(value).filter((entry) => typeof entry[1] === 'boolean' ||
        (Array.isArray(entry[1]) &&
            entry[1].every(item => typeof item === 'string'))));
}
function resolveManagedSettingsPath(context) {
    const explicit = context.environment.CLAUDE_CODE_MANAGED_SETTINGS_FILE ??
        context.environment.CLAUDE_CODE_POLICY_SETTINGS_FILE;
    if (explicit)
        return resolve(explicit);
    if (context.environment.USER_TYPE === 'ant' &&
        context.environment.CLAUDE_CODE_MANAGED_SETTINGS_PATH) {
        return join(resolve(context.environment.CLAUDE_CODE_MANAGED_SETTINGS_PATH), 'managed-settings.json');
    }
    if (process.platform === 'win32') {
        return 'C:\\Program Files\\ClaudeCode\\managed-settings.json';
    }
    if (process.platform === 'darwin') {
        return '/Library/Application Support/ClaudeCode/managed-settings.json';
    }
    return '/etc/claude-code/managed-settings.json';
}
async function resolveMarketplaceManifestPath(installLocation) {
    try {
        const locationStat = await stat(installLocation);
        if (locationStat.isFile())
            return installLocation;
        const candidates = [
            join(installLocation, '.claude-plugin', 'marketplace.json'),
            join(installLocation, 'marketplace.json'),
            join(dirname(installLocation), 'marketplace.json'),
        ];
        return candidates.find(existsSync) ?? null;
    }
    catch {
        return null;
    }
}
function memoizeRepository(repository) {
    let snapshot;
    return {
        ...repository,
        read() {
            snapshot ??= repository.read();
            return snapshot;
        },
    };
}
function diagnostic(value) {
    return value;
}
function pluginName(pluginId) {
    const separator = pluginId.lastIndexOf('@');
    return separator > 0 ? pluginId.slice(0, separator) : pluginId;
}
function summarizeLoadError(error) {
    return `Plugin component load reported ${error.type}.`;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function toLoadedPluginSnapshot(plugins) {
    return plugins.map(plugin => ({ ...plugin }));
}
//# sourceMappingURL=pluginDomainSession.js.map