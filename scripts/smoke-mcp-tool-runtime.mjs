import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const toolRuntime = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/toolRuntime.js')).href
)

const {
  createMcpToolTimeoutError,
  formatMcpToolDuration,
  getMcpToolResultErrorDetails,
  getMcpToolTimeoutMs,
  isMcpConnectionClosedOnHttp,
} = toolRuntime

assert.equal(getMcpToolTimeoutMs(undefined), 60_000)
assert.equal(getMcpToolTimeoutMs('2500'), 2500)
assert.equal(getMcpToolTimeoutMs('not-a-number'), 60_000)

const timeoutError = createMcpToolTimeoutError({
  serverName: 'playwright',
  toolName: 'browser_navigate',
  timeoutMs: 2500,
})
assert.equal(timeoutError.name, 'TelemetrySafeError')
assert.equal(timeoutError.telemetryMessage, 'MCP tool timeout')
assert.match(timeoutError.message, /timed out after 2s/)

assert.equal(formatMcpToolDuration(42), '42ms')
assert.equal(formatMcpToolDuration(1500), '1s')
assert.equal(formatMcpToolDuration(65000), '1m 5s')

assert.equal(
  getMcpToolResultErrorDetails({
    isError: true,
    content: [{ type: 'text', text: 'tool failed' }],
  }),
  'tool failed',
)
assert.equal(
  getMcpToolResultErrorDetails({
    isError: true,
    error: 'legacy failure',
  }),
  'legacy failure',
)
assert.equal(getMcpToolResultErrorDetails({ isError: true }), 'Unknown error')

const closedError = new Error('Connection closed by server')
closedError.code = -32000
assert.equal(
  isMcpConnectionClosedOnHttp({ error: closedError, configType: 'http' }),
  true,
)
assert.equal(
  isMcpConnectionClosedOnHttp({ error: closedError, configType: 'stdio' }),
  false,
)

console.log('smoke-mcp-tool-runtime: ok')
