import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-model-capabilities-'));
const configPath = join(tempDir, 'llm.config.local.json');

try {
  process.env.CCR_LLM_CONFIG_PATH = configPath;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        current: {
          profileId: 'gateway-text',
          model: 'gpt-4o',
        },
        profiles: {
          'gateway-text': {
            name: 'OpenAI Compatible 文本转发',
            providerType: 'openai-compatible',
            apiMode: 'openai-chat',
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'gpt-4o',
            models: ['gpt-4o'],
            capabilityOverrides: {
              default: {
                inputModalities: ['text'],
                outputModalities: ['text'],
                tools: false,
                structuredOutput: false,
                reason: 'gateway disables multimodal input',
              },
            },
          },
          'gateway-vision': {
            name: 'OpenAI Compatible 图片转发',
            providerType: 'openai-compatible',
            apiMode: 'openai-chat',
            auth: {
              strategy: 'api_key',
            },
            defaultModel: 'gpt-4o',
            models: ['gpt-4o'],
            capabilityOverrides: {
              models: {
                'gpt-4o': {
                  inputModalities: ['text', 'image'],
                  outputModalities: ['text'],
                  tools: true,
                  structuredOutput: true,
                  image: {
                    maxImages: 10,
                    maxImageBytes: 10485760,
                    mimeTypes: ['image/png', 'image/jpeg'],
                  },
                  reason: 'gateway enables image input for this profile',
                },
              },
            },
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const { loadLlmConfig } = await import(
    '../dist/src/services/llm/llmConfig.js'
  );
  const { getLlmModelCatalogEntry } = await import(
    '../dist/src/services/llm/modelCatalog.js'
  );
  const { resolveLlmModelCapabilities } = await import(
    '../dist/src/services/llm/modelCapabilities.js'
  );
  const { getBuiltinLlmProviderDefinition } = await import(
    '../dist/src/services/llm/providerDefinitions.js'
  );
  const { getLlmRuntimeDisplayStatusForProvider } = await import(
    '../dist/src/services/llm/runtimeStatus.js'
  );

  const deepSeekDefinition = getBuiltinLlmProviderDefinition('deepseek');
  const deepSeekCatalog = getLlmModelCatalogEntry({
    providerId: 'deepseek',
    model: 'deepseek-v4-flash',
    providerDefinition: deepSeekDefinition,
  });
  const officialText = resolveLlmModelCapabilities({
    providerId: 'deepseek',
    apiMode: 'openai-chat',
    model: 'deepseek-v4-flash',
    providerCapabilities: deepSeekDefinition.capabilities,
    catalogEntry: deepSeekCatalog,
  });
  assert.equal(officialText.source, 'builtin');
  assert.deepEqual(officialText.inputModalities, ['text']);
  assert.deepEqual(officialText.outputModalities, ['text']);
  assert.equal(officialText.tools, true);

  const anthropicDefinition = getBuiltinLlmProviderDefinition('anthropic');
  const anthropicCatalog = getLlmModelCatalogEntry({
    providerId: 'anthropic',
    model: 'claude-sonnet-4-5',
    providerDefinition: anthropicDefinition,
  });
  const officialVision = resolveLlmModelCapabilities({
    providerId: 'anthropic',
    apiMode: 'anthropic-messages',
    model: 'claude-sonnet-4-5',
    providerCapabilities: anthropicDefinition.capabilities,
    catalogEntry: anthropicCatalog,
  });
  assert.equal(officialVision.source, 'builtin');
  assert.equal(officialVision.inputModalities.includes('image'), true);
  assert.equal(officialVision.outputModalities.includes('text'), true);
  assert.equal(officialVision.image?.mimeTypes?.includes('image/png'), true);

  const codexOAuthDefinition = getBuiltinLlmProviderDefinition('codex-oauth');
  const codexOAuthCatalog = getLlmModelCatalogEntry({
    providerId: 'codex-oauth',
    model: 'gpt-5.5',
    providerDefinition: codexOAuthDefinition,
  });
  const codexOAuthVision = resolveLlmModelCapabilities({
    providerId: 'codex-oauth',
    apiMode: 'custom',
    model: 'gpt-5.5',
    providerCapabilities: codexOAuthDefinition.capabilities,
    catalogEntry: codexOAuthCatalog,
  });
  assert.equal(codexOAuthVision.source, 'builtin');
  assert.equal(codexOAuthVision.inputModalities.includes('image'), true);
  assert.equal(codexOAuthVision.image?.mimeTypes?.includes('image/png'), true);
  assert.equal(codexOAuthVision.tools, true);

  const codexOAuthTextCatalog = getLlmModelCatalogEntry({
    providerId: 'codex-oauth',
    model: 'gpt-5.4',
    providerDefinition: codexOAuthDefinition,
  });
  const codexOAuthText = resolveLlmModelCapabilities({
    providerId: 'codex-oauth',
    apiMode: 'custom',
    model: 'gpt-5.4',
    providerCapabilities: codexOAuthDefinition.capabilities,
    catalogEntry: codexOAuthTextCatalog,
  });
  assert.deepEqual(codexOAuthText.inputModalities, ['text']);
  assert.equal(codexOAuthText.image, undefined);

  const minimaxDefinition = getBuiltinLlmProviderDefinition('minimax');
  const minimaxImageCatalog = getLlmModelCatalogEntry({
    providerId: 'minimax',
    model: 'image-01',
    providerDefinition: minimaxDefinition,
  });
  const minimaxImage = resolveLlmModelCapabilities({
    providerId: 'minimax',
    apiMode: 'custom',
    model: 'image-01',
    providerCapabilities: minimaxDefinition.capabilities,
    catalogEntry: minimaxImageCatalog,
  });
  assert.equal(minimaxImage.source, 'builtin');
  assert.deepEqual(minimaxImage.inputModalities, ['text']);
  assert.deepEqual(minimaxImage.outputModalities, ['image']);
  assert.equal(minimaxImage.tools, false);
  assert.equal(minimaxImage.image?.mimeTypes?.includes('image/png'), true);

  const kimiCodeDefinition = getBuiltinLlmProviderDefinition('kimi-code');
  const kimiApiDefinition = getBuiltinLlmProviderDefinition('kimi-api');
  const kimiApiCatalog = getLlmModelCatalogEntry({
    providerId: 'kimi-api',
    model: 'kimi-k2.6',
    providerDefinition: kimiApiDefinition,
  });
  const kimiApiCapabilities = resolveLlmModelCapabilities({
    providerId: 'kimi-api',
    apiMode: 'openai-chat',
    model: 'kimi-k2.6',
    providerCapabilities: kimiApiDefinition.capabilities,
    catalogEntry: kimiApiCatalog,
  });
  assert.equal(kimiApiCapabilities.source, 'builtin');
  assert.equal(kimiApiCapabilities.inputModalities.includes('image'), true);
  assert.equal(kimiApiCapabilities.inputModalities.includes('video'), true);
  assert.equal(kimiApiCapabilities.tools, true);

  const kimiCodeCatalog = getLlmModelCatalogEntry({
    providerId: 'kimi-code',
    model: 'kimi-for-coding',
    providerDefinition: kimiCodeDefinition,
  });
  assert.equal(kimiCodeCatalog.metadata.modelIdentifierKind, 'unified');
  assert.equal(kimiCodeCatalog.metadata.protocol, 'anthropic-messages');
  const kimiCodeCapabilities = resolveLlmModelCapabilities({
    providerId: 'kimi-code',
    apiMode: 'anthropic-messages',
    model: 'kimi-for-coding',
    providerCapabilities: kimiCodeDefinition.capabilities,
    catalogEntry: kimiCodeCatalog,
  });
  assert.equal(kimiCodeCapabilities.source, 'builtin');
  assert.deepEqual(kimiCodeCapabilities.inputModalities, ['text']);
  assert.equal(kimiCodeCapabilities.tools, true);

  const glmCodingDefinition = getBuiltinLlmProviderDefinition('glm-coding');
  const glmApiDefinition = getBuiltinLlmProviderDefinition('glm-api');
  const glmApiTextCatalog = getLlmModelCatalogEntry({
    providerId: 'glm-api',
    model: 'glm-5.1',
    providerDefinition: glmApiDefinition,
  });
  const glmApiTextCapabilities = resolveLlmModelCapabilities({
    providerId: 'glm-api',
    apiMode: 'openai-chat',
    model: 'glm-5.1',
    providerCapabilities: glmApiDefinition.capabilities,
    catalogEntry: glmApiTextCatalog,
  });
  assert.equal(glmApiTextCatalog.model, 'glm-5.1');
  assert.equal(glmApiTextCatalog.metadata.protocol, 'openai-chat');
  assert.equal(
    glmApiTextCatalog.metadata.baseUrl,
    'https://open.bigmodel.cn/api/paas/v4',
  );
  assert.deepEqual(glmApiTextCapabilities.inputModalities, ['text']);

  const glmImageCatalog = getLlmModelCatalogEntry({
    providerId: 'glm-api',
    model: 'glm-image',
    providerDefinition: glmApiDefinition,
  });
  const glmImageCapabilities = resolveLlmModelCapabilities({
    providerId: 'glm-api',
    apiMode: 'openai-chat',
    model: 'glm-image',
    providerCapabilities: glmApiDefinition.capabilities,
    catalogEntry: glmImageCatalog,
  });
  assert.equal(glmImageCatalog.model, 'glm-image');
  assert.equal(glmImageCatalog.metadata.protocol, 'openai-images');
  assert.equal(glmImageCatalog.metadata.endpoint, '/images/generations');
  assert.deepEqual(glmImageCapabilities.inputModalities, ['text']);
  assert.deepEqual(glmImageCapabilities.outputModalities, ['image']);
  assert.equal(glmImageCapabilities.tools, false);

  const glmVisionCatalog = getLlmModelCatalogEntry({
    providerId: 'glm-api',
    model: 'glm-5v-turbo',
    providerDefinition: glmApiDefinition,
  });
  const glmVisionCapabilities = resolveLlmModelCapabilities({
    providerId: 'glm-api',
    apiMode: 'openai-chat',
    model: 'glm-5v-turbo',
    providerCapabilities: glmApiDefinition.capabilities,
    catalogEntry: glmVisionCatalog,
  });
  assert.equal(glmVisionCapabilities.source, 'builtin');
  assert.equal(glmVisionCapabilities.inputModalities.includes('image'), true);
  assert.equal(glmVisionCapabilities.inputModalities.includes('video'), true);
  assert.equal(glmVisionCatalog.metadata.officialFileInput, true);
  assert.equal(glmVisionCatalog.metadata.ccrFileInput, 'pending-provider-file-upload-or-url-only-policy');

  const glmCodingCatalog = getLlmModelCatalogEntry({
    providerId: 'glm-coding',
    model: 'glm-5.1',
    providerDefinition: glmCodingDefinition,
  });
  assert.equal(glmCodingCatalog.metadata.protocol, 'openai-chat');
  assert.equal(
    glmCodingCatalog.metadata.baseUrl,
    'https://open.bigmodel.cn/api/coding/paas/v4',
  );

  const config = loadLlmConfig();
  const textProfile = config.profiles['gateway-text'];
  const visionProfile = config.profiles['gateway-vision'];
  const compatibleCatalog = {
    provider: 'openai-compatible',
    model: 'gpt-4o',
    displayName: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16000,
    supportsReasoning: false,
    supportsTools: true,
    inputModalities: ['text', 'image'],
  };
  const compatibleProviderCapabilities = {
    streaming: true,
    tools: true,
    reasoning: false,
    usage: false,
  };

  const textProfileCapabilities = resolveLlmModelCapabilities({
    providerId: 'openai-compatible',
    apiMode: textProfile.apiMode,
    model: 'gpt-4o',
    providerCapabilities: compatibleProviderCapabilities,
    catalogEntry: compatibleCatalog,
    profile: textProfile,
  });
  assert.equal(textProfileCapabilities.source, 'profile_override');
  assert.deepEqual(textProfileCapabilities.inputModalities, ['text']);
  assert.equal(textProfileCapabilities.tools, false);

  const visionProfileCapabilities = resolveLlmModelCapabilities({
    providerId: 'openai-compatible',
    apiMode: visionProfile.apiMode,
    model: 'gpt-4o',
    providerCapabilities: compatibleProviderCapabilities,
    catalogEntry: compatibleCatalog,
    profile: visionProfile,
  });
  assert.equal(visionProfileCapabilities.source, 'profile_override');
  assert.equal(visionProfileCapabilities.inputModalities.includes('image'), true);
  assert.equal(visionProfileCapabilities.tools, true);
  assert.equal(visionProfileCapabilities.structuredOutput, true);
  assert.equal(visionProfileCapabilities.image?.maxImages, 10);

  const textStatus = getLlmRuntimeDisplayStatusForProvider(
    {
      profileId: 'gateway-text',
      provider: 'openai-compatible',
      model: 'gpt-4o',
    },
    config,
  );
  assert.equal(textStatus.modelCapabilities.source, 'profile_override');
  assert.deepEqual(textStatus.modelCapabilities.inputModalities, ['text']);

  const unknown = resolveLlmModelCapabilities({
    providerId: 'unknown-provider',
    apiMode: 'custom',
    model: 'unknown-model',
  });
  assert.equal(unknown.source, 'default');
  assert.deepEqual(unknown.inputModalities, ['text']);
  assert.deepEqual(unknown.outputModalities, ['text']);
  assert.equal(unknown.tools, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        officialText,
        officialVision,
        codexOAuthVision,
        codexOAuthText,
        minimaxImage,
        kimiApiCapabilities,
        kimiCodeCapabilities,
        glmApiTextCapabilities,
        glmImageCapabilities,
        glmVisionCapabilities,
        glmCodingCatalog,
        textProfileCapabilities,
        visionProfileCapabilities,
        unknown,
      },
      null,
      2,
    ),
  );
} finally {
  delete process.env.CCR_LLM_CONFIG_PATH;
  delete process.env.CCR_LLM_PROVIDER;
  delete process.env.CCR_LLM_MODEL;
  rmSync(tempDir, { recursive: true, force: true });
}
