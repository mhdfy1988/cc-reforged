import type { ExtensionCapability } from './capabilityTypes.js'
import type {
  ExtensionCapabilityProvider,
  ExtensionCapabilityProviderContext,
} from './capabilityCatalog.js'
import { normalizePluginId } from './pluginIdentityResolver.js'
import type { CapabilityRuntimeEnvironment } from './capabilityRuntimeEnvironment.js'
import { createExtensionCapabilityId } from './capabilityIdentity.js'

export type AppConnectorAuthStatus =
  | 'connected'
  | 'needs-auth'
  | 'disabled'
  | 'disconnected'
  | 'unknown'

export type AppConnectorSnapshot = {
  appId: string
  displayName: string
  description?: string
  connected?: boolean
  enabled?: boolean
  authStatus?: AppConnectorAuthStatus
  sourceLabel?: string
  parentPluginId?: string
  providedToolIds?: string[]
  providedMcpServerNames?: string[]
  providedSkillIds?: string[]
  metadata?: Record<string, unknown>
}

export type AppConnectorCapabilityInput = {
  id: string
  name: string
  description?: string
  connected?: boolean
  enabled?: boolean
  authStatus?: AppConnectorAuthStatus
  sourceLabel?: string
  pluginId?: string
  parentPluginId?: string
  providedToolIds?: string[]
  providedMcpServerNames?: string[]
  providedSkillIds?: string[]
  metadata?: Record<string, unknown>
}

export type AppCapabilityProviderInput = {
  apps?: readonly AppConnectorCapabilityInput[]
}

export type AppCapabilityProviderContext =
  ExtensionCapabilityProviderContext &
    AppCapabilityProviderInput & {
      capabilityEnvironment?: CapabilityRuntimeEnvironment
    }

export function createAppCapabilityProvider(
  input: AppCapabilityProviderInput = {},
): ExtensionCapabilityProvider {
  return {
    id: 'apps',
    listCapabilities(context) {
      const apps =
        (context as AppCapabilityProviderContext).capabilityEnvironment?.apps ??
        (context as AppCapabilityProviderContext).apps ??
        input.apps ??
        []
      return listAppCapabilities(apps)
    },
  }
}

export function listAppCapabilities(
  apps: readonly AppConnectorCapabilityInput[] = [],
): ExtensionCapability[] {
  return apps.map(toExtensionCapability)
}

function toExtensionCapability(
  app: AppConnectorCapabilityInput,
): ExtensionCapability {
  const enabled = app.authStatus === 'disabled' ? false : app.enabled !== false
  const connected =
    app.authStatus === 'connected' ? true : app.connected === true
  const available = enabled && connected
  const pluginId = normalizePluginId(app.parentPluginId ?? app.pluginId)
  const status = enabled
    ? connected
      ? 'enabled'
      : app.authStatus === 'needs-auth'
        ? 'needs-auth'
        : 'unavailable'
    : 'disabled'
  return {
    schemaVersion: 1,
    id: createExtensionCapabilityId({
      kind: 'app',
      sourceKind: 'app',
      name: app.id,
      sourceRef: app.sourceLabel,
      pluginId,
      appId: app.id,
    }),
    name: app.id,
    displayName: app.name,
    description: app.description ?? '',
    kind: 'app',
    source: {
      kind: 'app',
      label: app.sourceLabel ?? 'app connector',
      ref: app.id,
      appId: app.id,
      ...(pluginId ? { pluginId } : {}),
    },
    state: {
      installed: true,
      enabled,
      available,
      runtimeVisible: false,
      status,
    },
    invocation: {
      modelInvocable: false,
      userInvocable: false,
      toolInvocable: false,
    },
    relations: {
      ...(pluginId ? { parentPluginId: pluginId } : {}),
    },
    diagnostics: available
      ? []
      : [
          {
            kind: 'availability',
            severity: enabled ? 'warning' : 'info',
            code: !enabled
              ? 'app-disabled'
              : app.authStatus === 'needs-auth'
                ? 'app-needs-auth'
                : 'app-disconnected',
            message: enabled
              ? app.authStatus === 'needs-auth'
                ? `App connector ${app.id} needs authentication.`
                : `App connector ${app.id} is disconnected.`
              : `App connector ${app.id} is disabled.`,
          },
        ],
    metadata: {
      ...(app.metadata ?? {}),
      connected,
      authStatus: app.authStatus ?? (connected ? 'connected' : status),
      ...(app.providedToolIds
        ? { providedToolIds: [...app.providedToolIds] }
        : {}),
      ...(app.providedMcpServerNames
        ? { providedMcpServerNames: [...app.providedMcpServerNames] }
        : {}),
      ...(app.providedSkillIds
        ? { providedSkillIds: [...app.providedSkillIds] }
        : {}),
    },
  }
}
