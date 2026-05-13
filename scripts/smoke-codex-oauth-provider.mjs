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
    assert.equal(context.messages[1]?.content[1]?.type, 'thinking');
    assert.equal(context.messages[1]?.content[2]?.type, 'toolCall');
    assert.equal(context.messages[2]?.role, 'toolResult');
    assert.equal(context.messages[2]?.toolCallId, 'call_1');
    assert.equal(context.messages[2]?.toolName, 'get_time');
    assert.equal(context.tools?.length, 1);
    assert.equal(context.tools?.[0]?.name, 'get_time');
    assert.equal(options?.apiKey, 'access-token');
    assert.equal(options?.transport, 'sse');
    assert.equal(options?.reasoningEffort, 'high');
    assert.equal(options?.reasoning, undefined);
    assert.equal(options?.temperature, undefined);
    return {
      role: 'assistant',
      api: 'openai-codex-responses',
      provider: 'openai-codex',
      model: 'gpt-5.4',
      content: [
        { type: 'thinking', thinking: 'oauth thinking' },
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
    assert.equal(options?.temperature, undefined);

    const finalMessage = {
      role: 'assistant',
      api: 'openai-codex-responses',
      provider: 'openai-codex',
      model: 'gpt-5.4',
      content: [
        { type: 'thinking', thinking: 'stream plan' },
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
          type: 'thinking_start',
          contentIndex: 0,
          partial: finalMessage,
        };
        yield {
          type: 'thinking_delta',
          contentIndex: 0,
          delta: 'stream ',
          partial: finalMessage,
        };
        yield {
          type: 'thinking_end',
          contentIndex: 0,
          content: 'stream plan',
          partial: finalMessage,
        };
        yield {
          type: 'text_delta',
          contentIndex: 1,
          delta: 'streamed ',
          partial: finalMessage,
        };
        yield {
          type: 'text_delta',
          contentIndex: 1,
          delta: 'answer',
          partial: finalMessage,
        };
        yield {
          type: 'toolcall_end',
          contentIndex: 2,
          toolCall: finalMessage.content[2],
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
        { type: 'thinking', thinking: '需要先确认工具输入。' },
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
assert.equal(result.output.length, 3);
assert.equal(result.output[0]?.type, 'thinking');
assert.equal(result.output[0]?.thinking, 'oauth thinking');
assert.equal(result.output[1]?.type, 'text');
assert.equal(result.output[1]?.text, 'oauth summary');
assert.equal(result.output[2]?.type, 'tool_call');
assert.equal(result.output[2]?.name, 'get_weather');
assert.deepEqual(result.output[2]?.input, { city: 'Hangzhou' });
assert.equal(result.stopReason, 'tool_use');
assert.equal(result.usage?.inputTokens, 12);
assert.equal(result.usage?.outputTokens, 34);
assert.equal(result.usage?.cacheReadInputTokens, 5);

const events = [];
for await (const event of provider.stream(request)) {
  events.push(event);
}

assert.equal(sessionCalls, 2);
assert.equal(events.length, 7);
assert.equal(events[0]?.type, 'thinking_start');
assert.equal(events[0]?.contentIndex, 0);
assert.equal(events[1]?.type, 'thinking_delta');
assert.equal(events[1]?.delta, 'stream ');
assert.equal(events[2]?.type, 'thinking_end');
assert.equal(events[2]?.content, 'stream plan');
assert.equal(events[3]?.type, 'content_part');
assert.equal(events[3]?.contentIndex, 1);
assert.equal(events[3]?.part?.type, 'text');
assert.equal(events[3]?.part?.text, 'streamed ');
assert.equal(events[4]?.type, 'content_part');
assert.equal(events[4]?.part?.type, 'text');
assert.equal(events[4]?.part?.text, 'answer');
assert.equal(events[5]?.type, 'content_part');
assert.equal(events[5]?.contentIndex, 2);
assert.equal(events[5]?.part?.type, 'tool_call');
assert.equal(events[5]?.part?.name, 'get_weather');
assert.equal(events[6]?.type, 'response_complete');
assert.equal(events[6]?.response?.stopReason, 'tool_use');
assert.equal(events[6]?.response?.usage?.totalTokens, 30);
assert.equal(events[6]?.response?.output[2]?.type, 'tool_call');

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
