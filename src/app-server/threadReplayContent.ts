export function enrichToolResultReplayContentWithGeneratedOutputs(
  content: unknown,
  toolUseResult: unknown,
): unknown {
  if (!Array.isArray(content)) {
    return content
  }

  const generatedOutputs = getGeneratedOutputBlocks(toolUseResult)
  if (generatedOutputs.length === 0) {
    return content
  }

  let changed = false
  const enriched = content.map(block => {
    if (!isRecord(block) || getContentBlockType(block) !== 'tool_result') {
      return block
    }

    const existingContent = block.content
    const existingBlocks = Array.isArray(existingContent)
      ? existingContent.filter(isRecord)
      : []
    const missingOutputs = generatedOutputs.filter(
      output => !existingBlocks.some(existing => isSameGeneratedOutput(existing, output)),
    )
    if (missingOutputs.length === 0) {
      return block
    }

    changed = true
    const resultContent = Array.isArray(existingContent)
      ? [...existingContent, ...missingOutputs]
      : [
          ...(typeof existingContent === 'string' && existingContent.trim()
            ? [{ type: 'text', text: existingContent }]
            : []),
          ...missingOutputs,
        ]
    return {
      ...block,
      content: resultContent,
    }
  })

  return changed ? enriched : content
}

function getGeneratedOutputBlocks(toolUseResult: unknown): Record<string, unknown>[] {
  const result = isRecord(toolUseResult) ? toolUseResult : undefined
  const output = result?.output
  if (!Array.isArray(output)) {
    return []
  }
  return output.filter(
    block =>
      isRecord(block) &&
      ['image', 'file', 'audio', 'video'].includes(getContentBlockType(block)),
  )
}

function isSameGeneratedOutput(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftId = getStringField(left, [
    'attachmentId',
    'attachment_id',
    'outputId',
    'output_id',
    'id',
  ])
  const rightId = getStringField(right, [
    'attachmentId',
    'attachment_id',
    'outputId',
    'output_id',
    'id',
  ])
  if (leftId && rightId) {
    return leftId === rightId
  }
  const leftPath = getStringField(left, ['savedPath', 'saved_path', 'path'])
  const rightPath = getStringField(right, ['savedPath', 'saved_path', 'path'])
  return Boolean(leftPath && rightPath && leftPath === rightPath)
}

function getContentBlockType(block: Record<string, unknown>): string {
  return typeof block.type === 'string' ? block.type : ''
}

function getStringField(
  block: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = block[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
