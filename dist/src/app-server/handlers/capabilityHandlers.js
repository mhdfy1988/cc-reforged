import { CapabilitiesListParamsSchema } from '../protocol.js';
export async function handleCapabilitiesList(context, params) {
    const parsedParams = CapabilitiesListParamsSchema.parse(params ?? {});
    return context.core.capabilities.list({
        ...parsedParams,
        cwd: parsedParams.cwd ?? process.cwd(),
        configHomeDir: parsedParams.configHomeDir ?? context.ccrHome,
    });
}
//# sourceMappingURL=capabilityHandlers.js.map