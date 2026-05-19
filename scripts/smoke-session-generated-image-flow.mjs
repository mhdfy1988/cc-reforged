import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'ccr-session-generated-image-'));
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
  delete process.env.CCR_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  writeFileSync(configPath, JSON.stringify(createOpenAiConfig(), null, 2), 'utf8');

  const { enableConfigs } = await import('../dist/src/utils/config.js');
  enableConfigs();

  const { CoreSessionService } = await import('../dist/src/core/sessionCore.js');
  const { normalizeTurnStartInputForCurrentModel } = await import(
    '../dist/src/app-server/turnInput.js'
  );
  const { resetDefaultLlmRuntime } = await import(
    '../dist/src/services/llm/defaultRuntime.js'
  );
  const {
    persistGeneratedArtifactFromBase64,
    sanitizeGeneratedArtifactsForResume,
  } = await import('../dist/src/utils/generatedArtifacts.js');
  const { createDisplayEventFromCompletedItem } =
    await loadDesktopDisplayEventHelpers();

  resetDefaultLlmRuntime();

  const prompt = '画一张桌面端会话流图片';
  const normalized = normalizeTurnStartInputForCurrentModel({
    params: {
      threadId: 'thread_unused_for_normalization',
      input: {
        type: 'text',
        text: `/image ${prompt}`,
      },
      options: {
        imageGeneration: {
          enabled: true,
          prompt,
          model: 'gpt-image-1',
          size: '1024x1024',
          quality: 'standard',
          outputFormat: 'png',
          metadata: {
            smoke: true,
          },
        },
      },
    },
    model: {
      getAvailability() {
        return {};
      },
    },
  });

  assert.equal(normalized.input.type, 'text');
  assert.equal(normalized.metadata?.imageGeneration?.enabled, true);
  assert.equal(normalized.metadata?.imageGeneration?.prompt, prompt);
  assert.equal(normalized.metadata?.imageGeneration?.model, 'gpt-image-1');

  const generatedArtifact = await persistGeneratedArtifactFromBase64({
    ccrHome: join(tempRoot, '.ccr'),
    sessionId: 'session-generated-image-smoke',
    outputId: 'out_session_generated_image',
    mimeType: 'image/png',
    artifactType: 'image',
    base64Data: Buffer.from('smoke-image').toString('base64'),
    provider: 'openai',
    model: 'gpt-image-1',
    prompt,
    revisedPrompt: 'A polished image produced by a session smoke fixture.',
    lifecycle: 'temporary',
    safety: 'needs_review',
  });

  const sink = createEventSink();
  const observedImageTurns = [];
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
    async runQueryTurn() {
      throw new Error('session generated image smoke should not use query turn');
    },
    async runImageGenerationTurn(input) {
      observedImageTurns.push(input.turn.metadata.imageGeneration);
      const imageOptions = input.turn.metadata.imageGeneration ?? {};
      const userContent = [{ type: 'text', text: input.turn.input.text }];
      await input.recordMessage(createUserMessage(userContent));
      emitCompletedItem(input.emit, {
        itemId: 'item_smoke_user_prompt',
        threadId: input.turn.threadId,
        turnId: input.turn.turnId,
        kind: 'user_message',
        content: userContent,
      });

      const imageBlock = {
        type: 'image',
        origin: 'model_output',
        lifecycle: 'temporary',
        safety: 'needs_review',
        attachmentId: 'generated-image-smoke',
        displayName: 'session-generated-image.png',
        mimeType: 'image/png',
        sizeBytes: 11,
        provider: 'openai',
        model: String(imageOptions.model ?? 'gpt-image-1'),
        outputId: 'out_session_generated_image',
        savedPath: generatedArtifact.savedPath,
        prompt: String(imageOptions.prompt ?? prompt),
        revisedPrompt: generatedArtifact.revisedPrompt,
        generatedArtifact,
        source: {
          kind: 'file',
          path: generatedArtifact.savedPath,
        },
      };
      const assistantContent = [
        {
          type: 'text',
          text: '模型生成图片已保存。',
        },
        imageBlock,
      ];

      await input.recordMessage(
        createAssistantMessage(assistantContent, String(imageOptions.model ?? 'gpt-image-1')),
      );
      emitCompletedItem(input.emit, {
        itemId: 'item_smoke_generated_image',
        threadId: input.turn.threadId,
        turnId: input.turn.turnId,
        kind: 'assistant_message',
        content: assistantContent,
      });

      return {
        provider: 'openai',
        model: String(imageOptions.model ?? 'gpt-image-1'),
        requestedModel: String(imageOptions.model ?? 'gpt-image-1'),
        stopReason: 'generated_image',
        generatedImage: {
          outputCount: 1,
          artifactCount: 1,
          outputIds: ['out_session_generated_image'],
          savedPaths: [generatedArtifact.savedPath],
        },
      };
    },
  });

  const thread = service.startThread({ title: 'session generated image smoke' });
  const turn = service.startTurn({
    threadId: thread.threadId,
    input: normalized.input,
    metadata: normalized.metadata,
  });
  assert.equal(turn.metadata.imageGeneration.prompt, prompt);

  const completedTurn = await sink.waitForEvent(
    event => event.type === 'turn_completed' && event.turnId === turn.turnId,
  );
  assert.equal(observedImageTurns.length, 1);
  assert.equal(completedTurn.metadata.stopReason, 'generated_image');
  assert.equal(completedTurn.metadata.generatedImage.outputCount, 1);
  assert.equal(completedTurn.metadata.generatedImage.savedPaths[0], generatedArtifact.savedPath);

  const assistantItem = sink.events.find(
    event =>
      event.type === 'item_completed' &&
      event.itemId === 'item_smoke_generated_image',
  );
  assert.ok(assistantItem, 'assistant generated image item should be emitted');
  assert.equal(assistantItem.content[1].type, 'image');
  assert.equal(assistantItem.content[1].savedPath, generatedArtifact.savedPath);

  const displayEvent = createDisplayEventFromCompletedItem(
    assistantItem.itemId,
    'assistant_message',
    assistantItem.content,
    assistantItem.status,
    {
      itemId: assistantItem.itemId,
      threadId: assistantItem.threadId,
      turnId: assistantItem.turnId,
    },
  );
  assert.equal(displayEvent?.type, 'assistant_message');
  assert.match(displayEvent?.text ?? '', /模型生成图片/);
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.source, 'ModelOutput');
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.status, 'generated');
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.previewKind, 'image');
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.provider, 'openai');
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.model, 'gpt-image-1');
  assert.equal(displayEvent?.attachmentSnapshots?.[0]?.savedPath, generatedArtifact.savedPath);

  const messages = service.listThreadMessages(thread.threadId);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].type, 'user');
  assert.equal(messages[1].type, 'assistant');
  assert.equal(messages[1].message.content[1].type, 'image');
  assert.equal(messages[1].message.content[1].savedPath, generatedArtifact.savedPath);

  const resumePayload = sanitizeGeneratedArtifactsForResume({
    messages,
    image: {
      ...messages[1].message.content[1],
      previewDataUrl: 'data:image/png;base64,AAAA',
      data: 'data:image/png;base64,BBBB',
    },
    call: {
      type: 'image_generation_call',
      id: 'ig_session_generated_image',
      result: 'data:image/png;base64,CCCC',
    },
  });
  const resumePayloadJson = JSON.stringify(resumePayload);
  assert.equal(resumePayloadJson.includes('base64,'), false);
  assert.equal(resumePayload.image.savedPath, generatedArtifact.savedPath);
  assert.equal(resumePayload.image.data, undefined);
  assert.equal(resumePayload.image.previewDataUrl, undefined);
  assert.equal(resumePayload.call.result, '');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'turn_start_image_generation_metadata',
          'core_session_routes_image_generation_turn',
          'assistant_generated_image_item_emitted',
          'desktop_model_output_attachment_snapshot',
          'resume_generated_image_payload_sanitized',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  delete process.env.CCR_CONFIG_DIR;
  delete process.env.CCR_LLM_CONFIG_PATH;
  delete process.env.CCR_LLM_CREDENTIALS_PATH;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;
  delete process.env.CCR_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  rmSync(tempRoot, { recursive: true, force: true });
}

