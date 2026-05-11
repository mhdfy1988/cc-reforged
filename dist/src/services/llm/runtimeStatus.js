import { getAnthropicApiKeyWithSource, getAuthTokenSource, isUsing3PServices, } from '../../utils/auth.js';
import { getFsImplementation } from '../../utils/fsOperations.js';
import { getAPIProvider } from '../../utils/model/providers.js';
import { getDefaultLlmRuntime, } from './defaultRuntime.js';
import { getLlmProviderConfig, loadLlmConfig, } from './llmConfig.js';
import { getLlmModelCatalogEntry } from './modelCatalog.js';
import { createFallbackLlmProviderDefinition, getBuiltinLlmProviderDefinition, mergeLlmProviderDefinition, } from './providerDefinitions.js';
import { getDefaultCodexOAuthSession } from './sessions/defaultCodexOAuthSession.js';
export function getLlmProviderDisplayName(providerId, config = loadLlmConfig()) {
    return getResolvedLlmProviderDefinition(providerId, config).displayName;
}
export function getLlmRuntimeDisplayStatus(config = loadLlmConfig()) {
    return getLlmRuntimeDisplayStatusForProvider({
        provider: config.provider,
        model: config.model,
    }, config);
}
export function getLlmRuntimeDisplayStatusForProvider(input, config = loadLlmConfig()) {
    const provider = input.provider.trim();
    const model = input.model?.trim() || config.providers[provider]?.defaultModel || config.model;
    const providerConfig = getLlmProviderConfig(provider, config);
    const providerDefinition = getResolvedLlmProviderDefinition(provider, config);
    return {
        providerId: provider,
        providerDisplayName: providerDefinition.displayName,
        model,
        authStrategy: providerDefinition.authStrategy,
        apiMode: providerDefinition.apiMode,
        capabilities: providerDefinition.capabilities,
        modelCatalogEntry: getLlmModelCatalogEntry({
            providerId: provider,
            model,
            providerDefinition,
        }),
        ...(providerConfig?.baseUrl ? { baseUrl: providerConfig.baseUrl } : {}),
        configPath: config.path,
        configSource: config.source,
    };
}
export function getResolvedLlmProviderDefinition(providerId, config = loadLlmConfig()) {
    const providerConfig = getLlmProviderConfig(providerId, config);
    const builtinDefinition = getBuiltinLlmProviderDefinition(providerId) ??
        createFallbackLlmProviderDefinition(providerId);
    let runtimeDefinition = builtinDefinition;
    try {
        runtimeDefinition = getDefaultLlmRuntime().getProviderDefinition(providerId);
    }
    catch {
        runtimeDefinition = builtinDefinition;
    }
    return mergeLlmProviderDefinition(runtimeDefinition, {
        ...(providerConfig?.displayName?.trim()
            ? { displayName: providerConfig.displayName.trim() }
            : {}),
        ...(providerConfig?.authStrategy
            ? { authStrategy: providerConfig.authStrategy }
            : {}),
        ...(providerConfig?.apiMode ? { apiMode: providerConfig.apiMode } : {}),
        capabilities: {
            ...(providerConfig?.supportsStreaming !== undefined
                ? { streaming: providerConfig.supportsStreaming }
                : {}),
            ...(providerConfig?.supportsTools !== undefined
                ? { tools: providerConfig.supportsTools }
                : {}),
            ...(providerConfig?.supportsReasoning !== undefined
                ? { reasoning: providerConfig.supportsReasoning }
                : {}),
            ...(providerConfig?.supportsUsage !== undefined
                ? { usage: providerConfig.supportsUsage }
                : {}),
        },
    });
}
export function getLlmRuntimeAuthStatusSync(config = loadLlmConfig()) {
    return getLlmRuntimeAuthStatusSyncForProvider({
        provider: config.provider,
        model: config.model,
    }, config);
}
export function getLlmRuntimeAuthStatusSyncForProvider(input, config = loadLlmConfig()) {
    const displayStatus = getLlmRuntimeDisplayStatusForProvider(input, config);
    if (displayStatus.providerId === 'codex-oauth') {
        return getCodexAuthStatusSync(config, displayStatus);
    }
    if (displayStatus.providerId === 'deepseek') {
        return getApiKeyAuthStatus(displayStatus, [
            'CCR_DEEPSEEK_API_KEY',
            'DEEPSEEK_API_KEY',
        ]);
    }
    return getAnthropicAuthStatus(displayStatus);
}
export async function getLlmRuntimeAuthStatus(config = loadLlmConfig()) {
    return getLlmRuntimeAuthStatusForProvider({
        provider: config.provider,
        model: config.model,
    }, config);
}
export async function getLlmRuntimeAuthStatusForProvider(input, config = loadLlmConfig()) {
    const displayStatus = getLlmRuntimeDisplayStatusForProvider(input, config);
    if (displayStatus.providerId === 'deepseek') {
        return getApiKeyAuthStatus(displayStatus, [
            'CCR_DEEPSEEK_API_KEY',
            'DEEPSEEK_API_KEY',
        ]);
    }
    if (displayStatus.providerId !== 'codex-oauth') {
        return getAnthropicAuthStatus(displayStatus);
    }
    const availability = await getDefaultCodexOAuthSession().getAvailability();
    if (availability.available) {
        return {
            state: 'available',
            configured: true,
            available: true,
            message: 'Codex OAuth credential is available.',
            source: availability.details?.source,
            accountId: availability.details?.accountId,
            expiresAt: availability.details?.expiresAt,
            baseUrl: availability.details?.baseUrl ?? displayStatus.baseUrl,
        };
    }
    if (availability.configured) {
        return {
            state: 'configured',
            configured: true,
            available: false,
            message: 'Codex OAuth credential exists but is not currently usable. Re-login may be required.',
            source: availability.details?.source,
            accountId: availability.details?.accountId,
            expiresAt: availability.details?.expiresAt,
            baseUrl: availability.details?.baseUrl ?? displayStatus.baseUrl,
        };
    }
    return {
        state: 'missing',
        configured: false,
        available: false,
        message: 'No Codex OAuth credential detected.',
        source: availability.details?.source,
        baseUrl: availability.details?.baseUrl ?? displayStatus.baseUrl,
    };
}
function getCodexAuthStatusSync(config, displayStatus) {
    const snapshot = getCodexCredentialSnapshotSync(config);
    if (!snapshot.present) {
        return {
            state: 'missing',
            configured: false,
            available: false,
            message: 'No Codex OAuth credential detected.',
            source: snapshot.source,
            baseUrl: displayStatus.baseUrl,
        };
    }
    if (snapshot.expiresAt && snapshot.expiresAt <= Date.now()) {
        return {
            state: 'configured',
            configured: true,
            available: false,
            message: 'Codex OAuth credential exists but the current access token appears to be expired.',
            source: snapshot.source,
            accountId: snapshot.accountId,
            expiresAt: snapshot.expiresAt,
            baseUrl: displayStatus.baseUrl,
        };
    }
    return {
        state: 'available',
        configured: true,
        available: true,
        message: 'Codex OAuth credential is configured.',
        source: snapshot.source,
        accountId: snapshot.accountId,
        expiresAt: snapshot.expiresAt,
        baseUrl: displayStatus.baseUrl,
    };
}
function getCodexCredentialSnapshotSync(config) {
    if (hasCodexCredentialInEnv()) {
        const expiresAt = Number.parseInt(process.env.CLAUDE_CODE_CODEX_OAUTH_EXPIRES_AT ?? '', 10);
        return {
            present: true,
            source: 'env',
            ...(process.env.CLAUDE_CODE_CODEX_OAUTH_ACCOUNT_ID?.trim()
                ? { accountId: process.env.CLAUDE_CODE_CODEX_OAUTH_ACCOUNT_ID.trim() }
                : {}),
            ...(Number.isFinite(expiresAt) ? { expiresAt } : {}),
        };
    }
    const credentialFilePath = getLlmProviderConfig('codex-oauth', config)?.credentialFilePath?.trim();
    if (!credentialFilePath) {
        return { present: false };
    }
    const fs = getFsImplementation();
    if (!fs.existsSync(credentialFilePath)) {
        return {
            present: false,
            source: credentialFilePath,
        };
    }
    try {
        const raw = fs.readFileSync(credentialFilePath, { encoding: 'utf8' });
        const parsed = JSON.parse(raw);
        if (typeof parsed.access !== 'string' || !parsed.access.trim()) {
            return {
                present: false,
                source: credentialFilePath,
            };
        }
        return {
            present: true,
            source: credentialFilePath,
            ...(typeof parsed.accountId === 'string'
                ? { accountId: parsed.accountId }
                : {}),
            ...(typeof parsed.expires === 'number'
                ? { expiresAt: parsed.expires }
                : {}),
        };
    }
    catch {
        return {
            present: false,
            source: credentialFilePath,
        };
    }
}
function hasCodexCredentialInEnv() {
    return Boolean(process.env.CLAUDE_CODE_CODEX_OAUTH_ACCESS_TOKEN?.trim());
}
function getApiKeyAuthStatus(displayStatus, envNames) {
    const envName = envNames.find(name => process.env[name]?.trim());
    if (envName) {
        return {
            state: 'available',
            configured: true,
            available: true,
            message: `${displayStatus.providerDisplayName} API key is available.`,
            source: envName,
            baseUrl: displayStatus.baseUrl,
        };
    }
    return {
        state: 'missing',
        configured: false,
        available: false,
        message: `${displayStatus.providerDisplayName} API key is missing.`,
        baseUrl: displayStatus.baseUrl,
    };
}
function getAnthropicAuthStatus(displayStatus) {
    const { source: authTokenSource, hasToken } = getAuthTokenSource();
    const { source: apiKeySource } = getAnthropicApiKeyWithSource();
    const using3P = isUsing3PServices();
    if (using3P) {
        return {
            state: 'available',
            configured: true,
            available: true,
            message: 'External provider credentials are active.',
            source: getAPIProvider(),
            baseUrl: displayStatus.baseUrl,
        };
    }
    if (hasToken && authTokenSource !== 'none') {
        return {
            state: 'available',
            configured: true,
            available: true,
            message: 'Anthropic OAuth credential is available.',
            source: authTokenSource,
            baseUrl: displayStatus.baseUrl,
        };
    }
    const envApiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (apiKeySource !== 'none' || envApiKey) {
        return {
            state: 'available',
            configured: true,
            available: true,
            message: 'Anthropic API key is available.',
            source: apiKeySource !== 'none' ? apiKeySource : 'ANTHROPIC_API_KEY',
            baseUrl: displayStatus.baseUrl,
        };
    }
    return {
        state: 'missing',
        configured: false,
        available: false,
        message: 'No Anthropic credential detected.',
        baseUrl: displayStatus.baseUrl,
    };
}
//# sourceMappingURL=runtimeStatus.js.map