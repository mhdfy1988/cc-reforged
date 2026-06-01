import { createHash } from 'crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import { z } from 'zod/v4'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getPlatform } from '../../utils/platform.js'
import {
  addMcpConfig,
  getMcpConfigByName,
  removeMcpConfig,
  updateMcpConfig,
} from './config.js'
import {
  collectCcrMcpConfigInventory,
  getCcrMcpInstallPaths,
  summarizeCcrMcpConfigInventory,
} from './configInventory.js'
import {
  CcrMcpInstallManifestSchema,
  createCcrMcpInstallManifest,
  getCcrMcpInstallTransport,
  summarizeCcrMcpInstallManifest,
  type CcrMcpInstallManifest,
  type CcrMcpInstallManifestInput,
} from './installManifest.js'
import {
  getCcrMcpInstallPreset,
  searchCcrMcpInstallPresets,
} from './installPresets.js'
import {
  McpServerConfigSchema,
  type McpServerConfig,
} from './types.js'

export const CcrMcpWritableScopeSchema = z.enum(['user', 'project', 'local'])
export type CcrMcpWritableScope = z.infer<typeof CcrMcpWritableScopeSchema>

export const CcrMcpInstallPlanInputSchema = z.object({
  name: z.string().min(1).optional(),
  scope: CcrMcpWritableScopeSchema.default('user'),
  manifest: CcrMcpInstallManifestSchema(),
  force: z.boolean().default(false),
})
export type CcrMcpInstallPlanInput = z.input<
  typeof CcrMcpInstallPlanInputSchema
>

export type CcrMcpInstallPlan = {
  schemaVersion: 1
  planId: string
  name: string
  scope: CcrMcpWritableScope
  force: boolean
  installable: boolean
  existing?: {
    configured: boolean
    scope: string | null
    message: string
  }
  manifest: ReturnType<typeof summarizeCcrMcpInstallManifest>
  serverConfigPreview: Record<string, unknown>
  writes: Array<{
    kind: 'config' | 'installed-manifest' | 'lockfile' | 'package-cache'
    path: string
    mode: 'write' | 'record' | 'reserve'
  }>
  risks: string[]
  security: CcrMcpInstallSecuritySummary
  requiresConfirmation: true
  confirmation: {
    token: string
    message: string
  }
}

export type CcrMcpAdoptPlan = {
  schemaVersion: 1
  planId: string
  name: string
  scope: CcrMcpWritableScope
  adoptable: boolean
  existingInstalled: boolean
  manifest: ReturnType<typeof summarizeCcrMcpInstallManifest>
  manifestInput: CcrMcpInstallManifest
  serverConfigPreview: Record<string, unknown>
  writes: Array<{
    kind: 'installed-manifest' | 'lockfile'
    path: string
    mode: 'record'
  }>
  risks: string[]
  requiresConfirmation: true
  confirmation: {
    token: string
    message: string
  }
}

type CcrMcpInstallSecuritySummary = {
  confirmationRequired: true
  dataBoundary: CcrMcpInstallManifest['dataBoundary']
  scope: CcrMcpWritableScope
  scopeWritable: boolean
  projectTrustRequired: boolean
  enterpriseExclusive: boolean
  pluginOnly: boolean
  packageCache: {
    packageRootDir: string
    packageDir: string | null
    ownerMarkerPath: string | null
    cleanupPolicy: 'owner-marker-required' | 'not-applicable'
  }
  checksum: {
    declared: boolean
    requiredForDownload: boolean
    algorithm: string | null
  }
  version: {
    value: string | null
    pinned: boolean
  }
  secrets: {
    env: Array<{
      name: string
      required: boolean
      secret: boolean
    }>
    serverConfig: {
      envSecretKeys: string[]
      headerSecretKeys: string[]
      oauth: boolean
      headersHelper: boolean
    }
  }
}

type CcrMcpInstalledRecord = {
  schemaVersion: 1
  name: string
  scope: CcrMcpWritableScope
  installedAt: string
  updatedAt: string
  manifest: CcrMcpInstallManifest
  serverConfig: McpServerConfig
  configPath: string | null
  packageDir: string | null
  packageOwnerMarkerPath?: string | null
  lockKey: string
}

type CcrMcpInstallConfigStatus =
  | 'configured'
  | 'drifted'
  | 'missing-config'

type CcrMcpInstalledIndex = {
  schemaVersion: 1
  installed: Record<string, CcrMcpInstalledRecord>
}

type CcrMcpLockRecord = {
  name: string
  scope: CcrMcpWritableScope
  sourceKind: CcrMcpInstallManifest['source']['kind']
  version: string | null
  transport: string
  packageDir: string | null
  packageOwnerMarkerPath?: string | null
  checksum: CcrMcpInstallManifest['checksum'] | null
  dataBoundary?: CcrMcpInstallManifest['dataBoundary']
  updatedAt: string
}

type CcrMcpLockIndex = {
  schemaVersion: 1
  locks: Record<string, CcrMcpLockRecord>
}

export type CcrMcpInstallCandidateSourceType =
  | 'builtin-preset'
  | 'local-manifest'
  | 'remote-registry'

export type CcrMcpInstallCandidateState =
  | 'available'
  | 'configured'
  | 'installed'
  | 'duplicate-name'
  | 'invalid'

