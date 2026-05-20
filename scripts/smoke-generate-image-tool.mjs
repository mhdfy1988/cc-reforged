import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundleDir = join(repoRoot, '.tmp', 'smoke-generate-image-tool')
const entryPath = join(bundleDir, 'entry.mjs')
const outputPath = join(bundleDir, 'bundle.mjs')

rmSync(bundleDir, { recursive: true, force: true })
mkdirSync(bundleDir, { recursive: true })

try {
  const { GenerateImageTool, GENERATE_IMAGE_TOOL_NAME } = await import(
    '../dist/src/tools/GenerateImageTool/GenerateImageTool.js'
  )
  const { getAllBaseTools, ASYNC_AGENT_ALLOWED_TOOLS } = await import(
    '../dist/src/tools.js'
  )

  assert.equal(GENERATE_IMAGE_TOOL_NAME, 'GenerateImage')
  assert.equal(
    getAllBaseTools().some(tool => tool.name === GENERATE_IMAGE_TOOL_NAME),
    true,
    'GenerateImage should be visible in the base tool pool',
  )
  assert.equal(
    ASYNC_AGENT_ALLOWED_TOOLS.has(GENERATE_IMAGE_TOOL_NAME),
    true,
    'GenerateImage should be allowed for async agents',
  )
  assert.equal(
    GenerateImageTool.alwaysLoad,
    true,
    'GenerateImage should be visible without a ToolSearch round trip',
  )

  const generatedArtifact = {
    id: 'out_generate_image_smoke',
    type: 'image',
    status: 'saved',
    savedPath: 'D:\\agent_project\\claude-code-reforged\\.tmp\\generated.png',
    mimeType: 'image/png',
    provider: 'glm-api',
    model: 'glm-image',
    outputId: 'out_generate_image_smoke',
    prompt: 'a racing horse in a meadow',
    lifecycle: 'persisted',
    safety: 'needs_review',
  }
  const imageBlock = {
    type: 'image',
    attachmentId: 'out_generate_image_smoke',
    displayName: 'generated.png',
    mimeType: 'image/png',
    origin: 'model_output',
    lifecycle: 'persisted',
    safety: 'needs_review',
    provider: 'glm-api',
    model: 'glm-image',
    outputId: 'out_generate_image_smoke',
    savedPath: generatedArtifact.savedPath,
    prompt: generatedArtifact.prompt,
    source: {
      kind: 'file',
      path: generatedArtifact.savedPath,
    },
    generatedArtifact,
  }
  const toolOutput = {
    provider: 'glm-api',
    model: 'glm-image',
    output: [imageBlock],
    generatedArtifacts: [generatedArtifact],
    summary: {
      outputCount: 1,
      artifactCount: 1,
      outputIds: ['out_generate_image_smoke'],
      savedPaths: [generatedArtifact.savedPath],
      urls: [],
    },
  }

  const mapped = GenerateImageTool.mapToolResultToToolResultBlockParam(
    toolOutput,
    'toolu_generate_image_smoke',
  )
  assert.equal(mapped.type, 'tool_result')
  assert.equal(typeof mapped.content, 'string')
  assert.match(mapped.content, /Generated 1 image/)
  assert.match(mapped.content, /glm-api\/glm-image/)
  assert.equal(
    JSON.stringify(mapped.content).includes('"type":"image"'),
    false,
    'API-facing tool_result content should stay textual',
  )

  writeFileSync(
    entryPath,
    `
      import { createDisplayEventFromCompletedItem } from '../../apps/desktop/src/renderer/src/domain/displayEvents.ts';
      export { createDisplayEventFromCompletedItem };
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

  const { createDisplayEventFromCompletedItem } = await import(
    pathToFileURL(outputPath).href
  )
  const displayEvent = createDisplayEventFromCompletedItem(
    'item_generate_image_tool_result',
    'tool_result',
    [
      {
        ...mapped,
        result: toolOutput,
      },
    ],
    'completed',
    {
      itemId: 'item_generate_image_tool_result',
      threadId: 'thread_generate_image_smoke',
      turnId: 'turn_generate_image_smoke',
      toolUseId: 'toolu_generate_image_smoke',
    },
  )

  assert.equal(displayEvent?.type, 'tool_result')
  assert.equal(displayEvent?.attachmentSnapshots?.length, 1)
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.source, 'ModelOutput')
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.status, 'generated')
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.previewKind, 'image')
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.provider, 'glm-api')
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.model, 'glm-image')
  assert.equal(
    displayEvent?.attachmentSnapshots?.[0]?.savedPath,
    generatedArtifact.savedPath,
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'generate_image_tool_visible',
          'generate_image_tool_result_text_only_for_model',
          'desktop_extracts_generated_image_from_tool_result_data',
        ],
      },
      null,
      2,
    ),
  )
} finally {
  rmSync(bundleDir, { recursive: true, force: true })
}
