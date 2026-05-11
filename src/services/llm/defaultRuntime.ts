import { LlmRuntime } from './llmRuntime.js'
import { loadLlmConfig } from './llmConfig.js'
import { AnthropicProvider } from './providers/AnthropicProvider.js'
import { CodexOAuthProvider } from './providers/CodexOAuthProvider.js'
import { DeepSeekProvider } from './providers/DeepSeekProvider.js'

let defaultLlmRuntime: LlmRuntime | undefined

export function createDefaultLlmRuntime(): LlmRuntime {
  const llmConfig = loadLlmConfig()
  const runtime = new LlmRuntime({
    defaultProvider: llmConfig.provider,
    defaultModel: llmConfig.model,
  })
  runtime.registerProvider(new AnthropicProvider())
  runtime.registerProvider(new CodexOAuthProvider())
  runtime.registerProvider(new DeepSeekProvider())
  return runtime
}

export function getDefaultLlmRuntime(): LlmRuntime {
  if (!defaultLlmRuntime) {
    defaultLlmRuntime = createDefaultLlmRuntime()
  }
  return defaultLlmRuntime
}

export function resetDefaultLlmRuntime(): void {
  defaultLlmRuntime = undefined
}