export type CcrMcpInstallCandidate = {
  candidateId: string
  sourceType: CcrMcpInstallCandidateSourceType
  sourceLabel: string
  originPath: string | null
  state: CcrMcpInstallCandidateState
  stateMessage: string
  duplicateGroupCount: number
  manifest: ReturnType<typeof summarizeCcrMcpInstallManifest>
  manifestInput: CcrMcpInstallManifest
  displayName: string
  description: string
  trusted: boolean
}

export type CcrMcpInstallCandidateError = {
  sourceType: CcrMcpInstallCandidateSourceType
  originPath: string | null
  message: string
}

const MCP_PACKAGE_OWNER_MARKER = '.ccr-mcp-install.json'

export async function searchCcrMcpInstallCandidates(input: {
  query?: string
} = {}): Promise<{
  query: string
  candidates: CcrMcpInstallCandidate[]
  errors: CcrMcpInstallCandidateError[]
  sources: Array<{
    sourceType: CcrMcpInstallCandidateSourceType
    sourceLabel: string
    originPath: string | null
    enabled: boolean
  }>
}> {
  const query = input.query?.trim().toLowerCase() ?? ''
  const presetCandidates = searchCcrMcpInstallPresets(input).candidates.map(
    candidate =>
      createInstallCandidate({
        sourceType: 'builtin-preset',
        sourceLabel: '内置 preset',
        originPath: null,
        manifest: candidate.manifestInput,
        displayName: candidate.displayName,
        description: candidate.description,
        trusted: candidate.trusted,
      }),
  )
  const localManifestResult = await loadLocalManifestCandidates()
  const registryCandidates: CcrMcpInstallCandidate[] = []

  const candidates = await applyInstallCandidateState(
    [...presetCandidates, ...localManifestResult.candidates, ...registryCandidates]
      .filter(candidate =>
        query
          ? getInstallCandidateSearchText(candidate).some(value =>
              value.toLowerCase().includes(query),
            )
          : true,
      )
      .sort(compareInstallCandidates),
  )

  return {
    query,
    candidates,
    errors: localManifestResult.errors,
    sources: [
      {
        sourceType: 'builtin-preset',
        sourceLabel: '内置 preset',
        originPath: null,
        enabled: true,
      },
      {
        sourceType: 'local-manifest',
        sourceLabel: '本地 manifest 目录',
        originPath: getLocalManifestDir(),
        enabled: true,
      },
      {
        sourceType: 'remote-registry',
        sourceLabel: '远端 registry',
        originPath: null,
        enabled: false,
      },
    ],
  }
}

export function createCcrMcpInstallPlan(
  input: CcrMcpInstallPlanInput,
): CcrMcpInstallPlan {
  const parsed = CcrMcpInstallPlanInputSchema.parse(input)
  const name = parsed.name ?? parsed.manifest.name
  const serverConfig = resolveServerConfig(parsed.manifest)
  const existingConfig = getMcpConfigByName(name)
  const existing =
    existingConfig && !parsed.force
      ? {
          configured: true,
          scope: existingConfig.scope ?? null,
          message: `MCP server "${name}" already exists in scope "${existingConfig.scope}".`,
        }
      : undefined
  const installable = !existing
  const paths = getCcrMcpInstallPaths()
  const configWritePath = getConfigWritePath(parsed.scope)
  const packageDir = getReservedPackageDir(parsed.manifest)
  const security = summarizeInstallSecurity({
    manifest: parsed.manifest,
    packageDir,
    scope: parsed.scope,
    serverConfig,
  })
  const writes: CcrMcpInstallPlan['writes'] = [
    {
      kind: 'config',
      path: configWritePath ?? '(project-local settings)',
      mode: 'write',
    },
    {
      kind: 'installed-manifest',
      path: paths.installedManifestPath,
      mode: 'record',
    },
    {
      kind: 'lockfile',
      path: paths.lockFilePath,
      mode: 'record',
    },
  ]

  if (packageDir) {
    writes.push({
      kind: 'package-cache',
      path: packageDir,
      mode: 'reserve',
    })
  }

  const planSeed = {
    schemaVersion: 1,
    name,
    scope: parsed.scope,
    force: parsed.force,
    installable,
    existing,
    manifest: parsed.manifest,
    serverConfig,
    writes,
    security,
  }
  const token = hashJson(planSeed)

  return {
    schemaVersion: 1,
    planId: `mcp-install:${name}:${parsed.scope}:${token.slice(0, 12)}`,
    name,
    scope: parsed.scope,
    force: parsed.force,
    installable,
    ...(existing && { existing }),
    manifest: summarizeCcrMcpInstallManifest(parsed.manifest),
    serverConfigPreview: summarizeServerConfigForPlan(serverConfig),
    writes,
    risks: getInstallRisks({
      manifest: parsed.manifest,
      scope: parsed.scope,
      security,
      serverConfig,
    }),
    security,
    requiresConfirmation: true,
    confirmation: {
      token: installable ? token : '',
      message: installable
        ? 'MCP install writes configuration and may make a new stdio or network tool available. User confirmation is required before applying this plan.'
        : existing!.message,
    },
  }
}

