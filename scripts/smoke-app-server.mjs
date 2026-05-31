import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const tempDir = mkdtempSync(join(tmpdir(), 'ccr-app-server-smoke-'));

try {
  seedSmokeLlmConfig();
  await runThreadDisplayAttachmentProjectionSmoke();
  await runToolDisplayLifecycleSmoke();
  await runThreadDisplaySnapshotToolSplitSmoke();
  await runRealtimeToolDisplayPatchLifecycleSmoke();
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
    {
      jsonrpc: '2.0',
      id: 6,
      method: 'model/set',
      params: { provider: 'codex-oauth', model: 'gpt-5.5' },
    },
    { jsonrpc: '2.0', id: 7, method: 'config/get', params: {} },
    {
      jsonrpc: '2.0',
      id: 8,
      method: 'model/set',
      params: { provider: 'codex-oauth', model: 'gpt-5.4' },
    },
    { jsonrpc: '2.0', id: 9, method: 'config/get', params: {} },
    { jsonrpc: '2.0', id: 10, method: 'mcp/list', params: { includeDisabled: true } },
    {
      jsonrpc: '2.0',
      id: 11,
      method: 'workspace/open',
      params: { path: repoRoot, trust: 'trusted' },
    },
    {
      jsonrpc: '2.0',
      id: 12,
      method: 'model/availability',
      params: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    },
    {
      jsonrpc: '2.0',
      id: 13,
      method: 'model/test',
      params: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    },
    {
      jsonrpc: '2.0',
      id: 14,
      method: 'model/credential/update',
      params: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        apiKey: 'sk-smoke-deepseek-key',
      },
    },
    {
      jsonrpc: '2.0',
      id: 15,
      method: 'model/availability',
      params: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    },
    {
      jsonrpc: '2.0',
      id: 16,
      method: 'model/credential/update',
      params: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        apiKey: null,
      },
    },
    {
      jsonrpc: '2.0',
      id: 17,
      method: 'model/availability',
      params: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    },
    {
      jsonrpc: '2.0',
      id: 18,
      method: 'mcp/inspect',
      params: { name: 'smoke_mcp' },
    },
    {
      jsonrpc: '2.0',
      id: 19,
      method: 'mcp/add',
      params: {
        name: 'smoke_mcp',
        scope: 'user',
        config: { command: 'node', args: ['-e', 'process.exit(0)'] },
      },
    },
    {
      jsonrpc: '2.0',
      id: 20,
      method: 'mcp/inspect',
      params: { name: 'smoke_mcp' },
    },
    {
      jsonrpc: '2.0',
      id: 21,
      method: 'mcp/test',
      params: { name: 'smoke_mcp' },
    },
    {
      jsonrpc: '2.0',
      id: 22,
      method: 'mcp/disable',
      params: { name: 'smoke_mcp' },
    },
    {
      jsonrpc: '2.0',
      id: 23,
      method: 'mcp/list',
      params: { includeDisabled: true },
    },
    {
      jsonrpc: '2.0',
      id: 24,
      method: 'mcp/enable',
      params: { name: 'smoke_mcp' },
    },
    {
      jsonrpc: '2.0',
      id: 25,
      method: 'mcp/update',
      params: {
        name: 'smoke_mcp',
        scope: 'user',
        config: { command: 'node', args: ['-e', 'console.log("updated")'] },
      },
    },
    {
      jsonrpc: '2.0',
      id: 26,
      method: 'mcp/restart',
      params: { name: 'smoke_mcp' },
    },
    {
      jsonrpc: '2.0',
      id: 27,
      method: 'mcp/remove',
      params: { name: 'smoke_mcp', scope: 'user' },
    },
    {
      jsonrpc: '2.0',
      id: 28,
      method: 'mcp/test',
      params: { name: 'smoke_mcp' },
    },
    {
      jsonrpc: '2.0',
      id: 29,
      method: 'mcp/install/search',
      params: { query: 'playwright' },
    },
    {
      jsonrpc: '2.0',
      id: 30,
      method: 'mcp/install/list',
      params: {},
    },
    {
      jsonrpc: '2.0',
      id: 31,
      method: 'mcp/install/plan',
      params: {
        scope: 'user',
        manifest: createSmokeInstallManifest(),
      },
    },
    { jsonrpc: '2.0', id: 32, method: 'shutdown', params: {} },
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
  assert.equal(responses[2].result.serverInfo.coreVersion, packageJson.version);
  assert.equal(responses[2].result.schemaVersions.config, '0.1');
  assert.equal(responses[2].result.capabilities.threads, true);
  assert.equal(responses[2].result.capabilities.turns, true);
  assert.equal(responses[2].result.capabilities.context, true);
  assert.equal(responses[2].result.capabilities.compact, true);
  assert.equal(responses[2].result.capabilities.memory, true);

  assert.equal(responses[3].id, 3);
  assert.equal(responses[3].result.llm.profileId, 'codex-oauth-1');
  assert.equal(responses[3].result.llm.provider, 'codex-oauth');
  assert.equal(responses[3].result.llm.model, 'gpt-5.4');
  assert.equal(
    responses[3].result.llm.capabilityTools.imageGeneration.available,
    true,
  );
  assertNoSecretKeys(responses[3].result);

  assert.equal(responses[4].id, 4);
  assert.equal(responses[4].result.provider, 'codex-oauth');
  assert.equal(typeof responses[4].result.available, 'boolean');
  assertNoSecretKeys(responses[4].result);

  assert.equal(responses[5].id, 5);
  const codexProvider = responses[5].result.providers.find(
    provider => provider.id === 'codex-oauth',
  );
  const deepSeekProvider = responses[5].result.providers.find(
    provider => provider.id === 'deepseek',
  );
  assert.ok(codexProvider);
  assert.ok(deepSeekProvider);
  assert.equal(codexProvider.capabilityTools.imageGeneration.available, true);
  assert.equal(
    deepSeekProvider.capabilityTools.imageGeneration.available,
    false,
  );
  assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.5'));
  assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.4'));
  assert.ok(codexProvider.models.some(model => model.model === 'gpt-5.4-mini'));
  assert.ok(
    deepSeekProvider.models.some(model => model.model === 'deepseek-v4-flash'),
  );
  assert.ok(
    deepSeekProvider.models.some(model => model.model === 'deepseek-v4-pro'),
  );

  assert.equal(responses[6].id, 6);
  assert.equal(responses[6].result.current.provider, 'codex-oauth');
  assert.equal(responses[6].result.current.model, 'gpt-5.5');

  assert.equal(responses[7].id, 7);
  assert.equal(responses[7].result.llm.provider, 'codex-oauth');
  assert.equal(responses[7].result.llm.model, 'gpt-5.5');
  assertNoSecretKeys(responses[7].result);

  assert.equal(responses[8].id, 8);
  assert.equal(responses[8].result.current.provider, 'codex-oauth');
  assert.equal(responses[8].result.current.model, 'gpt-5.4');

  assert.equal(responses[9].id, 9);
  assert.equal(responses[9].result.llm.provider, 'codex-oauth');
  assert.equal(responses[9].result.llm.model, 'gpt-5.4');
  assertNoSecretKeys(responses[9].result);

  assert.equal(responses[10].id, 10);
  assert.equal(Array.isArray(responses[10].result.servers), true);
  assert.equal(Array.isArray(responses[10].result.errors), true);
  assertNoSecretKeys(responses[10].result);

  assert.equal(responses[11].id, 11);
  assert.equal(responses[11].result.workspace.path, repoRoot);
  assert.equal(responses[11].result.workspace.trusted, true);

  assert.equal(responses[12].id, 12);
  assert.equal(responses[12].result.provider, 'deepseek');
  assert.equal(responses[12].result.model, 'deepseek-v4-flash');
  assert.equal(responses[12].result.state, 'needs_auth');
  assert.equal(responses[12].result.available, false);
  assert.equal(responses[12].result.testable, false);
  assert.equal(responses[12].result.networkChecked, false);
  assert.equal(responses[12].result.auth.configured, false);
  assert.equal(
    responses[12].result.capabilityTools.imageGeneration.available,
    false,
  );
  assertNoSecretKeys(responses[12].result);

  assert.equal(responses[13].id, 13);
  assert.equal(responses[13].result.provider, 'deepseek');
  assert.equal(responses[13].result.model, 'deepseek-v4-flash');
  assert.equal(responses[13].result.ok, false);
  assert.equal(responses[13].result.networkChecked, false);
  assert.equal(responses[13].result.error.kind, 'auth_required');
  assertNoSecretKeys(responses[13].result);

  assert.equal(responses[14].id, 14);
  assert.equal(responses[14].result.provider, 'deepseek');
  assert.equal(responses[14].result.model, 'deepseek-v4-flash');
  assert.equal(responses[14].result.credential.configured, true);
  assert.equal(responses[14].result.credential.profileId, 'deepseek-1');
  assert.equal(responses[14].result.availability.state, 'auth_ready');
  assertNoSecretKeys(responses[14].result);

  assert.equal(responses[15].id, 15);
  assert.equal(responses[15].result.state, 'auth_ready');
  assert.equal(responses[15].result.available, true);
  assert.equal(responses[15].result.testable, true);
  assertNoSecretKeys(responses[15].result);

  assert.equal(responses[16].id, 16);
  assert.equal(responses[16].result.credential.configured, false);
  assert.equal(responses[16].result.availability.state, 'needs_auth');
  assertNoSecretKeys(responses[16].result);

  assert.equal(responses[17].id, 17);
  assert.equal(responses[17].result.state, 'needs_auth');
  assert.equal(responses[17].result.available, false);
  assertNoSecretKeys(responses[17].result);

  assert.equal(responses[18].id, 18);
  assert.equal(responses[18].result.name, 'smoke_mcp');
  assert.equal(responses[18].result.found, false);
  assertNoSecretKeys(responses[18].result);

  assert.equal(responses[19].id, 19);
  assert.equal(responses[19].result.name, 'smoke_mcp');
  assert.equal(responses[19].result.found, true);
  assert.equal(responses[19].result.resolved.scope, 'user');
  assert.equal(responses[19].result.resolved.installKind, 'manual-config');
  assert.equal(responses[19].result.resolved.transport, 'stdio');
  assertNoSecretKeys(responses[19].result);

  assert.equal(responses[20].id, 20);
  assert.equal(responses[20].result.found, true);
  assert.equal(responses[20].result.resolved.enabled, true);
  assertNoSecretKeys(responses[20].result);

  assert.equal(responses[21].id, 21);
  assert.equal(responses[21].result.ok, false);
  assert.equal(responses[21].result.networkChecked, true);
  assert.equal(responses[21].result.state, 'failed');
  assert.deepEqual(responses[21].result.tools, []);
  assert.deepEqual(responses[21].result.resources, []);
  assertNoSecretKeys(responses[21].result);

  assert.equal(responses[22].id, 22);
  assert.equal(responses[22].result.found, true);
  assert.equal(responses[22].result.resolved.enabled, false);
  assertNoSecretKeys(responses[22].result);

  assert.equal(responses[23].id, 23);
  const disabledSmokeServer = responses[23].result.servers.find(
    server => server.name === 'smoke_mcp',
  );
  assert.ok(disabledSmokeServer);
  assert.equal(disabledSmokeServer.enabled, false);
  assertNoSecretKeys(responses[23].result);

  assert.equal(responses[24].id, 24);
  assert.equal(responses[24].result.found, true);
  assert.equal(responses[24].result.resolved.enabled, true);
  assertNoSecretKeys(responses[24].result);

  assert.equal(responses[25].id, 25);
  assert.equal(responses[25].result.found, true);
  assert.deepEqual(responses[25].result.resolved.args, [
    '-e',
    'console.log("updated")',
  ]);
  assertNoSecretKeys(responses[25].result);

  assert.equal(responses[26].id, 26);
  assert.equal(responses[26].result.accepted, true);
  assert.equal(responses[26].result.applied, false);
  assert.equal(responses[26].result.state, 'restart_pending_runtime');
  assertNoSecretKeys(responses[26].result);

  assert.equal(responses[27].id, 27);
  assert.equal(responses[27].result.removed, true);
  assertNoSecretKeys(responses[27].result);

  assert.equal(responses[28].id, 28);
  assert.equal(responses[28].result.ok, false);
  assert.equal(responses[28].result.state, 'not_found');
  assertNoSecretKeys(responses[28].result);

  assert.equal(responses[29].id, 29);
  assert.equal(responses[29].result.query, 'playwright');
  assert.equal(Array.isArray(responses[29].result.candidates), true);
  assert.ok(
    responses[29].result.candidates.some(
      candidate => candidate.manifest.name === 'playwright',
    ),
  );
  assertNoSecretKeys(responses[29].result);

  assert.equal(responses[30].id, 30);
  assert.equal(Array.isArray(responses[30].result.installed), true);
  assertNoSecretKeys(responses[30].result);

  assert.equal(responses[31].id, 31);
  assert.equal(responses[31].result.name, 'install_smoke_mcp');
  assert.equal(responses[31].result.scope, 'user');
  assert.equal(responses[31].result.requiresConfirmation, true);
  assert.equal(typeof responses[31].result.confirmation.token, 'string');
  assert.equal(responses[31].result.security.scopeWritable, true);
  assert.equal(responses[31].result.security.dataBoundary, 'local-only');
  assert.equal(
    typeof responses[31].result.security.packageCache.ownerMarkerPath,
    'string',
  );
  assertNoSecretKeys(responses[31].result);

  assert.equal(responses[32].id, 32);
  assert.equal(responses[32].result.accepted, true);

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
  const sessionHistoryRenameResponse = getResponseById(sessionResponses, 10);
  const threadResumeResponse = getResponseById(sessionResponses, 11);
  const threadMessagesResponse = getResponseById(sessionResponses, 12);
  const threadResumeRefreshResponse = getResponseById(sessionResponses, 13);
  const threadMessagesRefreshResponse = getResponseById(sessionResponses, 14);

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
  assert.equal(sessionHistoryRenameResponse.result.title, 'Renamed smoke session');
  assert.equal(Array.isArray(threadResumeResponse.result.messages), true);
  assert.equal(threadResumeResponse.result.thread.title, 'Renamed smoke session');
  assert.equal(
    threadResumeResponse.result.messagesSemantics,
    'display_replay_compat',
  );
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
  assert.ok(
    threadResumeResponse.result.messages.some(
      message =>
        message.role === 'user' &&
        message.text.includes('new user after compact boundary'),
    ),
  );
  assert.ok(threadResumeResponse.result.displaySnapshot);
  assert.equal(threadResumeResponse.result.displaySnapshot.source, 'history');
  assert.equal(
    threadResumeResponse.result.displaySnapshot.threadId,
    threadResumeResponse.result.thread.threadId,
  );
  assert.equal(
    threadResumeResponse.result.displaySnapshot.counts.rawTranscriptEvents,
    6,
  );
  assertDisplayCounts(threadResumeResponse.result.displaySnapshot);
  assert.equal(
    threadResumeResponse.result.displaySnapshot.counts.projectedDisplayItems,
    4,
  );
  assert.equal(
    threadResumeResponse.result.displaySnapshot.counts.filteredTranscriptEvents,
    2,
  );
  assert.equal(
    threadResumeResponse.result.displaySnapshot.counts.hiddenTimelineItems,
    2,
  );
  assert.ok(
    threadResumeResponse.result.displaySnapshot.items.some(
      item =>
        item.type === 'user_message' &&
        item.text.includes('hello from smoke transcript'),
    ),
  );
  const historyUserDisplayItem =
    threadResumeResponse.result.displaySnapshot.items.find(
      item =>
        item.type === 'user_message' &&
        item.text.includes('hello from smoke transcript'),
    );
  assert.equal(historyUserDisplayItem.projection?.version, 1);
  assert.equal(historyUserDisplayItem.projection?.event?.type, 'user_message');
  assert.ok(
    historyUserDisplayItem.projection?.event?.contentBlocks?.some(
      block => block.type === 'text',
    ),
    'history snapshot item should carry App Server rich projection content blocks',
  );
  assert.ok(
    threadResumeResponse.result.displaySnapshot.items.some(
      item =>
        item.type === 'assistant_message' &&
        item.text.includes('assistant reply from smoke transcript'),
    ),
  );
  assert.ok(
    threadResumeResponse.result.displaySnapshot.items.some(
      item =>
        item.type === 'user_message' &&
        item.text.includes('new user after compact boundary'),
    ),
    'history snapshot should replay UI-visible messages after compact boundary',
  );
  assert.equal(
    threadResumeResponse.result.displaySnapshot.items.some(item =>
      item.text.includes('Conversation compacted'),
    ),
    false,
    'history snapshot should hide compact boundary markers',
  );
  assert.ok(
    threadResumeResponse.result.displaySnapshot.items.some(
      item =>
        item.type === 'system_notice' &&
        item.text.includes('上下文已压缩'),
    ),
    'history snapshot should show a concise compact notice',
  );
  assert.equal(
    threadResumeResponse.result.displaySnapshot.items.some(item =>
      item.text.includes('This session is being continued from a previous conversation'),
    ),
    false,
    'history snapshot should hide model-facing compact summary prompts',
  );
  assertNoSecretKeys(threadResumeResponse.result);
  assert.equal(Array.isArray(threadMessagesResponse.result.messages), true);
  assert.equal(
    threadMessagesResponse.result.messagesSemantics,
    'current_context_compat',
  );
  assert.ok(threadMessagesResponse.result.displaySnapshot);
  assert.equal(threadMessagesResponse.result.displaySnapshot.source, 'thread');
  assertDisplayCounts(threadMessagesResponse.result.displaySnapshot);
  assert.ok(
    threadMessagesResponse.result.messages.some(
      message =>
        message.role === 'user' &&
        message.text.includes('new user after compact boundary'),
    ),
    'Core current context should include the post-compact user message',
  );
  assert.equal(
    threadMessagesResponse.result.messages.some(message =>
      message.text.includes('hello from smoke transcript'),
    ),
    false,
    'Core current context should not include pre-compact user message',
  );
  assert.equal(
    threadMessagesResponse.result.messages.some(message =>
      message.text.includes('assistant reply from smoke transcript'),
    ),
    false,
    'Core current context should not include pre-compact assistant message',
  );
  assert.equal(
    threadMessagesResponse.result.messages.some(message =>
      message.text.includes('This session is being continued from a previous conversation'),
    ),
    false,
    'Core current context compatibility messages should hide compact summary prompts from UI',
  );
  assert.ok(
    threadResumeResponse.result.displaySnapshot.items.some(item =>
      item.text.includes('hello from smoke transcript'),
    ),
    'UI history snapshot should retain pre-compact user message',
  );
  assert.ok(
    threadResumeResponse.result.displaySnapshot.items.some(item =>
      item.text.includes('assistant reply from smoke transcript'),
    ),
    'UI history snapshot should retain pre-compact assistant message',
  );
  assertNoSecretKeys(threadMessagesResponse.result);
  assert.equal(
    threadResumeRefreshResponse.result.thread.threadId,
    threadResumeResponse.result.thread.threadId,
  );
  assert.equal(
    threadResumeRefreshResponse.result.messagesSemantics,
    'display_replay_compat',
  );
  assert.ok(
    threadResumeRefreshResponse.result.messages.some(
      message =>
        message.role === 'user' &&
        message.text.includes('second user line from smoke transcript'),
    ),
  );
  assert.equal(
    threadResumeRefreshResponse.result.displaySnapshot.counts.rawTranscriptEvents,
    7,
  );
  assertDisplayCounts(threadResumeRefreshResponse.result.displaySnapshot);
  assert.equal(
    threadResumeRefreshResponse.result.displaySnapshot.counts.projectedDisplayItems,
    5,
  );
  assert.equal(
    threadResumeRefreshResponse.result.displaySnapshot.counts.filteredTranscriptEvents,
    2,
  );
  assert.equal(
    threadResumeRefreshResponse.result.displaySnapshot.counts.hiddenTimelineItems,
    2,
  );
  assert.ok(
    threadResumeRefreshResponse.result.displaySnapshot.items.some(
      item =>
        item.type === 'user_message' &&
        item.text.includes('second user line from smoke transcript'),
    ),
  );
  assert.ok(
    threadMessagesRefreshResponse.result.messages.length >
      threadMessagesResponse.result.messages.length,
  );
  assert.equal(
    threadMessagesRefreshResponse.result.messagesSemantics,
    'current_context_compat',
  );
  assert.ok(
    threadMessagesRefreshResponse.result.messages.some(
      message =>
        message.role === 'user' &&
        message.text.includes('second user line from smoke transcript'),
    ),
  );
  assertNoSecretKeys(threadResumeRefreshResponse.result);
  assertNoSecretKeys(threadMessagesRefreshResponse.result);
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

  for (const legacyDisplayMethod of [
    'item/started',
    'item/delta',
    'item/completed',
    'turn/failed',
    'context/compacted',
    'permission/requested',
    'permission/cancelled',
  ]) {
    assert.equal(
      sessionNotifications.some(
        notification => notification.method === legacyDisplayMethod,
      ),
      false,
      `${legacyDisplayMethod} should not be emitted after display patch takeover`,
    );
  }
  const displayPatchNotifications = sessionNotifications.filter(
    notification => notification.method === 'thread/display/patch',
  );
  const firstFailurePatchIndex = sessionNotifications.findIndex(
    notification =>
      notification.method === 'thread/display/patch' &&
      notification.params.operations?.some(
        operation =>
          operation.op === 'append_item' &&
          operation.item?.type === 'error' &&
          operation.item?.status === 'failed',
      ),
  );
  assert.ok(
    firstFailurePatchIndex !== -1,
    'turn failure should emit a display patch error item',
  );
  assert.ok(
    displayPatchNotifications.some(notification =>
      notification.params.operations?.some(
        operation =>
          operation.op === 'append_item' &&
          operation.item?.type === 'error' &&
          operation.item?.status === 'failed',
      ),
    ),
    'turn failure should also emit a display patch error item',
  );
  const failurePatchItem = displayPatchNotifications
    .flatMap(notification => notification.params.operations ?? [])
    .find(
      operation =>
        operation.op === 'append_item' &&
        operation.item?.type === 'error' &&
      operation.item?.status === 'failed',
    )?.item;
  assert.equal(failurePatchItem.metadata?.stopReason, 'error');
  assert.equal(failurePatchItem.metadata?.errorKind, 'auth_required');
  assert.equal(typeof failurePatchItem.metadata?.latencyMs, 'number');
  assert.equal(failurePatchItem.projection?.version, 1);
  assert.equal(failurePatchItem.projection?.event?.type, 'error');
  assert.equal(
    failurePatchItem.projection?.event?.errorSnapshot?.source,
    'app_server',
    'live display patch error item should carry App Server rich error projection',
  );

  const permissionSmoke = runPermissionSmoke();
  assert.equal(permissionSmoke.status, 0, permissionSmoke.stderr);
  assert.equal(permissionSmoke.stderr, '');
  const permissionSmokeResult = JSON.parse(permissionSmoke.stdout);
  assert.equal(permissionSmokeResult.ok, true);
  assert.ok(
    permissionSmokeResult.checked.includes(
      'thread/display/patch_permission_requested',
    ),
  );
  assert.ok(permissionSmokeResult.checked.includes('permission/respond_allow'));
  assert.ok(
    permissionSmokeResult.checked.includes('permission/respond_duplicate'),
  );
  assert.ok(permissionSmokeResult.checked.includes('permission/respond_missing'));
  assert.ok(
    permissionSmokeResult.checked.includes(
      'thread/display/patch_permission_cancelled',
    ),
  );

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
          'model/availability',
          'model/test_auth_required_no_network',
          'model/credential/update',
          'model/set',
          'mcp/list',
          'mcp/inspect',
          'mcp/add',
          'mcp/test',
          'mcp/disable',
          'mcp/enable',
          'mcp/update',
          'mcp/restart',
          'mcp/remove',
          'mcp/install/search',
          'mcp/install/list',
          'mcp/install/plan',
          'mcp/install/security_contract',
          'workspace/open',
          'shutdown',
          'unsupported_transport',
          'thread/start',
          'thread/list',
          'thread/messages/list',
          'session/history/list',
          'session/history/rename',
          'thread/resume_history_messages',
          'thread/display/snapshot_counts',
          'thread/display/snapshot_thread_messages',
          'thread/display/snapshot_materialized_resume',
          'thread/display/hides_compact_internal_messages',
          'thread/display/compact_notice',
          'thread/display/attachment_projection',
          'thread/display/patch_replaces_legacy_display_notifications',
          'context/status',
          'compact/status',
          'memory/session/status',
          'turn/start_auth_required_failure',
          'thread/display/patch',
          'thread/display/patch_permission_requested',
          'permission/respond_allow',
          'permission/respond_duplicate',
          'permission/respond_missing',
          'thread/display/patch_permission_cancelled',
          'tool/display/lifecycle_source_binding',
          'thread/display/snapshot_parallel_tool_split',
          'thread/display/patch_parallel_tool_lifecycle',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

