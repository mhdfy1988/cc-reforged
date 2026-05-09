import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = mkdtempSync(join(tmpdir(), 'ccr-app-server-smoke-'));

try {
  const messages = [
    'not json',
    { jsonrpc: '2.0', id: 1, method: 'config/get', params: {} },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: { clientInfo: { name: 'smoke-app-server' } },
    },
    { jsonrpc: '2.0', id: 3, method: 'config/get', params: {} },
    { jsonrpc: '2.0', id: 4, method: 'auth/status', params: {} },
    { jsonrpc: '2.0', id: 5, method: 'model/list', params: {} },
    { jsonrpc: '2.0', id: 6, method: 'mcp/list', params: { includeDisabled: true } },
    {
      jsonrpc: '2.0',
      id: 7,
      method: 'workspace/open',
      params: { path: repoRoot, trust: 'trusted' },
    },
    { jsonrpc: '2.0', id: 8, method: 'shutdown', params: {} },
  ];

  const result = runAppServer(messages);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');

  const responses = parseJsonLines(result.stdout);
  assert.equal(responses.length, messages.length);

  assertJsonRpcError(responses[0], null, -32700, 'parse_error');
  assertJsonRpcError(responses[1], 1, -32001, 'not_initialized');

  assert.equal(responses[2].id, 2);
  assert.equal(responses[2].result.protocolVersion, '0.1');
  assert.equal(responses[2].result.serverVersion, '0.1');
  assert.equal(responses[2].result.serverInfo.name, 'ccr-app-server');
  assert.equal(responses[2].result.serverInfo.serverVersion, '0.1');
  assert.equal(responses[2].result.schemaVersions.config, '0.1');
  assert.equal(responses[2].result.capabilities.threads, true);
  assert.equal(responses[2].result.capabilities.turns, true);
  assert.equal(responses[2].result.capabilities.context, true);
  assert.equal(responses[2].result.capabilities.compact, true);
  assert.equal(responses[2].result.capabilities.memory, true);

  assert.equal(responses[3].id, 3);
  assert.equal(responses[3].result.llm.provider, 'codex-oauth');
  assert.equal(responses[3].result.llm.model, 'gpt-5.4');
  assertNoSecretKeys(responses[3].result);

  assert.equal(responses[4].id, 4);
  assert.equal(responses[4].result.provider, 'codex-oauth');
  assert.equal(typeof responses[4].result.available, 'boolean');
  assertNoSecretKeys(responses[4].result);

  assert.equal(responses[5].id, 5);
  const codexProvider = responses[5].result.providers.find(
    provider => provider.id === 'codex-oauth',
  );
  assert.ok(codexProvider);
  assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.4'));
  assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.4-mini'));

  assert.equal(responses[6].id, 6);
  assert.equal(Array.isArray(responses[6].result.servers), true);
  assert.equal(Array.isArray(responses[6].result.errors), true);
  assertNoSecretKeys(responses[6].result);

  assert.equal(responses[7].id, 7);
  assert.equal(responses[7].result.workspace.path, repoRoot);
  assert.equal(responses[7].result.workspace.trusted, true);

  assert.equal(responses[8].id, 8);
  assert.equal(responses[8].result.accepted, true);

  const unsupported = spawnSync(
    process.execPath,
    ['cli.js', 'app-server', '--listen', 'websocket'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: getSmokeEnv(),
    },
  );
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /only supports "--listen stdio"/);

  const sessionMessages = await runInteractiveSessionSmoke();
  const sessionResponses = sessionMessages.filter(message => 'id' in message);
  const sessionNotifications = sessionMessages.filter(message => !('id' in message));

  const initializeResponse = getResponseById(sessionResponses, 1);
  const workspaceResponse = getResponseById(sessionResponses, 2);
  const threadResponse = getResponseById(sessionResponses, 3);
  const threadListResponse = getResponseById(sessionResponses, 4);
  const contextStatusResponse = getResponseById(sessionResponses, 5);
  const compactStatusResponse = getResponseById(sessionResponses, 6);
  const memoryStatusResponse = getResponseById(sessionResponses, 7);
  const turnStartResponse = getResponseById(sessionResponses, 8);
  const sessionHistoryResponse = getResponseById(sessionResponses, 9);
  const threadResumeResponse = getResponseById(sessionResponses, 10);

  assert.equal(initializeResponse.result.protocolVersion, '0.1');
  assert.equal(initializeResponse.result.serverVersion, '0.1');
  assert.equal(workspaceResponse.result.workspace.trusted, true);
  const thread = threadResponse.result.thread;
  assert.equal(thread.title, 'Smoke thread');
  assert.equal(threadListResponse.result.threads.length, 1);
  assert.equal(threadListResponse.result.threads[0].threadId, thread.threadId);
  assert.equal(contextStatusResponse.result.available, true);
  assert.equal(contextStatusResponse.result.threadId, thread.threadId);
  assert.equal(typeof contextStatusResponse.result.messageCount, 'number');
  assert.equal(typeof contextStatusResponse.result.readFileStateSize, 'number');
  assert.equal(typeof contextStatusResponse.result.compactBoundaryCount, 'number');
  assert.equal(compactStatusResponse.result.available, true);
  assert.equal(compactStatusResponse.result.threadId, thread.threadId);
  assert.equal(typeof compactStatusResponse.result.autoCompactEnabled, 'boolean');
  assert.equal(typeof compactStatusResponse.result.autoCompactThreshold, 'number');
  assert.equal(typeof compactStatusResponse.result.effectiveContextWindow, 'number');
  assert.equal(memoryStatusResponse.result.available, true);
  assert.equal(typeof memoryStatusResponse.result.hookRegistered, 'boolean');
  assertNoSecretKeys(memoryStatusResponse.result);
  assert.equal(turnStartResponse.result.turn.threadId, thread.threadId);
  assert.equal(turnStartResponse.result.turn.status, 'queued');
  assert.equal(turnStartResponse.result.turn.metadata.provider, 'codex-oauth');
  assert.equal(turnStartResponse.result.turn.metadata.model, 'gpt-5.4');
  assert.equal(turnStartResponse.result.turn.metadata.contextWindow, 200000);
  assert.equal(Array.isArray(sessionHistoryResponse.result.groups), true);
  for (const group of sessionHistoryResponse.result.groups) {
    assert.equal(typeof group.workspacePath, 'string');
    assert.equal(typeof group.workspaceName, 'string');
    assert.equal(typeof group.isCurrentWorkspace, 'boolean');
    assert.equal(Array.isArray(group.sessions), true);
    for (const session of group.sessions) {
      assert.equal(typeof session.sessionId, 'string');
      assert.equal(typeof session.title, 'string');
      assert.equal(typeof session.projectPath, 'string');
      assert.equal(typeof session.transcriptPath, 'string');
      assert.equal(session.sessionId === thread.threadId, false);
    }
  }
  assertNoSecretKeys(sessionHistoryResponse.result);
  assert.equal(Array.isArray(threadResumeResponse.result.messages), true);
  assert.ok(
    threadResumeResponse.result.messages.some(
      message =>
        message.role === 'user' &&
        message.text.includes('hello from smoke transcript'),
    ),
  );
  assert.ok(
    threadResumeResponse.result.messages.some(
      message =>
        message.role === 'assistant' &&
        message.text.includes('assistant reply from smoke transcript'),
    ),
  );
  assertNoSecretKeys(threadResumeResponse.result);
  assert.ok(
    sessionNotifications.some(
      notification => notification.method === 'thread/started',
    ),
  );
  const turnStartedNotification = sessionNotifications.find(
    notification => notification.method === 'turn/started',
  );
  assert.ok(turnStartedNotification);
  assert.equal(turnStartedNotification.params.metadata.provider, 'codex-oauth');
  assert.equal(turnStartedNotification.params.metadata.model, 'gpt-5.4');
  assert.equal(turnStartedNotification.params.metadata.contextWindow, 200000);

  const turnFailedNotification = sessionNotifications.find(
    notification => notification.method === 'turn/failed',
  );
  assert.ok(turnFailedNotification);
  assert.equal(turnFailedNotification.params.metadata.stopReason, 'error');
  assert.equal(turnFailedNotification.params.metadata.errorKind, 'auth_required');
  assert.equal(typeof turnFailedNotification.params.metadata.latencyMs, 'number');

  const permissionSmoke = runPermissionSmoke();
  assert.equal(permissionSmoke.status, 0, permissionSmoke.stderr);
  assert.equal(permissionSmoke.stderr, '');
  const permissionSmokeResult = JSON.parse(permissionSmoke.stdout);
  assert.equal(permissionSmokeResult.ok, true);
  assert.ok(permissionSmokeResult.checked.includes('permission/requested'));
  assert.ok(permissionSmokeResult.checked.includes('permission/respond_allow'));
  assert.ok(
    permissionSmokeResult.checked.includes('permission/respond_duplicate'),
  );
  assert.ok(permissionSmokeResult.checked.includes('permission/respond_missing'));
  assert.ok(permissionSmokeResult.checked.includes('permission/cancelled'));

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'parse_error',
          'not_initialized',
          'initialize',
          'config/get',
          'auth/status',
          'model/list',
          'mcp/list',
          'workspace/open',
          'shutdown',
          'unsupported_transport',
          'thread/start',
          'thread/list',
          'session/history/list',
          'thread/resume_history_messages',
          'context/status',
          'compact/status',
          'memory/session/status',
          'turn/start_auth_required_failure',
          'permission/requested',
          'permission/respond_allow',
          'permission/respond_duplicate',
          'permission/respond_missing',
          'permission/cancelled',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runAppServer(messages) {
  const input = `${messages
    .map(message => (typeof message === 'string' ? message : JSON.stringify(message)))
    .join('\n')}\n`;
  return spawnSync(process.execPath, ['cli.js', 'app-server', '--listen', 'stdio'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: getSmokeEnv(),
    input,
    maxBuffer: 1024 * 1024 * 10,
  });
}

