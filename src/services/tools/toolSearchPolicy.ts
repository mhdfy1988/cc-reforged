import type { Tool, Tools } from '../../Tool.js'
import {
  getCcrToolAvailability,
  type CcrToolAvailabilityContext,
} from './toolAvailability.js'
import {
  buildCcrToolRegistry,
  type CcrToolRegistryEntry,
} from './toolRegistry.js'

export type CcrToolSearchCandidateSnapshot = {
  total: number
  names: string[]
  excluded: Array<{
    name: string
    exposure: CcrToolRegistryEntry['exposure']
    available: boolean
    reason?: string
  }>
}

export function isCcrToolSearchCandidate(
  entry: CcrToolRegistryEntry,
  context: CcrToolAvailabilityContext = {},
): boolean {
  if (entry.exposure !== 'deferred') return false
  return getCcrToolAvailability(entry, context).available
}

export function getCcrToolSearchCandidates(
  tools: Tools,
  context: CcrToolAvailabilityContext = {},
): Tools {
  const registry = buildCcrToolRegistry(tools)
  return registry.entries
    .filter(entry => isCcrToolSearchCandidate(entry, context))
    .map(entry => entry.tool)
}

export function summarizeCcrToolSearchCandidates(
  tools: readonly Tool[],
  context: CcrToolAvailabilityContext = {},
): CcrToolSearchCandidateSnapshot {
  const registry = buildCcrToolRegistry(tools as Tools)
  const names: string[] = []
  const excluded: CcrToolSearchCandidateSnapshot['excluded'] = []

  for (const entry of registry.entries) {
    const availability = getCcrToolAvailability(entry, context)
    if (entry.exposure === 'deferred' && availability.available) {
      names.push(entry.name)
      continue
    }
    excluded.push({
      name: entry.name,
      exposure: entry.exposure,
      available: availability.available,
      ...(availability.reason ? { reason: availability.reason } : {}),
    })
  }

  names.sort()
  excluded.sort((a, b) => a.name.localeCompare(b.name))

  return {
    total: names.length,
    names,
    excluded,
  }
}