async function runToolDisplayLifecycleSmoke() {
  const {
    createToolDisplayLifecycleReducer,
    normalizeToolResultSourceIdFromBlock,
    normalizeToolUseIdFromBlock,
  } = await import('../dist/src/app-server/toolDisplayLifecycle.js');

  assert.equal(normalizeToolUseIdFromBlock({ id: 'tool-a' }), 'tool-a');
  assert.equal(
    normalizeToolResultSourceIdFromBlock({ tool_use_id: 'tool-a' }),
    'tool-a',
  );

  const reducer = createToolDisplayLifecycleReducer();
  reducer.accept({
    kind: 'tool_use',
    block: { type: 'tool_use', id: 'tool-a', name: 'Read' },
    source: { messageUuid: 'assistant-1', rawIndex: 1, contentIndex: 0 },
  });
  reducer.accept({
    kind: 'tool_use',
    block: { type: 'tool_use', id: 'tool-b', name: 'Write' },
    source: { messageUuid: 'assistant-1', rawIndex: 1, contentIndex: 1 },
  });
  reducer.accept({
    kind: 'tool_result',
    block: { type: 'tool_result', tool_use_id: 'tool-b', content: 'B done' },
    source: { messageUuid: 'user-2', rawIndex: 2, contentIndex: 0 },
  });
  reducer.accept({
    kind: 'tool_result',
    block: { type: 'tool_result', tool_use_id: 'tool-a', content: 'A done' },
    source: { messageUuid: 'user-2', rawIndex: 2, contentIndex: 1 },
  });
  reducer.accept({
    kind: 'tool_use',
    block: { type: 'tool_use', id: 'tool-a', name: 'Read' },
    source: { messageUuid: 'assistant-duplicate', rawIndex: 3, contentIndex: 0 },
  });
  reducer.accept({
    kind: 'tool_result',
    block: { type: 'tool_result', content: 'missing source' },
    source: { messageUuid: 'user-3', rawIndex: 4, contentIndex: 0 },
  });

  const items = reducer.getItems();
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map(item => item.itemId),
    ['tool:tool-a', 'tool:tool-b', 'missing_tool_result_source_id:user-3:0'],
  );
  assert.deepEqual(
    items.slice(0, 2).map(item => item.resultBlock?.content),
    ['A done', 'B done'],
  );
  assert.equal(items[0].status, 'completed');
  assert.equal(items[1].status, 'completed');
  assert.equal(items[2].status, 'diagnostic');
  assert.equal(items[2].diagnostic?.code, 'missing_tool_result_source_id');
}