export async function applyCcrMcpInstallPlan(input: {
  name?: string
  scope?: CcrMcpWritableScope
  manifest: CcrMcpInstallManifestInput
  force?: boolean
  confirmed: boolean
  confirmationToken: string
}): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new Error('MCP install requires explicit user confirmation.')
  }

  const manifest = createCcrMcpInstallManifest(input.manifest)
  const plan = createCcrMcpInstallPlan({
    name: input.name,
    scope: input.scope ?? 'user',
    manifest,
    force: input.force ?? false,
  })

  if (input.confirmationToken !== plan.confirmation.token) {
    throw new Error('MCP install confirmation token does not match the plan.')
  }

  assertInstallScopeWritable(plan)

  const existing = getMcpConfigByName(plan.name)
  if (existing && !plan.force) {
    throw new Error(
      `MCP server "${plan.name}" already exists. Pass force=true after reviewing the install plan.`,
    )
  }

  if (existing && plan.force && existing.scope !== plan.scope) {
    throw new Error(
      `MCP server "${plan.name}" already exists in scope "${existing.scope}". Install force can only replace the selected scope "${plan.scope}".`,
    )
  }

  const serverConfig = resolveServerConfig(manifest)
  const replacedConfig =
    existing && plan.force ? stripScopedMcpConfig(existing) : null
  let wroteConfig = false
  try {
    if (existing && plan.force) {
      await updateMcpConfig(plan.name, serverConfig, plan.scope)
    } else {
      await addMcpConfig(plan.name, serverConfig, plan.scope)
    }
    wroteConfig = true

    const record = await recordInstalledMcp({
      plan,
      manifest,
      serverConfig,
    })
    return {
      installed: true,
      plan,
      record: summarizeInstalledRecord(record),
      test: {
        name: plan.name,
        ok: true,
        state: 'configured',
        networkChecked: false,
      },
      inventory: summarizeCcrMcpConfigInventory(collectCcrMcpConfigInventory()),
    }
  } catch (error) {
    if (wroteConfig) {
      if (replacedConfig) {
        await updateMcpConfig(plan.name, replacedConfig, plan.scope).catch(() => {})
      } else {
        await removeMcpConfig(plan.name, plan.scope).catch(() => {})
      }
    }
    throw error
  }
}

export async function listCcrMcpInstalledServers(): Promise<
  Record<string, unknown>
> {
  const index = await readInstalledIndex()
  const installed = Object.values(index.installed).map(summarizeInstalledRecord)
  return {
    installed,
    statusSummary: summarizeInstalledConfigStatuses(installed),
    installPaths: getCcrMcpInstallPaths(),
  }
}

export async function createCcrMcpAdoptPlan(input: {
  name: string
}): Promise<CcrMcpAdoptPlan> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('MCP adopt requires a server name.')
  }
  const config = getMcpConfigByName(name)
  if (!config) {
    throw new Error(`MCP server "${name}" was not found.`)
  }
  const scope = parseAdoptableScope(config.scope)
  const serverConfig = stripScopedMcpConfig(config)
  const manifest = createManifestFromConfig({
    name,
    scope,
    configPath: getConfigWritePath(scope),
    serverConfig,
  })
  const index = await readInstalledIndex()
  const existingInstalled = Boolean(index.installed[name])
  const paths = getCcrMcpInstallPaths()
  const planSeed = {
    schemaVersion: 1,
    name,
    scope,
    manifest,
    serverConfig,
    existingInstalled,
  }
  const token = hashJson(planSeed)
  return {
    schemaVersion: 1,
    planId: `mcp-adopt:${name}:${scope}:${token.slice(0, 12)}`,
    name,
    scope,
    adoptable: !existingInstalled,
    existingInstalled,
    manifest: summarizeCcrMcpInstallManifest(manifest),
    manifestInput: manifest,
    serverConfigPreview: summarizeServerConfigForPlan(serverConfig),
    writes: [
      {
        kind: 'installed-manifest',
        path: paths.installedManifestPath,
        mode: 'record',
      },
      {
        kind: 'lockfile',
        path: paths.lockFilePath,
        mode: 'record',
      },
    ],
    risks: ['records_existing_config_as_installer_owned'],
    requiresConfirmation: true,
    confirmation: {
      token: existingInstalled ? '' : token,
      message: existingInstalled
        ? `MCP server "${name}" is already managed by CCR installer.`
        : 'MCP adopt records the current configuration as CCR managed without changing the existing MCP config.',
    },
  }
}

export async function applyCcrMcpAdoptPlan(input: {
  name: string
  confirmed: boolean
  confirmationToken: string
}): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new Error('MCP adopt requires explicit user confirmation.')
  }
  const plan = await createCcrMcpAdoptPlan({ name: input.name })
  if (!plan.adoptable) {
    throw new Error(`MCP server "${input.name}" is already managed by CCR installer.`)
  }
  if (input.confirmationToken !== plan.confirmation.token) {
    throw new Error('MCP adopt confirmation token does not match the plan.')
  }
  const serverConfig = getMcpConfigByName(plan.name)
  if (!serverConfig) {
    throw new Error(`MCP server "${plan.name}" was not found.`)
  }
  const record = await recordInstalledMcp({
    plan,
    manifest: plan.manifestInput,
    serverConfig: stripScopedMcpConfig(serverConfig),
  })
  return {
    adopted: true,
    plan,
    record: summarizeInstalledRecord(record),
    inventory: summarizeCcrMcpConfigInventory(collectCcrMcpConfigInventory()),
  }
}

