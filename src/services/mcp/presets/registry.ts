import {
  summarizeCcrMcpInstallManifest,
  type CcrMcpInstallManifest,
} from '../installManifest.js'
import { CONTEXT7_INSTALL_PRESET } from './context7.js'
import { PLAYWRIGHT_INSTALL_PRESET } from './playwright.js'
import { SENTRY_INSTALL_PRESET } from './sentry.js'
import type { CcrMcpInstallPreset } from './types.js'

export type CcrMcpInstallPresetSearchCandidate = {
  manifest: ReturnType<typeof summarizeCcrMcpInstallManifest>
  manifestInput: CcrMcpInstallManifest
  displayName: string
  description: string
  trusted: boolean
}

export type CcrMcpInstallPresetSearchResult = {
  query: string
  candidates: CcrMcpInstallPresetSearchCandidate[]
}

export type CcrMcpInstallPresetRegistry = {
  list: () => CcrMcpInstallPreset[]
  get: (presetId: string) => CcrMcpInstallPreset | undefined
  search: (input?: { query?: string }) => CcrMcpInstallPresetSearchResult
}

export function createCcrMcpInstallPresetRegistry(
  presets: CcrMcpInstallPreset[],
): CcrMcpInstallPresetRegistry {
  const indexedPresets = createValidatedPresetIndex(presets)

  return {
    list: () => [...indexedPresets],
    get: presetId => indexedPresets.find(preset => preset.id === presetId),
    search: (input = {}) => searchPresetIndex(indexedPresets, input),
  }
}

const CCR_MCP_INSTALL_PRESET_REGISTRY = createCcrMcpInstallPresetRegistry([
  PLAYWRIGHT_INSTALL_PRESET,
  CONTEXT7_INSTALL_PRESET,
  SENTRY_INSTALL_PRESET,
])

export function listCcrMcpInstallPresets(): CcrMcpInstallPreset[] {
  return CCR_MCP_INSTALL_PRESET_REGISTRY.list()
}

export function getCcrMcpInstallPreset(
  presetId: string,
): CcrMcpInstallPreset | undefined {
  return CCR_MCP_INSTALL_PRESET_REGISTRY.get(presetId)
}

export function searchCcrMcpInstallPresets(input: {
  query?: string
} = {}): CcrMcpInstallPresetSearchResult {
  return CCR_MCP_INSTALL_PRESET_REGISTRY.search(input)
}

function createValidatedPresetIndex(
  presets: CcrMcpInstallPreset[],
): readonly CcrMcpInstallPreset[] {
  const seenIds = new Set<string>()
  const indexedPresets = presets.map(preset => {
    const id = preset.id.trim()
    if (!id) {
      throw new Error('MCP install preset id must not be empty.')
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate MCP install preset id "${id}".`)
    }
    seenIds.add(id)
    return preset
  })
  return Object.freeze([...indexedPresets])
}

function searchPresetIndex(
  presets: readonly CcrMcpInstallPreset[],
  input: { query?: string },
): CcrMcpInstallPresetSearchResult {
  const query = input.query?.trim().toLowerCase() ?? ''
  const candidates = presets
    .filter(candidate =>
      query
        ? getPresetSearchText(candidate).some(value =>
            value.toLowerCase().includes(query),
          )
        : true,
    )
    .map(candidate => ({
      manifest: summarizeCcrMcpInstallManifest(candidate.manifest),
      manifestInput: candidate.manifest,
      displayName: candidate.displayName,
      description: candidate.description,
      trusted: candidate.trusted,
    }))

  return {
    query,
    candidates,
  }
}

function getPresetSearchText(preset: CcrMcpInstallPreset): string[] {
  return [
    preset.id,
    preset.manifest.name,
    preset.manifest.displayName ?? '',
    preset.manifest.description ?? '',
    preset.displayName,
    preset.description,
    preset.manifest.source.kind === 'stdio-npm-package'
      ? preset.manifest.source.packageName
      : '',
    preset.manifest.source.kind === 'remote-url'
      ? preset.manifest.source.url
      : '',
  ].filter(Boolean)
}
