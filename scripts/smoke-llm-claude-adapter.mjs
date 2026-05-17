import assert from 'node:assert/strict';

const { createLlmRuntime } = await import('../dist/src/services/llm/llmRuntime.js');
const {
  buildLlmQueryRequest,
  queryWithLlmRuntime,
} = await import('../dist/src/services/llm/claudeApiAdapter.js');
const {
  createAssistantMessage,
  createUserMessage,
} = await import('../dist/src/utils/messages.js');
const { getDefaultSonnetModel } = await import('../dist/src/utils/model/model.js');
const { asSystemPrompt } = await import('../dist/src/utils/systemPromptType.js');

const mockProvider = {
  name: 'codex-oauth',
  supportsStreaming: true,
  async generate() {
    throw new Error('generate should not be called in this smoke');
  },
  async *stream(request) {
    yield {
      type: 'thinking_start',
      provider: request.provider,
      model: request.model,
      contentIndex: 0,
    };
    yield {
      type: 'thinking_delta',
      provider: request.provider,
      model: request.model,
      contentIndex: 0,
      delta: 'plan first',
    };
    yield {
      type: 'thinking_end',
      provider: request.provider,
      model: request.model,
      contentIndex: 0,
      content: 'plan first',
    };
    yield {
      type: 'content_part',
      provider: request.provider,
      model: request.model,
      contentIndex: 1,
      part: { type: 'text', text: 'hello ' },
    };
    yield {
      type: 'content_part',
      provider: request.provider,
      model: request.model,
      contentIndex: 1,
      part: { type: 'text', text: 'from codex' },
    };
    yield {
      type: 'content_part',
      provider: request.provider,
      model: request.model,
      contentIndex: 2,
      part: {
        type: 'tool_call',
        id: 'toolu_smoke_1',
        name: 'Read',
        input: { file_path: 'README.md' },
      },
    };
    yield {
      type: 'response_complete',
      provider: request.provider,
      model: request.model,
      response: {
        provider: request.provider,
        model: request.model,
        output: [
          { type: 'thinking', thinking: 'plan first', signature: 'sig_smoke_1' },
          { type: 'text', text: 'hello from codex' },
          {
            type: 'tool_call',
            id: 'toolu_smoke_1',
            name: 'Read',
            input: { file_path: 'README.md' },
          },
        ],
        stopReason: 'tool_use',
        usage: {
          inputTokens: 11,
          outputTokens: 7,
          totalTokens: 18,
        },
        raw: {
          message: {
            id: 'resp_smoke_1',
          },
        },
      },
    };
  },
};

const runtime = createLlmRuntime({
  defaultProvider: 'codex-oauth',
  defaultModel: 'gpt-5.4',
});
runtime.registerProvider(mockProvider);

const assistantWithToolUse = createAssistantMessage({
  content: [
    { type: 'text', text: 'let me read that file' },
    { type: 'thinking', thinking: 'previous plan', signature: 'sig_prev_1' },
    {
      type: 'tool_use',
      id: 'toolu_prev_1',
      name: 'Read',
      input: { file_path: 'package.json' },
    },
  ],
});
const toolResultMessage = createUserMessage({
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'toolu_prev_1',
      content: 'file content',
      is_error: false,
    },
  ],
});

const request = buildLlmQueryRequest({
  config: {
    provider: 'codex-oauth',
    model: 'gpt-5.4',
    providers: {},
    path: 'smoke',
    source: 'default',
  },
  messages: [
    createUserMessage({ content: 'hello' }),
    assistantWithToolUse,
    toolResultMessage,
  ],
  systemPrompt: asSystemPrompt(['system line one', 'system line two']),
  toolSchemas: [
    {
      name: 'Read',
      description: 'Read a file',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
        },
      },
    },
  ],
  signal: new AbortController().signal,
  model: 'gpt-5.4',
  maxOutputTokens: 1234,
  temperature: 0.5,
  reasoningEffort: 'high',
});

assert.equal(request.provider, 'codex-oauth');
assert.equal(request.model, 'gpt-5.4');
assert.equal(request.maxOutputTokens, 1234);
assert.equal(request.temperature, 0.5);
assert.equal(request.metadata.reasoningEffort, 'high');
assert.equal(request.messages.length, 5);
assert.equal(request.messages[0].role, 'system');
assert.equal(request.messages[2].role, 'user');
assert.equal(request.messages[3].role, 'assistant');
assert.equal(request.messages[3].parts[1].type, 'thinking');
assert.equal(request.messages[4].role, 'tool');
assert.equal(request.tools.length, 1);
assert.equal(request.tools[0].name, 'Read');

