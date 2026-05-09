import { CompactRunParamsSchema, ContextAnalyzeParamsSchema, ThreadScopedStatusParamsSchema, } from '../protocol.js';
export function handleContextStatus(context, params) {
    const parsedParams = ThreadScopedStatusParamsSchema.parse(params ?? {});
    return context.core.session.getContextStatus(parsedParams);
}
export async function handleContextAnalyze(context, params) {
    const parsedParams = ContextAnalyzeParamsSchema.parse(params ?? {});
    return context.core.session.getContextAnalysis(parsedParams);
}
export function handleCompactStatus(context, params) {
    const parsedParams = ThreadScopedStatusParamsSchema.parse(params ?? {});
    return context.core.session.getCompactStatus(parsedParams);
}
export async function handleCompactRun(context, params) {
    const parsedParams = CompactRunParamsSchema.parse(params);
    if (!parsedParams.threadId) {
        throw new Error('threadId is required.');
    }
    return context.core.session.runCompact({
        threadId: parsedParams.threadId,
        instruction: parsedParams.instruction,
    });
}
export async function handleMemorySessionStatus(context, params) {
    const parsedParams = ThreadScopedStatusParamsSchema.parse(params ?? {});
    return context.core.session.getMemorySessionStatus(parsedParams);
}
//# sourceMappingURL=contextHandlers.js.map