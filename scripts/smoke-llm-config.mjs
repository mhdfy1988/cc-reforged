import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-llm-config-'));
const configPath = join(tempDir, 'llm.config.local.json');
const credentialsPath = join(tempDir, 'llm.credentials.local.json');

try {
  process.env.CCR_LLM_CONFIG_PATH = configPath;
  process.env.CCR_LLM_CREDENTIALS_PATH = credentialsPath;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;

  const {
    getDefaultLlmConfigPath,
    loadLlmConfig,
    updatePersistedLlmConfig,
    upsertPersistedLlmProfile,
    validateLlmConfigForProviders,
  } = await import('../dist/src/services/llm/llmConfig.js');
  const {
    getDefaultLlmCredentialsPath,
    getLlmProviderApiKey,
    getLlmProfileOAuthCredential,
    updateLlmProviderApiKey,
    updateLlmProfileOAuthCredential,
  } = await import('../dist/src/services/llm/providerCredentials.js');

  const emptyConfig = loadLlmConfig();
  assert.equal(getDefaultLlmConfigPath().includes('llm.config.local.json'), true);
  assert.equal(emptyConfig.provider, '');
  assert.equal(emptyConfig.model, '');
  assert.equal(emptyConfig.currentProfileId, '');
  assert.deepEqual(emptyConfig.profiles, {});
  assert.equal(emptyConfig.source, 'default');
  assert.equal(emptyConfig.providers['codex-oauth'].authStrategy, 'oauth_refreshable');
  assert.equal(emptyConfig.providers['codex-oauth'].apiMode, 'openai-responses');
  assert.equal(emptyConfig.providers.deepseek.authStrategy, 'api_key');
  assert.equal(emptyConfig.providers.deepseek.apiMode, 'openai-chat');
  assert.equal(emptyConfig.providers.deepseek.defaultModel, 'deepseek-v4-flash');

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        current: {
          profileId: 'deepseek-1',
          model: 'deepseek-v4-pro',
        },
        providerOverrides: {
          anthropic: {
            defaultModel: 'override-model',
            displayName: 'Anthropic Override Config',
          },
        },
        profiles: {
          'deepseek-1': {
            name: 'DeepSeek Work Key',
            providerType: 'deepseek',
            apiMode: 'openai-chat',
            endpoint: {
              baseUrl: 'https://api.deepseek.example',
            },
            auth: {
              strategy: 'api_key',
            },
            models: {
              source: 'mixed',
              default: 'deepseek-v4-pro',
              include: ['deepseek-v4-flash'],
              custom: ['deepseek-custom'],
            },
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const fileConfig = loadLlmConfig();
  assert.equal(fileConfig.provider, 'deepseek');
  assert.equal(fileConfig.model, 'deepseek-v4-pro');
  assert.equal(fileConfig.currentProfileId, 'deepseek-1');
  assert.equal(fileConfig.profiles['deepseek-1'].providerType, 'deepseek');
  assert.equal(fileConfig.profiles['deepseek-1'].source, 'file');
  assert.equal(fileConfig.profiles['deepseek-1'].baseUrl, 'https://api.deepseek.example');
  assert.equal(fileConfig.profiles['deepseek-1'].defaultModel, 'deepseek-v4-pro');
  assert.deepEqual(fileConfig.profiles['deepseek-1'].models, [
    'deepseek-v4-pro',
    'deepseek-v4-flash',
    'deepseek-custom',
  ]);
  assert.equal(fileConfig.providers.anthropic.defaultModel, 'override-model');
  assert.deepEqual(Object.keys(fileConfig.profiles), ['deepseek-1']);

  await updatePersistedLlmConfig({
    model: 'deepseek-v4-flash',
    currentProfileId: 'deepseek-1',
  });
  const updatedConfigFile = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(updatedConfigFile.schemaVersion, 2);
  assert.equal(updatedConfigFile.provider, undefined);
  assert.equal(updatedConfigFile.model, undefined);
  assert.equal(updatedConfigFile.currentProfileId, undefined);
  assert.deepEqual(updatedConfigFile.current, {
    profileId: 'deepseek-1',
    model: 'deepseek-v4-flash',
  });

  await upsertPersistedLlmProfile({
    profileId: 'codex-oauth-1',
    profile: {
      name: 'Codex OAuth 登录配置',
      providerType: 'codex-oauth',
      apiMode: 'openai-responses',
      auth: {
        strategy: 'oauth_refreshable',
      },
      defaultModel: 'gpt-5.5',
      models: {
        source: 'mixed',
        default: 'gpt-5.5',
        include: ['gpt-5.4'],
      },
    },
    setCurrent: true,
  });
  const codexConfig = loadLlmConfig();
  assert.equal(codexConfig.provider, 'codex-oauth');
  assert.equal(codexConfig.model, 'gpt-5.5');
  assert.equal(codexConfig.currentProfileId, 'codex-oauth-1');

  const missingApiKey = getLlmProviderApiKey({
    provider: 'deepseek',
    profileId: 'deepseek-1',
    envNames: [],
  });
  assert.equal(missingApiKey.sourceType, 'missing');

  const savedApiKey = await updateLlmProviderApiKey({
    provider: 'deepseek',
    profileId: 'deepseek-1',
    apiKey: 'sk-smoke-deepseek-key',
  });
  assert.equal(savedApiKey.profileId, 'deepseek-1');
  assert.equal(savedApiKey.configured, true);

  const apiKey = getLlmProviderApiKey({
    provider: 'deepseek',
    profileId: 'deepseek-1',
    envNames: [],
  });
  assert.equal(apiKey.sourceType, 'file');
  assert.equal(apiKey.apiKey, 'sk-smoke-deepseek-key');

  await updateLlmProviderApiKey({
    provider: 'deepseek',
    profileId: 'deepseek-2',
    apiKey: 'sk-smoke-deepseek-key-2',
  });
  const firstApiKeyAfterSecondSave = getLlmProviderApiKey({
    provider: 'deepseek',
    profileId: 'deepseek-1',
    envNames: [],
  });
  const secondApiKey = getLlmProviderApiKey({
    provider: 'deepseek',
    profileId: 'deepseek-2',
    envNames: [],
  });
  assert.equal(firstApiKeyAfterSecondSave.apiKey, 'sk-smoke-deepseek-key');
  assert.equal(secondApiKey.apiKey, 'sk-smoke-deepseek-key-2');

  await updateLlmProfileOAuthCredential({
    provider: 'codex-oauth',
    profileId: 'codex-oauth-1',
    credential: {
      access: 'access-token',
      refresh: 'refresh-token',
      expires: 123,
      accountId: 'account-1',
    },
  });
  const oauth = getLlmProfileOAuthCredential('codex-oauth-1');
  assert.equal(oauth.credential.access, 'access-token');
  assert.equal(oauth.credential.accountId, 'account-1');

  const credentialsFile = JSON.parse(readFileSync(getDefaultLlmCredentialsPath(), 'utf8'));
  assert.equal(credentialsFile.profileCredentials['deepseek-1'].providerType, 'deepseek');
  assert.equal(credentialsFile.profileCredentials['deepseek-1'].apiKey, 'sk-smoke-deepseek-key');
  assert.equal(credentialsFile.profileCredentials['deepseek-2'].providerType, 'deepseek');
  assert.equal(credentialsFile.profileCredentials['deepseek-2'].apiKey, 'sk-smoke-deepseek-key-2');
  assert.equal(credentialsFile.profileCredentials['codex-oauth-1'].providerType, 'codex-oauth');
  assert.equal(credentialsFile.profileCredentials['codex-oauth-1'].oauth.access, 'access-token');

  const invalidSelection = validateLlmConfigForProviders(codexConfig, [
    'anthropic',
  ]);
  assert.equal(invalidSelection.valid, false);
  assert.match(invalidSelection.error, /not registered/i);

  const validSelection = validateLlmConfigForProviders(fileConfig, [
    'deepseek',
  ]);
  assert.equal(validSelection.valid, true);

  console.log(
    JSON.stringify(
      {
        ok: true,
        configPath,
        credentialsPath: getDefaultLlmCredentialsPath(),
        currentProfileId: codexConfig.currentProfileId,
      },
      null,
      2,
    ),
  );
} finally {
  delete process.env.CCR_LLM_CONFIG_PATH;
  delete process.env.CCR_LLM_CREDENTIALS_PATH;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;
  rmSync(tempDir, { recursive: true, force: true });
}