export async function uninstallCcrMcpInstalledServer(input: {
  name: string
  confirmed: boolean
}): Promise<Record<string, unknown>> {
  if (!input.confirmed) {
    throw new Error('MCP uninstall requires explicit user confirmation.')
  }

  const index = await readInstalledIndex()
  const record = index.installed[input.name]
  if (!record) {
    throw new Error(`MCP server "${input.name}" is not owned by CCR installer.`)
  }

  let configRemoved = true
  let configRemovalReason: string | undefined
  try {
    await removeMcpConfig(record.name, record.scope)
  } catch (error) {
    if (!isMissingMcpConfigError(error)) {
      throw error
    }
    configRemoved = false
    configRemovalReason =
      error instanceof Error ? error.message : 'mcp_config_not_found'
  }
  const packageCleanup = await removeOwnedPackageDir(record)

  const { [input.name]: _removed, ...restInstalled } = index.installed
  await writeInstalledIndex({
    schemaVersion: 1,
    installed: restInstalled,
  })

  const lock = await readLockIndex()
  const { [record.lockKey]: _removedLock, ...restLocks } = lock.locks
  await writeLockIndex({
    schemaVersion: 1,
    locks: restLocks,
  })

  return {
    uninstalled: true,
    name: input.name,
    configRemoved,
    configRemovalReason,
    packageRemoved: packageCleanup.removed,
    packageRemovalReason: packageCleanup.reason,
    packageDir: packageCleanup.packageDir,
    inventory: summarizeCcrMcpConfigInventory(collectCcrMcpConfigInventory()),
  }
}

function resolveServerConfig(manifest: CcrMcpInstallManifest): McpServerConfig {
  if (manifest.serverConfig) {
    return McpServerConfigSchema().parse(manifest.serverConfig)
  }

  switch (manifest.source.kind) {
    case 'remote-url':
      if (manifest.transport === 'sse') {
        return {
          type: 'sse',
          url: manifest.source.url,
        }
      }
      return {
        type: 'http',
        url: manifest.source.url,
      }

    case 'stdio-npm-package': {
      const packageRef = manifest.version
        ? `${manifest.source.packageName}@${manifest.version}`
        : manifest.source.packageName
      const args = ['-y', packageRef, ...(manifest.entry?.args ?? [])]
      if (getPlatform() === 'windows') {
        return {
          type: 'stdio',
          command: 'cmd',
          args: ['/c', 'npx.cmd', ...args],
        }
      }
      return {
        type: 'stdio',
        command: 'npx',
        args,
      }
    }

    case 'local-directory':
      if (!manifest.entry) {
        throw new Error('local-directory MCP install requires an entry command.')
      }
      return {
        type: 'stdio',
        command: manifest.entry.command,
        args: manifest.entry.args,
      }

    case 'builtin-preset':
      {
        const preset = getCcrMcpInstallPreset(manifest.source.presetId)
        if (preset) {
          return McpServerConfigSchema().parse(
            preset.createServerConfig(manifest),
          )
        }
      }
      break
  }

  throw new Error(
    `MCP install source "${manifest.source.kind}" requires an explicit serverConfig.`,
  )
}

function getConfigWritePath(scope: CcrMcpWritableScope): string | null {
  const inventory = collectCcrMcpConfigInventory()
  return (
    inventory.sources.find(source => source.scope === scope && source.writable)
      ?.writePath ?? null
  )
}

function getReservedPackageDir(
  manifest: CcrMcpInstallManifest,
): string | null {
  if (manifest.source.kind !== 'stdio-npm-package') {
    return null
  }
  const paths = getCcrMcpInstallPaths()
  const version = manifest.version ?? 'unversioned'
  return join(
    paths.packageRootDir,
    sanitizePathPart(manifest.source.packageName),
    sanitizePathPart(version),
  )
}

function getInstallRisks(params: {
  manifest: CcrMcpInstallManifest
  scope: CcrMcpWritableScope
  security: CcrMcpInstallSecuritySummary
  serverConfig: McpServerConfig
}): string[] {
  const { manifest, scope, security, serverConfig } = params
  const risks = [
    `writes_${scope}_mcp_config`,
    'requires_user_confirmation',
  ]
  if (manifest.transport === 'stdio') {
    risks.push('starts_local_process')
  }
  if (manifest.permissions.some(permission => permission.kind === 'network')) {
    risks.push('may_access_network')
  }
  if (manifest.envSchema.some(env => env.secret)) {
    risks.push('requires_secret_environment')
  }
  if (manifest.source.kind === 'stdio-npm-package' && !security.version.pinned) {
    risks.push('unpinned_package_version')
  }
  if (
    manifest.source.kind === 'stdio-npm-package' &&
    security.checksum.requiredForDownload &&
    !security.checksum.declared
  ) {
    risks.push('checksum_missing_for_download')
  }
  if (security.projectTrustRequired) {
    risks.push('project_scope_requires_trust')
  }
  if (!security.scopeWritable) {
    risks.push('scope_not_writable')
  }
  if (security.enterpriseExclusive || security.pluginOnly) {
    risks.push('managed_policy_may_block')
  }
  if (manifest.dataBoundary === 'remote-service') {
    risks.push('remote_service_data_boundary')
  }
  if (hasOauthConfig(serverConfig)) {
    risks.push('oauth_credentials_redacted')
  }
  return risks
}

