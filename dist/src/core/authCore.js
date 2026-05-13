import { getLlmRuntimeAuthStatus, getLlmRuntimeAuthStatusForProvider, } from '../services/llm/runtimeStatus.js';
import { getLlmProfileForProvider, loadLlmConfig, } from '../services/llm/llmConfig.js';
import { resetDefaultLlmRuntime } from '../services/llm/defaultRuntime.js';
import { createDefaultCodexOAuthSession, resetDefaultCodexOAuthSession, } from '../services/llm/sessions/defaultCodexOAuthSession.js';
import { CoreError } from './errors.js';
import { saveCoreModelProfile } from './modelCore.js';
import { redactAccountId, redactUrl } from './redaction.js';
export async function getCoreAuthStatus(provider) {
    const config = loadLlmConfig();
    if (!config.provider || !config.model) {
        return {
            provider: config.provider,
            state: 'missing',
            configured: false,
            available: false,
            message: 'No LLM profile configured.',
        };
    }
    if (provider && provider !== config.provider) {
        throw new CoreError('invalid_params', 'auth/status only supports the active provider in this version.', {
            activeProvider: config.provider,
            requestedProvider: provider,
        });
    }
    const status = await getLlmRuntimeAuthStatus(config);
    return {
        provider: config.provider,
        state: status.state,
        configured: status.configured,
        available: status.available,
        message: status.message,
        ...(status.source ? { source: status.source } : {}),
        ...(status.accountId
            ? { account: { id: redactAccountId(status.accountId) } }
            : {}),
        ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
        ...(status.baseUrl ? { baseUrl: redactUrl(status.baseUrl) } : {}),
    };
}
export async function loginCoreAuth(input = {}) {
    const currentConfig = loadLlmConfig();
    const requestedProfileId = input.profileId?.trim();
    const requestedProfile = requestedProfileId
        ? currentConfig.profiles[requestedProfileId]
        : undefined;
    if (requestedProfileId && !requestedProfile) {
        throw new CoreError('invalid_params', 'Unknown LLM profile.', {
            requestedProfileId,
        });
    }
    const provider = input.provider?.trim() ||
        requestedProfile?.providerType ||
        currentConfig.provider ||
        'codex-oauth';
    if (provider !== 'codex-oauth') {
        throw new CoreError('invalid_params', 'Browser login is only supported for codex-oauth in this version.', {
            provider,
        });
    }
    if (requestedProfile && requestedProfile.providerType !== provider) {
        throw new CoreError('invalid_params', 'Requested LLM profile does not belong to the requested provider.', {
            profileId: requestedProfile.id,
            profileProvider: requestedProfile.providerType,
            requestedProvider: provider,
        });
    }
    let existingProfile = requestedProfile ??
        (currentConfig.provider === 'codex-oauth'
            ? currentConfig.profiles[currentConfig.currentProfileId]
            : getLlmProfileForProvider('codex-oauth', currentConfig));
    if (!existingProfile) {
        await saveCoreModelProfile({
            providerType: 'codex-oauth',
            apiMode: 'openai-responses',
            authStrategy: 'oauth_refreshable',
            defaultModel: currentConfig.providers['codex-oauth']?.defaultModel ?? 'gpt-5.4',
            setCurrent: true,
        });
        const refreshedConfig = loadLlmConfig();
        existingProfile = getLlmProfileForProvider('codex-oauth', refreshedConfig);
    }
    if (!existingProfile) {
        throw new CoreError('invalid_params', 'No Codex OAuth profile is available for browser login.');
    }
    const session = createDefaultCodexOAuthSession({
        profileId: existingProfile.id,
    });
    const credential = await session.loginWithBrowser();
    resetDefaultCodexOAuthSession();
    resetDefaultLlmRuntime();
    const postLoginConfig = loadLlmConfig();
    const authStatus = await getLlmRuntimeAuthStatusForProvider({
        profileId: existingProfile.id,
        provider: 'codex-oauth',
        model: existingProfile.defaultModel,
    }, postLoginConfig);
    return {
        provider: 'codex-oauth',
        profileId: existingProfile.id,
        auth: {
            provider: 'codex-oauth',
            profileId: existingProfile.id,
            state: authStatus.state,
            configured: authStatus.configured,
            available: authStatus.available,
            message: authStatus.message,
            ...(authStatus.source ? { source: authStatus.source } : {}),
            ...(authStatus.accountId
                ? { account: { id: redactAccountId(authStatus.accountId) } }
                : {}),
            ...(authStatus.expiresAt ? { expiresAt: authStatus.expiresAt } : {}),
            ...(authStatus.baseUrl ? { baseUrl: redactUrl(authStatus.baseUrl) } : {}),
        },
        credential: {
            source: session.credentialFilePath,
            ...(credential.accountId
                ? { account: { id: redactAccountId(credential.accountId) } }
                : {}),
            ...(typeof credential.expires === 'number'
                ? { expiresAt: credential.expires }
                : {}),
        },
    };
}
//# sourceMappingURL=authCore.js.map