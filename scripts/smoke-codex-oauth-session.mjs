import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const {
  CodexOAuthSession,
  buildOpenExternalCommand,
} = await import('../dist/src/services/llm/sessions/CodexOAuthSession.js');
const {
  createDefaultCodexOAuthSession,
} = await import('../dist/src/services/llm/sessions/defaultCodexOAuthSession.js');

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-codex-oauth-'));
const previousConfigPath = process.env.CCR_LLM_CONFIG_PATH;
const previousCredentialsPath = process.env.CCR_LLM_CREDENTIALS_PATH;
process.env.CCR_LLM_CONFIG_PATH = join(tempDir, 'llm.config.local.json');
process.env.CCR_LLM_CREDENTIALS_PATH = join(
  tempDir,
  'llm.credentials.local.json',
);

try {
  writeFileSync(
    process.env.CCR_LLM_CONFIG_PATH,
    JSON.stringify(
      {
        schemaVersion: 2,
        current: {
          profileId: 'codex-oauth-1',
          model: 'gpt-5.4',
        },
        profiles: {
          'codex-oauth-1': {
            name: 'Codex OAuth 账号 1',
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
          'codex-oauth-2': {
            name: 'Codex OAuth 账号 2',
            providerType: 'codex-oauth',
            apiMode: 'openai-responses',
            auth: {
              strategy: 'oauth_refreshable',
            },
            defaultModel: 'gpt-5.5',
            models: {
              source: 'mixed',
              default: 'gpt-5.5',
              include: ['gpt-5.4', 'gpt-5.4-mini'],
            },
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const session = new CodexOAuthSession({
    credentialProfileId: 'codex-oauth-1',
    fetchFn: async (_input, init) => {
      const body = String(init?.body ?? '');
      if (body.includes('grant_type=refresh_token')) {
        return new Response(
          JSON.stringify({
            access_token: 'refreshed-access-token',
            refresh_token: 'refreshed-refresh-token',
            expires_in: 120,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 60,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    },
  });

  const initialAvailability = await session.getAvailability();
  assert.equal(initialAvailability.available, false);

  await session.saveCredential({
    access: 'access-token',
    refresh: 'refresh-token',
    expires: Date.now() - 1_000,
    accountId: 'account-1',
  });

  const persisted = await session.loadCredential();
  assert.equal(persisted?.access, 'access-token');
  assert.equal(persisted?.refresh, 'refresh-token');

  const refreshed = await session.getValidCredential();
  assert.equal(refreshed.access, 'refreshed-access-token');
  assert.equal(refreshed.refresh, 'refreshed-refresh-token');

  const flow = await session.beginAuthorization();
  const authorizationUrl = new URL(flow.authorizationUrl);
  assert.equal(authorizationUrl.origin, 'https://auth.openai.com');
  assert.equal(authorizationUrl.pathname, '/oauth/authorize');
  assert.equal(authorizationUrl.searchParams.get('response_type'), 'code');
  assert.equal(
    authorizationUrl.searchParams.get('client_id'),
    'app_EMoamEEZ73f0CkXaXp7hrann',
  );
  assert.equal(
    authorizationUrl.searchParams.get('redirect_uri'),
    'http://localhost:1455/auth/callback',
  );
  assert.equal(
    authorizationUrl.searchParams.get('scope'),
    'openid profile email offline_access',
  );
  assert.equal(
    authorizationUrl.searchParams.get('code_challenge_method'),
    'S256',
  );
  assert.equal(
    authorizationUrl.searchParams.get('codex_cli_simplified_flow'),
    'true',
  );

  const exchanged = await session.exchangeAuthorizationCode(
    'test-code',
    flow.verifier,
  );
  assert.equal(exchanged.access, 'access-token');
  assert.equal(exchanged.refresh, 'refresh-token');

  const launch = buildOpenExternalCommand(flow.authorizationUrl);
  if (process.platform === 'win32') {
    assert.equal(launch.command, 'cmd');
    assert.equal(launch.windowsVerbatimArguments, true);
  } else {
    assert.ok(['open', 'xdg-open'].includes(launch.command));
  }

  const defaultSession = createDefaultCodexOAuthSession();
  assert.ok(defaultSession.baseUrl.includes('chatgpt.com/backend-api'));
  assert.ok(defaultSession.credentialFilePath.includes('llm.credentials.local.json'));

  const secondProfileSession = createDefaultCodexOAuthSession({
    profileId: 'codex-oauth-2',
  });
  await secondProfileSession.saveCredential({
    access: 'second-access-token',
    refresh: 'second-refresh-token',
    expires: Date.now() + 60_000,
    accountId: 'account-2',
  });
  const secondProfileCredential = await secondProfileSession.loadCredential();
  assert.equal(secondProfileCredential?.access, 'second-access-token');
  assert.equal(secondProfileCredential?.accountId, 'account-2');

  const credentialFile = JSON.parse(
    readFileSync(process.env.CCR_LLM_CREDENTIALS_PATH, 'utf8'),
  );
  assert.equal(
    credentialFile.profileCredentials['codex-oauth-1'].oauth.access,
    'refreshed-access-token',
  );
  assert.equal(
    credentialFile.profileCredentials['codex-oauth-2'].oauth.access,
    'second-access-token',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        credentialFile: session.credentialFilePath,
        refreshedAccess: refreshed.access,
        authorizeOrigin: authorizationUrl.origin,
        defaultCredentialFile: defaultSession.credentialFilePath,
        profileCredentialIds: Object.keys(credentialFile.profileCredentials),
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
  rmSync(tempDir, { recursive: true, force: true });
}
