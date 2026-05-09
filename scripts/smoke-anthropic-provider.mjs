import assert from 'node:assert/strict';

const { AnthropicProvider } = await import(
  '../dist/src/services/llm/providers/AnthropicProvider.js'
);

const calls = {
  getClient: [],
  create: [],
  stream: [],
};

const fakeClient = {
  beta: {
    messages: {
      create: async request => {
        calls.create.push(request);
        return {
          id: 'msg_test',
          model: request.model,
          role: 'assistant',
          type: 'message',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'mock anthropic create' }],
        };
      },
      stream: request => {
        calls.stream.push(request);
        return {
          kind: 'fake-stream',
          request,
        };
      },
    },
  },
};

const provider = new AnthropicProvider({
  getClient: async options => {
    calls.getClient.push(options);
    return fakeClient;
  },
});

const createRequest = {
  model: 'claude-sonnet-test',
  max_tokens: 32,
  messages: [],
};

const createResult = await provider.createMessage({
  maxRetries: 0,
  model: 'claude-sonnet-test',
  source: 'smoke-anthropic-provider',
  request: createRequest,
});

assert.equal(provider.name, 'anthropic');
assert.equal(createResult.id, 'msg_test');
assert.equal(calls.getClient.length, 1);
assert.deepEqual(calls.getClient[0], {
  maxRetries: 0,
  model: 'claude-sonnet-test',
  source: 'smoke-anthropic-provider',
});
assert.equal(calls.create.length, 1);
assert.equal(calls.create[0].model, 'claude-sonnet-test');

const streamRequest = {
  model: 'claude-sonnet-test',
  max_tokens: 16,
  messages: [],
};

const streamResult = await provider.streamMessage({
  maxRetries: 1,
  model: 'claude-sonnet-test',
  request: streamRequest,
});

assert.equal(calls.getClient.length, 2);
assert.equal(calls.stream.length, 1);
assert.deepEqual(streamResult, {
  kind: 'fake-stream',
  request: streamRequest,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: provider.name,
      createCallCount: calls.create.length,
      streamCallCount: calls.stream.length,
      clientCalls: calls.getClient,
    },
    null,
    2,
  ),
);
