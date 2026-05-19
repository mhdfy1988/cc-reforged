import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'ccr-turn-input-'));
const workspacePath = join(tempRoot, 'workspace');
const configPath = join(tempRoot, 'llm.config.local.json');
const credentialsPath = join(tempRoot, 'llm.credentials.local.json');

mkdirSync(workspacePath, { recursive: true });

try {
  process.env.CCR_CONFIG_DIR = join(tempRoot, '.ccr');
  process.env.CCR_LLM_CONFIG_PATH = configPath;
  process.env.CCR_LLM_CREDENTIALS_PATH = credentialsPath;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;
  delete process.env.CCR_DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  const { enableConfigs } = await import('../dist/src/utils/config.js');
  enableConfigs();

  const { createAppServerContext, handleJsonRpcMessage } = await import(
    '../dist/src/app-server/router.js'
  );
  const { normalizeContentInput } = await import(
    '../dist/src/app-server/turnInput.js'
  );
  const { createDefaultLlmModelCapabilities } = await import(
    '../dist/src/services/llm/modelCapabilities.js'
  );
  const { CoreSessionService } = await import(
    '../dist/src/core/sessionCore.js'
  );
  const { resetDefaultLlmRuntime } = await import(
    '../dist/src/services/llm/defaultRuntime.js'
  );

  await runTurnStartScenario({
    label: 'legacy text input',
    config: createDeepSeekConfig(),
    input: { type: 'text', text: 'hello legacy text' },
    assertResponse(response) {
      assert.equal(response.result.turn.status, 'queued');
      assert.equal(response.result.turn.input.text, 'hello legacy text');
      assert.equal(response.result.turn.metadata.multimodalInput, undefined);
    },
  });

  await runTurnStartScenario({
    label: 'content text input',
    config: createDeepSeekConfig(),
    input: {
      type: 'content',
      content: [{ type: 'text', text: 'hello content text' }],
    },
    assertResponse(response) {
      assert.equal(response.result.turn.status, 'queued');
      assert.equal(response.result.turn.input.text, 'hello content text');
      assert.equal(response.result.turn.input.type, 'content');
      assert.equal(response.result.turn.input.content.length, 1);
      assert.deepEqual(response.result.turn.input.content[0], {
        type: 'text',
        text: 'hello content text',
      });
      assert.equal(response.result.turn.metadata.multimodalInput.deferred, false);
      assert.equal(
        response.result.turn.metadata.multimodalInput.modalityCounts.text,
        1,
      );
    },
  });

  await runTurnStartScenario({
    label: 'text file converted to text block',
    config: createDeepSeekConfig(),
    input: {
      type: 'content',
      content: [
        {
          type: 'text',
          text: [
            '[文本文件：notes.md]',
            '类型：text/markdown',
            '大小：18 bytes',
            '',
            '# hello text file',
          ].join('\n'),
        },
      ],
    },
    assertResponse(response) {
      assert.equal(response.result.turn.status, 'queued');
      assert.equal(response.result.turn.input.type, 'content');
      assert.match(response.result.turn.input.text, /\[文本文件：notes\.md\]/);
      assert.match(response.result.turn.input.content[0].text, /# hello text file/);
      assert.equal(response.result.turn.metadata.multimodalInput.deferred, false);
      assert.equal(
        response.result.turn.metadata.multimodalInput.modalityCounts.text,
        1,
      );
    },
  });

  await runTurnStartScenario({
    label: 'image blocked by default text-only model',
    config: createDeepSeekConfig(),
    input: {
      type: 'content',
      content: [
        { type: 'text', text: 'please inspect this image' },
        {
          type: 'image',
          displayName: 'diagram.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
          source: { kind: 'file', path: join(workspacePath, 'diagram.png') },
        },
      ],
    },
    assertResponse(response) {
      assert.equal(response.error.code, -32602);
      assert.equal(response.error.data.kind, 'invalid_params');
      assert.deepEqual(response.error.data.details.unsupportedModalities, [
        'image',
      ]);
      assert.equal(
        response.error.data.details.rejectedBlocks[0].reason,
        'unsupported_modality',
      );
    },
  });

  await runTurnStartScenario({
    label: 'image allowed by profile override',
    config: createDeepSeekConfig({
      capabilityOverrides: {
        default: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
          tools: true,
          structuredOutput: false,
          image: {
            maxImages: 2,
            maxImageBytes: 2048,
            mimeTypes: ['image/png', 'image/jpeg'],
          },
          reason: 'smoke profile enables image input',
        },
      },
    }),
    input: {
      type: 'content',
      content: [
        { type: 'text', text: 'please inspect this image' },
        {
          type: 'image',
          displayName: 'diagram.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
          source: { kind: 'file', path: join(workspacePath, 'diagram.png') },
        },
      ],
    },
    assertResponse(response) {
      assert.equal(response.result.turn.status, 'queued');
      assert.equal(response.result.turn.input.type, 'content');
      assert.match(response.result.turn.input.text, /please inspect this image/);
      assert.match(response.result.turn.input.text, /\[图片附件：diagram\.png\]/);
      assert.equal(response.result.turn.input.content[1].type, 'image');
      assert.equal(response.result.turn.input.content[1].displayName, 'diagram.png');
      assert.deepEqual(response.result.turn.input.content[1].source, {
        kind: 'file',
        path: join(workspacePath, 'diagram.png'),
      });
      assert.equal(response.result.turn.metadata.multimodalInput.deferred, true);
      assert.equal(
        response.result.turn.metadata.multimodalInput.capabilitySource,
        'profile_override',
      );
      assert.equal(
        response.result.turn.metadata.multimodalInput.modalityCounts.image,
        1,
      );
    },
  });

  await runTurnStartScenario({
    label: 'video allowed by profile override',
    config: createDeepSeekConfig({
      capabilityOverrides: {
        default: {
          inputModalities: ['text', 'video'],
          outputModalities: ['text'],
          tools: true,
          structuredOutput: false,
          reason: 'smoke profile enables video input',
        },
      },
    }),
    input: {
      type: 'content',
      content: [
        { type: 'text', text: 'please inspect this video' },
        {
          type: 'video',
          displayName: 'clip.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 2048,
          source: { kind: 'file', path: join(workspacePath, 'clip.mp4') },
        },
      ],
    },
    assertResponse(response) {
      assert.equal(response.result.turn.status, 'queued');
      assert.equal(response.result.turn.input.type, 'content');
      assert.match(response.result.turn.input.text, /please inspect this video/);
      assert.match(response.result.turn.input.text, /\[视频附件：clip\.mp4\]/);
      assert.equal(response.result.turn.input.content[1].type, 'video');
      assert.equal(response.result.turn.input.content[1].displayName, 'clip.mp4');
      assert.equal(response.result.turn.metadata.multimodalInput.deferred, true);
      assert.equal(
        response.result.turn.metadata.multimodalInput.modalityCounts.video,
        1,
      );
    },
  });

  assert.throws(
    () =>
      normalizeContentInput(
        {
          type: 'content',
          content: [
            {
              type: 'image',
              displayName: 'unknown.png',
              mimeType: 'image/png',
              sizeBytes: 1,
            },
          ],
        },
        {
          provider: 'unknown',
          model: 'unknown-model',
          modelCapabilities: createDefaultLlmModelCapabilities('unknown-model'),
        },
      ),
    error =>
      error?.kind === 'invalid_params' &&
      error?.details?.unsupportedModalities?.includes('image'),
  );

  await runCoreContentInputSmoke();

  resetDefaultLlmRuntime();

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'turn_start_legacy_text_input',
          'turn_start_content_text_input',
          'turn_start_text_file_converted_to_text_block',
          'turn_start_image_blocked_by_default_text_model',
          'turn_start_image_allowed_with_file_source_by_profile_override',
          'turn_start_video_allowed_with_file_source_by_profile_override',
          'normalize_content_input_defaults_to_text_only',
          'core_turn_preserves_content_blocks',
        ],
      },
      null,
      2,
    ),
  );

  async function runTurnStartScenario(input) {
    writeFileSync(configPath, JSON.stringify(input.config, null, 2), 'utf8');
    resetDefaultLlmRuntime();

    const context = createAppServerContext();
    await request(context, 1, 'initialize', {
      clientInfo: { name: `smoke-turn-input:${input.label}` },
    });
    await request(context, 2, 'workspace/open', {
      path: workspacePath,
      trust: 'trusted',
    });
    const threadResponse = await request(context, 3, 'thread/start', {
      title: input.label,
    });
    const turnResponse = await request(context, 4, 'turn/start', {
      threadId: threadResponse.result.thread.threadId,
      input: input.input,
    });
    input.assertResponse(turnResponse);
  }

  async function request(context, id, method, params) {
    return handleJsonRpcMessage(context, {
      jsonrpc: '2.0',
      id,
      method,
      params,
    });
  }

  async function runCoreContentInputSmoke() {
    writeFileSync(configPath, JSON.stringify(createDeepSeekConfig(), null, 2), 'utf8');
    resetDefaultLlmRuntime();

    const sink = createEventSink();
    const observedTurns = [];
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
        observedTurns.push(input.turn.input);
        assert.equal(input.turn.input.type, 'content');
        assert.equal(input.turn.input.text.includes('core content smoke'), true);
        assert.equal(input.turn.input.content[0].type, 'text');
        assert.equal(input.turn.input.content[1].type, 'image');
        assert.equal(input.turn.input.content[1].source.contentRef, 'att_core');
        return {
          stopReason: 'completed',
        };
      },
    });

    const thread = service.startThread({ title: 'core content smoke' });
    const turn = service.startTurn({
      threadId: thread.threadId,
      input: {
        type: 'content',
        text: 'core content smoke\n[图片附件：core.png]',
        content: [
          { type: 'text', text: 'core content smoke' },
          {
            type: 'image',
            displayName: 'core.png',
            mimeType: 'image/png',
            sizeBytes: 16,
            source: { kind: 'contentRef', contentRef: 'att_core' },
          },
        ],
      },
    });
    assert.equal(turn.input.type, 'content');
    assert.equal(turn.input.content[1].displayName, 'core.png');

    await sink.waitForEvent(
      event => event.type === 'turn_completed' && event.turnId === turn.turnId,
    );
    assert.equal(observedTurns.length, 1);
  }
} finally {
  delete process.env.CCR_CONFIG_DIR;
  delete process.env.CCR_LLM_CONFIG_PATH;
  delete process.env.CCR_LLM_CREDENTIALS_PATH;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;
  delete process.env.CCR_DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  rmSync(tempRoot, { recursive: true, force: true });
}

function createDeepSeekConfig(options = {}) {
  return {
    schemaVersion: 2,
    current: {
      profileId: 'deepseek-smoke',
      model: 'deepseek-v4-flash',
    },
    profiles: {
      'deepseek-smoke': {
        name: 'DeepSeek Smoke',
        providerType: 'deepseek',
        apiMode: 'openai-chat',
        auth: {
          strategy: 'api_key',
        },
        defaultModel: 'deepseek-v4-flash',
        models: {
          source: 'mixed',
          default: 'deepseek-v4-flash',
          include: [],
        },
        ...(options.capabilityOverrides
          ? { capabilityOverrides: options.capabilityOverrides }
          : {}),
      },
    },
  };
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
        reject(new Error('Timed out waiting for core content input event'));
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
