import { getDefaultLlmRuntime, resetDefaultLlmRuntime, } from '../services/llm/defaultRuntime.js';
import { getLlmProfileForProvider, listResolvedLlmProfiles, loadLlmConfig, deletePersistedLlmProfile, updatePersistedLlmConfig, upsertPersistedLlmProfile, } from '../services/llm/llmConfig.js';
import { getLlmModelCatalogEntry, listKnownLlmModelCatalogEntries, } from '../services/llm/modelCatalog.js';
import { deleteLlmProfileCredential, updateLlmProviderApiKey, } from '../services/llm/providerCredentials.js';
import { getLlmRuntimeAuthStatusForProvider, getLlmRuntimeAuthStatusSyncForProvider, getLlmRuntimeDisplayStatusForProvider, getResolvedLlmProviderDefinition, } from '../services/llm/runtimeStatus.js';
import { resetDefaultCodexOAuthSession } from '../services/llm/sessions/defaultCodexOAuthSession.js';
import { CoreError } from './errors.js';
export function listCoreModels(provider) {
    const config = loadLlmConfig();
    const runtime = getDefaultLlmRuntime();
    const providerDefinitions = runtime.listProviderDefinitions();
    const providers = providerDefinitions
        .filter(definition => !provider || definition.id === provider)
        .map(definition => {
        const providerConfig = config.providers[definition.id];
        const defaultModel = providerConfig?.defaultModel ??
            (definition.id === config.provider ? config.model : definition.id);
        return {
            id: definition.id,
            displayName: definition.displayName,
            authStrategy: definition.authStrategy,
            apiMode: definition.apiMode,
            capabilities: definition.capabilities,
            profiles: listResolvedLlmProfiles(config)
                .filter(profile => profile.providerType === definition.id)
                .map(profile => profile.id),
            models: listKnownLlmModelCatalogEntries({
                providerId: definition.id,
                defaultModel,
                providerDefinition: getResolvedLlmProviderDefinition(definition.id, config),
            }),
        };
    });
    if (provider && providers.length === 0) {
        throw new CoreError('invalid_params', 'Unknown LLM provider.', {
            requestedProvider: provider,
        });
    }
    return {
        current: {
            profileId: config.currentProfileId,
            provider: config.provider,
            model: config.model,
        },
        profiles: listResolvedLlmProfiles(config).map(profile => createModelProfileView(profile, config)),
        providers,
    };
}
export function listCoreModelProfiles(input = {}) {
    const config = loadLlmConfig();
    const profiles = listResolvedLlmProfiles(config)
        .filter(profile => !input.providerType || profile.providerType === input.providerType)
        .map(profile => createModelProfileView(profile, config));
    return {
        current: {
            profileId: config.currentProfileId,
            provider: config.provider,
            model: config.model,
        },
        profiles,
    };
}
export function getCoreModelAvailability(input = {}) {
    const selection = resolveCoreModelSelection(input);
    const displayStatus = getLlmRuntimeDisplayStatusForProvider({
        ...(selection.profile?.id ? { profileId: selection.profile.id } : {}),
        provider: selection.provider,
        model: selection.model,
    }, selection.config);
    const authStatus = getLlmRuntimeAuthStatusSyncForProvider({
        ...(selection.profile?.id ? { profileId: selection.profile.id } : {}),
        provider: selection.provider,
        model: selection.model,
    }, selection.config);
    const state = getLocalAvailabilityState(authStatus);
    return {
        provider: selection.provider,
        providerDisplayName: displayStatus.providerDisplayName,
        profileId: selection.profile?.id ?? displayStatus.profileId,
        profileName: selection.profile?.name,
        model: selection.model,
        state,
        configured: state !== 'not_configured',
        available: authStatus.available,
        testable: authStatus.available,
        networkChecked: false,
        checkedAt: new Date().toISOString(),
        auth: {
            state: authStatus.state,
            configured: authStatus.configured,
            available: authStatus.available,
            message: authStatus.message,
            ...(authStatus.source ? { source: authStatus.source } : {}),
        },
        apiMode: displayStatus.apiMode,
        authStrategy: displayStatus.authStrategy,
        capabilities: displayStatus.capabilities,
        modelCatalogEntry: selection.modelCatalogEntry,
        ...(displayStatus.baseUrl ? { baseUrl: displayStatus.baseUrl } : {}),
        configPath: displayStatus.configPath,
        configSource: displayStatus.configSource,
    };
}
export async function testCoreModelConnection(input = {}) {
    const startedAt = Date.now();
    const selection = resolveCoreModelSelection(input);
    const authStatus = await getLlmRuntimeAuthStatusForProvider({
        ...(selection.profile?.id ? { profileId: selection.profile.id } : {}),
        provider: selection.provider,
        model: selection.model,
    }, selection.config);
    const localAvailability = getCoreModelAvailability({
        ...(selection.profile?.id ? { profileId: selection.profile.id } : {}),
        provider: selection.provider,
        model: selection.model,
    });
    if (!authStatus.available) {
        return {
            ...localAvailability,
            state: getLocalAvailabilityState(authStatus),
            ok: false,
            networkChecked: false,
            latencyMs: Date.now() - startedAt,
            error: {
                kind: 'auth_required',
                message: authStatus.message,
            },
        };
    }
    try {
        const runtime = getDefaultLlmRuntime();
        const response = await runtime.generate({
            ...(selection.profile?.id ? { profileId: selection.profile.id } : {}),
            provider: selection.provider,
            model: selection.model,
            messages: [
                {
                    role: 'user',
                    parts: [
                        {
                            type: 'text',
                            text: input.prompt?.trim() ||
                                'Reply with exactly: CCR_CONNECTION_OK',
                        },
                    ],
                },
            ],
            maxOutputTokens: 32,
            metadata: {
                connectionTest: true,
            },
        });
        const text = response.output
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
            .trim();
        return {
            ...localAvailability,
            state: 'verified',
            ok: true,
            available: true,
            testable: true,
            networkChecked: true,
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
            response: {
                stopReason: response.stopReason,
                text: text.slice(0, 240),
                usage: response.usage,
            },
        };
    }
    catch (error) {
        return {
            ...localAvailability,
            state: 'failed',
            ok: false,
            available: false,
            networkChecked: true,
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
            error: {
                kind: 'request_failed',
                message: error instanceof Error ? error.message : String(error),
            },
        };
    }
}
export async function setCoreModel(input) {
    const currentConfig = loadLlmConfig();
    const requestedProfile = input.profileId
        ? currentConfig.profiles[input.profileId.trim()]
        : undefined;
    if (input.profileId && !requestedProfile) {
        throw new CoreError('invalid_params', 'Unknown LLM profile.', {
            requestedProfileId: input.profileId,
        });
    }
    const requestedProvider = requestedProfile?.providerType ||
        input.provider?.trim() ||
        currentConfig.provider;
    const requestedModel = input.model.trim();
    if (!requestedModel) {
        throw new CoreError('invalid_params', 'LLM model cannot be empty.');
    }
    if (process.env.CCR_LLM_MODEL?.trim()) {
        throw new CoreError('invalid_params', 'LLM model is currently forced by CCR_LLM_MODEL.', {
            env: 'CCR_LLM_MODEL',
        });
    }
    if (requestedProvider !== currentConfig.provider &&
        process.env.CCR_LLM_PROVIDER?.trim()) {
        throw new CoreError('invalid_params', 'LLM provider is currently forced by CCR_LLM_PROVIDER.', {
            env: 'CCR_LLM_PROVIDER',
        });
    }
    const runtime = getDefaultLlmRuntime();
    const providerDefinitions = runtime.listProviderDefinitions();
    const providerDefinition = providerDefinitions.find(definition => definition.id === requestedProvider);
    if (!providerDefinition) {
        throw new CoreError('invalid_params', 'Unknown LLM provider.', {
            requestedProvider,
        });
    }
    const targetProfile = requestedProfile ?? getLlmProfileForProvider(requestedProvider, currentConfig);
    if (!targetProfile) {
        throw new CoreError('invalid_params', 'No LLM profile exists for this provider. Create or login a profile first.', { requestedProvider });
    }
    const models = listCatalogEntriesForProvider({
        providerId: requestedProvider,
        defaultModel: targetProfile.defaultModel ??
            currentConfig.providers[requestedProvider]?.defaultModel ??
            currentConfig.model,
        providerDefinition: getResolvedLlmProviderDefinition(requestedProvider, currentConfig),
        profile: targetProfile,
    });
    if (!models.some(model => model.model === requestedModel)) {
        throw new CoreError('invalid_params', 'Unknown LLM model.', {
            provider: requestedProvider,
            requestedModel,
        });
    }
    const nextConfig = await updatePersistedLlmConfig({
        provider: requestedProvider,
        model: requestedModel,
        currentProfileId: targetProfile.id,
    });
    resetDefaultLlmRuntime();
    return {
        current: {
            profileId: nextConfig.currentProfileId,
            provider: nextConfig.provider,
            model: nextConfig.model,
        },
        profileId: nextConfig.currentProfileId,
        provider: nextConfig.provider,
        model: nextConfig.model,
        configPath: nextConfig.path,
        configSource: nextConfig.source,
    };
}
export async function setCoreModelProfile(input) {
    const config = loadLlmConfig();
    const profile = config.profiles[input.profileId.trim()];
    if (!profile) {
        throw new CoreError('invalid_params', 'Unknown LLM profile.', {
            requestedProfileId: input.profileId,
        });
    }
    return setCoreModel({
        profileId: profile.id,
        model: input.model?.trim() || profile.defaultModel,
    });
}
export async function saveCoreModelProfile(input) {
    const config = loadLlmConfig();
    const providerType = input.providerType.trim();
    if (!providerType) {
        throw new CoreError('invalid_params', 'LLM provider type cannot be empty.');
    }
    const providerDefinition = getDefaultLlmRuntime()
        .listProviderDefinitions()
        .find(definition => definition.id === providerType);
    if (!providerDefinition) {
        throw new CoreError('invalid_params', 'Unknown LLM provider.', {
            providerType,
        });
    }
    const providerConfig = config.providers[providerType] ?? {};
    const defaultModel = input.defaultModel?.trim() ||
        input.models?.find(model => model.trim())?.trim() ||
        providerConfig.defaultModel?.trim();
    if (!defaultModel) {
        throw new CoreError('invalid_params', 'LLM profile default model is required.');
    }
    const profileId = input.profileId?.trim() || createNextProfileId(config, providerType);
    const models = normalizeProfileModels(defaultModel, input.models);
    const authStrategy = input.authStrategy ?? providerConfig.authStrategy ?? providerDefinition.authStrategy;
    const profile = {
        name: input.name?.trim() || getDefaultProfileDisplayName(providerDefinition),
        providerType,
        apiMode: input.apiMode ?? providerConfig.apiMode ?? providerDefinition.apiMode,
        ...(input.baseUrl?.trim()
            ? { endpoint: { baseUrl: input.baseUrl.trim() } }
            : {}),
        auth: {
            strategy: authStrategy,
            ...(input.accountId?.trim() ? { accountId: input.accountId.trim() } : {}),
        },
        defaultModel,
        models: {
            source: 'mixed',
            default: defaultModel,
            include: models.filter(model => model !== defaultModel),
        },
    };
    const nextConfig = await upsertPersistedLlmProfile({
        profileId,
        profile,
        setCurrent: input.setCurrent,
    });
    resetDefaultLlmRuntime();
    if (providerType === 'codex-oauth') {
        resetDefaultCodexOAuthSession();
    }
    const savedProfile = nextConfig.profiles[profileId];
    return {
        current: {
            profileId: nextConfig.currentProfileId,
            provider: nextConfig.provider,
            model: nextConfig.model,
        },
        profile: savedProfile ? createModelProfileView(savedProfile, nextConfig) : null,
        profiles: listResolvedLlmProfiles(nextConfig).map(profile => createModelProfileView(profile, nextConfig)),
    };
}
export async function copyCoreModelProfile(input) {
    const config = loadLlmConfig();
    const source = config.profiles[input.profileId.trim()];
    if (!source) {
        throw new CoreError('invalid_params', 'Unknown LLM profile.', {
            requestedProfileId: input.profileId,
        });
    }
    const nextName = input.name?.trim() || `${source.name} 副本`;
    return saveCoreModelProfile({
        name: nextName,
        providerType: source.providerType,
        apiMode: source.apiMode,
        authStrategy: source.authStrategy,
        ...(source.accountId ? { accountId: source.accountId } : {}),
        ...(source.baseUrl ? { baseUrl: source.baseUrl } : {}),
        defaultModel: source.defaultModel,
        models: source.models,
    });
}
export async function deleteCoreModelProfile(input) {
    const config = loadLlmConfig();
    const profile = config.profiles[input.profileId.trim()];
    if (!profile) {
        throw new CoreError('invalid_params', 'Unknown LLM profile.', {
            requestedProfileId: input.profileId,
        });
    }
    if (profile.source !== 'file') {
        throw new CoreError('invalid_params', 'Legacy LLM profiles cannot be deleted. Save or copy them as a formal profile first.', { requestedProfileId: input.profileId });
    }
    const nextConfig = await deletePersistedLlmProfile(profile.id);
    await deleteLlmProfileCredential(profile.id);
    resetDefaultLlmRuntime();
    if (profile.providerType === 'codex-oauth') {
        resetDefaultCodexOAuthSession();
    }
    return {
        current: {
            profileId: nextConfig.currentProfileId,
            provider: nextConfig.provider,
            model: nextConfig.model,
        },
        profiles: listResolvedLlmProfiles(nextConfig).map(profile => createModelProfileView(profile, nextConfig)),
    };
}
export async function updateCoreModelCredential(input) {
    const provider = input.provider.trim();
    if (!provider) {
        throw new CoreError('invalid_params', 'LLM provider cannot be empty.');
    }
    const selection = resolveCoreModelSelection({
        ...(input.profileId ? { profileId: input.profileId } : {}),
        provider,
        ...(input.model ? { model: input.model } : {}),
    });
    const acceptsApiKey = selection.providerDefinition.authStrategy === 'api_key' ||
        selection.providerDefinition.authStrategy === 'hybrid' ||
        selection.profile?.authStrategy === 'api_key';
    if (!acceptsApiKey) {
        throw new CoreError('invalid_params', 'This LLM provider does not accept API Key credentials.', {
            provider,
            authStrategy: selection.providerDefinition.authStrategy,
        });
    }
    let credentialProfile = selection.profile;
    if (!credentialProfile) {
        const profileId = createNextProfileId(selection.config, selection.provider);
        await saveCoreModelProfile({
            profileId,
            providerType: selection.provider,
            apiMode: selection.providerDefinition.apiMode,
            authStrategy: selection.providerDefinition.authStrategy === 'hybrid'
                ? 'api_key'
                : selection.providerDefinition.authStrategy,
            ...(selection.config.providers[selection.provider]?.baseUrl
                ? { baseUrl: selection.config.providers[selection.provider].baseUrl }
                : {}),
            defaultModel: selection.model,
            models: [selection.model],
            setCurrent: !selection.config.currentProfileId,
        });
        credentialProfile = loadLlmConfig().profiles[profileId];
    }
    const credential = await updateLlmProviderApiKey({
        provider,
        profileId: credentialProfile.id,
        apiKey: input.apiKey,
    });
    resetDefaultLlmRuntime();
    const availability = getCoreModelAvailability({
        ...(credentialProfile?.id ? { profileId: credentialProfile.id } : {}),
        provider: selection.provider,
        model: selection.model,
    });
    return {
        provider: selection.provider,
        model: selection.model,
        credential: {
            configured: credential.configured,
            source: credential.source,
            profileId: credential.profileId,
        },
        availability,
    };
}
function resolveCoreModelSelection(input) {
    const config = loadLlmConfig();
    const requestedProfile = input.profileId
        ? config.profiles[input.profileId.trim()]
        : undefined;
    if (input.profileId && !requestedProfile) {
        throw new CoreError('invalid_params', 'Unknown LLM profile.', {
            requestedProfileId: input.profileId,
        });
    }
    const requestedProvider = requestedProfile?.providerType || input.provider?.trim() || config.provider;
    const profile = requestedProfile ?? getLlmProfileForProvider(requestedProvider, config);
    const runtime = getDefaultLlmRuntime();
    const providerDefinition = runtime
        .listProviderDefinitions()
        .find(definition => definition.id === requestedProvider);
    if (!providerDefinition) {
        throw new CoreError('invalid_params', 'Unknown LLM provider.', {
            requestedProvider,
        });
    }
    const requestedModel = input.model?.trim() ||
        (requestedProvider === config.provider
            ? config.model
            : profile?.defaultModel?.trim() ||
                config.providers[requestedProvider]?.defaultModel?.trim());
    if (!requestedModel) {
        throw new CoreError('invalid_params', 'LLM model cannot be empty.', {
            requestedProvider,
        });
    }
    const models = listCatalogEntriesForProvider({
        providerId: requestedProvider,
        defaultModel: profile?.defaultModel ??
            config.providers[requestedProvider]?.defaultModel ??
            requestedModel,
        providerDefinition: getResolvedLlmProviderDefinition(requestedProvider, config),
        profile,
    });
    const modelCatalogEntry = models.find(model => model.model === requestedModel);
    if (!modelCatalogEntry) {
        throw new CoreError('invalid_params', 'Unknown LLM model.', {
            provider: requestedProvider,
            requestedModel,
        });
    }
    return {
        config,
        ...(profile ? { profile } : {}),
        provider: requestedProvider,
        model: requestedModel,
        providerDefinition,
        modelCatalogEntry,
    };
}
function listCatalogEntriesForProvider(input) {
    const known = listKnownLlmModelCatalogEntries({
        providerId: input.providerId,
        defaultModel: input.defaultModel,
        providerDefinition: input.providerDefinition,
    });
    const byModel = new Map(known.map(model => [model.model, model]));
    for (const model of input.profile?.models ?? []) {
        if (byModel.has(model)) {
            continue;
        }
        byModel.set(model, getLlmModelCatalogEntry({
            providerId: input.providerId,
            model,
            providerDefinition: input.providerDefinition,
        }));
    }
    return Array.from(byModel.values());
}
function createModelProfileView(profile, config) {
    return {
        id: profile.id,
        name: profile.name,
        providerType: profile.providerType,
        apiMode: profile.apiMode,
        authStrategy: profile.authStrategy,
        defaultModel: profile.defaultModel,
        models: profile.models,
        capabilities: profile.capabilities,
        source: profile.source,
        isCurrent: profile.id === config.currentProfileId,
        ...(profile.accountId ? { accountId: profile.accountId } : {}),
        ...(profile.baseUrl ? { baseUrl: profile.baseUrl } : {}),
        ...(profile.availability ? { availability: profile.availability } : {}),
    };
}
function createNextProfileId(config, providerType) {
    const escapedProvider = providerType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedProvider}-(\\d+)$`);
    let maxIndex = 0;
    for (const profileId of Object.keys(config.profiles)) {
        const match = profileId.match(pattern);
        if (!match) {
            continue;
        }
        maxIndex = Math.max(maxIndex, Number.parseInt(match[1], 10));
    }
    return `${providerType}-${maxIndex + 1}`;
}
function normalizeProfileModels(defaultModel, models) {
    return Array.from(new Set([
        defaultModel,
        ...(models ?? []).map(model => model.trim()).filter(Boolean),
    ]));
}
function getDefaultProfileDisplayName(providerDefinition) {
    if (providerDefinition.authStrategy === 'oauth_refreshable') {
        return `${providerDefinition.displayName} 登录配置`;
    }
    if (providerDefinition.authStrategy === 'api_key') {
        return `${providerDefinition.displayName} API Key`;
    }
    return `${providerDefinition.displayName} 默认连接`;
}
function getLocalAvailabilityState(input) {
    if (input.available) {
        return 'auth_ready';
    }
    if (input.configured) {
        return 'configured';
    }
    return 'needs_auth';
}
//# sourceMappingURL=modelCore.js.map