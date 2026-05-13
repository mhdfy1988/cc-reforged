import { AuthStatusParamsSchema, AuthLoginParamsSchema, ConfigGetParamsSchema, ModelAvailabilityParamsSchema, ModelCredentialUpdateParamsSchema, ModelProfileCopyParamsSchema, ModelProfileDeleteParamsSchema, ModelListParamsSchema, ModelProfileListParamsSchema, ModelProfileSaveParamsSchema, ModelProfileSetCurrentParamsSchema, ModelSetParamsSchema, ModelTestParamsSchema, } from '../protocol.js';
export function handleConfigGet(context, params) {
    ConfigGetParamsSchema.parse(params ?? {});
    return context.core.config.getSnapshot();
}
export async function handleAuthStatus(context, params) {
    const parsedParams = AuthStatusParamsSchema.parse(params ?? {});
    return context.core.auth.getStatus(parsedParams.provider);
}
export async function handleAuthLogin(context, params) {
    const parsedParams = AuthLoginParamsSchema.parse(params ?? {});
    return context.core.auth.login({
        ...(parsedParams.profileId ? { profileId: parsedParams.profileId } : {}),
        ...(parsedParams.provider ? { provider: parsedParams.provider } : {}),
    });
}
export function handleModelList(context, params) {
    const parsedParams = ModelListParamsSchema.parse(params ?? {});
    return context.core.model.listModels(parsedParams.provider);
}
export function handleModelProfileList(context, params) {
    const parsedParams = ModelProfileListParamsSchema.parse(params ?? {});
    return context.core.model.listProfiles({
        ...(parsedParams.providerType
            ? { providerType: parsedParams.providerType }
            : {}),
    });
}
export async function handleModelProfileSetCurrent(context, params) {
    const parsedParams = ModelProfileSetCurrentParamsSchema.parse(params);
    return context.core.model.setProfile({
        profileId: parsedParams.profileId,
        ...(parsedParams.model ? { model: parsedParams.model } : {}),
    });
}
export async function handleModelProfileSave(context, params) {
    const parsedParams = ModelProfileSaveParamsSchema.parse(params);
    return context.core.model.saveProfile({
        ...(parsedParams.profileId ? { profileId: parsedParams.profileId } : {}),
        ...(parsedParams.name ? { name: parsedParams.name } : {}),
        providerType: parsedParams.providerType,
        ...(parsedParams.apiMode ? { apiMode: parsedParams.apiMode } : {}),
        ...(parsedParams.authStrategy
            ? { authStrategy: parsedParams.authStrategy }
            : {}),
        ...(parsedParams.accountId ? { accountId: parsedParams.accountId } : {}),
        ...(parsedParams.baseUrl ? { baseUrl: parsedParams.baseUrl } : {}),
        ...(parsedParams.defaultModel
            ? { defaultModel: parsedParams.defaultModel }
            : {}),
        ...(parsedParams.models ? { models: parsedParams.models } : {}),
        ...(parsedParams.setCurrent !== undefined
            ? { setCurrent: parsedParams.setCurrent }
            : {}),
    });
}
export async function handleModelProfileCopy(context, params) {
    const parsedParams = ModelProfileCopyParamsSchema.parse(params);
    return context.core.model.copyProfile({
        profileId: parsedParams.profileId,
        ...(parsedParams.name ? { name: parsedParams.name } : {}),
    });
}
export async function handleModelProfileDelete(context, params) {
    const parsedParams = ModelProfileDeleteParamsSchema.parse(params);
    return context.core.model.deleteProfile({
        profileId: parsedParams.profileId,
    });
}
export async function handleModelSet(context, params) {
    const parsedParams = ModelSetParamsSchema.parse(params ?? {});
    if (!parsedParams.model) {
        throw new Error('LLM model cannot be empty.');
    }
    return context.core.model.setModel({
        ...(parsedParams.profileId ? { profileId: parsedParams.profileId } : {}),
        ...(parsedParams.provider ? { provider: parsedParams.provider } : {}),
        model: parsedParams.model,
    });
}
export function handleModelAvailability(context, params) {
    const parsedParams = ModelAvailabilityParamsSchema.parse(params ?? {});
    return context.core.model.getAvailability({
        ...(parsedParams.profileId ? { profileId: parsedParams.profileId } : {}),
        ...(parsedParams.provider ? { provider: parsedParams.provider } : {}),
        ...(parsedParams.model ? { model: parsedParams.model } : {}),
    });
}
export async function handleModelTest(context, params) {
    const parsedParams = ModelTestParamsSchema.parse(params ?? {});
    return context.core.model.testConnection({
        ...(parsedParams.profileId ? { profileId: parsedParams.profileId } : {}),
        ...(parsedParams.provider ? { provider: parsedParams.provider } : {}),
        ...(parsedParams.model ? { model: parsedParams.model } : {}),
        ...(parsedParams.prompt ? { prompt: parsedParams.prompt } : {}),
    });
}
export async function handleModelCredentialUpdate(context, params) {
    const parsedParams = ModelCredentialUpdateParamsSchema.parse(params);
    return context.core.model.updateCredential({
        ...(parsedParams.profileId ? { profileId: parsedParams.profileId } : {}),
        provider: parsedParams.provider,
        ...(parsedParams.model ? { model: parsedParams.model } : {}),
        apiKey: parsedParams.apiKey,
    });
}
//# sourceMappingURL=llmHandlers.js.map