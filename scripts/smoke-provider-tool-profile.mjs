import assert from 'node:assert/strict';

const {
  isOpenAiChatToolResultProfile,
  listBuiltinProviderToolProfiles,
  providerSupportsDeferredToolSearch,
  resolveProviderToolProfile,
  shouldSendCoreToolInline,
} = await import('../dist/src/services/llm/toolProtocolProfile.js');
const { OpenAiChatCompletionsAdapter } = await import(
  '../dist/src/services/llm/protocols/openaiChatCompletionsAdapter.js'
);

const deepseekProfile = resolveProviderToolProfile({
  providerId: 'deepseek',
  apiMode: 'openai-chat',
  model: 'deepseek-v4-flash',
});
assert.equal(deepseekProfile.source, 'builtin');
assert.equal(deepseekProfile.toolCalling.supported, true);
assert.equal(deepseekProfile.toolCalling.schemaStyle, 'json_schema_function');
assert.equal(
  deepseekProfile.toolCalling.resultStyle,
  'tool_role_with_tool_call_id',
);
assert.equal(deepseekProfile.toolCalling.requiresCallId, true);
assert.equal(deepseekProfile.toolCalling.supportsStrictSchema, 'beta');
assert.equal(deepseekProfile.toolCalling.supportsDeferredToolSearch, false);
assert.equal(providerSupportsDeferredToolSearch(deepseekProfile), false);
assert.equal(shouldSendCoreToolInline(deepseekProfile, 'TodoWrite'), true);
assert.equal(isOpenAiChatToolResultProfile(deepseekProfile), true);

const relayProfile = resolveProviderToolProfile({
  providerId: 'third-party-relay',
  apiMode: 'openai-chat',
  model: 'gpt-compatible',
});
assert.equal(relayProfile.source, 'api_mode_default');
assert.equal(relayProfile.toolCalling.supported, true);
assert.equal(relayProfile.toolCalling.supportsStrictSchema, 'unknown');
assert.equal(relayProfile.toolCalling.supportsDeferredToolSearch, false);

const anthropicProfile = resolveProviderToolProfile({
  providerId: 'anthropic',
  apiMode: 'anthropic-messages',
  model: 'claude-sonnet-4-5',
});
assert.equal(anthropicProfile.source, 'builtin');
assert.equal(
  anthropicProfile.toolCalling.schemaStyle,
  'anthropic_input_schema',
);
assert.equal(
  anthropicProfile.toolCalling.resultStyle,
  'anthropic_tool_result_block',
);
assert.equal(providerSupportsDeferredToolSearch(anthropicProfile), true);

const customProfile = resolveProviderToolProfile({
  providerId: 'local-text-only',
  apiMode: 'custom',
  model: 'text-only',
});
assert.equal(customProfile.source, 'disabled_default');
assert.equal(customProfile.toolCalling.supported, false);

const builtinProfiles = listBuiltinProviderToolProfiles();
assert.equal(
  builtinProfiles.some(profile => profile.providerId === 'deepseek'),
  true,
);

const requests = [];
const fetchMock = async (_url, init) => {
  const body = JSON.parse(init.body);
  requests.push(body);
  return new Response(
    JSON.stringify({
      id: 'tool-profile-test-response',
      model: body.model,
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'ok',
          },
        },
      ],
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
};

const adapter = new OpenAiChatCompletionsAdapter({
  providerId: 'deepseek',
  providerLabel: 'DeepSeek',
  apiKey: 'sk-test',
  baseUrl: 'https://api.deepseek.com',
  defaultModel: 'deepseek-v4-flash',
  fetchImpl: fetchMock,
});

await adapter.generate({
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  messages: [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'start' }],
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'tool_call',
          id: 'call_missing_result',
          name: 'TodoWrite',
          input: {
            todos: [
              {
                name: 'bad guessed field',
                status: 'pending',
                description: 'wrong shape',
              },
            ],
          },
        },
      ],
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'continue' }],
    },
  ],
  tools: [
    {
      name: 'TodoWrite',
      description: 'Update the session todo list',
      inputSchema: {
        type: 'object',
        required: ['todos'],
        properties: {
          todos: {
            type: 'array',
          },
        },
      },
    },
  ],
});

const repairedMessages = requests[0].messages;
const assistantIndex = repairedMessages.findIndex(
  message =>
    message.role === 'assistant' &&
    message.tool_calls?.[0]?.id === 'call_missing_result',
);
assert.notEqual(assistantIndex, -1);
assert.equal(repairedMessages[assistantIndex + 1].role, 'tool');
assert.equal(
  repairedMessages[assistantIndex + 1].tool_call_id,
  'call_missing_result',
);
assert.equal(
  JSON.parse(repairedMessages[assistantIndex + 1].content).code,
  'TOOL_CALL_INTERRUPTED',
);
assert.equal(requests[0].tools[0].function.name, 'TodoWrite');

console.log(
  JSON.stringify(
    {
      ok: true,
      deepseekProfile,
      relayProfile,
      anthropicProfile,
      customProfile,
      request: requests[0],
    },
    null,
    2,
  ),
);