function runPermissionSmoke() {
  return spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-loader',
      pathToFileURL(join(repoRoot, 'bun-bundle-loader.mjs')).href,
      join(repoRoot, 'scripts', 'smoke-app-server-permissions.mjs'),
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: getSmokeEnv(),
      maxBuffer: 1024 * 1024 * 10,
    },
  );
}

async function runInteractiveSessionSmoke() {
  const child = spawn(process.execPath, ['cli.js', 'app-server', '--listen', 'stdio'], {
    cwd: repoRoot,
    env: getSmokeEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  const messages = [];
  const waiters = [];
  let stdoutBuffer = '';
  let stderr = '';

  child.stdout.on('data', chunk => {
    stdoutBuffer += chunk;
    for (;;) {
      const newline = stdoutBuffer.indexOf('\n');
      if (newline === -1) {
        break;
      }
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) {
        continue;
      }
      const message = JSON.parse(line);
      messages.push(message);
      resolveWaiters(messages, waiters);
    }
  });

  child.stderr.on('data', chunk => {
    stderr += chunk;
  });

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { clientInfo: { name: 'smoke-app-server-session' } },
  });
  await waitForMessage(messages, waiters, message => message.id === 1);

  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'workspace/open',
    params: { path: repoRoot, trust: 'trusted' },
  });
  await waitForMessage(messages, waiters, message => message.id === 2);

  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'thread/start',
    params: { title: 'Smoke thread' },
  });
  const threadResponse = await waitForMessage(
    messages,
    waiters,
    message => message.id === 3,
  );
  const threadId = threadResponse.result.thread.threadId;

  send({ jsonrpc: '2.0', id: 4, method: 'thread/list', params: {} });
  await waitForMessage(messages, waiters, message => message.id === 4);

  send({
    jsonrpc: '2.0',
    id: 5,
    method: 'context/status',
    params: { threadId },
  });
  await waitForMessage(messages, waiters, message => message.id === 5);

  send({
    jsonrpc: '2.0',
    id: 6,
    method: 'compact/status',
    params: { threadId },
  });
  await waitForMessage(messages, waiters, message => message.id === 6);

  send({
    jsonrpc: '2.0',
    id: 7,
    method: 'memory/session/status',
    params: { threadId },
  });
  await waitForMessage(messages, waiters, message => message.id === 7);

  send({
    jsonrpc: '2.0',
    id: 8,
    method: 'turn/start',
    params: {
      threadId,
      input: { type: 'text', text: 'hello' },
    },
  });
  await waitForMessage(messages, waiters, message => message.id === 8);
  await waitForMessage(
    messages,
    waiters,
    message => message.method === 'turn/failed',
  );

  send({
    jsonrpc: '2.0',
    id: 9,
    method: 'session/history/list',
    params: { scope: 'sameRepo', limit: 10, includeCurrent: false },
  });
  await waitForMessage(messages, waiters, message => message.id === 9);

  const smokeTranscript = writeSmokeTranscript();
  send({
    jsonrpc: '2.0',
    id: 10,
    method: 'thread/resume',
    params: {
      sessionId: smokeTranscript.sessionId,
      transcriptPath: smokeTranscript.transcriptPath,
      projectPath: repoRoot,
    },
  });
  await waitForMessage(messages, waiters, message => message.id === 10);

  child.stdin.end();
  const status = await waitForExit(child);
  assert.equal(status, 0, stderr);
  assert.equal(stderr, '');
  return messages;
}

