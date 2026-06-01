import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const remoteTransportOptions = await import(
  pathToFileURL(
    join(repoRoot, 'dist/src/services/mcp/remoteTransportOptions.js'),
  ).href
)

const {
  MCP_STREAMABLE_HTTP_ACCEPT,
  buildHttpRequestHeaders,
  buildSseEventSourceHeaders,
  redactMcpTransportHeadersForLog,
  wrapFetchWithTimeout,
} = remoteTransportOptions

const httpHeadersWithSession = buildHttpRequestHeaders({
  userAgent: 'ccr-test',
  sessionIngressToken: 'session-token',
  hasOAuthTokens: false,
  combinedHeaders: { 'X-Custom': 'custom' },
})
assert.deepEqual(httpHeadersWithSession, {
  'User-Agent': 'ccr-test',
  Authorization: 'Bearer session-token',
  'X-Custom': 'custom',
})

const httpHeadersWithOAuth = buildHttpRequestHeaders({
  userAgent: 'ccr-test',
  sessionIngressToken: 'session-token',
  hasOAuthTokens: true,
  combinedHeaders: { Authorization: 'Bearer configured-token' },
})
assert.deepEqual(httpHeadersWithOAuth, {
  'User-Agent': 'ccr-test',
  Authorization: 'Bearer configured-token',
})

const sseHeaders = await buildSseEventSourceHeaders({
  userAgent: 'ccr-test',
  authProvider: {
    tokens: async () => ({ access_token: 'oauth-token' }),
  },
  initHeaders: { Authorization: 'Bearer init-token', 'X-Init': 'init' },
  combinedHeaders: { Authorization: 'Bearer combined-token' },
})
assert.deepEqual(sseHeaders, {
  'User-Agent': 'ccr-test',
  Authorization: 'Bearer combined-token',
  'X-Init': 'init',
  Accept: 'text/event-stream',
})

assert.deepEqual(
  redactMcpTransportHeadersForLog({
    Authorization: 'Bearer secret',
    'X-Custom': 'value',
  }),
  {
    Authorization: '[REDACTED]',
    'X-Custom': 'value',
  },
)

let capturedInit
const wrapped = wrapFetchWithTimeout(async (_url, init) => {
  capturedInit = init
  return new Response('ok')
})
await wrapped('https://example.test/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
})
assert.equal(capturedInit.headers.get('accept'), MCP_STREAMABLE_HTTP_ACCEPT)
assert.equal(typeof capturedInit.signal?.aborted, 'boolean')

capturedInit = undefined
await wrapped('https://example.test/mcp', { method: 'GET' })
assert.equal(capturedInit?.signal, undefined)

console.log('smoke-mcp-remote-transport-options: ok')
