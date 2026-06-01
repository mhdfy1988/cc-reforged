import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const urlElicitation = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/urlElicitation.js')).href
)

const {
  extractUrlElicitationsFromErrorData,
  findBlockedFileUrlElicitation,
  getUrlElicitationNonAcceptContent,
} = urlElicitation

const valid = {
  mode: 'url',
  url: 'https://example.invalid/login',
  elicitationId: 'elicit-1',
  message: 'Open login page',
}
const blocked = {
  mode: 'url',
  url: 'file:///C:/Users/example/page.html',
  elicitationId: 'elicit-2',
  message: 'Open local file',
}

assert.deepEqual(
  extractUrlElicitationsFromErrorData({
    elicitations: [
      valid,
      { mode: 'url', url: 123, elicitationId: 'bad', message: 'bad' },
      { mode: 'text', url: 'https://example.invalid', elicitationId: 'bad', message: 'bad' },
      blocked,
    ],
  }),
  [valid, blocked],
)

assert.deepEqual(extractUrlElicitationsFromErrorData(null), [])
assert.deepEqual(extractUrlElicitationsFromErrorData({ elicitations: 'nope' }), [])
assert.equal(
  findBlockedFileUrlElicitation([valid, blocked])?.elicitationId,
  'elicit-2',
)
assert.equal(findBlockedFileUrlElicitation([valid]), undefined)

assert.equal(
  getUrlElicitationNonAcceptContent({
    action: 'decline',
    actor: 'hook',
    tool: 'browser_navigate',
  }),
  'URL elicitation was declined by a hook. The tool "browser_navigate" could not complete because it requires the user to open a URL.',
)
assert.equal(
  getUrlElicitationNonAcceptContent({
    action: 'cancel',
    actor: 'user',
    tool: 'browser_navigate',
  }),
  'URL elicitation was canceled by the user. The tool "browser_navigate" could not complete because it requires the user to open a URL.',
)

console.log('smoke-mcp-url-elicitation: ok')
