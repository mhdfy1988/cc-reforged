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
};

const response = await adapter.generate(request);
assert.equal(requests[0].url, 'https://relay.example/v1/chat/completions');
assert.equal(requests[0].body.model, 'relay-model');
assert.equal(requests[0].body.stream, false);
assert.equal(requests[0].body.temperature, 0.2);
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

console.log(
  JSON.stringify(
    {
      ok: true,
      generateRequest: requests[0].body,
      streamRequest: requests[1].body,
      response,
      eventTypes: events.map(event => event.type),
    },
    null,
    2,
  ),
);
