import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-anthropic-provider-'));
const previousConfigPath = process.env.CCR_LLM_CONFIG_PATH;
const previousCredentialsPath = process.env.CCR_LLM_CREDENTIALS_PATH;
const previousAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
process.env.CCR_LLM_CONFIG_PATH = join(tempDir, 'llm.config.local.json');
process.env.CCR_LLM_CREDENTIALS_PATH = join(
  tempDir,
  'llm.credentials.local.json',
);
delete process.env.ANTHROPIC_API_KEY;

writeFileSync(
  process.env.CCR_LLM_CONFIG_PATH,
  JSON.stringify(
    {
      schemaVersion: 2,
      current: {
        profileId: 'anthropic-1',
        model: 'claude-sonnet-test',
      },
      profiles: {
        'anthropic-1': {
          name: 'Anthropic Profile Key',
          providerType: 'anthropic',
          apiMode: 'anthropic-messages',
          auth: {
            strategy: 'api_key',
          },
          defaultModel: 'claude-sonnet-test',
          models: {
            source: 'custom',
            default: 'claude-sonnet-test',
          },
        },
      },
    },
    null,
    2,
  ),
  'utf8',
);
writeFileSync(
  process.env.CCR_LLM_CREDENTIALS_PATH,
  JSON.stringify(
    {
      schemaVersion: 2,
      profileCredentials: {
        'anthropic-1': {
          type: 'api_key',
          providerType: 'anthropic',
          apiKey: 'sk-anthropic-profile',
        },
      },
    },
    null,
    2,
  ),
  'utf8',
);

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

await provider.generate({
  provider: 'anthropic',
  profileId: 'anthropic-1',
  model: 'claude-sonnet-test',
  messages: [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
    },
  ],
  metadata: {
    anthropicRequest: createRequest,
  },
});
assert.equal(calls.getClient.length, 3);
assert.equal(calls.getClient[2].apiKey, 'sk-anthropic-profile');
assert.equal(calls.getClient[2].source, process.env.CCR_LLM_CREDENTIALS_PATH);

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: provider.name,
      createCallCount: calls.create.length,
      streamCallCount: calls.stream.length,
      clientCalls: calls.getClient.map(({ apiKey, ...call }) => ({
        ...call,
        hasApiKey: Boolean(apiKey),
      })),
    },
    null,
    2,
  ),
);

if (previousConfigPath === undefined) {
  delete process.env.CCR_LLM_CONFIG_PATH;
} else {
  process.env.CCR_LLM_CONFIG_PATH = previousConfigPath;
}
if (previousCredentialsPath === undefined) {
  delete process.env.CCR_LLM_CREDENTIALS_PATH;
} else {
  process.env.CCR_LLM_CREDENTIALS_PATH = previousCredentialsPath;
}
if (previousAnthropicApiKey === undefined) {
  delete process.env.ANTHROPIC_API_KEY;
} else {
  process.env.ANTHROPIC_API_KEY = previousAnthropicApiKey;
}
rmSync(tempDir, { recursive: true, force: true });
