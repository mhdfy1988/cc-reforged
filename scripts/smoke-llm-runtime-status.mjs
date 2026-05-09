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

  process.env.CLAUDE_CODE_LLM_CONFIG_PATH = configPath;
  delete process.env.CLAUDE_CODE_LLM_PROVIDER;
  delete process.env.CLAUDE_CODE_LLM_MODEL;

  const { getLlmRuntimeDisplayStatus } = await import(
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        status,
      },
      null,
      2,
    ),
  );
} finally {
  delete process.env.CLAUDE_CODE_LLM_CONFIG_PATH;
  delete process.env.CLAUDE_CODE_LLM_PROVIDER;
  delete process.env.CLAUDE_CODE_LLM_MODEL;
  rmSync(tempDir, { recursive: true, force: true });
}
