import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const cliPath = join(repoRoot, 'cli.js')
const workDir = mkdtempSync(join(tmpdir(), 'ccr-mcp-cli-work-'))
const configDir = mkdtempSync(join(tmpdir(), 'ccr-mcp-cli-config-'))

function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: workDir,
    env: {
      ...process.env,
      CCR_CONFIG_DIR: configDir,
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
  return output
}

try {
  const searchOutput = runCli(['mcp', 'search', 'context7'])
  assert.match(searchOutput, /Context7 MCP/)
  assert.match(searchOutput, /name=context7/)

  const sentrySearchOutput = runCli(['mcp', 'search', 'sentry'])
  assert.match(sentrySearchOutput, /Sentry MCP/)
  assert.match(sentrySearchOutput, /name=sentry/)
  assert.match(sentrySearchOutput, /kind=remote-url/)

  const dryRunOutput = runCli(['mcp', 'install', 'context7', '--scope', 'user'])
  assert.match(dryRunOutput, /Install plan for context7/)
  assert.match(dryRunOutput, /No changes were written/)

  const installOutput = runCli([
    'mcp',
    'install',
    'context7',
    '--scope',
    'user',
    '--yes',
  ])
  assert.match(installOutput, /"installed": true/)
  assert.match(installOutput, /"name": "context7"/)

  const statusOutput = runCli(['mcp', 'status'])
  assert.match(statusOutput, /"name": "context7"/)
  assert.match(statusOutput, /"installPaths"/)

  const repairOutput = runCli(['mcp', 'repair', 'context7', '--scope', 'user'])
  assert.match(repairOutput, /Repair plan for context7/)
  assert.match(repairOutput, /No changes were written/)

  const uninstallDryRunOutput = runCli(['mcp', 'uninstall', 'context7'])
  assert.match(uninstallDryRunOutput, /No changes were written/)

  const uninstallOutput = runCli(['mcp', 'uninstall', 'context7', '--yes'])
  assert.match(uninstallOutput, /"uninstalled": true/)

  const sentryDryRunOutput = runCli(['mcp', 'install', 'sentry', '--scope', 'user'])
  assert.match(sentryDryRunOutput, /Install plan for sentry/)
  assert.match(sentryDryRunOutput, /"transport": "http"/)
  assert.match(sentryDryRunOutput, /remote_service_data_boundary/)
  assert.match(sentryDryRunOutput, /No changes were written/)

  const sentryInstallOutput = runCli([
    'mcp',
    'install',
    'sentry',
    '--scope',
    'user',
    '--yes',
  ])
  assert.match(sentryInstallOutput, /"installed": true/)
  assert.match(sentryInstallOutput, /"name": "sentry"/)
  assert.match(sentryInstallOutput, /"url": "https:\/\/mcp\.sentry\.dev\/mcp"/)

  const sentryStatusOutput = runCli(['mcp', 'status'])
  assert.match(sentryStatusOutput, /"name": "sentry"/)
  assert.match(sentryStatusOutput, /"state": "configured"/)

  const sentryRemoveOutput = runCli([
    'mcp',
    'remove',
    'sentry',
    '--scope',
    'user',
  ])
  assert.match(sentryRemoveOutput, /removed/i)

  const sentryMissingStatusOutput = runCli(['mcp', 'status'])
  assert.match(sentryMissingStatusOutput, /"name": "sentry"/)
  assert.match(sentryMissingStatusOutput, /"state": "missing-config"/)

  const sentryRepairOutput = runCli([
    'mcp',
    'repair',
    'sentry',
    '--scope',
    'user',
    '--yes',
  ])
  assert.match(sentryRepairOutput, /"installed": true/)

  const sentryRepairedStatusOutput = runCli(['mcp', 'status'])
  assert.match(sentryRepairedStatusOutput, /"name": "sentry"/)
  assert.match(sentryRepairedStatusOutput, /"state": "configured"/)

  const sentryUninstallOutput = runCli(['mcp', 'uninstall', 'sentry', '--yes'])
  assert.match(sentryUninstallOutput, /"uninstalled": true/)

  const finalStatusOutput = runCli(['mcp', 'status'])
  assert.doesNotMatch(finalStatusOutput, /"name": "context7"/)
  assert.doesNotMatch(finalStatusOutput, /"name": "sentry"/)

  console.log('smoke-mcp-cli-install: ok')
} finally {
  rmSync(workDir, { recursive: true, force: true })
  rmSync(configDir, { recursive: true, force: true })
}
