import assert from 'node:assert/strict';

const { CodexOAuthProvider } = await import(
  '../dist/src/services/llm/providers/CodexOAuthProvider.js'
);

let sessionCalls = 0;
const provider = new CodexOAuthProvider({
  session: {
    async getAvailability() {
      return {
        available: true,
        configured: true,
        reason: 'ready',
      };
    },
    async getValidCredential() {
      sessionCalls += 1;
      return {
        access: 'access-token',
        accountId: 'account-1',
      };
    },
  },
  completeImpl: async (model, context, options) => {
    assert.equal(model.provider, 'openai-codex');
    assert.equal(model.api, 'openai-codex-responses');
    assert.equal(model.baseUrl, 'https://chatgpt.com/backend-api');
    assert.equal(context.systemPrompt, 'Be brief.');
    assert.equal(context.messages.length, 3);
    assert.equal(context.messages[0]?.role, 'user');
    assert.equal(context.messages[0]?.content, '先问一句');
    assert.equal(context.messages[1]?.role, 'assistant');
    assert.equal(context.messages[1]?.content[0]?.type, 'text');
    assert.equal(context.messages[1]?.content[1]?.type, 'toolCall');
    assert.equal(context.messages[2]?.role, 'toolResult');
    assert.equal(context.messages[2]?.toolCallId, 'call_1');
    assert.equal(context.messages[2]?.toolName, 'get_time');
    assert.equal(context.tools?.length, 1);
    assert.equal(context.tools?.[0]?.name, 'get_time');
    assert.equal(options?.apiKey, 'access-token');
    assert.equal(options?.transport, 'sse');
    assert.equal(options?.reasoningEffort, 'high');
    assert.equal(options?.reasoning, undefined);
    return {
      role: 'assistant',
      api: 'openai-codex-responses',
      provider: 'openai-codex',
      model: 'gpt-5.4',
      content: [
        { type: 'text', text: 'oauth summary' },
        {
          type: 'toolCall',
          id: 'call_2',
          name: 'get_weather',
          arguments: { city: 'Hangzhou' },
        },
      ],
      usage: {
        input: 12,
        output: 34,
        cacheRead: 5,
        cacheWrite: 0,
        totalTokens: 51,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: 'toolUse',
      timestamp: Date.now(),
    };
  },
  streamImpl: (model, context, options) => {
    assert.equal(model.provider, 'openai-codex');
    assert.equal(context.messages.length, 3);
    assert.equal(context.tools?.[0]?.name, 'get_time');
    assert.equal(options?.transport, 'sse');
    assert.equal(options?.reasoningEffort, 'high');
    assert.equal(options?.reasoning, undefined);

    const finalMessage = {
      role: 'assistant',
      api: 'openai-codex-responses',
      provider: 'openai-codex',
      model: 'gpt-5.4',
      content: [
        { type: 'text', text: 'streamed answer' },
        {
          type: 'toolCall',
          id: 'call_stream',
          name: 'get_weather',
          arguments: { city: 'Shaoxing' },
        },
      ],
      usage: {
        input: 20,
        output: 10,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 30,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: 'toolUse',
      timestamp: Date.now(),
    };

    return {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'start',
          partial: finalMessage,
        };
        yield {
          type: 'text_delta',
          contentIndex: 0,
          delta: 'streamed ',
          partial: finalMessage,
        };
        yield {
          type: 'text_delta',
          contentIndex: 0,
          delta: 'answer',
          partial: finalMessage,
        };
        yield {
          type: 'toolcall_end',
          contentIndex: 1,
          toolCall: finalMessage.content[1],
          partial: finalMessage,
        };
        yield {
          type: 'done',
          reason: 'toolUse',
          message: finalMessage,
        };
      },
      async result() {
        return finalMessage;
      },
    };
  },
});

const availability = await provider.getAvailability();
assert.equal(availability.available, true);

const request = {
  provider: 'codex-oauth',
  model: 'gpt-5.4',
  messages: [
    {
      role: 'system',
      parts: [{ type: 'text', text: 'Be brief.' }],
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: '先问一句' }],
    },
    {
      role: 'assistant',
      parts: [
        { type: 'text', text: '我先查一下' },
        {
          type: 'tool_call',
          id: 'call_1',
          name: 'get_time',
          input: { timezone: 'Asia/Shanghai' },
        },
      ],
    },
    {
      role: 'tool',
      name: 'get_time',
      parts: [
        {
          type: 'tool_result',
          toolCallId: 'call_1',
          toolName: 'get_time',
          result: { now: '10:00' },
        },
      ],
    },
  ],
  tools: [
    {
      name: 'get_time',
      description: 'Get current time',
      inputSchema: {
        type: 'object',
        properties: {
          timezone: { type: 'string' },
        },
      },
    },
  ],
  metadata: {
    reasoningEffort: 'high',
  },
};

const result = await provider.generate(request);
assert.equal(sessionCalls, 1);
assert.equal(result.provider, 'codex-oauth');
assert.equal(result.model, 'gpt-5.4');
assert.equal(result.output.length, 2);
assert.equal(result.output[0]?.type, 'text');
assert.equal(result.output[0]?.text, 'oauth summary');
assert.equal(result.output[1]?.type, 'tool_call');
assert.equal(result.output[1]?.name, 'get_weather');
assert.deepEqual(result.output[1]?.input, { city: 'Hangzhou' });
assert.equal(result.stopReason, 'tool_use');
assert.equal(result.usage?.inputTokens, 12);
assert.equal(result.usage?.outputTokens, 34);
assert.equal(result.usage?.cacheReadInputTokens, 5);

const events = [];
for await (const event of provider.stream(request)) {
  events.push(event);
}

assert.equal(sessionCalls, 2);
assert.equal(events.length, 4);
assert.equal(events[0]?.type, 'content_part');
assert.equal(events[0]?.part?.type, 'text');
assert.equal(events[0]?.part?.text, 'streamed ');
assert.equal(events[1]?.type, 'content_part');
assert.equal(events[1]?.part?.type, 'text');
assert.equal(events[1]?.part?.text, 'answer');
assert.equal(events[2]?.type, 'content_part');
assert.equal(events[2]?.part?.type, 'tool_call');
assert.equal(events[2]?.part?.name, 'get_weather');
assert.equal(events[3]?.type, 'response_complete');
assert.equal(events[3]?.response?.stopReason, 'tool_use');
assert.equal(events[3]?.response?.usage?.totalTokens, 30);
assert.equal(events[3]?.response?.output[1]?.type, 'tool_call');

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: result.provider,
      model: result.model,
      stopReason: result.stopReason,
      streamEvents: events.map(event => event.type),
    },
    null,
    2,
  ),
);
