import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-llm-status-'));
const configPath = join(tempDir, 'llm.config.local.json');

try {
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        current: {
          profileId: 'codex-oauth-1',
          model: 'gpt-5.4',
        },
        profiles: {
          'codex-oauth-1': {
            name: 'Codex OAuth 登录配置',
            providerType: 'codex-oauth',
            apiMode: 'openai-responses',
            auth: {
              strategy: 'oauth_refreshable',
            },
            defaultModel: 'gpt-5.4',
            models: {
              source: 'mixed',
              default: 'gpt-5.4',
              include: ['gpt-5.5', 'gpt-5.4-mini'],
            },
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  process.env.CCR_LLM_CONFIG_PATH = configPath;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;

  const {
    getLlmRuntimeAuthStatusSync,
    getLlmRuntimeDisplayStatus,
  } = await import(
    '../dist/src/services/llm/runtimeStatus.js'
  );

  const status = getLlmRuntimeDisplayStatus();
  assert.equal(status.providerId, 'codex-oauth');
  assert.equal(status.apiMode, 'openai-responses');
  assert.equal(status.authStrategy, 'oauth_refreshable');
  assert.equal(status.modelCatalogEntry.displayName, 'GPT-5.4');
  assert.equal(status.modelCatalogEntry.contextWindow, 200000);
  assert.equal(status.modelCatalogEntry.maxOutputTokens, 32000);
  assert.equal(status.modelCatalogEntry.supportsTools, true);
  assert.equal(status.modelCatalogEntry.inputModalities.join(','), 'text');

  process.env.CCR_LLM_PROVIDER = 'deepseek';
  process.env.CCR_LLM_MODEL = 'deepseek-v4-pro';
  process.env.CCR_DEEPSEEK_API_KEY = 'sk-test';

  const deepSeekStatus = getLlmRuntimeDisplayStatus();
  const deepSeekAuth = getLlmRuntimeAuthStatusSync();
  assert.equal(deepSeekStatus.providerId, 'deepseek');
  assert.equal(deepSeekStatus.apiMode, 'openai-chat');
  assert.equal(deepSeekStatus.authStrategy, 'api_key');
  assert.equal(deepSeekStatus.modelCatalogEntry.displayName, 'DeepSeek V4 Pro');
  assert.equal(deepSeekStatus.modelCatalogEntry.contextWindow, 1000000);
  assert.equal(deepSeekStatus.modelCatalogEntry.maxOutputTokens, 384000);
  assert.equal(deepSeekStatus.modelCatalogEntry.supportsReasoning, true);
  assert.equal(deepSeekStatus.modelCatalogEntry.supportsTools, true);
  assert.equal(deepSeekAuth.available, true);
  assert.equal(deepSeekAuth.source, 'CCR_DEEPSEEK_API_KEY');

  process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-should-not-win';
  process.env.CCR_LLM_PROVIDER = 'kimi-api';
  process.env.CCR_LLM_MODEL = 'kimi-k2.6';
  process.env.CCR_KIMI_API_KEY = 'kimi-test';

  const kimiAuth = getLlmRuntimeAuthStatusSync();
  assert.equal(kimiAuth.available, true);
  assert.equal(kimiAuth.source, 'CCR_KIMI_API_KEY');

  process.env.CCR_LLM_PROVIDER = 'glm-api';
  process.env.CCR_LLM_MODEL = 'glm-5.1';
  process.env.CCR_GLM_API_KEY = 'glm-test';

  const glmAuth = getLlmRuntimeAuthStatusSync();
  assert.equal(glmAuth.available, true);
  assert.equal(glmAuth.source, 'CCR_GLM_API_KEY');

  console.log(
    JSON.stringify(
      {
        ok: true,
        status,
        deepSeekStatus,
        deepSeekAuth,
        kimiAuth,
        glmAuth,
      },
      null,
      2,
    ),
  );
} finally {
  delete process.env.CCR_LLM_CONFIG_PATH;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;
  delete process.env.CCR_DEEPSEEK_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CCR_KIMI_API_KEY;
  delete process.env.CCR_GLM_API_KEY;
  rmSync(tempDir, { recursive: true, force: true });
}
