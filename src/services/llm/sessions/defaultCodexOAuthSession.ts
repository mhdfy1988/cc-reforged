import {
  getLlmProfileForProvider,
  getLlmProviderConfig,
  loadLlmConfig,
} from '../llmConfig.js'
import { CodexOAuthSession } from './CodexOAuthSession.js'

let defaultCodexOAuthSession: CodexOAuthSession | undefined

export function createDefaultCodexOAuthSession(input: {
  profileId?: string
} = {}): CodexOAuthSession {
  const config = loadLlmConfig()
  const providerConfig = getLlmProviderConfig('codex-oauth', config)
  const requestedProfile = input.profileId
    ? config.profiles[input.profileId.trim()]
    : undefined
  const profile =
    requestedProfile?.providerType === 'codex-oauth'
      ? requestedProfile
      : getLlmProfileForProvider('codex-oauth', config)
  return new CodexOAuthSession({
    ...(profile?.baseUrl ?? providerConfig?.baseUrl
      ? { baseUrl: profile?.baseUrl ?? providerConfig?.baseUrl }
      : {}),
    ...(providerConfig?.authorizeUrl
      ? { authorizeUrl: providerConfig.authorizeUrl }
      : {}),
    ...(providerConfig?.tokenUrl ? { tokenUrl: providerConfig.tokenUrl } : {}),
    ...(providerConfig?.redirectUri
      ? { redirectUri: providerConfig.redirectUri }
      : {}),
    ...(providerConfig?.scope ? { scope: providerConfig.scope } : {}),
    ...(providerConfig?.clientId ? { clientId: providerConfig.clientId } : {}),
    ...(profile?.id ? { credentialProfileId: profile.id } : {}),
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
