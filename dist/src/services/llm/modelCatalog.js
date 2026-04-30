import { getModelMaxOutputTokens, getContextWindowForModel } from '../../utils/context.js';
import { getPublicModelDisplayName, renderModelName, } from '../../utils/model/model.js';
const TEXT_ONLY_MODALITIES = ['text'];
const TEXT_AND_IMAGE_MODALITIES = ['text', 'image'];
const CODEX_OAUTH_MODEL_CATALOG = {
    'gpt-5.4': {
        displayName: 'GPT-5.4',
        contextWindow: 200_000,
        maxOutputTokens: 32_000,
        supportsReasoning: true,
        supportsTools: true,
        inputModalities: TEXT_ONLY_MODALITIES,
    },
    'gpt-5.4-mini': {
        displayName: 'GPT-5.4 Mini',
        contextWindow: 200_000,
        maxOutputTokens: 32_000,
        supportsReasoning: true,
        supportsTools: true,
        inputModalities: TEXT_ONLY_MODALITIES,
    },
};
export function getLlmModelCatalogEntry(input) {
    if (input.providerId === 'anthropic') {
        return getAnthropicModelCatalogEntry(input.model, input.providerDefinition);
    }
    if (input.providerId === 'codex-oauth') {
        return getCodexOAuthModelCatalogEntry(input.model, input.providerDefinition);
    }
    return getFallbackModelCatalogEntry(input);
}
export function listKnownLlmModelCatalogEntries(input) {
    if (input.providerId === 'codex-oauth') {
        return Object.keys(CODEX_OAUTH_MODEL_CATALOG).map(model => getCodexOAuthModelCatalogEntry(model, input.providerDefinition));
    }
    return [
        getLlmModelCatalogEntry({
            providerId: input.providerId,
            model: input.defaultModel,
            providerDefinition: input.providerDefinition,
        }),
    ];
}
function getAnthropicModelCatalogEntry(model, providerDefinition) {
    const maxOutput = getModelMaxOutputTokens(model);
    return {
        provider: providerDefinition.id,
        model,
        displayName: getPublicModelDisplayName(model) ?? renderModelName(model),
        contextWindow: getContextWindowForModel(model),
        maxOutputTokens: maxOutput.upperLimit,
        supportsReasoning: providerDefinition.capabilities.reasoning,
        supportsTools: providerDefinition.capabilities.tools,
        inputModalities: TEXT_AND_IMAGE_MODALITIES,
        metadata: {
            defaultMaxOutputTokens: maxOutput.default,
        },
    };
}
function getCodexOAuthModelCatalogEntry(model, providerDefinition) {
    const catalogEntry = CODEX_OAUTH_MODEL_CATALOG[model];
    if (catalogEntry) {
        return {
            provider: providerDefinition.id,
            model,
            ...catalogEntry,
        };
    }
    return {
        provider: providerDefinition.id,
        model,
        displayName: model,
        contextWindow: 200_000,
        maxOutputTokens: 32_000,
        supportsReasoning: providerDefinition.capabilities.reasoning,
        supportsTools: providerDefinition.capabilities.tools,
        inputModalities: TEXT_ONLY_MODALITIES,
    };
}
function getFallbackModelCatalogEntry(input) {
    return {
        provider: input.providerId,
        model: input.model,
        displayName: input.model,
        contextWindow: 200_000,
        maxOutputTokens: 32_000,
        supportsReasoning: input.providerDefinition.capabilities.reasoning,
        supportsTools: input.providerDefinition.capabilities.tools,
        inputModalities: TEXT_ONLY_MODALITIES,
    };
}
//# sourceMappingURL=modelCatalog.js.map