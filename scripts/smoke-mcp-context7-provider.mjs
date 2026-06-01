import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const provider = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/providers/context7/install.js')).href
)
const registry = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/presets/registry.js')).href
)

const {
  CONTEXT7_MCP_PACKAGE_NAME,
  CONTEXT7_MCP_SERVER_NAME,
  createContext7NpxMcpServerConfig,
  getContext7PackageRef,
} = provider

assert.equal(CONTEXT7_MCP_SERVER_NAME, 'context7')
assert.equal(CONTEXT7_MCP_PACKAGE_NAME, '@upstash/context7-mcp')
assert.equal(getContext7PackageRef(undefined), '@upstash/context7-mcp@latest')
assert.equal(getContext7PackageRef('3.1.0'), '@upstash/context7-mcp@3.1.0')

const config = createContext7NpxMcpServerConfig({ version: '3.1.0' })
assert.equal(config.type, 'stdio')
assert.deepEqual(config.args, ['-y', '@upstash/context7-mcp@3.1.0'])
assert.match(config.command, /^npx(\.cmd)?$/)

const search = registry.searchCcrMcpInstallPresets({ query: 'context7' })
assert.deepEqual(
  search.candidates.map(candidate => candidate.manifest.name),
  ['context7'],
)
assert.equal(search.candidates[0].manifestInput.source.packageName, '@upstash/context7-mcp')
assert.equal(search.candidates[0].manifest.transport, 'stdio')
assert.equal(search.candidates[0].manifest.dataBoundary, 'remote-service')
assert.deepEqual(search.candidates[0].manifest.permissionKinds, [
  'network',
  'process',
])
assert.deepEqual(search.candidates[0].manifestInput.serverConfig.args, [
  '-y',
  '@upstash/context7-mcp@latest',
])

console.log('smoke-mcp-context7-provider: ok')