const mixedToolAndUserRequest = buildLlmQueryRequest({
  config: {
    provider: 'codex-oauth',
    model: 'gpt-5.4',
    providers: {},
    path: 'smoke',
    source: 'default',
  },
  messages: [
    createUserMessage({ content: 'before mixed turn' }),
    assistantWithToolUse,
    createUserMessage({
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_prev_1',
          content: 'file content',
          is_error: false,
        },
        {
          type: 'text',
          text: '测下',
        },
      ],
    }),
  ],
  systemPrompt: asSystemPrompt([]),
  toolSchemas: [],
  signal: new AbortController().signal,
  model: 'gpt-5.4',
});

const mixedAssistantIndex = mixedToolAndUserRequest.messages.findIndex(
  message => message.role === 'assistant',
);
assert.notEqual(mixedAssistantIndex, -1);
assert.equal(
  mixedToolAndUserRequest.messages[mixedAssistantIndex + 1].role,
  'tool',
);
assert.equal(
  mixedToolAndUserRequest.messages[mixedAssistantIndex + 1].parts[0].type,
  'tool_result',
);
assert.equal(
  mixedToolAndUserRequest.messages[mixedAssistantIndex + 1].parts[0].toolCallId,
  'toolu_prev_1',
);
assert.equal(
  mixedToolAndUserRequest.messages[mixedAssistantIndex + 2].role,
  'user',
);
assert.equal(
  mixedToolAndUserRequest.messages[mixedAssistantIndex + 2].parts[0].text,
  '测下',
);

const inheritedDefaultModelRequest = buildLlmQueryRequest({
  config: {
    provider: 'codex-oauth',
    model: 'gpt-5.4',
    providers: {},
    path: 'smoke',
    source: 'default',
  },
  messages: [createUserMessage({ content: 'hello' })],
  systemPrompt: asSystemPrompt([]),
  toolSchemas: [],
  signal: new AbortController().signal,
  model: getDefaultSonnetModel(),
});

assert.equal(inheritedDefaultModelRequest.model, 'gpt-5.4');

const emitted = [];
for await (const message of queryWithLlmRuntime({
  runtime,
  config: {
    provider: 'codex-oauth',
    model: 'gpt-5.4',
    providers: {},
    path: 'smoke',
    source: 'default',
  },
  messages: [
    createUserMessage({ content: 'hello' }),
    assistantWithToolUse,
    toolResultMessage,
  ],
  systemPrompt: asSystemPrompt(['system line one']),
  toolSchemas: [
    {
      name: 'Read',
      description: 'Read a file',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
        },
      },
    },
  ],
  signal: new AbortController().signal,
  model: 'gpt-5.4',
  maxOutputTokens: 1234,
  temperature: 0.5,
  reasoningEffort: 'high',
})) {
  emitted.push(message);
}

assert.ok(
  emitted.some(
    message =>
      message.type === 'stream_event' &&
      message.event.type === 'content_block_delta' &&
      message.event.delta.type === 'thinking_delta' &&
      message.event.delta.thinking === 'plan first',
  ),
);

const textBlockStarts = emitted.filter(
  message =>
    message.type === 'stream_event' &&
    message.event.type === 'content_block_start' &&
    message.event.content_block.type === 'text',
);
assert.equal(textBlockStarts.length, 1);

const textDeltas = emitted
  .filter(
    message =>
      message.type === 'stream_event' &&
      message.event.type === 'content_block_delta' &&
      message.event.delta.type === 'text_delta',
  )
  .map(message => message.event.delta.text);
assert.deepEqual(textDeltas, ['hello ', 'from codex']);

const finalAssistant = emitted.find(message => message.type === 'assistant');
assert.ok(finalAssistant, 'expected final assistant message');
assert.equal(finalAssistant.requestId, 'resp_smoke_1');
assert.equal(finalAssistant.message.model, 'gpt-5.4');
assert.equal(finalAssistant.message.stop_reason, 'tool_use');
assert.equal(finalAssistant.message.usage.input_tokens, 11);
assert.equal(finalAssistant.message.usage.output_tokens, 7);
assert.ok(
  finalAssistant.message.content.some(
    block => block.type === 'thinking' && block.thinking === 'plan first',
  ),
);
assert.ok(
  finalAssistant.message.content.some(
    block =>
      block.type === 'tool_use' &&
      block.id === 'toolu_smoke_1' &&
      block.name === 'Read',
  ),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      emittedCount: emitted.length,
      finalRequestId: finalAssistant.requestId,
      finalStopReason: finalAssistant.message.stop_reason,
    },
    null,
    2,
  ),
);
