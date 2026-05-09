import { AuthStatusParamsSchema, ConfigGetParamsSchema, ModelListParamsSchema, } from '../protocol.js';
export function handleConfigGet(context, params) {
    ConfigGetParamsSchema.parse(params ?? {});
    return context.core.config.getSnapshot();
}
export async function handleAuthStatus(context, params) {
    const parsedParams = AuthStatusParamsSchema.parse(params ?? {});
    return context.core.auth.getStatus(parsedParams.provider);
}
export function handleModelList(context, params) {
    const parsedParams = ModelListParamsSchema.parse(params ?? {});
    return context.core.model.listModels(parsedParams.provider);
}
//# sourceMappingURL=llmHandlers.js.map