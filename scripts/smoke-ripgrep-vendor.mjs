import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const targetName =
  process.platform === 'win32'
    ? `${process.arch}-win32`
    : `${process.arch}-${process.platform}`
const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg'
const vendorBinary = path.join(
  repoRoot,
  'dist',
  'src',
  'utils',
  'vendor',
  'ripgrep',
  targetName,
  binaryName,
)

assert.ok(
  existsSync(vendorBinary),
  `Expected vendored ripgrep binary at ${vendorBinary}. Run npm.cmd run prepare:ripgrep and npm.cmd run build first.`,
)

process.env.PATH = ''
process.env.Path = ''
process.env.USE_BUILTIN_RIPGREP = 'true'

const { ripgrepCommand, ripGrep } = await import('../dist/src/utils/ripgrep.js')

const command = ripgrepCommand()
assert.equal(path.resolve(command.rgPath), path.resolve(vendorBinary))

const results = await ripGrep(
  ['--files', '--glob', 'src/**/*.ts'],
  repoRoot,
  AbortSignal.timeout(10_000),
)
assert.ok(results.length > 0, 'vendored ripgrep should list TypeScript files')

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: 'builtin',
      binary: command.rgPath,
      sampleCount: results.length,
    },
    null,
    2,
  ),
)
