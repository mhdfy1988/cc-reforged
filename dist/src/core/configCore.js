import { getUserMcpFilePath } from '../services/mcp/config.js';
import { getClaudeConfigHomeDir } from '../utils/envUtils.js';
import { getLlmRuntimeDisplayStatus, } from '../services/llm/runtimeStatus.js';
import { loadLlmConfig } from '../services/llm/llmConfig.js';
import { resolveRuntimeContextBudget } from '../services/llm/contextBudget.js';
import { redactUrl } from './redaction.js';
export function getCoreConfigSnapshot() {
    const config = loadLlmConfig();
    if (!config.provider || !config.model) {
        return {
            llm: {
                profileId: config.currentProfileId || undefined,
                provider: config.provider,
                model: config.model,
                configPath: config.path,
                configSource: config.source,
            },
            paths: {
                ccrHome: getClaudeConfigHomeDir(),
                mcpConfig: getUserMcpFilePath(),
            },
        };
    }
    const status = getLlmRuntimeDisplayStatus(config);
    const contextBudget = resolveRuntimeContextBudget({ config });
    return {
        llm: {
            profileId: status.profileId,
            provider: status.providerId,
            providerDisplayName: status.providerDisplayName,
            model: status.model,
            contextWindow: contextBudget.totalContextWindow,
            contextBudget,
            authStrategy: status.authStrategy,
            apiMode: status.apiMode,
            capabilities: status.capabilities,
            capabilityTools: status.capabilityTools,
            modelCatalogEntry: status.modelCatalogEntry,
            modelCapabilities: status.modelCapabilities,
            ...(status.baseUrl ? { baseUrl: redactUrl(status.baseUrl) } : {}),
            configPath: status.configPath,
            configSource: status.configSource,
        },
        paths: {
            ccrHome: getClaudeConfigHomeDir(),
            mcpConfig: getUserMcpFilePath(),
        },
    };
}
//# sourceMappingURL=configCore.js.map