import assert from 'node:assert/strict';

const { DeepSeekProvider } = await import(
  '../dist/src/services/llm/providers/DeepSeekProvider.js'
);

const requests = [];
const fetchMock = async (url, init) => {
  requests.push({
    url,
    init,
    body: JSON.parse(init.body),
  });
  return new Response(
    JSON.stringify({
      id: 'deepseek-test-response',
      model: 'deepseek-v4-flash',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            reasoning_content: '先判断是否需要调用工具。',
            content: '我需要读取文件。',
            tool_calls: [
              {
                id: 'call_read',
                type: 'function',
                function: {
                  name: 'read_file',
                  arguments: '{"path":"README.md"}',
                },
              },
            ],
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        prompt_cache_hit_tokens: 2,
        prompt_cache_miss_tokens: 8,
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
};

const provider = new DeepSeekProvider({
  apiKey: 'sk-test',
  fetchImpl: fetchMock,
});

const response = await provider.generate({
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  messages: [
    {
      role: 'system',
      parts: [{ type: 'text', text: '你是 CCR。' }],
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: '读取 README' }],
    },
  ],
  tools: [
    {
      name: 'read_file',
      description: 'Read a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
      },
    },
  ],
});

assert.equal(requests.length, 1);
assert.equal(requests[0].url, 'https://api.deepseek.com/chat/completions');
assert.equal(requests[0].body.model, 'deepseek-v4-flash');
assert.equal(requests[0].body.stream, false);
assert.deepEqual(requests[0].body.thinking, { type: 'enabled' });
assert.equal(requests[0].body.reasoning_effort, 'high');
assert.equal(requests[0].body.tools.length, 1);
assert.equal(response.provider, 'deepseek');
assert.equal(response.model, 'deepseek-v4-flash');
assert.equal(response.stopReason, 'tool_use');
assert.equal(response.output[0].type, 'thinking');
assert.equal(response.output[1].type, 'text');
assert.equal(response.output[2].type, 'tool_call');
assert.deepEqual(response.output[2].input, { path: 'README.md' });
assert.equal(response.usage.inputTokens, 10);
assert.equal(response.usage.cacheReadInputTokens, 2);

console.log(
  JSON.stringify(
    {
      ok: true,
      request: requests[0].body,
      response,
    },
    null,
    2,
  ),
);
