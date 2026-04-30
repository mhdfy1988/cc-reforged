import { getUserMcpFilePath } from '../services/mcp/config.js'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import {
  getLlmRuntimeDisplayStatus,
} from '../services/llm/runtimeStatus.js'
import { loadLlmConfig } from '../services/llm/llmConfig.js'
import { redactUrl } from './redaction.js'

export function getCoreConfigSnapshot(): Record<string, unknown> {
  const config = loadLlmConfig()
  const status = getLlmRuntimeDisplayStatus(config)

  return {
    llm: {
      provider: status.providerId,
      providerDisplayName: status.providerDisplayName,
      model: status.model,
      authStrategy: status.authStrategy,
      apiMode: status.apiMode,
      capabilities: status.capabilities,
      modelCatalogEntry: status.modelCatalogEntry,
      ...(status.baseUrl ? { baseUrl: redactUrl(status.baseUrl) } : {}),
      configPath: status.configPath,
      configSource: status.configSource,
    },
    paths: {
      ccrHome: getClaudeConfigHomeDir(),
      mcpConfig: getUserMcpFilePath(),
    },
  }
}
