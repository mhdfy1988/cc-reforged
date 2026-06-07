import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundleDir = join(repoRoot, '.tmp', 'smoke-generate-image-tool')
const entryPath = join(bundleDir, 'entry.mjs')
const outputPath = join(bundleDir, 'bundle.mjs')
const configPath = join(bundleDir, 'llm.config.local.json')

rmSync(bundleDir, { recursive: true, force: true })
mkdirSync(bundleDir, { recursive: true })

try {
  process.env.CCR_LLM_CONFIG_PATH = configPath
  delete process.env.CCR_LLM_PROVIDER
  delete process.env.CCR_LLM_MODEL
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        current: {
          profileId: 'deepseek-no-image',
          model: 'deepseek-v4-flash',
        },
        profiles: {
          'deepseek-no-image': {
            name: 'DeepSeek no image smoke',
            providerType: 'deepseek',
            apiMode: 'openai-chat',
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'deepseek-v4-flash',
            models: ['deepseek-v4-flash'],
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  )

  const { GenerateImageTool, GENERATE_IMAGE_TOOL_NAME } = await import(
    '../dist/src/tools/GenerateImageTool/GenerateImageTool.js'
  )
  const { getAllBaseTools, ASYNC_AGENT_ALLOWED_TOOLS } = await import(
    '../dist/src/tools.js'
  )
  const { normalizeGeneratedImageOutputs } = await import(
    '../dist/src/services/llm/protocols/generatedImageOutputAdapter.js'
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

  const unsupportedProviderValidation = await GenerateImageTool.validateInput({
    prompt: 'a racing horse in a meadow',
  })
  assert.equal(unsupportedProviderValidation.result, false)
  assert.match(unsupportedProviderValidation.message, /当前供应商不支持生图/)
  assert.match(unsupportedProviderValidation.message, /deepseek/)
  assert.match(unsupportedProviderValidation.message, /GLM API/)
  assert.match(unsupportedProviderValidation.message, /Codex OAuth/)

  const downloadedImage = await normalizeGeneratedImageOutputs(
    [
      {
        outputId: 'out_generate_image_url_smoke',
        url: 'https://example.test/generated-image-download',
      },
    ],
    {
      provider: 'glm-api',
      model: 'glm-image',
      sessionId: 'generate-image-url-smoke',
      prompt: 'a desk under warm light',
      ccrHome: bundleDir,
      outputFormat: 'png',
      fetchImpl: async () =>
        new Response(Buffer.from('smoke-downloaded-image'), {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-disposition': 'attachment; filename="generated.png"',
          },
        }),
    },
  )
  assert.equal(downloadedImage.output.length, 1)
  assert.equal(downloadedImage.generatedArtifacts.length, 1)
  assert.equal(downloadedImage.output[0].source.kind, 'file')
  assert.equal(downloadedImage.output[0].lifecycle, 'persisted')
  assert.equal(downloadedImage.output[0].mimeType, 'image/png')
  assert.equal(
    readFileSync(downloadedImage.output[0].savedPath, 'utf8'),
    'smoke-downloaded-image',
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
      import { projectThreadDisplayItem } from '../../src/display/threadDisplayProjection.ts';
      export { projectThreadDisplayItem };
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

  const { projectThreadDisplayItem } = await import(
    pathToFileURL(outputPath).href
  )
  const projection = projectThreadDisplayItem({
    id: 'tool:toolu_generate_image_smoke',
    type: 'tool_call',
    text: '',
    status: 'completed',
    sourceKind: 'tool_result',
    identity: {
      itemId: 'tool:toolu_generate_image_smoke',
      threadId: 'thread_generate_image_smoke',
      turnId: 'turn_generate_image_smoke',
      toolUseId: 'toolu_generate_image_smoke',
    },
    content: [
      {
        type: 'tool_use',
        id: 'toolu_generate_image_smoke',
        name: 'GenerateImage',
        input: {
          prompt: generatedArtifact.prompt,
        },
        status: 'completed',
        result: [
          {
            type: 'text',
            text: mapped.content,
          },
          imageBlock,
        ],
      },
    ],
  })

  const projectedEvent = projection?.event
  assert.equal(projectedEvent?.type, 'tool_call')
  assert.equal(projectedEvent?.attachmentSnapshots?.length, 1)
  assert.equal(projectedEvent?.attachmentSnapshots?.[0]?.source, 'ModelOutput')
  assert.equal(projectedEvent?.attachmentSnapshots?.[0]?.status, 'generated')
  assert.equal(projectedEvent?.attachmentSnapshots?.[0]?.previewKind, 'image')
  assert.equal(projectedEvent?.attachmentSnapshots?.[0]?.provider, 'glm-api')
  assert.equal(projectedEvent?.attachmentSnapshots?.[0]?.model, 'glm-image')
  assert.equal(
    projectedEvent?.attachmentSnapshots?.[0]?.savedPath,
    generatedArtifact.savedPath,
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'generate_image_tool_visible',
          'unsupported_provider_returns_friendly_validation',
          'download_url_outputs_are_persisted_for_preview',
          'generate_image_tool_result_text_only_for_model',
          'thread_display_projects_generated_image_from_tool_result_data',
        ],
      },
      null,
      2,
    ),
  )
} finally {
  delete process.env.CCR_LLM_CONFIG_PATH
  delete process.env.CCR_LLM_PROVIDER
  delete process.env.CCR_LLM_MODEL
  rmSync(bundleDir, { recursive: true, force: true })
}
