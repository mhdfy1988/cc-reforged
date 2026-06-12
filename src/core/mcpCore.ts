import {
  addMcpConfig,
  getClaudeCodeMcpConfigs,
  getMcpConfigByName,
  getUserMcpFilePath,
  isMcpServerDisabled,
  removeMcpConfig,
  setMcpServerEnabled,
  updateMcpConfig,
} from '../services/mcp/config.js'
import {
  collectCcrMcpConfigInventory,
  summarizeCcrMcpConfigInventory,
} from '../services/mcp/configInventory.js'
import type {
  CapabilityMcpConfigServer,
  CapabilityMcpConfigSnapshot,
  CapabilityPluginSnapshot,
} from '../services/capabilities/capabilityRuntimeEnvironment.js'
import {
  getCcrMcpInstallTransport,
  inferCcrMcpInstallKindFromConfig,
  type CcrMcpInstallManifestInput,
} from '../services/mcp/installManifest.js'
import { getCcrMcpInstallPreset } from '../services/mcp/installPresets.js'
import {
  applyCcrMcpAdoptPlan,
  applyCcrMcpInstallPlan,
  createCcrMcpAdoptPlan,
  createCcrMcpInstallPlan,
  listCcrMcpInstalledServers,
  saveCcrMcpInstallCandidateManifest,
  searchCcrMcpInstallCandidates,
  uninstallCcrMcpInstalledServer,
  type CcrMcpWritableScope,
} from '../services/mcp/installManager.js'
import { getMcpToolsCommandsAndResources } from '../services/mcp/client.js'
import {
  type MCPServerConnection,
  McpServerConfigSchema,
  type ServerResource,
  type ConfigScope,
  type McpServerConfig,
  type ScopedMcpServerConfig,
} from '../services/mcp/types.js'
import type { Tool } from '../Tool.js'
import { getPluginErrorMessage, type PluginError } from '../types/plugin.js'
import { CoreError } from './errors.js'
import { redactRecord, redactUrl } from './redaction.js'
import { errorMessage } from '../utils/errors.js'
import { getPluginMcpServers } from '../utils/plugins/mcpPluginIntegration.js'

type WritableMcpScope = Extract<ConfigScope, 'user'>
type InstalledMcpRecordRef = {
  name: string
  lockKey: string
  scope?: string
  summary: Record<string, unknown>
}

export async function listCoreMcpServers(options: {
  includeDisabled?: boolean
  cwd?: string
  configHomeDir?: string
  pluginSnapshot?: CapabilityPluginSnapshot
} = {}): Promise<CapabilityMcpConfigSnapshot> {
  if (
    options.cwd !== undefined ||
    options.configHomeDir !== undefined ||
    options.pluginSnapshot !== undefined
  ) {
    return listRequestScopedCoreMcpServers(options)
  }

  const { servers, errors } = await getClaudeCodeMcpConfigs()
  const inventory = collectCcrMcpConfigInventory()
  const installKindByName = new Map(
    inventory.servers
      .filter(server => server.active)
      .map(server => [server.name, server.installKind]),
  )
  const installedByName = await loadInstalledMcpRecordRefs()
  const summaries = Object.entries(servers)
    .map(([name, config]) =>
      summarizeMcpServer(name, config, installKindByName.get(name)),
    )
    .map(server => attachInstalledMcpRecord(server, installedByName))
  const configuredNames = new Set(summaries.map(server => server.name))
  for (const record of installedByName.values()) {
    if (!configuredNames.has(record.name)) {
      summaries.push(createInstalledOnlyMcpServer(record))
    }
  }
  const visibleSummaries = summaries.filter(
    server => options.includeDisabled || server.enabled !== false || server.ccrInstalled,
  )

  return {
    configPath: getUserMcpFilePath(),
    inventory: summarizeCcrMcpConfigInventory(inventory),
    servers: visibleSummaries,
    errors: errors.map(summarizePluginError),
  }
}

