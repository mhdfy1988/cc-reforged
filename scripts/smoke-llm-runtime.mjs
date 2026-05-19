import assert from 'node:assert/strict';

const { LlmProviderRegistry } = await import(
  '../dist/src/services/llm/providerRegistry.js'
);
const { LlmRuntime } = await import('../dist/src/services/llm/llmRuntime.js');
const { getDefaultLlmRuntime } = await import(
  '../dist/src/services/llm/defaultRuntime.js'
);
const { loadLlmConfig } = await import('../dist/src/services/llm/llmConfig.js');

const mockProvider = {
  name: 'mock',
  definition: {
    id: 'mock',
    displayName: 'Mock',
    apiMode: 'custom',
    authStrategy: 'mock',
    capabilities: {
      streaming: false,
      tools: false,
      reasoning: false,
      usage: true,
    },
  },
  async generate(request) {
    const promptText = request.messages
      .flatMap(message => message.parts)
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' ');

    return {
      provider: request.provider,
      model: request.model,
      output: [{ type: 'text', text: `mock:${promptText}` }],
      stopReason: 'stop',
      usage: {
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
      },
    };
  },
  async generateImage(request) {
    return {
      provider: request.provider,
      model: request.model,
      output: [
        {
          type: 'image',
          origin: 'model_output',
          lifecycle: 'persisted',
          safety: 'needs_review',
          provider: request.provider,
          model: request.model,
          outputId: request.outputId,
          prompt: request.prompt,
          source: {
            kind: 'file',
            path: 'C:\\tmp\\mock-image.png',
          },
        },
      ],
      generatedArtifacts: [],
    };
  },
};

const registry = new LlmProviderRegistry();
registry.register(mockProvider);
assert.equal(registry.list().length, 1);
assert.equal(registry.getRequired('mock').name, 'mock');
assert.equal(registry.getDefinition('mock').displayName, 'Mock');
assert.equal(registry.getDefinition('mock').apiMode, 'custom');

const runtime = new LlmRuntime({
  registry,
  defaultProvider: 'mock',
  defaultModel: 'mock-model',
});

const request = {
  messages: [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'hello llm runtime' }],
    },
  ],
};

const response = await runtime.generate(request);
assert.equal(response.provider, 'mock');
assert.equal(response.model, 'mock-model');
assert.equal(response.output.length, 1);
assert.equal(response.output[0].type, 'text');
assert.match(response.output[0].text, /hello llm runtime/);

const imageResponse = await runtime.generateImage({
  prompt: 'draw a mock image',
  sessionId: 'thread_mock',
  outputId: 'out_mock_image',
});
assert.equal(imageResponse.provider, 'mock');
assert.equal(imageResponse.model, 'mock-model');
assert.equal(imageResponse.output[0].type, 'image');
assert.equal(imageResponse.output[0].outputId, 'out_mock_image');

const streamedEvents = [];
for await (const event of runtime.stream(request)) {
  streamedEvents.push(event.type);
}

assert.deepEqual(streamedEvents, [
  'response_start',
  'content_part',
  'response_complete',
]);

const defaultRuntime = getDefaultLlmRuntime();
const defaultConfig = loadLlmConfig();
assert.equal(defaultRuntime.listProviders().length, 10);
assert.equal(defaultRuntime.listProviderDefinitions().length, 10);
assert.equal(defaultRuntime.getProvider('anthropic').name, 'anthropic');
assert.equal(defaultRuntime.getProvider('openai').name, 'openai');
assert.equal(defaultRuntime.getProvider('codex-oauth').name, 'codex-oauth');
assert.equal(defaultRuntime.getProvider('deepseek').name, 'deepseek');
assert.equal(defaultRuntime.getProvider('kimi-api').name, 'kimi-api');
assert.equal(defaultRuntime.getProvider('kimi-code').name, 'kimi-code');
assert.equal(defaultRuntime.getProvider('glm-api').name, 'glm-api');
assert.equal(defaultRuntime.getProvider('glm-coding').name, 'glm-coding');
assert.equal(defaultRuntime.getProvider('minimax').name, 'minimax');
assert.equal(defaultRuntime.getProvider('minimax-cn').name, 'minimax-cn');
assert.equal(
  defaultRuntime.getProviderDefinition('anthropic').apiMode,
  'anthropic-messages',
);
assert.equal(
  defaultRuntime.getProviderDefinition('openai').apiMode,
  'openai-chat',
);
assert.equal(
  defaultRuntime.getProviderDefinition('codex-oauth').apiMode,
  'openai-responses',
);
assert.equal(
  defaultRuntime.getProviderDefinition('deepseek').apiMode,
  'openai-chat',
);
assert.equal(
  defaultRuntime.getProviderDefinition('kimi-api').apiMode,
  'openai-chat',
);
assert.equal(
  defaultRuntime.getProviderDefinition('kimi-code').apiMode,
  'anthropic-messages',
);
assert.equal(
  defaultRuntime.getProviderDefinition('glm-api').apiMode,
  'openai-chat',
);
assert.equal(
  defaultRuntime.getProviderDefinition('glm-coding').apiMode,
  'openai-chat',
);
const [, defaultResolvedRequest] = defaultRuntime.resolveRequest({
  messages: [],
});
assert.equal(defaultResolvedRequest.provider, defaultConfig.provider);
assert.equal(defaultResolvedRequest.model, defaultConfig.model);

console.log(
  JSON.stringify(
    {
      ok: true,
      providers: registry.list().map(provider => provider.name),
      providerDefinitions: registry.listDefinitions(),
      defaultProviders: defaultRuntime
        .listProviders()
        .map(provider => provider.name),
      defaultProviderDefinitions: defaultRuntime.listProviderDefinitions(),
      defaultConfig,
      response,
      imageResponse,
      streamedEvents,
    },
    null,
    2,
  ),
);
