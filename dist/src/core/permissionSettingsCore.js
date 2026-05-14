import { getEnabledSettingSources, SETTING_SOURCES, SOURCES, } from '../utils/settings/constants.js';
import { getSettingsDisplayPathsForSource, getSettingsWithSources, updateSettingsForSource, } from '../utils/settings/settings.js';
import { SettingsSchema } from '../utils/settings/types.js';
import { EXTERNAL_PERMISSION_MODES, } from '../types/permissions.js';
import { CoreError } from './errors.js';
const EDITABLE_SOURCES = new Set(SOURCES);
export function getCorePermissionSettingsSnapshot() {
    const settingsWithSources = getSettingsWithSources();
    const sourceSettings = new Map(settingsWithSources.sources.map(entry => [entry.source, entry.settings]));
    const enabledSources = new Set(getEnabledSettingSources());
    return {
        effective: normalizePermissionSettings(settingsWithSources.effective),
        sources: SETTING_SOURCES.filter(source => enabledSources.has(source)).map(source => {
            const paths = getSettingsDisplayPathsForSource(source);
            return {
                source,
                label: getPermissionSettingSourceLabel(source),
                editable: isEditableSource(source),
                enabled: enabledSources.has(source),
                ...(paths.writePath ? { path: paths.writePath } : {}),
                readPaths: paths.readPaths,
                permissions: normalizePermissionSettings(sourceSettings.get(source)),
            };
        }),
        editableSources: [...SOURCES],
        defaultSource: 'userSettings',
        modes: EXTERNAL_PERMISSION_MODES.map(mode => ({
            value: mode,
            label: getPermissionModeLabel(mode),
        })),
    };
}
export function updateCorePermissionSettings(input) {
    if (!isEditableSource(input.source)) {
        throw new CoreError('invalid_params', `Permission settings source is not editable: ${input.source}`);
    }
    const permissions = buildPermissionSettingsPatch(input.permissions);
    const validationPatch = {
        permissions: omitUndefined(permissions),
    };
    const validation = SettingsSchema().safeParse(validationPatch);
    if (!validation.success) {
        throw new CoreError('invalid_params', 'Invalid permission settings.', validation.error.issues.map(issue => issue.message).join('; '));
    }
    const result = updateSettingsForSource(input.source, {
        permissions,
    });
    if (result.error) {
        throw new CoreError('internal_error', 'Failed to update permission settings.', result.error.message);
    }
    return getCorePermissionSettingsSnapshot();
}
function normalizePermissionSettings(settings) {
    const permissions = settings?.permissions;
    return {
        allow: normalizeStringArray(permissions?.allow),
        deny: normalizeStringArray(permissions?.deny),
        ask: normalizeStringArray(permissions?.ask),
        defaultMode: typeof permissions?.defaultMode === 'string'
            ? permissions.defaultMode
            : null,
        disableBypassPermissionsMode: permissions?.disableBypassPermissionsMode === 'disable',
        additionalDirectories: normalizeStringArray(permissions?.additionalDirectories),
    };
}
function buildPermissionSettingsPatch(input) {
    const patch = {};
    if ('allow' in input) {
        patch.allow = normalizeStringArray(input.allow);
    }
    if ('deny' in input) {
        patch.deny = normalizeStringArray(input.deny);
    }
    if ('ask' in input) {
        patch.ask = normalizeStringArray(input.ask);
    }
    if ('defaultMode' in input) {
        patch.defaultMode = input.defaultMode ?? undefined;
    }
    if ('disableBypassPermissionsMode' in input) {
        patch.disableBypassPermissionsMode = input.disableBypassPermissionsMode
            ? 'disable'
            : undefined;
    }
    if ('additionalDirectories' in input) {
        patch.additionalDirectories = normalizeStringArray(input.additionalDirectories);
    }
    return patch;
}
function omitUndefined(input) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}
function isEditableSource(source) {
    return EDITABLE_SOURCES.has(source);
}
function getPermissionSettingSourceLabel(source) {
    switch (source) {
        case 'localSettings':
            return '本地项目';
        case 'projectSettings':
            return '项目共享';
        case 'userSettings':
            return '用户全局';
        case 'flagSettings':
            return '命令行参数';
        case 'policySettings':
            return '托管策略';
    }
}
function getPermissionModeLabel(mode) {
    switch (mode) {
        case 'default':
            return '默认询问';
        case 'acceptEdits':
            return '自动接受编辑';
        case 'plan':
            return '计划模式';
        case 'dontAsk':
            return '禁止询问';
        case 'bypassPermissions':
            return '绕过权限';
    }
}
//# sourceMappingURL=permissionSettingsCore.js.map