async function listRequestScopedCoreMcpServers(options: {
  includeDisabled?: boolean
  cwd?: string
  configHomeDir?: string
  pluginSnapshot?: CapabilityPluginSnapshot
}): Promise<CapabilityMcpConfigSnapshot> {
  const inventory = collectCcrMcpConfigInventory({
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.configHomeDir
      ? { configHomeDir: options.configHomeDir }
      : {}),
  })
  const configuredServers: CapabilityMcpConfigServer[] = inventory.servers
    .filter(server => server.active)
    .map(server => ({
      name: server.name,
      enabled: server.enabled,
      scope: server.scope,
      type: server.type,
      transport: server.transport,
      source: server.pluginSource ? 'plugin' : server.sourceId,
      installKind: server.installKind,
      ...(server.pluginSource
        ? { pluginSource: server.pluginSource }
        : {}),
      ...(server.command ? { command: server.command } : {}),
      ...(server.url ? { url: server.url } : {}),
      ...(server.args ? { args: server.args } : {}),
    }))
  const installedByName = await loadInstalledMcpRecordRefs()

  const pluginErrors: PluginError[] = []
  const pluginServers = await Promise.all(
    (options.pluginSnapshot?.plugins ?? [])
      .filter(plugin => plugin.enabled !== false)
      .map(plugin => getPluginMcpServers(plugin, pluginErrors)),
  )
  const configuredNames = new Set(configuredServers.map(server => server.name))
  for (const servers of pluginServers) {
    for (const [name, config] of Object.entries(servers ?? {})) {
      if (configuredNames.has(name)) continue
      configuredServers.push(
        summarizeMcpServer(name, config) as CapabilityMcpConfigServer,
      )
      configuredNames.add(name)
    }
  }
  for (const record of installedByName.values()) {
    if (!configuredNames.has(record.name)) {
      configuredServers.push(createInstalledOnlyMcpServer(record))
      configuredNames.add(record.name)
    }
  }

  return {
    configPath: getUserMcpFilePath(inventory.configHomeDir),
    inventory: summarizeCcrMcpConfigInventory(inventory),
    servers: configuredServers
      .map(server => attachInstalledMcpRecord(server, installedByName))
      .filter(server => options.includeDisabled || server.enabled !== false),
    errors: [
      ...inventory.sources.flatMap(source =>
        source.errors.map(message => ({
          type: 'config-error',
          source: source.id,
          message,
        })),
      ),
      ...pluginErrors.map(summarizePluginError),
    ],
  }
}

async function loadInstalledMcpRecordRefs(): Promise<
  Map<string, InstalledMcpRecordRef>
> {
  const result = await listCcrMcpInstalledServers()
  const records = Array.isArray(result.installed) ? result.installed : []
  const byName = new Map<string, InstalledMcpRecordRef>()
  for (const value of records) {
    if (!value || typeof value !== 'object') continue
    const record = value as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : ''
    if (!name) continue
    const lockKey =
      typeof record.lockKey === 'string' && record.lockKey
        ? record.lockKey
        : name
    byName.set(name, {
      name,
      lockKey,
      ...(typeof record.scope === 'string' ? { scope: record.scope } : {}),
      summary: record,
    })
  }
  return byName
}

function attachInstalledMcpRecord<T extends CapabilityMcpConfigServer>(
  server: T,
  installedByName: Map<string, InstalledMcpRecordRef>,
): T {
  const record = installedByName.get(server.name)
  if (!record) return server
  return {
    ...server,
    ccrInstalled: true,
    installedRef: record.lockKey,
    ...(record.scope ? { installedRecordScope: record.scope } : {}),
  }
}

