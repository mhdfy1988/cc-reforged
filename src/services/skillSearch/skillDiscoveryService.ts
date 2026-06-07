import type { SkillContextDiscoveryCandidate } from '../../skills/skillContextInjectionPlanner.js'
import { isSkillAlreadySurfaced } from '../../skills/skillVisibilityLedger.js'

export type SkillDiscoveryIndexEntry = SkillContextDiscoveryCandidate

export type SkillDiscoverySearchResult = {
  entry: SkillDiscoveryIndexEntry
  score: number
  matchedFields: string[]
  reason: string
}

export type SkillDiscoverySearchOptions = {
  limit?: number
  minScore?: number
}

export type SkillDiscoveryVisibilityState = {
  visibleSkillNames?: ReadonlySet<string>
  visibleSkillCapabilityIds?: ReadonlySet<string>
  loadedSkillNames?: ReadonlySet<string>
  loadedSkillCapabilityIds?: ReadonlySet<string>
  discoveredSkillNames?: ReadonlySet<string>
  discoveredSkillCapabilityIds?: ReadonlySet<string>
}

export type SkillDiscoveryResult = {
  query: string
  matches: SkillDiscoverySearchResult[]
  totalIndexedSkills: number
  catalogQuery: boolean
}

const DEFAULT_LIMIT = 6
const DEFAULT_MIN_SCORE = 2

export function createSkillDiscoveryIndex(
  candidates: readonly SkillContextDiscoveryCandidate[],
): SkillDiscoveryIndexEntry[] {
  return [...candidates]
}

export function filterAlreadySurfacedSkillDiscoveryIndex(
  index: readonly SkillDiscoveryIndexEntry[],
  visibility: SkillDiscoveryVisibilityState,
): SkillDiscoveryIndexEntry[] {
  return index.filter(entry => !isSkillAlreadySurfaced(entry, visibility))
}

export function discoverSkills(
  index: readonly SkillDiscoveryIndexEntry[],
  query: string,
  options: SkillDiscoverySearchOptions = {},
): SkillDiscoveryResult {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return {
      query: '',
      matches: [],
      totalIndexedSkills: index.length,
      catalogQuery: false,
    }
  }

  const catalogQuery = isSkillCatalogQuery(normalizedQuery)
  const limit = options.limit ?? (catalogQuery ? 20 : DEFAULT_LIMIT)
  const matches = catalogQuery
    ? index.slice(0, limit).map(entry => ({
        entry,
        score: 0,
        matchedFields: [],
        reason: 'skill catalog query',
      }))
    : searchSkillDiscoveryIndex(index, normalizedQuery, {
        ...options,
        limit,
      })

  return {
    query: normalizedQuery,
    matches,
    totalIndexedSkills: index.length,
    catalogQuery,
  }
}

export function searchSkillDiscoveryIndex(
  index: readonly SkillDiscoveryIndexEntry[],
  query: string,
  options: SkillDiscoverySearchOptions = {},
): SkillDiscoverySearchResult[] {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const queryTokens = tokenize(normalizedQuery)
  const results = index
    .map(entry => scoreEntry(entry, normalizedQuery, queryTokens))
    .filter(
      (result): result is SkillDiscoverySearchResult =>
        result !== null &&
        result.score >= (options.minScore ?? DEFAULT_MIN_SCORE),
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.entry.capabilityId.localeCompare(b.entry.capabilityId)
    })

  return results.slice(0, options.limit ?? DEFAULT_LIMIT)
}

export function isSkillCatalogQuery(input: string): boolean {
  return /有哪些.*skill|哪些.*skill|skill.*列表|available skills|what skills/i.test(
    input,
  )
}

function scoreEntry(
  entry: SkillDiscoveryIndexEntry,
  normalizedQuery: string,
  queryTokens: Set<string>,
): SkillDiscoverySearchResult | null {
  const fields = [
    { name: 'name', text: entry.name, weight: 8 },
    { name: 'displayName', text: entry.displayName, weight: 6 },
    { name: 'description', text: entry.description, weight: 4 },
    { name: 'whenToUse', text: entry.whenToUse, weight: 5 },
  ]

  let score = 0
  const matchedFields = new Set<string>()

  for (const field of fields) {
    const normalizedField = normalizeText(field.text)
    if (!normalizedField) continue

    if (normalizedField === normalizedQuery) {
      score += field.weight * 4
      matchedFields.add(field.name)
      continue
    }
    if (
      normalizedField.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedField)
    ) {
      score += field.weight * 2
      matchedFields.add(field.name)
    }

    const fieldTokens = tokenize(normalizedField)
    for (const token of queryTokens) {
      if (fieldTokens.has(token) || normalizedField.includes(token)) {
        score += field.weight
        matchedFields.add(field.name)
      }
    }
  }

  if (score <= 0) return null

  return {
    entry,
    score,
    matchedFields: [...matchedFields],
    reason: `matched ${[...matchedFields].join(', ')}`,
  }
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function tokenize(value: string): Set<string> {
  const tokens = new Set<string>()
  const normalized = normalizeText(value)
  for (const token of normalized.match(/[a-z0-9_./:-]+|[\p{Script=Han}]+/gu) ??
    []) {
    if (token.length >= 2) tokens.add(token)
    if (containsHan(token)) {
      for (let index = 0; index < token.length - 1; index++) {
        tokens.add(token.slice(index, index + 2))
      }
    }
  }
  return tokens
}

function containsHan(value: string): boolean {
  return /\p{Script=Han}/u.test(value)
}
