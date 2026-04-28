import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(repoRoot, 'src')
const distRoot = join(repoRoot, 'dist')

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SOURCE_TARGET_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.txt',
  '.node',
]
const DIST_TARGET_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json', '.txt', '.node']
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
])
const SPECIAL_EXTERNAL_SPECS = new Set([
  '@ant/claude-for-chrome-mcp',
  '@ant/computer-use-input',
  '@ant/computer-use-swift',
  'bun:ffi',
])

const args = new Set(process.argv.slice(2))
const failOnMissingLocal = args.has('--fail-on-missing-local')
const failOnSpecialExternal = args.has('--fail-on-special-external')
const textOutput = args.has('--text')

function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory()
}

function walk(dir, out = []) {
  if (!isDirectory(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, out)
    } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      out.push(fullPath)
    }
  }
  return out
}

function stripCommentsPreserveStrings(text) {
  let out = ''
  let i = 0
  let state = 'code'
  let quote = ''

  while (i < text.length) {
    const char = text[i]
    const next = text[i + 1]

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line-comment'
        i += 2
        continue
      }
      if (char === '/' && next === '*') {
        state = 'block-comment'
        i += 2
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        state = 'string'
        quote = char
      }
      out += char
      i += 1
      continue
    }

    if (state === 'line-comment') {
      if (char === '\n') {
        state = 'code'
        out += char
      }
      i += 1
      continue
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code'
        i += 2
        continue
      }
      i += 1
      continue
    }

    out += char
    if (char === '\\') {
      if (i + 1 < text.length) {
        out += text[i + 1]
      }
      i += 2
      continue
    }
    if (char === quote) {
      state = 'code'
      quote = ''
    }
    i += 1
  }

  return out
}

function sourceCandidatesFor(basePath) {
  if (extname(basePath)) {
    const candidates = [basePath]
    if (basePath.endsWith('.js')) {
      const withoutJs = basePath.slice(0, -3)
      candidates.push(
        `${withoutJs}.ts`,
        `${withoutJs}.tsx`,
        `${withoutJs}.jsx`,
        `${withoutJs}.mjs`,
        `${withoutJs}.cjs`,
      )
    }
    return candidates
  }

  return [
    basePath,
    ...SOURCE_TARGET_EXTENSIONS.map(ext => `${basePath}${ext}`),
  ]
}

function distCandidatesFor(basePath) {
  if (extname(basePath)) {
    const candidates = [basePath]
    if (basePath.endsWith('.js')) {
      const withoutJs = basePath.slice(0, -3)
      candidates.push(
        `${withoutJs}.mjs`,
        `${withoutJs}.cjs`,
        `${withoutJs}.json`,
        `${withoutJs}.txt`,
        `${withoutJs}.node`,
      )
    }
    return candidates
  }

  return [basePath, ...DIST_TARGET_EXTENSIONS.map(ext => `${basePath}${ext}`)]
}

function hasDirectoryIndex(basePath, extensions) {
  if (!isDirectory(basePath)) return false
  return extensions.some(ext => isFile(join(basePath, `index${ext}`)))
}

function sourceTargetExists(fromFile, specifier) {
  const basePath = specifier.startsWith('.')
    ? resolve(dirname(fromFile), specifier)
    : join(repoRoot, specifier)

  return (
    sourceCandidatesFor(basePath).some(isFile) ||
    hasDirectoryIndex(basePath, SOURCE_TARGET_EXTENSIONS)
  )
}

function distFileForSource(fromFile) {
  const rel = relative(srcRoot, fromFile)
  const withoutSourceExt = rel.replace(/\.(ts|tsx|jsx)$/iu, '.js')
  return join(distRoot, 'src', withoutSourceExt)
}

function distTargetExists(fromFile, specifier) {
  const distFrom = distFileForSource(fromFile)
  const basePath = specifier.startsWith('.')
    ? resolve(dirname(distFrom), specifier)
    : join(distRoot, specifier)

  return (
    distCandidatesFor(basePath).some(isFile) ||
    hasDirectoryIndex(basePath, DIST_TARGET_EXTENSIONS)
  )
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split('\n').length
}

function relativePath(path) {
  return relative(repoRoot, path).replaceAll('\\', '/')
}

function scanRequireTargets() {
  const files = walk(srcRoot)
  const missingLocal = []
  const specialExternal = []
  let filesWithRequire = 0
  let requireCalls = 0

  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const text = stripCommentsPreserveStrings(raw)
    const requirePattern = /require\(\s*(['"])([^'"]+)\1\s*\)/gu
    let match
    let hasRequire = false

    while ((match = requirePattern.exec(text)) !== null) {
      hasRequire = true
      requireCalls += 1
      const specifier = match[2]
      const record = {
        file: relativePath(file),
        line: lineNumberForIndex(text, match.index),
        specifier,
      }

      if (specifier.startsWith('.') || specifier.startsWith('src/')) {
        const srcOk = sourceTargetExists(file, specifier)
        const distOk = distTargetExists(file, specifier)
        if (!srcOk || !distOk) {
          missingLocal.push({
            ...record,
            sourceTargetExists: srcOk,
            distTargetExists: distOk,
          })
        }
      } else if (SPECIAL_EXTERNAL_SPECS.has(specifier)) {
        specialExternal.push(record)
      }
    }

    if (hasRequire) filesWithRequire += 1
  }

  return {
    filesScanned: files.length,
    filesWithRequire,
    requireCalls,
    missingLocal: dedupeRecords(missingLocal),
    specialExternal: dedupeRecords(specialExternal),
  }
}

function dedupeRecords(records) {
  const seen = new Set()
  const out = []
  for (const record of records) {
    const key = `${record.file}\0${record.specifier}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(record)
  }
  return out.sort((a, b) =>
    `${a.file}:${a.specifier}`.localeCompare(`${b.file}:${b.specifier}`),
  )
}

const scan = scanRequireTargets()
const result = {
  ok:
    (!failOnMissingLocal || scan.missingLocal.length === 0) &&
    (!failOnSpecialExternal || scan.specialExternal.length === 0),
  repoRoot,
  summary: {
    filesScanned: scan.filesScanned,
    filesWithRequire: scan.filesWithRequire,
    requireCalls: scan.requireCalls,
    missingLocalCount: scan.missingLocal.length,
    specialExternalCount: scan.specialExternal.length,
  },
  missingLocal: scan.missingLocal,
  specialExternal: scan.specialExternal,
}

if (textOutput) {
  console.log(
    [
      `runtime target audit: ${result.ok ? 'ok' : 'failed'}`,
      `files scanned: ${result.summary.filesScanned}`,
      `files with require: ${result.summary.filesWithRequire}`,
      `require calls: ${result.summary.requireCalls}`,
      `missing local targets: ${result.summary.missingLocalCount}`,
      `special external targets: ${result.summary.specialExternalCount}`,
      '',
      ...result.missingLocal.map(
        item =>
          `missingLocal ${item.file}:${item.line} ${item.specifier} src=${item.sourceTargetExists} dist=${item.distTargetExists}`,
      ),
      ...result.specialExternal.map(
        item => `specialExternal ${item.file}:${item.line} ${item.specifier}`,
      ),
    ].join('\n'),
  )
} else {
  console.log(JSON.stringify(result, null, 2))
}

if (!result.ok) {
  process.exitCode = 1
}

