import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempRoot = await mkdtemp(join(tmpdir(), 'ccr-app-context-'));
const ccrHome = join(tempRoot, '.ccr');
const workspacePath = join(tempRoot, 'workspace');
await mkdir(workspacePath, { recursive: true });
process.env.CCR_CONFIG_DIR = ccrHome;
process.env.TEST_ENABLE_SESSION_PERSISTENCE = '1';
delete process.env.CLAUDE_CODE_SKIP_PROMPT_HISTORY;

const { enableConfigs } = await import('../dist/src/utils/config.js');
enableConfigs();
const { CoreSessionService } = await import('../dist/src/core/sessionCore.js');

await runInMemoryContextStateSmoke();
await runTranscriptResumeSmoke();

await rm(tempRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        'thread_message_history_persists_between_turns',
        'read_file_state_persists_between_turns',
        'compact_boundary_trims_pre_boundary_history',
        'turn_metadata_exposes_context_observability',
        'context_status_exposes_thread_state',
        'context_analysis_exposes_aggregate_usage',
        'compact_status_exposes_auto_compact_state',
        'compact_boundary_emits_context_compacted_event',
        'memory_session_status_exposes_runtime_state',
        'thread_transcript_is_written_per_session',
        'thread_resume_restores_messages_and_read_file_state',
      ],
    },
    null,
    2,
  ),
);
process.exit(0);

