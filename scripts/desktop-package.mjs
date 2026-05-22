#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const mode = process.argv.includes('--dist') ? 'dist' : 'dir'
const signed = process.argv.includes('--signed') || process.env.CCR_DESKTOP_SIGN === '1'
const npmExecPath = process.env.npm_execpath
const npmCommand = npmExecPath && existsSync(npmExecPath)
  ? process.execPath
  : process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm'
const npmArgs = npmExecPath && existsSync(npmExecPath)
  ? [npmExecPath, 'run', 'desktop:build']
  : ['run', 'desktop:build']
const prepareRipgrepArgs = npmExecPath && existsSync(npmExecPath)
  ? [npmExecPath, 'run', 'prepare:ripgrep']
  : ['run', 'prepare:ripgrep']
const builderCli = join(
  root,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js',
)
const iconBuilder = join(root, 'scripts', 'build-desktop-icons.mjs')

if (!existsSync(builderCli)) {
  console.error('electron-builder is not installed. Run npm.cmd install first.')
  process.exit(1)
}

if (signed) {
  assertSigningEnvironment()
}

await run(process.execPath, [iconBuilder])
await run(npmCommand, prepareRipgrepArgs)
await run(npmCommand, npmArgs)

const publishMode = process.env.CCR_DESKTOP_PUBLISH === '1' ? 'onTagOrDraft' : 'never'
const builderConfigArgs = signed ? ['--config', await writeSignedBuilderConfig()] : []
const builderArgs =
  mode === 'dir'
    ? [...builderConfigArgs, '--dir', '--publish', publishMode]
    : [...builderConfigArgs, '--publish', publishMode]

await run(process.execPath, [builderCli, ...builderArgs])

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`[desktop-package] ${command} ${args.join(' ')}`)
    const normalized = normalizeCommand(command, args)
    const child = spawn(normalized.command, normalized.args, {
      cwd: root,
      env: buildChildEnv(),
      shell: normalized.shell,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

async function writeSignedBuilderConfig() {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const buildConfig = structuredClone(packageJson.build)
  buildConfig.win = {
    ...buildConfig.win,
    signAndEditExecutable: true,
    verifyUpdateCodeSignature: true,
    forceCodeSigning: true,
  }

  const tempDir = join(root, 'tmp', 'desktop-package')
  const configPath = join(tempDir, 'electron-builder-signed.json')
  await mkdir(tempDir, { recursive: true })
  await writeFile(configPath, `${JSON.stringify(buildConfig, null, 2)}\n`, 'utf8')
  return configPath
}

function assertSigningEnvironment() {
  const pairs = [
    ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'],
    ['CSC_LINK', 'CSC_KEY_PASSWORD'],
  ]
  const complete = pairs.some(([linkKey, passwordKey]) => process.env[linkKey] && process.env[passwordKey])
  const partial = pairs.filter(([linkKey, passwordKey]) => Boolean(process.env[linkKey]) !== Boolean(process.env[passwordKey]))

  if (partial.length > 0) {
    const missing = partial
      .map(([linkKey, passwordKey]) => {
        if (!process.env[linkKey]) {
          return linkKey
        }
        return passwordKey
      })
      .join(', ')
    throw new Error(`Signed desktop build has incomplete certificate environment. Missing: ${missing}`)
  }

  if (!complete) {
    throw new Error(
      'Signed desktop build requires WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD or CSC_LINK/CSC_KEY_PASSWORD.',
    )
  }
}

function buildChildEnv() {
  const env = { ...process.env }
  if (!signed && !env.CSC_IDENTITY_AUTO_DISCOVERY) {
    env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  }
  return env
}

function normalizeCommand(command, args) {
  if (process.platform !== 'win32' || !command.toLowerCase().endsWith('.cmd')) {
    return { command, args, shell: false }
  }

  return {
    command: quoteForCmd([command, ...args]),
    args: [],
    shell: true,
  }
}

function quoteForCmd(parts) {
  return parts.map(part => `"${String(part).replace(/"/g, '""')}"`).join(' ')
}
