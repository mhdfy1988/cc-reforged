import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = join(
  repoRoot,
  'src',
  'services',
  'llm',
  'fixtures',
  'provider-output-fixtures.json',
)
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))

assert(
  fixture.fixtureSchemaVersion === 1,
  'provider output fixture must declare fixtureSchemaVersion 1',
)
assert(Array.isArray(fixture.cases), 'provider output fixture cases must be an array')
assert(fixture.cases.length >= 6, 'provider output fixture must cover key cases')

const providerIds = new Set(fixture.cases.map(item => item.provider))
for (const provider of [
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'kimi-api',
  'kimi-code',
  'glm-api',
  'glm-coding',
  'minimax',
  'openai-compatible',
]) {
  assert(providerIds.has(provider), `missing provider fixture: ${provider}`)
}

const scenarios = new Set(fixture.cases.map(item => item.scenario))
for (const scenario of [
  'text',
  'tool_call',
  'tool_result',
  'attachment',
  'error',
]) {
  assert(scenarios.has(scenario), `missing provider output scenario: ${scenario}`)
}

for (const item of fixture.cases) {
  assert(typeof item.id === 'string' && item.id, 'fixture case id is required')
  assert(typeof item.provider === 'string' && item.provider, `${item.id} provider is required`)
  assert(typeof item.apiMode === 'string' && item.apiMode, `${item.id} apiMode is required`)
  assert(item.rawProviderOutput, `${item.id} rawProviderOutput is required`)
  assert(item.displayInput, `${item.id} displayInput is required`)
  assert(item.expected, `${item.id} expected is required`)
  const rawJson = JSON.stringify(item.rawProviderOutput)
  for (const marker of item.expected.rawProviderMarkers ?? []) {
    assert(
      rawJson.includes(marker),
      `${item.id} raw provider fixture should include marker ${marker}`,
    )
  }
}

await assertRuntimeNormalization(fixturePath)

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: fixture.cases.map(item => item.id),
    },
    null,
    2,
  ),
)

async function assertRuntimeNormalization(providerFixturePath) {
  const tempDir = join(repoRoot, '.tmp', 'smoke-provider-output-fixtures')
  const entryPath = join(tempDir, 'entry.mjs')
  const outputPath = join(tempDir, 'bundle.mjs')
  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })
  await writeFile(
    entryPath,
    `
      import assert from 'node:assert/strict'
      import { readFile } from 'node:fs/promises'
      import { normalizeCcrContentBlocks } from '../../src/types/contentBlocks.ts'
      import { createCcrErrorSnapshot } from '../../src/types/errorSnapshot.ts'
      import { createDisplayEventFromCompletedItem } from '../../apps/desktop/src/renderer/src/domain/displayEvents.ts'

      const fixture = JSON.parse(await readFile(${JSON.stringify(providerFixturePath)}, 'utf8'))

      for (const item of fixture.cases) {
        const displayInput = item.displayInput
        const rawBlocks = Array.isArray(displayInput.blocks) ? displayInput.blocks : []
        const contentBlocks = normalizeCcrContentBlocks(
          displayInput.kind === 'error'
            ? [toErrorContentBlock(displayInput.error)]
            : rawBlocks,
        )
        assert.deepEqual(
          contentBlocks.map(block => block.type),
          item.expected.contentBlockTypes,
          item.id,
        )

        const event = createFixtureDisplayEvent(item, contentBlocks)
        assert.equal(event.type, item.expected.eventType, item.id)
        if (item.expected.textIncludes) {
          assert.equal(event.text.includes(item.expected.textIncludes), true, item.id)
        }
        if (item.expected.toolName) {
          assert.equal(event.toolSnapshot?.name, item.expected.toolName, item.id)
        }
        if (item.expected.toolSnapshotKind) {
          assert.equal(event.toolSnapshot?.kind, item.expected.toolSnapshotKind, item.id)
        }
        if (item.expected.attachmentPreviewKind) {
          assert.equal(
            event.attachmentSnapshots?.[0]?.previewKind,
            item.expected.attachmentPreviewKind,
            item.id,
          )
        }
        if (item.expected.errorCategory) {
          assert.equal(event.errorSnapshot?.category, item.expected.errorCategory, item.id)
        }
        if (item.expected.errorSource) {
          assert.equal(event.errorSnapshot?.source, item.expected.errorSource, item.id)
        }
        assert.deepEqual(
          event.contentBlocks?.map(block => block.type),
          item.expected.contentBlockTypes,
          item.id,
        )

        const eventJson = JSON.stringify(event)
        for (const marker of item.expected.forbiddenDisplayMarkers ?? []) {
          assert.equal(
            eventJson.includes(marker),
            false,
            item.id + ' leaked raw provider marker ' + marker,
          )
        }
      }

      function createFixtureDisplayEvent(item, contentBlocks) {
        const displayInput = item.displayInput
        if (displayInput.kind === 'error') {
          const snapshot = createCcrErrorSnapshot(displayInput.error)
          return {
            id: item.id,
            type: 'error',
            text: snapshot.message,
            errorSnapshot: snapshot,
            contentBlocks,
          }
        }

        const event = createDisplayEventFromCompletedItem(
          item.id,
          displayInput.kind,
          displayInput.blocks,
          displayInput.status ?? 'completed',
          {
            itemId: item.id,
            ...(displayInput.context ?? {}),
          },
        )
        assert.ok(event, item.id)
        return event
      }

      function toErrorContentBlock(input) {
        const snapshot = createCcrErrorSnapshot(input)
        return {
          type: 'error',
          message: snapshot.message,
          category: snapshot.category,
          source: snapshot.source,
          retryable: snapshot.retryable,
        }
      }

    `,
    'utf8',
  )

  await build({
    entryPoints: [entryPath],
    outfile: outputPath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    logLevel: 'silent',
  })

  try {
    await import(pathToFileURL(outputPath).href)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
