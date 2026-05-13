/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */
import { clearAuthRelatedCaches, performLogout, } from '../../commands/logout/logout.js';
import { logEvent, } from '../../services/analytics/index.js';
import { getSSLErrorHint } from '../../services/api/errorUtils.js';
import { fetchAndStoreClaudeCodeFirstTokenDate } from '../../services/api/firstTokenDate.js';
import { getLlmRuntimeAuthStatus, getLlmRuntimeDisplayStatus, } from '../../services/llm/runtimeStatus.js';
import { getLlmProfileForProvider, getLlmProviderConfig, loadLlmConfig, } from '../../services/llm/llmConfig.js';
import { createDefaultCodexOAuthSession, resetDefaultCodexOAuthSession, } from '../../services/llm/sessions/defaultCodexOAuthSession.js';
import { createAndStoreApiKey, fetchAndStoreUserRoles, refreshOAuthToken, shouldUseClaudeAIAuth, storeOAuthAccountInfo, } from '../../services/oauth/client.js';
import { getOauthProfileFromOauthToken } from '../../services/oauth/getOauthProfile.js';
import { OAuthService } from '../../services/oauth/index.js';
import { clearOAuthTokenCache, getAnthropicApiKeyWithSource, getAuthTokenSource, getOauthAccountInfo, getSubscriptionType, isUsing3PServices, saveOAuthTokensIfNeeded, validateForceLoginOrg, } from '../../utils/auth.js';
import { saveGlobalConfig } from '../../utils/config.js';
import { logForDebugging } from '../../utils/debug.js';
import { isRunningOnHomespace } from '../../utils/envUtils.js';
import { errorMessage } from '../../utils/errors.js';
import { logError } from '../../utils/log.js';
import { getAPIProvider } from '../../utils/model/providers.js';
import { getInitialSettings } from '../../utils/settings/settings.js';
import { jsonStringify } from '../../utils/slowOperations.js';
import { buildAccountProperties, buildAPIProviderProperties, buildLlmRuntimeProperties, } from '../../utils/status.js';
import { gracefulShutdown } from '../../utils/gracefulShutdown.js';
import { saveCoreModelProfile } from '../../core/modelCore.js';
function parseString(value) {
    return typeof value === 'string' ? value : undefined;
}
function parseStringOrNumber(value) {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    return undefined;
}
function isOrgValidationFailure(result) {
    return result.valid === false && typeof result.message === 'string';
}
async function completeAuthLogin(exitCode) {
    // 对齐仓库现有非交互 CLI 子命令的收尾方式：先做统一清理，再显式退出。
    // 直接 process.exit() 太早，单纯自然返回又会让命令挂住。
    await gracefulShutdown(exitCode);
}
/**
 * Shared post-token-acquisition logic. Saves tokens, fetches profile/roles,
 * and sets up the local auth state.
 */