async function runThreadDisplayAttachmentProjectionSmoke() {
  const { buildThreadDisplaySnapshot, coreEventToThreadDisplayPatch } = await import(
    '../dist/src/app-server/threadDisplay.js'
  );
  const generatedPath =
    'C:\\Users\\luoji\\.ccr\\generated_outputs\\53ad3489-dacc-4b7e-9bf1-41c2aa555a3c\\out_9b5eef00-a4c0-4b39-8ae7-0472d5d99ef9.png';
  const snapshot = buildThreadDisplaySnapshot({
    threadId: 'thread-attachment-projection',
    source: 'history',
    rawTranscriptEvents: 2,
    coreContextMessages: 2,
    messages: [
      {
        id: 'user-image-upload',
        role: 'user',
        text: '[图片]',
        status: 'completed',
        kind: 'user_message',
        content: [
          { type: 'text', text: '[图片]' },
          {
            type: 'image',
            attachmentId: 'upload-image-1',
            displayName: 'image.png',
            mimeType: 'image/png',
            path: 'C:\\Users\\luoji\\AppData\\Roaming\\CCR\\attachments\\clipboard\\image.png',
            sizeBytes: 218700,
          },
        ],
      },
      {
        id: 'assistant-generated-image',
        role: 'assistant',
        text: `已生成图片：\n${generatedPath}`,
        status: 'completed',
        kind: 'assistant_message',
        content: [
          { type: 'text', text: `已生成图片：\n${generatedPath}` },
          {
            type: 'image',
            attachmentId: 'generated-image-1',
            displayName: 'out_9b5eef00-a4c0-4b39-8ae7-0472d5d99ef9.png',
            mimeType: 'image/png',
            origin: 'model_output',
            lifecycle: 'persisted',
            safety: 'needs_review',
            provider: 'codex-oauth',
            model: 'gpt-5.5',
            savedPath: generatedPath,
          },
        ],
      },
    ],
  });
  const userImageItem = snapshot.items.find(item => item.id === 'user-image-upload');
  assert.equal(userImageItem?.projection?.event?.text, '');
  assert.equal(
    userImageItem?.projection?.event?.attachmentSnapshots?.[0]?.source,
    'UserUpload',
  );
  assert.equal(
    userImageItem?.projection?.event?.attachmentSnapshots?.[0]?.previewKind,
    'image',
  );
  const generatedImageItem = snapshot.items.find(
    item => item.id === 'assistant-generated-image',
  );
  assert.equal(
    generatedImageItem?.projection?.event?.attachmentSnapshots?.[0]?.source,
    'ModelOutput',
  );
  assert.equal(
    generatedImageItem?.projection?.event?.attachmentSnapshots?.[0]?.savedPath,
    generatedPath,
  );
  assert.equal(
    generatedImageItem?.projection?.event?.text.includes(generatedPath),
    false,
    'generated image local path should be removed from message text when attachment projection exists',
  );

  const patch = coreEventToThreadDisplayPatch({
    type: 'item_completed',
    threadId: 'thread-attachment-projection',
    turnId: 'turn-attachment-projection',
    itemId: 'assistant-live-generated-image',
    kind: 'assistant_message',
    status: 'completed',
    content: [
      { type: 'text', text: `已生成图片：\n${generatedPath}` },
      {
        type: 'image',
        attachmentId: 'generated-image-live',
        displayName: 'out_live.png',
        mimeType: 'image/png',
        origin: 'model_output',
        lifecycle: 'persisted',
        safety: 'needs_review',
        savedPath: generatedPath,
      },
    ],
  });
  const liveItem = patch?.operations[0]?.item;
  assert.equal(patch?.operations[0]?.op, 'complete_item');
  assert.equal(
    liveItem?.projection?.event?.attachmentSnapshots?.[0]?.source,
    'ModelOutput',
  );
  assert.equal(liveItem?.projection?.event?.text.includes(generatedPath), false);
}

