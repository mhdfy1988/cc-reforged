import { randomUUID } from 'node:crypto'
import { z } from 'zod/v4'
import { getSessionId } from '../../bootstrap/state.js'
import { createDefaultLlmRuntime } from '../../services/llm/defaultRuntime.js'
import { loadLlmConfig } from '../../services/llm/llmConfig.js'
import {
  resolveLlmProviderCapabilityTools,
} from '../../services/llm/providerCapabilityTools.js'
import type {
  CcrGeneratedArtifactSnapshot,
  CcrImageContentBlock,
} from '../../types/contentBlocks.js'
import { buildTool, type ToolDef, type ValidationResult } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const GENERATE_IMAGE_TOOL_NAME = 'GenerateImage'

const inputSchema = lazySchema(() =>
  z.strictObject({
    prompt: z.string().min(1).describe('The image prompt to generate.'),
    model: z
      .string()
      .optional()
      .describe(
        'Optional image generation model. Leave unset to use the provider default image model, for example glm-image or gpt-image-1.',
      ),
    size: z
      .string()
      .optional()
      .describe('Optional image size, such as 1024x1024 or 1536x1024.'),
    quality: z
      .string()
      .optional()
      .describe('Optional quality setting, such as standard, hd, low, medium, or high.'),
    output_format: z
      .string()
      .optional()
      .describe('Optional output format, such as png, jpeg, or webp.'),
    response_format: z
      .enum(['b64_json', 'url'])
      .optional()
      .describe('Optional provider response format.'),
    n: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional number of images to generate.'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>
type Input = z.infer<InputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    provider: z.string(),
    model: z.string(),
    output: z.array(z.any()),
    generatedArtifacts: z.array(z.any()),
    summary: z.object({
      outputCount: z.number(),
      artifactCount: z.number(),
      outputIds: z.array(z.string()),
      savedPaths: z.array(z.string()),
      urls: z.array(z.string()),
    }),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type GenerateImageToolOutput = {
  provider: string
  model: string
  output: CcrImageContentBlock[]
  generatedArtifacts: CcrGeneratedArtifactSnapshot[]
  summary: {
    outputCount: number
    artifactCount: number
    outputIds: string[]
    savedPaths: string[]
    urls: string[]
  }
}

export const GenerateImageTool = buildTool({
  name: GENERATE_IMAGE_TOOL_NAME,
  aliases: ['image_generation'],
  searchHint: 'create real images with configured image provider',
  alwaysLoad: true,
  maxResultSizeChars: 100_000,
  strict: true,
  async description() {
    return 'Generate real image files through the configured image generation provider.'
  },
  async prompt() {
    return [
      'Use this tool when the user asks you to generate, create, draw, render, or make a real raster image, photo, illustration, poster, or visual asset.',
      'The tool calls the configured image generation provider and returns saved local paths or remote URLs that the UI can preview.',
      'Do not use shell commands, file writing, SVG, or placeholder text to fake image generation unless the user explicitly asks for code, vector art, or an SVG file.',
      'For GLM image generation, leave provider selection to CCR and set model to glm-image only when you need to be explicit.',
    ].join('\n')
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isReadOnly() {
    return true
  },
  interruptBehavior() {
    return 'cancel'
  },
  getActivityDescription(input) {
    const prompt = trimForDisplay(input?.prompt)
    return prompt ? `Generating image: ${prompt}` : 'Generating image'
  },
  getToolUseSummary(input) {
    return trimForDisplay(input?.prompt) ?? null
  },
  renderToolUseMessage(input) {
    const prompt = trimForDisplay(input.prompt)
    return prompt ? `生成图片：${prompt}` : '生成图片'
  },
  renderToolResultMessage(output) {
    return formatResultForDisplay(output)
  },
  extractSearchText(output) {
    return formatResultForDisplay(output)
  },
  toAutoClassifierInput(input) {
    return input.prompt
  },
  async validateInput(input): Promise<ValidationResult> {
    const config = loadLlmConfig()
    const runtime = createDefaultLlmRuntime()
    const capability = resolveLlmProviderCapabilityTools({
      config,
      runtime,
      imageGenerationModel: input.model?.trim() || undefined,
    }).imageGeneration

    if (capability.available) {
      return { result: true }
    }

    return {
      result: false,
      errorCode: 20,
      message: capability.message,
    }
  },
  async call(input, context) {
    const prompt = input.prompt.trim()
    const config = loadLlmConfig()
    const runtime = createDefaultLlmRuntime()
    const capability = resolveLlmProviderCapabilityTools({
      config,
      runtime,
      imageGenerationModel: input.model?.trim() || undefined,
    }).imageGeneration
    const model = capability.model
    const response = await runtime.generateImage({
      provider: config.provider,
      model,
      ...(config.currentProfileId ? { profileId: config.currentProfileId } : {}),
      prompt,
      sessionId: getSessionId(),
      outputId: `out_${randomUUID()}`,
      size: input.size,
      quality: input.quality,
      outputFormat: input.output_format,
      responseFormat: input.response_format,
      n: input.n,
      metadata: {
        source: 'generate_image_tool',
        tool: GENERATE_IMAGE_TOOL_NAME,
        capabilityTool: {
          route: capability.route,
          dataBoundary: capability.dataBoundary,
          provider: capability.provider,
          model: capability.model,
        },
        ...(context.agentId ? { agentId: context.agentId } : {}),
      },
      signal: context.abortController.signal,
    })

    return {
      data: {
        provider: response.provider,
        model: response.model,
        output: [...response.output],
        generatedArtifacts: [...response.generatedArtifacts],
        summary: summarizeGeneratedImages(response.output, response.generatedArtifacts),
      },
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: formatResultForModel(output),
    }
  },
} satisfies ToolDef<InputSchema, GenerateImageToolOutput>)

function summarizeGeneratedImages(
  output: readonly CcrImageContentBlock[],
  generatedArtifacts: readonly CcrGeneratedArtifactSnapshot[],
): GenerateImageToolOutput['summary'] {
  return {
    outputCount: output.length,
    artifactCount: generatedArtifacts.length,
    outputIds: output
      .map(block => block.outputId)
      .filter((value): value is string => Boolean(value)),
    savedPaths: generatedArtifacts
      .map(artifact => artifact.savedPath)
      .filter((value): value is string => Boolean(value)),
    urls: output
      .map(block => (block.source?.kind === 'url' ? block.source.url : undefined))
      .filter((value): value is string => Boolean(value)),
  }
}

function formatResultForModel(output: GenerateImageToolOutput): string {
  const lines = [
    `Generated ${output.summary.outputCount} image(s) with ${output.provider}/${output.model}.`,
  ]
  for (const block of output.output) {
    const id = block.outputId ?? block.attachmentId ?? 'image'
    const location = getImageLocation(block)
    lines.push(location ? `- ${id}: ${location}` : `- ${id}`)
  }
  return lines.join('\n')
}

function formatResultForDisplay(output: GenerateImageToolOutput): string {
  const locations = output.output.map(getImageLocation).filter(Boolean)
  if (locations.length === 0) {
    return `已生成 ${output.summary.outputCount} 张图片`
  }
  return `已生成 ${output.summary.outputCount} 张图片：${locations.join('，')}`
}

function getImageLocation(block: CcrImageContentBlock): string | undefined {
  if (block.savedPath) {
    return block.savedPath
  }
  if (block.source?.kind === 'file') {
    return block.source.path
  }
  if (block.source?.kind === 'url') {
    return block.source.url
  }
  return undefined
}

function trimForDisplay(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) {
    return undefined
  }
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}