function emitCompletedItem(emit, item) {
  emit({
    type: 'item_started',
    item: {
      ...item,
      status: 'completed',
    },
  });
  emit({
    type: 'item_completed',
    threadId: item.threadId,
    turnId: item.turnId,
    itemId: item.itemId,
    status: 'completed',
    content: item.content,
  });
}

function createUserMessage(content) {
  return {
    type: 'user',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    message: {
      role: 'user',
      content,
    },
  };
}

function createAssistantMessage(content, model) {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    message: {
      id: randomUUID(),
      container: null,
      model,
      role: 'assistant',
      stop_reason: 'stop_sequence',
      stop_sequence: '',
      type: 'message',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: { web_search_requests: 0 },
        service_tier: null,
        cache_creation: {
          ephemeral_1h_input_tokens: 0,
          ephemeral_5m_input_tokens: 0,
        },
      },
      content,
      context_management: null,
    },
  };
}

function createOpenAiConfig() {
  return {
    schemaVersion: 2,
    current: {
      profileId: 'openai-session-image-smoke',
      model: 'gpt-5.5',
    },
    profiles: {
      'openai-session-image-smoke': {
        name: 'OpenAI Session Image Smoke',
        providerType: 'openai',
        apiMode: 'openai-chat',
        auth: {
          strategy: 'api_key',
        },
        defaultModel: 'gpt-5.5',
        models: {
          source: 'mixed',
          default: 'gpt-5.5',
          include: ['gpt-image-1'],
        },
      },
    },
  };
}

async function loadDesktopDisplayEventHelpers() {
  const bundleDir = join(repoRoot, '.tmp', 'smoke-session-generated-image-flow');
  const entryPath = join(bundleDir, 'entry.mjs');
  const outputPath = join(bundleDir, 'bundle.mjs');
  rmSync(bundleDir, { recursive: true, force: true });
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(
    entryPath,
    `
      import { createDisplayEventFromCompletedItem } from '../../apps/desktop/src/renderer/src/domain/displayEvents.ts';

      export { createDisplayEventFromCompletedItem };
    `,
    'utf8',
  );

  try {
    await build({
      entryPoints: [entryPath],
      outfile: outputPath,
      bundle: true,
      platform: 'node',
      format: 'esm',
      jsx: 'automatic',
      logLevel: 'silent',
    });
    return await import(pathToFileURL(outputPath).href);
  } finally {
    rmSync(bundleDir, { recursive: true, force: true });
  }
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
        reject(new Error('Timed out waiting for session generated image event'));
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
    events,
    emit,
    waitForEvent,
  };
}
