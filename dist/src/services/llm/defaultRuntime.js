import { LlmRuntime } from './llmRuntime.js';
import { loadLlmConfig } from './llmConfig.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { CodexOAuthProvider } from './providers/CodexOAuthProvider.js';
let defaultLlmRuntime;
export function createDefaultLlmRuntime() {
    const llmConfig = loadLlmConfig();
    const runtime = new LlmRuntime({
        defaultProvider: llmConfig.provider,
        defaultModel: llmConfig.model,
    });
    runtime.registerProvider(new AnthropicProvider());
    runtime.registerProvider(new CodexOAuthProvider());
    return runtime;
}
export function getDefaultLlmRuntime() {
    if (!defaultLlmRuntime) {
        defaultLlmRuntime = createDefaultLlmRuntime();
    }
    return defaultLlmRuntime;
}
export function resetDefaultLlmRuntime() {
    defaultLlmRuntime = undefined;
}
//# sourceMappingURL=defaultRuntime.js.map