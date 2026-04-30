import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = resolve(repoRoot, 'tmp', 'runtime-smoke');
mkdirSync(tmpDir, { recursive: true });

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    timeout: options.timeout ?? 60_000,
    env: options.env ?? process.env,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

const version = runNode(['cli.js', '--version']);
assert.equal(version.status, 0, version.stderr);
assert.match(version.stdout, /^CCR v0\.2\s*$/);

const help = runNode(['cli.js', '--help']);
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /Usage: ccr/);

const authGateEnv = { ...process.env };
for (const key of [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CCR_LLM_CONFIG_PATH',
  'CCR_LLM_PROVIDER',
  'CCR_LLM_MODEL',
  'CCR_CODEX_OAUTH_ACCESS_TOKEN',
  'CCR_CODEX_OAUTH_REFRESH_TOKEN',
  'CCR_CODEX_OAUTH_EXPIRES_AT',
  'CCR_CODEX_OAUTH_ACCOUNT_ID',
  'CCR_CODEX_OAUTH_CREDENTIAL_FILE',
]) {
  delete authGateEnv[key];
}
const authGateConfigDir = resolve(tmpDir, 'auth-gate-config');
rmSync(authGateConfigDir, { recursive: true, force: true });
mkdirSync(authGateConfigDir, { recursive: true });
authGateEnv.CCR_CONFIG_DIR = authGateConfigDir;
authGateEnv.CCR_LLM_CONFIG_PATH = resolve(
  authGateConfigDir,
  'data',
  'llm.config.local.json',
);
authGateEnv.CCR_LLM_PROVIDER = 'codex-oauth';
authGateEnv.CCR_LLM_MODEL = 'gpt-5.4';
authGateEnv.CCR_CODEX_OAUTH_CREDENTIAL_FILE = resolve(
  authGateConfigDir,
  'data',
  'codex-oauth.json',
);

const unauthenticatedPrompt = runNode(
  [
    'cli.js',
    '-p',
    'Reply exactly: OK',
    '--model',
    'gpt-5.4',
    '--output-format',
    'json',
    '--max-budget-usd',
    '0.01',
    '--no-session-persistence',
  ],
  { env: authGateEnv, timeout: 20_000 },
);
assert.equal(unauthenticatedPrompt.status, 1);
const promptResult = JSON.parse(unauthenticatedPrompt.stdout);
assert.equal(promptResult.is_error, true);
assert.match(promptResult.result, /Codex OAuth|CCR_CODEX_OAUTH/);
assert.equal(promptResult.total_cost_usd, 0);

const { enableConfigs } = await import('../dist/src/utils/config.js');
enableConfigs();

const { getTools } = await import('../dist/src/tools.js');
const { getEmptyToolPermissionContext } = await import('../dist/src/Tool.js');
const { FileReadTool } = await import('../dist/src/tools/FileReadTool/FileReadTool.js');
const { FileWriteTool } = await import('../dist/src/tools/FileWriteTool/FileWriteTool.js');
const { PowerShellTool } = await import('../dist/src/tools/PowerShellTool/PowerShellTool.js');

const permissionContext = getEmptyToolPermissionContext();
const tools = getTools(permissionContext);
const toolNames = tools.map(tool => tool.name).sort();
for (const expectedName of ['Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write']) {
  assert.ok(toolNames.includes(expectedName), `missing tool: ${expectedName}`);
}

const readFileState = new Map();
const appState = { toolPermissionContext: permissionContext };
const toolUseContext = {
  readFileState,
  dynamicSkillDirTriggers: new Set(),
  updateFileHistoryState: () => undefined,
  abortController: new AbortController(),
  setAppState: () => undefined,
  getAppState: () => appState,
  options: { isNonInteractiveSession: true },
};

const smokeFile = resolve(
  tmpDir,
  `tool-roundtrip-${process.pid}-${Date.now()}.txt`,
);
const writeResult = await FileWriteTool.call(
  { file_path: smokeFile, content: 'runtime-smoke-ok\n' },
  toolUseContext,
);
assert.equal(writeResult.data.type, 'create');

const readResult = await FileReadTool.call(
  { file_path: smokeFile, offset: 1, limit: 20 },
  toolUseContext,
);
assert.equal(readResult.data.type, 'text');
assert.match(readResult.data.file.content, /runtime-smoke-ok/);

const readBlock = FileReadTool.mapToolResultToToolResultBlockParam(
  readResult.data,
  'toolu_runtime_read',
);
assert.equal(readBlock.type, 'tool_result');
assert.equal(readBlock.tool_use_id, 'toolu_runtime_read');

const psResult = await PowerShellTool.call(
  { command: 'Write-Output runtime-smoke-powershell', timeout: 10_000 },
  toolUseContext,
);
assert.match(psResult.data.stdout, /runtime-smoke-powershell/);
const psBlock = PowerShellTool.mapToolResultToToolResultBlockParam(
  psResult.data,
  'toolu_runtime_ps',
);
assert.equal(psBlock.type, 'tool_result');

console.log(
  JSON.stringify(
    {
      ok: true,
      cli: {
        version: version.stdout.trim(),
        unauthenticatedHeadlessPath: 'json-auth-gate',
      },
      tools: {
        count: tools.length,
        checked: ['Bash', 'Glob', 'Grep', 'Read', 'Edit', 'Write'],
      },
      roundtrip: {
        file: smokeFile,
        readType: readResult.data.type,
        powershell: psResult.data.stdout.trim(),
      },
    },
    null,
    2,
  ),
);
