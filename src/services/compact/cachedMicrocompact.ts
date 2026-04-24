import { feature } from 'bun:bundle'
import { getCachedMCConfig as getRawCachedMCConfig } from './cachedMCConfig.js'

export type CachedMCConfig = {
  enabled: boolean
  triggerThreshold: number
  keepRecent: number
  supportedModels: string[]
  systemPromptSuggestSummaries: boolean
}

type CacheDeleteEdit = {
  type: 'delete'
  cache_reference: string
}

export type CacheEditsBlock = {
  type: 'cache_edits'
  edits: CacheDeleteEdit[]
}

export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

export type CachedMCState = {
  // Encounter-order list of registered compactable tool_result ids.
  toolOrder: string[]
  // All tool_result ids we've seen locally (dedupe across turns/retries).
  registeredTools: Set<string>
  // Registered tool_result ids that have been confirmed sent to API successfully.
  sentToAPI: Set<string>
  // Registered tool_result ids seen since last successful API send.
  pendingSend: Set<string>
  // Tool ids already deleted via cache_edits (never delete twice).
  deletedRefs: Set<string>
  // Optional grouping by user message, preserving observed order.
  toolGroups: string[][]
  // cache_edits blocks pinned to specific user-message indexes for replay.
  pinnedEdits: PinnedCacheEdits[]
}

const DEFAULT_CACHED_MC_CONFIG: CachedMCConfig = Object.freeze({
  enabled: false,
  triggerThreshold: 40,
  keepRecent: 8,
  supportedModels: [],
  systemPromptSuggestSummaries: false,
})

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

function normalizeCachedMCConfig(value: unknown): CachedMCConfig {
  if (!isObjectRecord(value)) {
    return DEFAULT_CACHED_MC_CONFIG
  }

  const keepRecent = asPositiveInteger(
    value.keepRecent,
    DEFAULT_CACHED_MC_CONFIG.keepRecent,
  )
  const triggerThreshold = asPositiveInteger(
    value.triggerThreshold,
    DEFAULT_CACHED_MC_CONFIG.triggerThreshold,
  )

  return {
    enabled: value.enabled === true,
    keepRecent,
    // Trigger should never sit below keepRecent; otherwise we'd delete every turn.
    triggerThreshold: Math.max(keepRecent, triggerThreshold),
    supportedModels: asStringArray(value.supportedModels),
    systemPromptSuggestSummaries: value.systemPromptSuggestSummaries === true,
  }
}

export function createCachedMCState(): CachedMCState {
  return {
    toolOrder: [],
    registeredTools: new Set<string>(),
    sentToAPI: new Set<string>(),
    pendingSend: new Set<string>(),
    deletedRefs: new Set<string>(),
    toolGroups: [],
    pinnedEdits: [],
  }
}

export function resetCachedMCState(state: CachedMCState): void {
  state.toolOrder.length = 0
  state.toolGroups.length = 0
  state.pinnedEdits.length = 0
  state.registeredTools.clear()
  state.sentToAPI.clear()
  state.pendingSend.clear()
  state.deletedRefs.clear()
}

export function getCachedMCConfig(): CachedMCConfig {
  return normalizeCachedMCConfig(getRawCachedMCConfig())
}

export function isCachedMicrocompactEnabled(): boolean {
  if (!feature('CACHED_MICROCOMPACT')) {
    return false
  }
  return getCachedMCConfig().enabled
}

export function isModelSupportedForCacheEditing(model: string): boolean {
  if (typeof model !== 'string' || model.length === 0) {
    return false
  }

  const patterns = getCachedMCConfig().supportedModels
  if (patterns.length === 0) {
    return false
  }

  return patterns.some(pattern => model.includes(pattern))
}

export function registerToolResult(state: CachedMCState, toolUseID: string): void {
  if (typeof toolUseID !== 'string' || toolUseID.length === 0) {
    return
  }

  if (state.registeredTools.has(toolUseID)) {
    return
  }

  state.registeredTools.add(toolUseID)
  state.pendingSend.add(toolUseID)
  state.toolOrder.push(toolUseID)
}

export function registerToolMessage(
  state: CachedMCState,
  toolUseIDs: readonly string[],
): void {
  if (!Array.isArray(toolUseIDs) || toolUseIDs.length === 0) {
    return
  }

  const group = toolUseIDs.filter(
    (id): id is string =>
      typeof id === 'string' &&
      id.length > 0 &&
      state.registeredTools.has(id) &&
      !state.deletedRefs.has(id),
  )

  if (group.length > 0) {
    state.toolGroups.push(group)
  }
}

export function markToolsSentToAPI(state: CachedMCState): void {
  if (state.pendingSend.size === 0) {
    return
  }

  for (const toolID of state.pendingSend) {
    state.sentToAPI.add(toolID)
  }
  state.pendingSend.clear()
}

export function getToolResultsToDelete(state: CachedMCState): string[] {
  const config = getCachedMCConfig()
  if (!config.enabled) {
    return []
  }

  const activeSent = state.toolOrder.filter(
    toolID => state.sentToAPI.has(toolID) && !state.deletedRefs.has(toolID),
  )

  if (activeSent.length <= config.triggerThreshold) {
    return []
  }

  const keepRecent = Math.max(1, config.keepRecent)
  const deleteCount = Math.max(0, activeSent.length - keepRecent)
  if (deleteCount === 0) {
    return []
  }

  return activeSent.slice(0, deleteCount)
}

export function createCacheEditsBlock(
  state: CachedMCState,
  toolUseIDs: readonly string[],
): CacheEditsBlock | null {
  if (!Array.isArray(toolUseIDs) || toolUseIDs.length === 0) {
    return null
  }

  const uniqueToolIDs = toolUseIDs.filter(
    (id): id is string =>
      typeof id === 'string' &&
      id.length > 0 &&
      !state.deletedRefs.has(id) &&
      state.registeredTools.has(id),
  )

  if (uniqueToolIDs.length === 0) {
    return null
  }

  for (const toolID of uniqueToolIDs) {
    state.deletedRefs.add(toolID)
  }

  return {
    type: 'cache_edits',
    edits: uniqueToolIDs.map(toolID => ({
      type: 'delete',
      cache_reference: toolID,
    })),
  }
}
