import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'ccr-settings-isolation-'));

try {
  const { enableConfigs } = await import('../dist/src/utils/config.js');
  enableConfigs();

  const { setCwdState, setOriginalCwd } = await import(
    '../dist/src/bootstrap/state.js'
  );
  const { resetSettingsCache } = await import(
    '../dist/src/utils/settings/settingsCache.js'
  );
  const {
    CCR_PROJECT_SETTINGS_DIR,
    getSettingsFilePathForSource,
    getSettingsForSource,
    getSettingsDisplayPathsForSource,
    getSettingsReadFilePathsForSource,
    getSettingsWriteFilePathForSource,
    updateSettingsForSource,
  } = await import('../dist/src/utils/settings/settings.js');
  const { getCorePermissionSettingsSnapshot } = await import(
    '../dist/src/core/permissionSettingsCore.js'
  );
  const { SYNC_KEYS } = await import(
    '../dist/src/services/settingsSync/types.js'
  );
  const {
    DANGEROUS_DIRECTORIES,
    isAgentSettingsPath,
    isClaudeSettingsPath,
  } = await import('../dist/src/utils/permissions/filesystem.js');
  const { convertToSandboxRuntimeConfig } = await import(
    '../dist/src/utils/sandbox/sandbox-adapter.js'
  );

  setOriginalCwd(tempDir);
  setCwdState(tempDir);
  resetSettingsCache();

  const projectWritePath = getSettingsWriteFilePathForSource('projectSettings');
  const localWritePath = getSettingsFilePathForSource('localSettings');
  const projectReadPaths = getSettingsReadFilePathsForSource('projectSettings');

  assert.equal(
    normalize(projectWritePath),
    normalize(join(tempDir, CCR_PROJECT_SETTINGS_DIR, 'settings.json')),
  );
  assert.equal(
    normalize(localWritePath),
    normalize(join(tempDir, CCR_PROJECT_SETTINGS_DIR, 'settings.local.json')),
  );
  assert.deepEqual(
    projectReadPaths.map(path => normalize(path)),
    [normalize(join(tempDir, CCR_PROJECT_SETTINGS_DIR, 'settings.json'))],
  );
  const projectDisplayPaths =
    getSettingsDisplayPathsForSource('projectSettings');
  assert.equal(normalize(projectDisplayPaths.writePath), normalize(projectWritePath));
  assert.deepEqual(
    projectDisplayPaths.readPaths.map(path => normalize(path)),
    projectReadPaths.map(path => normalize(path)),
  );

  mkdirSync(join(tempDir, CCR_PROJECT_SETTINGS_DIR), { recursive: true });
  writeFileSync(
    join(tempDir, CCR_PROJECT_SETTINGS_DIR, 'settings.json'),
    JSON.stringify({ permissions: { allow: ['Bash(primary:*)'] } }, null, 2),
  );
  resetSettingsCache();

  assert.deepEqual(getSettingsForSource('projectSettings')?.permissions?.allow, [
    'Bash(primary:*)',
  ]);
  assert.equal(getSettingsForSource('localSettings'), null);

  updateSettingsForSource('localSettings', {
    permissions: { ask: ['Bash(local-primary:*)'] },
  });
  const localPrimary = JSON.parse(readFileSync(localWritePath, 'utf8'));
  assert.deepEqual(localPrimary.permissions.ask, ['Bash(local-primary:*)']);

  const snapshot = getCorePermissionSettingsSnapshot();
  const projectSource = snapshot.sources.find(
    source => source.source === 'projectSettings',
  );
  const localSource = snapshot.sources.find(
    source => source.source === 'localSettings',
  );
  assert.ok(projectSource);
  assert.ok(localSource);
  assert.equal(normalize(projectSource.path), normalize(projectWritePath));
  assert.deepEqual(
    projectSource.readPaths.map(path => normalize(path)),
    projectReadPaths.map(path => normalize(path)),
  );
  assert.equal(normalize(localSource.path), normalize(localWritePath));

  assert.equal(SYNC_KEYS.USER_SETTINGS, '~/.ccr/settings.json');
  assert.equal(
    SYNC_KEYS.projectSettings('repo-id'),
    'projects/repo-id/.ccr/settings.local.json',
  );

  assert.equal(DANGEROUS_DIRECTORIES.includes(CCR_PROJECT_SETTINGS_DIR), true);
  assert.equal(
    isAgentSettingsPath(join(tempDir, CCR_PROJECT_SETTINGS_DIR, 'settings.json')),
    true,
  );

  const runtimeConfig = convertToSandboxRuntimeConfig({});
  const denyWrite = runtimeConfig.filesystem.denyWrite.map(path =>
    normalize(path),
  );
  for (const path of [
    join(tempDir, CCR_PROJECT_SETTINGS_DIR, 'settings.json'),
    join(tempDir, CCR_PROJECT_SETTINGS_DIR, 'settings.local.json'),
  ]) {
    assert.equal(denyWrite.includes(normalize(path)), true, path);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        writePath: projectWritePath,
        readPaths: projectReadPaths,
        policy: 'project settings write and read only .ccr paths',
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
