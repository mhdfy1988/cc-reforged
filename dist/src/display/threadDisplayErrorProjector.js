import { createCcrErrorSnapshot, } from '../types/errorSnapshot.js';
export function createAppServerErrorSnapshot(input) {
    return createCcrErrorSnapshot({
        message: input.message,
        source: 'app_server',
        safeDetails: {
            itemId: input.itemId,
            threadId: input.threadId,
            turnId: input.turnId,
        },
    });
}
export function createToolErrorSnapshot(input) {
    return createCcrErrorSnapshot({
        message: input.message,
        source: 'tool',
        category: 'tool_error',
        turnId: input.identity.turnId,
        toolUseId: input.identity.toolUseId,
        safeDetails: {
            toolName: input.toolName,
            errorClass: input.errorClass,
            status: input.status,
        },
    });
}
//# sourceMappingURL=threadDisplayErrorProjector.js.map