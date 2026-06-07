import type { Tools } from '../../Tool.js'
import {
  getCcrToolAvailability,
  type CcrToolAvailability,
  type CcrToolAvailabilityContext,
} from './toolAvailability.js'
import {
  buildCcrToolRegistry,
  type CcrToolRegistryEntry,
} from './toolRegistry.js'

export type CcrToolCapabilitySnapshotEntry = {
  entry: CcrToolRegistryEntry
  availability: CcrToolAvailability
  searchable: boolean
}

export type CcrToolCapabilitySnapshot = {
  schemaVersion: 1
  entries: CcrToolCapabilitySnapshotEntry[]
  summary: {
    total: number
    searchable: number
    available: number
    direct: number
    deferred: number
    internal: number
  }
}

export function createCcrToolCapabilitySnapshot(
  tools: Tools,
  context: CcrToolAvailabilityContext = {},
): CcrToolCapabilitySnapshot {
  const registry = buildCcrToolRegistry(tools)
  const entries = registry.entries.map(entry => {
    const availability = getCcrToolAvailability(entry, context)
    return {
      entry,
      availability,
      searchable: entry.exposure === 'deferred' && availability.available,
    }
  })

  return {
    schemaVersion: 1,
    entries,
    summary: {
      total: entries.length,
      searchable: entries.filter(item => item.searchable).length,
      available: entries.filter(item => item.availability.available).length,
      direct: entries.filter(item => item.entry.exposure === 'direct').length,
      deferred: entries.filter(item => item.entry.exposure === 'deferred').length,
      internal: entries.filter(item => item.entry.exposure === 'internal').length,
    },
  }
}
