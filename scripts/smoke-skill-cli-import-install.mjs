import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const cliPath = join(repoRoot, 'cli.js')
const workDir = mkdtempSync(join(tmpdir(), 'ccr-skill-cli-import-work-'))
const configDir = mkdtempSync(join(tmpdir(), 'ccr-skill-cli-import-config-'))
const sourceSkillDir = join(workDir, 'cli-import-skill')
const manifestPath = join(workDir, 'cli-builtin-manifest.json')

mkdirSync(sourceSkillDir, { recursive: true })
writeFileSync(
  join(sourceSkillDir, 'SKILL.md'),
  `---
name: cli-import-skill
description: CLI import install smoke skill.
---

Use this skill for CLI import/install smoke tests.
`,
  'utf8',
)
writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      schemaVersion: 1,
      name: 'cli-manifest-skill',
      displayName: 'CLI Manifest Skill',
      description: 'CLI manifest install smoke skill.',
      source: {
        kind: 'builtin-preset',
        presetId: 'skill-package-helper',
      },
      targetScope: 'user',
      defaults: {
        enabled: true,
        modelInvocable: true,
        userInvocable: true,
      },
      trust: {
        thirdParty: false,
        executableContent: false,
        networkDeclared: false,
        secretsDeclared: [],
      },
      compatibility: {
        vendor: 'ccr',
      },
    },
    null,
    2,
  ),
  'utf8',
)

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
  const importDryRun = JSON.parse(
    runCli([
      'skill',
      'import',
      '--kind',
      'local-skill-dir',
      '--path',
      sourceSkillDir,
      '--json',
    ]),
  )
  assert.equal(importDryRun.dryRun, true)
  assert.equal(importDryRun.plan.importable, true)
  assert.equal(importDryRun.plan.name, 'cli-import-skill')

  const importApply = JSON.parse(
    runCli([
      'skill',
      'import',
      '--kind',
      'local-skill-dir',
      '--path',
      sourceSkillDir,
      '--yes',
      '--json',
    ]),
  )
  assert.equal(importApply.result.name, 'cli-import-skill')

  const importedSearch = JSON.parse(
    runCli(['skill', 'search', 'cli-import-skill', '--json']),
  )
  assert.equal(
    importedSearch.candidates.some(
      candidate => candidate.manifestInput.name === 'cli-import-skill',
    ),
    true,
  )

  const installDryRun = JSON.parse(
    runCli(['skill', 'install', 'cli-import-skill', '--json']),
  )
  assert.equal(installDryRun.dryRun, true)
  assert.equal(installDryRun.plan.installable, true)

  const installApply = JSON.parse(
    runCli(['skill', 'install', 'cli-import-skill', '--yes', '--json']),
  )
  assert.equal(installApply.result.name, 'cli-import-skill')
  assert.equal(installApply.inspection.status, 'installed')

  const manifestInstallDryRun = JSON.parse(
    runCli(['skill', 'install', '--manifest', manifestPath, '--json']),
  )
  assert.equal(manifestInstallDryRun.dryRun, true)
  assert.equal(manifestInstallDryRun.plan.name, 'cli-manifest-skill')

  const manifestInstallApply = JSON.parse(
    runCli(['skill', 'install', '--manifest', manifestPath, '--yes', '--json']),
  )
  assert.equal(manifestInstallApply.result.name, 'cli-manifest-skill')
  assert.equal(manifestInstallApply.inspection.status, 'installed')

  const status = JSON.parse(runCli(['skill', 'status', '--json']))
  assert.equal(
    status.installed.some(item => item.name === 'cli-import-skill'),
    true,
  )
  assert.equal(
    status.installed.some(item => item.name === 'cli-manifest-skill'),
    true,
  )

  console.log('smoke-skill-cli-import-install: ok')
} finally {
  rmSync(workDir, { recursive: true, force: true })
  rmSync(configDir, { recursive: true, force: true })
}