function createInstalledOnlyMcpServer(
  record: InstalledMcpRecordRef,
): CapabilityMcpConfigServer {
  const manifest = asRecord(record.summary.manifest)
  const preview = asRecord(record.summary.serverConfigPreview)
  const transport =
    readString(preview, 'type') ??
    readString(preview, 'transport') ??
    readString(manifest, 'transport') ??
    'stdio'
  return {
    name: record.name,
    enabled: false,
    ...(record.scope ? { scope: record.scope } : {}),
    type: transport,
    transport,
    source: 'mcp',
    installKind: readString(manifest, 'kind') ?? 'installed-record',
    configured: false,
    ccrInstalled: true,
    installedRef: record.lockKey,
    ...(record.scope ? { installedRecordScope: record.scope } : {}),
    ...(readString(preview, 'command')
      ? { command: readString(preview, 'command') }
      : {}),
    ...(readString(preview, 'url') ? { url: readString(preview, 'url') } : {}),
    ...(Array.isArray(preview.args)
      ? { args: preview.args.filter(value => typeof value === 'string') }
      : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value ? value : undefined
}

export function inspectCoreMcpServer(input: {
  name: string
}): Record<string, unknown> {
  const inventory = collectCcrMcpConfigInventory()
  const entries = inventory.servers.filter(server => server.name === input.name)
  const config = getMcpConfigByName(input.name)

  return {
    name: input.name,
    found: entries.length > 0 || config !== null,
    active: entries.find(entry => entry.active) ?? null,
    entries,
    resolved: config
      ? summarizeMcpServer(
          input.name,
          config,
          inferCcrMcpInstallKindFromConfig(config, {
            pluginSource: config.pluginSource,
          }),
        )
      : null,
    inventory: summarizeCcrMcpConfigInventory(inventory),
  }
}

export async function addCoreMcpServer(input: {
  name: string
  scope: ConfigScope
  config: unknown
}): Promise<Record<string, unknown>> {
  const scope = assertWritableScope(input.scope)
  const config = parseMcpServerConfig(input.config)
  await addMcpConfig(input.name, config, scope)
  return inspectCoreMcpServer({ name: input.name })
}

export async function updateCoreMcpServer(input: {
  name: string
  scope: ConfigScope
  config: unknown
}): Promise<Record<string, unknown>> {
  const scope = assertWritableScope(input.scope)
  const config = parseMcpServerConfig(input.config)
  await updateMcpConfig(input.name, config, scope)
  return inspectCoreMcpServer({ name: input.name })
}

export async function removeCoreMcpServer(input: {
  name: string
  scope: ConfigScope
}): Promise<Record<string, unknown>> {
  const scope = assertWritableScope(input.scope)
  await removeMcpConfig(input.name, scope)
  setMcpServerEnabled(input.name, true)
  return {
    name: input.name,
    scope,
    removed: true,
    inventory: summarizeCcrMcpConfigInventory(),
  }
}

export function setCoreMcpServerEnabled(input: {
  name: string
  enabled: boolean
}): Record<string, unknown> {
  setMcpServerEnabled(input.name, input.enabled)
  return inspectCoreMcpServer({ name: input.name })
}

export async function testCoreMcpServer(input: {
  name: string
}): Promise<Record<string, unknown>> {
  const inspected = inspectCoreMcpServer({ name: input.name })
  const active = inspected.active as { enabled?: boolean } | null
  const config = getMcpConfigByName(input.name)
  if (inspected.found !== true || !config) {
    return {
      name: input.name,
      ok: false,
      networkChecked: false,
      state: 'not_found',
      message: 'MCP server config was not found.',
      inspected,
    }
  }
  if (active?.enabled === false || isMcpServerDisabled(input.name)) {
    return {
      name: input.name,
      ok: false,
      networkChecked: false,
      state: 'disabled',
      message: 'MCP server is disabled.',
      inspected,
    }
  }

  const runtime = await discoverCoreMcpRuntimeForServer(input.name, config)
  const client = runtime.clients[0]
  const state = client?.type ?? 'not_found'
  const ok = state === 'connected'

  return {
    name: input.name,
    ok,
    networkChecked: true,
    state,
    message:
      ok
        ? `MCP runtime connected. Loaded ${runtime.tools.length} tools.`
        : runtime.error ??
          `MCP runtime did not connect. Current state: ${state}.`,
    tools: runtime.tools.map(summarizeRuntimeTool),
    resources: runtime.resources,
    inspected,
  }
}

export function restartCoreMcpServer(input: {
  name: string
}): Record<string, unknown> {
  const inspected = inspectCoreMcpServer({ name: input.name })
  return {
    name: input.name,
    accepted: inspected.found === true,
    applied: false,
    state: inspected.found === true ? 'restart_pending_runtime' : 'not_found',
    message:
      inspected.found === true
        ? 'Restart request accepted by Core API; an active MCP connection manager must apply it.'
        : 'MCP server config was not found.',
    inspected,
  }
}

export function searchCoreMcpInstallCandidates(input: {
  query?: string
} = {}): Promise<Record<string, unknown>> {
  return searchCcrMcpInstallCandidates(input)
}

export function planCoreMcpInstall(input: {
  name?: string
  scope?: CcrMcpWritableScope
  manifest: unknown
  force?: boolean
}): Record<string, unknown> {
  return createCcrMcpInstallPlan({
    name: input.name,
    scope: input.scope ?? 'user',
    manifest: input.manifest as CcrMcpInstallManifestInput,
    force: input.force ?? false,
  })
}

export async function applyCoreMcpInstall(input: {
  name?: string
  scope?: CcrMcpWritableScope
  manifest: unknown
  force?: boolean
  confirmed: boolean
  confirmationToken: string
}): Promise<Record<string, unknown>> {
  return applyCcrMcpInstallPlan({
    name: input.name,
    scope: input.scope ?? 'user',
    manifest: input.manifest as CcrMcpInstallManifestInput,
    force: input.force ?? false,
    confirmed: input.confirmed,
    confirmationToken: input.confirmationToken,
  })
}

export function saveCoreMcpInstallManifest(input: {
  manifest: unknown
  overwrite?: boolean
}): Promise<Record<string, unknown>> {
  return saveCcrMcpInstallCandidateManifest({
    manifest: input.manifest as CcrMcpInstallManifestInput,
    overwrite: input.overwrite,
  })
}

export function planCoreMcpAdopt(input: {
  name: string
}): Promise<Record<string, unknown>> {
  return createCcrMcpAdoptPlan(input)
}

export function applyCoreMcpAdopt(input: {
  name: string
  confirmed: boolean
  confirmationToken: string
}): Promise<Record<string, unknown>> {
  return applyCcrMcpAdoptPlan(input)
}

export function listCoreMcpInstalls(): Promise<Record<string, unknown>> {
  return listCcrMcpInstalledServers()
}

export function uninstallCoreMcpInstalledServer(input: {
  name: string
  confirmed: boolean
}): Promise<Record<string, unknown>> {
  return uninstallCcrMcpInstalledServer(input)
}

export async function repairCoreMcpInstalledServer(input: {
  name: string
  scope?: CcrMcpWritableScope
  confirmed: boolean
}): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new CoreError(
      'invalid_params',
      'MCP repair requires explicit user confirmation.',
    )
  }
  const preset = getCcrMcpInstallPreset(input.name)
  if (!preset) {
    throw new CoreError(
      'invalid_params',
      `MCP repair currently supports built-in presets only. No preset found for "${input.name}".`,
    )
  }
  const plan = createCcrMcpInstallPlan({
    name: input.name,
    scope: input.scope ?? 'user',
    manifest: preset.manifest,
    force: true,
  })
  return applyCcrMcpInstallPlan({
    name: input.name,
    scope: input.scope ?? 'user',
    manifest: preset.manifest,
    force: true,
    confirmed: true,
    confirmationToken: plan.confirmation.token,
  })
}

