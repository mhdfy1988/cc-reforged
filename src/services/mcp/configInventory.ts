import { existsSync } from 'fs'
import { dirname, join, parse, resolve } from 'path'
import {
  getCurrentProjectConfig,
  getGlobalConfig,
} from '../../utils/config.js'
import { getCwd } from '../../utils/cwd.js'
import { getGlobalClaudeFile } from '../../utils/env.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { isSettingSourceEnabled } from '../../utils/settings/constants.js'
import { isRestrictedToPluginOnly } from '../../utils/settings/pluginOnlyPolicy.js'
import {
  doesEnterpriseMcpConfigExist,
  filterMcpServersByPolicy,
  getEnterpriseMcpFilePath,
  getUserMcpFilePath,
  isMcpServerDisabled,
  parseMcpConfig,
  parseMcpConfigFromFilePath,
} from './config.js'
import {
  getCcrMcpInstallTransport,
  inferCcrMcpInstallKindFromConfig,
  type CcrMcpInstallKind,
} from './installManifest.js'
import type {
  ConfigScope,
  ScopedMcpServerConfig,
} from './types.js'
import { getProjectMcpServerStatus } from './utils.js'

export type CcrMcpConfigSourceId =
  | 'enterprise'
  | 'claudeai'
  | 'plugin'
  | 'user-legacy'
  | 'user-file'
  | 'project'
  | 'local'
  | 'dynamic'

export type CcrMcpSourceMode = 'config-file' | 'settings' | 'remote' | 'runtime'

export type CcrMcpInstallPaths = {
  packageRootDir: string
  installedManifestPath: string
  lockFilePath: string
  logDir: string
}

export type CcrMcpConfigSourceInventory = {
  id: CcrMcpConfigSourceId
  label: string
  scope: ConfigScope
  mode: CcrMcpSourceMode
  precedence: number
  enabled: boolean
  writable: boolean
  readPaths: string[]
  writePath: string | null
  readOnlyReason?: string
  exclusive?: boolean
  serverCount: number
  errors: string[]
}

export type CcrMcpServerConfigInventory = {
  name: string
  sourceId: CcrMcpConfigSourceId
  scope: ConfigScope
  transport: string
  installKind: CcrMcpInstallKind
  configPath: string | null
  writePath: string | null
  enabled: boolean
  readOnly: boolean
  active: boolean
  suppressed: boolean
  suppressionReason: string | null
  projectStatus?: 'approved' | 'rejected' | 'pending'
  pluginSource?: string
  type?: string
  command?: string
  url?: string
  args?: string[]
}

export type CcrMcpConfigInventory = {
  projectCwd: string
  configHomeDir: string
  globalConfigPath: string
  enterpriseExclusive: boolean
  pluginOnly: boolean
  installPaths: CcrMcpInstallPaths
  sources: CcrMcpConfigSourceInventory[]
  servers: CcrMcpServerConfigInventory[]
}

type SourceDefinition = Omit<
  CcrMcpConfigSourceInventory,
  'serverCount' | 'errors'
>

type ServerCandidate = {
  name: string
  config: ScopedMcpServerConfig
  sourceId: CcrMcpConfigSourceId
  scope: ConfigScope
  precedence: number
  configPath: string | null
  writePath: string | null
  readOnly: boolean
  sourceEnabled: boolean
}

const SOURCE_PRECEDENCE: Record<CcrMcpConfigSourceId, number> = {
  claudeai: 10,
  plugin: 20,
  'user-legacy': 30,
  'user-file': 31,
  project: 40,
  local: 50,
  dynamic: 60,
  enterprise: 100,
}

export type CcrMcpConfigInventoryOptions = {
  cwd?: string
  configHomeDir?: string
}

export function getCcrMcpInstallPaths(
  configHomeDir = getClaudeConfigHomeDir(),
): CcrMcpInstallPaths {
  return {
    packageRootDir: join(configHomeDir, 'mcp', 'packages'),
    installedManifestPath: join(configHomeDir, 'mcp', 'installed.json'),
    lockFilePath: join(configHomeDir, 'mcp', 'lock.json'),
    logDir: join(configHomeDir, 'logs', 'mcp'),
  }
}

