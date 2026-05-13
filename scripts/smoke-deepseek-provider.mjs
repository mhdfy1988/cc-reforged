import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { DeepSeekProvider } = await import(
  '../dist/src/services/llm/providers/DeepSeekProvider.js'
);

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-deepseek-provider-'));
const previousConfigPath = process.env.CCR_LLM_CONFIG_PATH;
const previousCredentialsPath = process.env.CCR_LLM_CREDENTIALS_PATH;
const previousCcrDeepSeekApiKey = process.env.CCR_DEEPSEEK_API_KEY;
const previousDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;
process.env.CCR_LLM_CONFIG_PATH = join(tempDir, 'llm.config.local.json');
process.env.CCR_LLM_CREDENTIALS_PATH = join(
  tempDir,
  'llm.credentials.local.json',
);
delete process.env.CCR_DEEPSEEK_API_KEY;
delete process.env.DEEPSEEK_API_KEY;

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

try {
  writeFileSync(
    process.env.CCR_LLM_CONFIG_PATH,
    JSON.stringify(
      {
        schemaVersion: 2,
        current: {
          profileId: 'deepseek-1',
          model: 'deepseek-v4-flash',
        },
        profiles: {
          'deepseek-1': {
            name: 'DeepSeek 账号 1',
            providerType: 'deepseek',
            apiMode: 'openai-chat',
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'deepseek-v4-flash',
            models: {
              source: 'mixed',
              default: 'deepseek-v4-flash',
            },
          },
          'deepseek-2': {
            name: 'DeepSeek 账号 2',
            providerType: 'deepseek',
            apiMode: 'openai-chat',
            endpoint: {
              baseUrl: 'https://api.deepseek.com',
            },
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'deepseek-v4-pro',
            models: {
              source: 'mixed',
              default: 'deepseek-v4-pro',
              include: ['deepseek-v4-flash'],
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
          'deepseek-1': {
            type: 'api_key',
            providerType: 'deepseek',
            apiKey: 'sk-profile-1',
          },
          'deepseek-2': {
            type: 'api_key',
            providerType: 'deepseek',
            apiKey: 'sk-profile-2',
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const provider = new DeepSeekProvider({
    fetchImpl: fetchMock,
  });

  const response = await provider.generate({
    provider: 'deepseek',
    profileId: 'deepseek-2',
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
  assert.equal(requests[0].init.headers.authorization, 'Bearer sk-profile-2');
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
        usedProfileId: 'deepseek-2',
        request: requests[0].body,
        response,
      },
      null,
      2,
    ),
  );
} finally {
  if (previousConfigPath === undefined) {
    delete process.env.CCR_LLM_CONFIG_PATH;
  } else {
    process.env.CCR_LLM_CONFIG_PATH = previousConfigPath;
  }
  if (previousCredentialsPath === undefined) {
    delete process.env.CCR_LLM_CREDENTIALS_PATH;
  } else {
    process.env.CCR_LLM_CREDENTIALS_PATH = previousCredentialsPath;
  }
  if (previousCcrDeepSeekApiKey === undefined) {
    delete process.env.CCR_DEEPSEEK_API_KEY;
  } else {
    process.env.CCR_DEEPSEEK_API_KEY = previousCcrDeepSeekApiKey;
  }
  if (previousDeepSeekApiKey === undefined) {
    delete process.env.DEEPSEEK_API_KEY;
  } else {
    process.env.DEEPSEEK_API_KEY = previousDeepSeekApiKey;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
