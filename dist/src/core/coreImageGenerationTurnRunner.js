import { randomUUID } from 'node:crypto';
import { createDefaultLlmRuntime } from '../services/llm/defaultRuntime.js';
import { loadLlmConfig } from '../services/llm/llmConfig.js';
import { createAssistantMessage, createUserMessage } from '../utils/messages.js';
import { CoreError } from './errors.js';
export function shouldRunCoreImageGenerationTurn(metadata) {
    return normalizeImageGenerationOptions(metadata?.imageGeneration)?.enabled === true;
}
export const runCoreImageGenerationTurn = async (input) => {
    const { turn, signal, emit, recordMessage } = input;
    const config = loadLlmConfig();
    const imageOptions = normalizeImageGenerationOptions(turn.metadata.imageGeneration);
    if (!imageOptions?.enabled) {
        throw new CoreError('invalid_params', 'Image generation turn requires imageGeneration metadata.');
    }
    const prompt = (imageOptions.prompt ?? turn.input.text).trim();
    if (!prompt) {
        throw new CoreError('invalid_params', 'Image generation turn requires a non-empty prompt.');
    }
    const userMessage = createUserMessage({ content: turn.input.text || prompt });
    await recordMessage(userMessage);
    emitCompletedItem(emit, {
        itemId: createItemId(),
        threadId: turn.threadId,
        turnId: turn.turnId,
        kind: 'user_message',
        content: [{ type: 'text', text: turn.input.text || prompt }],
    });
    const runtime = createDefaultLlmRuntime();
    const model = imageOptions.model ?? resolveDefaultImageModel(config);
    const response = await runtime.generateImage({
        provider: config.provider,
        model,
        ...(config.currentProfileId ? { profileId: config.currentProfileId } : {}),
        prompt,
        sessionId: turn.metadata.sessionId ?? turn.threadId,
        outputId: `out_${randomUUID()}`,
        size: imageOptions.size,
        quality: imageOptions.quality,
        outputFormat: imageOptions.outputFormat,
        responseFormat: imageOptions.responseFormat,
        n: imageOptions.n,
        metadata: {
            source: 'session_turn',
            ...(imageOptions.metadata ?? {}),
        },
        signal,
    });
    if (response.output.length === 0) {
        throw new CoreError('internal_error', 'Image generation provider returned no displayable output.');
    }
    const assistantMessage = createAssistantMessage({
        content: response.output,
    });
    assistantMessage.message.model = response.model;
    assistantMessage.message.stop_reason = 'end_turn';
    await recordMessage(assistantMessage);
    emitCompletedItem(emit, {
        itemId: createItemId(),
        threadId: turn.threadId,
        turnId: turn.turnId,
        kind: 'assistant_message',
        content: response.output,
    });
    return {
        provider: response.provider,
        model: response.model,
        requestedModel: model,
        stopReason: 'generated_image',
        generatedImage: {
            outputCount: response.output.length,
            artifactCount: response.generatedArtifacts.length,
            outputIds: response.output
                .map(block => block.outputId)
                .filter((value) => Boolean(value)),
            savedPaths: response.generatedArtifacts
                .map(artifact => artifact.savedPath)
                .filter((value) => Boolean(value)),
        },
    };
};
function normalizeImageGenerationOptions(value) {
    if (value === true) {
        return { enabled: true };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const object = value;
    const enabled = object.enabled !== false;
    return {
        enabled,
        prompt: getString(object.prompt),
        model: getString(object.model),
        size: getString(object.size),
        quality: getString(object.quality),
        outputFormat: getString(object.outputFormat ?? object.output_format),
        responseFormat: getResponseFormat(object.responseFormat ?? object.response_format),
        n: getPositiveInteger(object.n),
        metadata: getRecord(object.metadata),
    };
}
function resolveDefaultImageModel(config) {
    const providerConfig = config.providers[config.provider];
    const metadataModel = getString(providerConfig?.metadata?.defaultImageModel);
    return metadataModel ?? config.model;
}
function emitCompletedItem(emit, item) {
    const startedAt = new Date().toISOString();
    const completedAt = startedAt;
    emit({
        type: 'item_started',
        item: {
            ...item,
            status: 'completed',
            startedAt,
            completedAt,
            durationMs: 0,
        },
    });
    emit({
        type: 'item_completed',
        threadId: item.threadId,
        turnId: item.turnId,
        itemId: item.itemId,
        kind: item.kind,
        status: 'completed',
        content: item.content,
        startedAt,
        completedAt,
        durationMs: 0,
    });
}
function createItemId() {
    return `item_${randomUUID()}`;
}
function getString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function getPositiveInteger(value) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
        ? value
        : undefined;
}
function getRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function getResponseFormat(value) {
    return value === 'b64_json' || value === 'url' ? value : undefined;
}
//# sourceMappingURL=coreImageGenerationTurnRunner.js.map