import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { PluginInspector } from './pluginInspector.js'
import type { PluginDomainSession } from './pluginDomainSession.js'
import type {
  PluginConfigurationIdentity,
  PluginConfigurationSnapshot,
  PluginDiagnostic,
  PluginManagementRecord,
} from './pluginDomainTypes.js'

export type PluginConfigurationSaveRequest = {
  identity: PluginConfigurationIdentity
  values: Readonly<Record<string, unknown>>
}

export type PluginConfigurationDeleteRequest = {
  identity: PluginConfigurationIdentity
  removeOptions?: boolean
  removeSecrets?: boolean
  removeData?: boolean
}

export class PluginConfigurationService {
  private readonly inspector = new PluginInspector()

  async inspect(
    session: PluginDomainSession,
    identity: PluginConfigurationIdentity,
  ): Promise<PluginConfigurationSnapshot> {
    const normalized = normalizeIdentity(session, identity)
    const record = await this.inspector.inspect(
      normalized.pluginId,
      session,
    )
    const [layers, effectiveOptions, secretStatus] = await Promise.all([
      session.options.readLayers(normalized.pluginId),
      session.options.read(normalized.pluginId),
      session.secrets.inspect(normalized),
    ])
    const dataPath = pluginDataPath(session, normalized.pluginId)
    const diagnostics = deriveConfigurationDiagnostics(
      normalized.pluginId,
      record,
      layers,
      secretStatus.error,
    )
    return {
      identity: normalized,
      layers,
      effectiveOptions,
      secretStatus,
      data: {
        path: dataPath,
        exists: existsSync(dataPath),
      },
      diagnostics,
    }
  }

  async save(
    session: PluginDomainSession,
    request: PluginConfigurationSaveRequest,
  ): Promise<PluginConfigurationSnapshot> {
    const identity = normalizeIdentity(session, request.identity)
    const record = await this.inspector.inspect(identity.pluginId, session)
    if (!record) {
      throw configurationError(
        'plugin-config-plugin-not-found',
        `Plugin was not found: ${identity.pluginId}.`,
      )
    }
    const schema = configurationSchema(record)
    const options: Record<string, unknown> = {}
    const secrets: Record<string, string> = {}
    for (const [key, value] of Object.entries(request.values)) {
      if (!schema[key]) {
        throw configurationError(
          'plugin-config-key-unknown',
          `Plugin configuration key is not declared by the manifest: ${key}.`,
        )
      }
      if (schema[key]?.sensitive === true) {
        if (
          value !== undefined &&
          value !== null &&
          typeof value !== 'string'
        ) {
          throw configurationError(
            'plugin-secret-value-invalid',
            `Sensitive Plugin configuration must be a string: ${key}.`,
          )
        }
        secrets[key] = typeof value === 'string' ? value : ''
      } else {
        options[key] = value
      }
    }
    if (Object.keys(secrets).length > 0) {
      await session.secrets.write(identity, secrets)
    }
    if (Object.keys(options).length > 0) {
      await session.options.write(identity, options)
    }
    return this.inspect(session, identity)
  }

  async delete(
    session: PluginDomainSession,
    request: PluginConfigurationDeleteRequest,
  ): Promise<PluginConfigurationSnapshot> {
    const identity = normalizeIdentity(session, request.identity)
    if (request.removeSecrets) {
      await session.secrets.delete(identity)
    }
    if (request.removeOptions) {
      await session.options.delete(identity)
    }
    if (request.removeData) {
      await rm(pluginDataPath(session, identity.pluginId), {
        recursive: true,
        force: true,
      })
    }
    return this.inspect(session, identity)
  }
}

function deriveConfigurationDiagnostics(
  pluginId: string,
  record: PluginManagementRecord | null,
  layers: PluginConfigurationSnapshot['layers'],
  secretError: string | undefined,
): PluginDiagnostic[] {
  const diagnostics: PluginDiagnostic[] = []
  if (!record) {
    diagnostics.push({
      severity: 'error',
      code: 'plugin-config-plugin-not-found',
      message: `Plugin was not found: ${pluginId}.`,
      layer: 'settings',
      pluginId,
    })
    return diagnostics
  }
  const schemas = [
    ...record.installations.flatMap(installation =>
      installation.manifest?.userConfig
        ? [installation.manifest.userConfig]
        : [],
    ),
    ...record.candidates.flatMap(candidate =>
      candidate.manifest?.userConfig
        ? [candidate.manifest.userConfig]
        : [],
    ),
  ]
  const schemaDigests = new Set(schemas.map(schema => JSON.stringify(schema)))
  if (schemaDigests.size > 1) {
    diagnostics.push({
      severity: 'warning',
      code: 'plugin-config-schema-changed',
      message:
        'Installed and candidate Plugin versions declare different configuration schemas.',
      layer: 'settings',
      pluginId,
    })
  }
  const schema = configurationSchema(record)
  for (const layer of layers) {
    for (const key of Object.keys(layer.values)) {
      if (!schema[key]) {
        diagnostics.push({
          severity: 'warning',
          code: 'plugin-config-key-stale',
          message: `Saved Plugin configuration key is no longer declared: ${key}.`,
          layer: 'settings',
          pluginId,
          path: layer.path,
        })
      } else if (schema[key]?.sensitive === true) {
        diagnostics.push({
          severity: 'error',
          code: 'plugin-secret-in-settings',
          message: `Sensitive Plugin configuration is stored in settings: ${key}.`,
          layer: 'settings',
          pluginId,
          path: layer.path,
        })
      }
    }
  }
  if (secretError) {
    diagnostics.push({
      severity: 'error',
      code: 'plugin-secret-storage-unavailable',
      message: secretError,
      layer: 'settings',
      pluginId,
    })
  }
  return diagnostics
}

function configurationSchema(
  record: PluginManagementRecord,
): NonNullable<
  NonNullable<PluginManagementRecord['candidates'][number]['manifest']>['userConfig']
> {
  const installedSchema = record.installations.find(
    installation => installation.applicableToRequest,
  )?.manifest?.userConfig
  return (
    installedSchema ??
    record.candidates.find(candidate => candidate.manifest?.userConfig)
      ?.manifest?.userConfig ??
    {}
  )
}

function normalizeIdentity(
  session: PluginDomainSession,
  identity: PluginConfigurationIdentity,
): PluginConfigurationIdentity {
  if (identity.scope === 'user') {
    return { pluginId: identity.pluginId, scope: 'user' }
  }
  const workspaceRoot = resolve(
    identity.workspaceRoot ?? session.context.workspaceRoot,
  )
  if (workspaceRoot !== session.context.workspaceRoot) {
    throw configurationError(
      'plugin-config-workspace-mismatch',
      'Plugin configuration workspace does not match request context.',
    )
  }
  return {
    pluginId: identity.pluginId,
    scope: identity.scope,
    workspaceRoot,
  }
}

function pluginDataPath(
  session: PluginDomainSession,
  pluginId: string,
): string {
  return join(
    session.paths.pluginsRootDir,
    'data',
    pluginId.replace(/[^a-zA-Z0-9\-_]/g, '-'),
  )
}

function configurationError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}
