import type { LlmModelProviderCatalog } from './displayTypes.js'
import providerLockPolicyConfig from './providerLockPolicy.config.json'

export type ProviderLockRule = Readonly<{
  locked: boolean
  reason?: string
}>

export type ProviderLockState = Readonly<{
  locked: boolean
  reason?: string
}>

type ProviderLockPolicyConfig = Readonly<{
  providers?: Readonly<Record<string, ProviderLockRule>>
}>

const PROVIDER_LOCK_RULES: Readonly<Record<string, ProviderLockRule>> =
  (providerLockPolicyConfig as ProviderLockPolicyConfig).providers ?? {}

const DEFAULT_UNLOCKED_STATE: ProviderLockState = Object.freeze({
  locked: false,
})

function resolveProviderId(
  provider: Pick<LlmModelProviderCatalog, 'id'> | string | undefined,
): string | undefined {
  if (!provider) {
    return undefined
  }
  if (typeof provider === 'string') {
    const providerId = provider.trim()
    return providerId.length > 0 ? providerId : undefined
  }
  const providerId = provider.id?.trim()
  return providerId && providerId.length > 0 ? providerId : undefined
}

export function getProviderLockState(
  provider: Pick<LlmModelProviderCatalog, 'id'> | string | undefined,
): ProviderLockState {
  const providerId = resolveProviderId(provider)
  if (!providerId) {
    return DEFAULT_UNLOCKED_STATE
  }
  const rule = PROVIDER_LOCK_RULES[providerId]
  if (!rule?.locked) {
    return DEFAULT_UNLOCKED_STATE
  }
  return {
    locked: true,
    reason: rule.reason,
  }
}

export function isProviderLocked(
  provider: Pick<LlmModelProviderCatalog, 'id'> | string | undefined,
): boolean {
  return getProviderLockState(provider).locked
}