async function runInMemoryContextStateSmoke() {
  const sink = createEventSink();
  const historySnapshots = [];

  const service = new CoreSessionService({
    persistTranscripts: false,
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
      historySnapshots.push(input.historyMessages.map(message => message.type));

      if (historySnapshots.length === 1) {
        input.readFileState.set('smoke-first-read.txt', {
          content: 'first turn read state',
          timestamp: 1,
          offset: undefined,
          limit: undefined,
        });
      } else {
        assert.equal(input.readFileState.has('smoke-first-read.txt'), true);
      }

      if (historySnapshots.length === 3) {
        await input.recordMessage(createUserHistoryMessage(input.turn.input.text));
        await input.recordMessage(createCompactBoundaryMessage());
        await input.recordMessage(createUserHistoryMessage('preserved after compact'));
        await input.recordMessage(createAssistantHistoryMessage('after compact'));
      } else {
        await input.recordMessage(createUserHistoryMessage(input.turn.input.text));
        await input.recordMessage(
          createAssistantHistoryMessage(
            `history-before-turn=${input.historyMessages.length}`,
          ),
        );
      }

      return {
        stopReason: 'completed',
      };
    },
  });

  const thread = service.startThread({ title: 'context smoke' });
  const initialContextStatus = service.getContextStatus({
    threadId: thread.threadId,
  });
  assert.equal(initialContextStatus.available, true);
  assert.equal(initialContextStatus.threadId, thread.threadId);
  assert.equal(initialContextStatus.messageCount, 0);
  assert.equal(initialContextStatus.readFileStateSize, 0);
  assert.equal(initialContextStatus.compactBoundaryCount, 0);
  assert.equal(typeof initialContextStatus.contentReplacement.enabled, 'boolean');
  assert.equal(
    typeof initialContextStatus.memoryAttachments.loadedNestedMemoryPathCount,
    'number',
  );

  const initialCompactStatus = service.getCompactStatus({
    threadId: thread.threadId,
  });
  assert.equal(initialCompactStatus.available, true);
  assert.equal(initialCompactStatus.threadId, thread.threadId);
  assert.equal(typeof initialCompactStatus.autoCompactEnabled, 'boolean');
  assert.equal(typeof initialCompactStatus.autoCompactThreshold, 'number');
  assert.equal(typeof initialCompactStatus.effectiveContextWindow, 'number');

  const initialMemoryStatus = await service.getMemorySessionStatus({
    threadId: thread.threadId,
  });
  assert.equal(initialMemoryStatus.available, true);
  assert.equal(initialMemoryStatus.threadId, thread.threadId);
  assert.equal(typeof initialMemoryStatus.hookRegistered, 'boolean');

  const initialContextAnalysis = await service.getContextAnalysis({
    threadId: thread.threadId,
  });
  assert.equal(initialContextAnalysis.available, true);
  assert.equal(initialContextAnalysis.threadId, thread.threadId);
  assert.equal(typeof initialContextAnalysis.analysis.totalTokens, 'number');
  assert.equal(typeof initialContextAnalysis.analysis.counts.memoryFileCount, 'number');
  assert.equal(initialContextAnalysis.analysis.memoryFiles, undefined);

  const firstTurn = service.startTurn({
    threadId: thread.threadId,
    input: { type: 'text', text: 'first' },
  });
  const firstCompleted = await sink.waitForEvent(
    event => event.type === 'turn_completed' && event.turnId === firstTurn.turnId,
  );

  const secondTurn = service.startTurn({
    threadId: thread.threadId,
    input: { type: 'text', text: 'second' },
  });
  const secondCompleted = await sink.waitForEvent(
    event =>
      event.type === 'turn_completed' && event.turnId === secondTurn.turnId,
  );

  const thirdTurn = service.startTurn({
    threadId: thread.threadId,
    input: { type: 'text', text: 'compact' },
  });
  const thirdCompleted = await sink.waitForEvent(
    event => event.type === 'turn_completed' && event.turnId === thirdTurn.turnId,
  );
  const compactedEvent = await sink.waitForEvent(
    event => event.type === 'context_compacted' && event.threadId === thread.threadId,
  );

  assert.deepEqual(historySnapshots, [
    [],
    ['user', 'assistant'],
    ['user', 'assistant', 'user', 'assistant'],
  ]);
  assert.equal(firstCompleted.metadata.messageCount, 2);
  assert.deepEqual(firstCompleted.metadata.lastMessageTypes, [
    'user',
    'assistant',
  ]);
  assert.equal(firstCompleted.metadata.readFileStateSize, 1);
  assert.equal(firstCompleted.metadata.sessionStorageStatus, 'disabled');
  assert.equal(secondCompleted.metadata.messageCount, 4);
  assert.deepEqual(secondCompleted.metadata.lastMessageTypes, [
    'user',
    'assistant',
    'user',
    'assistant',
  ]);
  assert.equal(secondCompleted.metadata.readFileStateSize, 1);
  assert.equal(thirdCompleted.metadata.messageCount, 3);
  assert.deepEqual(thirdCompleted.metadata.lastMessageTypes, [
    'system:compact_boundary',
    'user',
    'assistant',
  ]);
  assert.equal(thirdCompleted.metadata.compactBoundaryCount, 1);
  assert.equal(thirdCompleted.metadata.readFileStateSize, 1);
  assert.equal(compactedEvent.result.trigger, 'auto');
  assert.equal(compactedEvent.result.preTokens, 1000);
  assert.equal(compactedEvent.metadata.compactBoundaryCount, 1);

  const compactedContextStatus = service.getContextStatus({
    threadId: thread.threadId,
  });
  assert.equal(compactedContextStatus.messageCount, 3);
  assert.equal(compactedContextStatus.compactBoundaryCount, 1);
  const compactedCompactStatus = service.getCompactStatus({
    threadId: thread.threadId,
  });
  assert.equal(compactedCompactStatus.compactBoundaryCount, 1);
}

