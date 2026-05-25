import { z } from 'zod';
const JsonObjectSchema = z.record(z.string(), z.unknown());
const ThreadDisplayProjectionIdentitySchema = z
    .object({
    itemId: z.string().min(1),
    threadId: z.string().min(1).optional(),
    turnId: z.string().min(1).optional(),
    sourceIndex: z.number().int().nonnegative().optional(),
    rawIndex: z.number().int().nonnegative().optional(),
    materializedIndex: z.number().int().nonnegative().optional(),
    contentIndex: z.number().int().nonnegative().optional(),
    toolUseId: z.string().min(1).optional(),
    parentToolUseId: z.string().min(1).optional(),
    requestId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    missingFields: z.array(z.string()),
    raw: JsonObjectSchema,
})
    .passthrough();
const ThreadDisplayProjectedEventSchema = z
    .object({
    type: z.string().min(1),
    text: z.string(),
    status: z.string().optional(),
    sourceKind: z.string().optional(),
    timelineHidden: z.boolean().optional(),
    identity: ThreadDisplayProjectionIdentitySchema.optional(),
    todoSnapshot: z.unknown().optional(),
    toolSnapshot: z.unknown().optional(),
    fileToolSnapshot: z.unknown().optional(),
    fileSnapshot: z.unknown().optional(),
    attachmentSnapshot: z.unknown().optional(),
    attachmentSnapshots: z.array(z.unknown()).optional(),
    referenceSnapshot: z.unknown().optional(),
    compactSnapshot: z.unknown().optional(),
    contentBlocks: z.array(z.unknown()).optional(),
    errorSnapshot: z.unknown().optional(),
})
    .passthrough();
export const ThreadDisplayProjectionSchema = z
    .object({
    version: z.literal(1),
    event: ThreadDisplayProjectedEventSchema,
})
    .passthrough();
export function validateThreadDisplayProjection(value) {
    const result = ThreadDisplayProjectionSchema.safeParse(value);
    if (result.success) {
        return {
            success: true,
            projection: result.data,
        };
    }
    return {
        success: false,
        issue: result.error.issues.map(formatZodIssue).join('; '),
    };
}
export function parseThreadDisplayProjection(value) {
    const result = validateThreadDisplayProjection(value);
    return 'projection' in result ? result.projection : null;
}
export function assertThreadDisplayProjection(value, context) {
    const result = validateThreadDisplayProjection(value);
    if ('projection' in result) {
        return result.projection;
    }
    const prefix = context ? `${context}: ` : '';
    throw new Error(`${prefix}invalid ThreadDisplayProjection: ${result.issue}`);
}
function formatZodIssue(issue) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
    return `${path} ${issue.message}`;
}
//# sourceMappingURL=threadDisplayProjectionSchema.js.map