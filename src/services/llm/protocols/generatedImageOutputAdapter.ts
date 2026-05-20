import { basename } from 'node:path'
import {
  persistGeneratedArtifactFromBase64,
  persistGeneratedArtifactFromBytes,
} from '../../../utils/generatedArtifacts.js'
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
  fetchImpl?: typeof fetch
  signal?: AbortSignal
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
      const mimeType = getMimeTypeForOutputFormat(context.outputFormat)
      const artifact = await tryPersistGeneratedImageUrl({
        url: item.url,
        fetchImpl: context.fetchImpl,
        signal: context.signal,
        ccrHome: context.ccrHome,
        sessionId: context.sessionId,
        outputId,
        mimeType,
        provider: context.provider,
        model: context.model,
        prompt,
        revisedPrompt,
      })

      if (artifact?.savedPath) {
        generatedArtifacts.push(artifact)
        output.push({
          type: 'image',
          attachmentId: outputId,
          displayName: basename(artifact.savedPath),
          mimeType: artifact.mimeType ?? mimeType,
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
          source: {
            kind: 'file',
            path: artifact.savedPath,
          },
          raw: {
            sourceUrl: item.url,
          },
        })
        continue
      }

      output.push({
        type: 'image',
        attachmentId: outputId,
        displayName: `${outputId}${getExtensionForOutputFormat(
          context.outputFormat,
        )}`,
        mimeType,
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

async function tryPersistGeneratedImageUrl(input: {
  url: string
  fetchImpl?: typeof fetch
  signal?: AbortSignal
  ccrHome?: string
  sessionId: string
  outputId: string
  mimeType: string
  provider: string
  model: string
  prompt?: string
  revisedPrompt?: string
}): Promise<CcrGeneratedArtifactSnapshot | null> {
  try {
    const response = await (input.fetchImpl ?? fetch)(input.url, {
      signal: input.signal,
    })
    if (!response.ok) {
      return null
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0) {
      return null
    }
    const responseMimeType = getImageMimeTypeFromHeaders(response.headers)
    return await persistGeneratedArtifactFromBytes({
      ccrHome: input.ccrHome,
      sessionId: input.sessionId,
      outputId: input.outputId,
      mimeType: responseMimeType ?? input.mimeType,
      artifactType: 'image',
      bytes,
      provider: input.provider,
      model: input.model,
      prompt: input.prompt,
      revisedPrompt: input.revisedPrompt,
      lifecycle: 'persisted',
      safety: 'needs_review',
      raw: {
        sourceUrl: input.url,
        downloadedMimeType: responseMimeType,
      },
    })
  } catch {
    return null
  }
}

function getImageMimeTypeFromHeaders(headers: Headers): string | undefined {
  const contentType = headers.get('content-type')?.split(';', 1)[0]?.trim()
  return contentType?.startsWith('image/') ? contentType : undefined
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
