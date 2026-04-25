import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
const credentialFile = join(tempDir, 'credential.json');

try {
  const session = new CodexOAuthSession({
    credentialFilePath: credentialFile,
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
  assert.ok(defaultSession.credentialFilePath.includes('codex-oauth.json'));

  console.log(
    JSON.stringify(
      {
        ok: true,
        credentialFile,
        refreshedAccess: refreshed.access,
        authorizeOrigin: authorizationUrl.origin,
        defaultCredentialFile: defaultSession.credentialFilePath,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
