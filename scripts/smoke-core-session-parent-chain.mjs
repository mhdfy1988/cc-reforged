import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'ccr-parent-chain-'));
const workspacePath = join(tempRoot, 'workspace');

try {
  process.env.CCR_CONFIG_DIR = join(tempRoot, '.ccr');
  process.env.CLAUDE_CODE_SIMPLE = '1';
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;

  mkdirSync(workspacePath, { recursive: true });

  const { enableConfigs } = await import('../dist/src/utils/config.js');
  enableConfigs();
  const { CoreSessionService } = await import('../dist/src/core/sessionCore.js');
  const { resetDefaultLlmRuntime } = await import(
    '../dist/src/services/llm/defaultRuntime.js'
  );
  const { createAssistantMessage, createUserMessage } = await import(
    '../dist/src/utils/messages.js'
  );
  const { runCleanupFunctions } = await import(
    '../dist/src/utils/cleanupRegistry.js'
  );
  resetDefaultLlmRuntime();

  const sessionId = randomUUID();
  const oldUserUuid = randomUUID();
  const oldAssistantUuid = randomUUID();
  const compactBoundaryUuid = randomUUID();
  const restoredUserUuid = randomUUID();
  const restoredAssistantUuid = randomUUID();
  const timestamp = new Date().toISOString();
  const transcriptPath = join(tempRoot, `${sessionId}.jsonl`);
  const baseEntries = [
    {
      type: 'user',
      uuid: oldUserUuid,
      parentUuid: null,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: workspacePath,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'user',
        content: 'old prompt before compact',
      },
    },
    {
      type: 'assistant',
      uuid: oldAssistantUuid,
      parentUuid: oldUserUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: workspacePath,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'old assistant before compact',
          },
        ],
      },
    },
    {
      type: 'system',
      subtype: 'compact_boundary',
      uuid: compactBoundaryUuid,
      parentUuid: oldAssistantUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: workspacePath,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
    },
    {
      type: 'user',
      uuid: restoredUserUuid,
      parentUuid: compactBoundaryUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: workspacePath,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'user',
        content: 'restored prompt after compact',
      },
    },
    {
      type: 'assistant',
      uuid: restoredAssistantUuid,
      parentUuid: restoredUserUuid,
      isSidechain: false,
      timestamp,
      sessionId,
      cwd: workspacePath,
      version: 'smoke',
      userType: 'external',
      entrypoint: 'app-server',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'restored assistant after compact',
          },
        ],
      },
    },
  ];
  writeFileSync(
    transcriptPath,
    `${baseEntries.map(entry => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  );

  const sink = createEventSink();
  const service = new CoreSessionService({
    persistTranscripts: true,
    emit: sink.emit,
    getWorkspace() {
      return {
        path: workspacePath,
        trusted: true,
      };
    },
    createCanUseTool() {
      return async () => ({ behavior: 'allow', updatedInput: {} });
    },
    async runQueryTurn(input) {
      await input.recordMessage(
        createUserMessage({
          content: input.turn.input.text,
        }),
      );
      await input.recordMessage(
        createAssistantMessage({
          content: [
            {
              type: 'text',
              text: 'mock assistant after resume',
            },
          ],
        }),
      );
      return {
        stopReason: 'completed',
      };
    },
  });

  const thread = await service.resumeThread({
    sessionId,
    transcriptPath,
    projectPath: workspacePath,
  });
  assert.equal(thread.metadata.sessionId, sessionId);
  assert.deepEqual(
    service.listThreadMessages(thread.threadId).map(message => message.type),
    ['system', 'user', 'assistant'],
  );
  const resumedTexts = service
    .listThreadMessages(thread.threadId)
    .map(getText)
    .join('\n');
  assert.ok(
    !resumedTexts.includes('old prompt before compact'),
    'Core resume must not load old user content before compact boundary',
  );
  assert.ok(
    !resumedTexts.includes('old assistant before compact'),
    'Core resume must not load old assistant content before compact boundary',
  );
  assert.ok(
    resumedTexts.includes('restored assistant after compact'),
    'Core resume must include materialized current-context leaf',
  );

  const turn = service.startTurn({
    threadId: thread.threadId,
    input: {
      type: 'text',
      text: 'future user after resume',
    },
  });
  await sink.waitForEvent(
    event => event.type === 'turn_completed' && event.turnId === turn.turnId,
  );

  const transcriptMessages = await waitForTranscriptMessages(
    transcriptPath,
    7,
  );
  assert.equal(transcriptMessages.length, 7);

  const resumedUser = transcriptMessages.find(
    entry =>
      entry.type === 'user' &&
      entry.message?.content === 'future user after resume',
  );
  assert.ok(resumedUser, 'resume turn should persist the new user message');
  assert.equal(
    resumedUser.parentUuid,
    restoredAssistantUuid,
    'new user message must chain to the restored canonical leaf',
  );

  const resumedAssistant = transcriptMessages.find(
    entry =>
      entry.type === 'assistant' &&
      entry.message?.content?.some?.(
        block =>
          block.type === 'text' && block.text === 'mock assistant after resume',
      ),
  );
  assert.ok(
    resumedAssistant,
    'resume turn should persist the new assistant message',
  );
  assert.equal(
    resumedAssistant.parentUuid,
    resumedUser.uuid,
    'assistant response must chain to the newly persisted user message',
  );

  const uuids = new Set(transcriptMessages.map(entry => entry.uuid));
  for (const entry of transcriptMessages) {
    assert.ok(
      entry.parentUuid === null || uuids.has(entry.parentUuid),
      'all persisted parentUuid values must point to a transcript message in the same file',
    );
  }
  await runCleanupFunctions();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function createEventSink() {
  const events = [];
  const waiters = [];
  return {
    emit(event) {
      events.push(event);
      for (const waiter of [...waiters]) {
        if (waiter.predicate(event)) {
          waiters.splice(waiters.indexOf(waiter), 1);
          clearTimeout(waiter.timeout);
          waiter.resolve(event);
        }
      }
    },
    waitForEvent(predicate) {
      const existing = events.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timeout: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error('Timed out waiting for core session event'));
          }, 5_000),
        };
        waiters.push(waiter);
      });
    },
  };
}

async function waitForTranscriptMessages(transcriptPath, expectedCount) {
  const deadline = Date.now() + 5_000;
  let lastMessages = [];
  while (Date.now() < deadline) {
    const content = readFileSync(transcriptPath, 'utf8').trim();
    lastMessages = content
      ? content
          .split('\n')
          .map(line => JSON.parse(line))
      : [];
    if (lastMessages.length >= expectedCount) {
      return lastMessages;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return lastMessages;
}

function getText(message) {
  const content = message.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(block => (block && block.type === 'text' ? block.text : ''))
    .join('\n');
}