function writeSmokeTranscript() {
  const sessionId = randomUUID();
  const userUuid = randomUUID();
  const assistantUuid = randomUUID();
  const timestamp = new Date().toISOString();
  const transcriptPath = join(tempDir, `${sessionId}.jsonl`);
  const entries = [
    {
      type: 'user',
      uuid: userUuid,
      parentUuid: null,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: repoRoot,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'user',
        content: 'hello from smoke transcript',
      },
    },
    {
      type: 'assistant',
      uuid: assistantUuid,
      parentUuid: userUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: repoRoot,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'assistant reply from smoke transcript',
          },
        ],
      },
    },
  ];
  writeFileSync(
    transcriptPath,
    `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  );
  return { sessionId, transcriptPath };
}

function waitForMessage(messages, waiters, predicate) {
  const existing = messages.find(predicate);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve: message => {
        clearTimeout(timeout);
        resolve(message);
      },
    };
    const timeout = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index !== -1) {
        waiters.splice(index, 1);
      }
      reject(new Error('Timed out waiting for app-server message'));
    }, 15000);

    waiters.push(waiter);
  });
}

function getResponseById(responses, id) {
  const response = responses.find(message => message.id === id);
  assert.ok(response, `Missing JSON-RPC response ${id}`);
  return response;
}

function resolveWaiters(messages, waiters) {
  for (let index = waiters.length - 1; index >= 0; index--) {
    const waiter = waiters[index];
    const message = messages.find(waiter.predicate);
    if (message) {
      waiters.splice(index, 1);
      waiter.resolve(message);
    }
  }
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code));
  });
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

function parseJsonLines(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function assertJsonRpcError(response, id, code, kind) {
  assert.equal(response.id, id);
  assert.equal(response.error.code, code);
  assert.equal(response.error.data.kind, kind);
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
