import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { OpenAiChatCompletionsAdapter } = await import(
  '../dist/src/services/llm/protocols/openaiChatCompletionsAdapter.js'
);
const { AnthropicMessagesAdapter } = await import(
  '../dist/src/services/llm/protocols/anthropicMessagesAdapter.js'
);
const {
  buildLlmQueryRequest,
} = await import('../dist/src/services/llm/claudeApiAdapter.js');
const { createUserMessage } = await import('../dist/src/utils/messages.js');
const { asSystemPrompt } = await import('../dist/src/utils/systemPromptType.js');

const tempDir = await mkdtemp(join(tmpdir(), 'ccr-mm-provider-'));
const imagePath = join(tempDir, 'tiny.png');
const videoPath = join(tempDir, 'tiny.mp4');
const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const videoBytes = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
const imageBase64 = imageBytes.toString('base64');
const videoBase64 = videoBytes.toString('base64');
await writeFile(imagePath, imageBytes);
await writeFile(videoPath, videoBytes);

try {
  const queryRequest = buildLlmQueryRequest({
    config: {
      provider: 'codex-oauth',
      model: 'gpt-5.4',
      providers: {},
      path: 'smoke',
      source: 'default',
    },
    messages: [
      createUserMessage({
        content: [
          { type: 'text', text: 'describe this image' },
          {
            type: 'image',
            mimeType: 'image/png',
            source: { kind: 'file', path: imagePath },
            displayName: 'tiny.png',
            sizeBytes: imageBytes.length,
          },
          {
            type: 'video',
            mimeType: 'video/mp4',
            source: { kind: 'file', path: videoPath },
            displayName: 'tiny.mp4',
            sizeBytes: videoBytes.length,
          },
        ],
      }),
    ],
    systemPrompt: asSystemPrompt([]),
    toolSchemas: [],
    signal: new AbortController().signal,
    model: 'gpt-5.4',
  });

  assert.equal(queryRequest.messages.length, 1);
  assert.equal(queryRequest.messages[0].role, 'user');
  assert.equal(queryRequest.messages[0].parts[0].type, 'text');
  assert.equal(queryRequest.messages[0].parts[1].type, 'image');
  assert.equal(queryRequest.messages[0].parts[1].mimeType, 'image/png');
  assert.deepEqual(queryRequest.messages[0].parts[1].source, {
    kind: 'file',
    path: imagePath,
  });
  assert.equal(queryRequest.messages[0].parts[2].type, 'video');
  assert.equal(queryRequest.messages[0].parts[2].mimeType, 'video/mp4');
  assert.deepEqual(queryRequest.messages[0].parts[2].source, {
    kind: 'file',
    path: videoPath,
  });

  let openAiBody;
  const openAiAdapter = new OpenAiChatCompletionsAdapter({
    providerId: 'compatible',
    providerLabel: 'Compatible Relay',
    apiKey: 'sk-test',
    baseUrl: 'https://relay.example/v1',
    defaultModel: 'relay-model',
    fetchImpl: async (_url, init) => {
      openAiBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          id: 'openai-mm-response',
          model: 'relay-model',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: 'ok',
              },
            },
          ],
          usage: {
            prompt_tokens: 1,
            completion_tokens: 1,
            total_tokens: 2,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  });

  await openAiAdapter.generate({
    provider: 'compatible',
    model: 'relay-model',
    messages: queryRequest.messages,
  });

  const openAiContent = openAiBody.messages[0].content;
  assert.ok(Array.isArray(openAiContent));
  assert.deepEqual(openAiContent[0], {
    type: 'text',
    text: 'describe this image',
  });
  assert.equal(openAiContent[1].type, 'image_url');
  assert.equal(
    openAiContent[1].image_url.url,
    `data:image/png;base64,${imageBase64}`,
  );
  assert.equal(openAiContent[2].type, 'video_url');
  assert.equal(
    openAiContent[2].video_url.url,
    `data:video/mp4;base64,${videoBase64}`,
  );
  assert.equal(JSON.stringify(openAiBody).includes(imagePath), false);
  assert.equal(JSON.stringify(openAiBody).includes(videoPath), false);

  const failingOpenAiAdapter = new OpenAiChatCompletionsAdapter({
    providerId: 'compatible',
    providerLabel: 'Compatible Relay',
    apiKey: 'sk-test',
    baseUrl: 'https://relay.example/v1',
    defaultModel: 'relay-model',
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            message: 'bad request',
          },
        }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
        },
      ),
  });

  await assert.rejects(
    () =>
      failingOpenAiAdapter.generate({
        provider: 'compatible',
        model: 'relay-model',
        messages: queryRequest.messages,
      }),
    error => {
      const message = error instanceof Error ? error.message : String(error);
      assert.equal(message.includes(imagePath), false);
      assert.equal(message.includes(videoPath), false);
      assert.equal(message.includes(imageBase64), false);
      assert.equal(message.includes(videoBase64), false);
      assert.match(message, /imageContentPartCount/);
      assert.match(message, /videoContentPartCount/);
      return true;
    },
  );

  let anthropicBody;
  const anthropicAdapter = new AnthropicMessagesAdapter({
    providerId: 'anthropic-compatible',
    providerLabel: 'Anthropic Compatible',
    apiKey: 'sk-ant-test',
    baseUrl: 'https://anthropic.example',
    defaultModel: 'claude-smoke',
    fetchImpl: async (url, init) => {
      const request = url instanceof Request ? url : undefined;
      const rawBody =
        typeof init?.body === 'string'
          ? init.body
          : request
            ? await request.clone().text()
            : '{}';
      anthropicBody = JSON.parse(rawBody);
      return new Response(
        JSON.stringify({
          id: 'msg_mm_smoke',
          type: 'message',
          role: 'assistant',
          model: 'claude-smoke',
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 1,
            output_tokens: 1,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  });

  await anthropicAdapter.generate({
    provider: 'anthropic-compatible',
    model: 'claude-smoke',
    messages: queryRequest.messages,
  });

  const anthropicContent = anthropicBody.messages[0].content;
  assert.ok(Array.isArray(anthropicContent));
  assert.deepEqual(anthropicContent[0], {
    type: 'text',
    text: 'describe this image',
  });
  assert.deepEqual(anthropicContent[1], {
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: imageBase64,
    },
  });
  assert.equal(anthropicContent.length, 2);
  assert.equal(JSON.stringify(anthropicBody).includes(imagePath), false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'query_request_image_part',
          'query_request_video_part',
          'openai_chat_image_url_part',
          'openai_chat_video_url_part',
          'openai_error_diagnostics_hide_image_payload',
          'openai_error_diagnostics_hide_video_payload',
          'anthropic_messages_image_block',
          'provider_payloads_do_not_include_local_path',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
