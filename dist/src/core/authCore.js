import { getLlmRuntimeAuthStatus, } from '../services/llm/runtimeStatus.js';
import { loadLlmConfig } from '../services/llm/llmConfig.js';
import { CoreError } from './errors.js';
import { redactAccountId, redactUrl } from './redaction.js';
export async function getCoreAuthStatus(provider) {
    const config = loadLlmConfig();
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
//# sourceMappingURL=authCore.js.map