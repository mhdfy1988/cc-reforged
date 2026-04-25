import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-llm-config-'));
const configPath = join(tempDir, 'llm.config.local.json');

try {
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        provider: 'anthropic',
        providers: {
          anthropic: {
            defaultModel: 'file-model',
            displayName: 'Anthropic File Config',
            supportsTools: false,
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
    getDefaultLlmConfigPath,
    loadLlmConfig,
    validateLlmConfigForProviders,
  } = await import('../dist/src/services/llm/llmConfig.js');

  const fileConfig = loadLlmConfig();
  assert.equal(getDefaultLlmConfigPath().includes('llm.config.local.json'), true);
  assert.equal(fileConfig.provider, 'anthropic');
  assert.equal(fileConfig.model, 'file-model');
  assert.equal(fileConfig.source, 'file');
  assert.equal(fileConfig.providers.anthropic.authStrategy, 'hybrid');
  assert.equal(fileConfig.providers.anthropic.apiMode, 'anthropic-messages');
  assert.equal(fileConfig.providers.anthropic.supportsTools, false);
  assert.equal(
    fileConfig.providers['codex-oauth'].authStrategy,
    'oauth_refreshable',
  );
  assert.equal(fileConfig.providers['codex-oauth'].apiMode, 'openai-responses');

  process.env.CCR_LLM_PROVIDER = 'codex-oauth';
  process.env.CCR_LLM_MODEL = 'gpt-5.4';

  const envConfig = loadLlmConfig();
  assert.equal(envConfig.provider, 'codex-oauth');
  assert.equal(envConfig.model, 'gpt-5.4');
  assert.equal(envConfig.source, 'file+env');

  const invalidSelection = validateLlmConfigForProviders(envConfig, [
    'anthropic',
  ]);
  assert.equal(invalidSelection.valid, false);
  assert.match(invalidSelection.error, /not registered/i);

  const validSelection = validateLlmConfigForProviders(fileConfig, [
    'anthropic',
  ]);
  assert.equal(validSelection.valid, true);

  console.log(
    JSON.stringify(
      {
        ok: true,
        configPath,
        fileConfig,
        envConfig,
      },
      null,
      2,
    ),
  );
} finally {
  delete process.env.CCR_LLM_CONFIG_PATH;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;
  rmSync(tempDir, { recursive: true, force: true });
}
