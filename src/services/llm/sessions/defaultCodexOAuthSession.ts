import { loadLlmConfig, getLlmProviderConfig } from '../llmConfig.js'
import { CodexOAuthSession } from './CodexOAuthSession.js'

let defaultCodexOAuthSession: CodexOAuthSession | undefined

export function createDefaultCodexOAuthSession(): CodexOAuthSession {
  const config = loadLlmConfig()
  const providerConfig = getLlmProviderConfig('codex-oauth', config)
  return new CodexOAuthSession({
    ...(providerConfig?.baseUrl ? { baseUrl: providerConfig.baseUrl } : {}),
    ...(providerConfig?.authorizeUrl
      ? { authorizeUrl: providerConfig.authorizeUrl }
      : {}),
    ...(providerConfig?.tokenUrl ? { tokenUrl: providerConfig.tokenUrl } : {}),
    ...(providerConfig?.redirectUri
      ? { redirectUri: providerConfig.redirectUri }
      : {}),
    ...(providerConfig?.scope ? { scope: providerConfig.scope } : {}),
    ...(providerConfig?.clientId ? { clientId: providerConfig.clientId } : {}),
    ...(providerConfig?.credentialFilePath
      ? { credentialFilePath: providerConfig.credentialFilePath }
      : {}),
  })
}

export function getDefaultCodexOAuthSession(): CodexOAuthSession {
  if (!defaultCodexOAuthSession) {
    defaultCodexOAuthSession = createDefaultCodexOAuthSession()
  }
  return defaultCodexOAuthSession
}

export function resetDefaultCodexOAuthSession(): void {
  defaultCodexOAuthSession = undefined
}
