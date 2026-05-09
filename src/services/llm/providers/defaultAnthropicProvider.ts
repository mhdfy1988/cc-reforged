import { getDefaultLlmRuntime } from '../defaultRuntime.js'
import { AnthropicProvider } from './AnthropicProvider.js'

export function getDefaultAnthropicProvider(): AnthropicProvider {
  const provider = getDefaultLlmRuntime().getProvider('anthropic')
  if (!(provider instanceof AnthropicProvider)) {
    throw new Error('Default LLM runtime anthropic provider is not available.')
  }
  return provider
}
