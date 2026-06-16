import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  const label = [command, ...args].join(' ');
  console.log(`\n[ci-smoke] ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function runNpm(args) {
  if (process.platform === 'win32') {
    run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd', ...args]);
    return;
  }
  run('npm', args);
}

runNpm(['run', 'prepare:ripgrep']);
runNpm(['run', 'build', '--', '--pretty', 'false']);
runNpm(['run', 'typecheck', '--', '--pretty', 'false']);
runNpm(['run', 'typecheck:desktop']);
runNpm(['run', 'desktop:build']);
runNpm(['run', 'smoke:desktop-auto-update']);
runNpm(['run', 'smoke:desktop-branding']);
runNpm(['run', 'smoke:desktop-display-events']);
runNpm(['run', 'smoke:generated-output-provider']);
runNpm(['run', 'smoke:provider-output-fixtures']);
runNpm(['run', 'smoke:generate-image-tool']);
runNpm(['run', 'smoke:ripgrep-vendor']);
runNpm(['run', 'smoke:file-search']);
runNpm(['run', 'smoke:desktop-github-actions-release']);
runNpm(['run', 'smoke:desktop-release-notes']);
runNpm(['run', 'smoke:desktop-shell-cards']);
runNpm(['run', 'smoke:desktop-signing-readiness']);
run(process.execPath, ['cli.js', '--version']);
run(process.execPath, ['cli.js', '--help']);
runNpm(['run', 'smoke:app-server']);
runNpm(['run', 'smoke:app-server-context']);
runNpm(['run', 'smoke:app-server-client']);
runNpm(['run', 'smoke:system-identity']);
runNpm(['run', 'smoke:runtime']);
runNpm(['run', 'smoke:permissions']);
runNpm(['run', 'smoke:deps']);

console.log('\n[ci-smoke] ok');
