import type {
  ExtensionCapability,
  ExtensionCapabilityCatalog,
  ExtensionCapabilityCatalogSummary,
  ExtensionCapabilityDiagnostic,
  ExtensionCapabilityKind,
  ExtensionCapabilitySourceKind,
  ExtensionCapabilityStatus,
} from './capabilityTypes.js'

export type ExtensionCapabilityProviderContext = Record<string, unknown>

export type ExtensionCapabilityProvider = {
  id: string
  listCapabilities(
    context: ExtensionCapabilityProviderContext,
  ): Promise<readonly ExtensionCapability[]> | readonly ExtensionCapability[]
}

export type ExtensionCapabilityCatalogInput = {
  providers: readonly ExtensionCapabilityProvider[]
  context?: ExtensionCapabilityProviderContext
}

export async function createExtensionCapabilityCatalog(
  input: ExtensionCapabilityCatalogInput,
): Promise<ExtensionCapabilityCatalog> {
  const providerResults = await Promise.all(
    input.providers.map(provider =>
      Promise.resolve(provider.listCapabilities(input.context ?? {})),
    ),
  )
  return buildExtensionCapabilityCatalog(providerResults.flat())
}

export function buildExtensionCapabilityCatalog(
  capabilities: readonly ExtensionCapability[],
): ExtensionCapabilityCatalog {
  const normalized = capabilities.map(cloneCapability)
  const diagnostics: ExtensionCapabilityDiagnostic[] = []
  const visibleByName = new Map<string, ExtensionCapability>()

  for (const capability of normalized.sort(compareCapabilities)) {
    if (!capability.state.runtimeVisible) {
      continue
    }
    const key = capability.name.toLowerCase()
    const existing = visibleByName.get(key)
    if (!existing) {
      visibleByName.set(key, capability)
      continue
    }
    const diagnostic: ExtensionCapabilityDiagnostic = {
      kind: 'conflict',
      severity: 'warning',
      code: 'duplicate-runtime-name',
      message: `Capability '${capability.name}' from ${capability.source.label} was hidden because ${existing.source.label} already provides the same runtime name.`,
    }
    capability.state.runtimeVisible = false
    capability.state.available = false
    capability.state.status = 'hidden-by-conflict'
    capability.diagnostics.push(diagnostic)
    diagnostics.push(diagnostic)
  }

  const sorted = normalized.sort(compareCapabilities)
  return {
    schemaVersion: 1,
    capabilities: sorted,
    runtimeVisible: sorted.filter(capability => capability.state.runtimeVisible),
    diagnostics,
    summary: summarizeCapabilities(sorted),
  }
}

export function summarizeCapabilities(
  capabilities: readonly ExtensionCapability[],
): ExtensionCapabilityCatalogSummary {
  const byKind = createCounter<ExtensionCapabilityKind>([
    'skill',
    'mcp-server',
    'mcp-tool',
    'tool',
    'command',
    'plugin',
  ])
  const bySourceKind = createCounter<ExtensionCapabilitySourceKind>([
    'managed-skill',
    'user-skill',
    'project-skill',
    'plugin',
    'bundled',
    'dynamic',
    'mcp',
    'provider',
    'builtin',
    'legacy',
    'unknown',
  ])
  const byStatus = createCounter<ExtensionCapabilityStatus>([
    'available',
    'enabled',
    'disabled',
    'unavailable',
    'needs-auth',
    'failed',
    'missing',
    'drifted',
    'invalid',
    'hidden-by-conflict',
  ])

  for (const capability of capabilities) {
    byKind[capability.kind] += 1
    bySourceKind[capability.source.kind] += 1
    byStatus[capability.state.status] += 1
  }

  return {
    total: capabilities.length,
    runtimeVisible: capabilities.filter(capability => capability.state.runtimeVisible)
      .length,
    byKind,
    bySourceKind,
    byStatus,
  }
}

function compareCapabilities(
  a: ExtensionCapability,
  b: ExtensionCapability,
): number {
  const runtimeDiff =
    Number(b.state.runtimeVisible) - Number(a.state.runtimeVisible)
  if (runtimeDiff !== 0) return runtimeDiff
  const nameDiff = a.name.localeCompare(b.name)
  if (nameDiff !== 0) return nameDiff
  const rankDiff = sourceRank(a.source.kind) - sourceRank(b.source.kind)
  if (rankDiff !== 0) return rankDiff
  return a.id.localeCompare(b.id)
}

function sourceRank(sourceKind: ExtensionCapabilitySourceKind): number {
  switch (sourceKind) {
    case 'project-skill':
      return 0
    case 'user-skill':
      return 1
    case 'managed-skill':
      return 2
    case 'plugin':
      return 3
    case 'bundled':
      return 4
    case 'dynamic':
      return 5
    case 'mcp':
      return 6
    case 'provider':
      return 7
    case 'builtin':
      return 8
    case 'legacy':
      return 9
    case 'unknown':
      return 10
  }
}

function cloneCapability(
  capability: ExtensionCapability,
): ExtensionCapability {
  return {
    ...capability,
    source: { ...capability.source },
    state: { ...capability.state },
    invocation: { ...capability.invocation },
    relations: { ...capability.relations },
    diagnostics: capability.diagnostics.map(diagnostic => ({ ...diagnostic })),
    ...(capability.metadata ? { metadata: { ...capability.metadata } } : {}),
  }
}

function createCounter<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map(key => [key, 0])) as Record<T, number>
}
