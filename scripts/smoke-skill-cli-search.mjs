import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const cliPath = join(repoRoot, 'cli.js')
const workDir = mkdtempSync(join(tmpdir(), 'ccr-skill-cli-search-work-'))
const configDir = mkdtempSync(join(tmpdir(), 'ccr-skill-cli-search-config-'))

function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: workDir,
    env: {
      ...process.env,
      CCR_CONFIG_DIR: configDir,
      DISABLE_TELEMETRY: '1',
      DISABLE_ERROR_REPORTING: '1',
      NO_COLOR: '1',
    },
    encoding: 'utf8',
    windowsHide: true,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  assert.equal(
    result.status,
    0,
    `Command failed: ccr ${args.join(' ')}\n${output}`,
  )
  return result.stdout
}

try {
  const search = JSON.parse(runCli(['skill', 'search', 'skill-package', '--json']))
  assert.equal(
    search.candidates.some(
      candidate => candidate.manifestInput.name === 'skill-package-helper',
    ),
    true,
  )

  const humanSearch = runCli(['skill', 'search', 'skill-package'])
  assert.match(humanSearch, /Skill 包助手/)
  assert.match(humanSearch, /name=skill-package-helper/)

  const emptyStatus = JSON.parse(runCli(['skill', 'status', '--json']))
  assert.equal(emptyStatus.schemaVersion, 1)
  assert.equal(emptyStatus.installed.length, 0)

  console.log('smoke-skill-cli-search: ok')
} finally {
  rmSync(workDir, { recursive: true, force: true })
  rmSync(configDir, { recursive: true, force: true })
}
