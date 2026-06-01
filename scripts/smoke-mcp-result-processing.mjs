import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const resultProcessing = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/resultProcessing.js')).href
)

const {
  contentContainsImages,
  inferCompactSchema,
  processMCPResult,
  transformMCPResult,
  transformResultContent,
} = resultProcessing

assert.equal(
  inferCompactSchema({
    title: 'doc',
    items: [{ id: 1, name: 'item' }],
  }),
  '{title: string, items: [{...}]}',
)

assert.deepEqual(await transformMCPResult({ toolResult: 42 }, 'get', 'fixture'), {
  content: '42',
  type: 'toolResult',
})

const structured = await transformMCPResult(
  { structuredContent: { ok: true, count: 2 } },
  'stats',
  'fixture',
)
assert.equal(structured.type, 'structuredContent')
assert.equal(structured.content, '{"ok":true,"count":2}')
assert.equal(structured.schema, '{ok: boolean, count: number}')

const contentArray = await transformMCPResult(
  {
    content: [
      { type: 'text', text: 'hello' },
      {
        type: 'resource_link',
        name: 'Docs',
        uri: 'https://example.invalid/docs',
        description: 'reference',
      },
    ],
  },
  'read',
  'fixture',
)
assert.equal(contentArray.type, 'contentArray')
assert.deepEqual(contentArray.content, [
  { type: 'text', text: 'hello' },
  {
    type: 'text',
    text: '[Resource link: Docs] https://example.invalid/docs (reference)',
  },
])

assert.deepEqual(
  await transformResultContent({ type: 'text', text: 'plain text' }, 'fixture'),
  [{ type: 'text', text: 'plain text' }],
)

assert.equal(contentContainsImages('plain text'), false)
assert.equal(
  contentContainsImages([
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: 'abc',
      },
    },
  ]),
  true,
)

assert.deepEqual(
  await processMCPResult({ content: [{ type: 'text', text: 'small' }] }, 'read', 'fixture'),
  [{ type: 'text', text: 'small' }],
)

await assert.rejects(
  () => transformMCPResult({ unexpected: true }, 'broken', 'fixture'),
  /unexpected response format/,
)

console.log('smoke-mcp-result-processing: ok')
