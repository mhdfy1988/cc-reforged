import assert from 'node:assert/strict';

const envKeys = [
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_ATTRIBUTION_HEADER',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_VERTEX',
  'CCR_LLM_CONFIG_PATH',
  'CCR_LLM_PROVIDER',
  'USER_TYPE',
];

const originalEnv = new Map(envKeys.map(key => [key, process.env[key]]));

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setEnv(values) {
  for (const key of envKeys) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

const {
  getAttributionHeader,
  getCLISyspromptPrefix,
  shouldUseClaudeCodeSystemIdentity,
} = await import('../dist/src/constants/system.js');
const { computeSimpleEnvInfo } = await import(
  '../dist/src/constants/prompts.js'
);

try {
  setEnv({});
  assert.equal(shouldUseClaudeCodeSystemIdentity(), false);
  assert.match(getCLISyspromptPrefix(), /^You are CCR,/);
  assert.equal(getAttributionHeader('abc'), '');

  setEnv({
    CCR_LLM_PROVIDER: 'anthropic',
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com/v1',
  });
  assert.equal(shouldUseClaudeCodeSystemIdentity(), true);
  assert.match(getAttributionHeader('abc'), /cc_version=[^;]+\.abc/);
  assert.match(await computeSimpleEnvInfo('claude-sonnet-4-6'), /Claude Code/);

  setEnv({ CCR_LLM_PROVIDER: 'codex-oauth' });
  assert.equal(shouldUseClaudeCodeSystemIdentity(), false);
  assert.equal(getAttributionHeader('abc'), '');
  assert.match(getCLISyspromptPrefix(), /^You are CCR,/);

  setEnv({
    CCR_LLM_PROVIDER: 'anthropic',
    ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
  });
  assert.equal(shouldUseClaudeCodeSystemIdentity(), false);
  assert.equal(getAttributionHeader('abc'), '');
  assert.match(getCLISyspromptPrefix(), /^You are CCR,/);
  assert.doesNotMatch(getCLISyspromptPrefix(), /Claude Code/);
  const compatEnvInfo = await computeSimpleEnvInfo('gpt-5.4');
  assert.match(compatEnvInfo, /CCR is running as the coding agent/);
  assert.doesNotMatch(compatEnvInfo, /Claude Code/);
  assert.doesNotMatch(compatEnvInfo, /Claude model family/);
  assert.doesNotMatch(
    getCLISyspromptPrefix({
      isNonInteractive: true,
      hasAppendSystemPrompt: true,
    }),
    /Claude Code/,
  );

  setEnv({
    ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
    CCR_LLM_PROVIDER: 'codex-oauth',
    CLAUDE_CODE_USE_BEDROCK: '1',
  });
  assert.equal(shouldUseClaudeCodeSystemIdentity(), true);
  assert.match(getAttributionHeader('abc'), /cc_version=[^;]+\.abc/);

  setEnv({
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    CCR_LLM_PROVIDER: 'anthropic',
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
  });
  assert.equal(shouldUseClaudeCodeSystemIdentity(), true);
  assert.equal(getAttributionHeader('abc'), '');
} finally {
  restoreEnv();
}

console.log('[smoke-system-identity] ok');
