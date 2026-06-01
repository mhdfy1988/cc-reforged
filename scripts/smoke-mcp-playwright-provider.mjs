import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const providerModule = await import(
  pathToFileURL(
    join(repoRoot, 'dist/src/services/mcp/providers/playwright/install.js'),
  ).href
)
const compatModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/playwrightPreset.js')).href
)

assert.equal(providerModule.PLAYWRIGHT_MCP_SERVER_NAME, 'playwright')
assert.equal(compatModule.PLAYWRIGHT_MCP_SERVER_NAME, 'playwright')
assert.equal(providerModule.ensurePlaywrightMcpMode(undefined), 'npx')
assert.equal(providerModule.ensurePlaywrightMcpMode('managed'), 'managed')
assert.throws(
  () => providerModule.ensurePlaywrightMcpMode('unknown'),
  /Unsupported Playwright MCP mode/,
)

const providerConfig = providerModule.createPlaywrightNpxMcpServerConfig({
  version: '0.0.71',
  headless: true,
  config: 'C:\\Users\\example\\playwright-mcp.json',
})
const compatConfig = compatModule.createPlaywrightNpxMcpServerConfig({
  version: '0.0.71',
  headless: true,
  config: 'C:\\Users\\example\\playwright-mcp.json',
})

assert.deepEqual(compatConfig, providerConfig)
assert.equal(providerConfig.type, 'stdio')
assert.equal(providerConfig.command.endsWith('npx.cmd') || providerConfig.command === 'npx', true)
assert.deepEqual(providerConfig.args, [
  '-y',
  '@playwright/mcp@0.0.71',
  '--headless',
  '--config',
  'C:\\Users\\example\\playwright-mcp.json',
])

console.log('smoke-mcp-playwright-provider: ok')
