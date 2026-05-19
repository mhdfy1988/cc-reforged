export function shouldUseOpenAiResponsesImageGeneration(metadata) {
    const imageGenerationApi = metadata?.imageGenerationApi;
    const apiMode = metadata?.apiMode;
    return (metadata?.useResponsesImageGeneration === true ||
        imageGenerationApi === 'responses' ||
        imageGenerationApi === 'openai-responses' ||
        apiMode === 'openai-responses');
}
//# sourceMappingURL=openaiImageGenerationRouting.js.map