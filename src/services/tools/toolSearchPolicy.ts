import type { Tool, Tools } from '../../Tool.js'
import {
  type CcrToolAvailabilityContext,
} from './toolAvailability.js'
import type { CcrToolRegistryEntry } from './toolRegistry.js'
import { createCcrToolCapabilitySnapshot } from './toolCapabilitySnapshot.js'

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
  return createCcrToolCapabilitySnapshot([entry.tool], context).entries[0]
    ?.searchable === true
}

export function getCcrToolSearchCandidates(
  tools: Tools,
  context: CcrToolAvailabilityContext = {},
): Tools {
  return createCcrToolCapabilitySnapshot(tools, context).entries
    .filter(entry => entry.searchable)
    .map(entry => entry.entry.tool)
}

export function summarizeCcrToolSearchCandidates(
  tools: readonly Tool[],
  context: CcrToolAvailabilityContext = {},
): CcrToolSearchCandidateSnapshot {
  const snapshot = createCcrToolCapabilitySnapshot(tools as Tools, context)
  const names: string[] = []
  const excluded: CcrToolSearchCandidateSnapshot['excluded'] = []

  for (const item of snapshot.entries) {
    if (item.searchable) {
      names.push(item.entry.name)
      continue
    }
    excluded.push({
      name: item.entry.name,
      exposure: item.entry.exposure,
      available: item.availability.available,
      ...(item.availability.reason ? { reason: item.availability.reason } : {}),
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