function summarizeInstallSecurity(params: {
  manifest: CcrMcpInstallManifest
  packageDir: string | null
  scope: CcrMcpWritableScope
  serverConfig: McpServerConfig
}): CcrMcpInstallSecuritySummary {
  const inventory = collectCcrMcpConfigInventory()
  const scopeWritable = inventory.sources.some(
    source => source.scope === params.scope && source.writable,
  )
  return {
    confirmationRequired: true,
    dataBoundary: params.manifest.dataBoundary,
    scope: params.scope,
    scopeWritable,
    projectTrustRequired: params.scope === 'project' || params.scope === 'local',
    enterpriseExclusive: inventory.enterpriseExclusive,
    pluginOnly: inventory.pluginOnly,
    packageCache: {
      packageRootDir: getCcrMcpInstallPaths().packageRootDir,
      packageDir: params.packageDir,
      ownerMarkerPath: params.packageDir
        ? getPackageOwnerMarkerPath(params.packageDir)
        : null,
      cleanupPolicy: params.packageDir
        ? 'owner-marker-required'
        : 'not-applicable',
    },
    checksum: {
      declared: Boolean(params.manifest.checksum),
      requiredForDownload: params.manifest.source.kind === 'stdio-npm-package',
      algorithm: params.manifest.checksum?.algorithm ?? null,
    },
    version: {
      value: params.manifest.version ?? null,
      pinned: isPinnedPackageVersion(params.manifest.version),
    },
    secrets: {
      env: params.manifest.envSchema.map(env => ({
        name: env.name,
        required: env.required,
        secret: env.secret,
      })),
      serverConfig: summarizeServerConfigSecrets(params.serverConfig),
    },
  }
}

async function recordInstalledMcp(params: {
  plan: Pick<CcrMcpInstallPlan, 'name' | 'scope'>
  manifest: CcrMcpInstallManifest
  serverConfig: McpServerConfig
}): Promise<CcrMcpInstalledRecord> {
  const now = new Date().toISOString()
  const index = await readInstalledIndex()
  const lock = await readLockIndex()
  const packageDir = getReservedPackageDir(params.manifest)
  const record: CcrMcpInstalledRecord = {
    schemaVersion: 1,
    name: params.plan.name,
    scope: params.plan.scope,
    installedAt: index.installed[params.plan.name]?.installedAt ?? now,
    updatedAt: now,
    manifest: params.manifest,
    serverConfig: params.serverConfig,
    configPath: getConfigWritePath(params.plan.scope),
    packageDir,
    packageOwnerMarkerPath: packageDir
      ? getPackageOwnerMarkerPath(packageDir)
      : null,
    lockKey: params.plan.name,
  }

  try {
    await reserveOwnedPackageDir(record)
    await writeInstalledIndex({
      schemaVersion: 1,
      installed: {
        ...index.installed,
        [params.plan.name]: record,
      },
    })
    await writeLockIndex({
      schemaVersion: 1,
      locks: {
        ...lock.locks,
        [record.lockKey]: {
          name: record.name,
          scope: record.scope,
          sourceKind: record.manifest.source.kind,
          version: record.manifest.version ?? null,
          transport: getCcrMcpInstallTransport(record.serverConfig),
          packageDir: record.packageDir,
          packageOwnerMarkerPath: record.packageOwnerMarkerPath,
          checksum: record.manifest.checksum ?? null,
          dataBoundary: record.manifest.dataBoundary,
          updatedAt: now,
        },
      },
    })
  } catch (error) {
    await writeInstalledIndex(index).catch(() => {})
    await writeLockIndex(lock).catch(() => {})
    await removeOwnedPackageDir(record).catch(() => {})
    throw error
  }
  return record
}

function assertInstallScopeWritable(plan: CcrMcpInstallPlan): void {
  if (plan.security.scopeWritable) {
    return
  }
  const policyReason = plan.security.enterpriseExclusive
    ? 'enterprise_exclusive'
    : plan.security.pluginOnly
      ? 'plugin_only_policy'
      : 'scope_not_writable'
  throw new Error(
    `MCP install scope "${plan.scope}" is not writable (${policyReason}).`,
  )
}

async function reserveOwnedPackageDir(
  record: CcrMcpInstalledRecord,
): Promise<void> {
  if (!record.packageDir) {
    return
  }
  assertPackageDirIsInstallerOwnedPath(record.packageDir)
  await mkdir(record.packageDir, { recursive: true })
  await writeFile(
    getPackageOwnerMarkerPath(record.packageDir),
    `${jsonStringify(createPackageOwnerMarker(record), null, 2)}\n`,
    'utf8',
  )
}

async function removeOwnedPackageDir(record: CcrMcpInstalledRecord): Promise<{
  removed: boolean
  reason: string
  packageDir: string | null
}> {
  if (!record.packageDir) {
    return {
      removed: false,
      reason: 'no_package_dir',
      packageDir: null,
    }
  }

  try {
    assertPackageDirIsInstallerOwnedPath(record.packageDir)
  } catch (error) {
    return {
      removed: false,
      reason: error instanceof Error ? error.message : 'unsafe_package_dir',
      packageDir: record.packageDir,
    }
  }

  const marker = await readPackageOwnerMarker(record.packageDir)
  if (!isMatchingPackageOwnerMarker(marker, record)) {
    return {
      removed: false,
      reason: 'owner_marker_missing_or_mismatched',
      packageDir: record.packageDir,
    }
  }

  await rm(record.packageDir, { recursive: true, force: true })
  return {
    removed: true,
    reason: 'owner_marker_verified',
    packageDir: record.packageDir,
  }
}

