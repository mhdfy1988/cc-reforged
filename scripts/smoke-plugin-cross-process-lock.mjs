import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  createPluginDomainSession,
} from '../dist/src/services/plugins/pluginDomainSession.js'
import {
  acquirePluginScopeLock,
} from '../dist/src/services/plugins/pluginPersistence.js'

if (process.argv[2] === '--holder') {
  await runHolder(process.argv[3], process.argv[4], process.argv[5])
} else {
  await runParent()
}

async function runParent() {
  const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-cross-process-'))
  const home = join(root, 'home')
  const workspace = join(root, 'workspace')
  const releasePath = join(root, 'release')
  await Promise.all([
    mkdir(home, { recursive: true }),
    mkdir(workspace, { recursive: true }),
  ])

  const child = spawn(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-loader',
      pathToFileURL(join(process.cwd(), 'bun-bundle-loader.mjs')).href,
      import.meta.filename,
      '--holder',
      home,
      workspace,
      releasePath,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  try {
    await waitForLine(child, 'LOCKED')
    const session = createPluginDomainSession({
      workspaceRoot: workspace,
      currentCwd: workspace,
      configHomeDir: home,
      runtimeInstanceId: 'parent',
      requestId: 'parent-conflict',
      environment: process.env,
    })
    await assert.rejects(
      acquirePluginScopeLock(session, {
        operationId: 'parent-operation',
        scope: 'project',
        workspaceRoot: workspace,
      }),
      error => error.code === 'plugin-operation-conflict',
    )

    await writeFile(releasePath, 'release\n', 'utf8')
    assert.equal(await waitForExit(child), 0)
    const lock = await acquirePluginScopeLock(session, {
      operationId: 'parent-after-release',
      scope: 'project',
      workspaceRoot: workspace,
    })
    await lock.release()
  } finally {
    if (child.exitCode === null) child.kill()
    await rm(root, { recursive: true, force: true })
  }
  console.log('plugin cross-process lock smoke passed')
}

async function runHolder(home, workspace, releasePath) {
  const session = createPluginDomainSession({
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'holder',
    requestId: 'holder-lock',
    environment: process.env,
  })
  const lock = await acquirePluginScopeLock(session, {
    operationId: 'holder-operation',
    scope: 'project',
    workspaceRoot: workspace,
  })
  process.stdout.write('LOCKED\n')
  while (!(await exists(releasePath))) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  await lock.release()
}

function waitForLine(child, expected) {
  return new Promise((resolve, reject) => {
    let output = ''
    let errors = ''
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${expected}: ${output} ${errors}`))
    }, 30_000)
    child.stdout.on('data', chunk => {
      output += chunk.toString()
      if (output.includes(expected)) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.stderr.on('data', chunk => {
      errors += chunk.toString()
    })
    child.once('exit', code => {
      if (!output.includes(expected)) {
        clearTimeout(timer)
        reject(
          new Error(
            `Lock holder exited before readiness: code=${code} stderr=${errors}`,
          ),
        )
      }
    })
  })
}

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode)
  return new Promise(resolve => child.once('exit', resolve))
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}
