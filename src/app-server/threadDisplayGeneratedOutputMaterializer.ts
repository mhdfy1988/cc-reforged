import type { CoreJsonObject } from '../core/types.js'

const GENERATED_OUTPUT_IMAGE_PATH_PATTERN =
  /[A-Za-z]:\\[^\r\n`"<>|]*?\.ccr\\generated_outputs\\[^\r\n`"<>|]*?\.(?:png|jpe?g|webp|gif)/gi

export function materializeGeneratedOutputImageBlocks(
  blocks: readonly CoreJsonObject[] | undefined,
): CoreJsonObject[] | undefined {
  if (!blocks || blocks.length === 0) {
    return blocks ? [...blocks] : undefined
  }

  const existingPaths = new Set(
    blocks
      .map(getGeneratedOutputBlockPath)
      .filter((path): path is string => Boolean(path))
      .map(normalizePathKey),
  )
  const generatedBlocks: CoreJsonObject[] = []
  for (const block of blocks) {
    if (!isTextBlock(block)) {
      continue
    }
    const text = getString(block, ['text'])
    if (!text) {
      continue
    }
    for (const path of extractGeneratedOutputImagePaths(text)) {
      const key = normalizePathKey(path)
      if (existingPaths.has(key)) {
        continue
      }
      existingPaths.add(key)
      generatedBlocks.push(createGeneratedOutputImageBlockFromPath(path))
    }
  }

  return generatedBlocks.length > 0 ? [...blocks, ...generatedBlocks] : [...blocks]
}

function isTextBlock(block: CoreJsonObject): boolean {
  const type = getString(block, ['type'])
  return type === 'text' || type === 'output_text'
}

function extractGeneratedOutputImagePaths(text: string): string[] {
  return Array.from(text.matchAll(GENERATED_OUTPUT_IMAGE_PATH_PATTERN), match =>
    match[0].trim(),
  )
}

function createGeneratedOutputImageBlockFromPath(path: string): CoreJsonObject {
  const displayName = getPathBasename(path)
  const outputId = displayName.replace(/\.[^.]+$/, '')
  return {
    type: 'image',
    attachmentId: outputId,
    displayName,
    mimeType: getImageMimeTypeFromPath(path),
    origin: 'model_output',
    lifecycle: 'persisted',
    safety: 'needs_review',
    outputId,
    savedPath: path,
    generatedArtifact: {
      id: outputId,
      type: 'image',
      status: 'saved',
      savedPath: path,
      mimeType: getImageMimeTypeFromPath(path),
      outputId,
      lifecycle: 'persisted',
      safety: 'needs_review',
    },
    source: {
      kind: 'file',
      path,
    },
  }
}

function getGeneratedOutputBlockPath(block: CoreJsonObject): string | undefined {
  const generatedArtifact = getJsonObject(block.generatedArtifact)
  return (
    getString(block, ['savedPath', 'saved_path', 'path', 'absolutePath']) ??
    getString(generatedArtifact, ['savedPath', 'saved_path', 'path'])
  )
}

function getPathBasename(path: string): string {
  return path.replace(/[/\\]+$/u, '').split(/[\\/]/u).pop() ?? path
}

function getImageMimeTypeFromPath(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/png'
}

function normalizePathKey(path: string): string {
  return path.trim().replace(/\//g, '\\').toLowerCase()
}

function getJsonObject(value: unknown): CoreJsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as CoreJsonObject)
    : undefined
}

function getString(
  object: CoreJsonObject | undefined,
  keys: string[],
): string | undefined {
  if (!object) {
    return undefined
  }
  for (const key of keys) {
    const value = object[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}
