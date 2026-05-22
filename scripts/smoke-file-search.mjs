import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const fixtureRoot = path.join(repoRoot, '.tmp', 'smoke-file-search')
const distRipgrepDir = path.join(
  repoRoot,
  'dist',
  'src',
  'utils',
  'vendor',
  'ripgrep',
)
const distRipgrepBackupDir = path.join(
  repoRoot,
  '.tmp',
  'smoke-file-search-ripgrep-backup',
)

rmSync(fixtureRoot, { recursive: true, force: true })
mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true })
mkdirSync(path.join(fixtureRoot, 'docs'), { recursive: true })

writeFileSync(
  path.join(fixtureRoot, 'src', 'app.ts'),
  'export const needle = "file-search";\n',
  'utf8',
)
writeFileSync(
  path.join(fixtureRoot, 'docs', 'guide.md'),
  'This document mentions NEEDLE for content search.\n',
  'utf8',
)
writeFileSync(
  path.join(fixtureRoot, 'notes.txt'),
  'plain text without the target word\n',
  'utf8',
)

// Import after the env change so ripgrep config memoization sees the simulated
// "no rg on PATH, no vendored rg in dist" environment.
process.env.PATH = ''
process.env.Path = ''
process.env.USE_BUILTIN_RIPGREP = 'true'

rmSync(distRipgrepBackupDir, { recursive: true, force: true })
let movedRipgrepDir = false
if (existsSync(distRipgrepDir)) {
  mkdirSync(path.dirname(distRipgrepBackupDir), { recursive: true })
  renameSync(distRipgrepDir, distRipgrepBackupDir)
  movedRipgrepDir = true
}

try {
  const { glob } = await import('../dist/src/utils/glob.js')
  const { getRipgrepStatus, ripGrep, ripGrepStream, ripgrepCommand } =
    await import('../dist/src/utils/ripgrep.js')
  const { getEmptyToolPermissionContext } = await import('../dist/src/Tool.js')

  const command = ripgrepCommand()
  assert.match(
    command.rgPath,
    /vendor[\\/]+ripgrep[\\/]+.*[\\/]rg(?:\.exe)?$/,
    'smoke should exercise the missing vendored-rg path',
  )

  const globResult = await glob(
    '**/*.ts',
    fixtureRoot,
    { limit: 10, offset: 0 },
    AbortSignal.timeout(10_000),
    getEmptyToolPermissionContext(),
  )
  assert.deepEqual(
    globResult.files.map(file =>
      path.relative(fixtureRoot, file).replaceAll('\\', '/'),
    ),
    ['src/app.ts'],
  )

  const filesWithMatches = await ripGrep(
    ['--hidden', '-l', '-F', '-e', 'needle'],
    fixtureRoot,
    AbortSignal.timeout(10_000),
  )
  assert.deepEqual(
    filesWithMatches
      .map(file => path.relative(fixtureRoot, file).replaceAll('\\', '/'))
      .sort(),
    ['src/app.ts'],
  )
  const fallbackStatus = getRipgrepStatus()
  assert.equal(fallbackStatus.working, false)
  assert.equal(fallbackStatus.fallbackAvailable, true)

  const contentMatches = await ripGrep(
    ['--hidden', '-n', '-i', '-F', '-e', 'needle', '--glob', '*.md'],
    fixtureRoot,
    AbortSignal.timeout(10_000),
  )
  assert.deepEqual(
    contentMatches.map(line =>
      line.replace(fixtureRoot, '<fixture>').replaceAll('\\', '/'),
    ),
    [
      '<fixture>/docs/guide.md:1:This document mentions NEEDLE for content search.',
    ],
  )

  const streamLines = []
  await ripGrepStream(
    ['-n', '--no-heading', '-i', '-m', '10', '-F', '-e', 'needle'],
    fixtureRoot,
    AbortSignal.timeout(10_000),
    lines => streamLines.push(...lines),
  )
  assert.ok(
    streamLines.some(line => line.includes('src') && line.includes('needle')),
    'native stream fallback should emit matching lines',
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        fallback: 'native',
        fallbackAvailable: fallbackStatus.fallbackAvailable,
        globFiles: globResult.files.length,
        filesWithMatches: filesWithMatches.length,
        contentMatches: contentMatches.length,
        streamMatches: streamLines.length,
      },
      null,
      2,
    ),
  )
} finally {
  if (movedRipgrepDir) {
    rmSync(distRipgrepDir, { recursive: true, force: true })
    renameSync(distRipgrepBackupDir, distRipgrepDir)
  }
}
