#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packagedRoot = join(root, 'release', 'desktop', 'win-unpacked')
const runtimeRoot = join(packagedRoot, 'resources', 'app.asar.unpacked')
const executable =
  process.platform === 'win32'
    ? join(packagedRoot, 'CCR Desktop.exe')
    : join(packagedRoot, 'CCR Desktop')

if (process.platform !== 'win32') {
  console.log(JSON.stringify({ ok: true, skipped: 'desktop packaged smoke is Windows-only for now' }, null, 2))
  process.exit(0)
}

for (const requiredPath of [executable, runtimeRoot]) {
  if (!existsSync(requiredPath)) {
    console.error(`Missing packaged desktop artifact: ${requiredPath}`)
    console.error('Run npm.cmd run desktop:pack first.')
    process.exit(1)
  }
}

const child = spawn(executable, ['cli.js', 'app-server', '--listen', 'stdio'], {
  cwd: runtimeRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
let timedOut = false

const timeout = setTimeout(() => {
  timedOut = true
  child.kill('SIGTERM')
}, 20_000)

child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', chunk => {
  stdout += chunk
})
child.stderr.on('data', chunk => {
  stderr += chunk
})

child.stdin.write(
  `${JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      clientInfo: {
        name: 'desktop-packaged-smoke',
        version: '0.1',
      },
    },
  })}\n`,
)
child.stdin.write(
  `${JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'shutdown',
    params: {},
  })}\n`,
)
child.stdin.end()

child.on('exit', code => {
  clearTimeout(timeout)

  if (timedOut) {
    fail('packaged app-server timed out', { stdout, stderr })
  }

  if (code !== 0) {
    fail(`packaged app-server exited with code ${code ?? 'unknown'}`, { stdout, stderr })
  }

  const responses = stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line))

  const initialize = responses.find(response => response.id === 1)
  const shutdown = responses.find(response => response.id === 2)

  if (!initialize?.result?.serverInfo?.coreVersion) {
    fail('initialize response did not include coreVersion', { responses, stderr })
  }

  if (initialize.result.serverVersion !== '0.1') {
    fail('initialize response did not include expected serverVersion', {
      responses,
      stderr,
    })
  }

  if (initialize.result.schemaVersions?.config !== '0.1') {
    fail('initialize response did not include expected config schema version', {
      responses,
      stderr,
    })
  }

  if (shutdown?.result?.accepted !== true) {
    fail('shutdown response was not accepted', { responses, stderr })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        executable,
        runtimeRoot,
        coreVersion: initialize.result.serverInfo.coreVersion,
        serverVersion: initialize.result.serverVersion,
        configSchemaVersion: initialize.result.schemaVersions.config,
        protocolVersion: initialize.result.protocolVersion,
      },
      null,
      2,
    ),
  )
})

child.on('error', error => {
  clearTimeout(timeout)
  fail(error.message, { stdout, stderr })
})

function fail(message, details) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
