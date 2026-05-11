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
        provider: 'codex-oauth',
        providers: {
          'codex-oauth': {
            defaultModel: 'gpt-5.4',
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        status,
        deepSeekStatus,
        deepSeekAuth,
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
  rmSync(tempDir, { recursive: true, force: true });
}
