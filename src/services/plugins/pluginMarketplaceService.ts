import isEqual from 'lodash-es/isEqual.js'
import { rm } from 'node:fs/promises'
import { isAbsolute, resolve, sep } from 'node:path'
import {
  formatSourceForDisplay,
  isSourceAllowedByPolicyConfiguration,
  isSourceInConfiguredBlocklist,
} from '../../utils/plugins/marketplaceHelpers.js'
import {
  materializeMarketplaceSource,
} from '../../utils/plugins/marketplaceManager.js'
import {
  isLocalMarketplaceSource,
  KnownMarketplacesFileSchema,
  MarketplaceSourceSchema,
  validateOfficialNameSource,
  type KnownMarketplacesFile,
  type MarketplaceSource,
} from '../../utils/plugins/schemas.js'
import type { PluginDomainSession } from './pluginDomainSession.js'
import type {
  PluginConfigurationScope,
  PluginMarketplaceSnapshot,
} from './pluginDomainTypes.js'
import {
  acquirePluginScopeLock,
  atomicWriteJson,
  readJsonOrNull,
} from './pluginPersistence.js'

export type PluginMarketplaceMutationResult = {
  name: string
  action: 'add' | 'remove' | 'refresh'
  source?: MarketplaceSource
  installLocation?: string
  alreadyPresent?: boolean
}

export class PluginMarketplaceService {
  async list(session: PluginDomainSession): Promise<PluginMarketplaceSnapshot> {
    return session.marketplaces.read()
  }

  async add(
    session: PluginDomainSession,
    input: {
      source: MarketplaceSource
      scope: PluginConfigurationScope
    },
  ): Promise<PluginMarketplaceMutationResult> {
    const source = normalizeSource(input.source, session.context.currentCwd)
    assertMaterializableSource(source)
    await assertSourceAllowed(session, source)
    const lock = await acquirePluginScopeLock(session, {
      operationId: `marketplace-add:${session.context.requestId}`,
      scope: 'marketplace-source',
      workspaceRoot: session.context.workspaceRoot,
    })
    try {
      const known = await readKnownMarketplaces(session)
      const existing = Object.entries(known).find(([, entry]) =>
        isEqual(entry.source, source),
      )
      if (existing) {
        await writeMarketplaceIntent(
          session,
          input.scope,
          existing[0],
          existing[1].source,
          existing[1].installLocation,
        )
        return {
          name: existing[0],
          action: 'add',
          source: existing[1].source,
          installLocation: existing[1].installLocation,
          alreadyPresent: true,
        }
      }

      const materialized = await materializeMarketplaceSource(source, {
        cacheDir: session.paths.marketplacesCacheDir,
      })
      const sourceValidationError = validateOfficialNameSource(
        materialized.marketplace.name,
        source,
      )
      if (sourceValidationError) throw marketplaceError(
        'plugin-marketplace-source-invalid',
        sourceValidationError,
      )
      if (known[materialized.marketplace.name]) {
        throw marketplaceError(
          'plugin-marketplace-name-conflict',
          `Marketplace ${materialized.marketplace.name} 已存在，不能用另一来源静默覆盖。`,
        )
      }
      known[materialized.marketplace.name] = {
        source,
        installLocation: materialized.cachePath,
        lastUpdated: new Date().toISOString(),
      }
      await atomicWriteJson(session.paths.knownMarketplacesPath, known)
      await writeMarketplaceIntent(
        session,
        input.scope,
        materialized.marketplace.name,
        source,
        materialized.cachePath,
      )
      return {
        name: materialized.marketplace.name,
        action: 'add',
        source,
        installLocation: materialized.cachePath,
        alreadyPresent: false,
      }
    } finally {
      await lock.release()
    }
  }

  async remove(
    session: PluginDomainSession,
    input: { name: string; confirmed: boolean },
  ): Promise<PluginMarketplaceMutationResult> {
    if (!input.confirmed) {
      throw marketplaceError(
        'plugin-marketplace-confirmation-required',
        '删除 Marketplace 来源需要明确确认。',
      )
    }
    const lock = await acquirePluginScopeLock(session, {
      operationId: `marketplace-remove:${session.context.requestId}`,
      scope: 'marketplace-source',
      workspaceRoot: session.context.workspaceRoot,
    })
    try {
      const known = await readKnownMarketplaces(session)
      const entry = known[input.name]
      if (!entry) {
        throw marketplaceError(
          'plugin-marketplace-not-found',
          `Marketplace ${input.name} 不存在。`,
        )
      }
      const managedCachePath = resolveManagedCachePath(
        session,
        entry.source,
        entry.installLocation,
      )
      delete known[input.name]
      await atomicWriteJson(session.paths.knownMarketplacesPath, known)
      await removeMarketplaceIntent(session, input.name)
      if (managedCachePath) {
        await rm(managedCachePath, { recursive: true, force: true })
      }
      return {
        name: input.name,
        action: 'remove',
        source: entry.source,
        installLocation: entry.installLocation,
      }
    } finally {
      await lock.release()
    }
  }