function getPackageOwnerMarkerPath(packageDir: string): string {
  return join(packageDir, MCP_PACKAGE_OWNER_MARKER)
}

function createPackageOwnerMarker(record: CcrMcpInstalledRecord): Record<string, unknown> {
  return {
    schemaVersion: 1,
    name: record.name,
    lockKey: record.lockKey,
    sourceKind: record.manifest.source.kind,
    packageDir: record.packageDir,
    dataBoundary: record.manifest.dataBoundary,
    updatedAt: record.updatedAt,
  }
}

function stripScopedMcpConfig(config: McpServerConfig): McpServerConfig {
  const {
    scope: _scope,
    pluginSource: _pluginSource,
    ...rest
  } = config as McpServerConfig & {
    scope?: unknown
    pluginSource?: unknown
  }
  return rest as McpServerConfig
}

function parseAdoptableScope(scope: unknown): CcrMcpWritableScope {
  const parsed = CcrMcpWritableScopeSchema.safeParse(scope)
  if (!parsed.success) {
    throw new Error(`MCP server scope is not adoptable: ${String(scope)}`)
  }
  return parsed.data
}

function createManifestFromConfig(params: {
  name: string
  scope: CcrMcpWritableScope
  configPath: string | null
  serverConfig: McpServerConfig
}): CcrMcpInstallManifest {
  const { name, scope, configPath, serverConfig } = params
  if ('url' in serverConfig) {
    const transport = getCcrMcpInstallTransport(serverConfig)
    return createCcrMcpInstallManifest({
      name,
      displayName: name,
      description: '由现有 MCP 配置接管生成。',
      source: {
        kind: 'remote-url',
        url: serverConfig.url,
        headersRequired: Boolean(
          'headers' in serverConfig && serverConfig.headers,
        ),
      },
      transport,
      serverConfig,
      permissions: [
        {
          kind: 'network',
          required: true,
          description: '连接现有 MCP URL。',
        },
      ],
      dataBoundary: isLocalMcpUrl(serverConfig.url)
        ? 'local-only'
        : 'remote-service',
    })
  }

  if ('command' in serverConfig) {
    return createCcrMcpInstallManifest({
      name,
      displayName: name,
      description: '由现有 stdio MCP 配置接管生成。',
      source: {
        kind: 'manual-config',
        scope,
        configPath,
      },
      transport: 'stdio',
      serverConfig,
      entry: {
        command: serverConfig.command,
        args: serverConfig.args ?? [],
      },
      envSchema: Object.keys(serverConfig.env ?? {}).map(key => ({
        name: key,
        required: true,
        secret: /(?:TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL)/i.test(key),
      })),
      permissions: [
        {
          kind: 'process',
          required: true,
          description: '启动现有 MCP stdio 进程。',
        },
      ],
      dataBoundary: 'unknown',
    })
  }

  return createCcrMcpInstallManifest({
    name,
    displayName: name,
    description: '由现有 MCP 配置接管生成。',
    source: {
      kind: 'manual-config',
      scope,
      configPath,
    },
    transport: getCcrMcpInstallTransport(serverConfig),
    serverConfig,
    permissions: [],
    dataBoundary: 'unknown',
  })
}

function isLocalMcpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function isMissingMcpConfigError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('No ') &&
    error.message.includes('MCP server')
  )
}

