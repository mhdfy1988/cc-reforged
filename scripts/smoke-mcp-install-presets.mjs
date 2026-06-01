import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const registryModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/presets/registry.js')).href
)
const manifestModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManifest.js')).href
)

const {
  createCcrMcpInstallPresetRegistry,
  getCcrMcpInstallPreset,
  listCcrMcpInstallPresets,
  searchCcrMcpInstallPresets,
} = registryModule
const { createCcrMcpInstallManifest } = manifestModule

const presets = listCcrMcpInstallPresets()
assert.equal(presets.length, 3)
assert.equal(presets[0].id, 'playwright')
assert.equal(presets[1].id, 'context7')
assert.equal(presets[2].id, 'sentry')
assert.equal(getCcrMcpInstallPreset('playwright')?.displayName, 'Playwright MCP')
assert.equal(getCcrMcpInstallPreset('context7')?.displayName, 'Context7 MCP')
assert.equal(getCcrMcpInstallPreset('sentry')?.displayName, 'Sentry MCP')

const emptySearch = searchCcrMcpInstallPresets()
assert.equal(emptySearch.query, '')
assert.equal(emptySearch.candidates.length, 3)
assert.equal(emptySearch.candidates[0].manifest.name, 'playwright')
assert.equal(emptySearch.candidates[0].manifestInput.source.packageName, '@playwright/mcp')
assert.equal(emptySearch.candidates[1].manifest.name, 'context7')
assert.equal(emptySearch.candidates[1].manifestInput.source.packageName, '@upstash/context7-mcp')
assert.equal(emptySearch.candidates[2].manifest.name, 'sentry')
assert.equal(emptySearch.candidates[2].manifestInput.source.kind, 'remote-url')
assert.equal(emptySearch.candidates[2].manifestInput.source.url, 'https://mcp.sentry.dev/mcp')
assert.equal(emptySearch.candidates[2].manifestInput.transport, 'http')

const packageSearch = searchCcrMcpInstallPresets({ query: '@playwright/mcp' })
assert.deepEqual(
  packageSearch.candidates.map(candidate => candidate.manifest.name),
  ['playwright'],
)

const context7Search = searchCcrMcpInstallPresets({ query: '@upstash/context7-mcp' })
assert.deepEqual(
  context7Search.candidates.map(candidate => candidate.manifest.name),
  ['context7'],
)

const sentrySearch = searchCcrMcpInstallPresets({ query: 'mcp.sentry.dev' })
assert.deepEqual(
  sentrySearch.candidates.map(candidate => candidate.manifest.name),
  ['sentry'],
)

const missingSearch = searchCcrMcpInstallPresets({ query: 'definitely-missing' })
assert.deepEqual(missingSearch.candidates, [])

const listed = listCcrMcpInstallPresets()
listed.pop()
assert.equal(
  listCcrMcpInstallPresets().length,
  3,
  'registry list should not expose mutable internal preset array',
)

const fixturePreset = {
  id: 'fixture',
  displayName: 'Fixture MCP',
  description: 'Fixture registry smoke preset.',
  trusted: false,
  manifest: createCcrMcpInstallManifest({
    name: 'fixture',
    displayName: 'Fixture MCP',
    description: 'Fixture registry smoke preset.',
    version: '1.0.0',
    source: {
      kind: 'remote-url',
      url: 'https://example.invalid/mcp',
    },
    transport: 'http',
    permissions: [],
    dataBoundary: 'remote-service',
  }),
  createServerConfig: manifest => ({
    type: 'http',
    url: manifest.source.url,
  }),
}

const fixtureRegistry = createCcrMcpInstallPresetRegistry([fixturePreset])
assert.equal(fixtureRegistry.list().length, 1)
assert.equal(fixtureRegistry.get('fixture')?.trusted, false)
assert.equal(fixtureRegistry.search({ query: 'example.invalid' }).candidates.length, 1)

assert.throws(
  () => createCcrMcpInstallPresetRegistry([fixturePreset, fixturePreset]),
  /Duplicate MCP install preset id "fixture"/,
)

console.log('smoke-mcp-install-presets: ok')