async function runThreadDisplaySnapshotToolSplitSmoke() {
  const { buildThreadDisplaySnapshot } = await import(
    '../dist/src/app-server/threadDisplay.js'
  );
  const snapshot = buildThreadDisplaySnapshot({
    threadId: 'thread-tool-split',
    source: 'history',
    rawTranscriptEvents: 2,
    coreContextMessages: 2,
    messages: [
      {
        id: 'assistant-tools',
        role: 'assistant',
        text: 'parallel tools',
        status: 'completed',
        kind: 'assistant',
        content: [
          { type: 'text', text: 'parallel tools' },
          { type: 'tool_use', id: 'tool-a', name: 'Read', input: { path: 'a' } },
          { type: 'tool_use', id: 'tool-b', name: 'Read', input: { path: 'b' } },
        ],
      },
      {
        id: 'user-tool-results',
        role: 'user',
        text: 'tool results',
        status: 'completed',
        kind: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tool-b', content: 'B result' },
          { type: 'tool_result', tool_use_id: 'tool-a', content: 'A result' },
        ],
      },
      {
        id: 'user-orphan-tool-results',
        role: 'user',
        text: 'orphan tool results',
        status: 'completed',
        kind: 'user',
        content: [
          { type: 'tool_result', content: 'missing source id' },
          {
            type: 'tool_result',
            tool_use_id: 'tool-missing',
            content: 'missing tool use',
          },
        ],
      },
    ],
  });

  const toolItems = snapshot.items.filter(item => item.id.startsWith('tool:'));
  assert.deepEqual(
    toolItems.map(item => item.id),
    ['tool:tool-a', 'tool:tool-b'],
  );
  assert.deepEqual(
    toolItems.map(item => item.identity?.contentIndex),
    [1, 2],
  );
  assert.deepEqual(
    toolItems.map(item => item.projection?.event?.identity?.contentIndex),
    [1, 2],
  );
  assert.deepEqual(
    toolItems.map(item => item.projection?.event?.identity?.rawIndex),
    [0, 0],
  );
  assert.deepEqual(
    toolItems.map(item => item.status),
    ['completed', 'completed'],
  );
  assert.deepEqual(
    toolItems.map(item => item.content?.[0]?.result),
    ['A result', 'B result'],
  );
  assert.deepEqual(
    toolItems.map(item => item.projection?.event?.toolSnapshot?.result),
    ['A result', 'B result'],
  );
  assert.equal(
    toolItems.every(
      item => item.projection?.event?.toolSnapshot?.kind === 'call',
    ),
    true,
  );
  const diagnosticItems = snapshot.items.filter(item => item.type === 'error');
  assert.deepEqual(
    diagnosticItems.map(item => item.id),
    [
      'missing_tool_result_source_id:user-orphan-tool-results:0',
      'orphan_tool_result:user-orphan-tool-results:1',
    ],
  );
  assert.deepEqual(
    diagnosticItems.map(item => item.metadata?.toolLifecycle?.diagnostic?.code),
    ['missing_tool_result_source_id', 'orphan_tool_result'],
  );
  assert.equal(
    diagnosticItems.every(
      item => item.projection?.event?.type === 'error',
    ),
    true,
  );
  assert.equal(snapshot.items.length, 5);
  assert.equal(snapshot.counts.projectedDisplayItems, 5);
}

