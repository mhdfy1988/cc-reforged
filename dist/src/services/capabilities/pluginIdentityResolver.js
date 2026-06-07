import { buildPluginId, parsePluginIdentifier, } from '../../utils/plugins/pluginIdentifier.js';
export function normalizePluginId(value) {
    const trimmed = value?.trim();
    if (!trimmed)
        return undefined;
    const parsed = parsePluginIdentifier(trimmed);
    return buildPluginId(parsed.name, parsed.marketplace);
}
export function resolveLoadedPluginId(plugin) {
    const source = normalizePluginId(plugin.source);
    const repository = normalizePluginId(plugin.repository);
    if (source?.includes('@'))
        return source;
    if (repository?.includes('@'))
        return repository;
    return source ?? repository ?? plugin.name;
}
export function resolveCommandPluginId(command) {
    return (normalizePluginId(command.pluginId) ??
        normalizePluginId(command.pluginInfo?.repository) ??
        normalizePluginId(command.pluginInfo?.pluginManifest.name));
}
//# sourceMappingURL=pluginIdentityResolver.js.map