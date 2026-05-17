import assert from 'node:assert/strict';

const { OpenAiChatCompletionsAdapter } = await import(
  '../dist/src/services/llm/protocols/openaiChatCompletionsAdapter.js'
);

const requests = [];
const fetchMock = async (url, init) => {
  const body = JSON.parse(init.body);
  requests.push({ url, body });

  if (body.stream) {
    return new Response(
      [
        'data: {"id":"stream-1","model":"relay-model","choices":[{"delta":{"content":"hel"}}]}',
        'data: {"id":"stream-1","model":"relay-model","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}',
        'data: {"id":"stream-1","model":"relay-model","choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}',
        'data: [DONE]',
        '',
      ].join('\n'),
      {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      },
    );
  }

  return new Response(
    JSON.stringify({
      id: 'compatible-test-response',
      model: 'relay-model',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'plain compatible response',
          },
        },
      ],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 4,
        total_tokens: 7,
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
};

const adapter = new OpenAiChatCompletionsAdapter({
  providerId: 'compatible',
  providerLabel: 'Compatible Relay',
  apiKey: 'sk-test',
  baseUrl: 'https://relay.example/v1',
  defaultModel: 'relay-model',
  fetchImpl: fetchMock,
});

const request = {
  provider: 'compatible',
  model: 'relay-model',
  messages: [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
    },
  ],
  temperature: 0.2,
  maxOutputTokens: 123,
};

const response = await adapter.generate(request);
assert.equal(requests[0].url, 'https://relay.example/v1/chat/completions');
assert.equal(requests[0].body.model, 'relay-model');
assert.equal(requests[0].body.stream, false);
assert.equal(requests[0].body.temperature, 0.2);
assert.equal(requests[0].body.max_tokens, 123);
assert.equal('max_completion_tokens' in requests[0].body, false);
assert.equal('thinking' in requests[0].body, false);
assert.equal(response.provider, 'compatible');
assert.equal(response.model, 'relay-model');
assert.equal(response.output[0].type, 'text');
assert.equal(response.output[0].text, 'plain compatible response');
assert.equal(response.usage.totalTokens, 7);

const events = [];
for await (const event of adapter.stream(request)) {
  events.push(event);
}

assert.equal(requests[1].body.stream, true);
assert.deepEqual(requests[1].body.stream_options, { include_usage: true });
assert.deepEqual(
  events.map(event => event.type),
  ['content_part', 'content_part', 'response_complete'],
);
assert.equal(events[0].part.text, 'hel');
assert.equal(events[1].part.text, 'lo');
assert.equal(events[2].response.output[0].text, 'hello');
assert.equal(events[2].response.usage.totalTokens, 6);

const todoToolDefinition = {
  name: 'TodoWrite',
  description: 'Update the session todo list',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['todos'],
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['content', 'status', 'activeForm'],
          properties: {
            content: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
            },
            activeForm: { type: 'string' },
          },
        },
      },
    },
  },
};

await adapter.generate({
  ...request,
  messages: [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'start todo work' }],
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'tool_call',
          id: 'call_todo_missing_result',
          name: 'TodoWrite',
          input: {
            todos: [
              {
                name: 'bad guessed field',
                status: 'pending',
                description: 'DeepSeek guessed the deferred schema',
              },
            ],
          },
        },
      ],
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'continue after interruption' }],
    },
  ],
  tools: [todoToolDefinition],
});

const repairedMessages = requests[2].body.messages;
const danglingAssistantIndex = repairedMessages.findIndex(
  message =>
    message.role === 'assistant' &&
    message.tool_calls?.[0]?.id === 'call_todo_missing_result',
);
assert.notEqual(danglingAssistantIndex, -1);
assert.equal(repairedMessages[danglingAssistantIndex + 1].role, 'tool');
assert.equal(
  repairedMessages[danglingAssistantIndex + 1].tool_call_id,
  'call_todo_missing_result',
);
const syntheticResult = JSON.parse(
  repairedMessages[danglingAssistantIndex + 1].content,
);
assert.equal(syntheticResult.code, 'TOOL_CALL_INTERRUPTED');
assert.equal(syntheticResult.toolName, 'TodoWrite');
assert.equal(repairedMessages[danglingAssistantIndex + 2].role, 'user');
assert.equal(requests[2].body.tools[0].function.name, 'TodoWrite');
assert.equal(
  requests[2].body.tools[0].function.parameters.required.includes('todos'),
  true,
);

await adapter.generate({
  ...request,
  messages: [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'start delayed tool result' }],
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'tool_call',
          id: 'call_result_after_user',
          name: 'Glob',
          input: { pattern: '*.md' },
        },
      ],
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'new prompt before delayed result' }],
    },
    {
      role: 'tool',
      parts: [
        {
          type: 'tool_result',
          toolCallId: 'call_result_after_user',
          result: 'late tool result after user text',
        },
      ],
    },
  ],
  tools: [
    {
      name: 'Glob',
      description: 'Find files',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
        },
      },
    },
  ],
});

const delayedMessages = requests[3].body.messages;
const delayedAssistantIndex = delayedMessages.findIndex(
  message =>
    message.role === 'assistant' &&
    message.tool_calls?.[0]?.id === 'call_result_after_user',
);
assert.notEqual(delayedAssistantIndex, -1);
assert.equal(delayedMessages[delayedAssistantIndex + 1].role, 'tool');
assert.equal(
  delayedMessages[delayedAssistantIndex + 1].tool_call_id,
  'call_result_after_user',
);
const delayedSyntheticResult = JSON.parse(
  delayedMessages[delayedAssistantIndex + 1].content,
);
assert.equal(delayedSyntheticResult.code, 'TOOL_CALL_INTERRUPTED');
assert.equal(delayedMessages[delayedAssistantIndex + 2].role, 'user');
assert.equal(
  delayedMessages.some(
    message =>
      message.role === 'tool' &&
      message.content === 'late tool result after user text',
  ),
  false,
);

await adapter.generate({
  ...request,
  messages: [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'start valid tool call' }],
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'tool_call',
          id: 'call_todo_with_result',
          name: 'TodoWrite',
          input: {
            todos: [
              {
                content: 'valid item',
                status: 'pending',
                activeForm: 'working on valid item',
              },
            ],
          },
        },
      ],
    },
    {
      role: 'tool',
      parts: [
        {
          type: 'tool_result',
          toolCallId: 'call_todo_with_result',
          result: { ok: true },
        },
      ],
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'continue after result' }],
    },
  ],
  tools: [todoToolDefinition],
});

const preservedMessages = requests[4].body.messages;
const preservedAssistantIndex = preservedMessages.findIndex(
  message =>
    message.role === 'assistant' &&
    message.tool_calls?.[0]?.id === 'call_todo_with_result',
);
assert.notEqual(preservedAssistantIndex, -1);
assert.equal(preservedMessages[preservedAssistantIndex + 1].role, 'tool');
assert.equal(
  preservedMessages[preservedAssistantIndex + 1].tool_call_id,
  'call_todo_with_result',
);
assert.equal(
  preservedMessages[preservedAssistantIndex + 1].content.includes(
    'TOOL_CALL_INTERRUPTED',
  ),
  false,
);
assert.equal(preservedMessages[preservedAssistantIndex + 2].role, 'user');

console.log(
  JSON.stringify(
    {
      ok: true,
      generateRequest: requests[0].body,
      streamRequest: requests[1].body,
      repairedToolMessages: requests[2].body.messages,
      delayedRepairMessages: requests[3].body.messages,
      response,
      eventTypes: events.map(event => event.type),
    },
    null,
    2,
  ),
);