async function runRealtimeToolDisplayPatchLifecycleSmoke() {
  const { buildThreadDisplaySnapshot, coreEventToThreadDisplayPatch } = await import(
    '../dist/src/app-server/threadDisplay.js'
  );
  const threadId = 'thread-live-tool-split';
  const turnId = 'turn-live-tool-split';
  const startedAt = '2026-05-24T00:00:00.000Z';
  const toolContent = [
    { type: 'tool_use', id: 'live-tool-a', name: 'Read', input: { path: 'a' } },
    { type: 'tool_use', id: 'live-tool-b', name: 'Read', input: { path: 'b' } },
  ];

  const startPatch = coreEventToThreadDisplayPatch({
    type: 'item_started',
    item: {
      itemId: 'live-assistant-tools',
      threadId,
      turnId,
      kind: 'assistant_message',
      status: 'completed',
      startedAt,
      content: toolContent,
    },
  });
  assert.deepEqual(
    startPatch.operations.map(operation => operation.op),
    ['append_item', 'append_item'],
  );
  assert.deepEqual(
    startPatch.operations.map(operation => operation.item?.id),
    ['tool:live-tool-a', 'tool:live-tool-b'],
  );
  assert.deepEqual(
    startPatch.operations.map(
      operation => operation.item?.projection?.event?.identity?.toolUseId,
    ),
    ['live-tool-a', 'live-tool-b'],
  );
  assert.deepEqual(
    startPatch.operations.map(
      operation => operation.item?.projection?.event?.toolSnapshot?.startedAt,
    ),
    [startedAt, startedAt],
  );

  const toolUseCompletedPatch = coreEventToThreadDisplayPatch({
    type: 'item_completed',
    threadId,
    turnId,
    itemId: 'live-assistant-tools',
    kind: 'assistant_message',
    status: 'completed',
    content: toolContent,
    startedAt,
    completedAt: '2026-05-24T00:00:01.000Z',
    durationMs: 1000,
  });
  assert.equal(toolUseCompletedPatch, null);

  const resultPatch = coreEventToThreadDisplayPatch({
    type: 'item_completed',
    threadId,
    turnId,
    itemId: 'live-user-tool-results',
    kind: 'tool_result',
    status: 'completed',
    content: [
      { type: 'tool_result', tool_use_id: 'live-tool-b', content: 'B live result' },
      { type: 'tool_result', tool_use_id: 'live-tool-a', content: 'A live result' },
    ],
    startedAt: '2026-05-24T00:00:02.000Z',
    completedAt: '2026-05-24T00:00:03.000Z',
    durationMs: 1000,
  });
  assert.deepEqual(
    resultPatch.operations.map(operation => operation.op),
    ['complete_item', 'complete_item'],
  );
  assert.deepEqual(
    resultPatch.operations.map(operation => operation.itemId),
    ['tool:live-tool-b', 'tool:live-tool-a'],
  );
  assert.deepEqual(
    resultPatch.operations.map(
      operation => operation.item?.projection?.event?.toolSnapshot?.result,
    ),
    ['B live result', 'A live result'],
  );
  assert.deepEqual(
    resultPatch.operations.map(
      operation => operation.item?.projection?.event?.toolSnapshot?.startedAt,
    ),
    [startedAt, startedAt],
  );
  assert.deepEqual(
    resultPatch.operations.map(
      operation => operation.item?.projection?.event?.toolSnapshot?.completedAt,
    ),
    ['2026-05-24T00:00:03.000Z', '2026-05-24T00:00:03.000Z'],
  );
  assert.deepEqual(
    resultPatch.operations.map(
      operation => operation.item?.projection?.event?.toolSnapshot?.durationMs,
    ),
    [3000, 3000],
  );
  const liveItems = new Map(
    startPatch.operations.map(operation => [
      operation.item.id,
      operation.item,
    ]),
  );
  for (const operation of resultPatch.operations) {
    liveItems.set(operation.itemId, operation.item);
  }
  const historySnapshot = buildThreadDisplaySnapshot({
    threadId,
    source: 'history',
    rawTranscriptEvents: 2,
    coreContextMessages: 2,
    messages: [
      {
        id: 'live-assistant-tools',
        role: 'assistant',
        text: 'parallel live tools',
        status: 'completed',
        kind: 'assistant',
        createdAt: startedAt,
        content: toolContent,
      },
      {
        id: 'live-user-tool-results',
        role: 'user',
        text: 'parallel live tool results',
        status: 'completed',
        kind: 'tool_result',
        createdAt: '2026-05-24T00:00:02.000Z',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'live-tool-b',
            content: 'B live result',
            completedAt: '2026-05-24T00:00:03.000Z',
          },
          {
            type: 'tool_result',
            tool_use_id: 'live-tool-a',
            content: 'A live result',
            completedAt: '2026-05-24T00:00:03.000Z',
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    summarizeToolItems(Array.from(liveItems.values())),
    summarizeToolItems(historySnapshot.items),
    'realtime patch final tool timeline should match history snapshot projection',
  );

  const orphanPatch = coreEventToThreadDisplayPatch({
    type: 'item_completed',
    threadId: 'thread-live-orphan',
    turnId: 'turn-live-orphan',
    itemId: 'live-orphan-results',
    kind: 'tool_result',
    status: 'completed',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'missing-live-tool',
        content: 'orphan result',
      },
    ],
  });
  assert.deepEqual(
    orphanPatch.operations.map(operation => operation.op),
    ['append_item'],
  );
  assert.equal(orphanPatch.operations[0].item?.type, 'error');
  assert.equal(
    orphanPatch.operations[0].item?.projection?.event?.type,
    'error',
  );
  assert.ok(
    orphanPatch.operations[0].item?.text.includes('工具结果引用的工具调用不存在'),
  );
}

function summarizeToolItems(items) {
  return items
    .filter(item => item.id?.startsWith?.('tool:'))
    .map(item => ({
      id: item.id,
      status: item.status,
      toolUseId: item.identity?.toolUseId,
      result: item.projection?.event?.toolSnapshot?.result,
      startedAt: item.projection?.event?.toolSnapshot?.startedAt,
      completedAt: item.projection?.event?.toolSnapshot?.completedAt,
      durationMs: item.projection?.event?.toolSnapshot?.durationMs,
    }));
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

function createSmokeInstallManifest() {
  return {
    schemaVersion: 1,
    name: 'install_smoke_mcp',
    displayName: 'Install smoke MCP',
    version: '1.2.3',
    source: {
      kind: 'stdio-npm-package',
      packageName: '@example/install-smoke-mcp',
      packageManager: 'npx',
    },
    transport: 'stdio',
    serverConfig: {
      type: 'stdio',
      command: 'node',
      args: ['-e', 'process.exit(0)'],
    },
    permissions: [{ kind: 'process', required: true }],
    dataBoundary: 'local-only',
  };
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
    message =>
      message.method === 'thread/display/patch' &&
      message.params.operations?.some(
        operation =>
          operation.op === 'append_item' &&
          operation.item?.type === 'error' &&
          operation.item?.metadata?.coreEventType === 'turn_failed',
      ),
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
    method: 'session/history/rename',
    params: {
      sessionId: smokeTranscript.sessionId,
      transcriptPath: smokeTranscript.transcriptPath,
      title: 'Renamed smoke session',
    },
  });
  await waitForMessage(messages, waiters, message => message.id === 10);

  send({
    jsonrpc: '2.0',
    id: 11,
    method: 'thread/resume',
    params: {
      sessionId: smokeTranscript.sessionId,
      transcriptPath: smokeTranscript.transcriptPath,
      projectPath: repoRoot,
    },
  });
  const resumedThreadResponse = await waitForMessage(
    messages,
    waiters,
    message => message.id === 11,
  );

  send({
    jsonrpc: '2.0',
    id: 12,
    method: 'thread/messages/list',
    params: { threadId: resumedThreadResponse.result.thread.threadId },
  });
  await waitForMessage(messages, waiters, message => message.id === 12);

  appendSmokeTranscriptMessage(smokeTranscript);
  send({
    jsonrpc: '2.0',
    id: 13,
    method: 'thread/resume',
    params: {
      sessionId: smokeTranscript.sessionId,
      transcriptPath: smokeTranscript.transcriptPath,
      projectPath: repoRoot,
    },
  });
  const refreshedThreadResponse = await waitForMessage(
    messages,
    waiters,
    message => message.id === 13,
  );

  send({
    jsonrpc: '2.0',
    id: 14,
    method: 'thread/messages/list',
    params: { threadId: refreshedThreadResponse.result.thread.threadId },
  });
  await waitForMessage(messages, waiters, message => message.id === 14);

  child.stdin.end();
  const status = await waitForExit(child);
  assert.equal(status, 0, stderr);
  assert.equal(stderr, '');
  return messages;
}

