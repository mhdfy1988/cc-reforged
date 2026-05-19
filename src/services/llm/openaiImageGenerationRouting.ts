export function shouldUseOpenAiResponsesImageGeneration(
  metadata: Readonly<Record<string, unknown>> | undefined,
): boolean {
  const imageGenerationApi = metadata?.imageGenerationApi
  const apiMode = metadata?.apiMode
  return (
    metadata?.useResponsesImageGeneration === true ||
    imageGenerationApi === 'responses' ||
    imageGenerationApi === 'openai-responses' ||
    apiMode === 'openai-responses'
  )
}
