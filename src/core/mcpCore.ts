import {
  getClaudeCodeMcpConfigs,
  getUserMcpFilePath,
  isMcpServerDisabled,
} from '../services/mcp/config.js'
import type { ScopedMcpServerConfig } from '../services/mcp/types.js'
import { getPluginErrorMessage, type PluginError } from '../types/plugin.js'
import { redactRecord, redactUrl } from './redaction.js'

export async function listCoreMcpServers(options: {
  includeDisabled?: boolean
} = {}): Promise<Record<string, unknown>> {
  const { servers, errors } = await getClaudeCodeMcpConfigs()
  const summaries = Object.entries(servers)
    .map(([name, config]) => summarizeMcpServer(name, config))
    .filter(server => options.includeDisabled || server.enabled)

  return {
    configPath: getUserMcpFilePath(),
    servers: summaries,
    errors: errors.map(summarizePluginError),
  }
}

function summarizeMcpServer(
  name: string,
  config: ScopedMcpServerConfig,
): Record<string, unknown> & { enabled: boolean } {
  const type = getMcpServerType(config)
  const enabled = !isMcpServerDisabled(name)
  const summary: Record<string, unknown> & { enabled: boolean } = {
    name,
    scope: config.scope,
    type,
    enabled,
    source: config.pluginSource ? 'plugin' : config.scope,
  }

  if ('command' in config) {
    summary.command = config.command
    summary.args = config.args ?? []
    if (config.env) {
      summary.env = redactRecord(config.env)
    }
  }

  if ('url' in config) {
    summary.url = redactUrl(config.url)
  }

  if ('headers' in config && config.headers) {
    summary.headers = redactRecord(config.headers)
  }

  if ('headersHelper' in config && config.headersHelper) {
    summary.headersHelper = config.headersHelper
  }

  if ('oauth' in config && config.oauth) {
    summary.oauth = {
      ...(config.oauth.clientId ? { clientId: config.oauth.clientId } : {}),
      ...(config.oauth.callbackPort
        ? { callbackPort: config.oauth.callbackPort }
        : {}),
      ...(config.oauth.authServerMetadataUrl
        ? { authServerMetadataUrl: redactUrl(config.oauth.authServerMetadataUrl) }
        : {}),
      ...(config.oauth.xaa !== undefined ? { xaa: config.oauth.xaa } : {}),
    }
  }

  if ('name' in config && type === 'sdk') {
    summary.sdkName = config.name
  }

  return summary
}

function getMcpServerType(config: ScopedMcpServerConfig): string {
  return 'type' in config && config.type ? config.type : 'stdio'
}

function summarizePluginError(error: PluginError): Record<string, unknown> {
  return {
    type: error.type,
    source: error.source,
    message: getPluginErrorMessage(error),
  }
}