function writeSmokeTranscript() {
  const sessionId = randomUUID();
  const userUuid = randomUUID();
  const metaUuid = randomUUID();
  const assistantUuid = randomUUID();
  const compactBoundaryUuid = randomUUID();
  const compactSummaryUuid = randomUUID();
  const afterCompactUserUuid = randomUUID();
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
      type: 'system',
      uuid: metaUuid,
      parentUuid: userUuid,
      isSidechain: false,
      isMeta: true,
      timestamp,
      sessionId,
      cwd: repoRoot,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      content: 'hidden smoke metadata event',
    },
    {
      type: 'assistant',
      uuid: assistantUuid,
      parentUuid: metaUuid,
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
    {
      type: 'system',
      subtype: 'compact_boundary',
      uuid: compactBoundaryUuid,
      parentUuid: assistantUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: repoRoot,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      content: 'Conversation compacted',
    },
    {
      type: 'user',
      uuid: compactSummaryUuid,
      parentUuid: compactBoundaryUuid,
      isSidechain: false,
      isCompactSummary: true,
      isVisibleInTranscriptOnly: true,
      timestamp,
      sessionId,
      cwd: repoRoot,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'user',
        content:
          'This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.\n\nSummary:\n\nInternal smoke compact summary.',
      },
    },
    {
      type: 'user',
      uuid: afterCompactUserUuid,
      parentUuid: compactSummaryUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: repoRoot,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'user',
        content: 'new user after compact boundary',
      },
    },
  ];
  writeFileSync(
    transcriptPath,
    `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  );
  return { sessionId, transcriptPath, parentUuid: afterCompactUserUuid };
}

function appendSmokeTranscriptMessage(smokeTranscript) {
  const userUuid = randomUUID();
  const timestamp = new Date().toISOString();
  const entry = {
    type: 'user',
    uuid: userUuid,
    parentUuid: smokeTranscript.parentUuid,
    isSidechain: false,
    timestamp,
    sessionId: smokeTranscript.sessionId,
    cwd: repoRoot,
    version: 'smoke',
    userType: 'external',
    entrypoint: 'app-server',
    message: {
      role: 'user',
      content: 'second user line from smoke transcript',
    },
  };
  appendFileSync(smokeTranscript.transcriptPath, `${JSON.stringify(entry)}\n`, 'utf8');
  smokeTranscript.parentUuid = userUuid;
}

function assertDisplayCounts(snapshot) {
  const visibleTimelineItems = snapshot.items.filter(
    item => !item.timelineHidden,
  ).length;
  const hiddenDisplayItems = snapshot.items.filter(
    item => item.timelineHidden,
  ).length;
  const filteredTranscriptEvents = Math.max(
    0,
    snapshot.counts.rawTranscriptEvents - snapshot.items.length,
  );
  assert.equal(snapshot.counts.projectedDisplayItems, snapshot.items.length);
  assert.equal(snapshot.counts.visibleTimelineItems, visibleTimelineItems);
  assert.equal(snapshot.counts.hiddenDisplayItems, hiddenDisplayItems);
  assert.equal(snapshot.counts.filteredTranscriptEvents, filteredTranscriptEvents);
  assert.equal(
    snapshot.counts.hiddenTimelineItems,
    hiddenDisplayItems + filteredTranscriptEvents,
  );
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

function seedSmokeLlmConfig() {
  const configPath = resolve(tempDir, 'data', 'llm.config.local.json');
  mkdirSync(dirname(configPath), { recursive: true });
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
        },
      },
      null,
      2,
    ),
    'utf8',
  );
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