async function runTranscriptResumeSmoke() {
  const firstSink = createEventSink();
  const firstService = new CoreSessionService({
    emit: firstSink.emit,
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
      const readToolUseId = `toolu_${randomUUID()}`;
      await input.recordMessage(createUserHistoryMessage(input.turn.input.text));
      await input.recordMessage(createReadToolUseMessage(readToolUseId));
      await input.recordMessage(createReadToolResultMessage(readToolUseId));
      await input.recordMessage(createAssistantHistoryMessage('read completed'));
      return {
        stopReason: 'completed',
      };
    },
  });

  const thread = firstService.startThread({ title: 'persistent context smoke' });
  const sessionId = thread.metadata.sessionId;
  assert.equal(typeof sessionId, 'string');
  const firstTurn = firstService.startTurn({
    threadId: thread.threadId,
    input: { type: 'text', text: 'persist first' },
  });
  const completed = await firstSink.waitForEvent(
    event => event.type === 'turn_completed' && event.turnId === firstTurn.turnId,
  );

  assert.equal(completed.metadata.sessionStorageStatus, 'active');
  assert.equal(completed.metadata.readFileStateSize, 0);
  const transcriptPath = pathFromSessionStorageMetadata(
    completed.metadata.sessionStoragePath,
  );
  await waitForPath(transcriptPath);

  const secondSink = createEventSink();
  const resumeHistorySnapshots = [];
  const resumedService = new CoreSessionService({
    persistTranscripts: false,
    emit: secondSink.emit,
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
      resumeHistorySnapshots.push(
        input.historyMessages.map(message => message.type),
      );
      assert.ok(input.historyMessages.length >= 4);
      assert.equal(input.readFileState.size, 1);
      await input.recordMessage(createUserHistoryMessage(input.turn.input.text));
      await input.recordMessage(createAssistantHistoryMessage('resume ok'));
      return {
        stopReason: 'completed',
      };
    },
  });

  const resumedThread = await resumedService.resumeThread({
    sessionId,
    title: 'resumed context smoke',
  });
  assert.equal(resumedThread.metadata.resumedFromSessionId, sessionId);
  assert.equal(resumedThread.metadata.sessionStorageStatus, 'disabled');

  const resumedTurn = resumedService.startTurn({
    threadId: resumedThread.threadId,
    input: { type: 'text', text: 'after resume' },
  });
  const resumedCompleted = await secondSink.waitForEvent(
    event =>
      event.type === 'turn_completed' && event.turnId === resumedTurn.turnId,
  );

  assert.equal(resumedCompleted.metadata.readFileStateSize, 1);
  assert.equal(resumeHistorySnapshots[0][0], 'user');
  assert.ok(resumeHistorySnapshots[0].includes('assistant'));
  assert.ok(
    resumeHistorySnapshots[0].filter(messageType => messageType === 'user')
      .length >= 2,
  );
}

function createUserHistoryMessage(text) {
  return {
    type: 'user',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    message: {
      role: 'user',
      content: text,
    },
  };
}

function createAssistantHistoryMessage(text) {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    requestId: `req_${randomUUID()}`,
    message: {
      id: `msg_${randomUUID()}`,
      role: 'assistant',
      model: 'smoke',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
    },
  };
}

function createReadToolUseMessage(toolUseId) {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    requestId: `req_${randomUUID()}`,
    message: {
      id: `msg_${randomUUID()}`,
      role: 'assistant',
      model: 'smoke',
      content: [
        {
          type: 'tool_use',
          id: toolUseId,
          name: 'Read',
          input: {
            file_path: 'resume-read.txt',
          },
        },
      ],
      stop_reason: 'tool_use',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
    },
  };
}

function createReadToolResultMessage(toolUseId) {
  return {
    type: 'user',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: '     1→remembered file content',
        },
      ],
    },
  };
}

function createCompactBoundaryMessage() {
  return {
    type: 'system',
    subtype: 'compact_boundary',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    content: 'compact boundary',
    compactMetadata: {
      trigger: 'auto',
      preTokens: 1000,
    },
  };
}

function pathFromSessionStorageMetadata(sessionStoragePath) {
  assert.equal(typeof sessionStoragePath, 'string');
  assert.ok(sessionStoragePath.startsWith('projects/'));
  return join(ccrHome, sessionStoragePath);
}

async function waitForPath(path) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await stat(path);
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  await stat(path);
}

function createEventSink() {
  const events = [];
  const waiters = [];

  const emit = event => {
    events.push(event);
    resolveWaiters();
  };

  const waitForEvent = predicate => {
    const existing = events.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
      };
      const timeout = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index !== -1) {
          waiters.splice(index, 1);
        }
        reject(new Error('Timed out waiting for core context event'));
      }, 15_000);

      waiter.resolve = event => {
        clearTimeout(timeout);
        resolve(event);
      };
      waiters.push(waiter);
    });
  };

  const resolveWaiters = () => {
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      const event = events.find(waiter.predicate);
      if (event) {
        waiters.splice(index, 1);
        waiter.resolve(event);
      }
    }
  };

  return {
    emit,
    waitForEvent,
  };
}
