import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const toolSafety = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/toolSafety.js')).href
)

const {
  createMcpFileUrlBlockedError,
  getBlockedFileUrlForMcpTool,
  isFileUrl,
} = toolSafety

assert.equal(isFileUrl('file:///C:/Users/example/page.html'), true)
assert.equal(isFileUrl('FILE:///C:/Users/example/page.html'), true)
assert.equal(isFileUrl('http://localhost:5173'), false)
assert.equal(isFileUrl('not a url'), false)
assert.equal(isFileUrl(undefined), false)

assert.equal(
  getBlockedFileUrlForMcpTool('browser_navigate', {
    url: 'file:///C:/Users/example/page.html',
  }),
  'file:///C:/Users/example/page.html',
)
assert.equal(
  getBlockedFileUrlForMcpTool('mcp__playwright__browser_navigate', {
    url: 'file:///tmp/index.html',
  }),
  'file:///tmp/index.html',
)
assert.equal(
  getBlockedFileUrlForMcpTool('browser_navigate', {
    url: 'http://localhost:5173',
  }),
  undefined,
)
assert.equal(
  getBlockedFileUrlForMcpTool('browser_click', {
    url: 'file:///tmp/index.html',
  }),
  undefined,
)

const error = createMcpFileUrlBlockedError(
  'browser_navigate',
  'file:///tmp/index.html',
)
assert.equal(error.name, 'TelemetrySafeError')
assert.match(error.message, /cannot open file:\/\/ URLs/)
assert.match(error.message, /localhost URL/)

console.log('smoke-mcp-tool-safety: ok')
