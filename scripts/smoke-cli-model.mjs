import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = mkdtempSync(join(tmpdir(), 'ccr-cli-model-'));
const configPath = join(tempDir, 'llm.config.local.json');

try {
  const emptyStatus = runCli(['model', 'status', '--json']);
  assert.equal(emptyStatus.current.profileId, '');
  assert.equal(emptyStatus.current.provider, '');
  assert.equal(emptyStatus.current.model, '');
  assert.equal(emptyStatus.profile, undefined);

  const emptyList = runCli(['model', 'list', '--json']);
  assert.deepEqual(emptyList.profiles, []);
  assert.equal(emptyList.providers.every(provider => provider.profiles.length === 0), true);

  const noProfileSet = runCliRaw([
    'model',
    'set',
    'gpt-5.5',
    '--provider',
    'codex-oauth',
    '--json',
  ]);
  assert.equal(noProfileSet.status, 1);
  assert.match(noProfileSet.stderr, /No LLM profile exists/i);

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
          'deepseek-1': {
            name: 'DeepSeek API Key',
            providerType: 'deepseek',
            apiMode: 'openai-chat',
            endpoint: {
              baseUrl: 'https://api.deepseek.com',
            },
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'deepseek-v4-flash',
            models: {
              source: 'mixed',
              default: 'deepseek-v4-flash',
              include: ['deepseek-v4-pro'],
            },
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const status = runCli(['model', 'status', '--json']);
  assert.equal(status.current.profileId, 'codex-oauth-1');
  assert.equal(status.current.provider, 'codex-oauth');
  assert.equal(status.current.model, 'gpt-5.4');
  assert.equal(status.profile.source, 'file');

  const setGpt55 = runCli(['model', 'set', 'gpt-5.5', '--json']);
  assert.equal(setGpt55.current.profileId, 'codex-oauth-1');
  assert.equal(setGpt55.current.provider, 'codex-oauth');
  assert.equal(setGpt55.current.model, 'gpt-5.5');

  const setDeepSeek = runCli([
    'model',
    'profile',
    'deepseek-1',
    'deepseek-v4-flash',
    '--json',
  ]);
  assert.equal(setDeepSeek.current.profileId, 'deepseek-1');
  assert.equal(setDeepSeek.current.provider, 'deepseek');
  assert.equal(setDeepSeek.current.model, 'deepseek-v4-flash');

  const persisted = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(persisted.schemaVersion, 2);
  assert.equal(persisted.provider, undefined);
  assert.equal(persisted.model, undefined);
  assert.equal(persisted.currentProfileId, undefined);
  assert.equal(persisted.current.profileId, 'deepseek-1');
  assert.equal(persisted.current.model, 'deepseek-v4-flash');
  assert.equal(persisted.profiles['codex-oauth-1'].providerType, 'codex-oauth');
  assert.equal(persisted.profiles['deepseek-1'].providerType, 'deepseek');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'zero_start_status',
          'zero_start_list',
          'set_without_profile_rejected',
          'model status --json',
          'model set <model> --json',
          'model profile <profileId> <model> --json',
          'temporary_config_persisted_v2_only',
        ],
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runCli(args) {
  const result = runCliRaw(args);
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: node cli.js ${args.join(' ')}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return JSON.parse(result.stdout);
}

function runCliRaw(args) {
  return spawnSync(process.execPath, ['cli.js', ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CCR_LLM_CONFIG_PATH: configPath,
    },
    encoding: 'utf8',
    windowsHide: true,
  });
}
