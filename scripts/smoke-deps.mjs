import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(resolve(repoRoot, 'package.json'), 'utf8'),
);
const packageLock = JSON.parse(
  readFileSync(resolve(repoRoot, 'package-lock.json'), 'utf8'),
);
const packageFiles = packageJson.files ?? [];
const hasDistPublishEntry = packageFiles.some(
  file => file === 'dist/' || file.startsWith('dist/'),
);

assert.equal(packageJson.dependencies?.['@anthropic-ai/claude-agent-sdk'], undefined);
assert.equal(packageJson.scripts?.prepare, undefined);
assert.ok(packageJson.scripts?.prepublishOnly);
assert.ok(hasDistPublishEntry, 'package files must include a dist publish entry');
assert.ok(!packageFiles.includes('src/'));
assert.equal(packageJson.dependencies?.zod, '^3.25.76');

const lockPackages = Object.keys(packageLock.packages ?? {});
assert.ok(
  !lockPackages.some(name => name.includes('@anthropic-ai/claude-agent-sdk')),
  'package-lock still contains @anthropic-ai/claude-agent-sdk',
);

const shimPath = resolve(repoRoot, 'src', 'types', 'third-party-sdk-shims.d.ts');
assert.ok(existsSync(shimPath), 'third-party shim file is missing');
const shimText = readFileSync(shimPath, 'utf8');
const declareModuleCount = [...shimText.matchAll(/declare module /g)].length;
assert.ok(declareModuleCount > 0, 'third-party shim file has no declare module blocks');

const auditRuntimeTargets = spawnSync(process.execPath, [
  resolve(repoRoot, 'scripts', 'audit-runtime-targets.mjs'),
], {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: false,
});
if (auditRuntimeTargets.error) {
  throw auditRuntimeTargets.error;
}
assert.equal(auditRuntimeTargets.status, 0, auditRuntimeTargets.stderr);
const runtimeTargets = JSON.parse(auditRuntimeTargets.stdout);
assert.equal(runtimeTargets.summary?.missingLocalCount, 25);
assert.equal(runtimeTargets.summary?.specialExternalCount, 3);

const packCommand =
  process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
const packArgs =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd', 'pack', '--dry-run', '--json']
    : ['pack', '--dry-run', '--json'];
const pack = spawnSync(packCommand, packArgs, {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: false,
});
if (pack.error) {
  throw pack.error;
}
assert.equal(pack.status, 0, pack.stderr);
const packList = JSON.parse(pack.stdout);
const packedFiles = packList[0]?.files?.map(file => file.path) ?? [];
assert.ok(packedFiles.includes('cli.js'));
assert.ok(packedFiles.some(file => file.startsWith('dist/')));
assert.ok(
  !packedFiles.some(file => file.startsWith('src/')),
  'npm pack should not include source tree',
);
assert.ok(
  !packedFiles.some(file => file.startsWith('tmp/')),
  'npm pack should not include tmp smoke artifacts',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      zod: packageJson.dependencies.zod,
      removedDependencies: ['@anthropic-ai/claude-agent-sdk'],
      publishGuard: 'prepublishOnly',
      shim: {
        path: shimPath,
        declareModuleCount,
      },
      runtimeTargets: runtimeTargets.summary,
      pack: {
        fileCount: packedFiles.length,
        includesDist: packedFiles.some(file => file.startsWith('dist/')),
        excludesSrc: !packedFiles.some(file => file.startsWith('src/')),
        excludesTmp: !packedFiles.some(file => file.startsWith('tmp/')),
      },
    },
    null,
    2,
  ),
);
