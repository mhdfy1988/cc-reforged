// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { z } from 'zod/v4';
import { HOOK_EVENTS, } from 'src/entrypoints/agentSdkTypes.js';
import { HookJSONOutputSchema, PromptRequestSchema, PromptResponseSchema, } from 'src/entrypoints/sdk/coreSchemas.js';
export function isHookEvent(value) {
    return HOOK_EVENTS.includes(value);
}
// Prompt elicitation protocol types. The `prompt` key acts as discriminator
// (mirroring the {async:true} pattern), with the id as its value.
export const promptRequestSchema = PromptRequestSchema;
export const promptResponseSchema = PromptResponseSchema;
// Zod schema for hook JSON output validation
export const hookJSONOutputSchema = HookJSONOutputSchema;
// Type guard function to check if response is sync
export function isSyncHookJSONOutput(json) {
    return !('async' in json && json.async === true);
}
// Type guard function to check if response is async
export function isAsyncHookJSONOutput(json) {
    return 'async' in json && json.async === true;
}
//# sourceMappingURL=hooks.js.map