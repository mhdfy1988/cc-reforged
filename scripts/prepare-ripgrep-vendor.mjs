import { spawnSync } from 'node:child_process'
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const version = process.env.CCR_RIPGREP_VERSION || '1.18.0'

const target = parseTarget(process.argv.slice(2))
const platformPackage = getRipgrepPackage(target)
const targetName = `${target.arch}-${target.platform}`
const tempRoot = path.join(repoRoot, '.tmp', 'prepare-ripgrep-vendor')
const outputDir = path.join(repoRoot, 'vendor', 'ripgrep', targetName)
const npmExecPath = process.env.npm_execpath

await rm(tempRoot, { recursive: true, force: true })
await mkdir(tempRoot, { recursive: true })
await mkdir(outputDir, { recursive: true })

if (npmExecPath) {
  run(process.execPath, [
    npmExecPath,
    'pack',
    `${platformPackage}@${version}`,
    '--pack-destination',
    tempRoot,
  ])
} else {
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'pack',
    `${platformPackage}@${version}`,
    '--pack-destination',
    tempRoot,
  ])
}

const packedFiles = await readdir(tempRoot)
const tgz = packedFiles.find(file => file.endsWith('.tgz'))
if (!tgz) {
  throw new Error(`No ripgrep package tarball was produced in ${tempRoot}`)
}

run('tar', ['-xzf', path.join(tempRoot, tgz), '-C', tempRoot])

const unpackedDir = path.join(tempRoot, 'package')
const sourceBinary = path.join(
  unpackedDir,
  'bin',
  target.platform === 'win32' ? 'rg.exe' : 'rg',
)
const destinationBinary = path.join(
  outputDir,
  target.platform === 'win32' ? 'rg.exe' : 'rg',
)

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })
await copyFile(sourceBinary, destinationBinary)
if (target.platform !== 'win32') {
  await chmod(destinationBinary, 0o755)
}

const license = await readFile(path.join(unpackedDir, 'LICENSE'), 'utf8')
await writeFile(path.join(outputDir, 'LICENSE'), license, 'utf8')
await writeFile(
  path.join(outputDir, 'SOURCE.json'),
  `${JSON.stringify(
    {
      package: platformPackage,
      version,
      target: targetName,
      source: 'https://github.com/microsoft/vscode-ripgrep',
      license: 'MIT',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(
  JSON.stringify(
    {
      ok: true,
      package: platformPackage,
      version,
      target: targetName,
      binary: destinationBinary,
    },
    null,
    2,
  ),
)

function parseTarget(args) {
  const targetArg = args.find(arg => arg.startsWith('--target='))
  if (!targetArg) {
    return { platform: process.platform, arch: process.arch }
  }

  const raw = targetArg.slice('--target='.length)
  const [platform, arch] = raw.split('-')
  if (!platform || !arch) {
    throw new Error(`Invalid --target value: ${raw}. Expected platform-arch.`)
  }
  return { platform, arch }
}

function getRipgrepPackage({ platform, arch }) {
  const packages = {
    'darwin-arm64': '@vscode/ripgrep-darwin-arm64',
    'darwin-x64': '@vscode/ripgrep-darwin-x64',
    'linux-arm': '@vscode/ripgrep-linux-arm',
    'linux-arm64': '@vscode/ripgrep-linux-arm64',
    'linux-ia32': '@vscode/ripgrep-linux-ia32',
    'linux-ppc64': '@vscode/ripgrep-linux-ppc64',
    'linux-riscv64': '@vscode/ripgrep-linux-riscv64',
    'linux-s390x': '@vscode/ripgrep-linux-s390x',
    'linux-x64': '@vscode/ripgrep-linux-x64',
    'win32-arm64': '@vscode/ripgrep-win32-arm64',
    'win32-ia32': '@vscode/ripgrep-win32-ia32',
    'win32-x64': '@vscode/ripgrep-win32-x64',
  }

  const packageName = packages[`${platform}-${arch}`]
  if (!packageName) {
    throw new Error(`Unsupported ripgrep target: ${platform}-${arch}`)
  }
  return packageName
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        result.error ? String(result.error) : '',
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}