async function readPackageOwnerMarker(
  packageDir: string,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(getPackageOwnerMarkerPath(packageDir), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function isMatchingPackageOwnerMarker(
  marker: Record<string, unknown> | null,
  record: CcrMcpInstalledRecord,
): boolean {
  return (
    marker?.schemaVersion === 1 &&
    marker.name === record.name &&
    marker.lockKey === record.lockKey &&
    marker.packageDir === record.packageDir
  )
}

function assertPackageDirIsInstallerOwnedPath(packageDir: string): void {
  const root = resolve(getCcrMcpInstallPaths().packageRootDir)
  const target = resolve(packageDir)
  const childPath = relative(root, target)
  if (!childPath || childPath.startsWith('..') || isAbsolute(childPath)) {
    throw new Error('unsafe_package_dir_outside_mcp_cache')
  }
}

async function readInstalledIndex(): Promise<CcrMcpInstalledIndex> {
  return readJsonFile(getCcrMcpInstallPaths().installedManifestPath, {
    schemaVersion: 1,
    installed: {},
  })
}

async function writeInstalledIndex(index: CcrMcpInstalledIndex): Promise<void> {
  await writeJsonFile(getCcrMcpInstallPaths().installedManifestPath, index)
}

async function readLockIndex(): Promise<CcrMcpLockIndex> {
  return readJsonFile(getCcrMcpInstallPaths().lockFilePath, {
    schemaVersion: 1,
    locks: {},
  })
}

async function writeLockIndex(index: CcrMcpLockIndex): Promise<void> {
  await writeJsonFile(getCcrMcpInstallPaths().lockFilePath, index)
}

function getLocalManifestDir(): string {
  return join(dirname(getCcrMcpInstallPaths().installedManifestPath), 'manifests')
}

function createInstallCandidate(input: {
  sourceType: CcrMcpInstallCandidateSourceType
  sourceLabel: string
  originPath: string | null
  manifest: CcrMcpInstallManifest
  displayName?: string
  description?: string
  trusted: boolean
}): CcrMcpInstallCandidate {
  const manifest = summarizeCcrMcpInstallManifest(input.manifest)
  return {
    candidateId: `${input.sourceType}:${input.originPath ?? input.manifest.name}`,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel,
    originPath: input.originPath,
    state: 'available',
    stateMessage: '可安装',
    duplicateGroupCount: 1,
    manifest,
    manifestInput: input.manifest,
    displayName: input.displayName ?? input.manifest.displayName ?? input.manifest.name,
    description: input.description ?? input.manifest.description ?? '',
    trusted: input.trusted,
  }
}

async function loadLocalManifestCandidates(): Promise<{
  candidates: CcrMcpInstallCandidate[]
  errors: CcrMcpInstallCandidateError[]
}> {
  const manifestDir = getLocalManifestDir()
  let entries: string[]
  try {
    entries = await readdir(manifestDir)
  } catch (error) {
    if (isNotFoundError(error)) {
      return { candidates: [], errors: [] }
    }
    return {
      candidates: [],
      errors: [
        {
          sourceType: 'local-manifest',
          originPath: manifestDir,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    }
  }

  const candidates: CcrMcpInstallCandidate[] = []
  const errors: CcrMcpInstallCandidateError[] = []
  for (const entry of entries.filter(name => name.toLowerCase().endsWith('.json'))) {
    const originPath = join(manifestDir, entry)
    try {
      const raw = await readFile(originPath, 'utf8')
      const manifest = createCcrMcpInstallManifest(JSON.parse(raw) as CcrMcpInstallManifestInput)
      candidates.push(
        createInstallCandidate({
          sourceType: 'local-manifest',
          sourceLabel: '本地 manifest',
          originPath,
          manifest,
          trusted: false,
        }),
      )
    } catch (error) {
      errors.push({
        sourceType: 'local-manifest',
        originPath,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { candidates, errors }
}

async function applyInstallCandidateState(
  candidates: CcrMcpInstallCandidate[],
): Promise<CcrMcpInstallCandidate[]> {
  const installedIndex = await readInstalledIndex()
  const counts = new Map<string, number>()
  for (const candidate of candidates) {
    counts.set(candidate.manifest.name, (counts.get(candidate.manifest.name) ?? 0) + 1)
  }

  return candidates.map(candidate => {
    const duplicateGroupCount = counts.get(candidate.manifest.name) ?? 1
    if (installedIndex.installed[candidate.manifest.name]) {
      return {
        ...candidate,
        duplicateGroupCount,
        state: 'installed' as const,
        stateMessage: '已由 CCR 安装',
      }
    }
    const configured = getMcpConfigByName(candidate.manifest.name)
    if (configured) {
      return {
        ...candidate,
        duplicateGroupCount,
        state: 'configured' as const,
        stateMessage: `已配置于 ${String(configured.scope ?? 'unknown')}`,
      }
    }
    if (duplicateGroupCount > 1) {
      return {
        ...candidate,
        duplicateGroupCount,
        state: 'duplicate-name' as const,
        stateMessage: `存在 ${duplicateGroupCount} 个同名候选，请确认来源`,
      }
    }
    return {
      ...candidate,
      duplicateGroupCount,
      state: 'available' as const,
      stateMessage: '可安装',
    }
  })
}

function compareInstallCandidates(
  left: CcrMcpInstallCandidate,
  right: CcrMcpInstallCandidate,
): number {
  const stateWeight: Record<CcrMcpInstallCandidateState, number> = {
    available: 0,
    'duplicate-name': 1,
    configured: 2,
    installed: 3,
    invalid: 4,
  }
  const sourceWeight: Record<CcrMcpInstallCandidateSourceType, number> = {
    'builtin-preset': 0,
    'local-manifest': 1,
    'remote-registry': 2,
  }
  return (
    stateWeight[left.state] - stateWeight[right.state] ||
    sourceWeight[left.sourceType] - sourceWeight[right.sourceType] ||
    left.displayName.localeCompare(right.displayName)
  )
}

function getInstallCandidateSearchText(
  candidate: CcrMcpInstallCandidate,
): string[] {
  return [
    candidate.manifest.name,
    candidate.displayName,
    candidate.description,
    candidate.sourceType,
    candidate.sourceLabel,
    candidate.originPath ?? '',
    candidate.manifestInput.source.kind === 'stdio-npm-package'
      ? candidate.manifestInput.source.packageName
      : '',
    candidate.manifestInput.source.kind === 'remote-url'
      ? candidate.manifestInput.source.url
      : '',
  ].filter(Boolean)
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`
  await writeFile(tmp, `${jsonStringify(value, null, 2)}\n`, 'utf8')
  await rename(tmp, filePath)
}

function summarizeInstalledRecord(
  record: CcrMcpInstalledRecord,
): Record<string, unknown> {
  const configStatus = summarizeInstalledConfigStatus(record)
  return {
    name: record.name,
    scope: record.scope,
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
    manifest: summarizeCcrMcpInstallManifest(record.manifest),
    serverConfigPreview: summarizeServerConfigForPlan(record.serverConfig),
    configPath: record.configPath,
    packageDir: record.packageDir,
    packageOwnerMarkerPath:
      record.packageOwnerMarkerPath ??
      (record.packageDir ? getPackageOwnerMarkerPath(record.packageDir) : null),
    lockKey: record.lockKey,
    configStatus,
  }
}

function summarizeInstalledConfigStatus(
  record: CcrMcpInstalledRecord,
): Record<string, unknown> & { state: CcrMcpInstallConfigStatus } {
  const expectedConfig = record.serverConfig
  const expectedConfigHash = hashMcpServerConfig(expectedConfig)
  const currentConfig = getMcpConfigByName(record.name)

  if (!currentConfig) {
    return {
      state: 'missing-config',
      needsRepair: true,
      configured: false,
      drifted: false,
      expectedConfigHash,
      currentConfigHash: null,
      configScope: null,
      scopeMatches: false,
      message:
        'CCR installer record exists, but the MCP server config is missing.',
    }
  }

  const currentConfigHash = hashMcpServerConfig(currentConfig)
  const currentScope =
    'scope' in currentConfig ? String(currentConfig.scope) : null
  const scopeMatches = currentScope === record.scope
  const contentMatches = currentConfigHash === expectedConfigHash
  const state: CcrMcpInstallConfigStatus =
    contentMatches && scopeMatches ? 'configured' : 'drifted'

  return {
    state,
    needsRepair: state !== 'configured',
    configured: state === 'configured',
    drifted: state === 'drifted',
    expectedConfigHash,
    currentConfigHash,
    configScope: currentScope,
    scopeMatches,
    expectedConfigPreview: summarizeServerConfigForPlan(expectedConfig),
    currentConfigPreview: summarizeServerConfigForPlan(currentConfig),
    message:
      state === 'configured'
        ? 'Current MCP config matches the CCR install record.'
        : 'Current MCP config differs from the CCR install record.',
  }
}

function summarizeInstalledConfigStatuses(
  installed: Record<string, unknown>[],
): Record<string, number> {
  const summary: Record<string, number> = {
    configured: 0,
    drifted: 0,
    'missing-config': 0,
  }
  for (const record of installed) {
    const status = record.configStatus
    if (status && typeof status === 'object' && 'state' in status) {
      const state = String(status.state)
      summary[state] = (summary[state] ?? 0) + 1
    }
  }
  return summary
}

function summarizeServerConfigForPlan(
  config: McpServerConfig,
): Record<string, unknown> {
  if ('url' in config) {
    return {
      type: config.type,
      url: config.url,
      ...('headers' in config && config.headers
        ? { headers: redactRecord(config.headers) }
        : {}),
      ...('headersHelper' in config && config.headersHelper
        ? { headersHelper: config.headersHelper }
        : {}),
      ...('oauth' in config && config.oauth
        ? { oauth: summarizeOauth(config.oauth) }
        : {}),
    }
  }

  if ('command' in config) {
    return {
      type: config.type ?? 'stdio',
      command: config.command,
      args: config.args ?? [],
      ...(config.env ? { env: redactRecord(config.env) } : {}),
    }
  }

  if (config.type === 'sdk') {
    return {
      type: config.type,
      name: config.name,
    }
  }

  return {
    type: 'unknown',
  }
}

function summarizeOauth(
  oauth: Extract<McpServerConfig, { oauth?: unknown }>['oauth'],
): Record<string, unknown> {
  if (!oauth) {
    return {}
  }
  return {
    ...(oauth.clientId ? { clientId: oauth.clientId } : {}),
    ...(oauth.callbackPort ? { callbackPort: oauth.callbackPort } : {}),
    ...(oauth.authServerMetadataUrl
      ? { authServerMetadataUrl: oauth.authServerMetadataUrl }
      : {}),
    ...(oauth.xaa !== undefined ? { xaa: oauth.xaa } : {}),
  }
}

function summarizeServerConfigSecrets(config: McpServerConfig): {
  envSecretKeys: string[]
  headerSecretKeys: string[]
  oauth: boolean
  headersHelper: boolean
} {
  return {
    envSecretKeys:
      'env' in config && config.env
        ? Object.keys(config.env).filter(isSecretKey)
        : [],
    headerSecretKeys:
      'headers' in config && config.headers
        ? Object.keys(config.headers).filter(isSecretKey)
        : [],
    oauth: hasOauthConfig(config),
    headersHelper: 'headersHelper' in config && Boolean(config.headersHelper),
  }
}

function hasOauthConfig(config: McpServerConfig): boolean {
  return 'oauth' in config && Boolean(config.oauth)
}

function isPinnedPackageVersion(version: string | undefined): boolean {
  return Boolean(
    version &&
      version !== 'latest' &&
      !version.startsWith('^') &&
      !version.startsWith('~') &&
      !/[x*]/i.test(version),
  )
}

function redactRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      isSecretKey(key) ? '<redacted>' : value,
    ]),
  )
}

function isSecretKey(key: string): boolean {
  return /^(access|accessToken|refresh|refreshToken|apiKey|api_key|authorization|cookie|password|clientSecret|client_secret)$/i.test(
    key,
  )
}

function hashJson(value: unknown): string {
  return createHash('sha256')
    .update(jsonStringify(value))
    .digest('hex')
}

function hashMcpServerConfig(config: McpServerConfig): string {
  return hashJson(stripScopedMcpConfig(config))
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_')
}
