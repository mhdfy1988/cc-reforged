import { listCoreModels, setCoreModel, setCoreModelProfile, } from '../../core/modelCore.js';
import { errorMessage } from '../../utils/errors.js';
import { cliError, cliOk } from '../exit.js';
export async function modelStatusHandler(options = {}) {
    try {
        const state = listCoreModels();
        const current = asRecord(state.current);
        const profile = findProfile(state, current.profileId);
        if (options.json) {
            return cliOk(JSON.stringify({ current, profile }, null, 2));
        }
        const lines = [
            `当前连接配置：${formatValue(profile?.name)} (${formatValue(current.profileId)})`,
            `当前供应商：${formatValue(current.provider)}`,
            `当前模型：${formatValue(current.model)}`,
        ];
        const apiMode = asString(profile?.apiMode);
        const authStrategy = asString(profile?.authStrategy);
        if (apiMode) {
            lines.push(`协议：${apiMode}`);
        }
        if (authStrategy) {
            lines.push(`认证：${authStrategy}`);
        }
        return cliOk(lines.join('\n'));
    }
    catch (error) {
        return cliError(`Error: ${errorMessage(error)}`);
    }
}
export async function modelListHandler(options = {}) {
    try {
        const state = listCoreModels();
        if (options.json) {
            return cliOk(JSON.stringify(state, null, 2));
        }
        const current = asRecord(state.current);
        const providers = asRecordArray(state.providers);
        const profiles = asRecordArray(state.profiles);
        const lines = [];
        for (const provider of providers) {
            const providerId = asString(provider.id);
            if (!providerId) {
                continue;
            }
            lines.push(`${formatValue(provider.displayName)} (${providerId})`);
            const providerProfiles = profiles.filter(profile => asString(profile.providerType) === providerId);
            for (const profile of providerProfiles) {
                const profileId = asString(profile.id);
                const marker = profileId === current.profileId ? '*' : '-';
                const models = asStringArray(profile.models);
                lines.push(`  ${marker} ${formatValue(profile.name)} [${formatValue(profileId)}] 默认 ${formatValue(profile.defaultModel)}`);
                if (models.length > 0) {
                    lines.push(`    模型：${models.join(', ')}`);
                }
            }
        }
        return cliOk(lines.join('\n'));
    }
    catch (error) {
        return cliError(`Error: ${errorMessage(error)}`);
    }
}
export async function modelSetHandler(model, options = {}) {
    try {
        const normalizedModel = model.trim();
        if (!normalizedModel) {
            return cliError('Error: model cannot be empty.');
        }
        const result = options.profile
            ? await setCoreModelProfile({
                profileId: options.profile,
                model: normalizedModel === 'default' ? undefined : normalizedModel,
            })
            : await setCoreModel({
                ...(options.provider ? { provider: options.provider } : {}),
                model: normalizedModel,
            });
        return finishSetResult(result, options);
    }
    catch (error) {
        return cliError(`Error: ${errorMessage(error)}`);
    }
}
export async function modelProfileHandler(profileId, model, options = {}) {
    try {
        const result = await setCoreModelProfile({
            profileId,
            ...(model?.trim() && model.trim() !== 'default'
                ? { model: model.trim() }
                : {}),
        });
        return finishSetResult(result, options);
    }
    catch (error) {
        return cliError(`Error: ${errorMessage(error)}`);
    }
}
function finishSetResult(result, options) {
    if (options.json) {
        return cliOk(JSON.stringify(result, null, 2));
    }
    const current = asRecord(result.current);
    return cliOk([
        `已切换连接配置：${formatValue(current.profileId)}`,
        `当前供应商：${formatValue(current.provider)}`,
        `当前模型：${formatValue(current.model)}`,
        `配置文件：${formatValue(result.configPath)}`,
    ].join('\n'));
}
function findProfile(state, profileId) {
    const id = asString(profileId);
    return asRecordArray(state.profiles).find(profile => asString(profile.id) === id);
}
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function asRecordArray(value) {
    return Array.isArray(value) ? value.map(asRecord) : [];
}
function asString(value) {
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function asStringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
}
function formatValue(value) {
    return asString(value) ?? '-';
}
//# sourceMappingURL=model.js.map