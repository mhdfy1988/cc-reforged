import { z } from 'zod/v4';
const TungstenInputSchema = z.object({}).passthrough();
export const TungstenTool = {
    name: 'TungstenTool',
    description: async () => 'Placeholder Tungsten terminal tool.',
    inputSchema: TungstenInputSchema,
    maxResultSizeChars: Infinity,
    call: async () => ({
        data: undefined,
    }),
    isConcurrencySafe: () => true,
    isEnabled: () => false,
    isReadOnly: () => true,
};
export function clearSessionsWithTungstenUsage() { }
export function resetInitializationState() { }
//# sourceMappingURL=TungstenTool.js.map