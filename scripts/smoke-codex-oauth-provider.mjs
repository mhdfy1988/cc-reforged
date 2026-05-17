import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

const tempDir = await mkdtemp(join(tmpdir(), 'ccr-codex-oauth-image-'));
const imagePath = join(tempDir, 'tiny.png');
const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const imageBase64 = imageBytes.toString('base64');

let imageResult;
try {
  await writeFile(imagePath, imageBytes);

  const imageProvider = new CodexOAuthProvider({
    session: {
      async getAvailability() {
        return {
          available: true,
          configured: true,
          reason: 'ready',
        };
      },
      async getValidCredential() {
        return {
          access: 'access-token',
          accountId: 'account-1',
        };
      },
    },
    getModelImpl: () => {
      throw new Error('force catalog fallback');
    },
    completeImpl: async (model, context, options) => {
      assert.equal(model.id, 'gpt-5.5');
      assert.equal(model.input.includes('image'), true);
      assert.equal(context.messages.length, 1);
      assert.equal(context.messages[0]?.role, 'user');
      assert.ok(Array.isArray(context.messages[0]?.content));
      assert.deepEqual(context.messages[0]?.content[0], {
        type: 'text',
        text: '看一下这张图',
      });
      assert.deepEqual(context.messages[0]?.content[1], {
        type: 'image',
        data: imageBase64,
        mimeType: 'image/png',
      });
      assert.equal(JSON.stringify(context).includes(imagePath), false);
      assert.equal(JSON.stringify(context).includes('data:image'), false);
      assert.equal(options?.apiKey, 'access-token');

      return {
        role: 'assistant',
        api: 'openai-codex-responses',
        provider: 'openai-codex',
        model: 'gpt-5.5',
        content: [{ type: 'text', text: 'image ok' }],
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
          },
        },
        stopReason: 'stop',
        timestamp: Date.now(),
      };
    },
  });

  imageResult = await imageProvider.generate({
    provider: 'codex-oauth',
    model: 'gpt-5.5',
    messages: [
      {
        role: 'user',
        parts: [
          { type: 'text', text: '看一下这张图' },
          {
            type: 'image',
            mimeType: 'image/png',
            source: { kind: 'file', path: imagePath },
            displayName: 'tiny.png',
            sizeBytes: imageBytes.length,
          },
        ],
      },
    ],
  });
  assert.equal(imageResult.output[0]?.type, 'text');
  assert.equal(imageResult.output[0]?.text, 'image ok');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: result.provider,
      model: result.model,
      stopReason: result.stopReason,
      imageModel: imageResult?.model,
      streamEvents: events.map(event => event.type),
    },
    null,
    2,
  ),
);
