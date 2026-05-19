import { basename } from 'node:path'
import { persistGeneratedArtifactFromBase64 } from '../../../utils/generatedArtifacts.js'
import type {
  CcrGeneratedArtifactSnapshot,
  CcrImageContentBlock,
} from '../../../types/contentBlocks.js'
import type {
  LlmImageGenerationOutputFormat,
  LlmImageGenerationResponse,
} from '../types.js'

export interface GeneratedImageOutputItem {
  outputId?: string
  base64Data?: string
  url?: string
  revisedPrompt?: string
  raw?: unknown
}

export interface GeneratedImageNormalizationContext {
  provider: string
  model: string
  sessionId: string
  prompt?: string
  outputId?: string
  ccrHome?: string
  outputFormat?: LlmImageGenerationOutputFormat
  raw?: unknown
}

export async function normalizeGeneratedImageOutputs(
  items: readonly GeneratedImageOutputItem[],
  context: GeneratedImageNormalizationContext,
): Promise<LlmImageGenerationResponse> {
  const output: CcrImageContentBlock[] = []
  const generatedArtifacts: CcrGeneratedArtifactSnapshot[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const outputId = getImageOutputId(
      item.outputId ?? context.outputId,
      index,
      items.length,
    )
    const revisedPrompt = item.revisedPrompt
    const prompt = context.prompt

    if (item.base64Data) {
      const mimeType = getMimeTypeForOutputFormat(context.outputFormat)
      const artifact = await persistGeneratedArtifactFromBase64({
        ccrHome: context.ccrHome,
        sessionId: context.sessionId,
        outputId,
        mimeType,
        artifactType: 'image',
        base64Data: item.base64Data,
        provider: context.provider,
        model: context.model,
        prompt,
        revisedPrompt,
        lifecycle: 'persisted',
        safety: 'needs_review',
      })
      generatedArtifacts.push(artifact)
      output.push({
        type: 'image',
        attachmentId: outputId,
        displayName: artifact.savedPath
          ? basename(artifact.savedPath)
          : `${outputId}${getExtensionForOutputFormat(context.outputFormat)}`,
        mimeType,
        origin: 'model_output',
        lifecycle: 'persisted',
        safety: 'needs_review',
        provider: context.provider,
        model: context.model,
        outputId,
        savedPath: artifact.savedPath,
        prompt,
        revisedPrompt,
        generatedArtifact: artifact,
        ...(artifact.savedPath
          ? {
              source: {
                kind: 'file',
                path: artifact.savedPath,
              },
            }
          : {}),
      })
      continue
    }

    if (item.url) {
      output.push({
        type: 'image',
        attachmentId: outputId,
        displayName: `${outputId}${getExtensionForOutputFormat(
          context.outputFormat,
        )}`,
        mimeType: getMimeTypeForOutputFormat(context.outputFormat),
        origin: 'model_output',
        lifecycle: 'temporary',
        safety: 'needs_review',
        provider: context.provider,
        model: context.model,
        outputId,
        prompt,
        revisedPrompt,
        source: {
          kind: 'url',
          url: item.url,
        },
      })
    }
  }

  if (output.length === 0) {
    throw new Error('Image generation returned no usable image output.')
  }

  return {
    provider: context.provider,
    model: context.model,
    output,
    generatedArtifacts,
    raw: context.raw ?? {
      imageCount: items.length,
      data: items.map(item => ({
        hasBase64: Boolean(item.base64Data),
        hasUrl: Boolean(item.url),
        revised_prompt: item.revisedPrompt,
      })),
    },
  }
}

function getImageOutputId(
  requestedOutputId: string | undefined,
  index: number,
  total: number,
): string {
  const base = requestedOutputId?.trim() || `generated_image_${Date.now()}`
  return total <= 1 ? base : `${base}_${index + 1}`
}

function getMimeTypeForOutputFormat(
  outputFormat: LlmImageGenerationOutputFormat | undefined,
): string {
  switch (outputFormat?.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'png':
    default:
      return 'image/png'
  }
}

function getExtensionForOutputFormat(
  outputFormat: LlmImageGenerationOutputFormat | undefined,
): string {
  switch (outputFormat?.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return '.jpg'
    case 'webp':
      return '.webp'
    case 'png':
    default:
      return '.png'
  }
}