export function getCcrMcpProjectConfigReadPaths(cwd = getCwd()): string[] {
  const dirs: string[] = []
  let currentDir = cwd

  while (currentDir !== parse(currentDir).root) {
    dirs.push(currentDir)
    currentDir = dirname(currentDir)
  }

  return dirs.reverse().map(dir => join(dir, '.mcp.json'))
}

export function collectCcrMcpConfigInventory(
  options: CcrMcpConfigInventoryOptions = {},
): CcrMcpConfigInventory {
  const projectCwd = resolve(options.cwd ?? getCwd())
  const configHomeDir = resolve(
    options.configHomeDir ?? getClaudeConfigHomeDir(),
  )
  const usesProcessConfigHome =
    configHomeDir === resolve(getClaudeConfigHomeDir())
  const usesProcessProjectState =
    usesProcessConfigHome && projectCwd === resolve(getCwd())
  const globalConfigPath = usesProcessConfigHome
    ? getGlobalClaudeFile()
    : getRequestScopedGlobalConfigPath(configHomeDir)
  const enterpriseExclusive = doesEnterpriseMcpConfigExist()
  const pluginOnly = isRestrictedToPluginOnly('mcp')
  const projectReadPaths = getCcrMcpProjectConfigReadPaths(projectCwd)
  const enterprisePath = getEnterpriseMcpFilePath()
  const userPath = getUserMcpFilePath(configHomeDir)

  const sourceDefinitions: SourceDefinition[] = [
    {
      id: 'enterprise',
      label: '企业托管 MCP 配置',
      scope: 'enterprise',
      mode: 'config-file',
      precedence: SOURCE_PRECEDENCE.enterprise,
      enabled: true,
      writable: false,
      readPaths: [enterprisePath],
      writePath: null,
      readOnlyReason: 'managed_policy',
      exclusive: enterpriseExclusive,
    },
    {
      id: 'claudeai',
      label: 'Claude.ai 连接器 MCP',
      scope: 'claudeai',
      mode: 'remote',
      precedence: SOURCE_PRECEDENCE.claudeai,
      enabled: !enterpriseExclusive,
      writable: false,
      readPaths: [],
      writePath: null,
      readOnlyReason: enterpriseExclusive ? 'enterprise_exclusive' : 'remote',
    },
    {
      id: 'plugin',
      label: '插件提供 MCP',
      scope: 'dynamic',
      mode: 'runtime',
      precedence: SOURCE_PRECEDENCE.plugin,
      enabled: !enterpriseExclusive,
      writable: false,
      readPaths: [],
      writePath: null,
      readOnlyReason: enterpriseExclusive ? 'enterprise_exclusive' : 'plugin_provided',
    },
    {
      id: 'user-legacy',
      label: '用户级旧配置 MCP',
      scope: 'user',
      mode: 'settings',
      precedence: SOURCE_PRECEDENCE['user-legacy'],
      enabled:
        isSettingSourceEnabled('userSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      writable: false,
      readPaths: [globalConfigPath],
      writePath: null,
      readOnlyReason: pluginOnly
        ? 'plugin_only_policy'
        : enterpriseExclusive
          ? 'enterprise_exclusive'
          : 'legacy_read_only',
    },
    {
      id: 'user-file',
      label: '用户级 MCP 配置',
      scope: 'user',
      mode: 'config-file',
      precedence: SOURCE_PRECEDENCE['user-file'],
      enabled:
        isSettingSourceEnabled('userSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      writable: !enterpriseExclusive && !pluginOnly,
      readPaths: [userPath],
      writePath: userPath,
      readOnlyReason: pluginOnly
        ? 'plugin_only_policy'
        : enterpriseExclusive
          ? 'enterprise_exclusive'
          : undefined,
    },
    {
      id: 'project',
      label: '项目级 MCP 配置',
      scope: 'project',
      mode: 'config-file',
      precedence: SOURCE_PRECEDENCE.project,
      enabled:
        isSettingSourceEnabled('projectSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      writable:
        isSettingSourceEnabled('projectSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      readPaths: projectReadPaths,
      writePath: join(projectCwd, '.mcp.json'),
      readOnlyReason: pluginOnly
        ? 'plugin_only_policy'
        : enterpriseExclusive
          ? 'enterprise_exclusive'
          : undefined,
    },
    {
      id: 'local',
      label: '本项目本地 MCP 配置',
      scope: 'local',
      mode: 'settings',
      precedence: SOURCE_PRECEDENCE.local,
      enabled:
        isSettingSourceEnabled('localSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      writable:
        isSettingSourceEnabled('localSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      readPaths: [globalConfigPath],
      writePath: globalConfigPath,
      readOnlyReason: pluginOnly
        ? 'plugin_only_policy'
        : enterpriseExclusive
          ? 'enterprise_exclusive'
          : undefined,
    },
    {
      id: 'dynamic',
      label: '运行时动态 MCP',
      scope: 'dynamic',
      mode: 'runtime',
      precedence: SOURCE_PRECEDENCE.dynamic,
      enabled: !enterpriseExclusive,
      writable: false,
      readPaths: [],
      writePath: null,
      readOnlyReason: enterpriseExclusive ? 'enterprise_exclusive' : 'runtime_only',
    },
  ]

  const sourceErrors = new Map<CcrMcpConfigSourceId, string[]>()
  const candidates: ServerCandidate[] = []

  collectFileCandidates({
    sourceId: 'enterprise',
    scope: 'enterprise',
    filePath: enterprisePath,
    writePath: null,
    readOnly: true,
    sourceEnabled: true,
    candidates,
    sourceErrors,
  })

  if (usesProcessConfigHome) {
    collectUserLegacyCandidates({
      globalConfigPath,
      sourceEnabled:
        isSettingSourceEnabled('userSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      candidates,
      sourceErrors,
    })
  }

  collectFileCandidates({
    sourceId: 'user-file',
    scope: 'user',
    filePath: userPath,
    writePath: userPath,
    readOnly: enterpriseExclusive || pluginOnly,
    sourceEnabled:
      isSettingSourceEnabled('userSettings') &&
      !enterpriseExclusive &&
      !pluginOnly,
    candidates,
    sourceErrors,
  })

  for (const filePath of projectReadPaths) {
    collectFileCandidates({
      sourceId: 'project',
      scope: 'project',
      filePath,
      writePath: join(projectCwd, '.mcp.json'),
      readOnly: enterpriseExclusive || pluginOnly,
      sourceEnabled:
        isSettingSourceEnabled('projectSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      candidates,
      sourceErrors,
    })
  }

  if (usesProcessProjectState) {
    collectLocalCandidates({
      globalConfigPath,
      sourceEnabled:
        isSettingSourceEnabled('localSettings') &&
        !enterpriseExclusive &&
        !pluginOnly,
      candidates,
      sourceErrors,
    })
  }

  const sources = sourceDefinitions.map(source => ({
    ...source,
    serverCount: candidates.filter(candidate => candidate.sourceId === source.id)
      .length,
    errors: sourceErrors.get(source.id) ?? [],
  }))

  return {
    projectCwd,
    configHomeDir,
    globalConfigPath,
    enterpriseExclusive,
    pluginOnly,
    installPaths: getCcrMcpInstallPaths(configHomeDir),
    sources,
    servers: buildServerInventory(candidates, enterpriseExclusive, {
      useProcessState: usesProcessProjectState,
    }),
  }
}

export function summarizeCcrMcpConfigInventory(
  inventory = collectCcrMcpConfigInventory(),
): {
  projectCwd: string
  configHomeDir: string
  globalConfigPath: string
  enterpriseExclusive: boolean
  pluginOnly: boolean
  installPaths: CcrMcpInstallPaths
  sources: Array<
    Pick<
      CcrMcpConfigSourceInventory,
      | 'id'
      | 'scope'
      | 'mode'
      | 'precedence'
      | 'enabled'
      | 'writable'
      | 'readPaths'
      | 'writePath'
      | 'readOnlyReason'
      | 'exclusive'
      | 'serverCount'
      | 'errors'
    > & { existingReadPaths: string[] }
  >
  servers: CcrMcpServerConfigInventory[]
} {
  return {
    projectCwd: inventory.projectCwd,
    configHomeDir: inventory.configHomeDir,
    globalConfigPath: inventory.globalConfigPath,
    enterpriseExclusive: inventory.enterpriseExclusive,
    pluginOnly: inventory.pluginOnly,
    installPaths: inventory.installPaths,
    sources: inventory.sources.map(source => ({
      id: source.id,
      scope: source.scope,
      mode: source.mode,
      precedence: source.precedence,
      enabled: source.enabled,
      writable: source.writable,
      readPaths: source.readPaths,
      writePath: source.writePath,
      readOnlyReason: source.readOnlyReason,
      exclusive: source.exclusive,
      serverCount: source.serverCount,
      errors: source.errors,
      existingReadPaths: source.readPaths.filter(path => existsSync(path)),
    })),
    servers: inventory.servers,
  }
}

function collectFileCandidates(params: {
  sourceId: CcrMcpConfigSourceId
  scope: ConfigScope
  filePath: string
  writePath: string | null
  readOnly: boolean
  sourceEnabled: boolean
  candidates: ServerCandidate[]
  sourceErrors: Map<CcrMcpConfigSourceId, string[]>
}): void {
  const { config, errors } = parseMcpConfigFromFilePath({
    filePath: params.filePath,
    expandVars: true,
    scope: params.scope,
  })
  pushErrors(params.sourceErrors, params.sourceId, errors)

  if (!config?.mcpServers) {
    return
  }

  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    params.candidates.push({
      name,
      config: { ...serverConfig, scope: params.scope },
      sourceId: params.sourceId,
      scope: params.scope,
      precedence: SOURCE_PRECEDENCE[params.sourceId],
      configPath: params.filePath,
      writePath: params.writePath,
      readOnly: params.readOnly,
      sourceEnabled: params.sourceEnabled,
    })
  }
}

function collectUserLegacyCandidates(params: {
  globalConfigPath: string
  sourceEnabled: boolean
  candidates: ServerCandidate[]
  sourceErrors: Map<CcrMcpConfigSourceId, string[]>
}): void {
  const legacyMcpServers = getGlobalConfig().mcpServers
  if (!legacyMcpServers) {
    return
  }

  const { config, errors } = parseMcpConfig({
    configObject: { mcpServers: legacyMcpServers },
    expandVars: true,
    scope: 'user',
  })
  pushErrors(params.sourceErrors, 'user-legacy', errors)

  for (const [name, serverConfig] of Object.entries(config?.mcpServers ?? {})) {
    params.candidates.push({
      name,
      config: { ...serverConfig, scope: 'user' },
      sourceId: 'user-legacy',
      scope: 'user',
      precedence: SOURCE_PRECEDENCE['user-legacy'],
      configPath: params.globalConfigPath,
      writePath: null,
      readOnly: true,
      sourceEnabled: params.sourceEnabled,
    })
  }
}

function collectLocalCandidates(params: {
  globalConfigPath: string
  sourceEnabled: boolean
  candidates: ServerCandidate[]
  sourceErrors: Map<CcrMcpConfigSourceId, string[]>
}): void {
  const localMcpServers = getCurrentProjectConfig().mcpServers
  if (!localMcpServers) {
    return
  }

  const { config, errors } = parseMcpConfig({
    configObject: { mcpServers: localMcpServers },
    expandVars: true,
    scope: 'local',
  })
  pushErrors(params.sourceErrors, 'local', errors)

  for (const [name, serverConfig] of Object.entries(config?.mcpServers ?? {})) {
    params.candidates.push({
      name,
      config: { ...serverConfig, scope: 'local' },
      sourceId: 'local',
      scope: 'local',
      precedence: SOURCE_PRECEDENCE.local,
      configPath: params.globalConfigPath,
      writePath: params.globalConfigPath,
      readOnly: false,
      sourceEnabled: params.sourceEnabled,
    })
  }
}

function buildServerInventory(
  candidates: ServerCandidate[],
  enterpriseExclusive: boolean,
  options: { useProcessState: boolean },
): CcrMcpServerConfigInventory[] {
  const activeByName = new Map<string, ServerCandidate>()

  for (const candidate of candidates) {
    if (
      getSuppressionReason(candidate, enterpriseExclusive, options)
    ) {
      continue
    }

    const current = activeByName.get(candidate.name)
    if (!current || candidate.precedence >= current.precedence) {
      activeByName.set(candidate.name, candidate)
    }
  }

  return candidates
    .map(candidate => {
      const active = activeByName.get(candidate.name) === candidate
      const suppressionReason =
        getSuppressionReason(candidate, enterpriseExclusive, options) ??
        (active ? null : `shadowed_by_${activeByName.get(candidate.name)?.sourceId ?? 'none'}`)

      return {
        name: candidate.name,
        sourceId: candidate.sourceId,
        scope: candidate.scope,
        transport: getCcrMcpInstallTransport(candidate.config),
        installKind: inferCcrMcpInstallKindFromConfig(candidate.config, {
          pluginSource: candidate.config.pluginSource,
          sourceId: candidate.sourceId,
        }),
        configPath: candidate.configPath,
        writePath: candidate.writePath,
        enabled:
          !options.useProcessState || !isMcpServerDisabled(candidate.name),
        readOnly: candidate.readOnly,
        active,
        suppressed: !active,
        suppressionReason,
        projectStatus:
          candidate.scope === 'project'
            ? options.useProcessState
              ? getProjectMcpServerStatus(candidate.name)
              : 'approved'
            : undefined,
        pluginSource: candidate.config.pluginSource,
        type: candidate.config.type,
        command:
          'command' in candidate.config
            ? candidate.config.command
            : undefined,
        url: 'url' in candidate.config ? candidate.config.url : undefined,
        args: 'args' in candidate.config ? candidate.config.args : undefined,
      }
    })
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name)
      if (byName !== 0) return byName
      return a.sourceId.localeCompare(b.sourceId)
    })
}

function getSuppressionReason(
  candidate: ServerCandidate,
  enterpriseExclusive: boolean,
  options: { useProcessState: boolean },
): string | null {
  if (enterpriseExclusive && candidate.scope !== 'enterprise') {
    return 'enterprise_exclusive'
  }

  if (!candidate.sourceEnabled) {
    return 'source_disabled'
  }

  if (options.useProcessState && isMcpServerDisabled(candidate.name)) {
    return 'disabled'
  }

  if (options.useProcessState) {
    const { blocked } = filterMcpServersByPolicy({
      [candidate.name]: candidate.config,
    })
    if (blocked.includes(candidate.name)) {
      return 'policy_blocked'
    }
  }

  if (candidate.scope === 'project') {
    const status = options.useProcessState
      ? getProjectMcpServerStatus(candidate.name)
      : 'approved'
    if (status !== 'approved') {
      return `project_${status}`
    }
  }

  return null
}

function getRequestScopedGlobalConfigPath(configHomeDir: string): string {
  const legacyPath = join(configHomeDir, '.config.json')
  return existsSync(legacyPath)
    ? legacyPath
    : join(configHomeDir, '.ccr.json')
}

function pushErrors(
  target: Map<CcrMcpConfigSourceId, string[]>,
  sourceId: CcrMcpConfigSourceId,
  errors: Array<{ message: string }>,
): void {
  const messages = errors
    .map(error => error.message)
    .filter(message => !message.startsWith('MCP config file not found'))
  if (messages.length === 0) {
    return
  }
  target.set(sourceId, [...(target.get(sourceId) ?? []), ...messages])
}
