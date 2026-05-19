import { LlmRuntime } from './llmRuntime.js';
import { loadLlmConfig } from './llmConfig.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { CodexOAuthProvider } from './providers/CodexOAuthProvider.js';
import { DeepSeekProvider } from './providers/DeepSeekProvider.js';
import { GlmApiProvider, GlmCodingProvider, } from './providers/GlmProvider.js';
import { KimiApiProvider, KimiCodeProvider, } from './providers/KimiProvider.js';
import { MiniMaxChinaProvider, MiniMaxInternationalProvider, } from './providers/MiniMaxProvider.js';
import { OpenAiProvider } from './providers/OpenAiProvider.js';
let defaultLlmRuntime;
export function createDefaultLlmRuntime() {
    const llmConfig = loadLlmConfig();
    const runtime = new LlmRuntime({
        defaultProvider: llmConfig.provider,
        defaultModel: llmConfig.model,
    });
    runtime.registerProvider(new AnthropicProvider());
    runtime.registerProvider(new OpenAiProvider());
    runtime.registerProvider(new CodexOAuthProvider());
    runtime.registerProvider(new DeepSeekProvider());
    runtime.registerProvider(new KimiApiProvider());
    runtime.registerProvider(new KimiCodeProvider());
    runtime.registerProvider(new GlmApiProvider());
    runtime.registerProvider(new GlmCodingProvider());
    runtime.registerProvider(new MiniMaxInternationalProvider());
    runtime.registerProvider(new MiniMaxChinaProvider());
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