export async function installOAuthTokens(tokens) {
    // Clear old state before saving new credentials
    await performLogout({ clearOnboarding: false });
    // Reuse pre-fetched profile if available, otherwise fetch fresh
    const profile = tokens.profile ?? (await getOauthProfileFromOauthToken(tokens.accessToken));
    if (profile) {
        const accountUuid = parseString(profile.account?.uuid);
        const emailAddress = parseString(profile.account?.email ?? profile.account?.email_address);
        if (accountUuid && emailAddress) {
            storeOAuthAccountInfo({
                accountUuid,
                emailAddress,
                organizationUuid: parseString(profile.organization?.uuid),
                displayName: parseString(profile.account?.display_name),
                hasExtraUsageEnabled: profile.organization?.has_extra_usage_enabled ?? undefined,
                billingType: profile.organization?.billing_type ?? undefined,
                subscriptionCreatedAt: parseStringOrNumber(profile.organization?.subscription_created_at),
                accountCreatedAt: parseStringOrNumber(profile.account?.created_at),
            });
        }
        else if (tokens.tokenAccount) {
            const tokenAccountUuid = parseString(tokens.tokenAccount.uuid);
            const tokenAccountEmailAddress = parseString(tokens.tokenAccount.emailAddress);
            if (tokenAccountUuid && tokenAccountEmailAddress) {
                storeOAuthAccountInfo({
                    accountUuid: tokenAccountUuid,
                    emailAddress: tokenAccountEmailAddress,
                    organizationUuid: parseString(tokens.tokenAccount.organizationUuid),
                });
            }
            else {
                throw new Error('OAuth profile is missing required account fields, and token account fallback is incomplete.');
            }
        }
        else {
            throw new Error('OAuth profile is missing required account fields and no token account fallback is available.');
        }
    }
    else if (tokens.tokenAccount) {
        // Fallback to token exchange account data when profile endpoint fails
        const tokenAccountUuid = parseString(tokens.tokenAccount.uuid);
        const tokenAccountEmailAddress = parseString(tokens.tokenAccount.emailAddress);
        if (tokenAccountUuid && tokenAccountEmailAddress) {
            storeOAuthAccountInfo({
                accountUuid: tokenAccountUuid,
                emailAddress: tokenAccountEmailAddress,
                organizationUuid: parseString(tokens.tokenAccount.organizationUuid),
            });
        }
        else {
            throw new Error('Token account fallback is missing required account fields.');
        }
    }
    else {
        throw new Error('OAuth token response did not include account information.');
    }
    const storageResult = saveOAuthTokensIfNeeded(tokens);
    clearOAuthTokenCache();
    if (storageResult.warning) {
        logEvent('tengu_oauth_storage_warning', {
            warning: storageResult.warning,
        });
    }
    // Roles and first-token-date may fail for limited-scope tokens (e.g.
    // inference-only from setup-token). They're not required for core auth.
    await fetchAndStoreUserRoles(tokens.accessToken).catch(err => logForDebugging(String(err), { level: 'error' }));
    if (shouldUseClaudeAIAuth(tokens.scopes)) {
        await fetchAndStoreClaudeCodeFirstTokenDate().catch(err => logForDebugging(String(err), { level: 'error' }));
    }
    else {
        // API key creation is critical for Console users — let it throw.
        const apiKey = await createAndStoreApiKey(tokens.accessToken);
        if (!apiKey) {
            throw new Error('Unable to create API key. The server accepted the request but did not return a key.');
        }
    }
    await clearAuthRelatedCaches();
}
export async function authLogin({ provider, email, sso, console: useConsole, claudeai, }) {
    const authProvider = provider ?? 'anthropic';
    if (authProvider === 'codex-oauth') {
        if (email || sso || useConsole || claudeai) {
            process.stderr.write('Error: --email, --sso, --console, and --claudeai are only supported with --provider anthropic.\n');
            await completeAuthLogin(1);
            return;
        }
        try {
            logEvent('tengu_codex_oauth_login_start', {});
            const currentConfig = loadLlmConfig();
            const existingProfile = currentConfig.provider === 'codex-oauth'
                ? currentConfig.profiles[currentConfig.currentProfileId]
                : getLlmProfileForProvider('codex-oauth', currentConfig);
            if (!existingProfile) {
                await saveCoreModelProfile({
                    providerType: 'codex-oauth',
                    apiMode: 'openai-responses',
                    authStrategy: 'oauth_refreshable',
                    defaultModel: currentConfig.providers['codex-oauth']?.defaultModel ?? 'gpt-5.4',
                    setCurrent: true,
                });
            }
            const session = createDefaultCodexOAuthSession();
            process.stdout.write('Starting Codex OAuth browser login...\n');
            process.stdout.write(`A browser window will open. If it does not, use the printed URL manually.\n`);
            const credential = await session.loginWithBrowser();
            resetDefaultCodexOAuthSession();
            const llmConfig = loadLlmConfig();
            const codexProviderConfig = getLlmProviderConfig('codex-oauth', llmConfig);
            logEvent('tengu_codex_oauth_login_success', {});
            process.stdout.write('Codex OAuth login successful.\n');
            process.stdout.write(`Credential file: ${session.credentialFilePath}\n`);
            if (credential.accountId) {
                process.stdout.write(`Account ID: ${credential.accountId}\n`);
            }
            if (typeof credential.expires === 'number') {
                process.stdout.write(`Expires at: ${new Date(credential.expires).toISOString()}\n`);
            }
            if (llmConfig.provider !== 'codex-oauth') {
                process.stdout.write(`Current active LLM provider is ${llmConfig.provider}. To start using Codex OAuth for model calls, switch provider to codex-oauth in ${llmConfig.path}${codexProviderConfig?.defaultModel ? ` (recommended model: ${codexProviderConfig.defaultModel})` : ''}.\n`);
            }
            await completeAuthLogin(0);
            return;
        }
        catch (err) {
            logError(err);
            process.stderr.write(`Codex OAuth login failed: ${errorMessage(err)}\n`);
            await completeAuthLogin(1);
            return;
        }
    }
    if (useConsole && claudeai) {
        process.stderr.write('Error: --console and --claudeai cannot be used together.\n');
        await completeAuthLogin(1);
        return;
    }
    const settings = getInitialSettings();
    // forceLoginMethod is a hard constraint (enterprise setting) — matches ConsoleOAuthFlow behavior.
    // Without it, --console selects Console; --claudeai (or no flag) selects claude.ai.
    const loginWithClaudeAi = settings.forceLoginMethod
        ? settings.forceLoginMethod === 'claudeai'
        : !useConsole;
    const orgUUID = settings.forceLoginOrgUUID;
    // Fast path: if a refresh token is provided via env var, skip the browser
    // OAuth flow and exchange it directly for tokens.
    const envRefreshToken = process.env.CCR_OAUTH_REFRESH_TOKEN;
    if (envRefreshToken) {
        const envScopes = process.env.CCR_OAUTH_SCOPES;
        if (!envScopes) {
            process.stderr.write('CCR_OAUTH_SCOPES is required when using CCR_OAUTH_REFRESH_TOKEN.\n' +
                'Set it to the space-separated scopes the refresh token was issued with\n' +
                '(e.g. "user:inference" or "user:profile user:inference user:sessions:claude_code user:mcp_servers").\n');
            await completeAuthLogin(1);
            return;
        }
        const scopes = envScopes.split(/\s+/).filter(Boolean);
        try {
            logEvent('tengu_login_from_refresh_token', {});
            const tokens = await refreshOAuthToken(envRefreshToken, { scopes });
            await installOAuthTokens(tokens);
            const orgResult = await validateForceLoginOrg();
            if (isOrgValidationFailure(orgResult)) {
                process.stderr.write(orgResult.message + '\n');
                await completeAuthLogin(1);
                return;
            }
            // Mark onboarding complete — interactive paths handle this via
            // the Onboarding component, but the env var path skips it.
            saveGlobalConfig(current => {
                if (current.hasCompletedOnboarding)
                    return current;
                return { ...current, hasCompletedOnboarding: true };
            });
            logEvent('tengu_oauth_success', {
                loginWithClaudeAi: shouldUseClaudeAIAuth(tokens.scopes),
            });
            process.stdout.write('Login successful.\n');
            await completeAuthLogin(0);
            return;
        }
        catch (err) {
            logError(err);
            const sslHint = getSSLErrorHint(err);
            process.stderr.write(`Login failed: ${errorMessage(err)}\n${sslHint ? sslHint + '\n' : ''}`);
            await completeAuthLogin(1);
            return;
        }
    }
    const resolvedLoginMethod = sso ? 'sso' : undefined;
    const oauthService = new OAuthService();
    try {
        logEvent('tengu_oauth_flow_start', { loginWithClaudeAi });
        const result = await oauthService.startOAuthFlow(async (url) => {
            process.stdout.write('Opening browser to sign in…\n');
            process.stdout.write(`If the browser didn't open, visit: ${url}\n`);
        }, {
            loginWithClaudeAi,
            loginHint: email,
            loginMethod: resolvedLoginMethod,
            orgUUID,
        });
        await installOAuthTokens(result);
        const orgResult = await validateForceLoginOrg();
        if (isOrgValidationFailure(orgResult)) {
            process.stderr.write(orgResult.message + '\n');
            await completeAuthLogin(1);
            return;
        }
        logEvent('tengu_oauth_success', { loginWithClaudeAi });
        process.stdout.write('Login successful.\n');
        await completeAuthLogin(0);
        return;
    }
    catch (err) {
        logError(err);
        const sslHint = getSSLErrorHint(err);
        process.stderr.write(`Login failed: ${errorMessage(err)}\n${sslHint ? sslHint + '\n' : ''}`);
        await completeAuthLogin(1);
        return;
    }
    finally {
        oauthService.cleanup();
    }
}
export async function authStatus(opts) {
    const llmStatus = getLlmRuntimeDisplayStatus();
    const llmAuthStatus = await getLlmRuntimeAuthStatus();
    const { source: authTokenSource, hasToken } = getAuthTokenSource();
    const { source: apiKeySource } = getAnthropicApiKeyWithSource();
    const hasApiKeyEnvVar = !!process.env.ANTHROPIC_API_KEY && !isRunningOnHomespace();
    const oauthAccount = getOauthAccountInfo();
    const subscriptionType = getSubscriptionType();
    const using3P = isUsing3PServices();
    const legacyLoggedIn = hasToken || apiKeySource !== 'none' || hasApiKeyEnvVar || using3P;
    const loggedIn = llmStatus.providerId === 'codex-oauth'
        ? llmAuthStatus.available
        : legacyLoggedIn;
    // Determine auth method
    let authMethod = 'none';
    if (llmStatus.providerId === 'codex-oauth') {
        authMethod =
            llmAuthStatus.configured || llmAuthStatus.available ? 'codex_oauth' : 'none';
    }
    else if (using3P) {
        authMethod = 'third_party';
    }
    else if (authTokenSource === 'claude.ai') {
        authMethod = 'claude.ai';
    }
    else if (authTokenSource === 'apiKeyHelper') {
        authMethod = 'api_key_helper';
    }
    else if (authTokenSource !== 'none') {
        authMethod = 'oauth_token';
    }
    else if (apiKeySource === 'ANTHROPIC_API_KEY' || hasApiKeyEnvVar) {
        authMethod = 'api_key';
    }
    else if (apiKeySource === '/login managed key') {
        authMethod = 'claude.ai';
    }
    if (opts.text) {
        const properties = [
            ...buildLlmRuntimeProperties(),
            ...buildAccountProperties(),
            ...buildAPIProviderProperties(),
        ];
        let hasAuthProperty = false;
        for (const prop of properties) {
            const value = typeof prop.value === 'string'
                ? prop.value
                : Array.isArray(prop.value)
                    ? prop.value.join(', ')
                    : null;
            if (value === null || value === 'none') {
                continue;
            }
            hasAuthProperty = true;
            if (prop.label) {
                process.stdout.write(`${prop.label}: ${value}\n`);
            }
            else {
                process.stdout.write(`${value}\n`);
            }
        }
        if (!hasAuthProperty && hasApiKeyEnvVar) {
            process.stdout.write('API key: ANTHROPIC_API_KEY\n');
        }
        if (!loggedIn) {
            process.stdout.write(llmStatus.providerId === 'codex-oauth'
                ? 'Not logged in. Run the Codex OAuth login flow or configure CCR_CODEX_OAUTH_* credentials.\n'
                : 'Not logged in. Run ccr auth login to authenticate.\n');
        }
    }
    else {
        const apiProvider = getAPIProvider();
        const resolvedApiKeySource = apiKeySource !== 'none'
            ? apiKeySource
            : hasApiKeyEnvVar
                ? 'ANTHROPIC_API_KEY'
                : null;
        const output = {
            loggedIn,
            authMethod,
            apiProvider,
            llmProvider: llmStatus.providerId,
            llmProviderDisplayName: llmStatus.providerDisplayName,
            llmApiMode: llmStatus.apiMode,
            llmAuthStrategy: llmStatus.authStrategy,
            llmModel: llmStatus.model,
            llmModelDisplayName: llmStatus.modelCatalogEntry.displayName,
            llmModelContextWindow: String(llmStatus.modelCatalogEntry.contextWindow),
            llmModelMaxOutputTokens: String(llmStatus.modelCatalogEntry.maxOutputTokens),
            llmModelSupportsReasoning: llmStatus.modelCatalogEntry.supportsReasoning,
            llmModelSupportsTools: llmStatus.modelCatalogEntry.supportsTools,
            llmModelInputModalities: llmStatus.modelCatalogEntry.inputModalities.join(','),
            llmAuthState: llmAuthStatus.state,
            llmAuthMessage: llmAuthStatus.message,
            llmAuthSource: llmAuthStatus.source ?? null,
            llmBaseUrl: llmAuthStatus.baseUrl ?? llmStatus.baseUrl ?? null,
            llmConfigPath: llmStatus.configPath,
            llmConfigSource: llmStatus.configSource,
        };
        if (llmAuthStatus.accountId) {
            output.llmAccountId = llmAuthStatus.accountId;
        }
        if (typeof llmAuthStatus.expiresAt === 'number') {
            output.llmExpiresAt = String(llmAuthStatus.expiresAt);
        }
        if (resolvedApiKeySource) {
            output.apiKeySource = resolvedApiKeySource;
        }
        if (authMethod === 'claude.ai') {
            output.email = oauthAccount?.emailAddress ?? null;
            output.orgId = oauthAccount?.organizationUuid ?? null;
            output.orgName = oauthAccount?.organizationName ?? null;
            output.subscriptionType = subscriptionType ?? null;
        }
        process.stdout.write(jsonStringify(output, null, 2) + '\n');
    }
    process.exit(loggedIn ? 0 : 1);
}
export async function authLogout() {
    try {
        await performLogout({ clearOnboarding: false });
    }
    catch {
        process.stderr.write('Failed to log out.\n');
        process.exit(1);
    }
    process.stdout.write('Successfully logged out from your Anthropic account.\n');
    process.exit(0);
}
//# sourceMappingURL=auth.js.map