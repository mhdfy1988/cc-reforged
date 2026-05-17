import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = mkdtempSync(join(tmpdir(), 'ccr-app-server-client-smoke-'));

try {
  const clientModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/app-server/client/index.js')).href
  );
  await smokeLateResponseAfterTimeout(clientModule.JsonRpcClient);

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
    assert.equal(initialized.capabilities.context, true);
    assert.equal(initialized.capabilities.compact, true);
    assert.equal(initialized.capabilities.memory, true);

    const config = await managed.client.getConfig();
    assert.equal(config.llm.profileId, undefined);
    assert.equal(config.llm.provider, '');
    assert.equal(config.llm.model, '');
    assertNoSecretKeys(config);

    const authStatus = await managed.client.getAuthStatus();
    assert.equal(authStatus.state, 'missing');
    assert.equal(authStatus.available, false);
    assertNoSecretKeys(authStatus);

    const modelList = await managed.client.listModels();
    assert.equal(modelList.current.profileId, '');
    assert.equal(modelList.current.provider, '');
    assert.equal(modelList.current.model, '');
    const codexProvider = modelList.providers.find(
      provider => provider.id === 'codex-oauth',
    );
    const deepSeekProvider = modelList.providers.find(
      provider => provider.id === 'deepseek',
    );
    assert.ok(codexProvider);
    assert.ok(deepSeekProvider);
    assert.deepEqual(modelList.profiles, []);
    assert.deepEqual(codexProvider.profiles, []);
    assert.deepEqual(deepSeekProvider.profiles, []);
    assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.5'));
    assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.4'));
    assert.ok(
      deepSeekProvider.models.some(model => model.model === 'deepseek-v4-flash'),
    );
    assert.ok(
      deepSeekProvider.models.some(model => model.model === 'deepseek-v4-pro'),
    );

    const emptyProfileList = await managed.client.listModelProfiles();
    assert.deepEqual(emptyProfileList.profiles, []);
    assertNoSecretKeys(emptyProfileList);

    const deepSeekAvailability = await managed.client.getModelAvailability({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    assert.equal(deepSeekAvailability.provider, 'deepseek');
    assert.equal(deepSeekAvailability.model, 'deepseek-v4-flash');
    assert.equal(deepSeekAvailability.state, 'needs_auth');
    assert.equal(deepSeekAvailability.available, false);
    assert.equal(deepSeekAvailability.testable, false);
    assert.equal(deepSeekAvailability.networkChecked, false);
    assert.equal(deepSeekAvailability.auth.configured, false);
    assertNoSecretKeys(deepSeekAvailability);

    const deepSeekTest = await managed.client.testModelConnection({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    assert.equal(deepSeekTest.provider, 'deepseek');
    assert.equal(deepSeekTest.model, 'deepseek-v4-flash');
    assert.equal(deepSeekTest.ok, false);
    assert.equal(deepSeekTest.networkChecked, false);
    assert.equal(deepSeekTest.error.kind, 'auth_required');
    assertNoSecretKeys(deepSeekTest);

    const deepSeekCredential = await managed.client.updateModelCredential({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: 'sk-smoke-deepseek-key',
    });
    assert.equal(deepSeekCredential.provider, 'deepseek');
    assert.equal(deepSeekCredential.model, 'deepseek-v4-flash');
    assert.equal(deepSeekCredential.credential.configured, true);
    assert.equal(deepSeekCredential.credential.profileId, 'deepseek-1');
    assert.equal(deepSeekCredential.availability.state, 'auth_ready');
    assert.equal(deepSeekCredential.availability.auth.configured, true);
    assert.equal(deepSeekCredential.availability.auth.available, true);
    assertNoSecretKeys(deepSeekCredential);

    const secondDeepSeekProfile = await managed.client.saveModelProfile({
      name: 'DeepSeek Smoke 2',
      providerType: 'deepseek',
      apiMode: 'openai-chat',
      authStrategy: 'api_key',
      defaultModel: 'deepseek-v4-pro',
      models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    });
    const secondDeepSeekProfileId = secondDeepSeekProfile.profile.id;
    const secondDeepSeekCredential = await managed.client.updateModelCredential({
      profileId: secondDeepSeekProfileId,
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      apiKey: 'sk-smoke-deepseek-key-2',
    });
    assert.equal(secondDeepSeekCredential.credential.profileId, secondDeepSeekProfileId);
    const credentialsSnapshot = JSON.parse(
      readFileSync(join(tempDir, 'data', 'llm.credentials.local.json'), 'utf8'),
    );
    assert.equal(
      credentialsSnapshot.profileCredentials['deepseek-1'].apiKey,
      'sk-smoke-deepseek-key',
    );
    assert.equal(
      credentialsSnapshot.profileCredentials[secondDeepSeekProfileId].apiKey,
      'sk-smoke-deepseek-key-2',
    );
    assertNoSecretKeys(secondDeepSeekCredential);

    const profileList = await managed.client.listModelProfiles();
    assert.equal(profileList.current.profileId, 'deepseek-1');
    assert.ok(
      profileList.profiles.some(
        profile =>
          profile.id === 'deepseek-1' &&
          profile.providerType === 'deepseek' &&
          profile.source === 'file',
      ),
    );
    assertNoSecretKeys(profileList);

    const copiedProfile = await managed.client.copyModelProfile({
      profileId: 'deepseek-1',
      name: 'DeepSeek Smoke Copy',
    });
    assert.equal(copiedProfile.profile.name, 'DeepSeek Smoke Copy');
    assert.equal(copiedProfile.profile.source, 'file');
    assert.equal(copiedProfile.profile.providerType, 'deepseek');
    assertNoSecretKeys(copiedProfile);

    const copiedProfileId = copiedProfile.profile.id;
    const deletedCopy = await managed.client.deleteModelProfile({
      profileId: copiedProfileId,
    });
    assert.equal(
      deletedCopy.profiles.some(profile => profile.id === copiedProfileId),
      false,
    );
    assertNoSecretKeys(deletedCopy);

    const deepSeekReadyAvailability = await managed.client.getModelAvailability({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    assert.equal(deepSeekReadyAvailability.state, 'auth_ready');
    assert.equal(deepSeekReadyAvailability.available, true);
    assert.equal(deepSeekReadyAvailability.testable, true);
    assertNoSecretKeys(deepSeekReadyAvailability);

    const deepSeekCredentialClear = await managed.client.updateModelCredential({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: null,
    });
    assert.equal(deepSeekCredentialClear.credential.configured, false);
    assert.equal(deepSeekCredentialClear.availability.state, 'needs_auth');
    assertNoSecretKeys(deepSeekCredentialClear);

    const setDeepSeek = await managed.client.setModel({
      profileId: 'deepseek-1',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    assert.equal(setDeepSeek.current.profileId, 'deepseek-1');
    assert.equal(setDeepSeek.current.provider, 'deepseek');
    assert.equal(setDeepSeek.current.model, 'deepseek-v4-flash');
    const deepSeekConfig = await managed.client.getConfig();
    assert.equal(deepSeekConfig.llm.profileId, 'deepseek-1');
    assert.equal(deepSeekConfig.llm.provider, 'deepseek');
    assert.equal(deepSeekConfig.llm.model, 'deepseek-v4-flash');
    assert.equal(deepSeekConfig.llm.apiMode, 'openai-chat');
    assertNoSecretKeys(deepSeekConfig);

    const savedCodexProfile = await managed.client.saveModelProfile({
      name: 'Codex OAuth 登录配置',
      providerType: 'codex-oauth',
      apiMode: 'openai-responses',
      authStrategy: 'oauth_refreshable',
      defaultModel: 'gpt-5.4',
      models: ['gpt-5.4', 'gpt-5.5', 'gpt-5.4-mini'],
      setCurrent: true,
    });
    assert.equal(savedCodexProfile.profile.id, 'codex-oauth-1');
    assert.equal(savedCodexProfile.profile.providerType, 'codex-oauth');
    assert.equal(savedCodexProfile.profile.source, 'file');
    assertNoSecretKeys(savedCodexProfile);

    const setGpt55 = await managed.client.setModel({
      profileId: 'codex-oauth-1',
      provider: 'codex-oauth',
      model: 'gpt-5.5',
    });
    assert.equal(setGpt55.current.profileId, 'codex-oauth-1');
    assert.equal(setGpt55.current.provider, 'codex-oauth');
    assert.equal(setGpt55.current.model, 'gpt-5.5');
    const gpt55Config = await managed.client.getConfig();
    assert.equal(gpt55Config.llm.model, 'gpt-5.5');
    assertNoSecretKeys(gpt55Config);

    const setGpt54 = await managed.client.setModel({
      profileId: 'codex-oauth-1',
      provider: 'codex-oauth',
      model: 'gpt-5.4',
    });
    assert.equal(setGpt54.current.provider, 'codex-oauth');
    assert.equal(setGpt54.current.model, 'gpt-5.4');

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

    const secondThreadResult = await managed.client.startThread({
      title: 'SDK smoke second thread',
    });
    const twoThreadList = await managed.client.listThreads();
    const firstThreadAfterSecond = twoThreadList.threads.find(
      thread => thread.threadId === threadResult.thread.threadId,
    );
    const secondThreadAfterSecond = twoThreadList.threads.find(
      thread => thread.threadId === secondThreadResult.thread.threadId,
    );
    assert.equal(firstThreadAfterSecond?.status, 'closed');
    assert.equal(secondThreadAfterSecond?.status, 'active');

    const sessionHistory = await managed.client.listSessionHistory({
      scope: 'sameRepo',
      limit: 10,
      includeCurrent: false,
    });
    assert.equal(Array.isArray(sessionHistory.groups), true);
    for (const group of sessionHistory.groups) {
      assert.equal(typeof group.workspacePath, 'string');
      assert.equal(typeof group.workspaceName, 'string');
      assert.equal(typeof group.isCurrentWorkspace, 'boolean');
      assert.equal(Array.isArray(group.sessions), true);
      for (const session of group.sessions) {
        assert.equal(typeof session.sessionId, 'string');
        assert.equal(typeof session.title, 'string');
        assert.equal(typeof session.projectPath, 'string');
        assert.equal(typeof session.transcriptPath, 'string');
        assert.equal(session.sessionId === threadResult.thread.threadId, false);
      }
    }
    assertNoSecretKeys(sessionHistory);

    const contextStatus = await managed.client.getContextStatus({
      threadId: threadResult.thread.threadId,
    });
    assert.equal(contextStatus.available, true);
    assert.equal(contextStatus.threadId, threadResult.thread.threadId);
    assert.equal(typeof contextStatus.messageCount, 'number');

    const compactStatus = await managed.client.getCompactStatus({
      threadId: threadResult.thread.threadId,
    });
    assert.equal(compactStatus.available, true);
    assert.equal(compactStatus.threadId, threadResult.thread.threadId);
    assert.equal(typeof compactStatus.autoCompactEnabled, 'boolean');

    const memoryStatus = await managed.client.getMemorySessionStatus({
      threadId: threadResult.thread.threadId,
    });
    assert.equal(memoryStatus.available, true);
    assertNoSecretKeys(memoryStatus);

    const turnResult = await managed.client.startTurn({
      threadId: threadResult.thread.threadId,
      input: { type: 'text', text: 'hello' },
      options: { stream: true },
    });
    assert.equal(turnResult.turn.threadId, threadResult.thread.threadId);
    assert.equal(turnResult.turn.status, 'queued');
    assert.equal(turnResult.turn.metadata.provider, 'codex-oauth');
    assert.equal(
      turnResult.turn.metadata.providerDisplayName,
      'Codex OAuth',
    );
    assert.equal(turnResult.turn.metadata.profileId, 'codex-oauth-1');
    assert.equal(
      turnResult.turn.metadata.profileName,
      'Codex OAuth 登录配置',
    );
    assert.equal(turnResult.turn.metadata.apiMode, 'openai-responses');
    assert.equal(turnResult.turn.metadata.authStrategy, 'oauth_refreshable');
    assert.equal(turnResult.turn.metadata.model, 'gpt-5.4');
    assert.equal(turnResult.turn.metadata.requestedModel, 'gpt-5.4');
    assert.equal(typeof turnResult.turn.metadata.contextWindow, 'number');

    const threadListAfterTurnStart = await managed.client.listThreads();
    const firstThreadAfterTurnStart = threadListAfterTurnStart.threads.find(
      thread => thread.threadId === threadResult.thread.threadId,
    );
    const secondThreadAfterTurnStart = threadListAfterTurnStart.threads.find(
      thread => thread.threadId === secondThreadResult.thread.threadId,
    );
    assert.equal(firstThreadAfterTurnStart?.status, 'active');
    assert.equal(secondThreadAfterTurnStart?.status, 'closed');

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

    const smokeTranscript = writeSmokeTranscript();
    const resumedThread = await managed.client.resumeThread({
      sessionId: smokeTranscript.sessionId,
      transcriptPath: smokeTranscript.transcriptPath,
      projectPath: repoRoot,
    });
    assert.equal(Array.isArray(resumedThread.messages), true);
    assert.ok(
      resumedThread.messages.some(
        message =>
          message.role === 'user' &&
          message.text.includes('hello from smoke transcript'),
      ),
    );
    assert.ok(
      resumedThread.messages.some(
        message =>
          message.role === 'assistant' &&
          message.text.includes('assistant reply from smoke transcript'),
      ),
    );
    const replayedToolMessage = resumedThread.messages.find(
      message =>
        message.role === 'assistant' &&
        Array.isArray(message.content) &&
        message.content.some(block => block?.id === 'toolu-smoke-interrupted'),
    );
    assert.ok(replayedToolMessage);
    const replayedToolBlocks = replayedToolMessage.content;
    const completedReplayTool = replayedToolBlocks.find(
      block => block?.id === 'toolu-smoke-completed',
    );
    const interruptedReplayTool = replayedToolBlocks.find(
      block => block?.id === 'toolu-smoke-interrupted',
    );
    assert.equal(completedReplayTool?.status, undefined);
    assert.equal(interruptedReplayTool?.status, 'interrupted');
    assert.equal(interruptedReplayTool?.historyStatus, 'interrupted');
    assert.equal(
      resumedThread.messages.some(message =>
        message.text.includes('No response requested.'),
      ),
      false,
    );

    const interruptedPromptTranscript = writeInterruptedPromptTranscript();
    const interruptedPromptThread = await managed.client.resumeThread({
      sessionId: interruptedPromptTranscript.sessionId,
      transcriptPath: interruptedPromptTranscript.transcriptPath,
      projectPath: repoRoot,
    });
    assert.ok(
      interruptedPromptThread.messages.some(
        message =>
          message.role === 'system' &&
          message.status === 'interrupted' &&
          message.text.includes('本轮已中断，未产生可恢复回复'),
      ),
    );
    assert.equal(
      interruptedPromptThread.messages.some(message =>
        message.text.includes('No response requested.'),
      ),
      false,
    );
    assertNoSecretKeys(resumedThread);

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
            'model/profile/list',
            'model/profile/save_copy_delete',
            'model/availability',
            'model/test_auth_required_no_network',
            'model/credential/update',
            'model/credential/profile_isolation',
            'model/set',
            'mcp/list',
            'workspace/open',
            'thread/start',
            'thread/list',
            'session/history/list',
            'context/status',
            'compact/status',
            'late_response_after_timeout_suppressed',
            'memory/session/status',
            'turn/start_auth_required_failure',
            'thread/resume_history_messages',
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

function writeSmokeTranscript() {
  const sessionId = randomUUID();
  const userUuid = randomUUID();
  const assistantUuid = randomUUID();
  const toolResultUuid = randomUUID();
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
          {
            type: 'tool_use',
            id: 'toolu-smoke-completed',
            name: 'PowerShell',
            input: {
              command: 'Write-Host done',
            },
          },
          {
            type: 'tool_use',
            id: 'toolu-smoke-interrupted',
            name: 'PowerShell',
            input: {
              command: 'Start-Sleep -Seconds 30',
            },
          },
        ],
      },
    },
    {
      type: 'user',
      uuid: toolResultUuid,
      parentUuid: assistantUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: repoRoot,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-smoke-completed',
            content: 'done',
          },
        ],
      },
    },
    {
      type: 'assistant',
      uuid: randomUUID(),
      parentUuid: toolResultUuid,
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
            text: 'No response requested.',
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

function writeInterruptedPromptTranscript() {
  const sessionId = randomUUID();
  const userUuid = randomUUID();
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
        content: 'interrupted before assistant persisted',
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

async function smokeLateResponseAfterTimeout(JsonRpcClient) {
  const transport = createFakeTransport();
  const errors = [];
  const client = new JsonRpcClient(transport, { defaultTimeoutMs: 100 });
  client.onError(error => {
    errors.push(error);
  });

  const requestPromise = client.request(
    'compact/run',
    { threadId: 'thread-late-response' },
    { timeoutMs: 5 },
  );
  const sent = JSON.parse(transport.sentLines[0]);

  await assert.rejects(
    requestPromise,
    error =>
      error?.kind === 'request_timeout' &&
      String(error.message).includes('compact/run'),
  );

  transport.emitLine(
    JSON.stringify({ jsonrpc: '2.0', id: sent.id, result: { ok: true } }),
  );
  assert.deepEqual(
    errors.map(error => `${error.kind}: ${error.message}`),
    [],
  );

  transport.emitLine(
    JSON.stringify({
      jsonrpc: '2.0',
      id: typeof sent.id === 'number' ? sent.id + 1000 : `${sent.id}-unknown`,
      result: { ok: true },
    }),
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'protocol_error');
  client.close();
}

function createFakeTransport() {
  const lineListeners = new Set();
  const closeListeners = new Set();
  return {
    sentLines: [],
    sendLine(line) {
      this.sentLines.push(line);
    },
    close() {
      for (const listener of closeListeners) {
        listener({ code: 0, signal: null });
      }
    },
    onLine(listener) {
      lineListeners.add(listener);
      return () => lineListeners.delete(listener);
    },
    onClose(listener) {
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    emitLine(line) {
      for (const listener of lineListeners) {
        listener(line);
      }
    },
  };
}

function getSmokeEnv() {
  const env = { ...process.env, CCR_CONFIG_DIR: tempDir };
  delete env.CCR_LLM_CONFIG_PATH;
  delete env.CCR_LLM_CREDENTIALS_PATH;
  delete env.CCR_LLM_PROVIDER;
  delete env.CCR_LLM_MODEL;
  delete env.CLAUDE_CODE_CODEX_OAUTH_ACCESS_TOKEN;
  delete env.CLAUDE_CODE_CODEX_OAUTH_REFRESH_TOKEN;
  delete env.CLAUDE_CODE_CODEX_OAUTH_ACCOUNT_ID;
  delete env.CLAUDE_CODE_CODEX_OAUTH_EXPIRES_AT;
  delete env.CCR_DEEPSEEK_API_KEY;
  delete env.DEEPSEEK_API_KEY;
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
