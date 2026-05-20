import { configureGlobalFetchDispatcher } from '../../../utils/proxy.js';
import { normalizeGeneratedImageOutputs, } from './generatedImageOutputAdapter.js';
export class OpenAiImageGenerationAdapter {
    #providerId;
    #providerLabel;
    #apiKey;
    #baseUrl;
    #defaultModel;
    #missingApiKeyMessage;
    #fetchImpl;
    constructor(options) {
        this.#providerId = options.providerId;
        this.#providerLabel = options.providerLabel;
        this.#apiKey = options.apiKey?.trim();
        this.#baseUrl = normalizeBaseUrl(options.baseUrl);
        this.#defaultModel = options.defaultModel;
        this.#missingApiKeyMessage =
            options.missingApiKeyMessage ??
                `${options.providerLabel} API key is missing.`;
        this.#fetchImpl = options.fetchImpl || fetch;
    }
    async generateImage(request) {
        configureGlobalFetchDispatcher();
        const apiKey = this.#apiKey?.trim();
        if (!apiKey) {
            throw new Error(this.#missingApiKeyMessage);
        }
        const requestBody = toOpenAiImageGenerationRequestBody({
            request,
            defaultModel: this.#defaultModel,
        });
        const response = await this.#fetchImpl(resolveImageGenerationsUrl(this.#baseUrl), {
            method: 'POST',
            headers: {
                authorization: `Bearer ${apiKey}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: request.signal,
        });
        if (!response.ok) {
            throw new Error(await getProviderErrorMessage(response, this.#providerLabel, {
                requestBody,
                includeRequestDiagnostics: true,
            }));
        }
        const raw = (await response.json());
        return normalizeOpenAiImageGenerationResponse(raw, {
            request,
            fallbackModel: requestBody.model,
            providerId: this.#providerId,
            fetchImpl: this.#fetchImpl,
        });
    }
}
export function toOpenAiImageGenerationRequestBody(input) {
    const prompt = input.request.prompt.trim();
    if (!prompt) {
        throw new Error('Image generation prompt cannot be empty.');
    }
    const model = input.request.model?.trim() || input.defaultModel;
    const responseFormat = input.request.responseFormat ??
        (usesDefaultUrlImageResponse(model) ? undefined : 'b64_json');
    return {
        model,
        prompt,
        ...(typeof input.request.n === 'number' ? { n: input.request.n } : {}),
        ...(input.request.size ? { size: input.request.size } : {}),
        ...(input.request.quality ? { quality: input.request.quality } : {}),
        ...(input.request.outputFormat
            ? { output_format: input.request.outputFormat }
            : {}),
        ...(responseFormat ? { response_format: responseFormat } : {}),
    };
}
export async function normalizeOpenAiImageGenerationResponse(raw, context) {
    const provider = context.providerId ?? context.request.provider;
    const model = context.fallbackModel || context.request.model;
    return normalizeOpenAiGeneratedImageOutputs((raw.data ?? []).map(item => ({
        base64Data: item.b64_json,
        url: item.url,
        revisedPrompt: item.revised_prompt,
        raw: item,
    })), {
        provider,
        model,
        sessionId: context.request.sessionId,
        prompt: context.request.prompt,
        outputId: context.request.outputId,
        ccrHome: context.request.ccrHome,
        outputFormat: context.request.outputFormat,
        fetchImpl: context.fetchImpl,
        signal: context.request.signal,
        raw: toSafeOpenAiImageGenerationRaw(raw),
    });
}
export async function normalizeOpenAiImageGenerationCall(call, context) {
    const outputId = context.outputId ??
        getNonEmptyString(call.id) ??
        getNonEmptyString(call.call_id);
    const prompt = context.prompt ?? getNonEmptyString(call.prompt);
    const result = getNonEmptyString(call.result);
    return normalizeOpenAiGeneratedImageOutputs([
        {
            outputId,
            base64Data: result,
            revisedPrompt: getNonEmptyString(call.revised_prompt),
            raw: call,
        },
    ], {
        ...context,
        outputId,
        prompt,
        raw: toSafeOpenAiImageGenerationCallRaw(call),
    });
}
export async function normalizeOpenAiGeneratedImageOutputs(items, context) {
    return normalizeGeneratedImageOutputs(items, context);
}
function usesDefaultUrlImageResponse(model) {
    const normalized = model.toLowerCase();
    return normalized.startsWith('gpt-image') || normalized === 'glm-image';
}
function normalizeBaseUrl(value) {
    return value.replace(/\/+$/u, '');
}
function resolveImageGenerationsUrl(baseUrl) {
    if (baseUrl.endsWith('/images/generations')) {
        return baseUrl;
    }
    return `${baseUrl}/images/generations`;
}
function getNonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
async function getProviderErrorMessage(response, providerLabel, options = {}) {
    const text = await response.text().catch(() => '');
    let detail = text.trim();
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed.error?.message === 'string') {
            detail = parsed.error.message;
        }
    }
    catch {
        // Preserve the raw response text when it is not JSON.
    }
    const message = `${providerLabel} image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : '.'}`;
    if (!options.includeRequestDiagnostics || !options.requestBody) {
        return message;
    }
    return `${message}; requestDiagnostics=${JSON.stringify(toSafeImageGenerationRequestDiagnostics(options.requestBody))}`;
}
function toSafeImageGenerationRequestDiagnostics(body) {
    return {
        keys: Object.keys(body).sort(),
        model: body.model,
        promptChars: typeof body.prompt === 'string' ? body.prompt.length : 0,
        n: body.n,
        size: body.size,
        quality: body.quality,
        output_format: body.output_format,
        response_format: body.response_format,
    };
}
function toSafeOpenAiImageGenerationRaw(raw) {
    return {
        created: raw.created,
        imageCount: raw.data?.length ?? 0,
        usage: raw.usage,
        data: raw.data?.map(item => ({
            hasBase64: Boolean(item.b64_json),
            hasUrl: Boolean(item.url),
            revised_prompt: item.revised_prompt,
        })),
    };
}
function toSafeOpenAiImageGenerationCallRaw(call) {
    return {
        type: call.type,
        id: call.id,
        call_id: call.call_id,
        status: call.status,
        hasResult: Boolean(call.result),
        revised_prompt: call.revised_prompt,
    };
}
//# sourceMappingURL=openaiImageGenerationAdapter.js.map