  async refresh(
    session: PluginDomainSession,
    name: string,
  ): Promise<PluginMarketplaceMutationResult> {
    const lock = await acquirePluginScopeLock(session, {
      operationId: `marketplace-refresh:${session.context.requestId}`,
      scope: 'marketplace-source',
      workspaceRoot: session.context.workspaceRoot,
    })
    try {
      const known = await readKnownMarketplaces(session)
      const entry = known[name]
      if (!entry) {
        throw marketplaceError(
          'plugin-marketplace-not-found',
          `Marketplace ${name} 不存在。`,
        )
      }
      await assertSourceAllowed(session, entry.source)
      const materialized = await materializeMarketplaceSource(entry.source, {
        cacheDir: session.paths.marketplacesCacheDir,
      })
      if (materialized.marketplace.name !== name) {
        throw marketplaceError(
          'plugin-marketplace-name-changed',
          `Marketplace 刷新后名称从 ${name} 变为 ${materialized.marketplace.name}，已拒绝覆盖原记录。`,
        )
      }
      known[name] = {
        ...entry,
        installLocation: materialized.cachePath,
        lastUpdated: new Date().toISOString(),
      }
      await atomicWriteJson(session.paths.knownMarketplacesPath, known)
      return {
        name,
        action: 'refresh',
        source: entry.source,
        installLocation: materialized.cachePath,
      }
    } finally {
      await lock.release()
    }
  }
}

async function readKnownMarketplaces(
  session: PluginDomainSession,
): Promise<KnownMarketplacesFile> {
  const raw = await readJsonOrNull<unknown>(
    session.paths.knownMarketplacesPath,
  )
  return KnownMarketplacesFileSchema().parse(raw ?? {})
}

function normalizeSource(
  input: MarketplaceSource,
  currentCwd: string,
): MarketplaceSource {
  const parsed = MarketplaceSourceSchema().parse(input)
  if (
    isLocalMarketplaceSource(parsed) &&
    !isAbsolute(parsed.path)
  ) {
    return { ...parsed, path: resolve(currentCwd, parsed.path) }
  }
  return parsed
}

function assertMaterializableSource(source: MarketplaceSource): void {
  if (source.source === 'hostPattern' || source.source === 'pathPattern') {
    throw marketplaceError(
      'plugin-marketplace-policy-pattern-not-source',
      `${source.source} 只能用于企业策略，不能作为可安装 Marketplace 来源。`,
    )
  }
  if (source.source === 'npm') {
    throw marketplaceError(
      'plugin-marketplace-source-unsupported',
      '当前 Marketplace 物化器尚不支持 npm 来源。',
    )
  }
}

async function assertSourceAllowed(
  session: PluginDomainSession,
  source: MarketplaceSource,
): Promise<void> {
  const managed =
    (await readJsonOrNull<Record<string, unknown>>(
      session.paths.managedSettingsPath,
    )) ?? {}
  const allowlist = parsePolicySources(
    managed.strictKnownMarketplaces,
    'strictKnownMarketplaces',
  )
  const blocklist = parsePolicySources(
    managed.blockedMarketplaces,
    'blockedMarketplaces',
  )
  if (isSourceAllowedByPolicyConfiguration(source, allowlist, blocklist)) return
  const reason = isSourceInConfiguredBlocklist(source, blocklist)
    ? '被企业 blocklist 明确禁止'
    : '不在企业 allowlist 中'
  throw marketplaceError(
    'plugin-marketplace-policy-blocked',
    `Marketplace 来源 ${formatSourceForDisplay(source)} ${reason}。`,
  )
}

function parsePolicySources(
  value: unknown,
  field: string,
): MarketplaceSource[] | null {
  if (value === undefined) return null
  const parsed = MarketplaceSourceSchema().array().safeParse(value)
  if (!parsed.success) {
    throw marketplaceError(
      'plugin-marketplace-policy-invalid',
      `受管理设置 ${field} 无效：${parsed.error.message}`,
    )
  }
  return parsed.data
}

async function writeMarketplaceIntent(
  session: PluginDomainSession,
  scope: PluginConfigurationScope,
  name: string,
  source: MarketplaceSource,
  installLocation: string,
): Promise<void> {
  const path = settingsPathForScope(session, scope)
  const settings =
    (await readJsonOrNull<Record<string, unknown>>(path)) ?? {}
  const current = asRecord(settings.extraKnownMarketplaces)
  await atomicWriteJson(path, {
    ...settings,
    extraKnownMarketplaces: {
      ...current,
      [name]: { source, installLocation },
    },
  })
}

async function removeMarketplaceIntent(
  session: PluginDomainSession,
  name: string,
): Promise<void> {
  for (const path of [
    session.paths.userSettingsPath,
    session.paths.projectSettingsPath,
    session.paths.localSettingsPath,
  ]) {
    const settings = await readJsonOrNull<Record<string, unknown>>(path)
    if (!settings) continue
    const current = asRecord(settings.extraKnownMarketplaces)
    if (!(name in current)) continue
    const next = { ...current }
    delete next[name]
    const updated = { ...settings }
    if (Object.keys(next).length > 0) {
      updated.extraKnownMarketplaces = next
    } else {
      delete updated.extraKnownMarketplaces
    }
    await atomicWriteJson(path, updated)
  }
}

function resolveManagedCachePath(
  session: PluginDomainSession,
  source: MarketplaceSource,
  installLocation: string,
): string | null {
  if (isLocalMarketplaceSource(source)) return null
  const cacheRoot = resolve(session.paths.marketplacesCacheDir)
  const target = resolve(installLocation)
  if (target !== cacheRoot && !target.startsWith(`${cacheRoot}${sep}`)) {
    throw marketplaceError(
      'plugin-marketplace-cache-outside-root',
      `Marketplace 缓存路径不在请求级缓存目录内，已保留文件：${installLocation}`,
    )
  }
  return target
}

function settingsPathForScope(
  session: PluginDomainSession,
  scope: PluginConfigurationScope,
): string {
  switch (scope) {
    case 'user':
      return session.paths.userSettingsPath
    case 'project':
      return session.paths.projectSettingsPath
    case 'local':
      return session.paths.localSettingsPath
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function marketplaceError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}
