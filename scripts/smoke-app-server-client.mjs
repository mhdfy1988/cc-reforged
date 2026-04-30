import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = mkdtempSync(join(tmpdir(), 'ccr-app-server-client-smoke-'));

try {
  const clientModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/app-server/client/index.js')).href
  );
  const managed = clientModule.startManagedStdioAppServerClient({
    defaultTimeoutMs: 15_000,
    process: {
      command: process.execPath,
      args: ['cli.js', 'app-server', '--listen', 'stdio'],
      cwd: repoRoot,
      env: getSmokeEnv(),
    },
  });

  const notifications = [];
  const errors = [];
  const waiters = [];
  managed.client.onNotification(notification => {
    notifications.push(notification);
    resolveWaiters(notifications, waiters);
  });
  managed.client.onError(error => {
    errors.push(error);
  });

  try {
    const initialized = await managed.client.initialize({
      clientInfo: {
        name: 'smoke-app-server-client',
        title: 'CCR App Server Client Smoke',
      },
      capabilities: {
        streaming: true,
        permissionPrompts: true,
        workspaceTrust: true,
      },
    });
    assert.equal(initialized.protocolVersion, '0.1');
    assert.equal(initialized.serverInfo.name, 'ccr-app-server');
    assert.equal(initialized.capabilities.workspace, true);
    assert.equal(initialized.capabilities.threads, true);
    assert.equal(initialized.capabilities.turns, true);
    assert.equal(initialized.capabilities.permissions, true);

    const config = await managed.client.getConfig();
    assert.equal(config.llm.provider, 'codex-oauth');
    assert.equal(config.llm.model, 'gpt-5.4');
    assertNoSecretKeys(config);

    const authStatus = await managed.client.getAuthStatus();
    assert.equal(authStatus.provider, 'codex-oauth');
    assert.equal(typeof authStatus.available, 'boolean');
    assertNoSecretKeys(authStatus);

    const modelList = await managed.client.listModels();
    const codexProvider = modelList.providers.find(
      provider => provider.id === 'codex-oauth',
    );
    assert.ok(codexProvider);
    assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.4'));

    const mcpList = await managed.client.listMcp({ includeDisabled: true });
    assert.equal(Array.isArray(mcpList.servers), true);
    assert.equal(Array.isArray(mcpList.errors), true);
    assertNoSecretKeys(mcpList);

    const workspace = await managed.client.openWorkspace({
      path: repoRoot,
      trust: 'trusted',
    });
    assert.equal(workspace.workspace.path, repoRoot);
    assert.equal(workspace.workspace.trusted, true);

    const threadResult = await managed.client.startThread({
      title: 'SDK smoke thread',
    });
    assert.equal(threadResult.thread.title, 'SDK smoke thread');

    const threadList = await managed.client.listThreads();
    assert.ok(
      threadList.threads.some(
        thread => thread.threadId === threadResult.thread.threadId,
      ),
    );

    const turnResult = await managed.client.startTurn({
      threadId: threadResult.thread.threadId,
      input: { type: 'text', text: 'hello' },
      options: { stream: true },
    });
    assert.equal(turnResult.turn.threadId, threadResult.thread.threadId);
    assert.equal(turnResult.turn.status, 'queued');

    await waitForNotification(
      notifications,
      waiters,
      notification => notification.method === 'thread/started',
    );
    await waitForNotification(
      notifications,
      waiters,
      notification => notification.method === 'turn/started',
    );
    await waitForNotification(
      notifications,
      waiters,
      notification => notification.method === 'turn/failed',
    );

    assert.deepEqual(
      errors.map(error => error.kind),
      [],
      errors.map(error => `${error.kind}: ${error.message}`).join('\n'),
    );

    await managed.close();
    const exit = await managed.process.waitForExit();
    assert.equal(exit.code, 0, managed.process.getStderr());
    assert.equal(managed.process.getStderr(), '');

    console.log(
      JSON.stringify(
        {
          ok: true,
          checked: [
            'client_spawn',
            'initialize',
            'config/get',
            'auth/status',
            'model/list',
            'mcp/list',
            'workspace/open',
            'thread/start',
            'thread/list',
            'turn/start_auth_required_failure',
            'notification_subscription',
            'shutdown',
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    managed.process.close();
    throw error;
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function getSmokeEnv() {
  const env = { ...process.env, CCR_CONFIG_DIR: tempDir };
  delete env.CCR_LLM_CONFIG_PATH;
  delete env.CCR_LLM_PROVIDER;
  delete env.CCR_LLM_MODEL;
  delete env.CLAUDE_CODE_CODEX_OAUTH_ACCESS_TOKEN;
  delete env.CLAUDE_CODE_CODEX_OAUTH_REFRESH_TOKEN;
  delete env.CLAUDE_CODE_CODEX_OAUTH_ACCOUNT_ID;
  delete env.CLAUDE_CODE_CODEX_OAUTH_EXPIRES_AT;
  return env;
}

function waitForNotification(notifications, waiters, predicate) {
  const existing = notifications.find(predicate);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve: notification => {
        clearTimeout(timeout);
        resolve(notification);
      },
    };
    const timeout = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index !== -1) {
        waiters.splice(index, 1);
      }
      reject(new Error('Timed out waiting for app-server notification'));
    }, 15_000);

    waiters.push(waiter);
  });
}

function resolveWaiters(notifications, waiters) {
  for (let index = waiters.length - 1; index >= 0; index--) {
    const waiter = waiters[index];
    const notification = notifications.find(waiter.predicate);
    if (notification) {
      waiters.splice(index, 1);
      waiter.resolve(notification);
    }
  }
}

function assertNoSecretKeys(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretKeys(item, [...path, index]));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    assert.equal(
      isDisallowedSecretKey(key),
      false,
      `Secret-like key leaked at ${[...path, key].join('.')}`,
    );
    assertNoSecretKeys(nestedValue, [...path, key]);
  }
}

function isDisallowedSecretKey(key) {
  return /^(access|accessToken|refresh|refreshToken|apiKey|api_key|authorization|cookie|password|clientSecret|client_secret)$/i.test(
    key,
  );
}
