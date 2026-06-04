import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const cliPath = join(repoRoot, 'cli.js')
const workDir = mkdtempSync(join(tmpdir(), 'ccr-skill-cli-status-work-'))
const configDir = mkdtempSync(join(tmpdir(), 'ccr-skill-cli-status-config-'))

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
  const install = JSON.parse(
    runCli(['skill', 'install', 'skill-package-helper', '--yes', '--json']),
  )
  assert.equal(install.result.name, 'skill-package-helper')

  const installedInspect = JSON.parse(
    runCli(['skill', 'inspect', 'skill-package-helper', '--json']),
  )
  assert.equal(installedInspect.found, true)
  assert.equal(installedInspect.inspection.status, 'installed')

  const packageDir = installedInspect.inspection.installedRecord.packageDir
  rmSync(packageDir, { recursive: true, force: true })

  const driftStatus = JSON.parse(runCli(['skill', 'status', '--json']))
  const drifted = driftStatus.installed.find(
    item => item.name === 'skill-package-helper',
  )
  assert.equal(drifted.status, 'missing-package')

  const repairDryRun = JSON.parse(
    runCli(['skill', 'repair', 'skill-package-helper', '--json']),
  )
  assert.equal(repairDryRun.dryRun, true)
  assert.equal(repairDryRun.action, 'repair')
  assert.equal(repairDryRun.inspection.inspection.status, 'missing-package')

  const repair = JSON.parse(
    runCli(['skill', 'repair', 'skill-package-helper', '--yes', '--json']),
  )
  assert.equal(repair.repaired, true)
  assert.equal(repair.inspection.status, 'installed')

  const uninstallDryRun = JSON.parse(
    runCli(['skill', 'uninstall', 'skill-package-helper', '--json']),
  )
  assert.equal(uninstallDryRun.dryRun, true)
  assert.equal(uninstallDryRun.action, 'uninstall')

  const uninstall = JSON.parse(
    runCli(['skill', 'uninstall', 'skill-package-helper', '--yes', '--json']),
  )
  assert.equal(uninstall.uninstalled, true)
  assert.equal(uninstall.name, 'skill-package-helper')

  const finalStatus = JSON.parse(runCli(['skill', 'status', '--json']))
  assert.equal(
    finalStatus.installed.some(item => item.name === 'skill-package-helper'),
    false,
  )

  console.log('smoke-skill-cli-status-repair-uninstall: ok')
} finally {
  rmSync(workDir, { recursive: true, force: true })
  rmSync(configDir, { recursive: true, force: true })
}
