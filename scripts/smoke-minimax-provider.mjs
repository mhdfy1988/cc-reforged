import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const {
  MiniMaxChinaProvider,
  MiniMaxInternationalProvider,
} = await import('../dist/src/services/llm/providers/MiniMaxProvider.js');
const {
  getLlmRuntimeAuthStatusSyncForProvider,
} = await import('../dist/src/services/llm/runtimeStatus.js');
const {
  testCoreModelConnection,
} = await import('../dist/src/core/modelCore.js');

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-minimax-provider-'));
const previousEnv = new Map();
const envNamesToClear = [
  'CCR_LLM_CONFIG_PATH',
  'CCR_LLM_CREDENTIALS_PATH',
  'CCR_MINIMAX_API_KEY',
  'MINIMAX_API_KEY',
  'CCR_MINIMAX_BASE_URL',
  'MINIMAX_BASE_URL',
  'CCR_MINIMAX_CN_API_KEY',
  'MINIMAX_CN_API_KEY',
  'CCR_MINIMAXI_API_KEY',
  'MINIMAXI_API_KEY',
  'CCR_MINIMAX_CN_BASE_URL',
  'MINIMAX_CN_BASE_URL',
  'CCR_MINIMAXI_BASE_URL',
  'MINIMAXI_BASE_URL',
];

for (const name of envNamesToClear) {
  previousEnv.set(name, process.env[name]);
  delete process.env[name];
}

process.env.CCR_LLM_CONFIG_PATH = join(tempDir, 'llm.config.local.json');
process.env.CCR_LLM_CREDENTIALS_PATH = join(
  tempDir,
  'llm.credentials.local.json',
);

const requests = [];
const fetchMock = async (url, init) => {
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const body = JSON.parse(init.body);
  requests.push({
    url,
    init,
    headers,
    body,
  });

  if (body.stream) {
    return new Response(
      [
        sse('message_start', {
          type: 'message_start',
          message: anthropicMessage({
            id: 'msg_stream',
            model: body.model,
            content: [],
            stopReason: null,
            inputTokens: 5,
            outputTokens: 0,
          }),
        }),
        sse('content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'text',
            text: '',
            citations: null,
          },
        }),
        sse('content_block_delta', {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: 'MiniMax',
          },
        }),
        sse('content_block_delta', {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: ' Stream OK',
          },
        }),
        sse('content_block_stop', {
          type: 'content_block_stop',
          index: 0,
        }),
        sse('message_delta', {
          type: 'message_delta',
          delta: {
            stop_reason: 'end_turn',
            stop_sequence: null,
          },
          usage: {
            input_tokens: 5,
            output_tokens: 4,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
            server_tool_use: null,
          },
        }),
        sse('message_stop', {
          type: 'message_stop',
        }),
      ].join(''),
      {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      },
    );
  }

  const responseContent = [
    {
      type: 'text',
      text: 'MiniMax OK',
      citations: null,
    },
  ];
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    responseContent.push({
      type: 'tool_use',
      id: 'toolu_1',
      name: 'read_file',
      input: { path: 'README.md' },
    });
  }

  return new Response(
    JSON.stringify(
      anthropicMessage({
        id: 'msg_generate',
        model: body.model,
        content: responseContent,
        stopReason: responseContent.length > 1 ? 'tool_use' : 'end_turn',
        inputTokens: 8,
        outputTokens: 3,
      }),
    ),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
};