function summarizeMcpServer(
  name: string,
  config: ScopedMcpServerConfig,
  installKind = inferCcrMcpInstallKindFromConfig(config, {
    pluginSource: config.pluginSource,
  }),
): CapabilityMcpConfigServer & Record<string, unknown> {
  const type = getMcpServerType(config)
  const enabled = !isMcpServerDisabled(name)
  const summary: CapabilityMcpConfigServer & Record<string, unknown> = {
    name,
    scope: config.scope,
    type,
    enabled,
    source: config.pluginSource ? 'plugin' : config.scope,
    ...(config.pluginSource ? { pluginSource: config.pluginSource } : {}),
    installKind,
    transport: getCcrMcpInstallTransport(config),
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

async function discoverCoreMcpRuntimeForServer(
  name: string,
  config: ScopedMcpServerConfig,
): Promise<{
  clients: MCPServerConnection[]
  tools: Tool[]
  resources: ServerResource[]
  error?: string
}> {
  const clients: MCPServerConnection[] = []
  const tools: Tool[] = []
  const resources: ServerResource[] = []

  try {
    await getMcpToolsCommandsAndResources(
      result => {
        clients.push(result.client)
        tools.push(
          ...result.tools.filter(tool => tool.mcpInfo?.serverName === name),
        )
        if (result.resources?.length) {
          resources.push(...result.resources)
        }
      },
      { [name]: config },
    )
  } catch (error) {
    return {
      clients,
      tools,
      resources,
      error: errorMessage(error),
    }
  }

  return {
    clients,
    tools,
    resources,
  }
}

function summarizeRuntimeTool(tool: Tool): Record<string, unknown> {
  return {
    name: tool.name,
    annotations: {
      readOnly: safeToolBoolean(() => tool.isReadOnly(undefined as never)),
      destructive: safeToolBoolean(() =>
        tool.isDestructive?.(undefined as never),
      ),
      openWorld: safeToolBoolean(() => tool.isOpenWorld?.(undefined as never)),
    },
  }
}

function safeToolBoolean(read: () => boolean | undefined): boolean | undefined {
  try {
    return read()
  } catch {
    return undefined
  }
}

function assertWritableScope(scope: ConfigScope): WritableMcpScope {
  if (scope === 'user') {
    return scope
  }
  throw new CoreError(
    'invalid_params',
    `MCP scope is read-only from Desktop management APIs: ${scope}`,
    { scope },
  )
}

function parseMcpServerConfig(config: unknown): McpServerConfig {
  const result = McpServerConfigSchema().safeParse(config)
  if (!result.success) {
    throw new CoreError('invalid_params', 'Invalid MCP server config.', {
      issues: result.error.issues,
    })
  }
  return result.data
}