try {
  writeFileSync(
    process.env.CCR_LLM_CONFIG_PATH,
    JSON.stringify(
      {
        schemaVersion: 2,
        current: {
          profileId: 'minimax-intl-1',
          model: 'MiniMax-M2.7',
        },
        profiles: {
          'minimax-intl-1': {
            name: 'MiniMax 国际版',
            providerType: 'minimax',
            apiMode: 'anthropic-messages',
            endpoint: {
              baseUrl: 'https://api.minimax.io/anthropic',
            },
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'MiniMax-M2.7',
            models: {
              source: 'builtin',
              default: 'MiniMax-M2.7',
              include: ['MiniMax-M2.7-highspeed'],
            },
          },
          'minimax-cn-1': {
            name: 'MiniMax 国内版',
            providerType: 'minimax-cn',
            apiMode: 'anthropic-messages',
            endpoint: {
              baseUrl: 'https://api.minimaxi.com/anthropic',
            },
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'MiniMax-M2.7',
            models: {
              source: 'builtin',
              default: 'MiniMax-M2.7',
              include: ['MiniMax-M2.7-highspeed'],
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
          'minimax-intl-1': {
            type: 'api_key',
            providerType: 'minimax',
            apiKey: 'sk-minimax-intl',
          },
          'minimax-cn-1': {
            type: 'api_key',
            providerType: 'minimax-cn',
            apiKey: 'sk-minimax-cn',
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const internationalProvider = new MiniMaxInternationalProvider({
    fetchImpl: fetchMock,
  });
  const chinaProvider = new MiniMaxChinaProvider({
    fetchImpl: fetchMock,
  });

  const internationalAuth = getLlmRuntimeAuthStatusSyncForProvider({
    profileId: 'minimax-intl-1',
    provider: 'minimax',
    model: 'MiniMax-M2.7',
  });
  const chinaAuth = getLlmRuntimeAuthStatusSyncForProvider({
    profileId: 'minimax-cn-1',
    provider: 'minimax-cn',
    model: 'MiniMax-M2.7',
  });

  assert.equal(internationalAuth.state, 'available');
  assert.equal(internationalAuth.source, process.env.CCR_LLM_CREDENTIALS_PATH);
  assert.equal(chinaAuth.state, 'available');
  assert.equal(chinaAuth.source, process.env.CCR_LLM_CREDENTIALS_PATH);

  const internationalResponse = await internationalProvider.generate({
    provider: 'minimax',
    profileId: 'minimax-intl-1',
    model: 'MiniMax-M2.7-highspeed',
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'ping intl' }],
      },
    ],
    maxOutputTokens: 32000,
    temperature: 0,
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

  const chinaResponse = await chinaProvider.generate({
    provider: 'minimax-cn',
    profileId: 'minimax-cn-1',
    messages: [
      {
        role: 'system',
        parts: [{ type: 'text', text: 'rule one' }],
      },
      {
        role: 'system',
        parts: [{ type: 'text', text: 'rule two' }],
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'ping cn' }],
      },
    ],
    maxOutputTokens: 512,
    temperature: 0.7,
  });

  const streamEvents = [];
  for await (const event of chinaProvider.stream({
    provider: 'minimax-cn',
    profileId: 'minimax-cn-1',
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'stream cn' }],
      },
    ],
    maxOutputTokens: 32000,
  })) {
    streamEvents.push(event);
  }

  const previousFetch = globalThis.fetch;
  let connectionTest;
  try {
    globalThis.fetch = fetchMock;
    connectionTest = await testCoreModelConnection({
      profileId: 'minimax-cn-1',
      provider: 'minimax-cn',
      model: 'MiniMax-M2.7',
    });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(requests.length, 4);
  assert.equal(
    requests[0].url,
    'https://api.minimax.io/anthropic/v1/messages',
  );
  assert.equal(requests[0].headers['x-api-key'], 'sk-minimax-intl');
  assert.equal(requests[0].body.model, 'MiniMax-M2.7-highspeed');
  assert.equal(requests[0].body.stream, false);
  assert.equal(requests[0].body.max_tokens, 32000);
  assert.equal(requests[0].body.temperature, 0);
  assert.equal(requests[0].body.tools[0].name, 'read_file');
  assert.deepEqual(requests[0].body.tool_choice, { type: 'auto' });
  assert.equal(internationalResponse.provider, 'minimax');
  assert.equal(internationalResponse.model, 'MiniMax-M2.7-highspeed');
  assert.equal(internationalResponse.output[0].text, 'MiniMax OK');
  assert.equal(internationalResponse.output[1].type, 'tool_call');
  assert.equal(internationalResponse.stopReason, 'tool_use');

  assert.equal(
    requests[1].url,
    'https://api.minimaxi.com/anthropic/v1/messages',
  );
  assert.equal(requests[1].headers['x-api-key'], 'sk-minimax-cn');
  assert.equal(requests[1].body.model, 'MiniMax-M2.7');
  assert.equal(requests[1].body.stream, false);
  assert.equal(requests[1].body.max_tokens, 512);
  assert.equal(requests[1].body.temperature, 0.7);
  assert.equal(requests[1].body.system, 'rule one\n\nrule two');
  assert.deepEqual(
    requests[1].body.messages.map(message => message.role),
    ['user'],
  );
  assert.equal(chinaResponse.provider, 'minimax-cn');
  assert.equal(chinaResponse.model, 'MiniMax-M2.7');
  assert.equal(chinaResponse.output[0].text, 'MiniMax OK');

  assert.equal(requests[2].body.stream, true);
  assert.equal(requests[2].body.max_tokens, 32000);
  assert.deepEqual(
    streamEvents.map(event => event.type),
    ['content_part', 'content_part', 'response_complete'],
  );
  assert.equal(streamEvents[0].part.text, 'MiniMax');
  assert.equal(streamEvents[1].part.text, ' Stream OK');
  assert.equal(streamEvents[2].response.output[0].text, 'MiniMax Stream OK');
  assert.equal(
    requests[3].url,
    'https://api.minimaxi.com/anthropic/v1/messages',
  );
  assert.equal(requests[3].body.model, 'MiniMax-M2.7');
  assert.equal(requests[3].body.max_tokens, 32);
  assert.equal(connectionTest.ok, true);
  assert.equal(connectionTest.state, 'verified');
  assert.equal(connectionTest.networkChecked, true);
  assert.equal(connectionTest.profileId, 'minimax-cn-1');

  console.log(
    JSON.stringify(
      {
        ok: true,
        requests: requests.map(request => ({
          url: request.url,
          model: request.body.model,
          keys: Object.keys(request.body),
        })),
        internationalAuth,
        chinaAuth,
        internationalResponse,
        chinaResponse,
      },
      null,
      2,
    ),
  );
} finally {
  for (const [name, value] of previousEnv) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  rmSync(tempDir, { recursive: true, force: true });
}

function anthropicMessage({
  id,
  model,
  content,
  stopReason,
  inputTokens,
  outputTokens,
}) {
  return {
    id,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
